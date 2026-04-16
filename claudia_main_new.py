"""
Claudia Bot — машина состояний v2.0 + Claude API
"""
import asyncio
import base64
import logging
import os
import sys

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    filters, ContextTypes
)

load_dotenv('/root/claudia/.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
log = logging.getLogger(__name__)

IDLE                    = 'idle'
COLLECTING_TASK         = 'collecting_task'
CONFIRMING_TASK         = 'confirming_task'
TASK_ACTIVE             = 'task_active'
PROJECT_ACTIVE          = 'project_active'
PROJECT_COLLECTING_TASK = 'project_collecting_task'
PROJECT_CONFIRMING_TASK = 'project_confirming_task'
COLLECTING_PROJECT      = 'collecting_project'

BOT_TOKEN    = os.getenv('TELEGRAM_BOT_TOKEN')
LIGHTRAG_URL = os.getenv('LIGHTRAG_URL', 'http://localhost:9621')
LIGHTRAG_KEY = os.getenv('LIGHTRAG_API_KEY', '')


def get_db():
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        port=int(os.getenv('POSTGRES_PORT', 5432)),
        dbname=os.getenv('POSTGRES_DB', 'chesscoin'),
        user=os.getenv('POSTGRES_USER', 'chesscoin'),
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
            f"UPDATE user_sessions SET {fields}, updated_at=NOW() WHERE user_id=%s",
            vals
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


# ── Qwen Audio (ASR + TTS) ────────────────────────────────────────────────────
QWEN_KEY     = os.getenv('QWEN_API_KEY', '')
QWEN_BASE    = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
VOICE_ID     = None   # заполняется после регистрации голоса


async def transcribe_audio(ogg_bytes: bytes) -> str:
    """Qwen Audio ASR через DashScope API."""
    import aiohttp, base64
    audio_b64 = base64.b64encode(ogg_bytes).decode()
    # DashScope использует свой формат, не OpenAI-compatible
    payload = {
        'model': 'paraformer-realtime-v2',
        'input': {
            'audio_format': 'ogg',
            'sample_rate': 16000,
            'audio': audio_b64,
        },
    }
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                'https://dashscope-intl.aliyuncs.com/api/v1/services/audio/asr/transcription',
                json=payload,
                headers={
                    'Authorization': f'Bearer {QWEN_KEY}',
                    'Content-Type': 'application/json',
                    'X-DashScope-Async': 'disable',
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as r:
                data = await r.json()
                return (data.get('output', {}) or {}).get('text', '')
    except Exception as e:
        log.warning(f'ASR ошибка: {e}')
        return ''


async def text_to_speech(text: str) -> bytes | None:
    """Qwen TTS через DashScope API."""
    import aiohttp
    if not QWEN_KEY:
        return None

    voice = VOICE_ID or 'longxiaochun'  # стандартный женский голос
    payload = {
        'model': 'cosyvoice-v1',
        'input': {'text': text},
        'parameters': {
            'voice': voice,
            'format': 'mp3',
            'sample_rate': 22050,
        },
    }
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                'https://dashscope-intl.aliyuncs.com/api/v1/services/audio/tts/synthesis',
                json=payload,
                headers={
                    'Authorization': f'Bearer {QWEN_KEY}',
                    'Content-Type': 'application/json',
                    'X-DashScope-Async': 'disable',
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as r:
                if r.status == 200:
                    ct = r.headers.get('Content-Type', '')
                    if 'audio' in ct:
                        return await r.read()
                    data = await r.json()
                    # иногда возвращает URL на аудио
                    url = (data.get('output') or {}).get('audio_address', '')
                    if url:
                        async with sess.get(url) as r2:
                            return await r2.read()
                err = await r.text()
                log.warning(f'TTS {r.status}: {err[:150]}')
                return None
    except Exception as e:
        log.warning(f'TTS ошибка: {e}')
        return None


async def send_reply(update: Update, text: str):
    await update.message.reply_text(text)
    if len(text) <= 300:
        asyncio.create_task(_send_voice(update, text))


async def _send_voice(update: Update, text: str):
    mp3 = await text_to_speech(text)
    if mp3:
        await update.message.reply_voice(voice=mp3)


async def rag_query(question: str) -> str:
    import aiohttp
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                f'{LIGHTRAG_URL}/query',
                json={'query': question, 'mode': 'hybrid'},
                headers={'Authorization': f'Bearer {LIGHTRAG_KEY}'},
                timeout=aiohttp.ClientTimeout(total=30)
            ) as r:
                data = await r.json()
                return data.get('response', '')
    except Exception as e:
        log.warning(f'LightRAG ошибка: {e}')
        return ''


async def rag_save(text: str):
    import aiohttp
    try:
        async with aiohttp.ClientSession() as sess:
            await sess.post(
                f'{LIGHTRAG_URL}/documents/text',
                json={'text': text},
                headers={'Authorization': f'Bearer {LIGHTRAG_KEY}'},
                timeout=aiohttp.ClientTimeout(total=10)
            )
    except Exception as e:
        log.warning(f'LightRAG save ошибка: {e}')


# ── Claude API (живые ответы) ─────────────────────────────────────────────────
ANTHROPIC_KEY = os.getenv('ANTHROPIC_API_KEY', '')

CLAUDIA_SYSTEM = """Ты — Клаудия, AI-ассистент проекта ChessCoin.
Ты умна, конкретна, говоришь по-русски.
Помогаешь управлять задачами, отвечаешь на вопросы о проекте, помнишь контекст.
Когда нужно создать задачу — предложи написать /task.
Когда нужно работать с ChessCoin — предложи /chesscoin.
Отвечай коротко и по делу. Без лишних слов."""


async def ask_claude(user_id: int, text: str, context: str = '') -> str:
    """Живые ответы через Qwen3.6-Plus (дешевле Claude для чата)."""
    import aiohttp
    if not QWEN_KEY:
        return 'API не настроен.'

    system = CLAUDIA_SYSTEM
    if context:
        system += f'\n\nКонтекст из памяти:\n{context}'

    payload = {
        'model': 'qwen3.6-plus-2026-04-02',
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user',   'content': text},
        ],
        'max_tokens': 512,
        'stream': False,
    }

    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                f'{QWEN_BASE}/chat/completions',
                json=payload,
                headers={
                    'Authorization': f'Bearer {QWEN_KEY}',
                    'Content-Type': 'application/json',
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as r:
                data = await r.json()
                return data['choices'][0]['message']['content']
    except Exception as e:
        log.warning(f'Qwen chat ошибка: {e}')
        return 'Не могу ответить прямо сейчас.'


async def analyze_task_buffer(user_id: int, project_name: str = None) -> str:
    items = get_buffer(user_id)
    if not items:
        return ''
    parts = []
    for item in items:
        if item['item_type'] == 'text':
            parts.append(item['content'])
        elif item['item_type'] == 'voice':
            parts.append(f"[Голосовое]: {item['content']}")
        elif item['item_type'] == 'photo':
            parts.append(f"[Фото]: {item['content']}")
        elif item['item_type'] == 'file':
            parts.append(f"[Файл]: {item['content']}")
    description = '\n\n'.join(parts)

    def _run_crew():
        sys.path.insert(0, '/root/claudia')
        from crew_board import run_board
        return run_board(description, project=project_name)

    loop = asyncio.get_event_loop()
    try:
        result = await asyncio.wait_for(
            loop.run_in_executor(None, _run_crew),
            timeout=300
        )
        return result
    except asyncio.TimeoutError:
        return 'Совет директоров не успел за 5 минут.'
    except Exception as e:
        log.error(f'CrewAI ошибка: {e}')
        return f'Ошибка анализа: {e}'


def parse_board_result(result: str) -> dict:
    lines = result.strip().split('\n')
    parsed = {
        'title': 'Новая задача',
        'description': result[:300],
        'stages': [],
        'report_format': 'text',
        'expected_result': '',
        'raw': result,
    }
    in_stages = False
    for line in lines:
        line = line.strip()
        if line.startswith('ЗАДАЧА:'):
            parsed['title'] = line[7:].strip()
        elif line.startswith('ОПИСАНИЕ:'):
            parsed['description'] = line[9:].strip()
            in_stages = False
        elif line.startswith('ЭТАПЫ:'):
            in_stages = True
        elif in_stages and line and line[0].isdigit():
            parsed['stages'].append(line)
        elif line.startswith('ФОРМАТ ОТЧЁТА:'):
            in_stages = False
            fmt = line[14:].strip().lower()
            if 'code' in fmt:
                parsed['report_format'] = 'code'
            elif 'both' in fmt:
                parsed['report_format'] = 'both'
        elif line.startswith('ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:'):
            parsed['expected_result'] = line[20:].strip()
    return parsed


async def route_message(update: Update, user_id: int,
                        item_type: str, content: str, raw_text: str = ''):
    session = get_session(user_id)
    state   = session['state']
    text    = raw_text.strip() if raw_text else ''
    tl      = text.lower()

    if tl == '#запомни':
        items = get_buffer(user_id)
        if items:
            await rag_save('\n'.join(i['content'] for i in items))
            clear_buffer(user_id)
        await send_reply(update, 'Запомнила.')
        return

    if tl == '#cancel':
        clear_buffer(user_id)
        set_session(user_id, state=IDLE, project_name=None, task_id=None)
        await send_reply(update, 'Отменено.')
        return

    if state == IDLE:
        if tl == '#task':
            set_session(user_id, state=COLLECTING_TASK)
            await send_reply(update, 'Собираю задачу. Материалы → #ok')
        elif tl == '#chesscoin':
            set_session(user_id, state=COLLECTING_PROJECT, project_name='chesscoin')
            await send_reply(update, 'Режим ChessCoin. Материалы → #ok')
        elif tl.startswith('#project '):
            proj = text[9:].strip()
            set_session(user_id, state=PROJECT_ACTIVE, project_name=proj)
            await send_reply(update, f'Проект "{proj}" активен. #task — задача, #end — выход.')
        elif tl.startswith('#rag'):
            question = text[4:].strip() or 'что я знаю о проекте?'
            answer = await rag_query(question)
            await send_reply(update, answer or 'Ничего не нашла.')
        else:
            # Живой ответ от Claude Haiku
            mem = await rag_query(text[:200]) if len(text) > 5 else ''
            reply = await ask_claude(user_id, text, context=mem)
            await send_reply(update, reply)

    elif state == COLLECTING_TASK:
        if tl == '#end':
            clear_buffer(user_id)
            set_session(user_id, state=IDLE)
            await send_reply(update, 'Сбор отменён.')
        elif tl == '#ok':
            items = get_buffer(user_id)
            if not items:
                await update.message.reply_text('Буфер пустой.')
                return
            await send_reply(update, 'Совет директоров анализирует... (1-3 мин)')
            result = await analyze_task_buffer(user_id)
            parsed = parse_board_result(result)
            set_session(user_id, state=CONFIRMING_TASK, extra={'parsed': parsed})
            stages_text = '\n'.join(parsed['stages']) if parsed['stages'] else '—'
            msg = (
                f"Задача готова:\n\n"
                f"{parsed['title']}\n"
                f"{parsed['description']}\n\n"
                f"Этапы:\n{stages_text}\n\n"
                f"#ok — создать, #end — уточнить"
            )
            await send_reply(update, msg)
        else:
            add_buffer(user_id, item_type, content)
            count = len(get_buffer(user_id))
            await update.message.reply_text(f'[{count}]')

    elif state == CONFIRMING_TASK:
        if tl == '#ok':
            extra   = session.get('extra') or {}
            parsed  = extra.get('parsed', {})
            task_id = save_task(
                user_id,
                title=parsed.get('title', 'Задача'),
                description=parsed.get('description', ''),
                stages=parsed.get('stages', []),
                report_format=parsed.get('report_format', 'text'),
                project_name=session.get('project_name'),
            )
            clear_buffer(user_id)
            set_session(user_id, state=TASK_ACTIVE, task_id=task_id)
            await send_reply(update, f'Задача #{task_id} создана.')
        elif tl == '#end':
            set_session(user_id, state=COLLECTING_TASK)
            await send_reply(update, 'Добавляй уточнения → #ok снова.')
        else:
            add_buffer(user_id, item_type, content)
            await update.message.reply_text('Добавила. #ok — подтвердить.')

    elif state == TASK_ACTIVE:
        if tl == '#end':
            set_session(user_id, state=IDLE, task_id=None)
            await send_reply(update, 'Задача закрыта.')
        elif tl == '#status':
            task_id = session.get('task_id')
            if task_id:
                with get_db() as db:
                    cur = db.cursor()
                    cur.execute('SELECT status, aider_result FROM claudia_tasks WHERE id=%s', (task_id,))
                    row = cur.fetchone()
                    if row:
                        await send_reply(update, f'#{task_id}: {row["status"]}\n{row["aider_result"] or ""}')
        else:
            await send_reply(update, 'Задача в работе. #status — статус, #end — закрыть.')

    elif state == PROJECT_ACTIVE:
        if tl == '#end':
            set_session(user_id, state=IDLE, project_name=None)
            await send_reply(update, 'Вышла из проекта.')
        elif tl == '#task':
            set_session(user_id, state=PROJECT_COLLECTING_TASK)
            await send_reply(update, f'Задача для "{session["project_name"]}". Материалы → #ok')
        else:
            add_buffer(user_id, item_type, content)
            await update.message.reply_text('Добавила в контекст.')

    elif state == PROJECT_COLLECTING_TASK:
        if tl == '#end':
            clear_buffer(user_id)
            set_session(user_id, state=PROJECT_ACTIVE)
            await send_reply(update, 'Отменила. Проект ещё активен.')
        elif tl == '#ok':
            items = get_buffer(user_id)
            if not items:
                await update.message.reply_text('Буфер пустой.')
                return
            proj = session.get('project_name', '')
            await send_reply(update, f'Анализирую для "{proj}"...')
            result = await analyze_task_buffer(user_id, project_name=proj)
            parsed = parse_board_result(result)
            set_session(user_id, state=PROJECT_CONFIRMING_TASK, extra={'parsed': parsed})
            stages_text = '\n'.join(parsed['stages']) if parsed['stages'] else '—'
            msg = (
                f'Задача для "{proj}":\n\n'
                f"{parsed['title']}\n{parsed['description']}\n\n"
                f"{stages_text}\n\n"
                f"#ok — создать, #end — уточнить"
            )
            await send_reply(update, msg)
        else:
            add_buffer(user_id, item_type, content)
            count = len(get_buffer(user_id))
            await update.message.reply_text(f'[{count}]')

    elif state == PROJECT_CONFIRMING_TASK:
        if tl == '#ok':
            extra   = session.get('extra') or {}
            parsed  = extra.get('parsed', {})
            task_id = save_task(
                user_id,
                title=parsed.get('title', 'Задача'),
                description=parsed.get('description', ''),
                stages=parsed.get('stages', []),
                report_format=parsed.get('report_format', 'text'),
                project_name=session.get('project_name'),
            )
            clear_buffer(user_id)
            set_session(user_id, state=PROJECT_ACTIVE, task_id=task_id)
            await send_reply(update, f'Задача #{task_id} добавлена в проект.')
        elif tl == '#end':
            set_session(user_id, state=PROJECT_COLLECTING_TASK)
            await send_reply(update, 'Добавляй уточнения → #ok')
        else:
            add_buffer(user_id, item_type, content)
            await update.message.reply_text('Добавила. #ok — подтвердить.')

    elif state == COLLECTING_PROJECT:
        if tl == '#end':
            clear_buffer(user_id)
            set_session(user_id, state=IDLE)
            await send_reply(update, 'Отменила.')
        elif tl == '#ok':
            items = get_buffer(user_id)
            if not items:
                await update.message.reply_text('Буфер пустой.')
                return
            proj = session.get('project_name', 'chesscoin')
            await send_reply(update, f'Анализирую для "{proj}"...')
            result = await analyze_task_buffer(user_id, project_name=proj)
            parsed = parse_board_result(result)
            set_session(user_id, state=CONFIRMING_TASK, extra={'parsed': parsed})
            await send_reply(update, f"{parsed['title']}\n{parsed['description']}\n\n#ok — создать")
        else:
            add_buffer(user_id, item_type, content)
            count = len(get_buffer(user_id))
            await update.message.reply_text(f'[{count}]')


async def handle_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text = update.message.text or ''
    await route_message(update, user_id, 'text', text, raw_text=text)


async def handle_voice(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    try:
        file = await update.message.voice.get_file()
        data = await file.download_as_bytearray()
        transcript = await transcribe_audio(bytes(data))
        if not transcript:
            transcript = '[голосовое — не распознано]'
        else:
            log.info(f'ASR: {transcript[:80]}')
    except Exception as e:
        log.warning(f'Voice handler: {e}')
        transcript = '[голосовое сообщение]'
    await route_message(update, user_id, 'voice', transcript, raw_text=transcript)


async def handle_photo(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    caption = update.message.caption or ''
    photo   = update.message.photo[-1]
    content = f"Фото (id={photo.file_id})"
    if caption:
        content += f": {caption}"
    await route_message(update, user_id, 'photo', content, raw_text=caption)


async def handle_document(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    doc     = update.message.document
    caption = update.message.caption or ''
    content = f"Файл {doc.file_name}"
    if caption:
        content += f": {caption}"
    await route_message(update, user_id, 'file', content, raw_text=caption)


async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await send_reply(update,
        'Привет! Я Клаудия.\n\n'
        'Используй команды из меню слева ↙️\n\n'
        '/task — новая задача\n'
        '/chesscoin — задача для проекта\n'
        '/status — текущее состояние\n'
        '/cancel — сбросить всё\n\n'
        'Отправляй текст, голос, фото, файлы.\n'
        'Когда готово — /ok'
    )


async def cmd_task(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    set_session(user_id, state=COLLECTING_TASK)
    await send_reply(update, 'Собираю задачу. Отправляй материалы → /ok')


async def cmd_chesscoin(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    set_session(user_id, state=COLLECTING_PROJECT, project_name='chesscoin')
    await send_reply(update, 'Режим ChessCoin. Материалы → /ok')


async def cmd_ok(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    await route_message(update, user_id, 'text', '#ok', raw_text='#ok')


async def cmd_end(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    await route_message(update, user_id, 'text', '#end', raw_text='#end')


async def cmd_cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    clear_buffer(user_id)
    set_session(user_id, state=IDLE, project_name=None, task_id=None)
    await send_reply(update, 'Отменено. Жду команд.')


async def cmd_rag(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    args = ' '.join(ctx.args) if ctx.args else ''
    if not args:
        await update.message.reply_text('Использование: /rag [вопрос]')
        return
    answer = await rag_query(args)
    await send_reply(update, answer or 'Ничего не нашла в памяти.')


async def cmd_status(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    session = get_session(user_id)
    buf     = get_buffer(user_id)
    state_labels = {
        IDLE: '⚪ Ожидание',
        COLLECTING_TASK: '🟡 Сбор задачи',
        CONFIRMING_TASK: '🟠 Подтверждение',
        TASK_ACTIVE: '🟢 Задача в работе',
        PROJECT_ACTIVE: '🔵 Проект активен',
        PROJECT_COLLECTING_TASK: '🟡 Сбор задачи (проект)',
        PROJECT_CONFIRMING_TASK: '🟠 Подтверждение (проект)',
        COLLECTING_PROJECT: '🟡 Сбор материалов',
    }
    label = state_labels.get(session['state'], session['state'])
    await update.message.reply_text(
        f'{label}\n'
        f'Проект: {session.get("project_name") or "—"}\n'
        f'Буфер: {len(buf)} элементов'
    )


async def error_handler(update: object, ctx: ContextTypes.DEFAULT_TYPE):
    from telegram.error import Conflict, NetworkError
    if isinstance(ctx.error, Conflict):
        log.warning('Конфликт polling — другой экземпляр бота. Жду...')
        return
    if isinstance(ctx.error, NetworkError):
        log.warning(f'Сеть: {ctx.error}')
        return
    log.error(f'Ошибка: {ctx.error}')


async def post_init(app):
    """Устанавливает команды в меню Telegram после запуска."""
    from telegram import BotCommand
    commands = [
        BotCommand('task',      '📋 Новая задача'),
        BotCommand('chesscoin', '♟ Задача для ChessCoin'),
        BotCommand('ok',        '✅ Подтвердить / отправить'),
        BotCommand('end',       '↩ Назад / выйти'),
        BotCommand('cancel',    '❌ Отменить всё'),
        BotCommand('status',    '📊 Текущее состояние'),
        BotCommand('rag',       '🧠 Спросить память'),
        BotCommand('start',     '🤖 Начало'),
    ]
    await app.bot.set_my_commands(commands)
    log.info('Команды меню установлены')


def main():
    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .post_init(post_init)
        .build()
    )

    app.add_error_handler(error_handler)

    app.add_handler(CommandHandler('start',      cmd_start))
    app.add_handler(CommandHandler('task',       cmd_task))
    app.add_handler(CommandHandler('chesscoin',  cmd_chesscoin))
    app.add_handler(CommandHandler('ok',         cmd_ok))
    app.add_handler(CommandHandler('end',        cmd_end))
    app.add_handler(CommandHandler('cancel',     cmd_cancel))
    app.add_handler(CommandHandler('rag',        cmd_rag))
    app.add_handler(CommandHandler('status',     cmd_status))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))

    log.info('Claudia Bot запущен (webhook mode)')
    app.run_webhook(
        listen='0.0.0.0',
        port=8444,
        url_path='/claudia/webhook',
        webhook_url='https://chesscoin.app/claudia/webhook',
        drop_pending_updates=True,
    )


if __name__ == '__main__':
    main()
