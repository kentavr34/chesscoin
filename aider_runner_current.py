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

# ── VersionManager ─────────────────────────────────────────────────────────────
sys.path.insert(0, '/root/claudia')
try:
    from version_manager import VersionManager, get_version_manager
    _VM_AVAILABLE = True
except ImportError:
    _VM_AVAILABLE = False
    log.warning('version_manager не найден — версионирование отключено')


def _vm_snapshot(proj: str, reason: str) -> str:
    """Снимок перед задачей. Возвращает имя снимка или ''."""
    if not _VM_AVAILABLE:
        return ''
    try:
        vm = VersionManager(f'/opt/{proj}') if proj != 'claudia' else VersionManager('/root/claudia')
        return vm.snapshot(reason)
    except Exception as e:
        log.warning(f'snapshot: {e}')
        return ''


def _vm_release(proj: str, task_id: int, title: str) -> str:
    """Выпускает новую версию после успешного деплоя."""
    if not _VM_AVAILABLE:
        return ''
    try:
        path = f'/opt/{proj}' if proj != 'claudia' else '/root/claudia'
        vm = VersionManager(path)
        cur = vm.current_version()
        # Автобамп патча: 7.2.0 → 7.2.1
        parts = cur.split('.')
        parts[-1] = str(int(parts[-1]) + 1)
        new_ver = '.'.join(parts)
        vm.release(new_ver, f'task-{task_id}: {title[:60]}', task_id=task_id)
        return new_ver
    except Exception as e:
        log.warning(f'vm_release: {e}')
        return ''

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
    prompt = (
        "ВАЖНО: Перед любыми изменениями — сначала прочитай актуальные логи ошибок:\n"
        "  1. deploy/logs/error.log (или docker logs)\n"
        "  2. Релевантные исходные файлы\n"
        "  3. Только потом вноси минимально необходимые изменения\n\n"
    )
    prompt += task['description']
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
    """Создаёт новую ветку от main. Грязное дерево — коммитит автоматически."""
    try:
        # Коммитим незакоммиченные изменения чтобы checkout main прошёл
        dirty = subprocess.run(['git', 'status', '--porcelain'], cwd=work_dir,
                               capture_output=True, text=True, timeout=15)
        if dirty.stdout.strip():
            subprocess.run(['git', 'add', '-A'], cwd=work_dir, capture_output=True, timeout=15)
            subprocess.run(['git', 'commit', '-m', 'chore: авто-коммит перед новой задачей'],
                           cwd=work_dir, capture_output=True, timeout=15)
            log.info(f'git_create_branch: авто-коммит незакоммиченных изменений')

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


def classify_task_complexity(title: str, description: str, stages: list) -> str:
    """Определяет сложность задачи: simple → Aider, complex → Claude Code.

    complex: новый компонент/модуль, рефакторинг архитектуры, 5+ файлов,
             интеграция с API, работа с БД-схемой.
    simple:  баг-фикс, стили, мелкие правки 1-3 файлов.
    """
    text = f"{title} {description} {' '.join(stages)}".lower()
    complex_signals = [
        'архитектур', 'рефактор', 'новый компонент', 'новый модуль', 'интеграц',
        'схем', 'миграц', 'система', 'полностью переписать', 'create new',
        'new feature', 'новая фича', 'новый экран', 'новая страниц',
    ]
    stages_count = len(stages) if stages else 0
    if stages_count >= 5 or any(s in text for s in complex_signals):
        return 'complex'
    return 'simple'


def run_aider(prompt: str, work_dir: str) -> tuple[bool, str]:
    """Воркер 1: Aider + DeepSeek. Быстро, дёшево. Для простых задач."""
    bible = os.path.join(work_dir, 'BIBLE.md')
    cmd = [
        '/usr/local/bin/aider',
        '--model', 'openrouter/deepseek/deepseek-v3.2',
        '--message', prompt,
        '--yes',
        '--no-auto-commits',
        '--stream',
    ]
    # Передаём BIBLE.md как read-only контекст (правила дизайна)
    if os.path.exists(bible):
        cmd += ['--read', bible]
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


