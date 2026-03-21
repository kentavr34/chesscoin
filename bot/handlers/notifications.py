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

WAR_ENDING_SOON_TMPL = """
⏰ <b>Война заканчивается через 1 час!</b>

{attacker_flag} <b>{attacker_name}</b> vs {defender_flag} <b>{defender_name}</b>
Счёт: <b>{attacker_wins}:{defender_wins}</b>

Это последний шанс повлиять на исход!
Заходи и бейся за свою страну прямо сейчас! ⚔️
""".strip()

WAR_DECLARED_TMPL = """
⚔️ <b>Война объявлена!</b>

{attacker_flag} <b>{attacker_name}</b> объявила войну {defender_flag} <b>{defender_name}</b>!

Ваша страна атакована. Ведите своих бойцов в бой!
Откройте приложение, чтобы принять вызов.
""".strip()

WAR_STARTED_TMPL = """
🌍 <b>Война началась!</b>

{attacker_flag} <b>{attacker_name}</b> vs {defender_flag} <b>{defender_name}</b>

Сражение уже идёт! Вступайте в бой за свою страну.
Каждая победа приближает вас к триумфу!
""".strip()

WAR_FINISHED_WIN_TMPL = """
🏆 <b>Победа в войне!</b>

{winner_flag} <b>{winner_name}</b> победила {loser_flag} <b>{loser_name}</b>!
Счёт: <b>{attacker_wins}:{defender_wins}</b>

Ваша страна одержала победу! Слава героям! ⚔️
""".strip()

