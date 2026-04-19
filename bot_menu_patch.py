"""Патч для bot/main.py — новое меню + красивый /model командир."""
from pathlib import Path

SRC = Path('/root/claudia/bot/main.py')
src = SRC.read_text(encoding='utf-8')

# ── 1. Импорты ────────────────────────────────────────────────────────────
if 'InlineKeyboardButton' not in src:
    src = src.replace(
        'from telegram import Update, BotCommand',
        'from telegram import Update, BotCommand, InlineKeyboardButton, InlineKeyboardMarkup',
        1,
    )
    print('✓ InlineKeyboardButton импортирован')

if 'CallbackQueryHandler' not in src:
    src = src.replace(
        'from telegram.ext import (\n    Application, CommandHandler, MessageHandler,\n    filters, ContextTypes\n)',
        'from telegram.ext import (\n    Application, CommandHandler, MessageHandler, CallbackQueryHandler,\n    filters, ContextTypes\n)',
        1,
    )
    print('✓ CallbackQueryHandler импортирован')

# ── 2. Меню (6 коротких команд) ───────────────────────────────────────────
old_menu = '''    commands = [
        BotCommand('create', 'Создать'),
        BotCommand('ok',     'Подтвердить'),
        BotCommand('cancel', 'Отменить'),
        BotCommand('cost',   'Расходы API за сегодня и прогноз'),
        BotCommand('memory', 'Память'),
        BotCommand('status', 'Статус'),
        BotCommand('start',  'Старт'),

    ]'''

new_menu = '''    commands = [
        BotCommand('model',   'Модель'),
        BotCommand('status',  'Статус'),
        BotCommand('cost',    'Расход'),
        BotCommand('memory',  'Память'),
        BotCommand('deploy',  'Деплой'),
        BotCommand('start',   'Старт'),
    ]'''

if old_menu in src:
    src = src.replace(old_menu, new_menu)
    print('✓ Меню: 6 однословных команд')

# ── 3. /status теперь дашборд ────────────────────────────────────────────
old_status_reg = "    app.add_handler(CommandHandler('status',   cmd_status))"
new_status_reg = "    app.add_handler(CommandHandler('status',   cmd_claudia_status))"
if old_status_reg in src:
    src = src.replace(old_status_reg, new_status_reg)
    print('✓ /status → дашборд')

# /tasks — старое поведение (только если ещё нет)
if "CommandHandler('tasks'" not in src:
    hook = "    app.add_handler(CommandHandler('claudia_status', cmd_claudia_status))"
    new_hook = "    app.add_handler(CommandHandler('tasks',   cmd_status))\n" + hook
    if hook in src:
        src = src.replace(hook, new_hook, 1)
        print('✓ /tasks — алиас на старый /status')

# ── 4. Новый /model с inline-кнопками ────────────────────────────────────
old_cmd_model = '''async def cmd_model(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Переключает LLM модель. /model [haiku|sonnet|opus|deepseek|status]"""
    user_id = update.effective_user.id
    args = ctx.args or []
    choice = args[0].lower() if args else 'status'

    MODEL_LABELS = {
        'haiku':    'claude-haiku-4-5 — $0.8/$4 за M (по умолч.)',
        'sonnet':   'claude-sonnet-4-6 — $3/$15 за M',
        'opus':     'claude-opus-4-6 — $15/$75 за M',
        'deepseek': 'DeepSeek Direct — $0.07/$1.1 за M',
        'qwen':     'Qwen Plus Direct — ~$0.14/$0.56 за M',
    }

    import redis as _redis
    r = _redis.Redis(host='localhost', port=6379, db=1, decode_responses=True)

    if choice == 'status':
        current = r.get('claudia:active_model') or 'haiku'
        lines = ['<b>Текущая модель:</b> ' + current + chr(10)]
        for k, v in MODEL_LABELS.items():
            mark = '✅ ' if k == current else '   '
            lines.append(mark + f'/model {k} — {v}')
        await update.message.reply_text(chr(10).join(lines), parse_mode='HTML')
        return

    if choice not in MODEL_LABELS:
        await update.message.reply_text(
            'Доступные: /model haiku | sonnet | opus | deepseek'
        )
        return

    r.set('claudia:active_model', choice)
    label = MODEL_LABELS[choice]
    await update.message.reply_text(
        chr(9989) + ' Модель: <b>' + choice + '</b>' + chr(10) + label,
        parse_mode='HTML'
    )'''