def run_claude_code(prompt: str, work_dir: str) -> tuple[bool, str]:
    """Воркер 2: Claude Code CLI. Умнее, для сложных задач и архитектуры."""
    env = os.environ.copy()
    env['ANTHROPIC_API_KEY'] = ANT_DIRECT

    cmd = [
        '/usr/bin/claude',
        '-p', prompt,
        '--output-format', 'text',
        '--allowedTools', 'Edit,Write,Read,Bash,Glob,Grep',
        '--no-interactive',
    ]
    try:
        result = subprocess.run(
            cmd, cwd=work_dir, capture_output=True, text=True, timeout=900, env=env
        )
        output = (result.stdout or '')[-3000:]
        if result.returncode == 0 and output.strip():
            return True, output
        err = (result.stderr or '')[-1000:]
        # Fallback на Aider если Claude Code не справился
        log.warning(f'Claude Code вернул {result.returncode}, fallback → Aider')
        return run_aider(prompt, work_dir)
    except subprocess.TimeoutExpired:
        log.warning('Claude Code: таймаут 15 мин, fallback → Aider')
        return run_aider(prompt, work_dir)
    except Exception as e:
        log.warning(f'Claude Code: {e}, fallback → Aider')
        return run_aider(prompt, work_dir)


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

    # 0. Снимок до изменений
    snap_name = _vm_snapshot(proj, f'before task-{task_id}: {title[:50]}')
    if snap_name:
        log.info(f'Снимок создан: {snap_name}')

    # 1. Создаём ветку
    ok, msg = git_create_branch(work_dir, branch)
    if not ok:
        set_task_status(task_id, 'failed', msg)
        await send_telegram(user_id, f'Не могу создать ветку: {msg}')
        return

    # 2. Выбираем воркер по сложности задачи
    stages = task.get('stages') or []
    if isinstance(stages, str):
        import json as _j
        try: stages = _j.loads(stages)
        except: stages = []
    complexity = classify_task_complexity(title, task.get('description', ''), stages)
    worker_name = 'Claude Code' if complexity == 'complex' else 'Aider'
    log.info(f'Задача #{task_id}: сложность={complexity}, воркер={worker_name}')
    # Одно сообщение — сразу с воркером
    await send_telegram(user_id,
        f'Кенан, начинаю задачу #{task_id}: <b>{title}</b>\n'
        f'Воркер: <b>{worker_name}</b> — это займёт несколько минут...'
    )

    prompt = build_aider_prompt(task)
    if complexity == 'complex':
        ok, out = run_claude_code(prompt, work_dir)
    else:
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

    # 9. Живой summary что сделал аидер (через DeepSeek)
    import re as _re
    applied_files = _re.findall(r'Applied edit to (.+)', out)
    files_list = '\n'.join(f'  • {f}' for f in applied_files) if applied_files else '  (не определены)'

    work_summary = ''
    if full_diff and DS_KEY:
        try:
            summary_prompt = (
                f"Задача: {title}\n"
                f"Изменённые файлы:\n{files_list}\n\n"
                f"Diff:\n{full_diff[:3000]}\n\n"
                "Напиши 3-5 пунктов что конкретно исправлено/добавлено. "
                "Стиль: деловой, каждый пункт с эмодзи и глаголом действия. "
                "Только пункты без вступления."
            )
            resp = httpx.post(
                'https://api.deepseek.com/v1/chat/completions',
                headers={'Authorization': f'Bearer {DS_KEY}', 'Content-Type': 'application/json'},
                json={
                    'model': 'deepseek-chat',
                    'messages': [{'role': 'user', 'content': summary_prompt}],
                    'max_tokens': 300, 'temperature': 0.3,
                },
                timeout=15,
            )
            if resp.status_code == 200:
                work_summary = resp.json()['choices'][0]['message']['content'].strip()
        except Exception as e:
            log.warning(f'work_summary: {e}')

    # 10. Форматируем финальный отчёт
    if 'ПРИНЯТО' in audit:
        bible_icon = '✅'
    elif 'ЗАМЕЧАНИЯ' in audit:
        bible_icon = '⚠️'
    else:
        bible_icon = '🔴'

    pr_line = f'\n🔗 <a href="{pr_url}">GitHub PR</a>' if pr_url else ''
    proj_label = f'[{proj}] ' if proj else ''
    diff_lines = len((full_diff or '').splitlines())

    report = (
        f'<b>📋 Отчёт: {proj_label}{title}</b>\n'
        f'<b>Задача #{task_id}</b> · воркер: {worker_name}{pr_line}\n\n'
        f'<b>Изменённые файлы:</b>\n{files_list}\n\n'
    )
    if work_summary:
        report += f'<b>Что сделано:</b>\n{work_summary}\n\n'
    report += (
        f'{bible_icon} <b>BIBLE-аудит:</b>\n{audit}\n\n'
        f'<b>Diff:</b> <code>{stat or "нет изменений"}</code>\n\n'
        f'<b>Ваше решение:</b>\n'
        f'✅ /deploy_{task_id} — всё ок, деплоить\n'
        f'🔄 /revert_{task_id} — откатить и переделать'
    )

    # Отправляем diff файл + отчёт
    await send_telegram_file(user_id, diff_file,
        caption=f'📄 Diff задачи #{task_id}: {title} ({diff_lines} строк)')
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


