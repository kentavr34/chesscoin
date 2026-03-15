import logging
from aiogram import Router, F, Bot
from aiogram.filters import Command
from aiogram.types import Message

from services.backend import BackendClient
from config import ADMIN_IDS

logger = logging.getLogger(__name__)
router = Router()


def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


# ─── Middleware: только для админов ──────────────────────────────────────────
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
            f"📈 Фаза: <b>{stats.get('currentPhase', '—')}</b>",
        )
    except Exception as e:
        logger.error(f"Ошибка получения статистики: {e}")
        await message.answer(f"❌ Ошибка: {e}")


@router.message(Command("broadcast"))
async def cmd_broadcast(message: Message, bot: Bot):
    """
    /broadcast Текст сообщения
    Отправляет сообщение всем активным пользователям через бэкенд.
    """
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
    """
    /ban 123456789  — забанить пользователя по Telegram ID
    """
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
