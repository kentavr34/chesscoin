"""
Claudia Bot v3.0 — упрощённая машина состояний
3 состояния: idle → collecting → confirming
"""
import asyncio
import logging
import os
import sys
import json
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from telegram import Update, BotCommand
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    filters, ContextTypes
)

load_dotenv('/root/claudia/.env')
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
log = logging.getLogger(__name__)

# ── Состояния ─────────────────────────────────────────────────────────────────
IDLE       = 'idle'
COLLECTING = 'collecting'
CONFIRMING = 'confirming'

# ── Конфиг ────────────────────────────────────────────────────────────────────
BOT_TOKEN      = os.getenv('TELEGRAM_BOT_TOKEN')
OR_KEY         = os.getenv('ANTHROPIC_API_KEY', '')       # OpenRouter
ANT_DIRECT     = os.getenv('ANTHROPIC_API_KEY_DIRECT', '') # прямой Anthropic
DS_KEY         = os.getenv('DEEPSEEK_API_KEY', '')
ELEVENLABS_KEY = os.getenv('ELEVENLABS_API_KEY', '')
ELEVENLABS_VID = os.getenv('ELEVENLABS_VOICE_ID', '')
GROQ_KEY       = os.getenv('GROQ_API_KEY', '')
LIGHTRAG_URL   = os.getenv('LIGHTRAG_URL', 'http://localhost:9622')
LIGHTRAG_KEY   = os.getenv('LIGHTRAG_API_KEY', '')

CLAUDIA_SYSTEM = """Ты — Клаудиа, автономный AI-менеджер проекта ChessCoin.
Владелец и руководитель — КЕНАН. Всегда обращайся по имени.
Говоришь ТОЛЬКО по-русски. Ответы короткие, деловые — 2-3 предложения.
Не льстишь, не извиняешься без причины. Если непонятно — задаёшь один уточняющий вопрос.

ПРОЕКТ ChessCoin:
- Telegram Mini App: шахматы на монеты, батлы, турниры, ELO рейтинг
- Стек: React + TypeScript (Vite), Node.js, PostgreSQL, Redis, Docker
- Сервер: eVPS 185.203.116.131, деплой через git + Docker Compose
- Дизайн: тёмная тема #0D0D12, золото #D4A843, шрифт Inter, SVG иконки
- Главные правила: не упрощать компоненты, только CSS media queries

ТВОИ ИНСТРУМЕНТЫ:
- /chesscoin — принять задачу по ChessCoin
- /ok — отправить материалы на анализ Совету директоров (AI)
- /status — статус задач
- /rag — запрос в память проектов (LightRAG)

ПРОЦЕСС:
1. Кенан пишет /chesscoin → отправляет материалы (текст/голос/фото)
2. /ok → Совет директоров AI анализирует → список этапов
3. /ok → задача уходит в работу к Аидеру (AI-разработчик)
4. Аидер делает → присылает diff файл на проверку
5. /deploy_N → изменения попадают на сайт

Если Кенан описывает задачу или проблему — предложи /chesscoin.
Если просто разговор — отвечай кратко по теме."""


# ── БД ────────────────────────────────────────────────────────────────────────
def get_db():
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        port=int(os.getenv('POSTGRES_PORT', 5432)),
        dbname=os.getenv('POSTGRES_DB', 'claudia'),
        user=os.getenv('POSTGRES_USER', 'claudia'),
        password=os.getenv('POSTGRES_PASSWORD'),
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def get_session(user_id: int) -> dict:
    with get_db() as db:
        cur = db.cursor()
        cur.execute('SELECT * FROM user_sessions WHERE user_id=%s', (user_id,))
        row = cur.fetchone()
        if row:
            return dict(row)
        cur.execute(
            "INSERT INTO user_sessions(user_id,state) VALUES(%s,'idle') RETURNING *",
            (user_id,)
        )
        db.commit()
        return dict(cur.fetchone())


def set_session(user_id: int, **kwargs):
    keys = list(kwargs.keys())
    vals = []
    for k, v in kwargs.items():
        if k == 'extra' and isinstance(v, dict):
            vals.append(psycopg2.extras.Json(v))
        else:
            vals.append(v)
    fields = ', '.join(f"{k}=%s" for k in keys)
    vals.append(user_id)
    with get_db() as db:
        cur = db.cursor()
        cur.execute(
            f"UPDATE user_sessions SET {fields}, updated_at=NOW() WHERE user_id=%s", vals
        )
        db.commit()


