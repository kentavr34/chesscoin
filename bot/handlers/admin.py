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


# ─── FSM: Загрузка premium-аватара (A2 Кенан 2026-05-19) ──────────────────────
class AvatarCreateForm(StatesGroup):
    image = State()       # photo или document с картинкой
    name = State()
    price = State()
    rarity = State()


# ─── Клавиатуры ────────────────────────────────────────────────────────────────
def main_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📊 Статистика", callback_data="admin:stats_menu"),
            InlineKeyboardButton(text="📋 Задания", callback_data="admin:tasks_menu"),
        ],
        [
            InlineKeyboardButton(text="🖼️ Add Avatar", callback_data="avatar:create_start"),
            InlineKeyboardButton(text="🗑️ Очистка БД", callback_data="admin:cleanup_menu"),
        ],
        [
            InlineKeyboardButton(text="⚙️ Система", callback_data="admin:system_menu"),
        ],
    ])


def avatar_rarity_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="COMMON", callback_data="avatar:rarity:COMMON"),
            InlineKeyboardButton(text="RARE", callback_data="avatar:rarity:RARE"),
        ],
        [
            InlineKeyboardButton(text="EPIC", callback_data="avatar:rarity:EPIC"),
            InlineKeyboardButton(text="LEGENDARY", callback_data="avatar:rarity:LEGENDARY"),
        ],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="avatar:cancel")],
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


def _fmt_coins(val) -> str:
    """Форматирует большое число (str/int) с разделителями + краткой суффикс-формой.
    PR-3 (Кенан 2026-05-18): для удобного чтения админских сумм типа 1.2 млрд."""
    try:
        n = int(str(val))
    except Exception:
        return str(val)
    if n >= 1_000_000_000:
        return f"{n / 1_000_000_000:.2f} млрд ({n:,})".replace(",", " ")
    if n >= 1_000_000:
        return f"{n / 1_000_000:.2f} млн ({n:,})".replace(",", " ")
    if n >= 1_000:
        return f"{n:,}".replace(",", " ")
    return str(n)


def _pct(part, total) -> str:
    try:
        p = int(str(part))
        t = int(str(total))
        if t == 0:
            return "—"
        return f"{p / t * 100:.1f}%"
    except Exception:
        return "—"


@router.message(Command("stats"))
async def cmd_stats(message: Message):
    if not is_admin(message.from_user.id):
        return  # silent ignore для не-админов (по требованию Кенана)
    try:
        async with BackendClient() as client:
            stats = await client.get_stats()

        in_circ = stats.get("totalInCirculation", "0")
        users_bal = stats.get("usersBalance", "0")
        reserve = stats.get("platformReserve", "0")
        countries_t = stats.get("countriesTreasury", "0")
        tour_pool = stats.get("tournamentsPool", "0")

        top10 = stats.get("top10", []) or []
        top10_lines = "\n".join(
            f"  {i+1}. <b>{(u.get('firstName') or '—')}</b>"
            + (f" (@{u['username']})" if u.get("username") else "")
            + f" — {_fmt_coins(u.get('balance', '0'))}"
            for i, u in enumerate(top10)
        ) or "  —"

        text = (
            f"📊 <b>Экономика ChessCoin</b>\n\n"
            f"В обороте всего: <b>{_fmt_coins(in_circ)} ᚙ</b>\n"
            f"  • В кассе платформы: <b>{_fmt_coins(reserve)}</b> ({_pct(reserve, in_circ)})\n"
            f"  • На балансах юзеров: <b>{_fmt_coins(users_bal)}</b> ({_pct(users_bal, in_circ)})\n"
            f"  • В казнах стран: <b>{_fmt_coins(countries_t)}</b> ({_pct(countries_t, in_circ)})\n"
            f"  • В активных турнирах: <b>{_fmt_coins(tour_pool)}</b> ({_pct(tour_pool, in_circ)})\n\n"
            f"Эмитировано всего: <b>{_fmt_coins(stats.get('totalEmitted', '0'))}</b>\n"
            f"Фаза эмиссии: <b>{stats.get('currentPhase', '—')}</b>\n\n"
            f"<b>За 24ч:</b>\n"
            f"  • Новых юзеров: <b>{stats.get('newUsersToday', '—')}</b>\n"
            f"  • Активных юзеров: <b>{stats.get('activeUsers24h', '—')}</b>\n"
            f"  • Покупок в магазине/TON: <b>{stats.get('shopPurchasesToday', '—')}</b>\n"
            f"  • Призовых выплат: <b>{stats.get('prizePayoutsToday', '—')}</b>\n\n"
            f"<b>Игры всего:</b>\n"
            f"  • Сессий: <b>{stats.get('totalSessions', '—')}</b>\n"
            f"  • Батлов: <b>{stats.get('totalBattles', '—')}</b>\n"
            f"  • Юзеров: <b>{stats.get('totalUsers', '—')}</b>\n\n"
            f"<b>Топ-10 балансов:</b>\n{top10_lines}\n\n"
            f"💡 Полная панель: /admin"
        )
        await message.answer(text)
    except Exception as e:
        logger.error(f"Ошибка получения статистики: {e}")
        await message.answer(f"❌ Ошибка: {e}")


