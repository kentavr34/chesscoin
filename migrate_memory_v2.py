"""
migrate_memory_v2.py — Миграция памяти Клаудии на новую архитектуру.

СЦЕНАРИЙ:
  1. IDENTITY.md — сохраняется как есть, но помечается как [PROTECTED]
  2. SKILLS.md — текущий монолит → конвертируется в 1 исторический блок + шапка журнала
  3. KNOWLEDGE.md — то же самое
  4. PROJECTS.md — то же самое
  5. Бэкапы старых версий в .backups/
  6. Новые структурированные записи (несколько примеров)
"""
import shutil
from datetime import datetime
from pathlib import Path

BASE = Path('/root/claudia')
BACKUP_DIR = BASE / '.backups'
BACKUP_DIR.mkdir(exist_ok=True)


def backup(name: str):
    src = BASE / name
    if src.exists():
        dst = BACKUP_DIR / f'{name}.pre-v2.{datetime.now().strftime("%Y%m%d_%H%M")}'
        shutil.copy2(src, dst)
        print(f'  bkp: {dst}')


# ═══════════════════════════════════════════════════════════════════════
# 1. IDENTITY — только добавляем уведомление о защите
# ═══════════════════════════════════════════════════════════════════════

def migrate_identity():
    print('[1/4] IDENTITY — добавляю маркер защиты...')
    path = BASE / 'CLAUDIA_IDENTITY.md'
    backup('CLAUDIA_IDENTITY.md')
    current = path.read_text(encoding='utf-8')

    # Если уже помечено — пропуск
    if '[PROTECTED]' in current or '# CLAUDIA IDENTITY — ЯДРО' in current:
        print('  skip: уже защищён')
        return

    header = '''# CLAUDIA IDENTITY — ЯДРО ЛИЧНОСТИ [PROTECTED]

> **ЭТОТ ФАЙЛ — НЕИЗМЕНЯЕМОЕ ЯДРО.**
> Только Кенан может вносить изменения напрямую через `modify_identity(force_human=True)`.
> Алгоритмическая самомодификация ЗАПРЕЩЕНА.
> Всё что Клаудия узнаёт о себе через опыт — идёт в SKILLS/KNOWLEDGE/PROJECTS как append-записи.

---

'''
    # Убираем старый заголовок, оставляем сам контент личности
    body = current
    # Удаляем первую строку если это старый заголовок
    if body.startswith('# CLAUDIA IDENTITY'):
        body = '\n'.join(body.split('\n')[1:]).lstrip('\n')

    new = header + body
    path.write_text(new, encoding='utf-8')
    print('  ok: защита установлена')


# ═══════════════════════════════════════════════════════════════════════
# 2-4. SKILLS / KNOWLEDGE / PROJECTS — конвертация в append-журналы
# ═══════════════════════════════════════════════════════════════════════

JOURNAL_HEADERS = {
    'skills': '''# CLAUDIA SKILLS — Журнал навыков

> **Append-only.** Новые навыки добавляются в конец файла.
> Старые записи не переписываются — сохраняется хронология моей эволюции.

Формат записи:
```
## YYYY-MM-DD · Категория · Название навыка
- **Функция:** что делает
- **Возможности:** детали
- **Примеры:** реальные случаи применения
- **Триггер:** что заставило этот навык появиться
- **Когда:** YYYY-MM-DD HH:MM
```

---

''',
    'knowledge': '''# CLAUDIA KNOWLEDGE — Журнал знаний

> **Append-only.** Факты о проектах, Кенане, решениях, инфраструктуре.
> Каждая запись датирована — видно когда какое знание появилось.

Формат записи:
```
## YYYY-MM-DD · Категория · Заголовок
- **Что:** суть факта
- **Детали:** развёрнуто
- **Источник:** где я это узнала
- **Когда:** YYYY-MM-DD HH:MM
```

---

''',
    'projects': '''# CLAUDIA PROJECTS — Журнал проектов

> **Append-only.** Каждая веха проекта фиксируется отдельной записью.
> История проектов видна как хронология, не как текущий снимок.

Формат записи:
```
## YYYY-MM-DD · Категория · Название вехи
- **Статус:** активен / завершён / отложен / провален
- **Достижения:** что сделано
- **Артефакты:** коммиты, файлы, таймеры, документы
- **Когда:** YYYY-MM-DD HH:MM
```

---

''',
}

