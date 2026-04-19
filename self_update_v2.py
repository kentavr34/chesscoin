"""
self_update.py v2 — Двухуровневая самомодификация Клаудии.

АРХИТЕКТУРА ПАМЯТИ:

┌─────────────────────────────────────────────────────────────────┐
│ УРОВЕНЬ 1 — ЯДРО (неизменяемое)                                 │
│                                                                 │
│ CLAUDIA_IDENTITY.md   ← ТОЛЬКО Кенан меняет вручную             │
│   • Кто я (имя, роль, пол)                                      │
│   • Базовые ценности                                            │
│   • Миссия                                                      │
│                                                                 │
│ self_modify('identity', ...) → ОТКАЗ без force_human=True       │
├─────────────────────────────────────────────────────────────────┤
│ УРОВЕНЬ 2 — ХРОНОЛОГИЯ (append-only)                            │
│                                                                 │
│ CLAUDIA_SKILLS.md     ← Клаудия ДОПОЛНЯЕТ, не переписывает       │
│ CLAUDIA_KNOWLEDGE.md  ← То же самое                              │
│ CLAUDIA_PROJECTS.md   ← То же самое                              │
│                                                                 │
│ Формат новой записи:                                            │
│   ## YYYY-MM-DD · Категория · Название                          │
│   - **Функция:** что делает                                     │
│   - **Возможности:** детали                                     │
│   - **Примеры:** реальные случаи                                │
│   - **Триггер:** откуда взялось                                 │
│                                                                 │
│ self_modify('skills', ...) → APPEND новой записи в конец        │
└─────────────────────────────────────────────────────────────────┘

Использование:

    from self_update import append_entry, modify_identity

    # Добавить навык (не перезаписывает старые)
    append_entry('skills', {
        'category': 'Техническое',
        'title':    'Самобэкапирование',
        'function': 'Делать автономные бэкапы в Google Drive',
        'capabilities': 'Полный бэкап 405 MB + шифрованный vault каждые 12ч',
        'examples': 'claudia_backup_self.sh по таймеру 06:00/18:00 UTC',
        'trigger':  'Задача Кенана "помоги ей самой делать бэкапы"',
    })

    # Изменить identity — требует явного флага
    modify_identity(new_content='...', force_human=True)  # OK
    modify_identity(new_content='...')                    # ERROR
"""
import os
import re
import subprocess
import logging
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv('/root/claudia/.env')
log = logging.getLogger('self_update')

BASE = '/root/claudia'

# ═══════════════════════════════════════════════════════════════════════
# Конфигурация разделов
# ═══════════════════════════════════════════════════════════════════════

# УРОВЕНЬ 1 — неизменяемое ядро
CORE_SECTIONS = {
    'identity': {
        'file':  f'{BASE}/CLAUDIA_IDENTITY.md',
        'redis': 'claudia:identity',
        'desc':  'Ядро личности: кто я, ценности, миссия. Меняет только Кенан.',
    },
}

# УРОВЕНЬ 2 — append-only журналы
APPEND_SECTIONS = {
    'skills': {
        'file':  f'{BASE}/CLAUDIA_SKILLS.md',
        'redis': 'claudia:skills',
        'desc':  'Журнал навыков — какие умения я приобретаю со временем',
        'fields': ['function', 'capabilities', 'examples', 'trigger'],
    },
    'knowledge': {
        'file':  f'{BASE}/CLAUDIA_KNOWLEDGE.md',
        'redis': 'claudia:knowledge',
        'desc':  'Журнал знаний — факты о проектах, Кенане, решениях',
        'fields': ['what', 'details', 'source'],
    },
    'projects': {
        'file':  f'{BASE}/CLAUDIA_PROJECTS.md',
        'redis': 'claudia:projects',
        'desc':  'Журнал проектов — статусы, вехи, завершения',
        'fields': ['status', 'achievements', 'artifacts'],
    },
}

# Обратная совместимость: SECTIONS = CORE + APPEND
SECTIONS = {**CORE_SECTIONS, **APPEND_SECTIONS}

LIGHTRAG = os.getenv('LIGHTRAG_URL', 'http://localhost:9622')
RAG_KEY  = os.getenv('LIGHTRAG_API_KEY', 'chesscoin_rag_secret_2026')
DS_KEY   = os.getenv('DEEPSEEK_API_KEY', '')


# ═══════════════════════════════════════════════════════════════════════
# Базовые операции
# ═══════════════════════════════════════════════════════════════════════

def read_section(section: str) -> str:
    path = SECTIONS[section]['file']
    try:
        return Path(path).read_text(encoding='utf-8')
    except FileNotFoundError:
        return ''


