"""
Aider Task Runner v2.0 — ветки, diff-файл, GitHub PR, BIBLE аудит.
Запускается каждые 5 минут через systemd timer.
"""
import os
import subprocess
import sys
import asyncio
import logging
import psycopg2
import psycopg2.extras
import json
import httpx
from datetime import date
from dotenv import load_dotenv

load_dotenv('/root/claudia/.env')
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
log = logging.getLogger(__name__)

REPO_PATH     = '/opt/chesscoin'
ANTHROPIC_KEY = os.getenv('ANTHROPIC_API_KEY', '')          # OpenRouter
ANT_DIRECT    = os.getenv('ANTHROPIC_API_KEY_DIRECT', '')   # прямой Anthropic
DS_KEY        = os.getenv('DEEPSEEK_API_KEY', '')
BOT_TOKEN     = os.getenv('TELEGRAM_BOT_TOKEN', '')
ADMIN_ID      = int(os.getenv('ADMIN_USER_ID', '254450353'))
GH_TOKEN      = os.getenv('GITHUB_TOKEN', '')               # для PR API
GH_REPO       = os.getenv('GITHUB_REPO', 'kentavr34/chesscoin')
BIBLE_PATH    = os.path.join(REPO_PATH, 'BIBLE.md')


def get_db():
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        port=int(os.getenv('POSTGRES_PORT', 5432)),
        dbname=os.getenv('POSTGRES_DB', 'claudia'),
        user=os.getenv('POSTGRES_USER', 'claudia'),
        password=os.getenv('POSTGRES_PASSWORD'),
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def get_pending_task():
    with get_db() as db:
        cur = db.cursor()
        cur.execute(
            """SELECT id, user_id, title, description, stages, report_format, project_name
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


def set_task_branch(task_id: int, branch: str, pr_url: str = None):
    """Сохраняет ветку и PR URL в таблице."""
    with get_db() as db:
        cur = db.cursor()
        # Пробуем обновить, если колонки существуют
        try:
            cur.execute(
                """UPDATE claudia_tasks
                   SET branch=%s, pr_url=%s, updated_at=NOW()
                   WHERE id=%s""",
                (branch, pr_url, task_id)
            )
            db.commit()
        except Exception:
            db.rollback()
            # Если колонок нет — просто логируем
            log.info(f'branch={branch} pr_url={pr_url} для задачи #{task_id}')


def build_aider_prompt(task: dict) -> str:
    stages = task.get('stages') or []
    stages_text = '\n'.join(f'  {s}' for s in stages) if stages else ''
    prompt = task['description']
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


def git_create_branch(work_dir: str, branch: str) -> tuple[bool, str]:
    """Создаёт новую ветку от main."""
    try:
        subprocess.run(['git', 'checkout', 'main'], cwd=work_dir, check=True,
                       capture_output=True, timeout=30)
        subprocess.run(['git', 'pull', 'origin', 'main'], cwd=work_dir,
                       capture_output=True, timeout=60)
        r = subprocess.run(['git', 'checkout', '-b', branch], cwd=work_dir,
                           capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            # ветка уже существует — переключаемся на неё
            subprocess.run(['git', 'checkout', branch], cwd=work_dir, check=True,
                           capture_output=True, timeout=30)
        return True, f'Ветка {branch} создана'
    except Exception as e:
        return False, str(e)


def git_get_diff(work_dir: str) -> tuple[str, str]:
    """Возвращает (полный diff, статистика)."""
    full = subprocess.run(['git', 'diff', 'main...HEAD', '--'], cwd=work_dir,
                          capture_output=True, text=True, timeout=30).stdout
    if not full:
        full = subprocess.run(['git', 'diff'], cwd=work_dir,
                              capture_output=True, text=True, timeout=30).stdout
    stat = subprocess.run(['git', 'diff', '--stat', 'main...HEAD'], cwd=work_dir,
                          capture_output=True, text=True, timeout=30).stdout
    if not stat:
        stat = subprocess.run(['git', 'diff', '--stat'], cwd=work_dir,
                              capture_output=True, text=True, timeout=30).stdout
    return full, stat


def git_commit_branch(work_dir: str, branch: str, title: str) -> tuple[bool, str]:
    """Коммитит на текущей ветке и пушит."""
    try:
        status = subprocess.run(['git', 'status', '--porcelain'], cwd=work_dir,
                                capture_output=True, text=True, timeout=30)
        if not status.stdout.strip():
            return True, 'Нет изменений для коммита'
        subprocess.run(['git', 'add', '-A'], cwd=work_dir, check=True, timeout=30)
        subprocess.run(['git', 'commit', '-m', f'task: {title[:60]}'],
                       cwd=work_dir, check=True, timeout=30)
        result = subprocess.run(['git', 'push', 'origin', branch],
                                cwd=work_dir, capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            return True, 'OK'
        return False, result.stderr[:300]
    except Exception as e:
        return False, str(e)


def git_merge_to_main(work_dir: str, branch: str) -> tuple[bool, str]:
    """Мёрджит ветку в main и пушит."""
    try:
        subprocess.run(['git', 'checkout', 'main'], cwd=work_dir, check=True,
                       capture_output=True, timeout=30)
        subprocess.run(['git', 'merge', '--no-ff', branch, '-m', f'Merge {branch} -> main'],
                       cwd=work_dir, check=True, capture_output=True, timeout=30)
        result = subprocess.run(['git', 'push', 'origin', 'main'],
                                cwd=work_dir, capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            sha = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'],
                                 cwd=work_dir, capture_output=True, text=True).stdout.strip()
            return True, sha
        return False, result.stderr[:300]
    except Exception as e:
        return False, str(e)


def create_github_pr(branch: str, title: str, body: str):
    """Создаёт PR на GitHub, возвращает URL или None."""
    if not GH_TOKEN:
        return None
    try:
        resp = httpx.post(
            f'https://api.github.com/repos/{GH_REPO}/pulls',
            headers={
                'Authorization': f'token {GH_TOKEN}',
                'Accept': 'application/vnd.github.v3+json',
            },
            json={
                'title': title[:72],
                'body': body,
                'head': branch,
                'base': 'main',
            },
            timeout=15,
        )
        if resp.status_code in (200, 201):
            return resp.json().get('html_url')
    except Exception as e:
        log.warning(f'GitHub PR: {e}')
    return None


def bible_audit(diff_text: str, task_title: str) -> str:
    """Проверяет diff против BIBLE.md через LLM."""
    try:
        bible = open(BIBLE_PATH, 'r', encoding='utf-8').read()
    except Exception:
        return '(BIBLE.md не найден — аудит пропущен)'

    if not diff_text or not diff_text.strip():
        return 'ВЕРДИКТ: нет изменений для аудита'

    system = (
        "Ты строгий ревьюер проекта ChessCoin. "
        "Проверь diff на соответствие BIBLE.md. "
        "Ответ СТРОГО:\n"
        "ВЕРДИКТ: ПРИНЯТО / ЗАМЕЧАНИЯ / ОТКЛОНЕНО\n"
        "НАРУШЕНИЯ: (список или 'нет')\n"
        "ИТОГ: 1-2 предложения что изменено."
    )
    user_msg = f"BIBLE.md:\n{bible[:3000]}\n\n---\nЗадача: {task_title}\n\nDIFF:\n{diff_text[:4000]}"

    # DeepSeek direct (дешевле)
    try:
        resp = httpx.post(
            'https://api.deepseek.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {DS_KEY}', 'Content-Type': 'application/json'},
            json={
                'model': 'deepseek-chat',
                'messages': [
                    {'role': 'system', 'content': system},
                    {'role': 'user', 'content': user_msg},
                ],
                'max_tokens': 600,
                'temperature': 0.1,
            },
            timeout=30,
        )
        if resp.status_code == 200:
            return resp.json()['choices'][0]['message']['content'].strip()
    except Exception as e:
        log.warning(f'bible_audit DeepSeek: {e}')

    # Fallback: Anthropic direct (claude-haiku)
    try:
        resp = httpx.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'x-api-key': ANT_DIRECT,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            json={
                'model': 'claude-haiku-4-5-20251001',
                'max_tokens': 600,
                'system': system,
                'messages': [{'role': 'user', 'content': user_msg}],
            },
            timeout=30,
        )
        if resp.status_code == 200:
            return resp.json()['content'][0]['text'].strip()
    except Exception as e:
        log.warning(f'bible_audit Anthropic: {e}')

    return '(Аудит недоступен — проверьте API ключи)'


def run_aider(prompt: str, work_dir: str) -> tuple[bool, str]:
    cmd = [
        '/root/claudia/venv/bin/aider',
        '--model', 'openrouter/deepseek/deepseek-v3.2',
        '--message', prompt,
        '--yes',
        '--no-auto-commits',
        '--stream',
    ]
    env = os.environ.copy()
    env['OPENROUTER_API_KEY'] = ANTHROPIC_KEY

    try:
        result = subprocess.run(
            cmd, cwd=work_dir, capture_output=True, text=True, timeout=600, env=env
        )
        output = result.stdout[-3000:] if result.stdout else ''
        if result.returncode == 0:
            return True, output
        err = (result.stderr or '')[-1000:]
        return False, f"Ошибка (код {result.returncode}):\n{err}"
    except subprocess.TimeoutExpired:
        return False, 'Таймаут 10 минут — задача слишком большая.'
    except Exception as e:
        return False, f'Исключение: {e}'


async def send_telegram(user_id: int, text: str):
    if len(text) > 4000:
        text = text[:3900] + '\n...[обрезано]'
    try:
        import aiohttp
        async with aiohttp.ClientSession() as sess:
            await sess.post(
                f'https://api.telegram.org/bot{BOT_TOKEN}/sendMessage',
                json={'chat_id': user_id, 'text': text, 'parse_mode': 'HTML'},
                timeout=aiohttp.ClientTimeout(total=10)
            )
    except Exception as e:
        log.warning(f'Telegram: {e}')


async def send_telegram_file(user_id: int, file_path: str, caption: str = ''):
    """Отправляет файл в Telegram."""
    try:
        import aiohttp
        async with aiohttp.ClientSession() as sess:
            with open(file_path, 'rb') as f:
                form = aiohttp.FormData()
                form.add_field('chat_id', str(user_id))
                form.add_field('caption', caption[:1024])
                form.add_field('document', f, filename=os.path.basename(file_path))
                await sess.post(
                    f'https://api.telegram.org/bot{BOT_TOKEN}/sendDocument',
                    data=form,
                    timeout=aiohttp.ClientTimeout(total=30)
                )
    except Exception as e:
        log.warning(f'Telegram file: {e}')


async def process_task(task: dict):
    """
    ЭТАП 1:
    1. Создаём ветку task-{id}
    2. Aider выполняет (без git push)
    3. Коммитим на ветке + пушим ветку
    4. Создаём GitHub PR (если есть GITHUB_TOKEN)
    5. BIBLE аудит через LLM
    6. Отправляем .diff файл + PR ссылку + аудит Кенану
    """
    task_id  = task['id']
    user_id  = task['user_id']
    title    = task.get('title', f'Задача #{task_id}')
    proj     = task.get('project_name') or 'chesscoin'
    work_dir = f'/opt/{proj}'
    branch   = f'task-{task_id}'

    log.info(f'Задача #{task_id}: {title}')
    set_task_status(task_id, 'processing')
    await send_telegram(user_id,
        f'Кенан, начинаю задачу #{task_id}: <b>{title}</b>\nЭто займёт несколько минут...')

    # 1. Создаём ветку
    ok, msg = git_create_branch(work_dir, branch)
    if not ok:
        set_task_status(task_id, 'failed', msg)
        await send_telegram(user_id, f'Не могу создать ветку: {msg}')
        return

    # 2. Запускаем aider
    prompt = build_aider_prompt(task)
    ok, out = run_aider(prompt, work_dir)
    if not ok:
        subprocess.run(['git', 'checkout', 'main'], cwd=work_dir, capture_output=True)
        set_task_status(task_id, 'failed', out)
        await send_telegram(user_id, f'Задача #{task_id} провалилась:\n{out[:1500]}')
        return

    # 3. Получаем diff
    full_diff, stat = git_get_diff(work_dir)

    # 4. Коммитим на ветке
    git_commit_branch(work_dir, branch, title)

    # 5. GitHub PR
    pr_url = None
    if GH_TOKEN:
        pr_body = f"## Задача #{task_id}\n{task.get('description','')}\n\n**Статистика:**\n```\n{stat}\n```"
        pr_url = create_github_pr(branch, f'Task #{task_id}: {title}', pr_body)
        if pr_url:
            log.info(f'PR создан: {pr_url}')
    set_task_branch(task_id, branch, pr_url)

    # 6. Diff файл
    diff_file = f'/tmp/task_{task_id}.diff'
    with open(diff_file, 'w', encoding='utf-8') as df:
        df.write(full_diff or '# Нет изменений')

    # 7. BIBLE аудит
    audit = bible_audit(full_diff or '', title)

    # 8. Сохраняем
    set_task_status(task_id, 'audit',
        f"{out[-2000:]}\n\nАудит BIBLE:\n{audit}\n\nDiff stat:\n{stat}")
    _mark_subtasks_done(proj, task_id)

    # 9. Отправляем .diff файл
    await send_telegram_file(user_id, diff_file,
        caption=f'Diff задачи #{task_id}: {title}')

    # 10. Аудит + кнопки
    pr_line = f'\n<a href="{pr_url}">GitHub PR</a>' if pr_url else ''
    report = (
        f'<b>Аудит задачи #{task_id}: {title}</b>{pr_line}\n\n'
        f'<b>BIBLE:</b>\n{audit}\n\n'
        f'<b>Изменения:</b>\n<code>{stat or "нет"}</code>\n\n'
        f'/deploy_{task_id} — задеплоить\n/revert_{task_id} — отменить'
    )
    await send_telegram(user_id, report)
    log.info(f'Задача #{task_id} ждёт одобрения')


def _mark_subtasks_done(project_name: str, task_id: int):
    path = f'/opt/{project_name}/PROJECT.json'
    if not os.path.exists(path):
        return
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        task_key = f'T{task_id:03d}'
        for t in data.get('tasks', []):
            if t['id'] == task_key:
                t['status'] = 'audit'
                for st in t.get('subtasks', []):
                    st['status'] = 'done'
                    st['date_completed'] = str(date.today())
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        log.warning(f'_mark_subtasks_done: {e}')


async def deploy_task(task_id: int, user_id: int):
    """ЭТАП 2: мёрдж ветки в main после одобрения Кенана."""
    with get_db() as db:
        cur = db.cursor()
        cur.execute('SELECT * FROM claudia_tasks WHERE id=%s', (task_id,))
        task = cur.fetchone()
    if not task or task['status'] != 'audit':
        await send_telegram(user_id, f'Задача #{task_id} не найдена или не в статусе аудита.')
        return

    task = dict(task)
    proj     = task.get('project_name') or 'chesscoin'
    title    = task.get('title', f'Задача #{task_id}')
    work_dir = f'/opt/{proj}'
    branch   = task.get('branch') or f'task-{task_id}'

    await send_telegram(user_id, f'Деплой задачи #{task_id}...')

    ok, sha = git_merge_to_main(work_dir, branch)
    if ok:
        set_task_status(task_id, 'done', task.get('aider_result', ''))
        _update_project_done(proj, task_id, title)
        pr_url = task.get('pr_url') or ''
        pr_line = f'\n{pr_url}' if pr_url else ''
        await send_telegram(user_id,
            f'Кенан, задача #{task_id} в main!\n'
            f'SHA: <code>{sha}</code>{pr_line}\n\n'
            f'Сайт: https://chesscoin.app')
    else:
        await send_telegram(user_id, f'Мёрдж не удался:\n{sha}')


def _update_project_done(project_name: str, task_id: int, title: str):
    path = f'/opt/{project_name}/PROJECT.json'
    if not os.path.exists(path):
        return
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        task_key = f'T{task_id:03d}'
        for t in data.get('tasks', []):
            if t['id'] == task_key:
                t['status'] = 'done'
                t['date_completed'] = str(date.today())
        data.setdefault('log', []).append({
            "date": str(date.today()),
            "author": "Клаудиа",
            "event": f"Задача #{task_id} задеплоена: {title}"
        })
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        log.warning(f'_update_project_done: {e}')


async def main():
    task = get_pending_task()
    if not task:
        log.info('Нет задач в очереди')
        return
    await process_task(dict(task))


if __name__ == '__main__':
    asyncio.run(main())
