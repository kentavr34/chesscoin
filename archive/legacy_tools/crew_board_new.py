"""
Совет директоров Клаудии v3.0 — 4 агента
Analyst (DeepSeek R1) → Architect (Claude) → Tech Lead (Qwen3.6-Plus) → CEO (Claude)

Qwen3.6-Plus = нативная мультимодальность — видит картинки И пишет код.
Один агент заменяет Кодера + Дизайнера.
"""
import os
from dotenv import load_dotenv

load_dotenv('/root/claudia/.env')

ANTHROPIC_KEY = os.getenv('ANTHROPIC_API_KEY')
DEEPSEEK_KEY  = os.getenv('DEEPSEEK_API_KEY')
QWEN_KEY      = os.getenv('QWEN_API_KEY')

from crewai import Agent, Task, Crew, Process
from crewai.llm import LLM

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

# ── Агенты ───────────────────────────────────────────────────────────────────
analyst = Agent(
    role='Аналитик требований',
    goal='Глубоко проанализировать задачу: суть, риски, скрытые требования, зависимости',
    backstory=(
        'Системный аналитик с 15 годами опыта. '
        'Находишь проблемы до старта разработки, думаешь о последствиях каждого решения.'
    ),
    llm=deepseek_r1,
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
    llm=claude,
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
    llm=qwen36_plus,
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
    llm=claude,
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
    print("Тест совета директоров v3.0...")
    r = run_board(
        "Добавить кнопку 'Поделиться' на экран результата шахматной партии. "
        "При нажатии — генерировать картинку с позицией и счётом.",
        project='chesscoin'
    )
    print(r)
