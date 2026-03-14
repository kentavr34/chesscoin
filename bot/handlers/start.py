import os
import logging
from aiogram import Router, F
from aiogram.filters import CommandStart, CommandObject
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo, CallbackQuery

from services.backend import BackendClient
from i18n import t

logger = logging.getLogger(__name__)
router = Router()

FRONTEND_URL = os.getenv("WEBAPP_URL", "https://chesscoin.app")


def play_keyboard(lang: str | None) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=t(lang, "btn_play"),
                    web_app=WebAppInfo(url=FRONTEND_URL),
                )
            ],
            [
                InlineKeyboardButton(
                    text=t(lang, "btn_leaderboard"),
                    web_app=WebAppInfo(url=f"{FRONTEND_URL}/leaderboard"),
                ),
                InlineKeyboardButton(
                    text=t(lang, "btn_referrals"),
                    callback_data="referral_info",
                ),
            ],
        ]
    )


def welcome_text(name: str, lang: str | None, is_referred: bool = False) -> str:
    bonus_line = t(lang, "referral_bonus_line") if is_referred else ""
    return (
        f"{t(lang, 'welcome_title').format(name=name)}\n\n"
        f"{t(lang, 'welcome_bonus')}\n\n"
        f"{bonus_line}"
        f"{t(lang, 'welcome_features')}"
    )


# ─────────────────────────────────────────
# /start with deep link
# ─────────────────────────────────────────
@router.message(CommandStart(deep_link=True))
async def cmd_start_with_ref(message: Message, command: CommandObject):
    referrer_id = None
    battle_code = None

    args = command.args or ""
    lang = message.from_user.language_code if message.from_user else None

    # Format: battle_CODE_ref_TELEGRAMID
    if args.startswith("battle_"):
        parts = args.split("_ref_", 1)
        battle_code = parts[0][len("battle_"):]
        if len(parts) == 2:
            referrer_id = parts[1]
    # Format: ref_TELEGRAMID
    elif args.startswith("ref_"):
        referrer_id = args[4:]

    user = message.from_user
    name = user.first_name or "Player"

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

    if battle_code:
        battle_url = f"{FRONTEND_URL}/battles?join={battle_code}"
        ref_line = t(lang, "referral_bonus_battle") if referrer_id else ""
        await message.answer(
            t(lang, "battle_invite").format(name=name, ref_line=ref_line),
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(
                            text=t(lang, "btn_join_battle"),
                            web_app=WebAppInfo(url=battle_url),
                        )
                    ],
                    [
                        InlineKeyboardButton(
                            text=t(lang, "btn_play"),
                            web_app=WebAppInfo(url=FRONTEND_URL),
                        )
                    ],
                ]
            ),
            parse_mode="HTML",
        )
    else:
        await message.answer(
            welcome_text(name, lang, is_referred=bool(referrer_id)),
            reply_markup=play_keyboard(lang),
            parse_mode="HTML",
        )


# ─────────────────────────────────────────
# /start without referral
# ─────────────────────────────────────────
@router.message(CommandStart())
async def cmd_start(message: Message):
    user = message.from_user
    name = user.first_name or "Player"
    lang = user.language_code if user else None

    await message.answer(
        welcome_text(name, lang),
        reply_markup=play_keyboard(lang),
        parse_mode="HTML",
    )


# ─────────────────────────────────────────
# "Referrals" button callback
# ─────────────────────────────────────────
@router.callback_query(F.data == "referral_info")
async def referral_info(callback: CallbackQuery):
    user = callback.from_user
    lang = user.language_code if user else None
    bot_username = (await callback.bot.get_me()).username
    ref_link = f"https://t.me/{bot_username}?start=ref_{user.id}"

    await callback.message.answer(
        f"{t(lang, 'referral_info_title')}\n\n"
        + t(lang, "referral_info_body").format(ref_link=ref_link),
        parse_mode="HTML",
    )
    await callback.answer()


# ─────────────────────────────────────────
# /invite command
# ─────────────────────────────────────────
@router.message(F.text == "/invite")
async def cmd_invite(message: Message):
    user = message.from_user
    lang = user.language_code if user else None
    bot_username = (await message.bot.get_me()).username
    ref_link = f"https://t.me/{bot_username}?start=ref_{user.id}"
    share_url = f"https://t.me/share/url?url={ref_link}&text=♟ Play ChessCoin — earn coins playing chess!"

    await message.answer(
        t(lang, "invite_text").format(ref_link=ref_link, share_url=share_url),
        parse_mode="HTML",
        disable_web_page_preview=True,
    )
