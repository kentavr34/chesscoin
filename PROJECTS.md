# PROJECTS — ChessCoin

> Глобальная история **задач** (не диалогов). Что выполнено, на каком этапе.

---

## Этапы / версии

| Версия | Статус | Что |
|---|---|---|
| v7.1.0 | ✅ Production | Текущая (см. README) |
| v6.x | ✅ DONE | i18n wholesale extraction + UI consistency |
| v5.x | ✅ DONE | Battles + Tournaments + Jarvis |
| v4.x | ✅ DONE | Clans + WarsPage |
| v3.x | ✅ DONE | TON Wallet integration |

---

## Задачи (последние сверху)

### 2026-05-26 — Memory consolidation 4-tier
- **Кто:** Claude orchestrator
- **Что:** Bulk INSERT 21 632 chesscoin messages в claudia_memory.dialog_history + Redis vision/plan/blockers + LightRAG + 5 локальных системных файлов в корне.
- **Артефакт:** этот файл + HISTORY/MASTERPLAN/KEY_DIALOGS/DECISIONS + README обновлён
- **Подпись:** — Claude orchestrator (Anthropic), 2026-05-26T01:45:00Z

### 2026-05-25 — Monetization v1 finalized
- **Кто:** Claude (chesscoin chat)
- **Что:** 7 пакетов Mini→Pro+, 1 char=$0.0002, 2500 chars=$0.50, Stars+USDT через Telegram Wallet
- **Связь с 994:** монетизационная схема перенесена/адаптирована для 994 (см. 994/MASTERPLAN ⭐ P2)

### 2026-05-21 — i18n wholesale extraction completed
- **Кто:** Claude
- **Что:** 66 RU-строк фикс утечек в AZ/EN/TR. Переход с runtime LLM-cache на static dict. Все hardcoded на `t.*` через `useT()` hook.
- **Артефакт:** `i18n/translations.ts`

### 2026-05-09 — 994 родился внутри chesscoin chat
- **Кто:** Кенан
- **Что:** «Запомни и отложи проект 994 — это код страны». Идея переводчика отделилась от ChessCoin в отдельный проект (без выхода из chat).
- **Связь:** см. `Desktop\994\PROJECTS.md`

### 2026-04-25 — session_log.md создан (deploy / auth / bot / i18n правила)
- **Кто:** Claude
- **Что:** Critical facts по ChessCoin зафиксированы в `Desktop\994\history\claude_code\memory\session_log.md`. Включает bot token rotation, mobile Telegram auth quirks, deploy workflow.

### 2026-04-11 — Bible concept
- **Кто:** Кенан
- **Что:** «договорились сделать библию для каждого проекта отдельно». Принцип canon-документа per project (войдёт в M4 концепцию через месяц для 994).

### 2026-04-03 — chesscoin Claude Code project started
- **Кто:** Кенан + Claude
- **Что:** Первый JSONL в `.claude/projects/C--Users-SAM-Desktop-chesscoin/`. 53 дня непрерывной работы.
- **Артефакт:** session_id `bd3c34fe`

---

## Метрики

- **Production uptime:** chesscoin.app
- **Tests:** 124 passed (см. README badge)
- **dialog_history:** 21 632 messages на Claudia сервере

---

*Версия:* 1.0
*Дата:* 2026-05-26
*Подпись:* — Claude orchestrator (Anthropic), 2026-05-26T02:05:00Z
