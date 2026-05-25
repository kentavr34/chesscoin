# PROJECT VISION — ChessCoin

> Глобальное видение ChessCoin. Цель, принципы, продукт.
> Live source: Redis `vision:chesscoin` на Claudia (185.203.116.131).

---

## I. Главная цель

**Telegram Mini App** — шахматная betting платформа с реальной экономикой (TON Wallet + USDT, ELO matchmaking, кланы, турниры, Stockfish).

Стек: Node.js + TypeScript + Prisma + PostgreSQL + Redis + grammY + Stockfish + nginx + Docker Compose.

Production: **185.203.118.96 / chesscoin.app**, бот @chessgamecoin_bot.

## II. Принципы

1. **Telegram-native UX** — Mini App constraints, `tg.openTelegramLink()` вместо обычных href.
2. **Mobile-first auth** — `useAuth.ts` ждёт `tg.ready() + tg.expand()` ДО проверки initData (мобильный Telegram отдаёт initData с задержкой 100-300мс).
3. **Server-side ELO + matchmaking** — клиент только UI.
4. **i18n единый источник** — `i18n/translations.ts`, ru+en. `useT()` hook. Никаких hardcoded строк в компонентах.
5. **Audit-gated deploy** — план → код → audit → fix → deploy → spot-check.

## III. Команда и роли

- **Кенан Рагимов** — продакт-овнер, продакт-vision.
- **Claude orchestrator** — архитектор, code review.

## IV. Связь с другими проектами

**994 (AC Translate)** — был **именован Кенаном внутри chesscoin chat** session `e4fdca62` 2026-05-09T19:09: *«Запомни и отложи проект 994 — это код страны»*. M-vision канон М1-М5 задекларирован 2026-05-10T18:02:32 в session `61e3b95d` (тоже chesscoin Claude Code project). 994 = **отдельный проект** с собственной vision (см. `Desktop\994\PROJECT_VISION.md`).

285 transition matches между ChessCoin и 994 в одном `Desktop\994\history\TRANSITION_CHESSCOIN_TO_994_2026-04-25_to_05-10.json`.

## V. История

Полная история chats — `Desktop\994\history\claude_code\` (chesscoin/, 30 JSONL, 459 MB).
Краткая выжимка — `KEY_DIALOGS.md` (топ-20), `DECISIONS.md` (220 решений).

24 уникальных memory MD файла в `Desktop\994\history\claude_code\memory\` — session_log, project_management_system, deployment_process, и др.

---

**Версия:** 1.0
**Дата:** 2026-05-26
**Источник:** consolidation 4-layer memory из chesscoin Claude Code project (459 MB / 21 632 messages)