def docker_build_and_check(work_dir: str, proj: str) -> tuple[bool, str]:
    """Билдит docker-compose и возвращает (успех, логи)."""
    log.info('Docker build...')
    r = subprocess.run(
        ['docker', 'compose', 'build', '--no-cache'],
        cwd=work_dir, capture_output=True, text=True, timeout=300
    )
    build_out = (r.stdout + r.stderr)[-3000:]
    if r.returncode != 0:
        return False, build_out

    log.info('Docker up...')
    r2 = subprocess.run(
        ['docker', 'compose', 'up', '-d'],
        cwd=work_dir, capture_output=True, text=True, timeout=120
    )
    if r2.returncode != 0:
        return False, (r2.stdout + r2.stderr)[-2000:]

    # Ждём 15 сек и проверяем логи контейнеров на ошибки
    import time
    time.sleep(15)
    r3 = subprocess.run(
        ['docker', 'compose', 'logs', '--tail=50'],
        cwd=work_dir, capture_output=True, text=True, timeout=30
    )
    logs = r3.stdout[-3000:]
    error_signals = ['error', 'Error', 'ERROR', 'FATAL', 'failed', 'Cannot find module',
                     'SyntaxError', 'TypeError', 'exited with code 1']
    has_error = any(sig in logs for sig in error_signals)
    if has_error:
        return False, logs
    return True, logs


def diagnose_build_error(error_logs: str, diff_text: str, title: str) -> str:
    """DeepSeek анализирует ошибку билда и говорит что исправить."""
    prompt = (
        f"Задача: {title}\n\n"
        f"Ошибки билда/контейнера:\n{error_logs[:2000]}\n\n"
        f"Изменения которые вызвали ошибку (diff):\n{diff_text[:2000]}\n\n"
        "Напиши КОНКРЕТНЫЕ инструкции для исправления — какие файлы изменить и что именно. "
        "Формат: список действий с указанием файлов. Только суть, без воды."
    )
    try:
        resp = httpx.post(
            'https://api.deepseek.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {DS_KEY}', 'Content-Type': 'application/json'},
            json={
                'model': 'deepseek-chat',
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 500, 'temperature': 0.1,
            },
            timeout=20,
        )
        if resp.status_code == 200:
            return resp.json()['choices'][0]['message']['content'].strip()
    except Exception as e:
        log.warning(f'diagnose_build_error: {e}')
    return ''


