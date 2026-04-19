"""
tag_classifier.py — Ночная каталогизация сообщений Клаудии.

Идея: берёт все conversations с tagged_at IS NULL (или старше N дней),
через qwen-flash получает JSON с тегами/категорией/сущностями,
записывает в колонки tags/category/entities, ставит tagged_at=now().

Запуск:
    python3 tag_classifier.py           # все неразмеченные
    python3 tag_classifier.py --limit 100
    python3 tag_classifier.py --retag 30  # переразметить старше 30 дней

Стоимость: ~$0.05-0.10 за 4705 сообщений (qwen-flash, $0.05/M input).
Cron: ежедневно 03:30 UTC через systemd timer.
"""
import sys
import os
import json
import time
import logging
from typing import List, Dict, Optional
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('/root/claudia/.env')
sys.path.insert(0, '/root/claudia')
from model_registry import call_llm

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/root/claudia/logs/tag_classifier.log'),
    ],
)
log = logging.getLogger('tagger')

BATCH_SIZE = 20
MAX_TEXT = 1500
SLEEP = 0.2

CATEGORIES = [
    'deploy', 'code', 'design', 'debug', 'memory', 'planning',
    'qa', 'decision', 'bookmark', 'chitchat', 'error', 'research',
    'infra', 'backup', 'auth', 'llm_routing', 'ui_ux', 'other',
]

PROMPT = """Ты — классификатор сообщений. Определи:
1. category — одна из: {cats}
2. tags — 2-5 коротких тегов (lowercase, ru/en, без пробелов, через _)
3. entities — список упомянутых сущностей (файлы, люди, сервисы, API)

Отвечай СТРОГО в JSON, без markdown:
{{"category": "code", "tags": ["pgvector","migration"], "entities": ["postgres","claudia"]}}

Сообщение:
\"\"\"{text}\"\"\"
"""


def connect():
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        dbname=os.getenv('POSTGRES_DB', 'claudia'),
        user=os.getenv('POSTGRES_USER', 'claudia'),
        password=os.getenv('POSTGRES_PASSWORD', ''),
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def classify_one(text: str) -> Optional[Dict]:
    """Вернёт dict с ключами category/tags/entities или None при ошибке."""
    prompt = PROMPT.format(cats=', '.join(CATEGORIES), text=text[:MAX_TEXT])
    try:
        raw = call_llm(prompt, tier='fast', max_tokens=200)
        if not raw:
            return None
        raw = raw.strip()
        # снять возможные ``` обёртки
        if raw.startswith('```'):
            raw = raw.strip('`').lstrip('json').strip()
        data = json.loads(raw)
        # нормализация
        cat = str(data.get('category', 'other')).lower().strip()
        if cat not in CATEGORIES:
            cat = 'other'
        tags = [str(t).lower().strip() for t in data.get('tags', [])][:5]
        ents = data.get('entities', [])
        if not isinstance(ents, list):
            ents = []
        return {'category': cat, 'tags': tags, 'entities': ents}
    except Exception as e:
        log.warning(f'classify failed: {e} / raw={raw[:100] if raw else None}')
        return None


def main():
    limit = None
    retag_days = None

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == '--limit' and i + 1 < len(args):
            limit = int(args[i + 1])
            i += 2
        elif args[i] == '--retag' and i + 1 < len(args):
            retag_days = int(args[i + 1])
            i += 2
        else:
            i += 1

    conn = connect()
    cur = conn.cursor()

    if retag_days is not None:
        where = f"WHERE tagged_at IS NULL OR tagged_at < NOW() - INTERVAL '{retag_days} days'"
    else:
        where = 'WHERE tagged_at IS NULL'

    cur.execute(f'SELECT COUNT(*) AS n FROM conversations {where}')
    total = cur.fetchone()['n']
    log.info(f'К классификации: {total}')
    if limit:
        total = min(limit, total)
    if total == 0:
        log.info('Всё уже размечено')
        return

    done = 0
    errors = 0
    t0 = time.time()

    while done < total:
        batch_n = min(BATCH_SIZE, total - done)
        cur.execute(f"""
            SELECT id, content FROM conversations
            {where}
            ORDER BY created_at DESC
            LIMIT {batch_n}
        """)
        rows = list(cur.fetchall())
        if not rows:
            break

        for row in rows:
            result = classify_one(row['content'] or ' ')
            if result is None:
                errors += 1
                # всё равно ставим tagged_at=now() чтобы не зацикливаться
                cur.execute(
                    "UPDATE conversations SET tagged_at=NOW(), category='other' WHERE id=%s",
                    (row['id'],),
                )
            else:
                cur.execute(
                    """UPDATE conversations
                       SET tags = %s, category = %s, entities = %s::jsonb, tagged_at = NOW()
                       WHERE id = %s""",
                    (result['tags'], result['category'],
                     json.dumps(result['entities'], ensure_ascii=False), row['id']),
                )
            done += 1

        conn.commit()
        elapsed = time.time() - t0
        rate = done / elapsed if elapsed > 0 else 0
        eta = (total - done) / rate if rate > 0 else 0
        log.info(f'  {done}/{total} ({done*100//total}%) — {rate:.1f}/s, ETA {eta:.0f}s, ошибок {errors}')
        time.sleep(SLEEP)

    log.info(f'Готово: обработано={done}, ошибок={errors}, время={time.time()-t0:.1f}s')
    conn.close()


if __name__ == '__main__':
    main()
