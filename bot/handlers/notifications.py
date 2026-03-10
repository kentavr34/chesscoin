"""
Обработчик AdminNotification из БД.
Бэкенд создаёт записи в AdminNotification,
бот их читает через polling и отправляет красивые сообщения.
"""
import asyncio
import logging
from aiogram import Bot
from services.backend import BackendClient

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────
# Красивое уведомление рефереру о том,
# что его реферал сыграл первую партию
# ─────────────────────────────────────────
REFERRAL_ACTIVATED_TMPL = """
╔══════════════════════════╗
║  👥  РЕФЕРАЛ АКТИВИРОВАН  ║
╚══════════════════════════╝

Игрок <b>{new_player_name}</b> сыграл свою первую партию!

Ты получил реферальный бонус:
<b>+{bonus_fmt} ᚙ</b> зачислено на твой счёт ✅

━━━━━━━━━━━━━━━━━━━━━━━━━
Дальнейшая активность {new_player_name} \
будет автоматически приносить тебе доход:

⚔️  <b>50%</b> от каждой победы в батле
🤖  <b>50%</b> от побед над J.A.R.V.I.S

Предложи сыграть дружескую партию:
/invite — отправить ссылку-приглашение
━━━━━━━━━━━━━━━━━━━━━━━━━

<i>Приглашай ещё — зарабатывай больше!</i>
""".strip()


GAME_WIN_TMPL = """
🏆 <b>Победа!</b>

Ты выиграл и получил:
<b>+{amount_fmt} ᚙ</b> зачислено на счёт ✅
<i>(комиссия стола: −{commission_fmt} ᚙ)</i>

Возвращайся за следующей победой! ♟
""".strip()

DEAD_PLAYERS_CLEANED_TMPL = """
🗑 <b>Ежемесячная чистка завершена</b>

Удалено мёртвых игроков: <b>{count}</b>
(зарегистрировались, но ни разу не сыграли за 30+ дней)

Дата чистки: {date}
Их данные архивированы в analytics_cleanup.
""".strip()


async def process_admin_notifications(bot: Bot) -> None:
    """
    Читает непрочитанные AdminNotification и отправляет сообщения.
    Вызывается каждые 30 секунд из polling loop.
    """
    try:
        async with BackendClient() as client:
            notifications = await client.get_pending_notifications()

        for notif in notifications:
            try:
                await _dispatch(bot, notif)
                async with BackendClient() as client:
                    await client.mark_notification_sent(notif["id"])
            except Exception as e:
                logger.error(f"Failed to send notification {notif['id']}: {e}")

    except Exception as e:
        logger.warning(f"process_admin_notifications error: {e}")


async def _dispatch(bot: Bot, notif: dict) -> None:
    t = notif["type"]
    p = notif["payload"]

    if t == "REFERRAL_ACTIVATED":
        telegram_id = p.get("referrerTelegramId")
        if not telegram_id:
            return
        bonus = int(p.get("bonus", 3000))
        text = REFERRAL_ACTIVATED_TMPL.format(
            new_player_name=p.get("newPlayerName", "Игрок"),
            bonus_fmt=f"{bonus:,}".replace(",", " "),
        )
        await bot.send_message(telegram_id, text)

    elif t == "GAME_WIN":
        telegram_id = p.get("winnerTelegramId")
        if not telegram_id:
            return
        amount = int(p.get("amount", 0))
        commission = int(p.get("commission", 0))
        text = GAME_WIN_TMPL.format(
            amount_fmt=f"{amount:,}".replace(",", " "),
            commission_fmt=f"{commission:,}".replace(",", " "),
        )
        await bot.send_message(telegram_id, text)

    elif t == "DEAD_PLAYERS_CLEANED":
        # Отправляем всем admin_ids
        from config import ADMIN_IDS
        from datetime import datetime
        date_str = datetime.now().strftime("%d.%m.%Y")
        text = DEAD_PLAYERS_CLEANED_TMPL.format(
            count=p.get("count", 0),
            date=date_str,
        )
        for admin_id in ADMIN_IDS:
            try:
                await bot.send_message(admin_id, text)
            except Exception as e:
                logger.warning(f"Cannot send to admin {admin_id}: {e}")


# ─────────────────────────────────────────
# Запуск фоновой задачи внутри бота
# ─────────────────────────────────────────
async def start_notifications_loop(bot: Bot) -> None:
    """Запускается при старте бота как asyncio задача."""
    logger.info("[Notifications] Loop started (interval: 30s)")
    while True:
        await asyncio.sleep(30)
        await process_admin_notifications(bot)
