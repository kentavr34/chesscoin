"""
claudia_memory.py — Унифицированный слой памяти Клаудии.

Три функции:
  1. search(query, **opts)  — параллельный поиск PG (FTS+vector+trigram) + LightRAG
  2. archive_old(days=365)  — архивирует старые сообщения в файл + LightRAG summary
  3. remember(text, tags)   — принудительная запись "закладки" в RAG

Использование из бота:
    from claudia_memory import search, remember

    result = search('что мы делали с бэкапом')
    # → {'pg_fts': [...], 'pg_semantic': [...], 'rag': '...', 'merged': [...]}

    remember('Важное решение: x=y', tags=['architecture', 'decision'])
"""
import os
import sys
import json
import gzip
import logging
import asyncio
import concurrent.futures
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional

import httpx
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('/root/claudia/.env')
sys.path.insert(0, '/root/claudia')
from model_registry import embed, call_llm

log = logging.getLogger('memory')


# ═══════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════

DB_CONFIG = dict(
    host=os.getenv('POSTGRES_HOST', 'localhost'),
    dbname=os.getenv('POSTGRES_DB', 'claudia'),
    user=os.getenv('POSTGRES_USER', 'claudia'),
    password=os.getenv('POSTGRES_PASSWORD', ''),
)
LIGHTRAG_URL = os.getenv('LIGHTRAG_URL', 'http://localhost:9622')
LIGHTRAG_KEY = os.getenv('LIGHTRAG_API_KEY', '')

ARCHIVE_DIR = Path('/root/claudia/archive')
ARCHIVE_DIR.mkdir(exist_ok=True)

COLD_DAYS   = 365    # старше — в архив
SEARCH_LIMIT = 10    # сколько результатов на каждый метод поиска


# ═══════════════════════════════════════════════════════════════════════
# Internal helpers
# ═══════════════════════════════════════════════════════════════════════

def _connect():
    return psycopg2.connect(cursor_factory=psycopg2.extras.RealDictCursor, **DB_CONFIG)


def _excerpt(text: str, n: int = 200) -> str:
    text = (text or '').strip().replace('\n', ' ')
    return text if len(text) <= n else text[:n] + '…'


# ═══════════════════════════════════════════════════════════════════════
# 1. Search — параллельный поиск
# ═══════════════════════════════════════════════════════════════════════

def _pg_fts(query: str, limit: int = SEARCH_LIMIT, days: Optional[int] = None) -> List[Dict]:
    """Полнотекстовый поиск русским стеммером."""
    try:
        conn = _connect()
        cur = conn.cursor()
        where_date = 'AND created_at >= NOW() - INTERVAL %s' if days else ''
        params = [query, query]
        if days:
            params.append(f'{days} days')
        params.append(limit)
        cur.execute(f"""
            SELECT id, role, content, created_at, tags, category,
                   ts_rank(to_tsvector('russian', content), plainto_tsquery('russian', %s)) AS rank
            FROM conversations
            WHERE to_tsvector('russian', content) @@ plainto_tsquery('russian', %s)
              AND NOT archived
              {where_date}
            ORDER BY rank DESC, created_at DESC
            LIMIT %s
        """, params)
        rows = list(cur.fetchall())
        conn.close()
        return [{
            'source':   'pg_fts',
            'id':       str(r['id']),
            'role':     r['role'],
            'excerpt':  _excerpt(r['content']),
            'date':     r['created_at'].isoformat(),
            'tags':     r['tags'] or [],
            'category': r['category'],
            'score':    float(r['rank']),
        } for r in rows]
    except Exception as e:
        log.warning(f'pg_fts: {e}')
        return []


def _pg_trigram(query: str, limit: int = 5) -> List[Dict]:
    """Триграммный поиск — ловит опечатки."""
    try:
        conn = _connect()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, role, content, created_at,
                   similarity(content, %s) AS sim
            FROM conversations
            WHERE content %% %s
              AND NOT archived
            ORDER BY sim DESC
            LIMIT %s
        """, (query, query, limit))
        rows = list(cur.fetchall())
        conn.close()
        return [{
            'source':  'pg_trigram',
            'id':      str(r['id']),
            'role':    r['role'],
            'excerpt': _excerpt(r['content']),
            'date':    r['created_at'].isoformat(),
            'score':   float(r['sim']),
        } for r in rows]
    except Exception as e:
        log.warning(f'pg_trigram: {e}')
        return []


def _pg_semantic(query: str, limit: int = SEARCH_LIMIT) -> List[Dict]:
    """Векторный поиск (по смыслу). Требует embedding."""
    try:
        vec = embed(query)
        if not any(abs(x) > 1e-9 for x in vec[:10]):
            log.warning('pg_semantic: embed вернул нулевой вектор')
            return []
        conn = _connect()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, role, content, created_at, tags, category,
                   1 - (embedding <=> %s::vector) AS similarity
            FROM conversations
            WHERE embedding IS NOT NULL AND NOT archived
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """, (vec, vec, limit))
        rows = list(cur.fetchall())
        conn.close()
        return [{
            'source':   'pg_semantic',
            'id':       str(r['id']),
            'role':     r['role'],
            'excerpt':  _excerpt(r['content']),
            'date':     r['created_at'].isoformat(),
            'tags':     r['tags'] or [],
            'category': r['category'],
            'score':    float(r['similarity']),
        } for r in rows]
    except Exception as e:
        log.warning(f'pg_semantic: {e}')
        return []


