# MASTERPLAN — ChessCoin

> Что строим **СЕЙЧАС**. См. также `PROJECT_VISION.md` (зачем) и `HISTORY.md` (вехи).
> Live source: Redis `plan:chesscoin:active` на Claudia (185.203.116.131).

---

## I. Текущий статус: PRODUCTION

@chessgamecoin_bot работает в production на сервере 185.203.118.96 / chesscoin.app.

Стек: Node.js + TypeScript + Prisma + PostgreSQL + Redis + grammY + Stockfish + nginx + Docker Compose.

## II. Активные приоритеты

1. **i18n stability** — единый источник `i18n/translations.ts`, ru+en; useT() hook. После wholesale extraction 25 апреля все hardcoded строки на `t.*`.
2. **Monetization v1** — Telegram Stars + USDT через Telegram Wallet, 7 пакетов Mini→Pro+.
3. **UX iterations** — see `KEY_DIALOGS.md` для топ-20 решений из 21632 messages.
4. **Auth stability** — `useAuth.ts` с `tg.ready()+tg.expand()` ДО проверки initData (мобильный Telegram timing).

## III. Где детали

- `KEY_DIALOGS.md` — топ-20 важнейших сообщений (importance ≥ 8) из chesscoin chats (24 апр — 25 мая)
- `DECISIONS.md` — 220 архитектурных решений (топ-50)
- `HISTORY.md` — chronology вех
- Live на сервере: `claudia_memory.dialog_history WHERE project='chesscoin'` (21 632 messages)
- Source chats: `Desktop\994\history\claude_code\` (459 MB, не в git)

## IV. Сервера и доступы

- **Production:** 185.203.118.96 → /opt/chesscoin, docker compose
- **Token:** см. session_log.md в memory/ (НЕ commit'ить в git)
- **SSH:** `~/.ssh/claude_deploy_key`

## V. Связь с другими проектами

- **994 (AC Translate):** проект был именован Кенаном **внутри** chesscoin chat session `e4fdca62` 2026-05-09T19:09 («Запомни и отложи проект 994»). M-vision канон М1-М5 задекларирован 2026-05-10T18:02:32 в session `61e3b95d` (chesscoin Claude Code project). 285 transition matches — см. `Desktop\994\history\TRANSITION_CHESSCOIN_TO_994_*.json`.
- **Claudia infra:** backend-сервер 185.203.116.131 — не путать с ChessCoin (185.203.118.96).
