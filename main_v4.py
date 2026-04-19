"""
Claudia Bot v4.0
- Умная классификация намерений (задача / чат / поиск)
- Media group: несколько фото → один ответ
- Авто-режим сбора без /chesscoin
- Создание нового проекта на сервере
- PMI задачи через DeepSeek (быстро, качественно)
"""
import asyncio
import logging
import os
import sys
import json
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# ── VersionManager ────────────────────────────────────────────────────────────
sys.path.insert(0, '/root/claudia')
try:
    from version_manager import all_projects_status as _all_projects_status
    _VM_OK = True
except ImportError:
    _VM_OK = False
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
OR_KEY         = os.getenv('ANTHROPIC_API_KEY', '')
ANT_DIRECT     = os.getenv('ANTHROPIC_API_KEY_DIRECT', '')
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

ТВОИ ИНСТРУМЕНТЫ:
- /ok — отправить материалы на анализ и создать задачу
- /status — статус задач
- /rag — запрос в память проектов (LightRAG)
- /cancel — сбросить

ПРОЦЕСС:
1. Кенан описывает задачу (текст/голос/фото) → ты определяешь намерение
2. Если задача — спрашиваешь проект, собираешь материалы
3. /ok → DeepSeek генерирует PMI задачу → Кенан подтверждает
4. Аидер делает → присылает diff на проверку
5. /deploy_N → изменения попадают на сайт"""

TASK_PMI_SYSTEM = """Ты — технический менеджер проекта ChessCoin.
Генерируй задачи строго в PMI формате.

ФОРМАТ (обязательный):
ЗАДАЧА: [краткий конкретный заголовок]
ОПИСАНИЕ: [что нужно сделать и зачем, 1-3 предложения]
ЭТАПЫ:
1. [путь/файл.tsx: конкретное действие]
2. [путь/файл.ts: конкретное действие]
КРИТЕРИИ ПРИЁМКИ:
- [измеримый результат 1]
- [измеримый результат 2]
ФОРМАТ ОТЧЁТА: diff + screenshot

