"""
model_registry.py — Единый реестр LLM для Клаудии.

Все модули (bot, architect, crew_board, self_update, learn, aider_runner,
commander, task_suggester) должны вызывать LLM только через эту обёртку.

При выходе новых моделей (Opus 5, Sonnet 5, GPT-5) — миграция в одном месте.

Использование:
    from model_registry import call_llm

    # Простой вызов с автовыбором tier
    response = call_llm('Привет', tier='fast')

    # С системным промптом
    response = call_llm(
        user='Объясни квантовую механику',
        system='Ты — физик',
        tier='deep',  # Opus 4.7 для сложных задач
        max_tokens=800,
    )

    # Автоматический failover провайдеров в рамках tier
"""
import os
import logging
import httpx
from typing import Optional, List, Dict
from dotenv import load_dotenv

load_dotenv('/root/claudia/.env')
log = logging.getLogger('model_registry')

# ═══════════════════════════════════════════════════════════════════════
# TIERS — классификация моделей по сложности/стоимости
# ═══════════════════════════════════════════════════════════════════════

TIERS = {
    # fast: классификация интентов, ack-фразы, быстрые ответы
    # Стоимость: ~$0.0001-0.0005 за запрос
    'fast': [
        {'provider': 'anthropic',   'model': 'claude-haiku-4-5'},
        {'provider': 'openrouter',  'model': 'anthropic/claude-haiku-4-5'},
        {'provider': 'deepseek',    'model': 'deepseek-chat'},
    ],

    # standard: задачи средней сложности (PMI, диалоги, самомодификация)
    # Стоимость: ~$0.003-0.01 за запрос
    'standard': [
        {'provider': 'anthropic',   'model': 'claude-sonnet-4-6'},
        {'provider': 'openrouter',  'model': 'anthropic/claude-sonnet-4-6'},
        {'provider': 'deepseek',    'model': 'deepseek-chat'},
    ],

    # deep: архитектурные решения, сложный рефакторинг, глубокий анализ
    # Стоимость: ~$0.015-0.075 за запрос
    'deep': [
        {'provider': 'anthropic',   'model': 'claude-opus-4-7'},
        {'provider': 'openrouter',  'model': 'anthropic/claude-opus-4-7'},
        {'provider': 'anthropic',   'model': 'claude-sonnet-4-6'},  # fallback
    ],
}

# ═══════════════════════════════════════════════════════════════════════
# PROVIDERS — конфигурация API-провайдеров
# ═══════════════════════════════════════════════════════════════════════

PROVIDERS = {
    'anthropic': {
        'url': 'https://api.anthropic.com/v1/messages',
        'key_env': 'ANTHROPIC_API_KEY_DIRECT',
        'format': 'anthropic',
        'timeout': 60,
    },
    'openrouter': {
        'url': os.getenv('ANTHROPIC_BASE_URL', 'https://openrouter.ai/api/v1') + '/chat/completions',
        'key_env': 'ANTHROPIC_API_KEY',
        'format': 'openai',
        'timeout': 60,
    },
    'deepseek': {
        'url': 'https://api.deepseek.com/v1/chat/completions',
        'key_env': 'DEEPSEEK_API_KEY',
        'format': 'openai',
        'timeout': 45,
    },
}


# ═══════════════════════════════════════════════════════════════════════
# Internal — вызов конкретного провайдера
# ═══════════════════════════════════════════════════════════════════════

# Модели, которые НЕ поддерживают temperature (Opus 4.7+, thinking-модели)
NO_TEMPERATURE_MODELS = {'claude-opus-4-7', 'anthropic/claude-opus-4-7'}


