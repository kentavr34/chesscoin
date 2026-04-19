"""
claudia_status.py — Единый дашборд состояния Клаудии.

Собирает за один вызов:
  1. Память: Redis + PG + LightRAG + GDrive (время последнего бэкапа)
  2. Сервисы: claudia-bot, lightrag, systemd таймеры
  3. Балансы: из Redis-кэша (обновляется notify_balances.py)
  4. Метрики за сутки: self-modify, architect fixes, aider tasks, сообщения
  5. Последние изменения личности (git log CLAUDIA_*.md за 24ч)

Использование:
  • Из бота: команда /claudia_status → format_status() → Markdown
  • Из CLI: python3 claudia_status.py
"""
import os
import json
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dotenv import dotenv_values

ENV = dotenv_values('/root/claudia/.env')

PG_DSN = (
    f"postgresql://{ENV.get('POSTGRES_USER','claudia')}"
    f":{ENV.get('POSTGRES_PASSWORD','')}"
    f"@{ENV.get('POSTGRES_HOST','localhost')}"
    f"/{ENV.get('POSTGRES_DB','claudia')}"
)
LIGHTRAG_URL = ENV.get('LIGHTRAG_URL', 'http://localhost:9622')


def check_redis():
    try:
        import redis
        r = redis.Redis(host='localhost', port=6379, db=1, decode_responses=True)
        r.ping()
        # Идентичность живая?
        id_exists = r.exists('claudia:identity')
        return {'ok': True, 'identity_loaded': bool(id_exists)}
    except Exception as e:
        return {'ok': False, 'error': str(e)[:80]}


def check_postgres():
    try:
        import psycopg2
        conn = psycopg2.connect(PG_DSN)
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM conversations WHERE created_at > NOW() - INTERVAL '24 hours'")
        msg_24h = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM conversations")
        total = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM media_files")
        media = cur.fetchone()[0]
        conn.close()
        return {'ok': True, 'total': total, 'msg_24h': msg_24h, 'media': media}
    except Exception as e:
        return {'ok': False, 'error': str(e)[:80]}


def check_lightrag():
    try:
        import httpx
        r = httpx.get(f'{LIGHTRAG_URL}/health', timeout=5)
        return {'ok': r.status_code == 200, 'status': r.json().get('status', '?')}
    except Exception as e:
        return {'ok': False, 'error': str(e)[:80]}


def check_gdrive_backups():
    """Возраст последнего бэкапа на Google Drive."""
    try:
        r = subprocess.run(
            ['rclone', 'lsl', 'gdrive:claudia_backups'],
            capture_output=True, text=True, timeout=30
        )
        if r.returncode != 0:
            return {'ok': False, 'error': 'rclone failed'}
        lines = [l.strip() for l in r.stdout.splitlines() if l.strip()]
        if not lines:
            return {'ok': True, 'count': 0, 'last_age': None}
        # Формат: 'size YYYY-MM-DD HH:MM:SS.000 name'
        last_line = sorted(lines, key=lambda x: x.split()[1:3], reverse=True)[0]
        parts = last_line.split()
        last_date_str = f'{parts[1]} {parts[2][:8]}'  # 'YYYY-MM-DD HH:MM:SS'
        last_date = datetime.strptime(last_date_str, '%Y-%m-%d %H:%M:%S')
        age_hours = (datetime.utcnow() - last_date).total_seconds() / 3600
        return {'ok': True, 'count': len(lines), 'last_age_hours': round(age_hours, 1)}
    except Exception as e:
        return {'ok': False, 'error': str(e)[:80]}


def check_services():
    """Активные systemd сервисы Клаудии."""
    services = ['claudia-bot', 'claudia-webhook', 'lightrag', 'postgresql', 'redis-server']
    result = {}
    for svc in services:
        try:
            r = subprocess.run(['systemctl', 'is-active', svc],
                               capture_output=True, text=True, timeout=5)
            result[svc] = r.stdout.strip() == 'active'
        except Exception:
            result[svc] = False
    return result


def check_balances():
    """Кэш балансов из Redis (обновляется notify_balances.py)."""
    try:
        import redis
        r = redis.Redis(host='localhost', port=6379, db=1, decode_responses=True)
        cached = r.get('claudia:balances')
        updated = r.get('claudia:balances:updated_at')
        if cached:
            return {'ok': True, 'data': json.loads(cached), 'updated_at': updated}
        return {'ok': False, 'note': 'no cache — run notify_balances.py'}
    except Exception as e:
        return {'ok': False, 'error': str(e)[:80]}