Стек: React+TypeScript (Vite), Node.js/Express, PostgreSQL, Redis, Docker.
Дизайн: #0D0D12 фон, #D4A843 золото, Inter шрифт.
Будь конкретным — указывай реальные пути файлов."""


# ── Media group буфер ─────────────────────────────────────────────────────────
_mg_buffer: dict = {}  # group_id → {user_id, items, update}
_mg_tasks: dict  = {}  # group_id → asyncio.Task


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


# Ключевые слова — сохраняем в память даже если коротко
_MEMORY_KEYWORDS = [
    'идея', 'задача', 'нужно', 'хочу', 'сделать', 'добавить', 'исправить',
    'ошибка', 'баг', 'проблема', 'план', 'концепция', 'архитектура', 'фича',
    'нереализован', 'будущем', 'потом', 'следующий', 'приоритет', 'важно',
]

def save_to_memory(role: str, content: str, project: str = 'chesscoin',
                   session_id: str = None, source: str = 'telegram'):
    """Сохраняет сообщение в claudia_memory если оно достаточно ценное."""
    if not content or len(content) < 30:
        return
    text_lower = content.lower()
    has_keyword = any(kw in text_lower for kw in _MEMORY_KEYWORDS)
    is_long = len(content) > 200
    if not (has_keyword or is_long):
        return
    tags = [project]
    for kw in ['идея', 'задача', 'ошибка', 'архитектура', 'план']:
        if kw in text_lower:
            tags.append(kw)
    important = has_keyword and is_long
    try:
        with get_db() as db:
            cur = db.cursor()
            cur.execute(
                """INSERT INTO claudia_memory(session_id, project, role, content, tags, important, source)
                   VALUES(%s, %s, %s, %s, %s, %s, %s)""",
                (session_id, project, role, content[:8000],
                 tags, important, source)
            )
            db.commit()
    except Exception as e:
        log.warning(f'save_to_memory error: {e}')


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


def clear_buffer(user_id: int):
    with get_db() as db:
        cur = db.cursor()
        cur.execute("DELETE FROM task_buffer WHERE user_id=%s", (user_id,))
        db.commit()


def save_conversation(user_id: int, role: str, content: str, project: str = 'claudia'):
    """Сохраняет в conversations (краткосрочная история) + в claudia_memory (долгосрочная)."""
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
    # Долгосрочная память — только ценные сообщения
    session_id = f"tg_{user_id}_{__import__('datetime').date.today()}"
    save_to_memory(role, content, project=project, session_id=session_id)


def search_conversations(user_id: int, query: str, limit: int = 10) -> list:
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


def create_project_structure(project_name: str) -> bool:
    """Создаёт структуру папок для нового проекта на сервере."""
    from datetime import date
    base = f'/opt/{project_name}'
    try:
        os.makedirs(base, exist_ok=True)
        project_data = {
            "project": project_name,
            "created": str(date.today()),
            "status": "active",
            "description": "",
            "stack": [],
            "tasks": [],
            "log": [{"date": str(date.today()), "author": "Клаудиа", "event": "Проект создан"}]
        }
        with open(f'{base}/PROJECT.json', 'w', encoding='utf-8') as f:
            json.dump(project_data, f, ensure_ascii=False, indent=2)
        log.info(f'Создан новый проект: {base}')
        return True
    except Exception as e:
        log.warning(f'create_project: {e}')
        return False


# ── ASR + TTS ─────────────────────────────────────────────────────────────────
async def transcribe_audio(ogg_bytes: bytes) -> str:
    """
    Транскрипция голоса.
    1. Groq Whisper (если GROQ_API_KEY задан и работает)
    2. Local faster-whisper tiny (всегда доступен, без API)
    """
    import aiohttp
    import tempfile, os

    # ── 1. Groq (если ключ есть) ──────────────────────────────────────────────
    if GROQ_KEY:
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
                        text = data.get('text', '').strip()
                        if text:
                            log.info(f'ASR Groq OK: {text[:60]}')
                            return text
                    else:
                        body = await r.text()
                        log.warning(f'ASR Groq {r.status}: {body[:100]}')
        except Exception as e:
            log.warning(f'ASR Groq: {e}')

    # ── 2. Local faster-whisper (фоллбэк, всегда работает) ───────────────────
    try:
        loop = asyncio.get_event_loop()
        text = await loop.run_in_executor(None, _transcribe_local, ogg_bytes)
        if text:
            log.info(f'ASR local OK: {text[:60]}')
            return text
    except Exception as e:
        log.warning(f'ASR local: {e}')

    log.warning('ASR: все провайдеры недоступны')
    return ''


def _transcribe_local(ogg_bytes: bytes) -> str:
    """Синхронная транскрипция через faster-whisper (запускается в executor)."""
    import tempfile, os
    try:
        from faster_whisper import WhisperModel
        # Модель загружается один раз и кешируется глобально
        global _whisper_model
        if '_whisper_model' not in globals() or _whisper_model is None:
            log.info('ASR: загружаю whisper small...')
            _whisper_model = WhisperModel('small', device='cpu', compute_type='int8')

        # Пишем ogg во временный файл
        with tempfile.NamedTemporaryFile(suffix='.ogg', delete=False) as f:
            f.write(ogg_bytes)
            tmp = f.name
        try:
            segments, info = _whisper_model.transcribe(tmp, language='ru', beam_size=3)
            text = ' '.join(seg.text.strip() for seg in segments).strip()
            return text
        finally:
            os.unlink(tmp)
    except Exception as e:
        log.warning(f'_transcribe_local: {e}')
        return ''


_whisper_model = None


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


async def send_reply(update: Update, text: str, voice_text: str = None):
    """Отправляет текст в чат + отдельный голос (voice_text или краткий текст)."""
    if '<b>' in text or '<i>' in text or '<code>' in text or '<a href' in text:
        try:
            await update.message.reply_text(text, parse_mode='HTML')
        except Exception:
            clean = text.replace('<b>', '').replace('</b>', '').replace(
                '<i>', '').replace('</i>', '').replace('<code>', '').replace('</code>', '')
            await update.message.reply_text(clean)
    else:
        await update.message.reply_text(text)
    # Голос ТОЛЬКО если явно передан voice_text — никакого авто-озвучивания текста
    if voice_text:
        asyncio.create_task(_send_voice(update, voice_text))


async def _send_voice(update: Update, text: str):
    mp3 = await text_to_speech(text)
    if mp3:
        await update.message.reply_voice(voice=mp3)


# Слова-согласия для голосового /ok
AGREEMENT_WORDS = [
    'окей', 'ок', 'ладно', 'хорошо', 'да', 'давай', 'давайте',
    'приступайте', 'начинайте', 'запускай', 'запускайте', 'поехали',
    'вперёд', 'вперед', 'согласен', 'согласна', 'отлично', 'го', 'yes', 'ok'
]


async def generate_oral_summary(title: str, description: str, stages_count: int = 0) -> str:
    """Генерирует короткую разговорную фразу для голоса (не читает структуру)."""
    import aiohttp
    prompt = (
        f'Задача: {title}\n'
        f'Суть: {description[:200]}\n'
        f'Этапов: {stages_count}\n\n'
        'Напиши КОРОТКУЮ разговорную фразу от лица AI-менеджера Клаудии (женский голос, уверенный, деловой).\n'
        'Максимум 2 предложения. Скажи что задача проанализирована и готова к запуску, кратко суть, '
        'и спроси подтверждение. Стиль: "Значит так, мы прошлись по задаче — [суть одной фразой]. '
        'Скажи окей — и сразу приступаем."\n'
        'Только текст, без кавычек и лишних слов.'
    )
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                'https://api.deepseek.com/v1/chat/completions',
                headers={'Authorization': f'Bearer {DS_KEY}'},
                json={
                    'model': 'deepseek-chat',
                    'messages': [{'role': 'user', 'content': prompt}],
                    'max_tokens': 100,
                    'temperature': 0.7
                },
                timeout=aiohttp.ClientTimeout(total=8)
            ) as r:
                if r.status == 200:
                    data = await r.json()
                    return data['choices'][0]['message']['content'].strip()
    except Exception as e:
        log.warning(f'generate_oral_summary: {e}')
    # Fallback: простой шаблон
    return (f'Значит так, задача "{title}" проанализирована — '
            f'вижу {stages_count} этапов работы. Скажи окей — и сразу приступаем.')


# ── LLM ───────────────────────────────────────────────────────────────────────
async def ask_claude(text: str, context: str = '') -> str:
    """Умный ответ через Claude (OpenRouter → Anthropic direct)."""
    import aiohttp
    system = CLAUDIA_SYSTEM
    if context:
        system += f'\n\nКонтекст:\n{context}'

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


async def classify_intent(text: str) -> str:
    """Определяет намерение: task / chat / search. Вызов DeepSeek → Claude."""
    import aiohttp
    prompt = (
        'Ты определяешь намерение сообщения пользователя к AI-боту.\n'
        'Ответь ОДНИМ словом: task, chat, или search.\n\n'
        'task = КОНКРЕТНАЯ задача для разработки/дизайна/деплоя с техническими деталями\n'
        '  Примеры: "исправь баг с авторизацией", "добавь кнопку на главную", "задача: переделать шапку"\n\n'
        'chat = всё остальное: разговор, вопрос боту, коррекция, недовольство, приветствие, уточнение, философия\n'
        '  Примеры: "как дела", "ты меня слышишь?", "нет ты не так понял", "что делаешь", "расскажи про...", "почему ты..."\n\n'
        'search = поиск конкретной внешней информации\n'
        '  Примеры: "найди документацию по React", "что такое WebSocket"\n\n'
        'ВАЖНО: если сомневаешься между task и chat — выбирай chat.\n'
        'Короткие фразы без технических деталей — всегда chat.\n\n'
        f'Сообщение: «{text[:300]}»\n\nОтвет:'
    )
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                'https://api.deepseek.com/v1/chat/completions',
                headers={'Authorization': f'Bearer {DS_KEY}'},
                json={
                    'model': 'deepseek-chat',
                    'messages': [{'role': 'user', 'content': prompt}],
                    'max_tokens': 5,
                    'temperature': 0
                },
                timeout=aiohttp.ClientTimeout(total=6)
            ) as r:
                if r.status == 200:
                    data = await r.json()
                    ans = data['choices'][0]['message']['content'].strip().lower()
                    if 'task' in ans:
                        return 'task'
                    if 'search' in ans:
                        return 'search'
                    return 'chat'
    except Exception as e:
        log.warning(f'classify_intent DeepSeek: {e}')
    return 'chat'


async def generate_task_pmi(description: str, project_name: str = None) -> str:
    """Генерирует задачу в PMI формате через DeepSeek."""
    import aiohttp
    system = TASK_PMI_SYSTEM
    if project_name:
        system += f'\nПроект: {project_name}'

    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                'https://api.deepseek.com/v1/chat/completions',
                headers={'Authorization': f'Bearer {DS_KEY}'},
                json={
                    'model': 'deepseek-chat',
                    'messages': [
                        {'role': 'system', 'content': system},
                        {'role': 'user', 'content': description}
                    ],
                    'max_tokens': 800,
                    'temperature': 0.3
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as r:
                if r.status == 200:
                    data = await r.json()
                    return data['choices'][0]['message']['content'].strip()
    except Exception as e:
        log.warning(f'generate_task_pmi DeepSeek: {e}')

    # Fallback: Claude
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                'https://api.anthropic.com/v1/messages',
                headers={'x-api-key': ANT_DIRECT, 'anthropic-version': '2023-06-01',
                         'content-type': 'application/json'},
                json={
                    'model': 'claude-haiku-4-5-20251001',
                    'max_tokens': 800,
                    'system': system,
                    'messages': [{'role': 'user', 'content': description}],
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as r:
                if r.status == 200:
                    data = await r.json()
                    return data['content'][0]['text'].strip()
    except Exception as e:
        log.warning(f'generate_task_pmi Claude: {e}')

    return ''


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


async def rag_daily_digest():
    """Раз в сутки: собирает важные сообщения дня → отправляет в LightRAG."""
    import datetime
    today = datetime.date.today().isoformat()
    yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    try:
        with get_db() as db:
            cur = db.cursor()
            cur.execute(
                """SELECT role, content, project, created_at
                   FROM claudia_memory
                   WHERE important=true
                   AND created_at::date = %s
                   ORDER BY created_at""",
                (yesterday,)
            )
            rows = cur.fetchall()
        if not rows:
            return
        lines = [f"[ДАЙДЖЕСТ {yesterday}]"]
        for row in rows:
            lines.append(f"{row['role'].upper()} [{row['project']}]: {row['content'][:300]}")
        digest = '\n'.join(lines)
        await rag_save(f"[ПРОЕКТ:ALL] {digest}")
        log.info(f'rag_daily_digest: отправлено {len(rows)} записей за {yesterday}')
    except Exception as e:
        log.warning(f'rag_daily_digest error: {e}')


# ── Анализ задачи (PMI через DeepSeek → fallback crew board) ──────────────────
async def analyze_task_buffer(user_id: int, project_name: str = None) -> str:
    items = get_buffer(user_id)
    if not items:
        return ''
    description = '\n'.join(
        f"[{i['item_type'].upper()}] {i['content']}" for i in items
    )
    # Прямой DeepSeek PMI (быстро, хорошее качество)
    result = await generate_task_pmi(description, project_name)
    if result:
        return result
    # Fallback: crew board
    try:
        sys.path.insert(0, '/root/claudia')
        from crew_board import run_board
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, run_board, description, project_name)
        return result or ''
    except Exception as e:
        log.warning(f'crew_board fallback: {e}')
        return ''


def parse_board_result(text: str) -> dict:
    """Парсит результат PMI задачи."""
    title = desc = ''
    stages = []
    criteria = []
    fmt = 'diff + screenshot'
    lines = text.split('\n')
    section = None
    for line in lines:
        l = line.strip()
        if not l:
            continue
        lu = l.upper()
        if lu.startswith('ЗАДАЧА:'):
            title = l[7:].strip()
            section = None
        elif lu.startswith('ОПИСАНИЕ:'):
            desc = l[9:].strip()
            section = 'desc'
        elif lu.startswith('ЭТАПЫ:'):
            section = 'stages'
        elif lu.startswith('КРИТЕРИИ'):
            section = 'criteria'
        elif lu.startswith('ФОРМАТ'):
            fmt = l.split(':', 1)[-1].strip()
            section = None
        elif section == 'desc' and not any(lu.startswith(k) for k in ('ЭТАПЫ','КРИТЕРИИ','ФОРМАТ','ЗАДАЧА')):
            desc += ' ' + l
        elif section == 'stages' and (l[0].isdigit() or l.startswith('-')):
            stages.append(l.lstrip('0123456789.-) ').strip())
        elif section == 'criteria' and (l.startswith('-') or l[0].isdigit()):
            criteria.append(l.lstrip('-0123456789.) ').strip())

    if not title:
        title = 'Задача'
    if not desc:
        desc = text[:200]
    return {'title': title, 'description': desc.strip(), 'stages': stages,
            'criteria': criteria, 'format': fmt}


# ── Умный IDLE обработчик ─────────────────────────────────────────────────────
async def _idle_smart_handle(update: Update, user_id: int, text: str, media_items: list = None):
    """Определяет намерение и реагирует: задача / чат / поиск."""
    save_conversation(user_id, 'user', text[:500] if text else '[медиа]')

    # ── Быстрый роутинг по ключевым словам — без LLM ─────────────────────────
    if text:
        tl = text.lower().strip()
        STATUS_TRIGGERS = [
            'положение дел', 'статус', 'как дела у проект', 'что происходит',
            'что с задач', 'какие задач', 'покажи задач', 'что в работе',
            'что сделано', 'что делается', 'покажи статус', 'версии проект',
            'какая версия', 'прогресс'
        ]
        if any(w in tl for w in STATUS_TRIGGERS):
            await cmd_status(update, None)
            return

    intent = await classify_intent(text) if text and len(text) > 3 else 'task' if media_items else 'chat'
    log.info(f'Intent [{user_id}]: {intent!r} для: {text[:60]!r}')

    if intent == 'task':
        # Определяем проект из контекста — если явно упоминается другой, спросим
        text_lower = (text or '').lower()
        known_projects = ['chesscoin', 'chess', 'illuminant']
        mentioned_other = any(
            w in text_lower for w in ['новый проект', 'другой проект', 'illuminant']
        )

        clear_buffer(user_id)
        if media_items:
            for item in media_items:
                add_buffer(user_id, 'photo', item['content'])
        elif text:
            add_buffer(user_id, 'text', text)

        if mentioned_other:
            # Только тогда спрашиваем
            set_session(user_id, state=COLLECTING, project_name=None, extra={'ask_project': True})
            await send_reply(update,
                'Поняла, Кенан — задачу приняла.\nДля какого проекта? Напиши название.',
                voice_text='Поняла. Для какого проекта?'
            )
        else:
            # По умолчанию — chesscoin, без вопросов
            set_session(user_id, state=COLLECTING, project_name='chesscoin', extra={})
            await send_reply(update,
                'Поняла, Кенан — задачу приняла.\n'
                'Впишу по проекту ChessCoin.\n\n'
                'Отправляй ещё материалы если есть. /ok — приступаю.',
                voice_text='Поняла, принято. Скажи окей когда готово.'
            )
    else:
        # Чат или поиск — умный ответ с памятью
        text_lower = (text or '').lower()
        is_memory = any(w in text_lower for w in
            ['помнишь', 'помнить', 'говорили', 'обсуждали', 'договорились',
             'помню', 'раньше', 'прошлый раз', 'в прошлый', 'тогда'])

        context_parts = []
        rag_ctx = await rag_query(text[:300]) if text and len(text) > 5 else ''
        if rag_ctx:
            context_parts.append(f'Из памяти проектов:\n{rag_ctx[:800]}')
        if is_memory or not rag_ctx:
            pg = search_conversations(user_id, text, limit=5)
            if pg:
                hist = '\n'.join(f"[{r['role']}] {r['content'][:150]}" for r in pg)
                context_parts.append(f'Из истории разговоров:\n{hist}')

        reply = await ask_claude(text or '[медиафайлы без подписи]', context='\n\n'.join(context_parts))
        save_conversation(user_id, 'assistant', reply)
        asyncio.create_task(rag_save(
            f'[ДИАЛОГ КЕНАН-КЛАУДИА]\nКЕНАН: {text[:400]}\nКЛАУДИА: {reply[:400]}'
        ))
        # Голос: только первое предложение ответа (без HTML), макс 120 символов
        import re as _re
        clean = _re.sub(r'<[^>]+>', '', reply).strip()
        first_sentence = _re.split(r'(?<=[.!?])\s', clean)[0]
        voice_ver = first_sentence[:120]
        await send_reply(update, reply, voice_text=voice_ver)


# ── Media group обработка ─────────────────────────────────────────────────────
async def _process_media_group_after(group_id: str, delay: float, update: Update):
    """Ждёт delay секунд, затем обрабатывает все фото из альбома."""
    await asyncio.sleep(delay)
    group = _mg_buffer.pop(group_id, None)
    _mg_tasks.pop(group_id, None)
    if not group:
        return

    user_id = group['user_id']
    items   = group['items']
    upd     = group['update']
    session = get_session(user_id)
    state   = session.get('state', IDLE)
    caption = next((i['caption'] for i in items if i['caption']), '')

    if state == COLLECTING:
        for item in items:
            add_buffer(user_id, 'photo', item['content'])
        buf_len = len(get_buffer(user_id))
        extra = session.get('extra') or {}
        if extra.get('ask_project') and not session.get('project_name'):
            await upd.message.reply_text(
                f'Добавила {len(items)} скриншот(ов) [{buf_len}].\n'
                f'Для какого проекта? Напиши <b>chesscoin</b> или название нового.',
                parse_mode='HTML'
            )
        else:
            await upd.message.reply_text(
                f'Добавила {len(items)} скриншот(ов) [{buf_len}]. /ok когда готово.'
            )
    else:
        # IDLE — умная обработка
        desc = caption or f'{len(items)} скриншот(ов) без подписи'
        await _idle_smart_handle(upd, user_id, desc, media_items=items)


# ── Вспомогательная: список активных задач ────────────────────────────────────
def get_active_tasks(user_id: int) -> list:
    try:
        with get_db() as db:
            cur = db.cursor()
            cur.execute(
                "SELECT id, title, status, project_name FROM claudia_tasks "
                "WHERE user_id=%s AND status NOT IN ('done','cancelled','failed') "
                "ORDER BY created_at DESC LIMIT 10",
                (user_id,)
            )
            return [dict(r) for r in cur.fetchall()]
    except Exception:
        return []


# ── Команды ───────────────────────────────────────────────────────────────────
async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    clear_buffer(update.effective_user.id)
    set_session(update.effective_user.id, state=IDLE, project_name=None, extra={})
    await send_reply(update,
        'Клаудиа на связи, Кенан.\n\n'
        'Говори или пиши — пойму сама.\n'
        'Отправляй текст, голос, скриншоты.\n\n'
        '/create — новый проект или задача\n'
        '/ok — подтвердить\n'
        '/cancel — отменить\n'
        '/memory — вспомнить или запомнить\n'
        '/status — статус задач',
        voice_text='Клаудиа на связи. Говори — слушаю.'
    )


async def cmd_create(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Создать проект или задачу — уточняющий вопрос."""
    user_id = update.effective_user.id
    clear_buffer(user_id)
    set_session(user_id, state=IDLE, extra={'create_flow': 'type'})
    await send_reply(update,
        'Что создаём?\n\n'
        '• <b>проект</b> — новый проект на сервере\n'
        '• <b>задача</b> — задача в существующем проекте',
        voice_text='Что создаём — новый проект или задачу в существующем?'
    )