new_cmd_model = '''# ═══ КОМАНДИР СИСТЕМЫ: выбор модели ИИ ═══════════════════════════════════
MODEL_INFO = {
    'haiku':    {'name': 'Haiku 4.5',   'price': '$0.8 / $4',    'speed': 'быстро',   'quality': '★★'},
    'sonnet':   {'name': 'Sonnet 4.6',  'price': '$3 / $15',     'speed': 'средне',   'quality': '★★★★'},
    'opus':     {'name': 'Opus 4.7',    'price': '$15 / $75',    'speed': 'медленно', 'quality': '★★★★★'},
    'deepseek': {'name': 'DeepSeek V3', 'price': '$0.07 / $1.1', 'speed': 'быстро',   'quality': '★★★'},
    'qwen':     {'name': 'Qwen Plus',   'price': '$0.14 / $0.56','speed': 'быстро',   'quality': '★★'},
}


def _render_model_menu(current: str) -> tuple:
    """Генерирует текст + inline-клавиатуру выбора модели."""
    buttons = []
    for key, info in MODEL_INFO.items():
        mark = '● ' if key == current else ''
        btn_text = mark + info['name'] + '  ' + info['quality']
        buttons.append([InlineKeyboardButton(btn_text, callback_data='model:' + key)])
    cur_info = MODEL_INFO[current]
    text = (
        '🎛 <b>КОМАНДИР СИСТЕМЫ</b>\\n\\n'
        'Текущая модель: <b>' + cur_info['name'] + '</b>\\n'
        'Цена: ' + cur_info['price'] + ' · Скорость: ' + cur_info['speed'] + '\\n\\n'
        'Выбери главную модель ИИ:'
    )
    return text, InlineKeyboardMarkup(buttons)


async def cmd_model(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Командир — выбор основной модели ИИ."""
    args = ctx.args or []
    import redis as _redis
    r = _redis.Redis(host='localhost', port=6379, db=1, decode_responses=True)
    current = r.get('claudia:active_model') or 'haiku'

    # /model <name> — прямое переключение (для голоса/скриптов)
    if args and args[0].lower() in MODEL_INFO:
        choice = args[0].lower()
        r.set('claudia:active_model', choice)
        info = MODEL_INFO[choice]
        await update.message.reply_text(
            '✅ Модель: <b>' + info['name'] + '</b>\\n' +
            'Цена: ' + info['price'] + ' · Скорость: ' + info['speed'] + ' · ' + info['quality'],
            parse_mode='HTML',
        )
        return

    text, keyboard = _render_model_menu(current)
    await update.message.reply_text(text, parse_mode='HTML', reply_markup=keyboard)


async def on_model_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Обработчик нажатия кнопки выбора модели."""
    query = update.callback_query
    await query.answer('Переключено')
    if not query.data or not query.data.startswith('model:'):
        return
    choice = query.data.split(':', 1)[1]
    if choice not in MODEL_INFO:
        return

    import redis as _redis
    r = _redis.Redis(host='localhost', port=6379, db=1, decode_responses=True)
    r.set('claudia:active_model', choice)

    text, keyboard = _render_model_menu(choice)
    try:
        await query.edit_message_text(text, parse_mode='HTML', reply_markup=keyboard)
    except Exception:
        pass'''

if old_cmd_model in src:
    src = src.replace(old_cmd_model, new_cmd_model)
    print('✓ /model — inline-кнопки "Командир"')

# ── 5. Регистрация callback handler ───────────────────────────────────────
if 'on_model_callback' in src and 'CallbackQueryHandler(on_model_callback' not in src:
    import re
    m = re.search(r"(    app\.add_handler\(CommandHandler\('model',\s*cmd_model\)\))", src)
    if m:
        old_line = m.group(1)
        new_line = old_line + "\n    app.add_handler(CallbackQueryHandler(on_model_callback, pattern=r'^model:'))"
        src = src.replace(old_line, new_line, 1)
        print('✓ CallbackQueryHandler зарегистрирован')
    else:
        # /model еще не был зарегистрирован — добавляем после /memory
        hook = "    app.add_handler(CommandHandler('memory',   cmd_memory))"
        new_hook = (
            hook + "\n"
            "    app.add_handler(CommandHandler('model',    cmd_model))\n"
            "    app.add_handler(CallbackQueryHandler(on_model_callback, pattern=r'^model:'))"
        )
        if hook in src and "CommandHandler('model'" not in src:
            src = src.replace(hook, new_hook, 1)
            print('✓ /model + callback зарегистрирован')

SRC.write_text(src, encoding='utf-8')
print('\nФайл записан.')

# Проверка синтаксиса
import ast
try:
    ast.parse(src)
    print('✓ Syntax OK')
except SyntaxError as e:
    print(f'✗ Syntax ERROR at line {e.lineno}: {e.msg}')
