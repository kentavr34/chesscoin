"""
reflection_weekly.py — еженедельный мета-анализ прошедшей недели.

Раз в неделю (воскресенье 04:00 UTC):
1. Берёт все conversations за последние 7 дней (не archived)
2. Группирует по category/tags
3. Через opus/sonnet создаёт мета-саммари:
   - главные темы недели
   - принятые решения
   - незакрытые вопросы
   - нестабильные модели / API
   - неожиданности и инсайты
4. Сохраняет в LightRAG с тегом `reflection_weekly`
5. Шлёт резюме в Telegram (Kenan)

Запуск: python3 reflection_weekly.py [--days 7] [--dry-run]
"""
import sys
import os
import time
import logging
from datetime import datetime, timedelta
from collections import Counter
import psycopg2
import psycopg2.extras
import requests
from dotenv import load_dotenv

load_dotenv('/root/claudia/.env')
sys.path.insert(0, '/root/claudia')
from model_registry import call_llm

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/root/claudia/logs/reflection.log'),
    ],
)
log = logging.getLogger('reflection')

RAG_URL = 'http://localhost:9622'
RAG_KEY = os.getenv('LIGHTRAG_API_KEY', 'chesscoin_rag_secret_2026')
TG_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
TG_CHAT = os.getenv('TELEGRAM_OWNER_ID') or os.getenv('OWNER_ID') or ''


def connect():
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        dbname=os.getenv('POSTGRES_DB', 'claudia'),
        user=os.getenv('POSTGRES_USER', 'claudia'),
        password=os.getenv('POSTGRES_PASSWORD', ''),
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def collect(days: int) -> dict:
    conn = connect()
    cur = conn.cursor()
    since = datetime.now() - timedelta(days=days)
    cur.execute("""
        SELECT id, role, content, category, tags, created_at
        FROM conversations
        WHERE created_at >= %s AND NOT archived
        ORDER BY created_at ASC
    """, (since,))
    rows = list(cur.fetchall())
    conn.close()
    return {
        'rows': rows,
        'total': len(rows),
        'categories': Counter(r['category'] or 'other' for r in rows),
        'tags': Counter(t for r in rows for t in (r['tags'] or [])),
        'since': since,
    }


def build_prompt(data: dict, days: int) -> str:
    cats = ', '.join(f'{c}={n}' for c, n in data['categories'].most_common(10))
    tags = ', '.join(f'{t}({n})' for t, n in data['tags'].most_common(15))
    # Берём сэмпл сообщений: по 3 самых длинных из каждой категории
    by_cat = {}
    for r in data['rows']:
        by_cat.setdefault(r['category'] or 'other', []).append(r)
    samples = []
    for cat, items in by_cat.items():
        items.sort(key=lambda x: len(x['content'] or ''), reverse=True)
        for r in items[:3]:
            content = (r['content'] or '')[:500].replace('\n', ' ')
            samples.append(f'[{cat}] {content}')
    sample_text = '\n'.join(samples[:40])

    return f"""Ты — аналитик Клаудии. Проанализируй {days} дней работы ({data['total']} сообщений).

Категории: {cats}
Топ-теги: {tags}

Примеры сообщений (по 3 из категории):
{sample_text}

Напиши мета-саммари строго в таком формате (markdown):

## 🎯 Главные темы недели
(3-5 буллетов — что было в центре внимания)

## ✅ Принятые решения
(что решили и внедрили окончательно)

## ❓ Незакрытые вопросы
(что осталось висеть)

## ⚠️ Проблемы и сбои
(баги, отказы API, тупики)

## 💡 Инсайты
(что выяснилось, неожиданности)

## 📋 План на следующую неделю
(2-4 конкретных пункта)

Пиши кратко, по делу, русский язык, без воды."""


def save_to_rag(summary: str, week_start: datetime):
    """Сохраняем саммари в LightRAG."""
    week_id = week_start.strftime('%G-W%V')
    header = (f'[REFLECTION WEEK {week_id}]\n'
              f'[PROJECT: claudia] [CATEGORY: reflection] [DATE: {week_start.date()}]\n'
              f'[TAGS: reflection_weekly, meta_summary]\n\n')
    payload = {'text': header + summary}
    try:
        r = requests.post(
            f'{RAG_URL}/documents/text',
            json=payload,
            headers={'X-API-Key': RAG_KEY},
            timeout=60,
        )
        r.raise_for_status()
        log.info(f'✓ RAG saved: week {week_id}')
        return True
    except Exception as e:
        log.error(f'RAG save failed: {e}')
        return False


def notify_telegram(summary: str):
    if not TG_TOKEN or not TG_CHAT:
        log.warning('TG notify skipped (no token/chat)')
        return
    try:
        requests.post(
            f'https://api.telegram.org/bot{TG_TOKEN}/sendMessage',
            json={
                'chat_id': TG_CHAT,
                'text': f'📊 Еженедельная рефлексия готова\n\n{summary[:3800]}',
                'parse_mode': 'Markdown',
            },
            timeout=15,
        )
        log.info('✓ TG notified')
    except Exception as e:
        log.warning(f'TG failed: {e}')


def main():
    days = 7
    dry_run = '--dry-run' in sys.argv
    for i, a in enumerate(sys.argv):
        if a == '--days' and i + 1 < len(sys.argv):
            days = int(sys.argv[i + 1])

    log.info(f'═' * 60)
    log.info(f'Reflection за {days} дней, dry_run={dry_run}')

    data = collect(days)
    if data['total'] == 0:
        log.info('Нет сообщений за период')
        return

    log.info(f'Собрано: {data["total"]} сообщений, {len(data["categories"])} категорий')

    prompt = build_prompt(data, days)
    log.info(f'Prompt: {len(prompt)} chars → tier=deep')

    t0 = time.time()
    summary = call_llm(prompt, tier='deep', max_tokens=1500)
    log.info(f'Генерация: {time.time()-t0:.1f}s, {len(summary or "")} chars')

    if not summary:
        log.error('LLM не ответил')
        return

    print('\n' + '=' * 60)
    print(summary)
    print('=' * 60 + '\n')

    if dry_run:
        log.info('DRY RUN — не сохраняем')
        return

    save_to_rag(summary, data['since'])
    notify_telegram(summary)
    log.info('Готово')


if __name__ == '__main__':
    main()
