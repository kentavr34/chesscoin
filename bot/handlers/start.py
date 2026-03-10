import os
import logging
from aiogram import Router, F
from aiogram.filters import CommandStart, CommandObject
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

from services.backend import BackendClient

logger = logging.getLogger(__name__)
router = Router()

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://chesscoin.app")


def play_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="♟ Играть в ChessCoin",
                    web_app=WebAppInfo(url=FRONTEND_URL),
                )
            ],
            [
                InlineKeyboardButton(
                    text="🏆 Рейтинг",
                    web_app=WebAppInfo(url=f"{FRONTEND_URL}/leaderboard"),
                ),
                InlineKeyboardButton(
                    text="👥 Рефералы",
                    callback_data="referral_info",
                ),
            ],
        ]
    )


# ─────────────────────────────────────────
# /start с реферальной ссылкой
# ─────────────────────────────────────────
@router.message(CommandStart(deep_link=True))
async def cmd_start_with_ref(message: Message, command: CommandObject):
    referrer_id = None
    if command.args and command.args.startswith("ref_"):
        referrer_id = command.args[4:]

    user = message.from_user
    name = user.first_name or "Игрок"

    # ── Красивое Welcome уведомление ──
    await message.answer_photo(
        photo="https://chesscoin.app/banner.png",
        caption=(
            f"♟ <b>Добро пожаловать в ChessCoin, {name}!</b>\n\n"
            f"Ты получил приветственный бонус:\n"
            f"<b>┌─────────────────────────┐</b>\n"
            f"<b>│  🎁  +5 000 ᚙ  на старт  │</b>\n"
            f"<b>└─────────────────────────┘</b>\n\n"
            f"Что тебя ждёт:\n"
            f"⚔️  Батлы на ставку с живыми игроками\n"
            f"🤖  Игры с J.A.R.V.I.S — до <b>+20 000 ᚙ</b>\n"
            f"🌍  Войны сборных стран\n"
            f"👥  Реферальная программа: <b>50%</b> с побед друзей\n\n"
            f"<i>Твои монеты уже зачислены. Открой приложение и начинай!</i>"
        ),
        reply_markup=play_keyboard(),
    )

    # Уведомляем бэкенд о реферере (бэкенд сохранит связь при auth/login)
    if referrer_id:
        try:
            async with BackendClient() as client:
                await client.register_referral_start(
                    new_telegram_id=str(user.id),
                    referrer_telegram_id=referrer_id,
                )
        except Exception as e:
            logger.warning(f"register_referral_start failed: {e}")


# ─────────────────────────────────────────
# /start без реферала
# ─────────────────────────────────────────
@router.message(CommandStart())
async def cmd_start(message: Message):
    user = message.from_user
    name = user.first_name or "Игрок"

    await message.answer_photo(
        photo="https://chesscoin.app/banner.png",
        caption=(
            f"♟ <b>Добро пожаловать в ChessCoin, {name}!</b>\n\n"
            f"Ты получил приветственный бонус:\n"
            f"<b>┌─────────────────────────┐</b>\n"
            f"<b>│  🎁  +5 000 ᚙ  на старт  │</b>\n"
            f"<b>└─────────────────────────┘</b>\n\n"
            f"Что тебя ждёт:\n"
            f"⚔️  Батлы на ставку с живыми игроками\n"
            f"🤖  Игры с J.A.R.V.I.S — до <b>+20 000 ᚙ</b>\n"
            f"🌍  Войны сборных стран\n"
            f"👥  Реферальная программа: <b>50%</b> с побед друзей\n\n"
            f"<i>Твои монеты уже зачислены. Открой приложение и начинай!</i>"
        ),
        reply_markup=play_keyboard(),
    )


# ─────────────────────────────────────────
# Кнопка «Рефералы»
# ─────────────────────────────────────────
@router.callback_query(F.data == "referral_info")
async def referral_info(callback):
    user = callback.from_user
    bot_username = (await callback.bot.get_me()).username
    ref_link = f"https://t.me/{bot_username}?start=ref_{user.id}"

    await callback.message.answer(
        f"👥 <b>Реферальная программа</b>\n\n"
        f"Приглашай — зарабатывай автоматически:\n\n"
        f"  🥇 <b>50%</b> от каждого выигрыша друга\n"
        f"  🥈 <b>10%</b> от выигрышей его друзей\n"
        f"  🎁 <b>+3 000 ᚙ</b> когда друг сыграет первую партию\n\n"
        f"<i>Бонус начисляется только после первой сыгранной партии — "
        f"не за простую регистрацию.</i>\n\n"
        f"Твоя ссылка:\n"
        f"<code>{ref_link}</code>\n\n"
        f"<i>Нажми на ссылку чтобы скопировать</i>",
    )
    await callback.answer()
