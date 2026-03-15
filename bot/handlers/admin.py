import logging
from aiogram import Router, F, Bot
from aiogram.filters import Command
from aiogram.types import (
    Message,
    CallbackQuery,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
)
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from services.backend import BackendClient
from config import ADMIN_IDS

logger = logging.getLogger(__name__)
router = Router()


def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


# ─── FSM: Создание задания ─────────────────────────────────────────────────────
class TaskCreateForm(StatesGroup):
    task_type = State()
    title = State()
    description = State()
    reward = State()
    metadata = State()


# ─── Клавиатуры ────────────────────────────────────────────────────────────────
def main_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📊 Статистика", callback_data="admin:stats_menu"),
            InlineKeyboardButton(text="📋 Задания", callback_data="admin:tasks_menu"),
        ],
        [
            InlineKeyboardButton(text="🗑️ Очистка БД", callback_data="admin:cleanup_menu"),
            InlineKeyboardButton(text="⚙️ Система", callback_data="admin:system_menu"),
        ],
    ])


def stats_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="👥 Пользователи", callback_data="stats:users")],
        [InlineKeyboardButton(text="🎮 Игры и сессии", callback_data="stats:sessions")],
        [InlineKeyboardButton(text="💰 Экономика", callback_data="stats:economy")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="admin:main")],
    ])


def tasks_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📜 Список заданий", callback_data="tasks:list")],
        [InlineKeyboardButton(text="➕ Создать задание", callback_data="tasks:create")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="admin:main")],
    ])


def cleanup_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💀 Мёртвые аккаунты", callback_data="cleanup:dead_preview")],
        [InlineKeyboardButton(text="🔄 Зависшие партии", callback_data="cleanup:sessions_preview")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="admin:main")],
    ])


def system_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔄 Рестарт бэкенда", callback_data="system:restart_confirm")],
        [InlineKeyboardButton(text="📢 Рассылка", callback_data="system:broadcast_hint")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="admin:main")],
    ])


def confirm_kb(yes_data: str, no_data: str = "admin:main") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Подтвердить", callback_data=yes_data),
            InlineKeyboardButton(text="❌ Отмена", callback_data=no_data),
        ]
    ])


def back_kb(data: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="◀️ Назад", callback_data=data)]
    ])


def task_type_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔗 Перейти по ссылке", callback_data="tasktype:FOLLOW_LINK")],
        [InlineKeyboardButton(text="📢 Подписаться на канал", callback_data="tasktype:SUBSCRIBE_TELEGRAM")],
        [InlineKeyboardButton(text="🔑 Ввести код", callback_data="tasktype:ENTER_CODE")],
        [InlineKeyboardButton(text="👥 Рефералы", callback_data="tasktype:REFERRAL")],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="tasks:create_cancel")],
    ])


TASK_TYPE_NAMES = {
    "FOLLOW_LINK": "🔗 Перейти по ссылке",
    "SUBSCRIBE_TELEGRAM": "📢 Подписаться на канал",
    "ENTER_CODE": "🔑 Ввести код",
    "REFERRAL": "👥 Рефералы",
}

TASK_TYPE_ICONS = {
    "FOLLOW_LINK": "🔗",
    "SUBSCRIBE_TELEGRAM": "📢",
    "ENTER_CODE": "🔑",
    "REFERRAL": "👥",
}


# ─── /admin — Главное меню ─────────────────────────────────────────────────────
@router.message(Command("admin"))
async def cmd_admin(message: Message):
    if not is_admin(message.from_user.id):
        return await message.answer("❌ Нет доступа")
    await message.answer(
        "🛡️ <b>Панель администратора ChessCoin</b>\n\nВыберите раздел:",
        reply_markup=main_menu_kb(),
    )