@router.message(Command("broadcast"))
async def cmd_broadcast(message: Message, bot: Bot):
    if not is_admin(message.from_user.id):
        return  # silent ignore
    text = message.text.removeprefix("/broadcast").strip()
    if not text:
        # PR-3: «/broadcast» без текста → запускаем FSM-визард (см. ниже).
        return await message.answer(
            "📢 <b>Мастер рассылки</b>\n\n"
            "Пройди шаги — отправлю всем пользователям/в канал с фото и кнопкой.\n\n"
            "Альтернатива быстрая: <code>/broadcast Текст сообщения</code> — "
            "отправит только текст всем юзерам без визарда.",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="📝 Запустить визард", callback_data="bc:start")]
            ]),
        )
    # Legacy одношаговая рассылка (быстрая)
    await message.answer("📤 Рассылка запущена...")
    try:
        async with BackendClient() as client:
            result = await client.broadcast(text=text, target="users")
        sent = result.get("sent", 0)
        failed = result.get("failed", 0)
        await message.answer(f"✅ Отправлено: {sent}, ошибок: {failed}")
    except Exception as e:
        logger.error(f"Ошибка рассылки: {e}")
        await message.answer(f"❌ Ошибка: {e}")


# ─── PR-3: FSM-визард рассылки (Кенан 2026-05-18) ────────────────────────────
# Шаги:
#  1) текст сообщения (HTML ок)
#  2) фото — URL или /skip
#  3) кнопка? «Да/Нет» → если да: название + URL
#  4) куда — users / channel / both
#  5) предпросмотр + подтверждение → POST /bot/broadcast
class BroadcastForm(StatesGroup):
    text = State()
    photo = State()
    button_yesno = State()
    button_text = State()
    button_url = State()
    target = State()
    confirm = State()


def _bc_target_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="👥 Юзерам в личку", callback_data="bc:tgt:users")],
        [InlineKeyboardButton(text="📺 В канал", callback_data="bc:tgt:channel")],
        [InlineKeyboardButton(text="📢 И туда, и туда", callback_data="bc:tgt:both")],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="bc:cancel")],
    ])


def _bc_yesno_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Да", callback_data="bc:btn:yes"),
            InlineKeyboardButton(text="➖ Нет", callback_data="bc:btn:no"),
        ],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="bc:cancel")],
    ])


