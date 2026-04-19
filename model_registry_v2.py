"""
model_registry.py — Единый реестр LLM для Клаудии. v2 (2026-04-17).

Все модули (bot, architect, crew_board, self_update, learn, aider_runner,
commander, task_suggester, intelligence) должны вызывать LLM только через
эту обёртку.

Изменения v2:
- Добавлен DashScope (Alibaba Qwen) — OpenAI-совместимый endpoint
- Новые tier: 'code' (qwen3-coder-plus), embed() для векторизации
- Qwen-plus становится дефолтом standard (дешевле Sonnet, качество сопоставимо)
- OpenRouter free-tier — финальный fallback (llama-3.1-8b-free)
- Функция embed() для pgvector (text-embedding-v4, 1536 dim)

Использование:
    from model_registry import call_llm, embed

    text = call_llm('Привет', tier='fast')
    code = call_llm('Напиши функцию', tier='code')
    vec  = embed('текст')           # list[1536 float]
    vecs = embed(['a','b','c'])     # list[list[float]]
"""
import os
import logging
import httpx
from typing import Optional, List, Dict, Union
from dotenv import load_dotenv

load_dotenv('/root/claudia/.env')
log = logging.getLogger('model_registry')


# ═══════════════════════════════════════════════════════════════════════
# TIERS
# ═══════════════════════════════════════════════════════════════════════

TIERS = {
    # fast: ack, классификация (~$0.0001). Начинаем с бесплатных OR!
    'fast': [
        {'provider': 'openrouter', 'model': 'nvidia/nemotron-nano-9b-v2:free'},
        {'provider': 'openrouter', 'model': 'meta-llama/llama-3.3-70b-instruct:free'},
        {'provider': 'dashscope',  'model': 'qwen-flash'},
        {'provider': 'mulerouter', 'model': 'qwen-flash'},
        {'provider': 'anthropic',  'model': 'claude-haiku-4-5'},
        {'provider': 'deepseek',   'model': 'deepseek-chat'},
    ],

    # standard: обычный диалог (~$0.001-0.005)
    'standard': [
        {'provider': 'dashscope',  'model': 'qwen-plus'},
        {'provider': 'mulerouter', 'model': 'qwen-plus'},
        {'provider': 'openrouter', 'model': 'deepseek/deepseek-chat-v3:free'},
        {'provider': 'anthropic',  'model': 'claude-sonnet-4-6'},
        {'provider': 'deepseek',   'model': 'deepseek-chat'},
        {'provider': 'openrouter', 'model': 'anthropic/claude-sonnet-4-6'},
    ],

    # code: программирование
    'code': [
        {'provider': 'dashscope',  'model': 'qwen3-coder-plus'},
        {'provider': 'mulerouter', 'model': 'grok-code-fast-1'},
        {'provider': 'anthropic',  'model': 'claude-sonnet-4-6'},
        {'provider': 'openrouter', 'model': 'qwen/qwen3-coder:free'},
        {'provider': 'deepseek',   'model': 'deepseek-coder'},
    ],

    # deep: архитектура, reflection (~$0.015-0.075)
    'deep': [
        {'provider': 'anthropic',  'model': 'claude-opus-4-7'},
        {'provider': 'dashscope',  'model': 'qwen-max'},
        {'provider': 'mulerouter', 'model': 'qwen3-max'},
        {'provider': 'mulerouter', 'model': 'grok-4-fast-reasoning'},
        {'provider': 'openrouter', 'model': 'anthropic/claude-opus-4-7'},
        {'provider': 'anthropic',  'model': 'claude-sonnet-4-6'},
    ],
}


# ═══════════════════════════════════════════════════════════════════════
# PROVIDERS
# ═══════════════════════════════════════════════════════════════════════

_DASHSCOPE_BASE = os.getenv('DASHSCOPE_BASE_URL') or 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
_OPENROUTER_BASE = os.getenv('OPENROUTER_BASE_URL') or 'https://openrouter.ai/api/v1'

PROVIDERS = {
    'anthropic': {
        'url':      'https://api.anthropic.com/v1/messages',
        'key_env':  'ANTHROPIC_API_KEY_DIRECT',
        'format':   'anthropic',
        'timeout':  60,
    },
    'openrouter': {
        'url':      _OPENROUTER_BASE + '/chat/completions',
        'key_env':  'OPENROUTER_API_KEY',
        'format':   'openai',
        'timeout':  60,
    },
    'deepseek': {
        'url':      'https://api.deepseek.com/v1/chat/completions',
        'key_env':  'DEEPSEEK_API_KEY',
        'format':   'openai',
        'timeout':  45,
    },
    'dashscope': {
        'url':       _DASHSCOPE_BASE + '/chat/completions',
        'embed_url': _DASHSCOPE_BASE + '/embeddings',
        'key_env':   'DASHSCOPE_API_KEY',
        'format':    'openai',
        'timeout':   45,
    },
    'mulerouter': {
        'url':      'https://api.mulerouter.ai/vendors/openai/v1/chat/completions',
        'key_env':  'MULEROUTER_API_KEY',
        'format':   'openai',
        'timeout':  60,
    },
    'openai': {
        'url':       'https://api.openai.com/v1/chat/completions',
        'embed_url': 'https://api.openai.com/v1/embeddings',
        'key_env':   'OPENAI_API_KEY',
        'format':    'openai',
        'timeout':   45,
    },
}


NO_TEMPERATURE_MODELS = {
    'claude-opus-4-7', 'anthropic/claude-opus-4-7',
    'qwen-max-thinking', 'qwen3-max-thinking',
}