WAR_FINISHED_LOSS_TMPL = """
💔 <b>Война проиграна</b>

{winner_flag} <b>{winner_name}</b> победила {loser_flag} <b>{loser_name}</b>.
Счёт: <b>{attacker_wins}:{defender_wins}</b>

Не сдавайтесь — следующая война за вами! ♟
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

    elif t == "WAR_ENDING_SOON":
        telegram_id = p.get("telegramId")
        if not telegram_id:
            return
        text = WAR_ENDING_SOON_TMPL.format(
            attacker_flag=p.get("attackerFlag", "🏳️"),
            attacker_name=p.get("attackerName", ""),
            defender_flag=p.get("defenderFlag", "🏳️"),
            defender_name=p.get("defenderName", ""),
            attacker_wins=p.get("attackerWins", 0),
            defender_wins=p.get("defenderWins", 0),
        )
        await bot.send_message(telegram_id, text, parse_mode="HTML")

    elif t == "WAR_DECLARED":
        telegram_id = p.get("telegramId")
        if not telegram_id:
            return
        text = WAR_DECLARED_TMPL.format(
            attacker_flag=p.get("attackerFlag", "🏳️"),
            attacker_name=p.get("attackerName", ""),
            defender_flag=p.get("defenderFlag", "🏳️"),
            defender_name=p.get("defenderName", ""),
        )
        await bot.send_message(telegram_id, text, parse_mode="HTML")

    elif t == "WAR_STARTED":
        telegram_id = p.get("telegramId")
        if not telegram_id:
            return
        text = WAR_STARTED_TMPL.format(
            attacker_flag=p.get("attackerFlag", "🏳️"),
            attacker_name=p.get("attackerName", ""),
            defender_flag=p.get("defenderFlag", "🏳️"),
            defender_name=p.get("defenderName", ""),
        )
        await bot.send_message(telegram_id, text, parse_mode="HTML")

    elif t == "WAR_FINISHED":
        telegram_id = p.get("telegramId")
        if not telegram_id:
            return
        won = p.get("won", False)
        tmpl = WAR_FINISHED_WIN_TMPL if won else WAR_FINISHED_LOSS_TMPL
        text = tmpl.format(
            winner_flag=p.get("winnerFlag", "🏳️"),
            winner_name=p.get("winnerName", ""),
            loser_flag=p.get("loserFlag", "🏳️"),
            loser_name=p.get("loserName", ""),
            attacker_wins=p.get("attackerWins", 0),
            defender_wins=p.get("defenderWins", 0),
        )
        await bot.send_message(telegram_id, text, parse_mode="HTML")

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

    # BUG-05 fix: добавлены обработчики турнирных уведомлений
    elif t == "TOURNAMENT_MATCH":
        telegram_id = p.get("telegramId")
        if not telegram_id:
            return
        opponent = p.get("opponentName", "Соперник")
        tournament_name = p.get("tournamentName", "Турнир")
        round_num = p.get("round", 1)
        deadline = p.get("deadline", "")
        text = (
            f"🏆 <b>Турнирный матч назначен!</b>\n\n"
            f"📋 Турнир: <b>{tournament_name}</b>\n"
            f"⚔️ Соперник: <b>{opponent}</b>\n"
            f"🔢 Раунд: {round_num}\n\n"
            f"⏰ У вас <b>24 часа</b> чтобы сыграть матч.\n"
            f"Если не сыграете — засчитывается поражение."
        )
        try:
            await bot.send_message(telegram_id, text, parse_mode="HTML")
        except Exception as e:
            logger.warning(f"TOURNAMENT_MATCH notify failed for {telegram_id}: {e}")

    elif t == "TOURNAMENT_WIN":
        telegram_id = p.get("telegramId")
        if not telegram_id:
            return
        name = p.get("name", "Игрок")
        tournament_name = p.get("tournamentName", "Турнир")
        place = p.get("place", 1)
        prize = int(p.get("prize", 0))
        place_emoji = "🥇" if place == 1 else "🥈" if place == 2 else "🥉"
        prize_fmt = f"{prize:,}".replace(",", " ")
        text = (
            f"{place_emoji} <b>Поздравляем, {name}!</b>\n\n"
            f"Ты занял <b>{place} место</b> в турнире\n"
            f"«{tournament_name}»!\n\n"
            f"💰 Приз: <b>+{prize_fmt} ᚙ</b> начислены на баланс.\n\n"
            f"♟ Открой приложение чтобы продолжить!"
        )
        try:
            await bot.send_message(telegram_id, text, parse_mode="HTML")
        except Exception as e:
            logger.warning(f"TOURNAMENT_WIN notify failed for {telegram_id}: {e}")

    # Fix 3: Уведомление Ежемесячного Чемпиона
    elif t == "MONTHLY_CHAMPION":
        telegram_id = p.get("telegramId")
        if not telegram_id:
            return
        name = p.get("name", "Игрок")
        elo = p.get("elo", 0)
        month = p.get("month", "")
        text = (
            f"👑 <b>Поздравляем, {name}!</b>\n\n"
            f"Ты стал <b>Ежемесячным Чемпионом</b> ChessCoin"
            f"{f' за {month}' if month else ''}!\n\n"
            f"🏆 Твой ELO: <b>{elo}</b> — лучший среди всех игроков.\n\n"
            f"Бейдж 👑 появился в твоём профиле. Удержи звание!"
        )
        try:
            await bot.send_message(telegram_id, text, parse_mode="HTML")
        except Exception as e:
            logger.warning(f"MONTHLY_CHAMPION notify failed for {telegram_id}: {e}")


    # v7.0.3: P2P биржа — ордер исполнен (продавцу)
    elif t == "EXCHANGE_ORDER_SOLD":
        telegram_id = p.get("telegramId")
        if not telegram_id:
            return
        amount_coins = int(p.get("amountCoins", 0))
        total_ton    = float(p.get("totalTon", 0))
        buyer_name   = p.get("buyerName", "Покупатель")
        coins_fmt    = f"{amount_coins:,}".replace(",", " ")
        text = (
            f"💱 <b>Ордер исполнен!</b>\n\n"
            f"Покупатель <b>{buyer_name}</b> купил твои монеты:\n"
            f"📦 <b>{coins_fmt} ᚙ</b>\n"
            f"💎 Получено: <b>{total_ton:.4f} TON</b>\n\n"
            f"Открой приложение чтобы увидеть баланс!"
        )
        try:
            await bot.send_message(telegram_id, text, parse_mode="HTML")
        except Exception as e:
            logger.warning(f"EXCHANGE_ORDER_SOLD notify failed for {telegram_id}: {e}")

    # v7.0.3: P2P биржа — ордер исполнен (покупателю)
    elif t == "EXCHANGE_ORDER_BOUGHT":
        telegram_id = p.get("telegramId")
        if not telegram_id:
            return
        amount_coins = int(p.get("amountCoins", 0))
        total_ton    = float(p.get("totalTon", 0))
        coins_fmt    = f"{amount_coins:,}".replace(",", " ")
        text = (
            f"🛒 <b>Покупка завершена!</b>\n\n"
            f"Ты купил <b>{coins_fmt} ᚙ</b>\n"
            f"за <b>{total_ton:.4f} TON</b>\n\n"
            f"Монеты уже на твоём балансе. Удачи в игре! ♟"
        )
        try:
            await bot.send_message(telegram_id, text, parse_mode="HTML")
        except Exception as e:
            logger.warning(f"EXCHANGE_ORDER_BOUGHT notify failed for {telegram_id}: {e}")



    elif t == "EXCHANGE_ORDER_CANCELLED_STALE":
        # Продавец получает уведомление об авто-отмене старого ордера
        telegram_id = p.get("sellerTelegramId")
        if not telegram_id:
            return
        amount_coins = p.get("amountCoins", "0")
        text = (
            f"⚠️ <b>Ордер отменён автоматически</b>\n\n"
            f"Твой ордер на продажу <b>{int(amount_coins):,} ᚙ</b> "
            f"простоял более 30 дней без исполнения и был отменён.\n\n"
            f"Монеты возвращены на твой игровой баланс. "
            f"Создай новый ордер в разделе 💱 Биржа."
        )
        try:
            await bot.send_message(telegram_id, text, parse_mode="HTML")
        except Exception as e:
            logger.warning(f"EXCHANGE_ORDER_CANCELLED_STALE notify failed for {telegram_id}: {e}")


    elif t == "EXCHANGE_VERIFY_FAILED":
        # Алерт администратору — транзакция не прошла верификацию
        # В production: отправлять только администраторам
        order_id  = p.get("orderId", "?")
        reason    = p.get("reason", "unknown")
        text = (
            f"🚨 <b>EXCHANGE: верификация не прошла</b>\n\n"
            f"Order ID: <code>{order_id}</code>\n"
            f"Причина: {reason}\n\n"
            f"Требуется ручная проверка!"
        )
        # Отправляем только если задан ADMIN_TELEGRAM_ID
        import os
        admin_id = os.getenv("ADMIN_TELEGRAM_ID")
        if admin_id:
            try:
                await bot.send_message(admin_id, text, parse_mode="HTML")
            except Exception as e:
                logger.warning(f"EXCHANGE_VERIFY_FAILED admin notify failed: {e}")


# ─────────────────────────────────────────
# Запуск фоновой задачи внутри бота
# ─────────────────────────────────────────
async def start_notifications_loop(bot: Bot) -> None:
    """Запускается при старте бота как asyncio задача."""
    logger.info("[Notifications] Loop started (interval: 30s)")
    while True:
        await asyncio.sleep(30)
        await process_admin_notifications(bot)
