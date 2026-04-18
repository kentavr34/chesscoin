"""
Совет директоров Клаудии v4.0 — 4 агента с failover
Analyst (DeepSeek R1) → Architect (Claude) → Tech Lead (Qwen3.6-Plus) → CEO (Claude)

Failover: если агент недоступен — переключается на резервную модель + уведомление в Telegram.
"""
import os
import logging
import requests as req_lib
from dotenv import load_dotenv

load_dotenv('/root/claudia/.env')
log = logging.getLogger(__name__)

ANTHROPIC_KEY  = os.getenv('ANTHROPIC_API_KEY', '')
DEEPSEEK_KEY   = os.getenv('DEEPSEEK_API_KEY', '')
QWEN_KEY       = os.getenv('QWEN_API_KEY', '')
OPENROUTER_KEY = os.getenv('OPENROUTER_API_KEY', '')
BOT_TOKEN      = os.getenv('TELEGRAM_BOT_TOKEN', '')
ADMIN_ID       = int(os.getenv('ADMIN_USER_ID', '0'))

from crewai import Agent, Task, Crew, Process
from crewai.llm import LLM


# ── Telegram уведомление (синхронное, fire-and-forget) ─────────────────────
def _tg_notify(text: str):
    """Отправить уведомление администратору через Telegram."""
    if not BOT_TOKEN or not ADMIN_ID:
        return
    try:
        req_lib.post(
            f'https://api.telegram.org/bot{BOT_TOKEN}/sendMessage',
            json={'chat_id': ADMIN_ID, 'text': text, 'parse_mode': 'HTML'},
            timeout=5
        )
    except Exception as e:
        log.warning(f'Telegram уведомление не отправлено: {e}')


# ── Failover-обёртка для LLM ───────────────────────────────────────────────
def make_resilient(llm: LLM, fallbacks: list, role_name: str) -> LLM:
    """
    Оборачивает метод llm.call() так, чтобы при ошибке
    последовательно пробовались резервные модели.
    Администратор получает уведомление о переключении.
    """
    original_call = llm.call

    def resilient_call(messages, *args, **kwargs):
        # Пробуем основную модель
        try:
            return original_call(messages, *args, **kwargs)
        except Exception as primary_err:
            log.warning(f'[{role_name}] основная модель {llm.model} недоступна: {primary_err}')

        # Перебираем резервные модели
        for fb_llm in fallbacks:
            try:
                result = fb_llm.call(messages, *args, **kwargs)
                # Уведомить администратора об успешном переключении
                _tg_notify(
                    f'⚠️ Агент <b>{role_name}</b> переключён на резерв\n'
                    f'Основная модель: {llm.model}\n'
                    f'Причина: {str(primary_err)[:200]}\n'
                    f'Резервная: <b>{fb_llm.model}</b>'
                )
                log.info(f'[{role_name}] переключился на {fb_llm.model}')
                return result
            except Exception as fb_err:
                log.warning(f'[{role_name}] резерв {fb_llm.model} тоже недоступен: {fb_err}')
                continue

        # Все модели недоступны — уведомить и поднять исходную ошибку
        _tg_notify(
            f'🚨 Агент <b>{role_name}</b> полностью недоступен!\n'
            f'Все модели ({llm.model} + {len(fallbacks)} резерв.) не отвечают.\n'
            f'Последняя ошибка: {str(primary_err)[:200]}'
        )
        raise primary_err

    llm.call = resilient_call
    return llm


# ── Модели ──────────────────────────────────────────────────────────────────
claude = LLM(
    model='anthropic/claude-sonnet-4-6',
    api_key=ANTHROPIC_KEY,
)

deepseek_r1 = LLM(
    model='deepseek/deepseek-reasoner',
    api_key=DEEPSEEK_KEY,
)

# Qwen3.6-Plus — нативная мультимодальность, передовой кодинг (вышел 2026-04-02)
qwen36_plus = LLM(
    model='openai/qwen3.6-plus-2026-04-02',
    api_key=QWEN_KEY,
    base_url='https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
)

# Резервная модель — DeepSeek V3 через OpenRouter (дешёво и надёжно)
_or_key = OPENROUTER_KEY or DEEPSEEK_KEY
deepseek_v3_fallback = LLM(
    model='openrouter/deepseek/deepseek-chat',
    api_key=_or_key,
    base_url='https://openrouter.ai/api/v1',
)

# Вторичный резерв через DeepSeek API напрямую
deepseek_v3_direct = LLM(
    model='deepseek/deepseek-chat',
    api_key=DEEPSEEK_KEY,
)


# ── Применяем failover ───────────────────────────────────────────────────────
# Claude: резерв → DeepSeek V3 (OpenRouter) → DeepSeek V3 (прямой)
claude_resilient = make_resilient(
    claude,
    fallbacks=[deepseek_v3_fallback, deepseek_v3_direct],
    role_name='Архитектор/CEO',
)

