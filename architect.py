"""
Архитектор v1.0 — автономный агент самовосстановления.
Запускается healthcheck при падении сервиса.
Диагностирует ошибку через LLM, применяет патч через aider, проверяет результат.
"""
import os
import sys
import json
import subprocess
import logging
import asyncio
import httpx
from datetime import datetime
from dotenv import load_dotenv

load_dotenv('/root/claudia/.env')
logging.basicConfig(level=logging.INFO, format='%(asctime)s [ARCHITECT] %(message)s')
log = logging.getLogger(__name__)

BOT_TOKEN  = os.getenv('TELEGRAM_BOT_TOKEN', '')
ADMIN_ID   = os.getenv('ADMIN_USER_ID', '254450353')
ANT_DIRECT = os.getenv('ANTHROPIC_API_KEY_DIRECT', '')
OR_KEY     = os.getenv('ANTHROPIC_API_KEY', '')
DS_KEY     = os.getenv('DEEPSEEK_API_KEY', '')

# Карта сервисов: имя → { лог, файл, команда перезапуска }
SERVICES = {
    'claudia-bot': {
        'log':     '/root/claudia/logs/bot.log',
        'file':    '/root/claudia/bot/main.py',
        'restart': 'systemctl restart claudia-bot',
        'check':   'systemctl is-active claudia-bot',
        'dir':     '/root/claudia',
    },
    'claudia-deploy': {
        'log':     '/root/claudia/logs/deploy.log',
        'file':    '/root/claudia/deploy_webhook.py',
        'restart': 'systemctl restart claudia-deploy',
        'check':   'systemctl is-active claudia-deploy',
        'dir':     '/root/claudia',
    },
}

ARCHITECT_SYSTEM = """Ты — архитектор-разработчик проекта Claudia (Telegram бот на python-telegram-bot).
Получаешь описание ошибки + фрагмент кода. Даёшь КОНКРЕТНЫЙ патч.

ФОРМАТ ОТВЕТА (строго):
ПРИЧИНА: [одна строка — в чём проблема]
ФАЙЛ: [путь к файлу]
ПАТЧ:
```python
[исправленный фрагмент кода — только изменённая часть]
```
КОМАНДА: [shell команда для перезапуска если нужна, или "нет"]

Никаких лишних слов. Только патч."""


def read_log_tail(log_path: str, lines: int = 50) -> str:
    """Читает последние N строк лога."""
    try:
        result = subprocess.run(
            ['tail', '-n', str(lines), log_path],
            capture_output=True, text=True, timeout=10
        )
        return result.stdout.strip()
    except Exception:
        return ''


def read_file_fragment(file_path: str, max_chars: int = 3000) -> str:
    """Читает файл (последние max_chars символов)."""
    try:
        content = open(file_path, 'r', encoding='utf-8').read()
        return content[-max_chars:] if len(content) > max_chars else content
    except Exception:
        return ''


def get_error_lines(log_text: str) -> str:
    """Извлекает строки с ошибками из лога."""
    errors = []
    for line in log_text.split('\n'):
        if any(kw in line for kw in ['ERROR', 'Traceback', 'Exception', 'CRITICAL', 'error']):
            errors.append(line)
    return '\n'.join(errors[-20:])


def ask_llm(prompt: str) -> str:
    """Запрашивает LLM для диагностики. Failover: DeepSeek → Anthropic."""
    messages = [
        {'role': 'system', 'content': ARCHITECT_SYSTEM},
        {'role': 'user', 'content': prompt},
    ]

    # 1. DeepSeek (дешевле)
    try:
        resp = httpx.post(
            'https://api.deepseek.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {DS_KEY}'},
            json={'model': 'deepseek-chat', 'messages': messages,
                  'max_tokens': 1000, 'temperature': 0.1},
            timeout=30
        )
        if resp.status_code == 200:
            return resp.json()['choices'][0]['message']['content'].strip()
    except Exception as e:
        log.warning(f'DeepSeek: {e}')

    # 2. Anthropic direct
    try:
        resp = httpx.post(
            'https://api.anthropic.com/v1/messages',
            headers={'x-api-key': ANT_DIRECT, 'anthropic-version': '2023-06-01',
                     'content-type': 'application/json'},
            json={'model': 'claude-haiku-4-5-20251001', 'max_tokens': 1000,
                  'system': ARCHITECT_SYSTEM,
                  'messages': [{'role': 'user', 'content': prompt}]},
            timeout=30
        )
        if resp.status_code == 200:
            return resp.json()['content'][0]['text'].strip()
    except Exception as e:
        log.warning(f'Anthropic: {e}')

    return ''


def apply_fix_with_aider(service_name: str, fix_prompt: str, work_dir: str) -> tuple[bool, str]:
    """Применяет исправление через aider."""
    env = os.environ.copy()
    env['OPENROUTER_API_KEY'] = OR_KEY

    cmd = [
        '/usr/local/bin/aider',
        '--model', 'openrouter/deepseek/deepseek-v3.2',
        '--message', fix_prompt,
        '--yes',
        '--no-auto-commits',
        '--no-stream',
    ]
    try:
        result = subprocess.run(
            cmd, cwd=work_dir, capture_output=True, text=True,
            timeout=180, env=env
        )
        if result.returncode == 0:
            return True, result.stdout[-1000:]
        return False, (result.stderr or result.stdout)[-500:]
    except subprocess.TimeoutExpired:
        return False, 'Таймаут 3 минуты'
    except Exception as e:
        return False, str(e)