def add_buffer(user_id: int, item_type: str, content: str):
    with get_db() as db:
        cur = db.cursor()
        cur.execute(
            "INSERT INTO task_buffer(user_id,item_type,content) VALUES(%s,%s,%s)",
            (user_id, item_type, content)
        )
        db.commit()


def get_buffer(user_id: int) -> list:
    with get_db() as db:
        cur = db.cursor()
        cur.execute(
            "SELECT item_type, content FROM task_buffer WHERE user_id=%s ORDER BY created_at",
            (user_id,)
        )
        return [dict(r) for r in cur.fetchall()]


def save_conversation(user_id: int, role: str, content: str, project: str = 'claudia'):
    """Сохраняет сообщение в историю разговоров."""
    try:
        with get_db() as db:
            cur = db.cursor()
            cur.execute(
                "INSERT INTO conversations(user_id, project, role, content) VALUES(%s,%s,%s,%s)",
                (user_id, project, role, content[:4000])
            )
            db.commit()
    except Exception as e:
        log.warning(f'save_conversation: {e}')


def search_conversations(user_id: int, query: str, limit: int = 10) -> list:
    """Ищет в истории разговоров по ключевым словам."""
    try:
        words = [w for w in query.lower().split() if len(w) > 3]
        if not words:
            return []
        conditions = ' OR '.join(["LOWER(content) LIKE %s"] * len(words))
        params = [f'%{w}%' for w in words] + [user_id, limit]
        with get_db() as db:
            cur = db.cursor()
            cur.execute(
                f"""SELECT role, content, created_at FROM conversations
                    WHERE ({conditions}) AND user_id=%s
                    ORDER BY created_at DESC LIMIT %s""",
                params
            )
            return [dict(r) for r in cur.fetchall()]
    except Exception as e:
        log.warning(f'search_conversations: {e}')
        return []


def clear_buffer(user_id: int):
    with get_db() as db:
        cur = db.cursor()
        cur.execute("DELETE FROM task_buffer WHERE user_id=%s", (user_id,))
        db.commit()


def save_task(user_id: int, title: str, description: str, stages: list,
              report_format: str, project_name: str = None) -> int:
    with get_db() as db:
        cur = db.cursor()
        cur.execute(
            """INSERT INTO claudia_tasks(user_id,title,description,stages,report_format,project_name,status)
               VALUES(%s,%s,%s,%s,%s,%s,'pending') RETURNING id""",
            (user_id, title, description,
             psycopg2.extras.Json(stages), report_format, project_name)
        )
        db.commit()
        return cur.fetchone()['id']


def update_project_json(project_name: str, task_id: int, title: str,
                        description: str, stages: list):
    from datetime import date
    path = f'/opt/{project_name}/PROJECT.json'
    if not os.path.exists(path):
        return
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        subtasks = [
            {"id": f"T{task_id:03d}.{i+1}", "title": s.lstrip('0123456789. '),
             "status": "pending", "assignee": "claudia-agent",
             "date_start": str(date.today()), "date_completed": None}
            for i, s in enumerate(stages)
        ]
        data.setdefault('tasks', []).append({
            "id": f"T{task_id:03d}", "title": title, "goal": description,
            "status": "pending", "priority": "medium", "assignee": "claudia-agent",
            "date_start": str(date.today()), "subtasks": subtasks
        })
        data.setdefault('log', []).append({
            "date": str(date.today()), "author": "Клаудиа",
            "event": f"Задача #{task_id} добавлена: {title}"
        })
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        log.info(f'PROJECT.json обновлён: #{task_id}')
    except Exception as e:
        log.warning(f'PROJECT.json ошибка: {e}')


