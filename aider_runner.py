"""
Aider Task Runner — читает задачи из claudia_tasks, выполняет через aider, отчитывается в Telegram.
Запускается каждые 5 минут через systemd timer.
"""
import os
import subprocess
import sys
import asyncio
import logging
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('/root/claudia/.env')
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
log = logging.getLogger(__name__)

REPO_PATH   = '/opt/chesscoin'
ANTHROPIC_KEY = os.getenv('ANTHROPIC_API_KEY', '')
BOT_TOKEN   = os.getenv('TELEGRAM_BOT_TOKEN', '')
ADMIN_ID    = int(os.getenv('ADMIN_USER_ID', '0'))


def get_db():
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', '172.18.0.4'),
        port=int(os.getenv('POSTGRES_PORT', 5432)),
        dbname=os.getenv('POSTGRES_DB', 'chesscoin'),
        user=os.getenv('POSTGRES_USER', 'chesscoin'),
        password=os.getenv('POSTGRES_PASSWORD'),
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def get_pending_task():
    """Берёт одну задачу со статусом pending."""
    with get_db() as db:
        cur = db.cursor()
        cur.execute(
            """SELECT id, user_id, title, description, stages, report_format
               FROM claudia_tasks
               WHERE status='pending'
               ORDER BY created_at
               LIMIT 1
               FOR UPDATE SKIP LOCKED"""
        )
        return cur.fetchone()


def set_task_status(task_id: int, status: str, result: str = None):
    with get_db() as db:
        cur = db.cursor()
        cur.execute(
            """UPDATE claudia_tasks
               SET status=%s, aider_result=%s, updated_at=NOW()
               WHERE id=%s""",
            (status, result, task_id)
        )
        db.commit()


def build_aider_prompt(task: dict) -> str:
    stages = task.get('stages') or []
    stages_text = '\n'.join(f'  {s}' for s in stages) if stages else ''

    prompt = f"{task['description']}"
    if stages_text:
        prompt += f"\n\nЭтапы выполнения:\n{stages_text}"

    fmt = task.get('report_format', 'text')
    if fmt == 'code':
        prompt += "\n\nОтчёт: покажи только изменённые файлы и код."
    elif fmt == 'both':
        prompt += "\n\nОтчёт: опиши что сделал и покажи ключевые изменения кода."
    else:
        prompt += "\n\nОтчёт: кратко опиши что было сделано."

    return prompt


def run_aider(prompt: str, project_name: str = None) -> tuple[bool, str]:
    """Запускает aider с задачей. Возвращает (успех, вывод)."""
    work_dir = REPO_PATH
    if project_name and project_name != 'chesscoin':
        alt = f'/opt/{project_name}'
        if os.path.isdir(alt):
            work_dir = alt

    cmd = [
        '/root/claudia/venv/bin/aider',
        '--model', 'claude-sonnet-4-6',
        '--message', prompt,
        '--yes',
        '--no-git',          # не делать git commit автоматически
        '--no-auto-commits',
        '--stream',
    ]

    env = os.environ.copy()
    env['ANTHROPIC_API_KEY'] = ANTHROPIC_KEY

    try:
        result = subprocess.run(
            cmd,
            cwd=work_dir,
            capture_output=True,
            text=True,
            timeout=600,  # 10 минут максимум
            env=env,
        )
        output = result.stdout[-3000:] if result.stdout else ''
        if result.returncode == 0:
            return True, output
        else:
            err = (result.stderr or '')[-1000:]
            return False, f"Ошибка (код {result.returncode}):\n{err}"
    except subprocess.TimeoutExpired:
        return False, 'Таймаут 10 минут — задача слишком большая.'
    except Exception as e:
        return False, f'Исключение: {e}'


async def send_telegram(user_id: int, text: str):
    """Отправляет сообщение пользователю через бот."""
    import aiohttp
    # Обрезаем до лимита Telegram
    if len(text) > 4000:
        text = text[:3900] + '\n...[обрезано]'
    try:
        async with aiohttp.ClientSession() as sess:
            await sess.post(
                f'https://api.telegram.org/bot{BOT_TOKEN}/sendMessage',
                json={'chat_id': user_id, 'text': text, 'parse_mode': 'HTML'},
                timeout=aiohttp.ClientTimeout(total=10)
            )
    except Exception as e:
        log.warning(f'Telegram отправка: {e}')


async def process_task(task: dict):
    task_id   = task['id']
    user_id   = task['user_id']
    title     = task.get('title', f'Задача #{task_id}')
    proj      = task.get('project_name', 'chesscoin')

    log.info(f'Выполняю задачу #{task_id}: {title}')
    set_task_status(task_id, 'processing')

    # Уведомление о старте
    await send_telegram(user_id, f'⚙️ Начинаю задачу #{task_id}: <b>{title}</b>')

    prompt   = build_aider_prompt(task)
    ok, out  = run_aider(prompt, project_name=proj)

    if ok:
        set_task_status(task_id, 'done', out)
        report = f'✅ Задача #{task_id} выполнена: <b>{title}</b>\n\n{out}'
        log.info(f'Задача #{task_id} выполнена')
    else:
        set_task_status(task_id, 'failed', out)
        report = f'❌ Задача #{task_id} не выполнена: <b>{title}</b>\n\n{out}'
        log.error(f'Задача #{task_id} провалилась: {out[:200]}')

    await send_telegram(user_id, report)
    # Дублируем админу если это не он сам
    if ADMIN_ID and user_id != ADMIN_ID:
        await send_telegram(ADMIN_ID, report)


async def main():
    task = get_pending_task()
    if not task:
        log.info('Нет задач в очереди')
        return

    await process_task(dict(task))


if __name__ == '__main__':
    asyncio.run(main())
