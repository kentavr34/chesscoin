# 🗂 СТРУКТУРА ПРОЕКТА CHESSCOIN

> Наведено 2026-07-29. До этого в корне лежал 41 отслеживаемый файл вперемешку:
> документы, одноразовые скрипты, чужие утилиты из проектов 994 и Claudia, архивы.
> Стало — 9 файлов в корне, всё остальное разложено по функционалу.

## Корень — только то, что читается первым

| Файл | Что |
|---|---|
| `README.md` | вход в проект, порядок чтения |
| `CLAUDE.md` | конституция: правила, серверы, история ошибок |
| `MASTER_PLAN.md` | что одобрено и не трогается + открытый бэклог |
| `docker-compose.yml` · `docker-compose.prod.yml` | развёртывание |
| `package.json` · `package-lock.json` · `.gitignore` · `.cursorrules` | служебное |

## Три системы продукта

| Папка | Система |
|---|---|
| `bot/` | Telegram-бот @chessgamecoin_bot |
| `backend/` `frontend/` `stockfish/` `nginx/` `deploy/` | игра |
| `project_management/` | управление проектом (правила, реестры, инструменты) |

## Документы — `docs/`

| Папка | Что внутри |
|---|---|
| `docs/kenan_canon/` | **канон требований Кенана** — то, что нельзя ломать: `GAME_REQUIREMENTS_FROM_KENAN.md`, `SPEC_2026-05-12_KENAN.md`, `REFERRAL_RANKS_SPEC.md`, `REBUILD_2.0_PLAN_AND_AUDIT.md`, `PROJECT_PLAN_VFINAL.md`, `CURSOR_PLAN_2_MONTHS_AGO.md`, `GAME_DESIGN_KNOWLEDGE.md` |
| `docs/product/` | механика и планы: `MECHANICS.md`, `ROADMAP_V3.md`, `MASTERPLAN.md`, `PROJECT_VISION.md`, `DEVELOPMENT_PLAN_2026-06-13.md` |
| `docs/history/` | летопись: `HISTORY.md`, `JOURNAL.md`, `DECISIONS.md`, `KEY_DIALOGS.md`, `PROJECTS.md`, `AUDIT_2026-05-14.md` |
| `docs/design/` | дизайн-описания: `HOMEPAGE_COMPLETE.md`, `HOMEPAGE_GLASSMORPHISM.md`, `BATTLES_COMPLETE.md`, макеты `*.html` |
| `docs/safety/` | `SAFETY_POLICY.md` |

## Канон дизайна — `design_canon/`

Утверждённые шаблоны UI: `TPL-001…005` + `HOMEPAGE_TEMPLATE.tsx`,
`JARVIS_PLAY_MODAL_TEMPLATE.tsx`, `CREATE_BATTLE_MODAL_TEMPLATE.tsx`,
`GAMEPAGE_TEMPLATE.tsx`, индекс `TEMPLATES_INDEX.md`.
Закон обращения — `project_management/rules/09_TEMPLATES.md`.

## Архив — `archive/`

| Папка | Что |
|---|---|
| `archive/legacy_tools/` | одноразовые скрипты и утилиты чужих проектов (994, Claudia): `aider_runner.py`, `claudia_main_new.py`, `crew_board_new.py`, `patch_bot.py`, `read_docx.*`, `fix-mojibake.py`, `fix_backticks.js`, `create_test_user.js`, `generate_token.js`, `inject_token.html`, `fix_jarvis_level.sh`, `START_CHESSCOIN.ps1` |
| `archive/snapshots/` | старые снимки проекта |
| `archive/` | `update.tar.gz`, `Шахматы.docx` |

Ничего не удалялось — всё перенесено. Восстановление — `git log --follow`.

## Что намеренно НЕ в git

| Что | Почему | Где хранится |
|---|---|---|
| `чат/` (21 МБ) | сырые дампы переписки: `CHESSCOIN_FULL_TIMELINE.md`, `KENAN_TIMELINE.md`, `*_discussions.md` — по 4–5 МБ каждый | БД `claudia_memory.dialog_history` (21 731 сообщение) + бэкапы. **Канон из этой папки вынесен в `docs/kenan_canon/` и теперь в git** |
| `.env`, `.secrets.enc` | секреты | прод + зашифрованный `env.enc` в бэкапе |
| `avatars/` на проде | пользовательские данные | бэкап `avatars.tar.gz` |
| `node_modules/`, `dist/` | сборка | пересобирается |

## Бэкап и восстановление

`scripts/backup_chesscoin.sh [метка]` — полный бэкап **только папки проекта**:
код с историей (git bundle) · БД игры · память управляющего контура ·
аватары · секреты (AES-256, ключ вне архива) · `RESTORE.md`.
Назначение: `gdrive:chesscoin-backups/` + Telegram-группа.