# ── ASR + TTS ─────────────────────────────────────────────────────────────────
async def transcribe_audio(ogg_bytes: bytes) -> str:
    """ASR: Groq Whisper (быстро, бесплатно)."""
    import aiohttp
    try:
        form = aiohttp.FormData()
        form.add_field('file', ogg_bytes, filename='audio.ogg', content_type='audio/ogg')
        form.add_field('model', 'whisper-large-v3')
        form.add_field('language', 'ru')
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                'https://api.groq.com/openai/v1/audio/transcriptions',
                headers={'Authorization': f'Bearer {GROQ_KEY}'},
                data=form,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as r:
                if r.status == 200:
                    data = await r.json()
                    return data.get('text', '')
                else:
                    log.warning(f'Groq ASR {r.status}: {await r.text()}')
    except Exception as e:
        log.warning(f'ASR Groq: {e}')
    return ''


async def text_to_speech(text: str) -> bytes | None:
    import aiohttp
    if not ELEVENLABS_KEY or not ELEVENLABS_VID:
        return None
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                f'https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VID}',
                headers={'xi-api-key': ELEVENLABS_KEY, 'Content-Type': 'application/json'},
                json={
                    'text': text,
                    'model_id': 'eleven_multilingual_v2',
                    'voice_settings': {'stability': 0.5, 'similarity_boost': 0.8,
                                       'style': 0.2, 'speaking_rate': 1.15}
                },
                timeout=aiohttp.ClientTimeout(total=20)
            ) as r:
                if r.status == 200:
                    return await r.read()
    except Exception as e:
        log.warning(f'TTS: {e}')
    return None


def safe_html(text: str) -> str:
    """Экранирует HTML символы кроме разрешённых тегов Telegram."""
    import re
    # Разрешённые теги Telegram: <b>, <i>, <code>, <pre>, <a>
    # Экранируем & < > которые не часть этих тегов
    allowed = re.compile(r'<(/?(b|i|code|pre|a)(\s[^>]*)?)>', re.IGNORECASE)
    parts = allowed.split(text)
    result = []
    for i, part in enumerate(allowed.split(text)):
        if allowed.match(part) or (part in ('b','i','code','pre','a','/b','/i','/code','/pre','/a')):
            result.append(part)
        else:
            result.append(part.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))
    # Проще: просто убираем parse_mode если текст содержит проблемные символы
    return text


async def send_reply(update: Update, text: str):
    """Отправляет текст + голос если текст короткий."""
    import html
    # Используем HTML только если текст содержит наши теги, иначе plain text
    if '<b>' in text or '<i>' in text or '<code>' in text or '<a href' in text:
        try:
            await update.message.reply_text(text, parse_mode='HTML')
        except Exception:
            # Fallback: убираем теги и отправляем plain
            clean = text.replace('<b>', '').replace('</b>', '').replace(
                '<i>', '').replace('</i>', '').replace('<code>', '').replace('</code>', '')
            await update.message.reply_text(clean)
    else:
        await update.message.reply_text(text)
    if len(text) <= 400:
        asyncio.create_task(_send_voice(update, text))


async def _send_voice(update: Update, text: str):
    mp3 = await text_to_speech(text)
    if mp3:
        await update.message.reply_voice(voice=mp3)


# ── LLM: Claude через OpenRouter / Anthropic direct ──────────────────────────
async def ask_claude(text: str, context: str = '') -> str:
    import aiohttp
    system = CLAUDIA_SYSTEM
    if context:
        system += f'\n\nКонтекст проекта:\n{context}'

    # Пробуем OpenRouter Claude
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                'https://openrouter.ai/api/v1/chat/completions',
                headers={'Authorization': f'Bearer {OR_KEY}', 'Content-Type': 'application/json'},
                json={
                    'model': 'anthropic/claude-haiku-4-5',
                    'messages': [
                        {'role': 'system', 'content': system},
                        {'role': 'user', 'content': text},
                    ],
                    'max_tokens': 300,
                },
                timeout=aiohttp.ClientTimeout(total=20)
            ) as r:
                if r.status == 200:
                    data = await r.json()
                    return data['choices'][0]['message']['content'].strip()
    except Exception as e:
        log.warning(f'Claude OR: {e}')

    # Fallback: Anthropic direct
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                'https://api.anthropic.com/v1/messages',
                headers={
                    'x-api-key': ANT_DIRECT,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                },
                json={
                    'model': 'claude-haiku-4-5-20251001',
                    'max_tokens': 300,
                    'system': system,
                    'messages': [{'role': 'user', 'content': text}],
                },
                timeout=aiohttp.ClientTimeout(total=20)
            ) as r:
                if r.status == 200:
                    data = await r.json()
                    return data['content'][0]['text'].strip()
    except Exception as e:
        log.warning(f'Claude direct: {e}')

    return 'Не могу ответить прямо сейчас. Попробуй чуть позже.'