@router.callback_query(F.data == "bc:start")
async def cb_bc_start(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await state.clear()
    await state.set_state(BroadcastForm.text)
    await call.message.edit_text(
        "📢 <b>Рассылка — шаг 1/5</b>\n\n"
        "Введи текст сообщения. Можно HTML: <b>жирный</b>, <i>курсив</i>, "
        "<a href='https://...'>ссылка</a>.\n\n"
        "Для отмены — /cancel"
    )


@router.message(Command("cancel"), F.text)
async def cmd_cancel(message: Message, state: FSMContext):
    cur = await state.get_state()
    if cur and cur.startswith("BroadcastForm"):
        await state.clear()
        await message.answer("❌ Рассылка отменена")


@router.callback_query(F.data == "bc:cancel")
async def cb_bc_cancel(call: CallbackQuery, state: FSMContext):
    await state.clear()
    await call.message.edit_text("❌ Рассылка отменена")


@router.message(BroadcastForm.text)
async def bc_step_text(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await state.update_data(text=message.text)
    await state.set_state(BroadcastForm.photo)
    await message.answer(
        "📢 <b>Шаг 2/5 — Фото</b>\n\n"
        "Пришли URL картинки (https://...) или /skip без фото.\n"
        "Поддерживается также file_id если знаешь его."
    )


@router.message(BroadcastForm.photo)
async def bc_step_photo(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    raw = message.text.strip()
    photo = None if raw == "/skip" else raw
    await state.update_data(photo=photo)
    await state.set_state(BroadcastForm.button_yesno)
    await message.answer(
        "📢 <b>Шаг 3/5 — Кнопка</b>\n\nДобавить inline-кнопку под сообщением?",
        reply_markup=_bc_yesno_kb(),
    )


@router.callback_query(F.data == "bc:btn:no", BroadcastForm.button_yesno)
async def cb_bc_btn_no(call: CallbackQuery, state: FSMContext):
    await state.update_data(button=None)
    await state.set_state(BroadcastForm.target)
    await call.message.edit_text(
        "📢 <b>Шаг 4/5 — Куда отправить?</b>",
        reply_markup=_bc_target_kb(),
    )


@router.callback_query(F.data == "bc:btn:yes", BroadcastForm.button_yesno)
async def cb_bc_btn_yes(call: CallbackQuery, state: FSMContext):
    await state.set_state(BroadcastForm.button_text)
    await call.message.edit_text(
        "📢 <b>Шаг 3a/5 — Название кнопки</b>\n\n"
        "Введи текст на кнопке (до 30 символов):"
    )


@router.message(BroadcastForm.button_text)
async def bc_step_btn_text(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await state.update_data(btn_text=message.text.strip()[:30])
    await state.set_state(BroadcastForm.button_url)
    await message.answer(
        "📢 <b>Шаг 3b/5 — URL кнопки</b>\n\n"
        "Введи URL куда поведёт кнопка (https://...):"
    )


@router.message(BroadcastForm.button_url)
async def bc_step_btn_url(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    url = message.text.strip()
    if not (url.startswith("http://") or url.startswith("https://") or url.startswith("tg://")):
        return await message.answer("❌ URL должен начинаться с http://, https:// или tg://")
    data = await state.get_data()
    await state.update_data(button={"text": data.get("btn_text", "Открыть"), "url": url})
    await state.set_state(BroadcastForm.target)
    await message.answer(
        "📢 <b>Шаг 4/5 — Куда отправить?</b>",
        reply_markup=_bc_target_kb(),
    )


@router.callback_query(F.data.startswith("bc:tgt:"), BroadcastForm.target)
async def cb_bc_target(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    target = call.data.split(":", 2)[2]  # users / channel / both
    await state.update_data(target=target)
    data = await state.get_data()
    btn = data.get("button")
    btn_preview = f"\n  Кнопка: <b>{btn['text']}</b> → {btn['url']}" if btn else "\n  Кнопка: —"
    photo_preview = f"\n  Фото: {data.get('photo')}" if data.get("photo") else "\n  Фото: —"
    target_label = {"users": "👥 Юзерам", "channel": "📺 В канал", "both": "📢 Юзерам + в канал"}.get(target, target)
    await state.set_state(BroadcastForm.confirm)
    await call.message.edit_text(
        f"📢 <b>Шаг 5/5 — Подтверждение</b>\n\n"
        f"<b>Цель:</b> {target_label}{photo_preview}{btn_preview}\n\n"
        f"<b>Текст:</b>\n{data.get('text', '')[:500]}\n\n"
        f"Отправляем?",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🚀 Отправить", callback_data="bc:send")],
            [InlineKeyboardButton(text="❌ Отмена", callback_data="bc:cancel")],
        ]),
    )


@router.callback_query(F.data == "bc:send", BroadcastForm.confirm)
async def cb_bc_send(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    data = await state.get_data()
    await state.clear()
    await call.message.edit_text("⏳ Рассылка запущена... (это может занять минуты при большой базе)")
    try:
        async with BackendClient() as client:
            result = await client.broadcast(
                text=data.get("text"),
                photo=data.get("photo"),
                button=data.get("button"),
                target=data.get("target", "users"),
            )
        target = data.get("target", "users")
        lines = ["✅ <b>Рассылка завершена</b>\n"]
        if target in ("users", "both"):
            lines.append(f"👥 Юзерам: отправлено <b>{result.get('sent', 0)}</b>, ошибок <b>{result.get('failed', 0)}</b>")
        if target in ("channel", "both"):
            lines.append(f"📺 В канал: {'✅ опубликовано' if result.get('channelOk') else '❌ не удалось'}")
        await call.message.edit_text("\n".join(lines))
    except Exception as e:
        logger.error(f"Ошибка визард-рассылки: {e}")
        await call.message.edit_text(f"❌ Ошибка: {e}")


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


# ─── A2: FSM Add Premium Avatar (Кенан 2026-05-19) ────────────────────────────
# Flow: /admin → 🖼️ Add Avatar →
#   image (photo or doc) → name → price → rarity → POST /bot/items/avatar
import os as _os

AVATAR_STORAGE_DIR = _os.environ.get(
    "AVATAR_STORAGE_DIR", "/var/lib/chesscoin/avatars"
)
PUBLIC_AVATAR_BASE_URL = _os.environ.get(
    "PUBLIC_AVATAR_BASE_URL",
    "https://chesscoin.app/static/avatars",
)


@router.callback_query(F.data == "avatar:create_start")
async def cb_avatar_create_start(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    await state.clear()
    await state.set_state(AvatarCreateForm.image)
    await call.message.edit_text(
        "🖼️ <b>Добавление premium-аватара</b>\n\n"
        "Шаг 1/4: пришли картинку фото-сообщением или документом (.png/.jpg/.svg).\n\n"
        "/cancel для отмены",
        reply_markup=back_kb("admin:main"),
    )


@router.callback_query(F.data == "avatar:cancel")
async def cb_avatar_cancel(call: CallbackQuery, state: FSMContext):
    await state.clear()
    await call.message.edit_text(
        "❌ Загрузка отменена.\n\n🛡️ Панель администратора:",
        reply_markup=main_menu_kb(),
    )


@router.message(AvatarCreateForm.image, F.photo | F.document)
async def fsm_avatar_image(message: Message, state: FSMContext, bot: Bot):
    if not is_admin(message.from_user.id):
        return
    # Получаем file_id из photo (последняя — наибольшее разрешение) или document
    file_id = None
    suffix = ".png"
    if message.photo:
        file_id = message.photo[-1].file_id
        suffix = ".jpg"
    elif message.document:
        file_id = message.document.file_id
        mt = (message.document.mime_type or "").lower()
        if "svg" in mt:
            suffix = ".svg"
        elif "png" in mt:
            suffix = ".png"
        elif "jpeg" in mt or "jpg" in mt:
            suffix = ".jpg"
        elif "webp" in mt:
            suffix = ".webp"
    if not file_id:
        return await message.answer("❌ Нужно фото или картинка-документ")

    try:
        _os.makedirs(AVATAR_STORAGE_DIR, exist_ok=True)
    except Exception:
        pass

    file = await bot.get_file(file_id)
    # имя файла = file_unique_id для дедупликации
    fname = f"{file.file_unique_id}{suffix}"
    dest = _os.path.join(AVATAR_STORAGE_DIR, fname)
    try:
        await bot.download_file(file.file_path, destination=dest)
        image_url = f"{PUBLIC_AVATAR_BASE_URL.rstrip('/')}/{fname}"
    except Exception as e:
        return await message.answer(f"❌ Ошибка сохранения файла: {e}")

    await state.update_data(image_url=image_url, image_path=dest)
    await state.set_state(AvatarCreateForm.name)
    await message.answer(
        "✅ Картинка сохранена.\n\n"
        f"<code>{image_url}</code>\n\n"
        "Шаг 2/4: пришли <b>название</b> аватара (например: «Dragon Knight»)"
    )


@router.message(AvatarCreateForm.image)
async def fsm_avatar_image_invalid(message: Message):
    await message.answer("❌ Нужно прислать фото или картинка-документ (.png/.jpg/.svg)")


@router.message(AvatarCreateForm.name, F.text)
async def fsm_avatar_name(message: Message, state: FSMContext):
    name = (message.text or "").strip()
    if not name or len(name) > 80:
        return await message.answer("❌ Название от 1 до 80 символов")
    await state.update_data(name=name)
    await state.set_state(AvatarCreateForm.price)
    await message.answer(
        "Шаг 3/4: пришли <b>цену в монетах</b> (число, например: 500)"
    )


@router.message(AvatarCreateForm.price, F.text)
async def fsm_avatar_price(message: Message, state: FSMContext):
    txt = (message.text or "").strip()
    if not txt.isdigit() or int(txt) <= 0:
        return await message.answer("❌ Цена — положительное целое число")
    price = int(txt)
    if price > 10_000_000:
        return await message.answer("❌ Цена слишком большая (макс. 10_000_000)")
    await state.update_data(price=price)
    await state.set_state(AvatarCreateForm.rarity)
    await message.answer(
        f"Шаг 4/4: выбери редкость (цена: {price}):",
        reply_markup=avatar_rarity_kb(),
    )


@router.callback_query(F.data.startswith("avatar:rarity:"), AvatarCreateForm.rarity)
async def cb_avatar_rarity(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return await call.answer("❌ Нет доступа", show_alert=True)
    rarity = call.data.split(":")[-1]
    data = await state.get_data()
    await state.clear()
    payload = {
        "name": data.get("name"),
        "description": "Premium avatar (admin upload)",
        "priceCoins": data.get("price"),
        "imageUrl": data.get("image_url"),
        "rarity": rarity,
    }
    try:
        async with BackendClient() as client:
            result = await client.create_avatar_item(payload)
        await call.message.edit_text(
            "✅ <b>Premium-аватар создан</b>\n\n"
            f"Имя: <b>{result.get('name')}</b>\n"
            f"Цена: {result.get('priceCoins')} монет\n"
            f"Редкость: {result.get('rarity')}\n"
            f"URL: <code>{data.get('image_url')}</code>\n\n"
            "Теперь он виден всем игрокам в магазине → вкладка Avatars.",
            reply_markup=main_menu_kb(),
        )
    except Exception as e:
        logger.exception("[admin avatar create]")
        await call.message.edit_text(
            f"❌ Ошибка создания: {e}\n\n🛡️ Панель администратора:",
            reply_markup=main_menu_kb(),
        )
