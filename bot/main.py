import asyncio
import logging
import os
from dotenv import load_dotenv

BOT_VERSION = "v6.0.6"

from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import BotCommand, BotCommandScopeDefault

from handlers.start import router as start_router
from handlers.admin import router as admin_router
from handlers.notifications import start_notifications_loop

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN не задан в .env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ─── Команды для меню BotFather (отображаются в Telegram UI) ─────────────────
# Устанавливаем на двух языках — Telegram покажет нужный по языку пользователя

BOT_COMMANDS_RU = [
    BotCommand(command="start",  description="🎮 Открыть ChessCoin"),
    BotCommand(command="play",   description="♟ Играть прямо сейчас"),
    BotCommand(command="invite", description="👥 Моя реферальная ссылка"),
    BotCommand(command="help",   description="❓ Справка"),
]

BOT_COMMANDS_EN = [
    BotCommand(command="start",  description="🎮 Open ChessCoin"),
    BotCommand(command="play",   description="♟ Play right now"),
    BotCommand(command="invite", description="👥 My referral link"),
    BotCommand(command="help",   description="❓ Help"),
]


async def set_commands(bot: Bot):
    """Регистрирует команды в меню бота для всех языков."""
    from aiogram.types import BotCommandScopeDefault, BotCommandScopeAllPrivateChats

    # Дефолт — английский (для всех остальных языков)
    await bot.set_my_commands(BOT_COMMANDS_EN, scope=BotCommandScopeDefault())

    # Русский язык
    try:
        from aiogram.types import BotCommandScopeAllPrivateChats
        await bot.set_my_commands(
            BOT_COMMANDS_RU,
            scope=BotCommandScopeDefault(),
            language_code="ru",
        )
    except Exception as e:
        logger.warning(f"Could not set RU commands: {e}")

    logger.info("✅ Bot commands registered in Telegram menu")


async def main():
    bot = Bot(
        token=BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher(storage=MemoryStorage())

    dp.include_router(start_router)
    dp.include_router(admin_router)

    logger.info(f"ChessCoin Bot {BOT_VERSION} запущен ♟")

    # Регистрируем команды
    await set_commands(bot)

    # Фоновые уведомления
    asyncio.create_task(start_notifications_loop(bot))

    # ── Webhook (production) vs Polling (dev) ──────────────────────────────────
    # Webhook: ~10x эффективнее polling (нет постоянного HTTP опроса Telegram)
    # Polling: удобен для разработки (не нужен публичный URL)
    #
    # Для webhook: задать WEBHOOK_URL в .env бота
    # Например: WEBHOOK_URL=https://chesscoin.app/bot/webhook
    import os as _os
    webhook_url = _os.getenv("WEBHOOK_URL", "")

    if webhook_url:
        logger.info(f"[Bot] Webhook mode: {webhook_url}")
        from aiohttp import web
        from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application

        await bot.set_webhook(
            url=webhook_url,
            secret_token=_os.getenv("BOT_WEBHOOK_SECRET", "chesscoin_wh_secret"),
            drop_pending_updates=True,
        )
        app = web.Application()
        SimpleRequestHandler(
            dispatcher=dp, bot=bot,
            secret_token=_os.getenv("BOT_WEBHOOK_SECRET", "chesscoin_wh_secret"),
        ).register(app, path="/bot/webhook")
        setup_application(app, dp, bot=bot)
        runner = web.AppRunner(app)
        await runner.setup()
        await web.TCPSite(runner, "0.0.0.0", int(_os.getenv("BOT_PORT", "8080"))).start()
        logger.info("[Bot] Webhook server on :8080")
        await asyncio.Event().wait()  # ждём бесконечно
    else:
        logger.info("[Bot] Polling mode (dev)")
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