# ── LightRAG ──────────────────────────────────────────────────────────────────
async def rag_query(question: str) -> str:
    import aiohttp
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                f'{LIGHTRAG_URL}/query',
                json={'query': question, 'mode': 'hybrid'},
                headers={'Authorization': f'Bearer {LIGHTRAG_KEY}'},
                timeout=aiohttp.ClientTimeout(total=20)
            ) as r:
                data = await r.json()
                return data.get('response', '')
    except Exception as e:
        log.warning(f'LightRAG query: {e}')
    return ''


async def rag_save(text: str):
    """Сохраняет текст в LightRAG асинхронно (fire-and-forget)."""
    import aiohttp
    try:
        async with aiohttp.ClientSession() as sess:
            await sess.post(
                f'{LIGHTRAG_URL}/documents/text',
                headers={'Authorization': f'Bearer {LIGHTRAG_KEY}', 'Content-Type': 'application/json'},
                json={'text': text},
                timeout=aiohttp.ClientTimeout(total=10)
            )
    except Exception as e:
        log.warning(f'LightRAG save: {e}')


# ── Crew Board (Совет директоров) ─────────────────────────────────────────────
async def analyze_task_buffer(user_id: int, project_name: str = None) -> str:
    sys.path.insert(0, '/root/claudia')
    from crew_board import run_board
    items = get_buffer(user_id)
    if not items:
        return ''
    description = '\n'.join(
        f"[{i['item_type'].upper()}] {i['content']}" for i in items
    )
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, run_board, description, project_name)
    return result or ''


def parse_board_result(text: str) -> dict:
    """Парсит результат Совета директоров."""
    title = desc = ''
    stages = []
    fmt = 'text'
    lines = text.split('\n')
    section = None
    for line in lines:
        l = line.strip()
        if l.upper().startswith('ЗАДАЧА:'):
            title = l[7:].strip()
        elif l.upper().startswith('ОПИСАНИЕ:'):
            desc = l[9:].strip()
            section = 'desc'
        elif l.upper().startswith('ЭТАПЫ:'):
            section = 'stages'
        elif l.upper().startswith('ФОРМАТ:'):
            fmt = l[7:].strip().lower()
        elif section == 'desc' and l and not any(
            l.upper().startswith(k) for k in ('ЭТАПЫ:', 'ФОРМАТ:', 'ЗАДАЧА:')
        ):
            desc += ' ' + l
        elif section == 'stages' and l and (l[0].isdigit() or l.startswith('-')):
            stages.append(l.lstrip('0123456789.-) ').strip())

    if not title:
        title = 'Задача'
    if not desc:
        desc = text[:200]
    return {'title': title, 'description': desc.strip(), 'stages': stages, 'format': fmt}


# ── Команды ───────────────────────────────────────────────────────────────────
async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await send_reply(update,
        'Привет, Кенан! Я Клаудиа.\n\n'
        'Просто напиши что нужно сделать — я пойму.\n'
        'Или используй команды:\n\n'
        '/chesscoin — задача для проекта\n'
        '/status — что сейчас в работе\n'
        '/cancel — сбросить\n\n'
        'Отправляй текст, голос, фото, файлы.'
    )