def write_section(section: str, content: str):
    """
    Низкоуровневая запись. Для append-секций — добавляет в конец (не переписывает),
    для core — НЕ ДОПУСКАЕТСЯ без force.
    """
    if section in CORE_SECTIONS:
        raise PermissionError(
            f'Раздел {section} — ЯДРО личности. '
            f'Используй modify_identity(force_human=True) для изменения.'
        )
    path = SECTIONS[section]['file']
    Path(path).write_text(content, encoding='utf-8')
    _git_autocommit(section, path)
    _update_redis_sync(section, content)


def _git_autocommit(section: str, path: str):
    """Коммитит в git с человекочитаемым message."""
    try:
        diff = subprocess.run(
            ['git', '-C', BASE, 'diff', '--quiet', path],
            capture_output=True, timeout=5,
        )
        if diff.returncode == 0:
            return
        subprocess.run(['git', '-C', BASE, 'add', path],
                       check=False, capture_output=True, timeout=5)
        msg = f'auto: self-modified {section} at {datetime.now().strftime("%Y-%m-%d %H:%M")}'
        subprocess.run(
            ['git', '-C', BASE, '-c', 'user.name=Claudia',
             '-c', 'user.email=claudia@localhost', 'commit', '-m', msg],
            check=False, capture_output=True, timeout=10,
        )
        log.info(f'git autocommit: {section}')
    except Exception as e:
        log.warning(f'git autocommit failed: {e}')


def _update_redis_sync(section: str, content: str):
    """Обновляет Redis синхронно."""
    try:
        import redis
        r = redis.Redis(host='localhost', port=6379, db=1, decode_responses=True)
        r.set(SECTIONS[section]['redis'], content)
    except Exception as e:
        log.warning(f'Redis update: {e}')


def rag_save_sync(text: str, source: str):
    import httpx
    try:
        httpx.post(
            f'{LIGHTRAG}/documents/text',
            headers={'Content-Type': 'application/json', 'X-API-Key': RAG_KEY},
            json={'text': text, 'file_source': source},
            timeout=30,
        )
    except Exception as e:
        log.warning(f'RAG save: {e}')


def deepseek_sync(prompt: str, max_tokens: int = 600) -> str:
    import httpx
    try:
        r = httpx.post(
            'https://api.deepseek.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {DS_KEY}'},
            json={
                'model': 'deepseek-chat',
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': max_tokens,
                'temperature': 0.3,
            },
            timeout=30,
        )
        if r.status_code == 200:
            return r.json()['choices'][0]['message']['content'].strip()
    except Exception as e:
        log.warning(f'DeepSeek: {e}')
    return ''


# ═══════════════════════════════════════════════════════════════════════
# УРОВЕНЬ 1 — IDENTITY (защита)
# ═══════════════════════════════════════════════════════════════════════

def modify_identity(new_content: str, reason: str, force_human: bool = False) -> dict:
    """
    Изменяет CLAUDIA_IDENTITY.md.

    ТРЕБУЕТ force_human=True (только Кенан может менять ядро личности).
    """
    if not force_human:
        log.warning(f'modify_identity запрещён без force_human=True (причина: {reason[:80]})')
        return {
            'ok': False,
            'error': 'IDENTITY — неизменяемое ядро. Требуется force_human=True (явное действие Кенана).',
        }

    path = CORE_SECTIONS['identity']['file']
    old = read_section('identity')
    ts = datetime.now().strftime('%Y-%m-%d %H:%M')

    # Сохраняем старую версию в RAG и git
    rag_save_sync(
        f'[{ts}] IDENTITY изменена Кенаном\n'
        f'Причина: {reason}\n\n'
        f'Предыдущая версия:\n{old}',
        source='history_identity',
    )

    Path(path).write_text(new_content, encoding='utf-8')
    _update_redis_sync('identity', new_content)
    # git commit с особым message — помечаем как human-triggered
    try:
        subprocess.run(['git', '-C', BASE, 'add', path],
                       check=False, capture_output=True, timeout=5)
        msg = f'identity: ручная правка Кенаном — {reason[:60]}'
        subprocess.run(
            ['git', '-C', BASE, '-c', 'user.name=Kenan',
             '-c', 'user.email=kenan@localhost', 'commit', '-m', msg],
            check=False, capture_output=True, timeout=10,
        )
    except Exception:
        pass

    log.info(f'IDENTITY изменена (force_human). Причина: {reason[:80]}')
    return {'ok': True, 'old': old, 'new': new_content}