def _rag_query(query: str) -> str:
    """Запрос к LightRAG."""
    try:
        r = httpx.post(
            f'{LIGHTRAG_URL}/query',
            headers={'X-API-Key': LIGHTRAG_KEY, 'Content-Type': 'application/json'},
            json={'query': query, 'mode': 'hybrid'},
            timeout=30,
        )
        if r.status_code == 200:
            return r.json().get('response', '')
    except Exception as e:
        log.warning(f'rag: {e}')
    return ''


def search(
    query: str,
    limit: int = SEARCH_LIMIT,
    days: Optional[int] = None,
    modes: List[str] = None,
) -> Dict:
    """
    Главная функция поиска — запускает все методы параллельно.

    modes: список из {'fts','trigram','semantic','rag'} — по умолчанию все.
    Возвращает dict с результатами каждого метода + merged список top-N по score.
    """
    modes = modes or ['fts', 'semantic', 'rag', 'trigram']
    results = {'query': query, 'pg_fts': [], 'pg_trigram': [], 'pg_semantic': [], 'rag': ''}

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        futures = {}
        if 'fts' in modes:
            futures[ex.submit(_pg_fts, query, limit, days)] = 'pg_fts'
        if 'trigram' in modes:
            futures[ex.submit(_pg_trigram, query, limit//2)] = 'pg_trigram'
        if 'semantic' in modes:
            futures[ex.submit(_pg_semantic, query, limit)] = 'pg_semantic'
        if 'rag' in modes:
            futures[ex.submit(_rag_query, query)] = 'rag'

        for fut in concurrent.futures.as_completed(futures, timeout=45):
            key = futures[fut]
            try:
                results[key] = fut.result()
            except Exception as e:
                log.warning(f'{key}: {e}')

    # Мердж PG-результатов (дедуп по id, лучший score побеждает)
    merged = {}
    for bucket in ('pg_fts', 'pg_semantic', 'pg_trigram'):
        for item in results.get(bucket, []):
            existing = merged.get(item['id'])
            if not existing or item['score'] > existing.get('score', 0):
                merged[item['id']] = item
    results['merged'] = sorted(merged.values(), key=lambda x: x['score'], reverse=True)[:limit]

    return results


# ═══════════════════════════════════════════════════════════════════════
# 2. Archive old — в файл + LightRAG summary (НЕ удаляем из PG)
# ═══════════════════════════════════════════════════════════════════════

def archive_old(days: int = COLD_DAYS, dry_run: bool = False) -> Dict:
    """
    Для сообщений старше N дней:
      1. Выгружает в /root/claudia/archive/YYYY-MM-DD_to_YYYY-MM-DD.jsonl.gz
      2. Через Sonnet делает summary → сохраняет в LightRAG
      3. Помечает в PG флаг archived=TRUE (не удаляет — PG остаётся histotory)
    """
    stats = {'archived_msgs': 0, 'archives_created': 0, 'rag_summaries': 0}
    conn = _connect()
    cur = conn.cursor()

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Находим недели с неархивированными сообщениями старше cutoff
    cur.execute("""
        SELECT DATE_TRUNC('week', created_at) AS week_start,
               COUNT(*) AS n
        FROM conversations
        WHERE created_at < %s AND NOT archived
        GROUP BY week_start
        ORDER BY week_start ASC
    """, (cutoff,))
    weeks = cur.fetchall()

    if not weeks:
        log.info('Нечего архивировать')
        conn.close()
        return stats

    log.info(f'Найдено {len(weeks)} недель для архивации')

    for wk in weeks:
        week_start = wk['week_start']
        week_end   = week_start + timedelta(days=7)
        week_id    = week_start.strftime('%Y-W%W')

        cur.execute("""
            SELECT id, user_id, project, role, content, created_at, tags, category
            FROM conversations
            WHERE created_at >= %s AND created_at < %s AND NOT archived
            ORDER BY created_at ASC
        """, (week_start, week_end))
        msgs = list(cur.fetchall())
        if not msgs:
            continue

        # 1. Архивный файл
        fname = ARCHIVE_DIR / f'{week_start.strftime("%Y-%m-%d")}_to_{week_end.strftime("%Y-%m-%d")}.jsonl.gz'
        if not dry_run:
            with gzip.open(fname, 'wt', encoding='utf-8') as f:
                for m in msgs:
                    f.write(json.dumps({
                        'id':       str(m['id']),
                        'user_id':  m['user_id'],
                        'project':  m['project'],
                        'role':     m['role'],
                        'content':  m['content'],
                        'created':  m['created_at'].isoformat(),
                        'tags':     m['tags'] or [],
                        'category': m['category'],
                    }, ensure_ascii=False) + '\n')
            stats['archives_created'] += 1
            log.info(f'  ✓ {fname.name} ({len(msgs)} сообщений)')

        # 2. Summary через Sonnet → LightRAG
        if len(msgs) >= 5:  # слишком мало — смысла суммировать нет
            dialog = '\n\n'.join(f'[{m["role"]}]: {m["content"][:400]}' for m in msgs[-150:])[:80000]
            summary = call_llm(
                user=f'Неделя {week_id}, {len(msgs)} сообщений:\n\n{dialog}\n\nРезюме 300-500 слов:\n- Главные темы\n- Решения и договорённости\n- Технические изменения\n- Эмоциональный контекст (если важен)',
                system='Ты — архивариус. Создаёшь компактные резюме диалогов без вступлений.',
                tier='standard',
                max_tokens=800,
            )
            if summary and not dry_run:
                try:
                    httpx.post(
                        f'{LIGHTRAG_URL}/documents/text',
                        headers={'X-API-Key': LIGHTRAG_KEY, 'Content-Type': 'application/json'},
                        json={
                            'text': f'[Архив {week_id}]\n\n{summary}\n\nИсточник: {fname.name}',
                            'file_source': f'archive_{week_id}',
                        },
                        timeout=60,
                    )
                    stats['rag_summaries'] += 1
                except Exception as e:
                    log.warning(f'RAG save {week_id}: {e}')

        # 3. Отметка в PG (НЕ удаляем!)
        if not dry_run:
            ids = [m['id'] for m in msgs]
            cur.execute(
                'UPDATE conversations SET archived = TRUE WHERE id = ANY(%s::uuid[])',
                (ids,),
            )
            # Запись в metadata-таблицу
            cur.execute("""
                INSERT INTO conversation_archives
                  (period_start, period_end, filepath, msg_count, summary, rag_doc_id)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (week_start, week_end, str(fname), len(msgs),
                  summary[:500] if len(msgs) >= 5 else None,
                  f'archive_{week_id}'))
            conn.commit()
            stats['archived_msgs'] += len(msgs)

    conn.close()
    return stats


# ═══════════════════════════════════════════════════════════════════════
# 3. Remember — принудительная закладка в RAG
# ═══════════════════════════════════════════════════════════════════════

def remember(
    text: str,
    tags: List[str] = None,
    category: str = 'bookmark',
    project: str = 'claudia',
) -> bool:
    """Принудительно сохранить важную инфу в LightRAG с метаданными."""
    tags = tags or []
    now  = datetime.now(timezone.utc).isoformat()

    header = (
        f'[ЗАКЛАДКА {now}]\n'
        f'category: {category}\n'
        f'project: {project}\n'
        f'tags: {", ".join(tags) if tags else "(нет)"}\n\n'
    )
    payload = header + text.strip()

    try:
        r = httpx.post(
            f'{LIGHTRAG_URL}/documents/text',
            headers={'X-API-Key': LIGHTRAG_KEY, 'Content-Type': 'application/json'},
            json={'text': payload, 'file_source': f'bookmark_{now[:10]}_{hash(text) & 0xFFFF:04x}'},
            timeout=30,
        )
        ok = r.status_code in (200, 201)
        log.info(f'remember: {"✓" if ok else "✗"} (HTTP {r.status_code})')
        return ok
    except Exception as e:
        log.error(f'remember: {e}')
        return False


# ═══════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')

    if len(sys.argv) < 2:
        print('Использование:')
        print('  python3 claudia_memory.py search "запрос"')
        print('  python3 claudia_memory.py archive [--dry-run]')
        print('  python3 claudia_memory.py remember "текст" tag1,tag2 [category]')
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == 'search':
        query = ' '.join(sys.argv[2:]) or 'привет'
        r = search(query, limit=5)
        print(f'\n=== ПОИСК: «{query}» ===')
        print(f'\nTop merged (PG):')
        for i, item in enumerate(r['merged'][:5], 1):
            print(f'  {i}. [{item["source"]}] {item["date"][:19]} [{item["role"]}] score={item["score"]:.3f}')
            print(f'     {item["excerpt"]}')
        if r['rag']:
            print(f'\nRAG:\n  {r["rag"][:500]}')

    elif cmd == 'archive':
        dry = '--dry-run' in sys.argv
        stats = archive_old(days=COLD_DAYS, dry_run=dry)
        print(f'{"DRY RUN — " if dry else ""}Итог: {stats}')

    elif cmd == 'remember':
        text = sys.argv[2] if len(sys.argv) > 2 else 'тестовая закладка'
        tags = sys.argv[3].split(',') if len(sys.argv) > 3 else []
        cat = sys.argv[4] if len(sys.argv) > 4 else 'bookmark'
        ok = remember(text, tags=tags, category=cat)
        print(f'{"✓ сохранено" if ok else "✗ ошибка"}')