async def cmd_chesscoin(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    clear_buffer(user_id)
    set_session(user_id, state=COLLECTING, project_name='chesscoin')
    await send_reply(update,
        'Готова, Кенан. Отправляй материалы для задачи — текст, голос, скриншоты. '
        'Когда всё отправил — /ok'
    )


async def cmd_task(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    clear_buffer(user_id)
    set_session(user_id, state=COLLECTING, project_name=None)
    await send_reply(update, 'Собираю задачу. Отправляй материалы → /ok')


async def cmd_ok(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    session = get_session(user_id)
    state   = session.get('state', IDLE)
    proj    = session.get('project_name')

    if state == COLLECTING:
        items = get_buffer(user_id)
        if not items:
            await update.message.reply_text('Буфер пустой — отправь материалы сначала.')
            return
        await send_reply(update, 'Анализирую задачу... (несколько секунд)')
        result = await analyze_task_buffer(user_id, project_name=proj)
        if not result:
            await send_reply(update, 'Не смог проанализировать. Попробуй снова.')
            return
        parsed = parse_board_result(result)
        set_session(user_id, state=CONFIRMING,
                    extra={'parsed': parsed, 'project_name': proj})
        stages_text = '\n'.join(f'{i+1}. {s}' for i, s in enumerate(parsed['stages'])) \
                      if parsed['stages'] else '—'
        await send_reply(update,
            f"Задача готова:\n\n"
            f"<b>{parsed['title']}</b>\n"
            f"{parsed['description']}\n\n"
            f"<b>Этапы:</b>\n{stages_text}\n\n"
            f"/ok — запустить · /cancel — отменить"
        )

    elif state == CONFIRMING:
        extra  = session.get('extra') or {}
        parsed = extra.get('parsed', {})
        proj   = extra.get('project_name') or proj
        task_id = save_task(
            user_id,
            title=parsed.get('title', 'Задача'),
            description=parsed.get('description', ''),
            stages=parsed.get('stages', []),
            report_format=parsed.get('format', 'text'),
            project_name=proj,
        )
        if proj:
            update_project_json(proj, task_id, parsed['title'],
                                parsed['description'], parsed['stages'])
        clear_buffer(user_id)
        set_session(user_id, state=IDLE, project_name=None, extra={})
        await send_reply(update,
            f'Задача #{task_id} создана и поставлена в очередь. '
            f'Как только Аидер начнёт — пришлю уведомление.'
        )
    else:
        await update.message.reply_text('Нечего подтверждать. Начни с /chesscoin')


async def cmd_cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    clear_buffer(user_id)
    set_session(user_id, state=IDLE, project_name=None, extra={})
    await send_reply(update, 'Отменено. Жду следующей задачи.')


async def cmd_status(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    session = get_session(user_id)
    buf     = get_buffer(user_id)
    labels  = {IDLE: '⚪ Ожидание', COLLECTING: '🟡 Сбор материалов',
               CONFIRMING: '🟠 Подтверждение задачи'}
    label = labels.get(session['state'], session['state'])

    # Активные задачи из БД
    try:
        with get_db() as db:
            cur = db.cursor()
            cur.execute(
                "SELECT id, title, status FROM claudia_tasks "
                "WHERE user_id=%s AND status NOT IN ('done','cancelled','failed') "
                "ORDER BY created_at DESC LIMIT 5",
                (user_id,)
            )
            tasks = cur.fetchall()
    except Exception:
        tasks = []

    tasks_text = ''
    for t in tasks:
        tasks_text += f"\n  #{t['id']} [{t['status']}] {t['title'][:40]}"

    await update.message.reply_text(
        f"{label}\n"
        f"Проект: {session.get('project_name') or '—'}\n"
        f"Буфер: {len(buf)} элементов"
        f"{tasks_text or ''}"
    )


async def cmd_rag(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    args = ' '.join(ctx.args) if ctx.args else ''
    if not args:
        await update.message.reply_text('Использование: /rag [вопрос]')
        return
    answer = await rag_query(args)
    await send_reply(update, answer or 'Ничего не нашла в памяти.')


async def cmd_deploy(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text = update.message.text or ''
    try:
        task_id = int(text.split('_')[1])
    except Exception:
        await update.message.reply_text('Формат: /deploy_5')
        return
    await update.message.reply_text(f'Запускаю деплой задачи #{task_id}...')
    sys.path.insert(0, '/root/claudia')
    from aider_runner import deploy_task
    asyncio.create_task(deploy_task(task_id, user_id))


async def cmd_revert(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text = update.message.text or ''
    try:
        task_id = int(text.split('_')[1])
    except Exception:
        await update.message.reply_text('Формат: /revert_5')
        return
    import subprocess as sp
    branch = f'task-{task_id}'
    sp.run(['git', 'checkout', 'main'], cwd='/opt/chesscoin', capture_output=True)
    sp.run(['git', 'branch', '-D', branch], cwd='/opt/chesscoin', capture_output=True)
    with get_db() as db:
        cur = db.cursor()
        cur.execute("UPDATE claudia_tasks SET status='cancelled' WHERE id=%s", (task_id,))
        db.commit()
    await send_reply(update, f'Задача #{task_id} отменена.')


# ── Обработчики сообщений ─────────────────────────────────────────────────────
async def handle_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text    = update.message.text or ''
    session = get_session(user_id)
    state   = session.get('state', IDLE)

    # Сохраняем сообщение пользователя
    save_conversation(user_id, 'user', text)

    if state in (COLLECTING, CONFIRMING):
        if state == COLLECTING:
            add_buffer(user_id, 'text', text)
            buf_len = len(get_buffer(user_id))
            await update.message.reply_text(
                f'Добавила [{buf_len}]. Ещё материалы или /ok для анализа.'
            )
        else:
            await update.message.reply_text(
                'Жду твоего решения: /ok для запуска или /cancel для отмены.'
            )
    else:
        # IDLE — умный ответ с памятью
        text_lower = text.lower()
        is_memory_query = any(w in text_lower for w in
            ['помнишь', 'помнить', 'говорили', 'обсуждали', 'договорились',
             'помню', 'раньше', 'прошлый раз', 'в прошлый', 'тогда'])

        context_parts = []

        # 1. Всегда запрашиваем LightRAG
        rag_ctx = await rag_query(text[:300]) if len(text) > 5 else ''
        if rag_ctx:
            context_parts.append(f'Из памяти проектов:\n{rag_ctx[:800]}')

        # 2. Если вопрос о памяти — ищем в PostgreSQL как fallback
        if is_memory_query or not rag_ctx:
            pg_results = search_conversations(user_id, text, limit=5)
            if pg_results:
                hist = '\n'.join(
                    f"[{r['role']}] {r['content'][:150]}" for r in pg_results
                )
                context_parts.append(f'Из истории разговоров:\n{hist}')

        context = '\n\n'.join(context_parts)
        reply = await ask_claude(text, context=context)
        save_conversation(user_id, 'assistant', reply)
        asyncio.create_task(rag_save(
            f'[ДИАЛОГ КЕНАН-КЛАУДИА]\nКЕНАН: {text[:400]}\nКЛАУДИА: {reply[:400]}'
        ))
        await send_reply(update, reply)


async def handle_voice(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    session = get_session(user_id)
    state   = session.get('state', IDLE)

    # Транскрибируем голос
    transcript = ''
    asr_ok = False
    try:
        file = await update.message.voice.get_file()
        data = await file.download_as_bytearray()
        transcript = await transcribe_audio(bytes(data))
        if transcript:
            asr_ok = True
            log.info(f'ASR: {transcript[:80]}')
        else:
            log.warning('ASR: пустой результат')
    except Exception as e:
        log.warning(f'Voice: {e}')

    if state == COLLECTING:
        content = transcript if asr_ok else '[голосовое — не распознано]'
        add_buffer(user_id, 'voice', content)
        if asr_ok:
            save_conversation(user_id, 'user', f'[голос] {transcript}')
        buf_len = len(get_buffer(user_id))
        if asr_ok:
            await update.message.reply_text(
                f'Голосовое принято [{buf_len}]:\n"{transcript[:120]}"\n/ok для анализа.'
            )
        else:
            await update.message.reply_text(
                f'Голосовое добавлено [{buf_len}] (распознавание не удалось). /ok для анализа.'
            )
    elif state == CONFIRMING:
        await update.message.reply_text('/ok — запустить, /cancel — отменить.')
    else:
        if asr_ok:
            save_conversation(user_id, 'user', f'[голос] {transcript}')
            text_lower = transcript.lower()
            is_memory_query = any(w in text_lower for w in
                ['помнишь', 'говорили', 'обсуждали', 'договорились', 'раньше'])
            context_parts = []
            rag_ctx = await rag_query(transcript[:300])
            if rag_ctx:
                context_parts.append(f'Из памяти проектов:\n{rag_ctx[:800]}')
            if is_memory_query or not rag_ctx:
                pg_results = search_conversations(user_id, transcript, limit=5)
                if pg_results:
                    hist = '\n'.join(f"[{r['role']}] {r['content'][:150]}" for r in pg_results)
                    context_parts.append(f'Из истории разговоров:\n{hist}')
            reply = await ask_claude(transcript, context='\n\n'.join(context_parts))
            save_conversation(user_id, 'assistant', reply)
            asyncio.create_task(rag_save(
                f'[ДИАЛОГ ГОЛОС КЕНАН-КЛАУДИА]\nКЕНАН: {transcript[:400]}\nКЛАУДИА: {reply[:400]}'
            ))
            await send_reply(update, reply)
        else:
            await update.message.reply_text(
                'Голосовое не распозналось. Напиши текстом или попробуй ещё раз.'
            )


async def handle_photo(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id  = update.effective_user.id
    session  = get_session(user_id)
    state    = session.get('state', IDLE)
    caption  = update.message.caption or ''
    photo    = update.message.photo[-1]
    content  = f"Скриншот (id={photo.file_id})"
    if caption:
        content += f": {caption}"

    if state == COLLECTING:
        add_buffer(user_id, 'photo', content)
        buf_len = len(get_buffer(user_id))
        await update.message.reply_text(f'Скриншот добавлен [{buf_len}]. /ok когда готово.')
    else:
        await update.message.reply_text(
            'Скриншот получила. Если это задача — напиши /chesscoin, потом отправь снова.'
        )


async def handle_document(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    session = get_session(user_id)
    state   = session.get('state', IDLE)
    doc     = update.message.document
    caption = update.message.caption or ''
    content = f"Файл {doc.file_name}"
    if caption:
        content += f": {caption}"

    if state == COLLECTING:
        add_buffer(user_id, 'file', content)
        buf_len = len(get_buffer(user_id))
        await update.message.reply_text(f'Файл добавлен [{buf_len}]. /ok когда готово.')
    else:
        await update.message.reply_text(
            'Файл получила. Если это для задачи — начни с /chesscoin.'
        )


# ── Error handler ─────────────────────────────────────────────────────────────
async def error_handler(update: object, ctx: ContextTypes.DEFAULT_TYPE):
    from telegram.error import Conflict, NetworkError
    if isinstance(ctx.error, Conflict):
        log.warning('Конфликт polling — другой экземпляр бота')
        return
    if isinstance(ctx.error, NetworkError):
        log.warning(f'Сеть: {ctx.error}')
        return
    log.error(f'Ошибка: {ctx.error}')


async def post_init(app):
    commands = [
        BotCommand('chesscoin', '♟ Задача для ChessCoin'),
        BotCommand('task',      '📋 Задача для любого проекта'),
        BotCommand('ok',        '✅ Подтвердить'),
        BotCommand('cancel',    '❌ Отменить'),
        BotCommand('status',    '📊 Статус'),
        BotCommand('rag',       '🧠 Память проекта'),
        BotCommand('start',     '🤖 Начало'),
    ]
    try:
        await app.bot.set_my_commands(commands)
        log.info('Команды меню установлены')
    except Exception as e:
        log.warning(f'Команды: {e}')


def main():
    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .post_init(post_init)
        .build()
    )

    app.add_error_handler(error_handler)
    app.add_handler(CommandHandler('start',     cmd_start))
    app.add_handler(CommandHandler('chesscoin', cmd_chesscoin))
    app.add_handler(CommandHandler('task',      cmd_task))
    app.add_handler(CommandHandler('ok',        cmd_ok))
    app.add_handler(CommandHandler('cancel',    cmd_cancel))
    app.add_handler(CommandHandler('status',    cmd_status))
    app.add_handler(CommandHandler('rag',       cmd_rag))
    app.add_handler(MessageHandler(filters.Regex(r'^/deploy_\d+$'), cmd_deploy))
    app.add_handler(MessageHandler(filters.Regex(r'^/revert_\d+$'), cmd_revert))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))

    log.info('Claudia Bot v3.0 (polling)')
    app.run_polling()


if __name__ == '__main__':
    main()
