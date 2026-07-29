# 🔒 ИЗОЛЯЦИЯ И ДОСТУПЫ

> Причина существования правила: ChessCoin делит сервер с Claudia и Jobus.
> Всё, что ломало проект раньше, ломало его именно на стыке: «чинили одно —
> задели соседнее», «деплой ушёл не туда», «hotfix не пережил reboot».

## Кто имеет доступ

| Кто | К чему | Чем ограничен |
|---|---|---|
| Кенан | всё | владелец |
| Claude (я) | `/opt/chesscoin`, контейнеры `chesscoin_*`, БД `chesscoin` и схема `chesscoin_pm` | ключ `C:/Users/SAM/.ssh/claude_deploy_key` |
| Claudia / Jobus | свои каталоги и контейнеры | к `/opt/chesscoin` не обращаются |

**Правило:** агент, который пишет в чужой прод-каталог, — источник аварий,
а не удобство. Если Claudia или Jobus что-то делают с ChessCoin — это ошибка
конфигурации, её надо найти и убрать, а не «уживаться».

## Границы, которые нельзя размывать

| Рубеж | Состояние на 29.07.2026 | Как проверить |
|---|---|---|
| Контейнеры ChessCoin | 8, все `Up`, 5 из них с healthcheck | `docker ps --format '{{.Names}} {{.Status}}' \| grep chesscoin_` |
| Каталог продукта | `/opt/chesscoin`, ветка `main` = `origin/main` | `cd /opt/chesscoin && git status -sb` |
| Домен | `chesscoin.app` → `45.67.216.36` | `Resolve-DnsName chesscoin.app -Type A` |
| БД игры | `chesscoin` в контейнере `chesscoin_postgres`; приложение ходит через pgbouncer | `docker exec chesscoin_postgres psql -U chesscoin -l` |
| БД управления | схема `chesscoin_pm` в БД `claudia` (тот же контейнер) | `\dn` |
| Секреты | `.secrets.enc` в репо (AES-256), `.env` только на проде, права `600` | `ls -la /opt/chesscoin/.env` |
| GitHub | `kentavr34/chesscoin`, push из рабочей копии, мёрдж в `main` — Кенан | `git remote -v` |

## Что НЕ является нашим (частая путаница)

- **БД `claudia`** — это память ЦНС. Мы пишем туда только в схему `chesscoin_pm`
  и в `claudia_learned_solutions`/`dialog_history` с `project='chesscoin'`.
  Остальные 62 таблицы — не наши.
- **`deploy-app-1`, `deploy-db-1`, `jt-chrome`** — чужие контейнеры на том же демоне.
- **`/opt/corpus_lab`, `/opt/local-llm`** — инфра ЦНС.

## Бэкапы — честная картина на 29.07.2026

**Проверено по факту:** отдельной автоматической схемы бэкапа ChessCoin
(код + БД + аватары) **не обнаружено**. Есть:
- код — в GitHub (`origin/main`), это полноценная копия;
- `/opt/chesscoin-archives` — архивные снимки, состав и свежесть не проверены;
- дамп БД — регулярного расписания не найдено.

**Не бэкапится:** каталог `avatars/` (6.7 МБ пользовательских аватаров),
`.env` (секреты прода), сама БД `chesscoin`.

Это открытый долг — записан в `registry/TODO_FIXES.md`. Проверка бэкапа =
распаковать и сверить количество строк/файлов, а не прочитать «OK» в журнале.

## Reset-safe

Каждый ручной фикс проверяется вопросом «переживёт ли hard reboot?».
Не переживёт — оформить в `docker-compose`/entrypoint/systemd в тот же день.
*(Пример незакрытого: ручной `ALTER USER` + правка `pg_hba.conf` для pgbouncer —
работает, но compose-патч действует только при init на пустой БД.)*