async def deploy_task(task_id: int, user_id: int):
    """
    ЭТАП 2: мёрдж → билд → проверка логов → авто-фикс если ошибки → уведомление.
    Кенан получает сообщение ТОЛЬКО после успешного деплоя.
    """
    with get_db() as db:
        cur = db.cursor()
        cur.execute('SELECT * FROM claudia_tasks WHERE id=%s', (task_id,))
        task = cur.fetchone()
    if not task or task['status'] != 'audit':
        await send_telegram(user_id, f'Задача #{task_id} не найдена или не в статусе аудита.')
        return

    task     = dict(task)
    proj     = task.get('project_name') or 'chesscoin'
    title    = task.get('title', f'Задача #{task_id}')
    work_dir = f'/opt/{proj}'
    branch   = task.get('branch') or f'task-{task_id}'

    # Тихо уведомляем что начали (без лишних деталей)
    await send_telegram(user_id,
        f'Деплой задачи #{task_id} — собираю и проверяю...'
    )

    # 1. Мёрдж в main
    ok, sha = git_merge_to_main(work_dir, branch)
    if not ok:
        await send_telegram(user_id,
            f'Мёрдж не удался — исправляю...\n<code>{sha[:300]}</code>'
        )
        # Попытка исправить конфликт: сбрасываем мёрдж и применяем через rebase
        subprocess.run(['git', 'merge', '--abort'], cwd=work_dir, capture_output=True)
        r = subprocess.run(
            ['git', 'rebase', 'origin/main', branch],
            cwd=work_dir, capture_output=True, text=True
        )
        if r.returncode != 0:
            subprocess.run(['git', 'rebase', '--abort'], cwd=work_dir, capture_output=True)
            set_task_status(task_id, 'failed', sha)
            await send_telegram(user_id,
                f'Задача #{task_id}: конфликт мёрджа не удалось разрешить.\n'
                f'Нужно ручное вмешательство.\n<code>{r.stderr[-500:]}</code>'
            )
            return
        ok, sha = git_merge_to_main(work_dir, branch)
        if not ok:
            set_task_status(task_id, 'failed', sha)
            await send_telegram(user_id, f'Мёрдж не удался после rebase:\n<code>{sha}</code>')
            return

    # 2. Билд + запуск + проверка логов (до 3 попыток авто-фикса)
    MAX_FIX_ATTEMPTS = 3
    build_ok = False
    last_logs = ''

    # Читаем текущий diff для диагностики
    full_diff, _ = git_get_diff(work_dir)

    for attempt in range(1, MAX_FIX_ATTEMPTS + 1):
        build_ok, last_logs = docker_build_and_check(work_dir, proj)
        if build_ok:
            log.info(f'Задача #{task_id}: билд успешен (попытка {attempt})')
            break

        log.warning(f'Задача #{task_id}: ошибка билда (попытка {attempt}/{MAX_FIX_ATTEMPTS})')

        if attempt == MAX_FIX_ATTEMPTS:
            break

        # Диагностика и авто-фикс
        fix_prompt = diagnose_build_error(last_logs, full_diff or '', title)
        if not fix_prompt:
            break

        log.info(f'Авто-фикс попытка {attempt}: {fix_prompt[:100]}')
        fix_ok, fix_out = run_aider(
            f"СРОЧНЫЙ ФИКС после неудачного билда.\n\n"
            f"Ошибки:\n{last_logs[:1500]}\n\n"
            f"Что исправить:\n{fix_prompt}",
            work_dir
        )
        if fix_ok:
            subprocess.run(['git', 'add', '-A'], cwd=work_dir, capture_output=True)
            subprocess.run(
                ['git', 'commit', '-m', f'fix: авто-фикс билда задача #{task_id} попытка {attempt}'],
                cwd=work_dir, capture_output=True
            )
            # Обновляем diff после фикса
            full_diff, _ = git_get_diff(work_dir)

    # 3. Результат
    if not build_ok:
        set_task_status(task_id, 'failed', last_logs)
        await send_telegram(user_id,
            f'Задача #{task_id}: {MAX_FIX_ATTEMPTS} попытки исправить ошибки билда — не получилось.\n\n'
            f'<b>Ошибки:</b>\n<code>{last_logs[-800:]}</code>\n\n'
            f'Нужен твой взгляд, Кенан.'
        )
        return

    # 4. Успех — обновляем статус и уведомляем
    set_task_status(task_id, 'done', task.get('aider_result', ''))
    _update_project_done(proj, task_id, title)

    # Новая версия проекта
    new_ver = _vm_release(proj, task_id, title)
    ver_line = f'\n📦 Версия: <b>v{new_ver}</b>' if new_ver else ''

    pr_url   = task.get('pr_url') or ''
    pr_line  = f'\n🔗 <a href="{pr_url}">PR</a>' if pr_url else ''

    await send_telegram(user_id,
        f'Кенан, задача #{task_id} задеплоена.\n\n'
        f'<b>{title}</b>{pr_line}{ver_line}\n\n'
        f'SHA: <code>{sha[:10]}</code>\n'
        f'Сайт: https://chesscoin.app'
    )


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