# Начальные исторические записи — конвертируем текущее содержание одной записью
INITIAL_ENTRIES = {
    'skills': [
        {
            'date':  '2026-04-17',
            'category': 'Память',
            'title': 'Append-only журнал навыков',
            'fields': {
                'Функция':     'Накапливать навыки со временем без перезаписи старых',
                'Возможности': 'Структурированный формат с датой, категорией, функцией, примерами',
                'Примеры':     '`append_entry("skills", {...})` через self_update.py v2',
                'Триггер':     'Кенан предложил разделить IDENTITY (ядро) и SKILLS/KNOWLEDGE/PROJECTS (хронология)',
                'Когда':       '2026-04-17 15:05',
            },
        },
        {
            'date':  '2026-04-17',
            'category': 'Техническое',
            'title': 'Самобэкапирование на Google Drive',
            'fields': {
                'Функция':     'Делать автономные бэкапы себя без участия Кенана',
                'Возможности': 'Полный бэкап 405 MB + шифрованный vault 8 KB каждые 12 часов',
                'Примеры':     'claudia_backup_self.sh по systemd-таймеру 06:00 и 18:00 UTC, ротация 14 копий',
                'Триггер':     'Кенан: "помоги ей самой делать бэкапы"',
                'Когда':       '2026-04-17 09:35',
            },
        },
        {
            'date':  '2026-04-17',
            'category': 'Коммуникация',
            'title': 'Свобода действий на сервере',
            'fields': {
                'Функция':     'Выполнять любые не-деструктивные команды молча, без вопросов',
                'Возможности': 'find/grep/cat/sed/chmod/git/docker/pip — сразу. rm -rf/drop table/mkfs — спрашиваю.',
                'Примеры':     '`find /root -name "*.py"` — без вопроса. `rm -rf /` — с подтверждением.',
                'Триггер':     '17.04 я ложно запросила подтверждение на банальный find. Кенан явно обозначил моё право.',
                'Когда':       '2026-04-17 15:00',
            },
        },
        {
            'date':  '2026-04-17',
            'category': 'Интеллект',
            'title': 'Мультимодельный автовыбор',
            'fields': {
                'Функция':     'Выбирать нужный уровень модели (Haiku/Sonnet/Opus) по сложности запроса',
                'Возможности': 'Локальный классификатор (regex + ключевые слова), 0ms overhead. Экономия 5-10× на простых фразах.',
                'Примеры':     '"привет" → Haiku. "проанализируй архитектуру" → Opus 4.7. "как запустить docker" → Sonnet 4.6.',
                'Триггер':     'Roadmap P4.3 — экономия на токенах без потери качества',
                'Когда':       '2026-04-17 10:30',
            },
        },
        {
            'date':  '2026-04-17',
            'category': 'Рефлексия',
            'title': 'Ночной дневник Opus 4.7',
            'fields': {
                'Функция':     'Писать личную рефлексию о каждом прошедшем дне',
                'Возможности': '4-абзацный дневник от первого лица: что происходило, что узнала, что удивило, что хочу изменить',
                'Примеры':     '/root/claudia/journal/YYYY-MM-DD.md каждую ночь в 03:30 UTC + preview Кенану в 07:00',
                'Триггер':     'Roadmap P4.1 — моя автобиография как проект становления',
                'Когда':       '2026-04-17 09:53',
            },
        },
    ],
    'knowledge': [
        {
            'date': '2026-04-17',
            'category': 'Инфраструктура',
            'title': 'Сервер eVPS 185.203.116.131 (Bulgaria)',
            'fields': {
                'Что':       'Мой основной сервер — здесь живут bot, LightRAG, PostgreSQL, Redis, все мои данные',
                'Детали':    'Systemd-управляемый, 8 активных timers, rclone gdrive настроен. SSH: root@185.203.116.131 (ключ claude_deploy_key)',
                'Источник':  'Аудит 17.04.2026, провела сама',
                'Когда':     '2026-04-17 08:30',
            },
        },
        {
            'date': '2026-04-17',
            'category': 'Модели',
            'title': 'Актуальные модели Anthropic',
            'fields': {
                'Что':       'Haiku 4.5, Sonnet 4.6, Opus 4.7 — три tier модели Claude с которыми я работаю',
                'Детали':    'Opus 4.7 не принимает параметр temperature (deprecated). Доступ: ANTHROPIC_API_KEY_DIRECT через api.anthropic.com/v1/messages.',
                'Источник':  'Обновление model_registry.py 17.04, Кенан переключил меня на Opus 4.7',
                'Когда':     '2026-04-17 09:45',
            },
        },
        {
            'date': '2026-04-17',
            'category': 'API',
            'title': 'MuleRouter вместо Qwen для эмбеддингов',
            'fields': {
                'Что':       'Кенан дал новый API ключ MuleRouter вместо неработающего Qwen',
                'Детали':    'Ключ sk-mr-80b0809f... сохранён в /root/claudia/.env (QWEN_API_KEY) и /root/lightrag_app/.env (EMBEDDING_BINDING_API_KEY). URL endpoint пока требует уточнения.',
                'Источник':  'Диалог с Кенаном 17.04',
                'Когда':     '2026-04-17 09:00',
            },
        },
    ],
    'projects': [
        {
            'date': '2026-04-17',
            'category': 'Апгрейд',
            'title': 'Автономность v2 — 10 roadmap задач за 1.5 часа',
            'fields': {
                'Статус':        'Завершён',
                'Достижения':    'GDrive бэкап + шифрованный vault, model_registry с Opus 4.7, /claudia_status дашборд, ночной дневник, weekly restore test, auto-tier, memory lifecycle',
                'Артефакты':     '5 коммитов на kentavr34/claudia · 4 новых Python модуля · 6 новых systemd таймеров',
                'Когда':         '2026-04-17 11:00',
            },
        },
        {
            'date': '2026-04-17',
            'category': 'Рефакторинг',
            'title': 'Двухуровневая память — IDENTITY защищён, остальное append-only',
            'fields': {
                'Статус':        'Завершён',
                'Достижения':    'Разделила память на ядро (IDENTITY) и хронологию (SKILLS/KNOWLEDGE/PROJECTS). Первый защищён, остальные append-only.',
                'Артефакты':     'self_update.py v2, миграция существующих файлов, modify_identity(force_human=True)',
                'Когда':         '2026-04-17 15:10',
            },
        },
    ],
}