def restart_service(restart_cmd: str, check_cmd: str) -> bool:
    """Перезапускает сервис и проверяет статус."""
    try:
        subprocess.run(restart_cmd.split(), check=True, capture_output=True, timeout=30)
        import time; time.sleep(5)
        result = subprocess.run(check_cmd.split(), capture_output=True, text=True, timeout=10)
        return result.stdout.strip() == 'active'
    except Exception:
        return False


def notify_telegram(text: str, urgent: bool = True):
    """Отправляет уведомление Кенану."""
    if not BOT_TOKEN:
        return
    prefix = '🚨' if urgent else '✅'
    try:
        httpx.post(
            f'https://api.telegram.org/bot{BOT_TOKEN}/sendMessage',
            json={'chat_id': ADMIN_ID, 'text': f'{prefix} <b>Архитектор</b>\n{text}',
                  'parse_mode': 'HTML'},
            timeout=10
        )
    except Exception:
        pass


def backup_file(file_path: str) -> str:
    """Создаёт бэкап файла перед патчем."""
    import shutil
    backup = file_path + f'.bak.{datetime.now().strftime("%H%M%S")}'
    try:
        shutil.copy2(file_path, backup)
        return backup
    except Exception:
        return ''


def restore_backup(backup_path: str, original_path: str):
    """Восстанавливает файл из бэкапа."""
    import shutil
    try:
        shutil.copy2(backup_path, original_path)
        log.info(f'Восстановлен из бэкапа: {original_path}')
    except Exception as e:
        log.error(f'Не могу восстановить бэкап: {e}')


def diagnose_and_fix(service_name: str) -> bool:
    """
    Главная функция: диагностика → патч → перезапуск → проверка.
    Возвращает True если починили.
    """
    svc = SERVICES.get(service_name)
    if not svc:
        log.error(f'Неизвестный сервис: {service_name}')
        return False

    log.info(f'Диагностирую {service_name}...')
    notify_telegram(f'🔍 Диагностирую <b>{service_name}</b>...')

    # Читаем логи и код
    log_text   = read_log_tail(svc['log'], lines=80)
    error_text = get_error_lines(log_text)
    code_text  = read_file_fragment(svc['file'])

    if not error_text:
        # Нет явных ошибок — просто перезапустим
        log.info('Ошибок в логе не найдено — пробуем перезапуск')
        ok = restart_service(svc['restart'], svc['check'])
        if ok:
            notify_telegram(f'✅ <b>{service_name}</b> восстановлен перезапуском', urgent=False)
            return True
        notify_telegram(f'❌ Перезапуск не помог. Нужно ручное вмешательство Кенана.')
        return False

    # Формируем запрос к LLM
    prompt = (
        f'Сервис: {service_name}\n'
        f'Файл: {svc["file"]}\n\n'
        f'ОШИБКИ ИЗ ЛОГА:\n{error_text}\n\n'
        f'КОД ФАЙЛА (последняя часть):\n{code_text}'
    )

    log.info('Запрашиваю LLM для диагностики...')
    fix_response = ask_llm(prompt)

    if not fix_response:
        notify_telegram(f'❌ LLM недоступен. Пробую просто перезапустить {service_name}.')
        ok = restart_service(svc['restart'], svc['check'])
        if ok:
            notify_telegram(f'✅ <b>{service_name}</b> восстановлен перезапуском', urgent=False)
            return True
        return False

    log.info(f'LLM ответ:\n{fix_response[:300]}')

    # Извлекаем причину для уведомления
    cause = ''
    for line in fix_response.split('\n'):
        if line.startswith('ПРИЧИНА:'):
            cause = line[8:].strip()
            break

    notify_telegram(
        f'🔧 <b>{service_name}</b> сломан.\n'
        f'Причина: {cause}\n'
        f'Применяю патч через Аидер...'
    )

    # Бэкап перед патчем
    backup = backup_file(svc['file'])

    # Применяем через aider
    aider_prompt = (
        f'Исправь ошибку в файле {svc["file"]}.\n\n'
        f'Диагноз от архитектора:\n{fix_response}\n\n'
        f'Примени исправление. Не меняй ничего лишнего.'
    )

    ok_aider, aider_out = apply_fix_with_aider(service_name, aider_prompt, svc['dir'])

    if not ok_aider:
        log.warning(f'Aider не смог применить патч: {aider_out[:200]}')
        # Восстанавливаем бэкап
        if backup:
            restore_backup(backup, svc['file'])

    # В любом случае пробуем перезапустить
    ok_restart = restart_service(svc['restart'], svc['check'])

    if ok_restart:
        log.info(f'{service_name} восстановлен!')
        notify_telegram(
            f'✅ <b>{service_name}</b> восстановлен!\n'
            f'Причина: {cause}\n'
            f'Патч применён: {"да" if ok_aider else "нет (только перезапуск)"}',
            urgent=False
        )
        return True
    else:
        # Откат
        if backup:
            restore_backup(backup, svc['file'])
        notify_telegram(
            f'❌ <b>{service_name}</b> не удалось починить автоматически.\n'
            f'Причина: {cause}\n\n'
            f'Кенан, нужно ручное вмешательство!'
        )
        return False


def main():
    """Точка входа: python architect.py <service_name>"""
    if len(sys.argv) < 2:
        print(f'Использование: python architect.py <service>')
        print(f'Сервисы: {list(SERVICES.keys())}')
        sys.exit(1)

    service = sys.argv[1]
    success = diagnose_and_fix(service)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