def count_daily_metrics():
    """Метрики за последние 24ч."""
    metrics = {'self_modify': 0, 'architect_fixes': 0, 'aider_tasks': 0}
    try:
        # git log за 24ч — считает auto-self-modify
        r = subprocess.run(
            ['git', '-C', '/root/claudia', 'log', '--since=24 hours ago',
             '--pretty=format:%s', '--grep=self-modified'],
            capture_output=True, text=True, timeout=5
        )
        metrics['self_modify'] = len([l for l in r.stdout.splitlines() if l.strip()])
    except Exception:
        pass

    # aider tasks из aider.log (последние 24ч)
    try:
        aider_log = Path('/root/claudia/logs/aider.log')
        if aider_log.exists():
            cutoff = datetime.now() - timedelta(days=1)
            count = 0
            for line in aider_log.read_text(errors='ignore').splitlines()[-2000:]:
                if 'task started' in line.lower() or 'new task' in line.lower():
                    count += 1
            metrics['aider_tasks'] = count
    except Exception:
        pass

    return metrics


def get_latest_identity_changes(limit: int = 3):
    """Последние N коммитов CLAUDIA_*.md."""
    try:
        r = subprocess.run(
            ['git', '-C', '/root/claudia', 'log', '-n', str(limit),
             '--pretty=format:%h %s (%ar)', '--', 'CLAUDIA_*.md'],
            capture_output=True, text=True, timeout=5
        )
        return [l for l in r.stdout.splitlines() if l.strip()]
    except Exception:
        return []


def gather_status() -> dict:
    """Возвращает полный снимок состояния."""
    return {
        'timestamp':  datetime.now().isoformat(timespec='seconds'),
        'redis':      check_redis(),
        'postgres':   check_postgres(),
        'lightrag':   check_lightrag(),
        'gdrive':     check_gdrive_backups(),
        'services':   check_services(),
        'balances':   check_balances(),
        'metrics':    count_daily_metrics(),
        'identity':   get_latest_identity_changes(3),
    }


def format_status(s: dict) -> str:
    """Markdown-формат для Telegram."""
    def ok(x): return '✅' if x else '❌'

    lines = []
    lines.append('🤖 *Клаудия — статус*\n')

    # Память
    mem_parts = []
    mem_parts.append(f'Redis{ok(s["redis"].get("ok"))}')
    mem_parts.append(f'PG{ok(s["postgres"].get("ok"))}')
    mem_parts.append(f'RAG{ok(s["lightrag"].get("ok"))}')
    gd = s['gdrive']
    if gd.get('ok'):
        age = gd.get('last_age_hours')
        mem_parts.append(f'GDrive✅ ({age}ч назад, {gd.get("count")} копий)')
    else:
        mem_parts.append('GDrive❌')
    lines.append('🧠 *Память:* ' + ' '.join(mem_parts))

    # PostgreSQL детали
    pg = s['postgres']
    if pg.get('ok'):
        lines.append(f'   • Сообщений 24ч: *{pg.get("msg_24h")}* · всего: {pg.get("total"):,} · медиа: {pg.get("media")}')

    # Сервисы
    svc_line = ' '.join(f'{k.replace("claudia-","")}{ok(v)}' for k,v in s['services'].items())
    lines.append(f'🏗️ *Сервисы:* {svc_line}')

    # Балансы
    bal = s['balances']
    if bal.get('ok'):
        out = bal['data'].get('output', '')
        bal_lines = [l.strip() for l in out.splitlines() if ':' in l and '===' not in l]
        lines.append('💰 *Балансы:*')
        for bl in bal_lines[:5]:
            lines.append(f'   • {bl}')
    else:
        lines.append('💰 *Балансы:* нет кэша (жду notify\\_balances)')

    # Метрики
    m = s['metrics']
    lines.append(f'📊 *За 24ч:* self\\_modify={m["self_modify"]}, aider\\_tasks={m["aider_tasks"]}')

    # Последние изменения личности
    ident = s['identity']
    if ident:
        lines.append('📝 *Личность (последние коммиты):*')
        for c in ident:
            lines.append(f'   • `{c}`')

    return '\n'.join(lines)


if __name__ == '__main__':
    import sys
    status = gather_status()
    if '--json' in sys.argv:
        print(json.dumps(status, indent=2, ensure_ascii=False, default=str))
    else:
        print(format_status(status))