@router.callback_query(F.data == "admin:main")
async def cb_admin_main(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await call.message.edit_text(
        "🛡️ <b>Панель администратора ChessCoin</b>\n\nВыберите раздел:",
        reply_markup=main_menu_kb(),
    )


# ─── Статистика ────────────────────────────────────────────────────────────────
@router.callback_query(F.data == "admin:stats_menu")
async def cb_stats_menu(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await call.message.edit_text(
        "📊 <b>Статистика</b>\n\nВыберите раздел:",
        reply_markup=stats_menu_kb(),
    )


@router.callback_query(F.data == "stats:users")
async def cb_stats_users(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await call.answer("⏳ Загрузка...")
    try:
        async with BackendClient() as client:
            stats = await client.get_detailed_stats()
        u = stats.get("users", {})
        league_icons = {
            "BRONZE": "🥉", "SILVER": "🥈", "GOLD": "🥇",
            "DIAMOND": "💎", "CHAMPION": "🏆", "STAR": "⭐",
        }
        leagues_text = "\n".join(
            f"  {league_icons.get(k, '•')} {k}: <b>{v}</b>"
            for k, v in u.get("byLeague", {}).items()
        )
        text = (
            f"👥 <b>Статистика пользователей</b>\n\n"
            f"📌 Всего: <b>{u.get('total', '—')}</b>\n"
            f"🆕 Сегодня: <b>{u.get('today', '—')}</b>\n"
            f"📅 За неделю: <b>{u.get('week', '—')}</b>\n"
            f"📆 За месяц: <b>{u.get('month', '—')}</b>\n\n"
            f"<b>По лигам:</b>\n{leagues_text}"
        )
        await call.message.edit_text(text, reply_markup=back_kb("admin:stats_menu"))
    except Exception as e:
        await call.message.edit_text(f"❌ Ошибка: {e}", reply_markup=back_kb("admin:stats_menu"))


@router.callback_query(F.data == "stats:sessions")
async def cb_stats_sessions(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await call.answer("⏳ Загрузка...")
    try:
        async with BackendClient() as client:
            stats = await client.get_detailed_stats()
        s = stats.get("sessions", {})
        text = (
            f"🎮 <b>Игровые сессии</b>\n\n"
            f"📌 Всего партий: <b>{s.get('total', '—')}</b>\n"
            f"⚔️ Батлов: <b>{s.get('battles', '—')}</b>\n"
            f"🤖 С ботом: <b>{s.get('bot', '—')}</b>\n"
            f"🤝 Дружеских: <b>{s.get('friendly', '—')}</b>\n\n"
            f"<b>Активные прямо сейчас:</b>\n"
            f"  ⏳ Ожидают соперника: <b>{s.get('waiting', '—')}</b>\n"
            f"  🕹️ Идут сейчас: <b>{s.get('inProgress', '—')}</b>\n\n"
            f"<b>Зависших (нужна очистка):</b>\n"
            f"  ⚠️ Ожидание &gt;1 ч: <b>{s.get('stuckWaiting', '—')}</b>\n"
            f"  ⚠️ В процессе &gt;6 ч: <b>{s.get('stuckInProgress', '—')}</b>"
        )
        await call.message.edit_text(text, reply_markup=back_kb("admin:stats_menu"))
    except Exception as e:
        await call.message.edit_text(f"❌ Ошибка: {e}", reply_markup=back_kb("admin:stats_menu"))


@router.callback_query(F.data == "stats:economy")
async def cb_stats_economy(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await call.answer("⏳ Загрузка...")
    try:
        async with BackendClient() as client:
            stats = await client.get_detailed_stats()
        e = stats.get("economy", {})
        text = (
            f"💰 <b>Экономика</b>\n\n"
            f"📈 Фаза: <b>{e.get('phase', '—')}</b>\n"
            f"🏦 Эмиттировано: <b>{e.get('totalEmitted', '—')} ᚙ</b>\n"
            f"🔒 Резерв: <b>{e.get('reserve', '—')} ᚙ</b>\n"
            f"💎 Цена токена: <b>${e.get('tokenPrice', '—')}</b>\n\n"
            f"<b>Комиссии (батлы):</b>\n"
            f"  💸 Собрано всего: <b>{e.get('totalCommission', '—')} ᚙ</b>\n\n"
            f"<b>TON / Выводы:</b>\n"
            f"  📥 Депозитов TON: <b>{e.get('tonDeposits', '—')}</b>\n"
            f"  ⏳ Выводов (ожидание): <b>{e.get('pendingWithdrawals', '—')}</b>\n"
            f"  ✅ Выводов (выполнено): <b>{e.get('completedWithdrawals', '—')}</b>"
        )
        await call.message.edit_text(text, reply_markup=back_kb("admin:stats_menu"))
    except Exception as e:
        await call.message.edit_text(f"❌ Ошибка: {e}", reply_markup=back_kb("admin:stats_menu"))


# ─── Задания ───────────────────────────────────────────────────────────────────
@router.callback_query(F.data == "admin:tasks_menu")
async def cb_tasks_menu(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await call.message.edit_text(
        "📋 <b>Социальные задания</b>\n\nВыберите действие:",
        reply_markup=tasks_menu_kb(),
    )


async def _render_tasks_list(call: CallbackQuery, tasks: list):
    if not tasks:
        return await call.message.edit_text(
            "📋 Нет заданий.", reply_markup=back_kb("admin:tasks_menu")
        )
    kb_rows = []
    text = "📋 <b>Список заданий</b>\n\n"
    for i, task in enumerate(tasks, 1):
        status_icon = "✅" if task.get("status") == "ACTIVE" else "📦"
        completions = task.get("_count", {}).get("completedBy", 0)
        text += (
            f"{i}. {status_icon} <b>{task.get('title', '—')}</b>\n"
            f"   Тип: {task.get('taskType', '—')} | "
            f"Награда: {task.get('winningAmount', '—')} ᚙ | "
            f"Выполнено: {completions}\n\n"
        )
        toggle_label = f"📦 Архив #{i}" if task.get("status") == "ACTIVE" else f"✅ Активировать #{i}"
        kb_rows.append([
            InlineKeyboardButton(text=toggle_label, callback_data=f"task:toggle:{task['id']}"),
            InlineKeyboardButton(text=f"🗑️ #{i}", callback_data=f"task:delete:{task['id']}"),
        ])
    kb_rows.append([InlineKeyboardButton(text="◀️ Назад", callback_data="admin:tasks_menu")])
    await call.message.edit_text(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=kb_rows))


@router.callback_query(F.data == "tasks:list")
async def cb_tasks_list(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await call.answer("⏳ Загрузка...")
    try:
        async with BackendClient() as client:
            tasks = await client.get_tasks()
        await _render_tasks_list(call, tasks)
    except Exception as e:
        await call.message.edit_text(f"❌ Ошибка: {e}", reply_markup=back_kb("admin:tasks_menu"))


@router.callback_query(F.data.startswith("task:toggle:"))
async def cb_task_toggle(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    task_id = call.data.split(":", 2)[2]
    try:
        async with BackendClient() as client:
            result = await client.toggle_task(task_id)
        new_status = result.get("status", "?")
        await call.answer(f"✅ Статус изменён: {new_status}", show_alert=True)
        async with BackendClient() as client:
            tasks = await client.get_tasks()
        await _render_tasks_list(call, tasks)
    except Exception as e:
        await call.answer(f"❌ Ошибка: {e}", show_alert=True)


@router.callback_query(F.data.startswith("task:delete:"))
async def cb_task_delete_confirm(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    task_id = call.data.split(":", 2)[2]
    await call.message.edit_text(
        "⚠️ <b>Удалить задание?</b>\n\n"
        "Это действие необратимо. Все записи о выполнении будут удалены.",
        reply_markup=confirm_kb(f"task:delete_confirm:{task_id}", "tasks:list"),
    )


@router.callback_query(F.data.startswith("task:delete_confirm:"))
async def cb_task_delete(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    task_id = call.data.split(":", 2)[2]
    try:
        async with BackendClient() as client:
            await client.delete_task(task_id)
        await call.answer("✅ Задание удалено", show_alert=True)
        await call.message.edit_text(
            "📋 <b>Социальные задания</b>\n\nВыберите действие:",
            reply_markup=tasks_menu_kb(),
        )
    except Exception as e:
        await call.answer(f"❌ Ошибка: {e}", show_alert=True)


# ─── Создание задания (FSM-wizard) ─────────────────────────────────────────────
@router.callback_query(F.data == "tasks:create")
async def cb_task_create_start(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await state.clear()
    await state.set_state(TaskCreateForm.task_type)
    await call.message.edit_text(
        "➕ <b>Создание задания</b>\n\nШаг 1/5: Выберите тип задания:",
        reply_markup=task_type_kb(),
    )


@router.callback_query(F.data == "tasks:create_cancel")
async def cb_task_create_cancel(call: CallbackQuery, state: FSMContext):
    await state.clear()
    await call.message.edit_text(
        "📋 <b>Социальные задания</b>\n\nВыберите действие:",
        reply_markup=tasks_menu_kb(),
    )


@router.callback_query(F.data.startswith("tasktype:"), TaskCreateForm.task_type)
async def cb_task_type_selected(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    task_type = call.data.split(":", 1)[1]
    await state.update_data(task_type=task_type)
    await state.set_state(TaskCreateForm.title)
    await call.message.edit_text(
        f"➕ <b>Создание задания</b>\n\n"
        f"Тип: <b>{TASK_TYPE_NAMES.get(task_type, task_type)}</b>\n\n"
        f"Шаг 2/5: Введите название задания:"
    )


@router.message(TaskCreateForm.title)
async def fsm_task_title(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await state.update_data(title=message.text.strip())
    await state.set_state(TaskCreateForm.description)
    await message.answer("Шаг 3/5: Введите описание задания (или /skip для пропуска):")


@router.message(TaskCreateForm.description)
async def fsm_task_description(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    desc = None if message.text.strip() == "/skip" else message.text.strip()
    await state.update_data(description=desc)
    await state.set_state(TaskCreateForm.reward)
    await message.answer("Шаг 4/5: Введите размер награды в ᚙ (например: 5000):")


@router.message(TaskCreateForm.reward)
async def fsm_task_reward(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    text = message.text.strip()
    if not text.isdigit():
        return await message.answer("❌ Введите целое положительное число (например: 5000)")
    await state.update_data(reward=int(text))
    data = await state.get_data()
    task_type = data.get("task_type")
    hints = {
        "FOLLOW_LINK": "Введите URL ссылки (например: https://t.me/chessgamecoin):",
        "SUBSCRIBE_TELEGRAM": "Введите username канала без @ (например: chessgamecoin):",
        "ENTER_CODE": "Введите секретный промокод (например: PROMO2026):",
        "REFERRAL": "Введите минимальное число рефералов (например: 3):",
    }
    await state.set_state(TaskCreateForm.metadata)
    await message.answer(f"Шаг 5/5: {hints.get(task_type, 'Введите метаданные:')}")


@router.message(TaskCreateForm.metadata)
async def fsm_task_metadata(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    data = await state.get_data()
    task_type = data.get("task_type")
    raw = message.text.strip()

    if task_type == "FOLLOW_LINK":
        metadata = {"url": raw}
    elif task_type == "SUBSCRIBE_TELEGRAM":
        metadata = {"channelId": raw, "channelUsername": raw}
    elif task_type == "ENTER_CODE":
        metadata = {"code": raw.upper()}
    elif task_type == "REFERRAL":
        if not raw.isdigit():
            return await message.answer("❌ Введите целое число (количество рефералов)")
        metadata = {"referralCount": int(raw)}
    else:
        metadata = {}

    await state.update_data(metadata=metadata)
    data = await state.get_data()

    confirm_text = (
        f"📋 <b>Проверьте задание перед созданием:</b>\n\n"
        f"Тип: <b>{TASK_TYPE_NAMES.get(task_type, task_type)}</b>\n"
        f"Название: <b>{data.get('title')}</b>\n"
        f"Описание: <b>{data.get('description') or '—'}</b>\n"
        f"Награда: <b>{data.get('reward'):,} ᚙ</b>\n"
        f"Метаданные: <code>{metadata}</code>"
    )
    await message.answer(
        confirm_text,
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Создать", callback_data="task:create_confirm"),
                InlineKeyboardButton(text="❌ Отмена", callback_data="task:create_cancel_fsm"),
            ]
        ]),
    )


@router.callback_query(F.data == "task:create_confirm")
async def cb_task_create_confirm(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    data = await state.get_data()
    await state.clear()
    task_type = data.get("task_type", "")
    try:
        async with BackendClient() as client:
            result = await client.create_task({
                "taskType": task_type,
                "title": data.get("title"),
                "description": data.get("description"),
                "winningAmount": data.get("reward"),
                "metadata": data.get("metadata", {}),
                "icon": TASK_TYPE_ICONS.get(task_type, "🎯"),
                "status": "ACTIVE",
            })
        await call.message.edit_text(
            f"✅ <b>Задание создано!</b>\n\nID: <code>{result.get('id', '—')}</code>",
            reply_markup=back_kb("admin:tasks_menu"),
        )
    except Exception as e:
        await call.message.edit_text(
            f"❌ Ошибка создания: {e}",
            reply_markup=back_kb("admin:tasks_menu"),
        )


@router.callback_query(F.data == "task:create_cancel_fsm")
async def cb_task_create_cancel_fsm(call: CallbackQuery, state: FSMContext):
    await state.clear()
    await call.message.edit_text(
        "📋 <b>Социальные задания</b>\n\nВыберите действие:",
        reply_markup=tasks_menu_kb(),
    )


# ─── Очистка БД ────────────────────────────────────────────────────────────────
@router.callback_query(F.data == "admin:cleanup_menu")
async def cb_cleanup_menu(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await call.message.edit_text(
        "🗑️ <b>Операции с базой данных</b>\n\nВыберите операцию:",
        reply_markup=cleanup_menu_kb(),
    )


@router.callback_query(F.data == "cleanup:dead_preview")
async def cb_cleanup_dead_preview(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await call.message.edit_text(
        "💀 <b>Очистка мёртвых аккаунтов</b>\n\n"
        "Будут удалены пользователи:\n"
        "• Зарегистрированы более 30 дней назад\n"
        "• Ни разу не сыграли ни одной партии\n"
        "• Не забанены, не боты\n\n"
        "⚠️ Это необратимая операция!",
        reply_markup=confirm_kb("cleanup:dead_run", "admin:cleanup_menu"),
    )


@router.callback_query(F.data == "cleanup:dead_run")
async def cb_cleanup_dead_run(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await call.answer("⏳ Запускаю очистку...")
    await call.message.edit_text("⏳ <b>Очистка мёртвых аккаунтов запущена...</b>")
    try:
        async with BackendClient() as client:
            result = await client.cleanup_dead()
        count = result.get("removed", 0)
        await call.message.edit_text(
            f"✅ <b>Очистка завершена</b>\n\nУдалено аккаунтов: <b>{count}</b>",
            reply_markup=back_kb("admin:cleanup_menu"),
        )
    except Exception as e:
        await call.message.edit_text(
            f"❌ Ошибка: {e}", reply_markup=back_kb("admin:cleanup_menu")
        )


@router.callback_query(F.data == "cleanup:sessions_preview")
async def cb_cleanup_sessions_preview(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await call.message.edit_text(
        "🔄 <b>Очистка зависших партий</b>\n\n"
        "Будут завершены:\n"
        "• «Ожидание соперника» старше 1 часа → <b>CANCELLED</b>\n"
        "  (ставки в батлах возвращаются)\n"
        "• «В процессе» без активности 6+ часов → <b>DRAW</b>\n\n"
        "⚠️ Это необратимая операция!",
        reply_markup=confirm_kb("cleanup:sessions_run", "admin:cleanup_menu"),
    )


@router.callback_query(F.data == "cleanup:sessions_run")
async def cb_cleanup_sessions_run(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await call.answer("⏳ Запускаю очистку...")
    await call.message.edit_text("⏳ <b>Очистка зависших партий запущена...</b>")
    try:
        async with BackendClient() as client:
            result = await client.cleanup_sessions()
        text = (
            f"✅ <b>Очистка завершена</b>\n\n"
            f"Отменено (ожидание): <b>{result.get('cancelledWaiting', 0)}</b>\n"
            f"Завершено как ничья: <b>{result.get('drawnStuck', 0)}</b>\n"
            f"Возвращено ставок: <b>{result.get('refundedBets', 0)}</b>"
        )
        await call.message.edit_text(text, reply_markup=back_kb("admin:cleanup_menu"))
    except Exception as e:
        await call.message.edit_text(
            f"❌ Ошибка: {e}", reply_markup=back_kb("admin:cleanup_menu")
        )


# ─── Система ───────────────────────────────────────────────────────────────────
@router.callback_query(F.data == "admin:system_menu")
async def cb_system_menu(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await call.message.edit_text(
        "⚙️ <b>Система</b>\n\nВыберите действие:",
        reply_markup=system_menu_kb(),
    )


@router.callback_query(F.data == "system:restart_confirm")
async def cb_restart_confirm(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await call.message.edit_text(
        "🔄 <b>Рестарт бэкенда</b>\n\n"
        "⚠️ Сервер будет перезапущен.\n"
        "Docker автоматически поднимет контейнер обратно.\n\n"
        "Продолжить?",
        reply_markup=confirm_kb("system:restart_run", "admin:system_menu"),
    )


@router.callback_query(F.data == "system:restart_run")
async def cb_restart_run(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await call.answer("⏳ Отправка команды...")
    try:
        async with BackendClient() as client:
            await client.restart_backend()
        await call.message.edit_text(
            "✅ <b>Команда отправлена</b>\n\n"
            "Бэкенд перезапускается. Подождите 10-15 секунд.",
            reply_markup=back_kb("admin:main"),
        )
    except Exception:
        # Connection reset when server exits — expected
        await call.message.edit_text(
            "✅ <b>Рестарт инициирован</b>\n\n"
            "Соединение оборвалось — это нормально, сервер перезапускается.",
            reply_markup=back_kb("admin:main"),
        )


@router.callback_query(F.data == "system:broadcast_hint")
async def cb_broadcast_hint(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await call.message.edit_text(
        "📢 <b>Рассылка всем пользователям</b>\n\n"
        "Используйте команду:\n"
        "<code>/broadcast Ваш текст сообщения</code>\n\n"
        "Поддерживается HTML-форматирование.",
        reply_markup=back_kb("admin:system_menu"),
    )


# ─── Существующие команды (/stats, /broadcast, /ban) ──────────────────────────
@router.message(Command("stats"))
async def cmd_stats(message: Message):
    if not is_admin(message.from_user.id):
        return await message.answer("❌ Нет доступа")
    try:
        async with BackendClient() as client:
            stats = await client.get_stats()
        await message.answer(
            f"📊 <b>Статистика ChessCoin</b>\n\n"
            f"👥 Игроков: <b>{stats.get('totalUsers', '—')}</b>\n"
            f"🎮 Игр сыграно: <b>{stats.get('totalSessions', '—')}</b>\n"
            f"⚔️ Батлов: <b>{stats.get('totalBattles', '—')}</b>\n"
            f"💰 Выдано ᚙ: <b>{stats.get('totalEmitted', '—')}</b>\n"
            f"🏦 Резерв: <b>{stats.get('platformReserve', '—')}</b>\n"
            f"📈 Фаза: <b>{stats.get('currentPhase', '—')}</b>\n\n"
            f"💡 Полная панель: /admin",
        )
    except Exception as e:
        logger.error(f"Ошибка получения статистики: {e}")
        await message.answer(f"❌ Ошибка: {e}")


@router.message(Command("broadcast"))
async def cmd_broadcast(message: Message, bot: Bot):
    if not is_admin(message.from_user.id):
        return await message.answer("❌ Нет доступа")
    text = message.text.removeprefix("/broadcast").strip()
    if not text:
        return await message.answer("❌ Укажи текст: /broadcast Ваше сообщение")
    await message.answer("📤 Рассылка запущена...")
    try:
        async with BackendClient() as client:
            result = await client.broadcast(text)
        sent = result.get("sent", 0)
        failed = result.get("failed", 0)
        await message.answer(f"✅ Отправлено: {sent}, ошибок: {failed}")
    except Exception as e:
        logger.error(f"Ошибка рассылки: {e}")
        await message.answer(f"❌ Ошибка: {e}")


@router.message(Command("ban"))
async def cmd_ban(message: Message):
    if not is_admin(message.from_user.id):
        return await message.answer("❌ Нет доступа")
    parts = message.text.split()
    if len(parts) < 2 or not parts[1].isdigit():
        return await message.answer("❌ Укажи Telegram ID: /ban 123456789")
    tg_id = parts[1]
    try:
        async with BackendClient() as client:
            await client.ban_user(tg_id)
        await message.answer(f"✅ Пользователь {tg_id} заблокирован")
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")
