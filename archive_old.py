"""
archive_old.py — холодный архив старых сообщений.

Логика:
1. Берём conversations где created_at < now() - cutoff_days (365 по умолчанию)
2. Группируем по YYYY-MM, пишем в /root/claudia/archive/YYYY-MM.jsonl.gz
   (append режим — если файл уже есть, добавляем новые строки и дедуплицируем по id)
3. После УСПЕШНОЙ записи DELETE из БД
4. Каждая строка JSONL — полный ряд: id, user_id, project, role, content,
   audio_url, created_at, tags, category, entities (без embedding — он большой
   и редко нужен для холодного доступа; при нужде можно пересчитать)

Запуск:
    python3 archive_old.py                 # 365 дней, live
    python3 archive_old.py --days 730      # 2 года
    python3 archive_old.py --dry-run       # только отчёт
    python3 archive_old.py --restore 2024-03  # вернуть месяц назад в БД

Cron: ежемесячно 1-го в 04:30 UTC (systemd timer claudia-archive.timer)
"""
import sys
import os
import json
import gzip
import logging
from datetime import datetime
from collections import defaultdict
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('/root/claudia/.env')

ARCHIVE_DIR = '/root/claudia/archive'
os.makedirs(ARCHIVE_DIR, exist_ok=True)
os.makedirs('/root/claudia/logs', exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/root/claudia/logs/archive.log'),
    ],
)
log = logging.getLogger('archive')


def connect():
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        dbname=os.getenv('POSTGRES_DB', 'claudia'),
        user=os.getenv('POSTGRES_USER', 'claudia'),
        password=os.getenv('POSTGRES_PASSWORD', ''),
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def serialize(row) -> str:
    """Ряд → JSON-строка (datetime → ISO, UUID → str)."""
    out = {}
    for k, v in row.items():
        if hasattr(v, 'isoformat'):
            out[k] = v.isoformat()
        elif hasattr(v, 'hex'):  # UUID
            out[k] = str(v)
        else:
            out[k] = v
    return json.dumps(out, ensure_ascii=False)


def load_existing_ids(path: str) -> set:
    """Читаем уже сохранённые id из gzip JSONL (для дедупа)."""
    if not os.path.exists(path):
        return set()
    ids = set()
    try:
        with gzip.open(path, 'rt', encoding='utf-8') as f:
            for line in f:
                try:
                    ids.add(json.loads(line)['id'])
                except Exception:
                    pass
    except Exception as e:
        log.warning(f'Не смог прочитать {path}: {e}')
    return ids


def archive(days: int, dry: bool) -> int:
    conn = connect()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, user_id, project, role, content, audio_url,
               created_at, tags, category, entities, tagged_at, archived
        FROM conversations
        WHERE created_at < now() - (%s || ' days')::interval
        ORDER BY created_at ASC
    """, (str(days),))
    rows = list(cur.fetchall())
    if not rows:
        log.info(f'Нет сообщений старше {days} дней')
        conn.close()
        return 0

    # Группируем по YYYY-MM
    by_month = defaultdict(list)
    for r in rows:
        key = r['created_at'].strftime('%Y-%m')
        by_month[key].append(r)

    total_written = 0
    archived_ids = []

    for month, items in sorted(by_month.items()):
        path = os.path.join(ARCHIVE_DIR, f'{month}.jsonl.gz')
        existing = load_existing_ids(path)
        new_items = [r for r in items if str(r['id']) not in existing]
        if not new_items:
            log.info(f'{month}: всё уже в архиве ({len(items)} строк)')
            archived_ids.extend(r['id'] for r in items)
            continue
        if dry:
            log.info(f'DRY {month}: записал бы {len(new_items)} новых строк в {path}')
            continue
        # append в gzip
        with gzip.open(path, 'at', encoding='utf-8') as f:
            for r in new_items:
                f.write(serialize(r) + '\n')
        total_written += len(new_items)
        archived_ids.extend(r['id'] for r in items)
        log.info(f'{month}: +{len(new_items)} → {path} '
                 f'(уже было {len(existing)}, всего {len(existing)+len(new_items)})')

    if dry:
        log.info(f'DRY: к архивированию {len(rows)} строк из {len(by_month)} месяцев')
        conn.close()
        return 0

    # DELETE только те, что гарантированно в файлах
    if archived_ids:
        cur.execute('DELETE FROM conversations WHERE id = ANY(%s)', (archived_ids,))
        conn.commit()
        log.info(f'✓ Удалено из БД: {cur.rowcount} строк')

    conn.close()
    log.info(f'Готово: записано {total_written}, освобождено {len(archived_ids)} строк')
    return total_written


def restore(month: str) -> int:
    """Вернуть месяц YYYY-MM из архива обратно в БД (без embedding)."""
    path = os.path.join(ARCHIVE_DIR, f'{month}.jsonl.gz')
    if not os.path.exists(path):
        log.error(f'Архив не найден: {path}')
        return 0
    conn = connect()
    cur = conn.cursor()
    n = 0
    with gzip.open(path, 'rt', encoding='utf-8') as f:
        for line in f:
            try:
                r = json.loads(line)
                cur.execute("""
                    INSERT INTO conversations
                        (id, user_id, project, role, content, audio_url,
                         created_at, tags, category, entities, tagged_at, archived)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s)
                    ON CONFLICT (id) DO NOTHING
                """, (
                    r['id'], r.get('user_id'), r.get('project'), r.get('role'),
                    r.get('content'), r.get('audio_url'), r['created_at'],
                    r.get('tags') or [], r.get('category'),
                    json.dumps(r.get('entities') or []),
                    r.get('tagged_at'), r.get('archived', False),
                ))
                n += cur.rowcount
            except Exception as e:
                log.warning(f'restore line failed: {e}')
    conn.commit()
    conn.close()
    log.info(f'✓ Восстановлено {n} строк из {path} (embedding надо пересчитать)')
    return n


def main():
    days = 365
    dry = '--dry-run' in sys.argv
    restore_month = None
    for i, a in enumerate(sys.argv):
        if a == '--days' and i + 1 < len(sys.argv):
            days = int(sys.argv[i + 1])
        if a == '--restore' and i + 1 < len(sys.argv):
            restore_month = sys.argv[i + 1]

    log.info('=' * 60)
    if restore_month:
        log.info(f'RESTORE {restore_month}')
        restore(restore_month)
    else:
        log.info(f'ARCHIVE старше {days} дней, dry={dry}')
        archive(days, dry)


if __name__ == '__main__':
    main()