async def cmd_chesscoin(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Быстрый старт задачи для ChessCoin (внутренняя команда)."""
    user_id = update.effective_user.id
    clear_buffer(user_id)
    set_session(user_id, state=COLLECTING, project_name='chesscoin', extra={})
    await send_reply(update,
        'Готова. Отправляй материалы — текст, голос, скриншоты. /ok когда всё.',
        voice_text='Готова. Отправляй что есть. Скажи окей когда всё.'
    )


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
        await send_reply(update, f'Анализирую задачу через DeepSeek... ({len(items)} материалов)')
        result = await analyze_task_buffer(user_id, project_name=proj)
        if not result:
            await send_reply(update, 'Не смог проанализировать. Попробуй снова.')
            return
        parsed = parse_board_result(result)
        set_session(user_id, state=CONFIRMING,
                    extra={'parsed': parsed, 'project_name': proj})
        stages_text = '\n'.join(f'{i+1}. {s}' for i, s in enumerate(parsed['stages'])) \
                      if parsed['stages'] else '—'
        criteria_text = '\n'.join(f'• {c}' for c in parsed.get('criteria', [])) \
                        if parsed.get('criteria') else '—'
        proj_label = f' [{proj}]' if proj else ''
        full_text = (
            f"<b>📋 ЗАДАЧА{proj_label}: {parsed['title']}</b>\n\n"
            f"<b>Описание:</b>\n{parsed['description']}\n\n"
            f"<b>Этапы:</b>\n{stages_text}\n\n"
            f"<b>Критерии приёмки:</b>\n{criteria_text}\n\n"
            f"<b>Формат отчёта:</b> {parsed.get('format', 'diff + screenshot')}\n\n"
            f"✅ /ok — запустить · ❌ /cancel — отменить"
        )
        # Голос — короткая живая фраза, не читает структуру
        oral = await generate_oral_summary(
            parsed['title'], parsed['description'], len(parsed['stages'])
        )
        await send_reply(update, full_text, voice_text=oral)

    elif state == CONFIRMING:
        extra   = session.get('extra') or {}
        parsed  = extra.get('parsed', {})
        proj    = extra.get('project_name') or proj
        task_id = save_task(
            user_id,
            title=parsed.get('title', 'Задача'),
            description=parsed.get('description', ''),
            stages=parsed.get('stages', []),
            report_format=parsed.get('format', 'diff + screenshot'),
            project_name=proj,
        )
        if proj:
            update_project_json(proj, task_id, parsed['title'],
                                parsed['description'], parsed['stages'])
        clear_buffer(user_id)
        set_session(user_id, state=IDLE, project_name=None, extra={})
        confirm_text = f'Задача #{task_id} принята и поставлена в очередь. Аидер приступит — пришлю отчёт.'
        confirm_voice = f'Принято. Задача номер {task_id} уже в работе. Как только закончим — сразу пришлю отчёт.'
        await send_reply(update, confirm_text, voice_text=confirm_voice)
    else:
        await update.message.reply_text('Нечего подтверждать. Опиши задачу, я помогу.')


async def cmd_cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    session = get_session(user_id)
    state   = session.get('state', IDLE)

    # Если в процессе сбора/подтверждения — сбрасываем текущее
    if state in (COLLECTING, CONFIRMING):
        clear_buffer(user_id)
        set_session(user_id, state=IDLE, project_name=None, extra={})
        await send_reply(update, 'Текущий сбор отменён.',
            voice_text='Ладно, сбросила. Когда будешь готов — говори.'
        )
        return

    # Проверяем активные задачи в очереди
    tasks = get_active_tasks(user_id)
    if not tasks:
        clear_buffer(user_id)
        set_session(user_id, state=IDLE, project_name=None, extra={})
        await send_reply(update, 'Нет активных задач.',
            voice_text='Активных задач нет.'
        )
    elif len(tasks) == 1:
        t = tasks[0]
        with get_db() as db:
            cur = db.cursor()
            cur.execute("UPDATE claudia_tasks SET status='cancelled' WHERE id=%s", (t['id'],))
            db.commit()
        await send_reply(update, f'Задача #{t["id"]} «{t["title"][:40]}» отменена.',
            voice_text=f'Задача номер {t["id"]} отменена.'
        )
    else:
        # Несколько задач — уточняем
        task_list = '\n'.join(
            f'  #{t["id"]} [{t["status"]}] {t["title"][:35]}' for t in tasks
        )
        set_session(user_id, extra={'cancel_flow': 'select',
                                     'cancel_tasks': [t['id'] for t in tasks]})
        await send_reply(update,
            f'Активных задач несколько. Какую отменить?\n\n{task_list}\n\n'
            f'Напиши номер задачи (например: <b>3</b>)',
            voice_text=f'Активных задач {len(tasks)}. Какую отменить — назови номер.'
        )


async def cmd_status(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    session = get_session(user_id)
    buf     = get_buffer(user_id)
    tasks   = get_active_tasks(user_id)

    state_icons = {IDLE: '⚪', COLLECTING: '🟡', CONFIRMING: '🟠'}
    state_labels = {IDLE: 'Ожидание', COLLECTING: 'Сбор материалов', CONFIRMING: 'Подтверждение'}
    icon  = state_icons.get(session['state'], '⚫')
    label = state_labels.get(session['state'], session['state'])

    if not tasks:
        tasks_text = '\nАктивных задач нет.'
        voice_text = 'Задач нет.'
    else:
        STATUS_LABELS = {
            'pending': '⏳ в очереди', 'processing': '⚙️ выполняется',
            'audit': '🔍 ждёт решения', 'done': '✅ готово'
        }
        lines = []
        voice_lines = []
        for t in tasks:
            sl = STATUS_LABELS.get(t['status'], t['status'])
            proj = f'[{t["project_name"]}] ' if t.get('project_name') else ''
            lines.append(f'  #{t["id"]} {sl}\n  {proj}{t["title"][:45]}')
            voice_lines.append(t["title"][:40])
        tasks_text = '\n\n' + '\n\n'.join(lines)
        # Голос как живой ответ — без номеров и иконок
        if len(tasks) == 1:
            st = tasks[0]['status']
            st_ru = {'pending': 'в очереди', 'processing': 'выполняется',
                     'audit': 'ждёт твоего решения', 'done': 'готова'}.get(st, st)
            voice_text = f'Есть одна задача — {voice_lines[0]}, {st_ru}.'
        else:
            voice_text = f'Активных задач {len(tasks)}: ' + ', '.join(voice_lines[:3]) + '.'

    proj_line = f'\nПроект: {session["project_name"]}' if session.get('project_name') else ''
    buf_line  = f'\nБуфер: {len(buf)} материалов' if buf else ''

    # Версии всех проектов
    versions_block = ''
    versions_voice = ''
    if _VM_OK:
        try:
            versions_block = '\n\n' + _all_projects_status()
            # Короткая голосовая сводка версий
            import re as _re
            clean = _re.sub(r'<[^>]+>', '', versions_block).strip()
            lines = [l.strip() for l in clean.splitlines() if l.strip() and l.strip() != 'Все проекты:']
            versions_voice = '. '.join(lines[:3])  # первые 3 проекта голосом
        except Exception:
            pass

    await send_reply(update,
        f'{icon} <b>{label}</b>{proj_line}{buf_line}{tasks_text}{versions_block}',
        voice_text=voice_text
    )


async def cmd_memory(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Память: вспомнить или запомнить."""
    user_id = update.effective_user.id
    args = ' '.join(ctx.args).strip() if ctx.args else ''

    if not args:
        set_session(user_id, extra={'memory_flow': 'action'})
        await send_reply(update,
            'Что сделать с памятью?\n\n'
            '• <b>вспомнить</b> [запрос] — найти в памяти проектов\n'
            '• <b>запомнить</b> [текст] — сохранить информацию\n'
            '• <b>правило</b> [текст] — добавить правило в BIBLE',
            voice_text='Вспомнить или запомнить? Скажи что нужно.'
        )
        return

    # Определяем действие из аргументов
    a = args.lower()
    if a.startswith('вспомн') or a.startswith('найди') or a.startswith('что'):
        query = args[args.index(' ')+1:].strip() if ' ' in args else args
        await _memory_recall(update, user_id, query)
    elif a.startswith('запомн') or a.startswith('сохран'):
        text = args[args.index(' ')+1:].strip() if ' ' in args else args
        await _memory_save(update, user_id, text, is_rule=False)
    elif a.startswith('правил') or a.startswith('rule') or a.startswith('библ'):
        text = args[args.index(' ')+1:].strip() if ' ' in args else args
        await _memory_save(update, user_id, text, is_rule=True)
    else:
        # Просто запрос
        await _memory_recall(update, user_id, args)


async def _memory_recall(update: Update, user_id: int, query: str):
    if not query:
        await update.message.reply_text('Напиши что искать.')
        return
    answer = await rag_query(query)
    if answer:
        import re as _re
        voice_ver = _re.sub(r'<[^>]+>', '', answer)[:250].strip()
        await send_reply(update, answer, voice_text=voice_ver)
    else:
        await send_reply(update, 'Ничего не нашла в памяти по этому запросу.',
            voice_text='В памяти ничего не нашла.')


async def _memory_save(update: Update, user_id: int, text: str, is_rule: bool = False):
    if not text:
        await update.message.reply_text('Напиши что сохранить.')
        return
    prefix = '[ПРАВИЛО BIBLE]\n' if is_rule else '[ИНФОРМАЦИЯ]\n'
    await rag_save(prefix + text)
    save_conversation(user_id, 'user', f'[запомнить] {text}')
    kind = 'Правило добавлено в BIBLE.' if is_rule else 'Информация сохранена в памяти.'
    await send_reply(update, f'✅ {kind}',
        voice_text='Запомнила.'
    )


async def cmd_rag(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Алиас /rag → /memory для совместимости."""
    await cmd_memory(update, ctx)


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
    extra   = session.get('extra') or {}

    save_conversation(user_id, 'user', text)

    # ── Уточняющие диалоговые потоки (create / cancel / memory) ──────────────
    t_lower = text.lower().strip()

    # create_flow: уточняем тип (проект или задача)
    if extra.get('create_flow') == 'type':
        if any(w in t_lower for w in ['проект', 'project', 'новый']):
            set_session(user_id, extra={'create_flow': 'project_name'})
            await send_reply(update, 'Как назовём проект? Напиши или скажи название.',
                voice_text='Как назовём проект?')
        elif any(w in t_lower for w in ['задача', 'задание', 'task', 'фича', 'баг', 'исправ']):
            clear_buffer(user_id)
            set_session(user_id, state=COLLECTING, extra={'ask_project': True})
            await send_reply(update,
                'Для какого проекта задача? Отправляй материалы, /ok когда всё.',
                voice_text='Для какого проекта? Отправляй материалы.')
        else:
            await send_reply(update, 'Напиши <b>проект</b> или <b>задача</b>.',
                voice_text='Скажи: проект или задача.')
        return

    # create_flow: получаем имя проекта
    if extra.get('create_flow') == 'project_name':
        project_name = text.strip().replace(' ', '_')[:30].strip('_') or 'project'
        created = create_project_structure(project_name)
        set_session(user_id, extra={})
        status = 'создан' if created else 'уже существует'
        await send_reply(update,
            f'✅ Проект <b>{project_name}</b> {status}.\n/ok создать задачу сразу.',
            voice_text=f'Проект {project_name} {status}.')
        return

    # cancel_flow: пользователь выбирает номер задачи для отмены
    if extra.get('cancel_flow') == 'select':
        try:
            task_id = int(''.join(c for c in text if c.isdigit()))
            allowed = extra.get('cancel_tasks', [])
            if task_id in allowed:
                with get_db() as db:
                    cur = db.cursor()
                    cur.execute(
                        "UPDATE claudia_tasks SET status='cancelled' WHERE id=%s RETURNING title",
                        (task_id,)
                    )
                    row = cur.fetchone()
                    db.commit()
                title = row['title'][:40] if row else f'#{task_id}'
                set_session(user_id, extra={})
                await send_reply(update, f'Задача #{task_id} «{title}» отменена.',
                    voice_text=f'Задача номер {task_id} отменена.')
            else:
                await update.message.reply_text(f'Задача #{task_id} не найдена в списке.')
        except (ValueError, TypeError):
            await update.message.reply_text('Напиши номер задачи цифрой.')
        return

    # memory_flow: действие
    if extra.get('memory_flow') == 'action':
        set_session(user_id, extra={})
        if any(w in t_lower for w in ['вспомн', 'найди', 'что знаешь', 'расскаж']):
            query = text
            await _memory_recall(update, user_id, query)
        elif any(w in t_lower for w in ['запомн', 'сохран']):
            await send_reply(update, 'Напиши что сохранить в памяти.',
                voice_text='Что сохранить?')
            set_session(user_id, extra={'memory_flow': 'save'})
        elif any(w in t_lower for w in ['правил', 'библ', 'rule']):
            await send_reply(update, 'Напиши правило для добавления в BIBLE.',
                voice_text='Напиши правило.')
            set_session(user_id, extra={'memory_flow': 'rule'})
        else:
            await _memory_recall(update, user_id, text)
        return

    if extra.get('memory_flow') == 'save':
        set_session(user_id, extra={})
        await _memory_save(update, user_id, text, is_rule=False)
        return

    if extra.get('memory_flow') == 'rule':
        set_session(user_id, extra={})
        await _memory_save(update, user_id, text, is_rule=True)
        return

    if state == COLLECTING:
        # Проверяем: ждём имя проекта?
        if extra.get('ask_project') and not session.get('project_name'):
            proj_lower = text.lower().strip()
            if any(k in proj_lower for k in ['chesscoin', 'chess', 'coin', 'шахмат']):
                set_session(user_id, project_name='chesscoin', extra={})
                buf_len = len(get_buffer(user_id))
                await update.message.reply_text(
                    f'Проект: <b>ChessCoin</b> ✓\n'
                    f'Буфер: [{buf_len}]. Продолжай или /ok для анализа.',
                    parse_mode='HTML'
                )
            else:
                # Новый проект
                project_name = proj_lower.replace(' ', '_')[:30].strip('_')
                if not project_name:
                    project_name = 'project'
                created = create_project_structure(project_name)
                set_session(user_id, project_name=project_name, extra={})
                buf_len = len(get_buffer(user_id))
                status_emoji = '✓' if created else '(уже существует)'
                await update.message.reply_text(
                    f'Новый проект <b>{project_name}</b> {status_emoji}\n'
                    f'Папка /opt/{project_name} создана.\n'
                    f'Буфер: [{buf_len}]. /ok когда всё готово.',
                    parse_mode='HTML'
                )
            return

        # Только очевидные коррекции роутим в диалог
        tl = text.lower().strip()
        is_correction = (
            tl.endswith('?') or
            tl.startswith(('нет,', 'нет ', 'стоп', 'подожди', 'погоди',
                           'ты что', 'ты вообще', 'не то', 'не так',
                           'неправильно', 'отмена', 'cancel', 'stop')) or
            tl == 'нет'
        )
        if is_correction:
            save_conversation(user_id, 'user', text)
            await _idle_smart_handle(update, user_id, text)
            return

        add_buffer(user_id, 'text', text)
        buf_len = len(get_buffer(user_id))
        await update.message.reply_text(
            f'Добавила [{buf_len}]. Ещё материалы или /ok для анализа.'
        )

    elif state == CONFIRMING:
        await update.message.reply_text(
            '/ok — запустить задачу · /cancel — отменить'
        )
    else:
        # IDLE — умный ответ
        await _idle_smart_handle(update, user_id, text)


async def handle_voice(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    session = get_session(user_id)
    state   = session.get('state', IDLE)
    extra   = session.get('extra') or {}

    transcript = ''
    asr_ok = False
    try:
        file = await update.message.voice.get_file()
        data = await file.download_as_bytearray()
        transcript = await transcribe_audio(bytes(data))
        if transcript:
            asr_ok = True
            log.info(f'ASR: {transcript[:80]}')
    except Exception as e:
        log.warning(f'Voice: {e}')

    if not asr_ok:
        await update.message.reply_text(
            'Голосовое не распозналось. Напиши текстом или попробуй ещё раз.'
        )
        return

    t_lower = transcript.lower().strip()

    # ── Голосовое подтверждение вместо /ok ───────────────────────────────────
    # Работает в CONFIRMING и в COLLECTING (если буфер непустой и сказал "окей анализируй")
    is_agreement = any(w in t_lower for w in AGREEMENT_WORDS) and len(t_lower) < 40
    if is_agreement and state in (CONFIRMING, COLLECTING):
        log.info(f'Голосовое согласие [{user_id}]: "{transcript}" → /ok')
        await cmd_ok(update, ctx)
        return

    if state == COLLECTING:
        # Ждём имя проекта голосом?
        if extra.get('ask_project') and not session.get('project_name'):
            proj_lower = t_lower
            if any(k in proj_lower for k in ['chesscoin', 'chess', 'coin', 'шахмат']):
                set_session(user_id, project_name='chesscoin', extra={})
                await send_reply(update, 'Проект: ChessCoin ✓. Продолжай или /ok для анализа.',
                                 voice_text='Отлично, ChessCoin. Продолжай отправлять материалы.')
            else:
                project_name = t_lower.split()[0][:20] if t_lower else 'project'
                create_project_structure(project_name)
                set_session(user_id, project_name=project_name, extra={})
                await send_reply(update, f'Проект "{project_name}" создан ✓. /ok когда материалы готовы.',
                                 voice_text=f'Проект {project_name} создан. Жду материалы.')
            return

        # Быстрая проверка: коррекция/вопрос к боту или материал задачи?
        # Только очевидные паттерны — без LLM чтобы не путать логику
        t_words = t_lower.strip()
        is_correction = (
            t_words.endswith('?') or
            t_words.startswith(('нет,', 'нет ', 'стоп', 'подожди', 'погоди',
                                'ты что', 'ты вообще', 'ты слышишь', 'зачем ты',
                                'не то', 'не так', 'неправильно', 'отмена',
                                'cancel', 'stop', 'что ты', 'почему ты')) or
            (t_words == 'нет')
        )
        if is_correction:
            save_conversation(user_id, 'user', f'[голос] {transcript}')
            await _idle_smart_handle(update, user_id, transcript)
            return

        # Всё остальное — материал задачи
        add_buffer(user_id, 'voice', transcript)
        save_conversation(user_id, 'user', f'[голос] {transcript}')
        buf_len = len(get_buffer(user_id))
        # Не повторяем транскрипцию — просто подтверждаем приём
        await update.message.reply_text(
            f'Принято [{buf_len}]. Ещё материалы или /ok.'
        )

    elif state == CONFIRMING:
        # Не согласие — значит хочет что-то уточнить
        await send_reply(update,
            'Задача ждёт твоего решения: /ok — запустить, /cancel — отменить.',
            voice_text='Жду твоего окей — или скажи отмена.'
        )

    else:
        # IDLE — умный ответ
        save_conversation(user_id, 'user', f'[голос] {transcript}')
        await _idle_smart_handle(update, user_id, transcript)


async def handle_photo(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_id  = update.effective_user.id
    photo    = update.message.photo[-1]
    caption  = update.message.caption or ''
    content  = f"Скриншот (id={photo.file_id})"
    if caption:
        content += f": {caption}"

    mg_id = update.message.media_group_id
    if mg_id:
        # Альбом — собираем все фото
        if mg_id not in _mg_buffer:
            _mg_buffer[mg_id] = {'user_id': user_id, 'items': [], 'update': update}
        _mg_buffer[mg_id]['items'].append({'file_id': photo.file_id, 'caption': caption, 'content': content})

        # Сбрасываем таймер
        if mg_id in _mg_tasks and not _mg_tasks[mg_id].done():
            _mg_tasks[mg_id].cancel()
        _mg_tasks[mg_id] = asyncio.create_task(
            _process_media_group_after(mg_id, 1.5, update)
        )
    else:
        # Одиночное фото
        session = get_session(user_id)
        state   = session.get('state', IDLE)
        extra   = session.get('extra') or {}

        if state == COLLECTING:
            add_buffer(user_id, 'photo', content)
            buf_len = len(get_buffer(user_id))
            if extra.get('ask_project') and not session.get('project_name'):
                await update.message.reply_text(
                    f'Скриншот добавлен [{buf_len}].\n'
                    f'Для какого проекта? Напиши <b>chesscoin</b> или название нового.',
                    parse_mode='HTML'
                )
            else:
                await update.message.reply_text(f'Скриншот добавлен [{buf_len}]. /ok когда готово.')
        else:
            # IDLE — умно определяем
            desc = caption if caption else 'скриншот без подписи'
            await _idle_smart_handle(update, user_id, desc, media_items=[{'file_id': photo.file_id, 'caption': caption, 'content': content}])


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
        desc = f'файл {doc.file_name}'
        if caption:
            desc += f': {caption}'
        await _idle_smart_handle(update, user_id, desc)


# ── Error handler ─────────────────────────────────────────────────────────────
async def error_handler(update: object, ctx: ContextTypes.DEFAULT_TYPE):
    from telegram.error import Conflict, NetworkError
    if isinstance(ctx.error, Conflict):
        log.warning('Конфликт polling — другой экземпляр бота')
        return
    if isinstance(ctx.error, NetworkError):
        log.warning(f'Сеть: {ctx.error}')
        return
    log.error(f'Ошибка: {ctx.error}', exc_info=ctx.error)


async def _daily_digest_job(context):
    await rag_daily_digest()


async def post_init(app):
    commands = [
        BotCommand('create', 'Создать'),
        BotCommand('ok',     'Подтвердить'),
        BotCommand('cancel', 'Отменить'),
        BotCommand('memory', 'Память'),
        BotCommand('status', 'Статус'),
        BotCommand('start',  'Старт'),

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
    # Основное меню
    app.add_handler(CommandHandler('start',    cmd_start))
    app.add_handler(CommandHandler('create',   cmd_create))
    app.add_handler(CommandHandler('ok',       cmd_ok))
    app.add_handler(CommandHandler('cancel',   cmd_cancel))
    app.add_handler(CommandHandler('memory',   cmd_memory))
    app.add_handler(CommandHandler('status',   cmd_status))
    # Алиасы и внутренние команды
    app.add_handler(CommandHandler('rag',      cmd_rag))
    app.add_handler(CommandHandler('chesscoin', cmd_chesscoin))
    app.add_handler(MessageHandler(filters.Regex(r'^/deploy_\d+$'), cmd_deploy))
    app.add_handler(MessageHandler(filters.Regex(r'^/revert_\d+$'), cmd_revert))
    # Сообщения
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))

    # Дайджест в LightRAG каждый день в 06:00 (только если job-queue установлен)
    if app.job_queue:
        app.job_queue.run_daily(
            _daily_digest_job,
            time=__import__('datetime').time(6, 0, 0)
        )
    else:
        log.warning('JobQueue недоступен — дайджест через systemd timer')

    log.info('Claudia Bot v4.0 (polling) — smart intent + media groups + memory')
    app.run_polling()


if __name__ == '__main__':
    main()
