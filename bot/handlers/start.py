import os
import logging
from aiogram import Router, F
from aiogram.filters import CommandStart, CommandObject
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo, CallbackQuery

from services.backend import BackendClient

logger = logging.getLogger(__name__)
router = Router()

FRONTEND_URL = os.getenv("WEBAPP_URL", "https://chesscoin.app")


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


def welcome_text(name: str, is_referred: bool = False) -> str:
    bonus_line = "🎁 Твой реферальный бонус +3 000 ᚙ начислится когда ты сыграешь первую партию!\n\n" if is_referred else ""
    return (
        f"♟ <b>Добро пожаловать в ChessCoin, {name}!</b>\n\n"
        f"Ты получил приветственный бонус:\n"
        f"<b>┌─────────────────────────┐</b>\n"
        f"<b>│  🎁  +5 000 ᚙ  на старт  │</b>\n"
        f"<b>└─────────────────────────┘</b>\n\n"
        f"{bonus_line}"
        f"Что тебя ждёт:\n"
        f"⚔️  Батлы на ставку с живыми игроками\n"
        f"🤖  Игры с J.A.R.V.I.S — до <b>+20 000 ᚙ</b>\n"
        f"🌍  Войны сборных стран\n"
        f"👥  Реферальная программа: <b>50%</b> с побед друзей\n\n"
        f"<i>Твои монеты уже зачислены. Открой приложение и начинай!</i>"
    )


# ─────────────────────────────────────────
# /start с реферальной ссылкой
# ─────────────────────────────────────────
@router.message(CommandStart(deep_link=True))
async def cmd_start_with_ref(message: Message, command: CommandObject):
    referrer_id = None
    battle_code = None

    args = command.args or ""

    # Format: battle_CODE_ref_TELEGRAMID
    if args.startswith("battle_"):
        parts = args.split("_ref_", 1)
        battle_code = parts[0][len("battle_"):]  # strip "battle_" prefix
        if len(parts) == 2:
            referrer_id = parts[1]
    # Format: ref_TELEGRAMID
    elif args.startswith("ref_"):
        referrer_id = args[4:]

    user = message.from_user
    name = user.first_name or "Игрок"

    # Register referral with backend
    if referrer_id:
        try:
            async with BackendClient() as client:
                await client.register_referral_start(
                    new_telegram_id=str(user.id),
                    referrer_telegram_id=referrer_id,
                )
        except Exception as e:
            logger.warning(f"register_referral_start failed: {e}")

    # If came via battle invite, show battle-specific welcome
    if battle_code:
        battle_url = f"{FRONTEND_URL}/battles?join={battle_code}"
        await message.answer(
            f"♟ <b>Добро пожаловать в ChessCoin, {name}!</b>\n\n"
            f"Тебя пригласили на <b>приватный батл</b>!\n\n"
            f"Ты получил приветственный бонус:\n"
            f"<b>┌─────────────────────────┐</b>\n"
            f"<b>│  🎁  +5 000 ᚙ  на старт  │</b>\n"
            f"<b>└─────────────────────────┘</b>\n\n"
            f"{'🎁 Реферальный бонус +3 000 ᚙ начислится после первой партии!'+chr(10)+chr(10) if referrer_id else ''}"
            f"<i>Нажми кнопку ниже чтобы присоединиться к батлу:</i>",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(
                            text="⚔️ Войти в батл",
                            web_app=WebAppInfo(url=battle_url),
                        )
                    ],
                    [
                        InlineKeyboardButton(
                            text="♟ Играть в ChessCoin",
                            web_app=WebAppInfo(url=FRONTEND_URL),
                        )
                    ],
                ]
            ),
        )
    else:
        await message.answer(
            welcome_text(name, is_referred=bool(referrer_id)),
            reply_markup=play_keyboard(),
        )


# ─────────────────────────────────────────
# /start без реферала
# ─────────────────────────────────────────
@router.message(CommandStart())
async def cmd_start(message: Message):
    user = message.from_user
    name = user.first_name or "Игрок"

    await message.answer(
        welcome_text(name),
        reply_markup=play_keyboard(),
    )


# ─────────────────────────────────────────
# Кнопка «Рефералы»
# ─────────────────────────────────────────
@router.callback_query(F.data == "referral_info")
async def referral_info(callback: CallbackQuery):
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


# ─────────────────────────────────────────
# /invite — отправить реферальную ссылку
# ─────────────────────────────────────────
@router.message(F.text == "/invite")
async def cmd_invite(message: Message):
    user = message.from_user
    bot_username = (await message.bot.get_me()).username
    ref_link = f"https://t.me/{bot_username}?start=ref_{user.id}"
    share_url = f"https://t.me/share/url?url={ref_link}&text=♟ Играй в ChessCoin — зарабатывай монеты в шахматах!"

    await message.answer(
        f"👥 <b>Твоя реферальная ссылка:</b>\n\n"
        f"<code>{ref_link}</code>\n\n"
        f"Отправь другу — когда он сыграет первую игру, ты получишь <b>+3 000 ᚙ</b> "
        f"и <b>50%</b> от каждой его победы навсегда!\n\n"
        f"<a href=\"{share_url}\">📤 Поделиться в Telegram</a>",
        disable_web_page_preview=True,
    )
