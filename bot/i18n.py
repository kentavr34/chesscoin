"""Bot i18n — English and Russian translations."""

TRANSLATIONS = {
    "en": {
        "welcome_title": "♟ <b>Welcome to ChessCoin, {name}!</b>",
        "welcome_bonus": (
            "You received a welcome bonus:\n"
            "<b>┌─────────────────────────┐</b>\n"
            "<b>│  🎁  +5 000 ᚙ  to start  │</b>\n"
            "<b>└─────────────────────────┘</b>"
        ),
        "referral_bonus_line": "🎁 Your referral bonus <b>+3 000 ᚙ</b> will be credited after your first game!\n\n",
        "welcome_features": (
            "What awaits you:\n"
            "⚔️  Battles with real players for stakes\n"
            "🤖  Games vs J.A.R.V.I.S — up to <b>+20 000 ᚙ</b>\n"
            "🌍  Country team wars\n"
            "👥  Referral program: <b>50%</b> from friends' wins\n\n"
            "<i>Your coins are credited. Open the app and start playing!</i>"
        ),
        "battle_invite": (
            "♟ <b>Welcome to ChessCoin, {name}!</b>\n\n"
            "You've been invited to a <b>private battle</b>!\n\n"
            "You received a welcome bonus:\n"
            "<b>┌─────────────────────────┐</b>\n"
            "<b>│  🎁  +5 000 ᚙ  to start  │</b>\n"
            "<b>└─────────────────────────┘</b>\n\n"
            "{ref_line}"
            "<i>Click the button below to join the battle:</i>"
        ),
        "referral_bonus_battle": "🎁 Referral bonus +3 000 ᚙ will be credited after your first game!\n\n",
        "btn_play": "♟ Play ChessCoin",
        "btn_leaderboard": "🏆 Leaderboard",
        "btn_referrals": "👥 Referrals",
        "btn_join_battle": "⚔️ Join Battle",
        "referral_info_title": "👥 <b>Referral Program</b>",
        "referral_info_body": (
            "Invite friends — earn automatically:\n\n"
            "  🥇 <b>50%</b> from each friend's win\n"
            "  🥈 <b>10%</b> from their friends' wins\n"
            "  🎁 <b>+3 000 ᚙ</b> when a friend plays their first game\n\n"
            "<i>Bonus is credited only after the first game played — "
            "not just for signing up.</i>\n\n"
            "Your link:\n"
            "<code>{ref_link}</code>\n\n"
            "<i>Tap the link to copy</i>"
        ),
        "invite_text": (
            "👥 <b>Your referral link:</b>\n\n"
            "<code>{ref_link}</code>\n\n"
            "Send to a friend — when they play their first game you'll get <b>+3 000 ᚙ</b> "
            "and <b>50%</b> from every win forever!\n\n"
            "<a href=\"{share_url}\">📤 Share on Telegram</a>"
        ),
    },
    "ru": {
        "welcome_title": "♟ <b>Добро пожаловать в ChessCoin, {name}!</b>",
        "welcome_bonus": (
            "Ты получил приветственный бонус:\n"
            "<b>┌─────────────────────────┐</b>\n"
            "<b>│  🎁  +5 000 ᚙ  на старт  │</b>\n"
            "<b>└─────────────────────────┘</b>"
        ),
        "referral_bonus_line": "🎁 Твой реферальный бонус +3 000 ᚙ начислится когда ты сыграешь первую партию!\n\n",
        "welcome_features": (
            "Что тебя ждёт:\n"
            "⚔️  Батлы на ставку с живыми игроками\n"
            "🤖  Игры с J.A.R.V.I.S — до <b>+20 000 ᚙ</b>\n"
            "🌍  Войны сборных стран\n"
            "👥  Реферальная программа: <b>50%</b> с побед друзей\n\n"
            "<i>Твои монеты уже зачислены. Открой приложение и начинай!</i>"
        ),
        "battle_invite": (
            "♟ <b>Добро пожаловать в ChessCoin, {name}!</b>\n\n"
            "Тебя пригласили на <b>приватный батл</b>!\n\n"
            "Ты получил приветственный бонус:\n"
            "<b>┌─────────────────────────┐</b>\n"
            "<b>│  🎁  +5 000 ᚙ  на старт  │</b>\n"
            "<b>└─────────────────────────┘</b>\n\n"
            "{ref_line}"
            "<i>Нажми кнопку ниже чтобы присоединиться к батлу:</i>"
        ),
        "referral_bonus_battle": "🎁 Реферальный бонус +3 000 ᚙ начислится после первой партии!\n\n",
        "btn_play": "♟ Играть в ChessCoin",
        "btn_leaderboard": "🏆 Рейтинг",
        "btn_referrals": "👥 Рефералы",
        "btn_join_battle": "⚔️ Войти в батл",
        "referral_info_title": "👥 <b>Реферальная программа</b>",
        "referral_info_body": (
            "Приглашай — зарабатывай автоматически:\n\n"
            "  🥇 <b>50%</b> от каждого выигрыша друга\n"
            "  🥈 <b>10%</b> от выигрышей его друзей\n"
            "  🎁 <b>+3 000 ᚙ</b> когда друг сыграет первую партию\n\n"
            "<i>Бонус начисляется только после первой сыгранной партии — "
            "не за простую регистрацию.</i>\n\n"
            "Твоя ссылка:\n"
            "<code>{ref_link}</code>\n\n"
            "<i>Нажми на ссылку чтобы скопировать</i>"
        ),
        "invite_text": (
            "👥 <b>Твоя реферальная ссылка:</b>\n\n"
            "<code>{ref_link}</code>\n\n"
            "Отправь другу — когда он сыграет первую игру, ты получишь <b>+3 000 ᚙ</b> "
            "и <b>50%</b> от каждой его победы навсегда!\n\n"
            "<a href=\"{share_url}\">📤 Поделиться в Telegram</a>"
        ),
    },
}


def t(lang_code: str | None, key: str) -> str:
    """Get translation for given language code and key."""
    lang = "ru" if (lang_code or "").startswith("ru") else "en"
    return TRANSLATIONS[lang].get(key, TRANSLATIONS["en"].get(key, key))
