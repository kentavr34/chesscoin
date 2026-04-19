"""
team_seed.py — стартовый состав AI_TEAM Клаудии (8 специалистов).

Запуск один раз после миграции 002:
    python3 team_seed.py
"""
import sys
sys.path.insert(0, '/root/claudia')
from team import Commander


SEED = [
    {
        'name': 'archivist', 'persona': 'Архивариус',
        'department': 'ops',
        'job': 'Бэкапы, ротация, восстановление данных, архивирование старых диалогов',
        'default_provider': 'dashscope', 'default_model': 'qwen-flash',
        'tier': 'fast',
        'specialization': ['backup', 'pg_dump', 'gdrive', 'archive'],
        'trigger_keywords': ['бэкап', 'архив', 'восстанови', 'dump', 'rotate'],
        'budget_monthly': 0.50,
    },
    {
        'name': 'librarian', 'persona': 'Библиотекарь',
        'department': 'ops',
        'job': 'Поиск в памяти (PG/RAG/semantic), теги, индексы, классификация',
        'default_provider': 'dashscope', 'default_model': 'qwen-plus',
        'tier': 'standard',
        'specialization': ['pgvector', 'fts', 'rag', 'tags', 'search'],
        'trigger_keywords': ['найди', 'помнишь', 'recall', 'search', 'память'],
        'budget_monthly': 1.50,
    },
    {
        'name': 'developer', 'persona': 'Девелопер',
        'department': 'dev',
        'job': 'Код, ревью, миграции БД, деплой, отладка',
        'default_provider': 'dashscope', 'default_model': 'qwen3-coder-plus',
        'tier': 'code',
        'specialization': ['python', 'sql', 'react', 'typescript', 'docker'],
        'trigger_keywords': ['код', 'баг', 'фикс', 'рефакторинг', 'деплой'],
        'budget_monthly': 3.00,
    },
    {
        'name': 'secretary', 'persona': 'Секретарь',
        'department': 'ops',
        'job': 'Документы, файлы, google drive, почта, расписание',
        'default_provider': 'anthropic', 'default_model': 'claude-haiku-4-5',
        'tier': 'fast',
        'specialization': ['docs', 'files', 'email', 'calendar'],
        'trigger_keywords': ['документ', 'файл', 'письмо', 'встреча'],
        'budget_monthly': 0.80,
    },
    {
        'name': 'accountant', 'persona': 'Бухгалтер',
        'department': 'finance',
        'job': 'API-балансы, траты, алерты о низких балансах, месячные отчёты',
        'default_provider': 'dashscope', 'default_model': 'qwen-flash',
        'tier': 'fast',
        'specialization': ['billing', 'balance', 'cost_tracking'],
        'trigger_keywords': ['баланс', 'расход', 'стоимость', 'бюджет'],
        'budget_monthly': 0.30,
    },
    {
        'name': 'psychologist', 'persona': 'Психолог',
        'department': 'dialog',
        'job': 'Живой диалог с Кенаном, голос, настроение, поддержка, общение',
        'default_provider': 'anthropic', 'default_model': 'claude-sonnet-4-6',
        'tier': 'standard',
        'specialization': ['chat', 'voice', 'empathy', 'personality'],
        'trigger_keywords': ['привет', 'как дела', 'расскажи', 'что думаешь'],
        'budget_monthly': 4.00,
    },
    {
        'name': 'dispatcher', 'persona': 'Диспетчер',
        'department': 'ops',
        'job': 'crew_board, планирование задач, cron, таймеры, очереди',
        'default_provider': 'dashscope', 'default_model': 'qwen-flash',
        'tier': 'fast',
        'specialization': ['scheduling', 'cron', 'systemd', 'queue'],
        'trigger_keywords': ['задача', 'запланируй', 'таймер', 'очередь'],
        'budget_monthly': 0.30,
    },
    {
        'name': 'analyst', 'persona': 'Аналитик',
        'department': 'intelligence',
        'job': 'Reflection, метрики, недельные отчёты, тренды, прогнозы',
        'default_provider': 'anthropic', 'default_model': 'claude-opus-4-7',
        'tier': 'deep',
        'specialization': ['reflection', 'analytics', 'trends', 'summary'],
        'trigger_keywords': ['проанализируй', 'отчёт', 'тренд', 'статистика'],
        'budget_monthly': 2.00,
    },
]


SEED_LESSONS = [
    ('all', 'В диалоге — используй только русский, если Кенан не попросит сменить язык. Правило не применяется к коду, логам, коммитам.'),
    ('librarian', 'При поиске всегда сначала semantic/RAG, потом FTS — так выше шанс найти по смыслу.'),
    ('librarian', 'Не бери из БД записи с category=error или archived=TRUE — это мусор.'),
    ('developer', 'В chesscoin — только русские комментарии и коммиты.'),
    ('developer', 'Не говори "сделал" без визуального подтверждения.'),
    ('developer', 'Не используй window.innerWidth — только CSS media queries.'),
    ('psychologist', 'Клаудиа — женского рода: "поняла", "приняла", "готова".'),
    ('psychologist', 'Голос — только короткие фразы: не читать весь текст задачи, только подтверждение.'),
    ('archivist', 'Бэкапы ежедневно 04:00 UTC, ротация отключена — Кенан сам удалит.'),
    ('analyst', 'Reflection по воскресеньям 04:00 UTC, результат в RAG + Telegram.'),
]


def main():
    cmdr = Commander()
    print('Нанимаю стартовую команду...')
    for spec in SEED:
        ok = cmdr.hire(
            name=spec['name'],
            persona=spec['persona'],
            job=spec['job'],
            department=spec['department'],
            default_provider=spec['default_provider'],
            default_model=spec['default_model'],
            tier=spec['tier'],
            specialization=spec['specialization'],
            trigger_keywords=spec['trigger_keywords'],
            budget_monthly=spec['budget_monthly'],
            hired_by='kenan',
        )
        print(f'  {"✓" if ok else "✗"} {spec["persona"]} ({spec["name"]}) → {spec["default_model"]}')

    print('\nДобавляю стартовые уроки...')
    for role, lesson in SEED_LESSONS:
        if role == 'all':
            # выдаём всем
            for s in SEED:
                cmdr.teach(s['name'], lesson, source='kenan')
        else:
            cmdr.teach(role, lesson, source='kenan')
    print(f'  ✓ {len(SEED_LESSONS)} уроков записано')

    print('\nТекущий состав:')
    for r in cmdr.roster():
        print(f'  {r["persona"]:15s} [{r["department"]:12s}] → {r["current_model"]:25s} (уроков: {r["lessons"]})')

    print('\nГотово.')


if __name__ == '__main__':
    main()