# DeepSeek R1: резерв → DeepSeek V3 (быстрее/дешевле для простых задач)
deepseek_r1_resilient = make_resilient(
    deepseek_r1,
    fallbacks=[deepseek_v3_fallback, claude],
    role_name='Аналитик',
)

# Qwen: резерв → DeepSeek V3 → Claude
qwen_resilient = make_resilient(
    qwen36_plus,
    fallbacks=[deepseek_v3_fallback, claude],
    role_name='Tech Lead',
)


# ── Агенты ───────────────────────────────────────────────────────────────────
analyst = Agent(
    role='Аналитик требований',
    goal='Глубоко проанализировать задачу: суть, риски, скрытые требования, зависимости',
    backstory=(
        'Системный аналитик с 15 годами опыта. '
        'Находишь проблемы до старта разработки, думаешь о последствиях каждого решения.'
    ),
    llm=deepseek_r1_resilient,
    verbose=False,
    allow_delegation=False,
)

architect = Agent(
    role='Архитектор решения',
    goal='Спроектировать оптимальное техническое решение',
    backstory=(
        'Главный архитектор ChessCoin. Стек: Next.js, NestJS, PostgreSQL, Redis. '
        'Приоритеты: надёжность, простота, масштабируемость.'
    ),
    llm=claude_resilient,
    verbose=False,
    allow_delegation=False,
)

tech_lead = Agent(
    role='Tech Lead (Разработка + Дизайн)',
    goal=(
        'Детализировать реализацию: конкретные файлы, код, '
        'UI-компоненты и стили. Анализировать скриншоты и макеты.'
    ),
    backstory=(
        'Senior full-stack разработчик и UI-эксперт. '
        'Пишет TypeScript/Python, знает дизайн-систему ChessCoin: '
        'тёмная тема, золотые акценты (#FFD700), глоу-эффекты. '
        'Видит скриншоты и сразу понимает что нужно изменить в коде.'
    ),
    llm=qwen_resilient,
    verbose=False,
    allow_delegation=False,
)

director = Agent(
    role='Генеральный директор',
    goal='Принять финальное решение и оформить задачу для разработчика',
    backstory=(
        'CEO ChessCoin. Балансирует скорость, качество и бизнес-ценность. '
        'Формулирует чёткие задачи которые можно сразу отдать в работу.'
    ),
    llm=claude_resilient,
    verbose=False,
    allow_delegation=False,
)


def run_board(description: str, project: str = None) -> str:
    context = f"Проект: {project}\n\n" if project else ""
    full_desc = context + description

    t_analysis = Task(
        description=(
            f"Проанализируй задачу:\n\n{full_desc}\n\n"
            "Определи: суть задачи, риски реализации, неочевидные требования, "
            "зависимости от других модулей системы."
        ),
        expected_output="Структурированный анализ: суть, риски, требования, зависимости.",
        agent=analyst,
    )

    t_architecture = Task(
        description=(
            "На основе анализа — предложи архитектурное решение. "
            "Какие слои системы затронуть (frontend/backend/DB), "
            "какой подход выбрать и почему."
        ),
        expected_output="Архитектурное решение с обоснованием выбора подхода.",
        agent=architect,
        context=[t_analysis],
    )

    t_implementation = Task(
        description=(
            "Детализируй реализацию с учётом архитектуры.\n\n"
            "1. РАЗРАБОТКА: конкретные файлы для изменения, функции/методы, примеры кода.\n"
            "2. ДИЗАЙН (если есть UI): компоненты, стили, CSS-переменные. "
            "Соответствие дизайн-системе ChessCoin.\n\n"
            f"Задача: {full_desc}"
        ),
        expected_output="Детальный план: код + UI-детали если применимо.",
        agent=tech_lead,
        context=[t_analysis, t_architecture],
    )

    t_decision = Task(
        description=(
            "Прими финальное решение на основе мнений команды.\n\n"
            "Оформи задачу СТРОГО в формате:\n\n"
            "ЗАДАЧА: [краткое название]\n"
            "ОПИСАНИЕ: [что нужно сделать, 2-4 предложения]\n"
            "ЭТАПЫ:\n"
            "1. [этап]\n"
            "2. [этап]\n"
            "3. [этап]\n"
            "ФОРМАТ ОТЧЁТА: [text/code/both]\n"
            "ОЖИДАЕМЫЙ РЕЗУЛЬТАТ: [что должно работать после выполнения]"
        ),
        expected_output="Финальное решение строго в указанном формате.",
        agent=director,
        context=[t_analysis, t_architecture, t_implementation],
    )

    crew = Crew(
        agents=[analyst, architect, tech_lead, director],
        tasks=[t_analysis, t_architecture, t_implementation, t_decision],
        process=Process.sequential,
        verbose=False,
    )
    result = crew.kickoff()
    return str(result)


if __name__ == '__main__':
    print("Тест совета директоров v4.0 (с failover)...")
    r = run_board(
        "Добавить кнопку 'Поделиться' на экран результата шахматной партии. "
        "При нажатии — генерировать картинку с позицией и счётом.",
        project='chesscoin'
    )
    print(r)
