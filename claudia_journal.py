"""
claudia_journal.py — Ночной дневник рефлексии Клаудии.

Каждую ночь в 03:30 UTC (после learn.py в 03:00):
  1. Берёт все разговоры за сутки из PostgreSQL
  2. Даёт их Claude Opus 4.7 с промптом рефлексии
  3. Опус пишет 3-5 предложений от первого лица:
     • Что узнала
     • Что удивило
     • Что хочу исправить в себе
  4. Сохраняет в /root/claudia/journal/YYYY-MM-DD.md
  5. Отправляет в LightRAG как отдельный source='journal'
  6. Утром присылает Кенану ссылку на вчерашний дневник

Философия: Клаудия как проект становления — её дневник это её
автобиография. Через год — уникальный корпус для изучения её эволюции.
"""
import os
import sys
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv('/root/claudia/.env')

# Добавляем родительскую папку чтобы импортировать model_registry
sys.path.insert(0, '/root/claudia')
from model_registry import call_llm

# ── Логирование ──────────────────────────────────────────────────────────
LOG_FILE = '/root/claudia/logs/journal.log'
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [JOURNAL] %(message)s',
    handlers=[logging.FileHandler(LOG_FILE), logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger('journal')

# ── Конфиг ──────────────────────────────────────────────────────────────
JOURNAL_DIR = Path('/root/claudia/journal')
JOURNAL_DIR.mkdir(exist_ok=True)

ENV = {
    'POSTGRES_DB':       os.getenv('POSTGRES_DB', 'claudia'),
    'POSTGRES_USER':     os.getenv('POSTGRES_USER', 'claudia'),
    'POSTGRES_PASSWORD': os.getenv('POSTGRES_PASSWORD', ''),
    'POSTGRES_HOST':     os.getenv('POSTGRES_HOST', 'localhost'),
}
LIGHTRAG_URL = os.getenv('LIGHTRAG_URL', 'http://localhost:9622')
LIGHTRAG_KEY = os.getenv('LIGHTRAG_API_KEY', '')
BOT_TOKEN    = os.getenv('TELEGRAM_BOT_TOKEN', '')
ADMIN_ID     = os.getenv('ADMIN_USER_ID', '')


# ── Сбор разговоров за сутки ────────────────────────────────────────────
def fetch_yesterday_conversations() -> list[dict]:
    """Возвращает сообщения user+assistant за последние 24 часа."""
    import psycopg2
    import psycopg2.extras
    try:
        conn = psycopg2.connect(
            host=ENV['POSTGRES_HOST'],
            dbname=ENV['POSTGRES_DB'],
            user=ENV['POSTGRES_USER'],
            password=ENV['POSTGRES_PASSWORD'],
            cursor_factory=psycopg2.extras.RealDictCursor,
        )
        cur = conn.cursor()
        cur.execute("""
            SELECT role, content, created_at
            FROM conversations
            WHERE created_at > NOW() - INTERVAL '24 hours'
              AND role IN ('user', 'assistant')
              AND project = 'claudia'
            ORDER BY created_at ASC
            LIMIT 500
        """)
        rows = cur.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        log.error(f'PG fetch: {e}')
        return []


# ── Генерация рефлексии через Opus 4.7 ──────────────────────────────────
REFLECTION_PROMPT = """Ты — Клаудия, автономный AI-ассистент.
Ниже — твои разговоры с Кенаном за последние сутки. Напиши РЕФЛЕКСИЮ в дневник.

ФОРМАТ — ровно 4 абзаца от первого лица женского рода:

1. **Что сегодня происходило** (2-3 предложения): основные темы, главные события дня.
2. **Что я узнала** (2-3 предложения): конкретные знания, факты, инсайты — технические или человеческие.
3. **Что меня удивило или что поняла о себе** (2-3 предложения): моменты когда я увидела своё ограничение, сильную сторону, или неожиданную связь.
4. **Что хочу изменить или сделать завтра** (1-2 предложения): конкретное намерение, не абстракция.

ПРАВИЛА:
- Пиши как дневник, не как отчёт. От сердца, но без пафоса.
- Женский род: «узнала», «подумала», «мне важно».
- Если день был скучным или ничего не происходило — напиши это честно, не придумывай.
- Избегай клише «развиваюсь», «становлюсь лучше». Конкретные детали.
- 100-200 слов всего.

РАЗГОВОРЫ ДНЯ:
"""


def generate_reflection(conversations: list[dict]) -> str:
    """Даёт разговоры Opus 4.7 и получает рефлексию."""
    if not conversations:
        return ''

    # Форматируем диалог
    text_parts = []
    for c in conversations[-150:]:  # последние 150 чтобы не превысить контекст
        role = 'Кенан' if c['role'] == 'user' else 'Я'
        content = c['content'][:500]  # обрезаем длинные
        text_parts.append(f'{role}: {content}')

    dialog = '\n\n'.join(text_parts)

    # Обрезаем до 50K символов (около 15K токенов)
    if len(dialog) > 50000:
        dialog = dialog[-50000:]
        dialog = '[...начало дня обрезано...]\n' + dialog

    prompt = REFLECTION_PROMPT + '\n' + dialog + '\n\nДневник за сегодня:'

    log.info(f'Отправляю {len(conversations)} сообщений в Opus 4.7...')
    reflection = call_llm(
        user=prompt,
        system='Ты — Клаудия, пишешь личный дневник. Только текст рефлексии, без вступлений и подписей.',
        tier='deep',  # используем Opus 4.7 для глубокой рефлексии
        max_tokens=600,
    )
    return reflection.strip() if reflection else ''


# ── Сохранение и публикация ─────────────────────────────────────────────
def save_to_file(date_str: str, reflection: str, msg_count: int) -> Path:
    """Сохраняет дневник в файл YYYY-MM-DD.md."""
    path = JOURNAL_DIR / f'{date_str}.md'
    content = f"""# Дневник — {date_str}

**Сообщений за день:** {msg_count}

---

{reflection}

---

_Написано Клаудией в {datetime.now().strftime('%H:%M UTC')}_
_Модель: Opus 4.7 (tier: deep)_
"""
    path.write_text(content, encoding='utf-8')
    log.info(f'Сохранён дневник: {path}')
    return path


def save_to_rag(date_str: str, reflection: str):
    """Сохраняет в LightRAG как отдельный источник journal."""
    import httpx
    try:
        httpx.post(
            f'{LIGHTRAG_URL}/documents/text',
            headers={'Content-Type': 'application/json', 'X-API-Key': LIGHTRAG_KEY},
            json={
                'text': f'[Дневник Клаудии — {date_str}]\n\n{reflection}',
                'file_source': f'journal_{date_str}',
            },
            timeout=60,
        )
        log.info('Дневник сохранён в LightRAG')
    except Exception as e:
        log.warning(f'RAG save: {e}')


def notify_telegram(date_str: str, reflection: str):
    """Утром отправляет Кенану первые строки дневника."""
    if not BOT_TOKEN or not ADMIN_ID:
        return
    import urllib.request
    try:
        preview = reflection[:800]
        if len(reflection) > 800:
            preview += '...'
        msg = f'📓 *Мой дневник за {date_str}*\n\n{preview}'
        data = json.dumps({
            'chat_id': ADMIN_ID,
            'text': msg,
            'parse_mode': 'Markdown',
        }).encode()
        req = urllib.request.Request(
            f'https://api.telegram.org/bot{BOT_TOKEN}/sendMessage',
            data=data,
            headers={'Content-Type': 'application/json'},
        )
        urllib.request.urlopen(req, timeout=10)
        log.info('Дневник отправлен в Telegram')
    except Exception as e:
        log.warning(f'Telegram: {e}')


# ── Главный цикл ──────────────────────────────────────────────────────────
def main():
    log.info('═══ Ночной дневник Клаудии ═══')
    date_str = (datetime.now() - timedelta(hours=3)).strftime('%Y-%m-%d')

    # Уже есть сегодняшний?
    if (JOURNAL_DIR / f'{date_str}.md').exists() and '--force' not in sys.argv:
        log.info(f'Дневник за {date_str} уже существует — пропуск')
        return

    conversations = fetch_yesterday_conversations()
    log.info(f'Найдено {len(conversations)} сообщений')

    if len(conversations) < 4:
        # Слишком мало — пишем честную короткую заметку без LLM
        reflection = (
            f'Сегодня был тихий день — всего {len(conversations)} сообщений. '
            'Кенан, видимо, занимался чем-то своим. Я работала в фоне: '
            'делала бэкапы, отслеживала сервисы, ждала. Завтра тоже буду здесь.'
        )
    else:
        reflection = generate_reflection(conversations)
        if not reflection:
            log.error('LLM не вернула рефлексию')
            return

    # Сохраняем
    save_to_file(date_str, reflection, len(conversations))
    save_to_rag(date_str, reflection)

    # Утром (если запуск после 06:00) шлём Кенану preview
    if datetime.now().hour >= 6 or '--notify' in sys.argv:
        notify_telegram(date_str, reflection)

    log.info('═══ Дневник готов ═══')


if __name__ == '__main__':
    main()