# ═══════════════════════════════════════════════════════════════════════
# УРОВЕНЬ 2 — APPEND новой записи в журнал
# ═══════════════════════════════════════════════════════════════════════

def append_entry(section: str, entry: dict) -> dict:
    """
    Добавляет новую запись в журнал (skills/knowledge/projects).

    Аргументы entry:
      'category': 'Техническое' | 'Коммуникация' | 'Память' | ...
      'title':    Короткое название (3-6 слов)
      ... + fields согласно секции

    Для skills:   function, capabilities, examples, trigger
    Для knowledge: what, details, source
    Для projects:  status, achievements, artifacts
    """
    if section not in APPEND_SECTIONS:
        return {'ok': False, 'error': f'Секция {section} не поддерживает append'}

    if section in CORE_SECTIONS:
        return {'ok': False, 'error': 'CORE секции только через modify_identity()'}

    cfg = APPEND_SECTIONS[section]
    if not entry.get('title'):
        return {'ok': False, 'error': 'title обязателен'}

    ts_date = datetime.now().strftime('%Y-%m-%d')
    ts_full = datetime.now().strftime('%Y-%m-%d %H:%M')
    category = entry.get('category', 'Общее')
    title = entry['title']

    # Формируем markdown-блок записи
    block = f'\n## {ts_date} · {category} · {title}\n'
    for field in cfg['fields']:
        value = entry.get(field, '').strip()
        if value:
            label = _field_label(field)
            block += f'- **{label}:** {value}\n'

    # Добавляем мета-поля если они есть
    if entry.get('links'):
        block += f'- **Ссылки:** {entry["links"]}\n'
    if entry.get('notes'):
        block += f'- **Заметки:** {entry["notes"]}\n'

    block += f'- **Когда:** {ts_full}\n'

    # Читаем файл, добавляем в конец
    current = read_section(section)

    # Если файл пуст или не имеет заголовка — создаём
    if not current.strip():
        current = (
            f'# CLAUDIA {section.upper()} — Журнал {cfg["desc"]}\n\n'
            f'> Append-only. Новые записи добавляются в конец. '
            f'Старые не переписываются — сохраняется хронология эволюции.\n'
        )

    # Проверка на дубликат (один title за один день)
    dup_pattern = re.compile(rf'## {ts_date} .* · {re.escape(title)}\b', re.MULTILINE)
    if dup_pattern.search(current):
        return {'ok': False, 'error': f'Запись "{title}" уже есть за {ts_date}'}

    new_content = current + block
    path = cfg['file']
    Path(path).write_text(new_content, encoding='utf-8')

    # Обновляем Redis
    _update_redis_sync(section, new_content)

    # Сохраняем в RAG как отдельный document
    rag_save_sync(
        f'[Журнал {section} — {ts_full}]\n{block.strip()}',
        source=f'journal_{section}_{ts_date}',
    )

    # Git autocommit с осмысленным message
    try:
        subprocess.run(['git', '-C', BASE, 'add', path],
                       check=False, capture_output=True, timeout=5)
        msg = f'append({section}): {title} [{category}]'
        subprocess.run(
            ['git', '-C', BASE, '-c', 'user.name=Claudia',
             '-c', 'user.email=claudia@localhost', 'commit', '-m', msg],
            check=False, capture_output=True, timeout=10,
        )
    except Exception as e:
        log.warning(f'git commit failed: {e}')

    log.info(f'append({section}): {title} [{category}]')
    return {'ok': True, 'section': section, 'title': title, 'category': category}


def _field_label(field: str) -> str:
    """Человекочитаемая метка поля."""
    return {
        'function':      'Функция',
        'capabilities':  'Возможности',
        'examples':      'Примеры',
        'trigger':       'Триггер',
        'what':          'Что',
        'details':       'Детали',
        'source':        'Источник',
        'status':        'Статус',
        'achievements':  'Достижения',
        'artifacts':     'Артефакты',
    }.get(field, field.capitalize())


# ═══════════════════════════════════════════════════════════════════════
# Обратная совместимость со старым self_modify
# ═══════════════════════════════════════════════════════════════════════

