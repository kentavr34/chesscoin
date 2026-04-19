"""
embed_backfill.py — Разовое заполнение embedding-колонки для существующих сообщений.

Запускается один раз после миграции 001.
Использует DashScope text-embedding-v4 (1536 dim) с fallback на OpenAI.

Цена: ~$0.02 за всю базу 4705 сообщений (0.07$/M токенов).
Время: ~5-10 минут (батчи по 25, rate limit соблюдается).

Запуск:
    python3 embed_backfill.py         # нормальный режим (все без embedding)
    python3 embed_backfill.py --test  # только 50 первых (проверка)
    python3 embed_backfill.py --reindex  # перезалить ВСЕ (force)
"""
import sys
import time
import logging
from typing import List, Dict
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
import os

load_dotenv('/root/claudia/.env')
sys.path.insert(0, '/root/claudia')
from model_registry import embed

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/root/claudia/logs/embed_backfill.log'),
    ],
)
log = logging.getLogger('backfill')

BATCH_SIZE    = 10         # DashScope API лимит: не больше 10 в batch
MAX_TEXT_LEN  = 2000       # обрезаем слишком длинные для экономии токенов
SLEEP_BETWEEN = 0.3        # не молотим по API


def connect():
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        dbname=os.getenv('POSTGRES_DB', 'claudia'),
        user=os.getenv('POSTGRES_USER', 'claudia'),
        password=os.getenv('POSTGRES_PASSWORD', ''),
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def fetch_batch(cur, limit: int, reindex: bool = False) -> List[Dict]:
    where = '' if reindex else 'WHERE embedding IS NULL'
    cur.execute(f"""
        SELECT id, content
        FROM conversations
        {where}
        ORDER BY created_at ASC
        LIMIT {limit}
    """)
    return list(cur.fetchall())


def update_embeddings(cur, rows_with_vecs: List[tuple]):
    """rows_with_vecs = [(id_uuid, [floats]), ...]"""
    for row_id, vec in rows_with_vecs:
        cur.execute(
            'UPDATE conversations SET embedding = %s::vector WHERE id = %s',
            (vec, row_id),
        )


def main():
    test_mode    = '--test' in sys.argv
    reindex_mode = '--reindex' in sys.argv
    target_limit = 50 if test_mode else None

    conn = connect()
    cur  = conn.cursor()

    # Сколько работы
    cur.execute(
        'SELECT COUNT(*) AS n FROM conversations WHERE embedding IS NULL'
        if not reindex_mode
        else 'SELECT COUNT(*) AS n FROM conversations'
    )
    total_pending = cur.fetchone()['n']
    log.info(f'Всего к обработке: {total_pending}')
    if test_mode:
        log.info('TEST MODE: обработаю только первые 50')
        total_pending = min(50, total_pending)

    if total_pending == 0:
        log.info('Все сообщения уже имеют embedding — nothing to do')
        return

    done   = 0
    errors = 0
    t0     = time.time()

    while done < total_pending:
        batch_limit = min(BATCH_SIZE, total_pending - done)
        rows = fetch_batch(cur, batch_limit, reindex=reindex_mode)
        if not rows:
            break

        texts = [
            (r['content'][:MAX_TEXT_LEN] if len(r['content']) > MAX_TEXT_LEN else r['content']) or ' '
            for r in rows
        ]

        try:
            vecs = embed(texts)
            if not vecs or (isinstance(vecs, list) and len(vecs) != len(rows)):
                log.error(f'embed() вернул неверное количество: {len(vecs) if vecs else 0} vs {len(rows)}')
                errors += len(rows)
                break  # критическая ошибка — останавливаемся, не заполняем нулями

            # Защита: если все векторы нулевые — значит провайдеры упали
            first_vec = vecs[0] if vecs else []
            if not any(abs(x) > 1e-9 for x in first_vec[:10]):
                log.error('Получены нулевые векторы — провайдеры не сработали. Останавливаюсь.')
                errors += len(rows)
                break

            pairs = [(rows[i]['id'], vecs[i]) for i in range(len(rows))]
            update_embeddings(cur, pairs)
            conn.commit()

            done += len(rows)
            elapsed = time.time() - t0
            rate = done / elapsed if elapsed > 0 else 0
            eta  = (total_pending - done) / rate if rate > 0 else 0
            log.info(f'  {done}/{total_pending} ({done*100//total_pending}%) '
                     f'— {rate:.1f}/s, ETA {eta:.0f}s')

        except Exception as e:
            log.error(f'batch error: {e}')
            conn.rollback()
            errors += len(rows)
            done   += len(rows)  # skip to avoid infinite loop

        time.sleep(SLEEP_BETWEEN)

    # Итог
    cur.execute('SELECT COUNT(*) AS n FROM conversations WHERE embedding IS NOT NULL')
    filled = cur.fetchone()['n']
    log.info('═' * 60)
    log.info(f'Итог: обработано={done}, ошибок={errors}, с embedding={filled}')
    log.info(f'Время: {time.time() - t0:.1f}s')

    # Создаём HNSW индекс (если ещё нет)
    log.info('Создаю HNSW индекс (может занять минуту на 5k строк)...')
    try:
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_conv_embed_hnsw
            ON conversations
            USING hnsw (embedding vector_cosine_ops)
            WHERE embedding IS NOT NULL
        """)
        conn.commit()
        log.info('✓ HNSW индекс создан')
    except Exception as e:
        log.error(f'HNSW failed: {e} — fallback на IVFFlat')
        try:
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_conv_embed_ivf
                ON conversations
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100)
                WHERE embedding IS NOT NULL
            """)
            conn.commit()
            log.info('✓ IVFFlat индекс создан')
        except Exception as e2:
            log.error(f'IVFFlat также failed: {e2}')

    conn.close()


if __name__ == '__main__':
    main()
