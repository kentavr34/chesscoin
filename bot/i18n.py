"""
bot/i18n.py — мультиязычные тексты ChessCoin Bot

Поддерживаемые языки:
  ru  — Русский       uk  — Українська    de  — Deutsch
  es  — Español       fr  — Français      tr  — Türkçe
  pt  — Português     zh  — 中文          en  — English (fallback)

Добавить новый язык:
  1. Добавь ключ в TRANSLATIONS (скопируй секцию "en" как шаблон)
  2. Добавь lang_code в _LANG_MAP
  Всё — бот подхватит автоматически.
"""

from __future__ import annotations

TRANSLATIONS: dict[str, dict[str, str]] = {
    # ── Русский ───────────────────────────────────────────────────────────────
    "ru": {
        "welcome_title":        "♟ Привет, <b>{name}</b>! Добро пожаловать в ChessCoin",
        "welcome_returning":    "♟ С возвращением, <b>{name}</b>!",
        "welcome_back_text":    (
            "Твои монеты ждут тебя.\n"
            "♟ Продолжай играть и зарабатывать!\n\n"
            "<i>Открой приложение и вперёд!</i>"
        ),
        "welcome_bonus":        (
            "Твой стартовый бонус:\n"
            "<b>┌─────────────────────────┐</b>\n"
            "<b>│  🎁  +5 000 ᚙ  на старт  │</b>\n"
            "<b>└─────────────────────────┘</b>"
        ),
        "referral_bonus_line":  "🎁 Реферальный бонус <b>+3 000 ᚙ</b> — после первой партии!\n\n",
        "welcome_features":     (
            "Что тебя ждёт:\n"
            "⚔️ Батлы на монеты с живыми игроками\n"
            "🤖 J.A.R.V.I.S — до <b>+20 000 ᚙ</b> за победу\n"
            "🌍 Войны сборных стран\n"
            "👥 Рефералы: <b>50%</b> с побед друзей\n\n"
            "<i>Монеты зачислены — открывай и играй!</i>"
        ),
        "battle_invite":        (
            "♟ Привет, <b>{name}</b>! Тебя позвали на батл\n\n"
            "Стартовый бонус:\n"
            "<b>┌─────────────────────────┐</b>\n"
            "<b>│  🎁  +5 000 ᚙ  на старт  │</b>\n"
            "<b>└─────────────────────────┘</b>\n\n"
            "{ref_line}"
            "<i>Жми кнопку ниже чтобы войти в батл:</i>"
        ),
        "referral_bonus_battle":"🎁 Реферальный бонус +3 000 ᚙ — после первой партии!\n\n",
        "btn_play":             "♟ Играть",
        "btn_leaderboard":      "🏆 Рейтинг",
        "btn_referrals":        "👥 Рефералы",
        "btn_join_battle":      "⚔️ Войти в батл",
        "referral_info_title":  "👥 <b>Реферальная программа</b>",
        "referral_info_body":   (
            "Приглашай — зарабатывай:\n\n"
            "🥇 <b>50%</b> от побед друга\n"
            "🥈 <b>10%</b> от побед его друзей\n"
            "🎁 <b>+3 000 ᚙ</b> за первую партию друга\n\n"
            "<i>Бонус — только после первой партии.</i>\n\n"
            "Твоя ссылка:\n"
            "<code>{ref_link}</code>\n"
            "<i>(нажми чтобы скопировать)</i>"
        ),
        "invite_text":          (
            "👥 <b>Твоя реферальная ссылка:</b>\n\n"
            "<code>{ref_link}</code>\n\n"
            "Пригласи друга — получи <b>+3 000 ᚙ</b> и <b>50%</b> от каждой его победы!\n\n"
            "<a href=\"{share_url}\">📤 Поделиться</a>"
        ),
        "help_text":            (
            "♟ <b>ChessCoin — шахматы за монеты</b>\n\n"
            "Команды:\n"
            "/start — открыть игру\n"
            "/play — играть прямо сейчас\n"
            "/invite — твоя реферальная ссылка\n"
            "/help — это сообщение"
        ),
    },

    # ── English ───────────────────────────────────────────────────────────────
    "en": {
        "welcome_title":        "♟ Hey <b>{name}</b>! Welcome to ChessCoin",
        "welcome_returning":    "♟ Welcome back, <b>{name}</b>!",
        "welcome_back_text":    (
            "Your coins are waiting.\n"
            "♟ Keep playing and earning!\n\n"
            "<i>Open the app and go!</i>"
        ),
        "welcome_bonus":        (
            "Your starting bonus:\n"
            "<b>┌─────────────────────────┐</b>\n"
            "<b>│  🎁  +5 000 ᚙ  to start  │</b>\n"
            "<b>└─────────────────────────┘</b>"
        ),
        "referral_bonus_line":  "🎁 Referral bonus <b>+3 000 ᚙ</b> — after your first game!\n\n",
        "welcome_features":     (
            "What's waiting for you:\n"
            "⚔️ Battles with real players for stakes\n"
            "🤖 J.A.R.V.I.S — up to <b>+20 000 ᚙ</b> per win\n"
            "🌍 Country team wars\n"
            "👥 Referrals: <b>50%</b> from friends' wins\n\n"
            "<i>Coins credited — open the app and play!</i>"
        ),
        "battle_invite":        (
            "♟ Hey <b>{name}</b>! You're invited to a battle\n\n"
            "Your starting bonus:\n"
            "<b>┌─────────────────────────┐</b>\n"
            "<b>│  🎁  +5 000 ᚙ  to start  │</b>\n"
            "<b>└─────────────────────────┘</b>\n\n"
            "{ref_line}"
            "<i>Tap the button below to join the battle:</i>"
        ),
        "referral_bonus_battle":"🎁 Referral bonus +3 000 ᚙ — after your first game!\n\n",
        "btn_play":             "♟ Play",
        "btn_leaderboard":      "🏆 Leaderboard",
        "btn_referrals":        "👥 Referrals",
        "btn_join_battle":      "⚔️ Join Battle",
        "referral_info_title":  "👥 <b>Referral Program</b>",
        "referral_info_body":   (
            "Invite friends — earn automatically:\n\n"
            "🥇 <b>50%</b> from each friend's win\n"
            "🥈 <b>10%</b> from their friends' wins\n"
            "🎁 <b>+3 000 ᚙ</b> when a friend plays their first game\n\n"
            "<i>Bonus is credited after the first game, not just sign-up.</i>\n\n"
            "Your link:\n"
            "<code>{ref_link}</code>\n"
            "<i>(tap to copy)</i>"
        ),
        "invite_text":          (
            "👥 <b>Your referral link:</b>\n\n"
            "<code>{ref_link}</code>\n\n"
            "Invite a friend — get <b>+3 000 ᚙ</b> and <b>50%</b> from every win forever!\n\n"
            "<a href=\"{share_url}\">📤 Share on Telegram</a>"
        ),
        "help_text":            (
            "♟ <b>ChessCoin — chess for coins</b>\n\n"
            "Commands:\n"
            "/start — open the game\n"
            "/play — play right now\n"
            "/invite — your referral link\n"
            "/help — this message"
        ),
    },

    # ── Українська ────────────────────────────────────────────────────────────
    "uk": {
        "welcome_title":        "♟ Привіт, <b>{name}</b>! Ласкаво просимо до ChessCoin",
        "welcome_bonus":        (
            "Твій стартовий бонус:\n"
            "<b>┌─────────────────────────┐</b>\n"
            "<b>│  🎁  +5 000 ᚙ  на старт  │</b>\n"
            "<b>└─────────────────────────┘</b>"
        ),
        "referral_bonus_line":  "🎁 Реферальний бонус <b>+3 000 ᚙ</b> — після першої партії!\n\n",
        "welcome_features":     (
            "Що на тебе чекає:\n"
            "⚔️ Батли на монети з живими гравцями\n"
            "🤖 J.A.R.V.I.S — до <b>+20 000 ᚙ</b> за перемогу\n"
            "🌍 Війни збірних країн\n"
            "👥 Реферали: <b>50%</b> з перемог друзів\n\n"
            "<i>Монети зараховані — відкривай і грай!</i>"
        ),
        "battle_invite":        (
            "♟ Привіт, <b>{name}</b>! Тебе запросили на батл\n\n"
            "Стартовий бонус:\n"
            "<b>┌─────────────────────────┐</b>\n"
            "<b>│  🎁  +5 000 ᚙ  на старт  │</b>\n"
            "<b>└─────────────────────────┘</b>\n\n"
            "{ref_line}"
            "<i>Натисни кнопку нижче щоб увійти в батл:</i>"
        ),
        "referral_bonus_battle":"🎁 Реферальний бонус +3 000 ᚙ — після першої партії!\n\n",
        "btn_play":             "♟ Грати",
        "btn_leaderboard":      "🏆 Рейтинг",
        "btn_referrals":        "👥 Реферали",
        "btn_join_battle":      "⚔️ Увійти в батл",
        "referral_info_title":  "👥 <b>Реферальна програма</b>",
        "referral_info_body":   (
            "Запрошуй — заробляй:\n\n"
            "🥇 <b>50%</b> від перемог друга\n"
            "🥈 <b>10%</b> від перемог його друзів\n"
            "🎁 <b>+3 000 ᚙ</b> за першу партію друга\n\n"
            "Твоє посилання:\n"
            "<code>{ref_link}</code>"
        ),
        "invite_text":          (
            "👥 <b>Твоє реферальне посилання:</b>\n\n"
            "<code>{ref_link}</code>\n\n"
            "<a href=\"{share_url}\">📤 Поділитися</a>"
        ),
        "help_text":            (
            "♟ <b>ChessCoin — шахи за монети</b>\n\n"
            "/start — відкрити гру\n"
            "/play — грати зараз\n"
            "/invite — реферальне посилання\n"
            "/help — ця довідка"
        ),
    },

    # ── Deutsch ───────────────────────────────────────────────────────────────
    "de": {
        "welcome_title":        "♟ Hallo <b>{name}</b>! Willkommen bei ChessCoin",
        "welcome_bonus":        (
            "Dein Startbonus:\n"
            "<b>┌─────────────────────────┐</b>\n"
            "<b>│  🎁  +5 000 ᚙ  zum Start  │</b>\n"
            "<b>└─────────────────────────┘</b>"
        ),
        "referral_bonus_line":  "🎁 Empfehlungsbonus <b>+3 000 ᚙ</b> — nach deinem ersten Spiel!\n\n",
        "welcome_features":     (
            "Was dich erwartet:\n"
            "⚔️ Kämpfe mit echten Spielern um Einsatz\n"
            "🤖 J.A.R.V.I.S — bis zu <b>+20 000 ᚙ</b>\n"
            "🌍 Länderkämpfe\n"
            "👥 Empfehlungen: <b>50%</b> aus Siegen\n\n"
            "<i>Münzen gutgeschrieben — öffne die App!</i>"
        ),
        "battle_invite":        (
            "♟ Hallo <b>{name}</b>! Du wurdest zu einem Kampf eingeladen\n\n"
            "{ref_line}<i>Drücke die Schaltfläche unten:</i>"
        ),
        "referral_bonus_battle":"🎁 +3 000 ᚙ nach deinem ersten Spiel!\n\n",
        "btn_play":             "♟ Spielen",
        "btn_leaderboard":      "🏆 Rangliste",
        "btn_referrals":        "👥 Empfehlungen",
        "btn_join_battle":      "⚔️ Kampf beitreten",
        "referral_info_title":  "👥 <b>Empfehlungsprogramm</b>",
        "referral_info_body":   (
            "Lade Freunde ein — verdiene automatisch:\n\n"
            "🥇 <b>50%</b> aus jedem Sieg\n"
            "🎁 <b>+3 000 ᚙ</b> beim ersten Spiel\n\n"
            "Dein Link:\n<code>{ref_link}</code>"
        ),
        "invite_text":          (
            "👥 <b>Dein Empfehlungslink:</b>\n\n"
            "<code>{ref_link}</code>\n\n"
            "<a href=\"{share_url}\">📤 Teilen</a>"
        ),
        "help_text":            (
            "♟ <b>ChessCoin — Schach für Münzen</b>\n\n"
            "/start — Spiel öffnen\n"
            "/play — Jetzt spielen\n"
            "/invite — Empfehlungslink\n"
            "/help — Hilfe"
        ),
    },

    # ── Español ───────────────────────────────────────────────────────────────
    "es": {
        "welcome_title":        "♟ ¡Hola <b>{name}</b>! Bienvenido a ChessCoin",
        "welcome_bonus":        (
            "Tu bono de bienvenida:\n"
            "<b>┌─────────────────────────┐</b>\n"
            "<b>│  🎁  +5 000 ᚙ  de inicio  │</b>\n"
            "<b>└─────────────────────────┘</b>"
        ),
        "referral_bonus_line":  "🎁 Bono de referido <b>+3 000 ᚙ</b> — ¡tras tu primera partida!\n\n",
        "welcome_features":     (
            "Lo que te espera:\n"
            "⚔️ Batallas con jugadores reales por apuestas\n"
            "🤖 J.A.R.V.I.S — hasta <b>+20 000 ᚙ</b>\n"
            "🌍 Guerras entre países\n"
            "👥 Referidos: <b>50%</b> de las ganancias\n\n"
            "<i>¡Monedas acreditadas — abre la app y juega!</i>"
        ),
        "battle_invite":        (
            "♟ ¡Hola <b>{name}</b>! Te invitaron a una batalla\n\n"
            "{ref_line}<i>Pulsa el botón para unirte:</i>"
        ),
        "referral_bonus_battle":"🎁 +3 000 ᚙ tras tu primera partida!\n\n",
        "btn_play":             "♟ Jugar",
        "btn_leaderboard":      "🏆 Clasificación",
        "btn_referrals":        "👥 Referidos",
        "btn_join_battle":      "⚔️ Unirse a batalla",
        "referral_info_title":  "👥 <b>Programa de referidos</b>",
        "referral_info_body":   (
            "Invita amigos — gana automáticamente:\n\n"
            "🥇 <b>50%</b> de cada victoria\n"
            "🎁 <b>+3 000 ᚙ</b> en su primera partida\n\n"
            "Tu enlace:\n<code>{ref_link}</code>"
        ),
        "invite_text":          (
            "👥 <b>Tu enlace de referido:</b>\n\n"
            "<code>{ref_link}</code>\n\n"
            "<a href=\"{share_url}\">📤 Compartir</a>"
        ),
        "help_text":            (
            "♟ <b>ChessCoin — ajedrez por monedas</b>\n\n"
            "/start — abrir el juego\n"
            "/play — jugar ahora\n"
            "/invite — enlace de referido\n"
            "/help — ayuda"
        ),
    },

    # ── Français ──────────────────────────────────────────────────────────────
    "fr": {
        "welcome_title":        "♟ Bonjour <b>{name}</b> ! Bienvenue sur ChessCoin",
        "welcome_bonus":        (
            "Ton bonus de bienvenue :\n"
            "<b>┌─────────────────────────┐</b>\n"
            "<b>│  🎁  +5 000 ᚙ  de départ  │</b>\n"
            "<b>└─────────────────────────┘</b>"
        ),
        "referral_bonus_line":  "🎁 Bonus de parrainage <b>+3 000 ᚙ</b> — après ta 1ʳᵉ partie !\n\n",
        "welcome_features":     (
            "Ce qui t'attend :\n"
            "⚔️ Batailles contre de vrais joueurs\n"
            "🤖 J.A.R.V.I.S — jusqu'à <b>+20 000 ᚙ</b>\n"
            "🌍 Guerres entre pays\n"
            "👥 Parrainage : <b>50%</b> des gains d'amis\n\n"
            "<i>Pièces créditées — ouvre l'app et joue !</i>"
        ),
        "battle_invite":        (
            "♟ Bonjour <b>{name}</b> ! Tu es invité à une bataille\n\n"
            "{ref_line}<i>Appuie sur le bouton ci-dessous :</i>"
        ),
        "referral_bonus_battle":"🎁 +3 000 ᚙ après ta 1ʳᵉ partie !\n\n",
        "btn_play":             "♟ Jouer",
        "btn_leaderboard":      "🏆 Classement",
        "btn_referrals":        "👥 Parrainages",
        "btn_join_battle":      "⚔️ Rejoindre",
        "referral_info_title":  "👥 <b>Programme de parrainage</b>",
        "referral_info_body":   (
            "Invite des amis — gagne automatiquement :\n\n"
            "🥇 <b>50%</b> de chaque victoire\n"
            "🎁 <b>+3 000 ᚙ</b> à sa 1ʳᵉ partie\n\n"
            "Ton lien :\n<code>{ref_link}</code>"
        ),
        "invite_text":          (
            "👥 <b>Ton lien de parrainage :</b>\n\n"
            "<code>{ref_link}</code>\n\n"
            "<a href=\"{share_url}\">📤 Partager</a>"
        ),
        "help_text":            (
            "♟ <b>ChessCoin — échecs contre des pièces</b>\n\n"
            "/start — ouvrir le jeu\n"
            "/play — jouer maintenant\n"
            "/invite — lien de parrainage\n"
            "/help — aide"
        ),
    },

    # ── Türkçe ────────────────────────────────────────────────────────────────
    "tr": {
        "welcome_title":        "♟ Merhaba <b>{name}</b>! ChessCoin'e hoş geldin",
        "welcome_bonus":        (
            "Başlangıç bonusun:\n"
            "<b>┌─────────────────────────┐</b>\n"
            "<b>│  🎁  +5 000 ᚙ  başlangıç  │</b>\n"
            "<b>└─────────────────────────┘</b>"
        ),
        "referral_bonus_line":  "🎁 Referans bonusu <b>+3 000 ᚙ</b> — ilk oyundan sonra!\n\n",
        "welcome_features":     (
            "Seni neler bekliyor:\n"
            "⚔️ Gerçek oyuncularla coin bahisli maçlar\n"
            "🤖 J.A.R.V.I.S — <b>+20 000 ᚙ</b>'e kadar\n"
            "🌍 Ülke savaşları\n"
            "👥 Referanslar: kazançtan <b>%50</b>\n\n"
            "<i>Coinler yüklendi — uygulamayı aç ve oyna!</i>"
        ),
        "battle_invite":        (
            "♟ Merhaba <b>{name}</b>! Bir maça davet edildin\n\n"
            "{ref_line}<i>Katılmak için aşağıdaki butona bas:</i>"
        ),
        "referral_bonus_battle":"🎁 +3 000 ᚙ ilk oyundan sonra!\n\n",
        "btn_play":             "♟ Oyna",
        "btn_leaderboard":      "🏆 Sıralama",
        "btn_referrals":        "👥 Referanslar",
        "btn_join_battle":      "⚔️ Maça Katıl",
        "referral_info_title":  "👥 <b>Referans Programı</b>",
        "referral_info_body":   (
            "Arkadaşlarını davet et — otomatik kazan:\n\n"
            "🥇 Her kazançtan <b>%50</b>\n"
            "🎁 İlk oyunda <b>+3 000 ᚙ</b>\n\n"
            "Bağlantın:\n<code>{ref_link}</code>"
        ),
        "invite_text":          (
            "👥 <b>Referans bağlantın:</b>\n\n"
            "<code>{ref_link}</code>\n\n"
            "<a href=\"{share_url}\">📤 Paylaş</a>"
        ),
        "help_text":            (
            "♟ <b>ChessCoin — coin için satranç</b>\n\n"
            "/start — oyunu aç\n"
            "/play — hemen oyna\n"
            "/invite — referans bağlantısı\n"
            "/help — yardım"
        ),
    },

    # ── Português ─────────────────────────────────────────────────────────────
    "pt": {
        "welcome_title":        "♟ Olá <b>{name}</b>! Bem-vindo ao ChessCoin",
        "welcome_bonus":        (
            "Seu bônus de boas-vindas:\n"
            "<b>┌─────────────────────────┐</b>\n"
            "<b>│  🎁  +5 000 ᚙ  de início  │</b>\n"
            "<b>└─────────────────────────┘</b>"
        ),
        "referral_bonus_line":  "🎁 Bônus de indicação <b>+3 000 ᚙ</b> — após a primeira partida!\n\n",
        "welcome_features":     (
            "O que te espera:\n"
            "⚔️ Batalhas com jogadores reais\n"
            "🤖 J.A.R.V.I.S — até <b>+20 000 ᚙ</b>\n"
            "🌍 Guerras entre países\n"
            "👥 Indicações: <b>50%</b> dos ganhos\n\n"
            "<i>Moedas creditadas — abre o app e joga!</i>"
        ),
        "battle_invite":        (
            "♟ Olá <b>{name}</b>! Você foi convidado para uma batalha\n\n"
            "{ref_line}<i>Toca o botão abaixo para entrar:</i>"
        ),
        "referral_bonus_battle":"🎁 +3 000 ᚙ após a primeira partida!\n\n",
        "btn_play":             "♟ Jogar",
        "btn_leaderboard":      "🏆 Classificação",
        "btn_referrals":        "👥 Indicações",
        "btn_join_battle":      "⚔️ Entrar na batalha",
        "referral_info_title":  "👥 <b>Programa de indicações</b>",
        "referral_info_body":   (
            "Convide amigos — ganhe automaticamente:\n\n"
            "🥇 <b>50%</b> de cada vitória\n"
            "🎁 <b>+3 000 ᚙ</b> na primeira partida\n\n"
            "Seu link:\n<code>{ref_link}</code>"
        ),
        "invite_text":          (
            "👥 <b>Seu link de indicação:</b>\n\n"
            "<code>{ref_link}</code>\n\n"
            "<a href=\"{share_url}\">📤 Compartilhar</a>"
        ),
        "help_text":            (
            "♟ <b>ChessCoin — xadrez por moedas</b>\n\n"
            "/start — abrir o jogo\n"
            "/play — jogar agora\n"
            "/invite — link de indicação\n"
            "/help — ajuda"
        ),
    },

    # ── 中文 ──────────────────────────────────────────────────────────────────
    "zh": {
        "welcome_title":        "♟ 你好 <b>{name}</b>！欢迎来到 ChessCoin",
        "welcome_bonus":        (
            "你的开始奖励：\n"
            "<b>┌─────────────────────────┐</b>\n"
            "<b>│  🎁  +5 000 ᚙ  起始金币   │</b>\n"
            "<b>└─────────────────────────┘</b>"
        ),
        "referral_bonus_line":  "🎁 推荐奖励 <b>+3 000 ᚙ</b> — 首局游戏后发放！\n\n",
        "welcome_features":     (
            "等你的精彩：\n"
            "⚔️ 与真实玩家对战下注\n"
            "🤖 J.A.R.V.I.S — 最高 <b>+20 000 ᚙ</b>\n"
            "🌍 国家队战争\n"
            "👥 推荐计划：朋友赢局的 <b>50%</b>\n\n"
            "<i>金币已到账 — 打开应用开始游戏！</i>"
        ),
        "battle_invite":        (
            "♟ 你好 <b>{name}</b>！你被邀请参加对战\n\n"
            "{ref_line}<i>点击下方按钮加入：</i>"
        ),
        "referral_bonus_battle":"🎁 首局后 +3 000 ᚙ！\n\n",
        "btn_play":             "♟ 开始游戏",
        "btn_leaderboard":      "🏆 排行榜",
        "btn_referrals":        "👥 推荐",
        "btn_join_battle":      "⚔️ 加入对战",
        "referral_info_title":  "👥 <b>推荐计划</b>",
        "referral_info_body":   (
            "邀请朋友 — 自动获得收益：\n\n"
            "🥇 朋友每次获胜 <b>50%</b>\n"
            "🎁 首局 <b>+3 000 ᚙ</b>\n\n"
            "你的链接：\n<code>{ref_link}</code>"
        ),
        "invite_text":          (
            "👥 <b>你的推荐链接：</b>\n\n"
            "<code>{ref_link}</code>\n\n"
            "<a href=\"{share_url}\">📤 分享</a>"
        ),
        "help_text":            (
            "♟ <b>ChessCoin — 用金币下棋</b>\n\n"
            "/start — 打开游戏\n"
            "/play — 立即游戏\n"
            "/invite — 推荐链接\n"
            "/help — 帮助"
        ),
    },
}

# ─── Карта кодов языков Telegram → ключ словаря ───────────────────────────────
_LANG_MAP: dict[str, str] = {
    "ru": "ru", "be": "ru", "kk": "ru",
    "uk": "uk",
    "de": "de",
    "es": "es",
    "fr": "fr",
    "tr": "tr",
    "pt": "pt", "pt-br": "pt",
    "zh": "zh", "zh-hans": "zh", "zh-hant": "zh",
}


def detect_lang(language_code: str | None) -> str:
    """Определяет язык по language_code из Telegram. Fallback: 'en'."""
    if not language_code:
        return "en"
    lower = language_code.lower()
    if lower in _LANG_MAP:
        return _LANG_MAP[lower]
    return _LANG_MAP.get(lower[:2], "en")


def t(lang_code: str | None, key: str) -> str:
    """Получить перевод. Fallback: английский → сам ключ."""
    lang = detect_lang(lang_code)
    return (
        TRANSLATIONS.get(lang, {}).get(key)
        or TRANSLATIONS.get("en", {}).get(key)
        or key
    )
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