# ═══════════════════════════════════════════════════════════════════════
# Internal provider callers
# ═══════════════════════════════════════════════════════════════════════

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
    key = os.getenv(cfg['key_env'], '')
    if not key:
        return None
    try:
        messages = []
        if system:
            messages.append({'role': 'system', 'content': system})
        messages.append({'role': 'user', 'content': user})

        headers = {'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}
        if 'openrouter' in cfg['url']:
            headers['HTTP-Referer'] = 'https://chesscoin.app'
            headers['X-Title'] = 'Claudia'

        body = {
            'model': model,
            'messages': messages,
            'max_tokens': kw.get('max_tokens', 1000),
        }
        if model not in NO_TEMPERATURE_MODELS:
            body['temperature'] = kw.get('temperature', 0.3)

        r = httpx.post(cfg['url'], headers=headers, json=body, timeout=cfg['timeout'])
        if r.status_code == 200:
            return r.json()['choices'][0]['message']['content'].strip()
        log.warning(f'{cfg["url"]} {model}: HTTP {r.status_code} — {r.text[:200]}')
        return None
    except Exception as e:
        log.warning(f'{cfg["url"]} {model}: {e}')
        return None


# ═══════════════════════════════════════════════════════════════════════
# Public — chat
# ═══════════════════════════════════════════════════════════════════════

def call_llm(
    user: str,
    system: str = '',
    tier: str = 'standard',
    max_tokens: int = 1000,
    temperature: float = 0.3,
) -> str:
    if tier not in TIERS:
        log.error(f'Unknown tier: {tier}')
        return ''

    for entry in TIERS[tier]:
        provider = entry['provider']
        model    = entry['model']
        cfg      = PROVIDERS.get(provider)
        if not cfg:
            continue

        log.debug(f'Trying {provider}/{model} (tier={tier})')

        if cfg['format'] == 'anthropic':
            result = _call_anthropic(cfg, model, system, user,
                                     max_tokens=max_tokens, temperature=temperature)
        else:
            result = _call_openai_compat(cfg, model, system, user,
                                         max_tokens=max_tokens, temperature=temperature)

        if result:
            log.info(f'✓ {provider}/{model} ({len(result)} chars)')
            return result

    log.error(f'All providers failed for tier={tier}')
    return ''


def call_llm_messages(
    messages: List[Dict],
    tier: str = 'standard',
    max_tokens: int = 1000,
    temperature: float = 0.3,
) -> str:
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
# Public — embeddings
# ═══════════════════════════════════════════════════════════════════════

EMBED_TIERS = [
    {
        'provider':   'dashscope',
        'model':      os.getenv('EMBEDDING_MODEL', 'text-embedding-v4'),
        'dimensions': int(os.getenv('EMBEDDING_DIM', '1536')),
    },
    {
        'provider':   'openai',
        'model':      'text-embedding-3-small',
        'dimensions': 1536,
    },
]


def embed(text: Union[str, List[str]]) -> Union[List[float], List[List[float]]]:
    """
    Векторизация. Строка → list[float], список → list[list[float]].
    Fallback DashScope → OpenAI. При полном провале — нулевой вектор.
    """
    batch  = isinstance(text, list)
    inputs = text if batch else [text]

    for entry in EMBED_TIERS:
        provider = entry['provider']
        cfg      = PROVIDERS.get(provider, {})
        key      = os.getenv(cfg.get('key_env', ''), '')
        url      = cfg.get('embed_url', '')
        if not key or not url:
            continue
        try:
            body = {
                'model':      entry['model'],
                'input':      inputs,
                'dimensions': entry['dimensions'],
            }
            r = httpx.post(
                url,
                headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
                json=body,
                timeout=cfg.get('timeout', 45),
            )
            if r.status_code == 200:
                data = r.json()['data']
                vecs = [item['embedding'] for item in data]
                log.debug(f'✓ {provider}/{entry["model"]} embed {len(vecs)}')
                return vecs if batch else vecs[0]
            log.warning(f'Embed {provider}: HTTP {r.status_code} — {r.text[:200]}')
        except Exception as e:
            log.warning(f'Embed {provider}: {e}')

    log.error('ALL embedding providers failed')
    dim  = EMBED_TIERS[0]['dimensions']
    zero = [0.0] * dim
    return [zero for _ in inputs] if batch else zero


# ═══════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    import sys
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')

    if len(sys.argv) < 2:
        print('Использование:')
        print('  python3 model_registry.py <tier> "prompt"   # chat (fast/standard/code/deep)')
        print('  python3 model_registry.py embed "текст"     # embedding')
        print('  python3 model_registry.py selftest          # полная проверка')
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == 'embed':
        text = ' '.join(sys.argv[2:]) or 'тест'
        vec  = embed(text)
        print(f'dim={len(vec)}, first_5={vec[:5]}')
    elif cmd == 'selftest':
        print('=== Chat ===')
        for tier in ('fast', 'standard', 'code', 'deep'):
            print(f'\n[{tier}]')
            r = call_llm('Скажи одним словом: работаю', tier=tier, max_tokens=20)
            print(f'  → {r[:80]}')
        print('\n=== Embed ===')
        v = embed('тест размерности')
        print(f'  dim={len(v)}, non-zero={sum(1 for x in v if x != 0)}/{len(v)}')
    elif cmd in TIERS:
        prompt = ' '.join(sys.argv[2:]) or 'Кто ты? Один абзац.'
        print(f'[tier={cmd}]\n{call_llm(prompt, tier=cmd, max_tokens=300)}')
    else:
        print(f'Unknown: {cmd}')
        sys.exit(1)