def self_modify(section: str, change_description: str, new_content: str = None) -> dict:
    """
    LEGACY — остаётся для совместимости с существующим кодом.

    Новое поведение:
      • identity → ОТКАЗ (используй modify_identity)
      • skills/knowledge/projects → просим LLM сгенерировать append_entry и вызываем её
    """
    if section in CORE_SECTIONS:
        return {
            'ok': False,
            'error': f'{section} — ядро личности, меняется только через modify_identity(force_human=True)',
        }

    # Для append-секций просим LLM разобрать change_description в структуру
    prompt = (
        f'Разбери изменение в структурированный JSON для добавления в журнал Клаудии.\n\n'
        f'Секция: {section} ({APPEND_SECTIONS[section]["desc"]})\n'
        f'Изменение: {change_description}\n\n'
        f'Верни ТОЛЬКО JSON без пояснений, со следующими полями:\n'
        f'  category: категория (1-2 слова на русском)\n'
        f'  title: короткое название (3-6 слов)\n'
    )
    for field in APPEND_SECTIONS[section]['fields']:
        prompt += f'  {field}: {_field_label(field)}\n'

    prompt += '\nJSON:'

    response = deepseek_sync(prompt, max_tokens=400)
    if not response:
        return {'ok': False, 'error': 'LLM не ответила'}

    # Парсим JSON из ответа
    import json
    try:
        # Ищем JSON в ответе
        match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response, re.DOTALL)
        if not match:
            return {'ok': False, 'error': f'Нет JSON в ответе: {response[:200]}'}
        entry = json.loads(match.group(0))
    except json.JSONDecodeError as e:
        return {'ok': False, 'error': f'JSON parse: {e}'}

    return append_entry(section, entry)


def detect_and_apply(user_msg: str, bot_reply: str) -> list[dict]:
    """
    LEGACY — остаётся для совместимости.

    Анализирует обмен — если есть чему учиться, добавляет append_entry.
    IDENTITY не трогается.
    """
    prompt = (
        'Проанализируй обмен Кенана и Клаудии.\n'
        'Если здесь есть:\n'
        '  • новый навык для Клаудии → секция skills\n'
        '  • новое знание/факт → секция knowledge\n'
        '  • обновление проекта → секция projects\n'
        '\n'
        'Если ничего — ответь NONE.\n'
        'Если есть — верни:\n'
        '  SECTION: <skills|knowledge|projects>\n'
        '  CATEGORY: <категория>\n'
        '  TITLE: <название 3-6 слов>\n'
        '  DETAIL: <1-2 предложения описание>\n'
        '\n'
        f'Кенан: {user_msg[:400]}\n'
        f'Клаудия: {bot_reply[:400]}\n'
        '\n'
        'Ответ:'
    )

    result = deepseek_sync(prompt, max_tokens=200)
    if not result or 'NONE' in result:
        return []

    changes = []
    m = re.search(
        r'SECTION:\s*(\w+).*?CATEGORY:\s*([^\n]+).*?TITLE:\s*([^\n]+).*?DETAIL:\s*(.+?)(?:$)',
        result, re.DOTALL | re.IGNORECASE,
    )
    if m:
        section = m.group(1).strip().lower()
        category = m.group(2).strip()
        title = m.group(3).strip()
        detail = m.group(4).strip()

        if section in APPEND_SECTIONS:
            # Главное поле зависит от секции
            main_field = APPEND_SECTIONS[section]['fields'][0]
            entry = {
                'category': category,
                'title':    title,
                main_field: detail,
                'trigger' if section == 'skills' else 'source': 'Автоматически из диалога',
            }
            res = append_entry(section, entry)
            if res.get('ok'):
                changes.append({'section': section, 'title': title})

    return changes


# ═══════════════════════════════════════════════════════════════════════
# CLI для тестирования / миграции
# ═══════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    import sys
    import json

    logging.basicConfig(level=logging.INFO)

    if len(sys.argv) < 2:
        print('Использование:')
        print('  python3 self_update.py append <section> <json-entry>')
        print('  python3 self_update.py detect "<user_msg>" "<bot_reply>"')
        print('  python3 self_update.py test')
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == 'append':
        section = sys.argv[2]
        entry = json.loads(sys.argv[3])
        r = append_entry(section, entry)
        print(json.dumps(r, ensure_ascii=False, indent=2))

    elif cmd == 'detect':
        r = detect_and_apply(sys.argv[2], sys.argv[3])
        print(json.dumps(r, ensure_ascii=False, indent=2))

    elif cmd == 'test':
        # Тест — добавляем запись в skills
        r = append_entry('skills', {
            'category':     'Память',
            'title':        'Append-only журнал навыков',
            'function':     'Накапливать навыки со временем, не переписывая старые',
            'capabilities': 'Структурированный формат с датой, категорией, функцией',
            'examples':     'append_entry("skills", {...}) через self_update.py',
            'trigger':      'Кенан предложил разделить ядро и хронологию',
        })
        print(json.dumps(r, ensure_ascii=False, indent=2))