def _call_anthropic(cfg: Dict, model: str, system: str, user: str, **kw) -> Optional[str]:
    key = os.getenv(cfg['key_env'], '')
    if not key:
        return None
    try:
        body = {
            'model': model,
            'max_tokens': kw.get('max_tokens', 1000),
            **({'system': system} if system else {}),
            'messages': [{'role': 'user', 'content': user}],
        }
        # temperature добавляем только если модель поддерживает
        if model not in NO_TEMPERATURE_MODELS:
            body['temperature'] = kw.get('temperature', 0.3)
        r = httpx.post(
            cfg['url'],
            headers={
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            json=body,
            timeout=cfg['timeout'],
        )
        if r.status_code == 200:
            return r.json()['content'][0]['text'].strip()
        log.warning(f'Anthropic {model}: HTTP {r.status_code} — {r.text[:200]}')
        return None
    except Exception as e:
        log.warning(f'Anthropic {model}: {e}')
        return None


def _call_openai_compat(cfg: Dict, model: str, system: str, user: str, **kw) -> Optional[str]:
    """OpenAI-совместимый формат (OpenRouter, DeepSeek, MuleRouter)."""
    key = os.getenv(cfg['key_env'], '')
    if not key:
        return None
    try:
        messages = []
        if system:
            messages.append({'role': 'system', 'content': system})
        messages.append({'role': 'user', 'content': user})

        headers = {'Authorization': f'Bearer {key}'}
        # OpenRouter требует Referer
        if 'openrouter' in cfg['url']:
            headers['HTTP-Referer'] = 'https://chesscoin.app'

        body = {
            'model': model,
            'messages': messages,
            'max_tokens': kw.get('max_tokens', 1000),
        }
        if model not in NO_TEMPERATURE_MODELS:
            body['temperature'] = kw.get('temperature', 0.3)

        r = httpx.post(
            cfg['url'],
            headers=headers,
            json=body,
            timeout=cfg['timeout'],
        )
        if r.status_code == 200:
            return r.json()['choices'][0]['message']['content'].strip()
        log.warning(f'{cfg["url"]} {model}: HTTP {r.status_code}')
        return None
    except Exception as e:
        log.warning(f'{cfg["url"]} {model}: {e}')
        return None


# ═══════════════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════════════

def call_llm(
    user: str,
    system: str = '',
    tier: str = 'standard',
    max_tokens: int = 1000,
    temperature: float = 0.3,
) -> str:
    """
    Главная функция — автоматический failover в рамках tier.

    tier:
      'fast'     — быстрые ответы (Haiku 4.5 / DeepSeek) ~$0.0002
      'standard' — задачи средней сложности (Sonnet 4.6) ~$0.005
      'deep'     — архитектура, сложный анализ (Opus 4.7) ~$0.02

    Возвращает текст ответа или '' если все провайдеры упали.
    """
    if tier not in TIERS:
        log.error(f'Unknown tier: {tier}')
        return ''

    for entry in TIERS[tier]:
        provider = entry['provider']
        model    = entry['model']
        cfg      = PROVIDERS.get(provider)
        if not cfg:
            continue

        log.debug(f'Trying {provider} / {model} (tier={tier})')

        if cfg['format'] == 'anthropic':
            result = _call_anthropic(cfg, model, system, user,
                                     max_tokens=max_tokens, temperature=temperature)
        else:
            result = _call_openai_compat(cfg, model, system, user,
                                         max_tokens=max_tokens, temperature=temperature)

        if result:
            log.info(f'✓ {provider}/{model} responded ({len(result)} chars)')
            return result

    log.error(f'All providers failed for tier={tier}')
    return ''


def call_llm_messages(
    messages: List[Dict],
    tier: str = 'standard',
    max_tokens: int = 1000,
    temperature: float = 0.3,
) -> str:
    """
    Вариант с готовым списком messages (для многоходовых диалогов).
    """
    system = ''
    user_parts = []
    for m in messages:
        if m['role'] == 'system':
            system = m['content']
        else:
            user_parts.append(f'[{m["role"].upper()}]: {m["content"]}')
    user = '\n\n'.join(user_parts)
    return call_llm(user, system, tier, max_tokens, temperature)


# ═══════════════════════════════════════════════════════════════════════
# CLI для тестирования
# ═══════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    import sys
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')

    if len(sys.argv) < 2:
        print('Использование: python3 model_registry.py <tier> [prompt]')
        print('tier: fast | standard | deep')
        sys.exit(1)

    tier = sys.argv[1]
    prompt = ' '.join(sys.argv[2:]) if len(sys.argv) > 2 else 'Скажи одним предложением: ты какая модель?'

    print(f'Tier: {tier}')
    print(f'Prompt: {prompt}\n')
    response = call_llm(prompt, tier=tier, max_tokens=200)
    print(f'Response:\n{response}')
