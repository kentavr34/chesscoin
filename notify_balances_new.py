#!/usr/bin/env python3
"""
notify_balances.py v2 — Проверка балансов с логированием и Telegram-уведомлениями.

Улучшения v2:
  • Явное логирование в /root/claudia/logs/balances.log (раньше был silent)
  • Запуск balance_check.py через venv python (где гарантированно есть httpx)
  • try/except вокруг Telegram-отправки (раньше мог тихо упасть)
  • Сохранение результатов в Redis для /claudia_status команды
  • Всегда отправляет ежедневный отчёт в 09:00 (не только когда warning)
"""
import subprocess
import os
import sys
import json
import logging
import urllib.request
from datetime import datetime
from dotenv import dotenv_values

# ── Логирование в файл + stdout ────────────────────────────────────────────
LOG_FILE = '/root/claudia/logs/balances.log'
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [BALANCES] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger('balances')

# ── Конфиг ──────────────────────────────────────────────────────────────────
ENV = dotenv_values('/root/claudia/.env')
BOT_TOKEN = ENV.get('TELEGRAM_BOT_TOKEN', '')
ADMIN_ID  = ENV.get('ADMIN_USER_ID', '')
VENV_PY   = '/root/claudia/venv/bin/python3'
BALANCE_SCRIPT = '/root/claudia/balance_check.py'

ALWAYS_REPORT = '--daily' in sys.argv  # если --daily, отправляем отчёт даже без warning


def send_telegram(text: str) -> bool:
    """Отправить в Telegram с логированием ошибок."""
    if not BOT_TOKEN or not ADMIN_ID:
        log.warning('Telegram credentials missing — skip')
        return False
    try:
        data = json.dumps({
            'chat_id': ADMIN_ID,
            'text': text,
            'parse_mode': 'HTML',
        }).encode()
        req = urllib.request.Request(
            f'https://api.telegram.org/bot{BOT_TOKEN}/sendMessage',
            data=data,
            headers={'Content-Type': 'application/json'},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                log.info('Telegram sent OK')
                return True
            log.error(f'Telegram HTTP {resp.status}')
            return False
    except Exception as e:
        log.error(f'Telegram error: {e}')
        return False


def cache_to_redis(report: dict):
    """Сохранить балансы в Redis для /claudia_status."""
    try:
        import redis
        r = redis.Redis(host='localhost', port=6379, db=1, decode_responses=True)
        r.set('claudia:balances', json.dumps(report, ensure_ascii=False))
        r.set('claudia:balances:updated_at', datetime.utcnow().isoformat())
        log.info('Balances cached to Redis')
    except Exception as e:
        log.warning(f'Redis cache failed: {e}')


def main():
    log.info('═══ Проверка балансов ═══')

    # Запускаем balance_check через venv python (гарантированно с httpx)
    try:
        r = subprocess.run(
            [VENV_PY, BALANCE_SCRIPT],
            capture_output=True,
            text=True,
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        log.error('balance_check.py timeout 60s')
        send_telegram('⚠️ <b>Балансы</b>\nПроверка зависла на 60с — проверь сеть на сервере')
        return 2
    except Exception as e:
        log.error(f'balance_check.py crash: {e}')
        send_telegram(f'❌ <b>Балансы</b>\nОшибка запуска: {e}')
        return 3

    out = (r.stdout or '') + (r.stderr or '')
    log.info(f'balance_check exit={r.returncode}')
    log.info(f'balance_check output:\n{out}')

    # Парсим: есть warning (⚡) или нет?
    has_warning = '⚡' in out or r.returncode != 0

    # Сохраняем кэш в Redis (для /claudia_status)
    cache_to_redis({
        'output': out,
        'has_warning': has_warning,
        'exit_code': r.returncode,
        'checked_at': datetime.utcnow().isoformat(),
    })

    # Отправляем в Telegram
    if has_warning:
        lines = [l for l in out.splitlines() if l.strip() and '===' not in l]
        msg = '⚡ <b>Балансы — требуется внимание</b>\n<pre>' + '\n'.join(lines) + '</pre>'
        send_telegram(msg)
        log.info('Warning отправлен в Telegram')
    elif ALWAYS_REPORT:
        lines = [l for l in out.splitlines() if l.strip() and '===' not in l]
        msg = '✅ <b>Ежедневный отчёт балансов</b>\n<pre>' + '\n'.join(lines) + '</pre>'
        send_telegram(msg)
        log.info('Ежедневный отчёт отправлен')
    else:
        log.info('Всё в норме — Telegram-уведомление не требуется')

    log.info('═══ Завершено ═══')
    return 0


if __name__ == '__main__':
    sys.exit(main())
