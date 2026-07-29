# 🗒 ЖУРНАЛ ОПЕРАЦИЙ CHESSCOIN

> Хронология того, **что происходило по факту**: команда, изменение, деплой,
> откат, проверка. Пишется ПО ХОДУ работы (`tools/note.py`), а не только в конце —
> при обрыве сессии несохранённое теряется.
>
> Формат строки: `дата время · вид · что · чем доказано`.
> Виды: `note` · `change` · `deploy` · `rollback` · `verify` · `find`.
>
> Зеркало в БД: `chesscoin_pm.operations_log`.

---

## 2026-07-29 — инициация проекта и создание управляющего контура

| Время | Вид | Что | Доказательство |
|---|---|---|---|
| 15:53 | verify | Резолв `chesscoin.app` → **45.67.216.36** (не `185.203.118.96`, как в документации) | `Resolve-DnsName` |
| 15:54 | find | Старый прод `185.203.118.96` мёртв | `ssh: connect ... Connection timed out` |
| 15:55 | verify | Прод `/opt/chesscoin` на `main` = `origin/main` (`63dcfaa`) | `git log` на сервере |
| 15:56 | verify | 8 контейнеров `chesscoin_*` — все `Up`; backend `{"status":"ok","version":"7.2.0","db":"ok"}`, uptime 25 дней | `docker ps`, `/health` изнутри |
| 15:57 | verify | Сайт 200, бандл `index-C0dai30e.js`, last-modified 13.06.2026 | `curl -I` |
| 15:58 | find | 🔴 Бот 19 дней ретраит уведомление заблокировавшему пользователю: 2866 ошибок/сутки с 10.07 17:34 | `docker logs chesscoin_bot` |
| 16:05 | change | Исправлен прод-адрес и путь рабочей копии в `CLAUDE.md`, `MASTER_PLAN.md` (§ 0.8, § 7) | git diff |
| 16:40 | change | Создана схема `chesscoin_pm` в БД `claudia`: `session_log`, `agent_mistakes`, `prod_path_registry`, `regression_cases`, `regression_runs`, `file_inventory`, `operations_log` | `CREATE SCHEMA` + 6 `CREATE TABLE` |
| 16:50 | change | Разобрана история диалога (21 731 сообщение, 04.2026–07.2026): в `chesscoin_pm.agent_mistakes` — **14 ошибок исполнителя** с цитатами Кенана | `INSERT 0 14` |
| 16:55 | change | В `claudia_learned_solutions` (project='chesscoin') — **12 записей** проблема→корень→решение | `INSERT 0 12` |
| 17:00 | change | Заполнены `prod_path_registry` (9 подсистем) и `regression_cases` (8 случаев) | `INSERT 0 9`, `INSERT 0 8` |
| 17:10 | verify | Enum `TransactionType` в проде = 36 значений — регрессия из AUDIT 14.05 закрыта | `select count(*) from pg_enum ...` |
| 17:20 | change | Создан управляющий контур `project_management/`: README, 10 правил, 4 реестра, 5 инструментов | эта папка |
| 20:45 | verify | контур управления собран и прогнан: эталон 7/8, инвентаризация 325 файлов | — |
| 20:49 | change | управляющий контур собран: 10 правил, 5 реестров, 5 инструментов; указатели в README.md и CLAUDE.md | project_management/, README.md, CLAUDE.md |
| 21:19 | deploy | hotfix бота: PERMANENT_ERRORS снимают неотправляемое уведомление с очереди; пересобран chesscoin_bot; 0 ошибок за 2 мин | bot/handlers/notifications.py |
| 22:42 | change | независимая память проекта: chat_history 21731, problem_solutions 12, change_log 178 коммитов; sync_memory.py | — |
| 22:50 | verify | разбор системы контроля: найдено 4 дефекта в самом контуре, все исправлены; эталон 11/11 | — |
| 23:20 | change | визуальный эталон: 17 экранов в design_canon/baseline_screens, visual.py, случай в эталоне; пойман дефект PageLayout/CloudStorage | project_management/tools/visual.py, scripts/playwright-screenshots.mjs |
| 23:45 | deploy | починены оба дефекта: миграция lesson_progress (200 OK) и обёртка CloudStorage (страницы не падают при WebAppMethodUnsupported); эталон 13/13 | backend/prisma/migrations/20260729_lesson_progress/migration.sql, frontend/src/components/layout/PageLayout.tsx |

## 2026-07-30

| Время | Вид | Что | Доказательство |
|---|---|---|---|
| 00:24 | change | дрейф схемы разобран: применены 9 индексов + 2 FK, дрейф 133→100 строк, решения по каждому пункту в SCHEMA_DRIFT.md, страж в эталоне | backend/prisma/migrations/20260730_missing_indexes_fk/migration.sql |