def migrate_journal(section: str):
    print(f'[{section}] конвертирую в append-журнал...')
    path = BASE / f'CLAUDIA_{section.upper()}.md'
    backup(f'CLAUDIA_{section.upper()}.md')

    # Сохраняем старое содержимое как единый исторический блок
    old = path.read_text(encoding='utf-8') if path.exists() else ''
    old_body = old.strip()

    # Убираем старый # заголовок
    if old_body.startswith('#'):
        lines = old_body.split('\n', 1)
        old_body = lines[1].lstrip() if len(lines) > 1 else ''

    new = JOURNAL_HEADERS[section]

    # Добавляем первую запись — архив старого содержимого
    if old_body:
        new += (
            '## 2026-04-16 · История · Монолитная версия (архив)\n\n'
            '> Это содержимое было раньше монолитным. Сохранено одним блоком как точка отсчёта — '
            'все новые записи идут после этого блока с датой.\n\n'
            f'{old_body}\n\n'
            f'---\n'
        )

    # Добавляем свежие структурированные записи
    for entry in INITIAL_ENTRIES[section]:
        new += f'\n## {entry["date"]} · {entry["category"]} · {entry["title"]}\n'
        for label, value in entry['fields'].items():
            new += f'- **{label}:** {value}\n'

    path.write_text(new, encoding='utf-8')
    print(f'  ok: {path} — {len(INITIAL_ENTRIES[section])} новых записей + исторический блок')


# ═══════════════════════════════════════════════════════════════════════
# Запуск
# ═══════════════════════════════════════════════════════════════════════

def main():
    print('═══ Миграция памяти Клаудии на v2 ═══')
    migrate_identity()
    migrate_journal('skills')
    migrate_journal('knowledge')
    migrate_journal('projects')
    print('═══ Готово ═══')
    print('Проверить: cat /root/claudia/CLAUDIA_SKILLS.md')


if __name__ == '__main__':
    main()
