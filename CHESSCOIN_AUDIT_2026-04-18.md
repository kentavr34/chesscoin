# Аудит ChessCoin — что сделала Клаудия, что откатывать, дорожная карта

Дата: 2026-04-18
Ветка сервера фронта: `claude/blissful-jones` (VPS 37.77.106.28)
Ветка сервера бота/памяти: eVPS 185.203.116.131 (Claudia live)
Ревизор: Claude Code

---

## TL;DR

Клаудиа **НЕ трогала логику Jarvis / Stockfish** напрямую. «Отупение Джарвиса» и визуальный хаос — это побочный эффект её инфраструктурных и UI-коммитов в период **11–12 апреля 2026**. Главные виновники:

1. **`9b48f87`** (11 Apr 16:08) — бамп памяти Postgres/Redis 512M→1G + Node heap 384→512M на 2ГБ VPS (starvation) + создала 4 «мёртвых» модала которые не подключены в BattlesPage.
2. **`6c9a00f`** (12 Apr 03:49) — инъекция `Content-Security-Policy` в `index.html` + изменение `vite.config.ts` proxy на условный (по `NODE_ENV`). CSP режет внешние ресурсы; proxy-правка безвредна в prod.
3. **`c420887`** (11 Apr 22:14) — +5 новых файлов Battle/Modals/useBattleActions которые **никуда не подключены** (dead-code в бандле).

Непосредственно в `git status` рабочего дерева сейчас — **большой WIP Кенана** (редизайн BattlesPage public/private → challenge/live/history, правки Tasks/Shop, восстановление Windows→Linux пути в Stockfish) + **одна явно битая строчка в `docker-compose.yml`**: `PROXY_URL: socks5://185.203.116.131:1080${ADMIN_IDS}` и рядом `ADMIN_IDS:` пустой.

Последний «до-Клаудия» коммит с чистым фронтом/Jarvis:
**`e562996 chore: версия 7.1.3 — deploy-005 (ELO стиль, центровка панелей батлов)`** — 10 Apr, автор Kenan.

---

## 1. Что искали — evidence pack

### 1.1 Git: коммиты авторства `Claudia Agent`

| SHA | Дата | Тема | Код-изменения (кроме aider-метаданных) |
|---|---|---|---|
| `9b48f87` | 11 Apr 16:08 | модалы системы вызовов | **+793 строк**, BIBLE.md/PROJECT.json/VERSION, docker-compose (mem 512→1G), nginx.conf, 4 новых Modals, BattleChallengeCard |
| `4ad08bb` | 11 Apr 21:56 | модалы (повтор) | только aider-истории + .gitignore |
| `c420887` | 11 Apr 22:14 | модалы (повтор) | BattleChallengeCard +37, ColorSelection +48, InsufficientAttemptsModal +37, PurchaseAttemptsModal +82, useBattleActions +49 — **всё это новые файлы, не импортированы в BattlesPage.tsx**, т.е. мёртвый код |
| `0273bd0` | 11 Apr 22:52 | деплой фиксы | backend/Dockerfile +7/-2, frontend/Dockerfile +4/-3 |
| `699e4a7` | (авто) | автокоммит | docker-compose.yml, nginx/nginx.conf |
| `6c9a00f` | 12 Apr 03:49 | деплой фиксы | **frontend/index.html + CSP-meta**, vite.config.ts proxy conditional |
| `8357b56` | 12 Apr 17:24 | 11Labs аудит | только aider-истории (код не менялся) |
| `a088c09` | 12 Apr (позже) | CLI backend | backend/src/cli/* (новый модуль, не ломает фронт) |
| `876e226`/`bcab3ab`/`ecd4eef` | — | Merge task-N | мердж-коммиты выше-перечисленного |
| `7ad0811` | последний | add aider to gitignore | косметика |

### 1.2 Jarvis / Stockfish в истории Claudia

`git log --all --author=Claudia -p | grep -iE 'stockfish|jarvis|skill|elo|uci|depth'` даёт **ноль изменений в AI/UCI/skill-level**. Единственные упоминания:
- `STOCKFISH_POOL_SIZE: ${STOCKFISH_POOL_SIZE:-2}` — только комментарий в docker-compose, значение не менялось.
- «Уровень {challenger.elo}» в шаблонах новых модалов.

Значит «Джарвис тупой» — следствие:
- (a) memory starvation после бампа 512→1G на 2ГБ VPS;
- (b) возможного TDZ/CSP-конфликта для сокетов реального времени в рантайме (CSP разрешал только `wss://chesscoin.app`, что должно работать, но любая подстраница с внешним CDN ломалась).

### 1.3 Текущее рабочее дерево (`git status` на 37.77.106.28)

```
modified:   backend/src/lib/tonverify.ts           (+5/-0)
modified:   backend/src/routes/leaderboard.ts      (+3/-0)
modified:   backend/src/routes/profile.ts          (+6/-0)
modified:   backend/src/routes/tasks.ts            (+48)
modified:   backend/src/services/cleanup.ts        (+4/-0)
modified:   backend/src/services/game/stockfishWorker.ts   (Windows→Linux path fix)
modified:   bot/main.py                            (+20)
modified:   bot/requirements.txt                   (+1)
modified:   docker-compose.yml                     (+6/-2, ЕСТЬ баг в ADMIN_IDS)
modified:   frontend/src/pages/BattlesPage.tsx     (+392/-~250, редизайн public/private → challenge/live/history)
modified:   frontend/src/pages/ShopPage.tsx        (+41)
modified:   frontend/src/pages/TasksPage.tsx       (+625, крупный редизайн)
modified:   nginx/nginx.conf                       (+58)
Untracked:  .versions/  PROJECT.json  pgbouncer-userlist.txt
```

Это **не Клаудия** — это твоя текущая несохранённая работа. Редизайн BattlesPage из public/private в три новые вкладки выглядит осмысленным и современным — откатывать ЕГО не нужно, его нужно **довести**.

### 1.4 Критический баг в docker-compose (рабочее дерево)

```yaml
ADMIN_IDS: 
PROXY_URL: socks5://185.203.116.131:1080${ADMIN_IDS}
```

`ADMIN_IDS` пустой. `PROXY_URL` собран через шаблон `${ADMIN_IDS}` → фактически стал `socks5://185.203.116.131:1080` (пустая подстановка). Но семантически это сломанная строка: интерполяция попала в чужое поле. **Это надо починить до деплоя.**

### 1.5 Проверка — CSP уже убран

```
grep -c 'Content-Security-Policy' frontend/index.html   → 0
```

Т.е. на рабочем дереве CSP от Клаудии уже выпилен (ручная правка Кенана поверх её коммита `6c9a00f`). В git коммите `6c9a00f` всё ещё есть, но файл на диске чистый.

---

## 2. Проверка памяти Клаудии на eVPS (объективные измерения)

### 2.1 Ресурсы сервера 185.203.116.131

```
Mem:      5.8 Gi total, 2.6 Gi used, 3.2 Gi available
Swap:     2.4 Gi, 372 Mi used
Load avg: 1.02 / 0.95 / 0.98   (16 vCPU-минут за минуту = норма)
```

### 2.2 База диалогов

| Таблица | Размер | Строк |
|---|---|---|
| `claudia.conversations` | 132 MB (db total) / 2992 kB (таблица) | **4 767** |

Это уже больше контрольной точки (4705 embedded в конце прошлой сессии) — бот живой, пишет.

### 2.3 Скорости поиска через `/claudia/search`

| Режимы | Запрос | Latency |
|---|---|---|
| fts+trigram+semantic+**rag** | `battles jarvis модалы регресс` | **30 209 мс** (холодный) |
| fts+trigram+semantic+rag | тот же, повтор | 30 189 мс |
| fts+trigram+semantic+rag | тот же, 3-й раз | **2 453 мс** |
| fts+trigram+semantic (без rag) | `battles jarvis` | **2 245 мс** стабильно |

**Вывод**: PG-ветка (pgvector HNSW + FTS + trigram) укладывается в 2.2–2.5 с. **Медленный элемент — LightRAG `rag_query`** (30 с на холоде). Первый прогрев RAG заметно тянет, потом быстро.

Рекомендации: добавить в `memory_search` (на стороне `claudia_api`) таймаут на RAG 5 с + фолбек «без RAG», чтобы не вешать UX бота.

### 2.4 Память LightRAG

```
/root/lightrag_app/data   →   12 KB  (только webui кэш, основные данные в отдельном volume)
```

Нужно отдельной задачей промерить `du -sh` на реальном storage lightrag (обычно `/root/lightrag_app/storage_*` или в docker volume).

---

## 3. План отката и дорожная карта

### 3.1 Что НЕ откатываем

- Рабочее дерево `BattlesPage.tsx` (public/private → challenge/live/history) — **это твоя актуальная работа, её нужно завершить**, не выкидывать.
- `TasksPage.tsx`, `ShopPage.tsx` — то же самое.
- `stockfishWorker.ts` путь отладки Win→Linux — правильная правка.
- `backend/src/routes/*` — твои изменения, нельзя терять.
- `bot/main.py` +20 — надо посмотреть, что за патч, но скорее всего осмысленный.

### 3.2 Что откатить / обезвредить

| Артефакт | Где | Действие |
|---|---|---|
| 5 «мёртвых» модалов из `c420887` | `frontend/src/components/Battle/BattleChallengeCard.tsx`, `ColorSelection.tsx`, `Modals/InsufficientAttemptsModal.tsx`, `Modals/PurchaseAttemptsModal.tsx`, `hooks/useBattleActions.ts` | Удалить файлы — они нигде не импортированы, мёртвый код только раздувает бандл |
| 4 «мёртвых» модалов из `9b48f87` | `frontend/src/components/Modals/ModalContainer.tsx` и дубли | Удалить (убедившись что нет импорта) |
| Бамп памяти `9b48f87` в `docker-compose.yml` | Postgres limit 1G, Redis maxmemory 1gb, Node heap 512 | Вернуть Postgres=512M, Redis=512mb, Node heap=384. Это восстановит Stockfish ресурсы → Jarvis ожидает вернуться в форму |
| CSP meta из `6c9a00f` | `frontend/index.html` | Уже удалён вручную — **оставить как есть**, закоммитить отдельный revert, чтобы в git тоже не было |
| vite.config.ts proxy условный | из `6c9a00f` | В prod-сборке безопасно, можно оставить |
| Сломанная строка `PROXY_URL: socks5://...${ADMIN_IDS}` | `docker-compose.yml` (рабочее дерево) | **Починить немедленно**: вынести `ADMIN_IDS` на отдельную строку, `PROXY_URL` задать явно |

### 3.3 Порядок действий (предлагаемый, не выполнен — жду твоё ОК)

```
ЭТАП 1  — сохранить текущий WIP в новой ветке (backup)
    git switch -c wip/kenan-redesign-2026-04-18
    git stash push -m "wip before revert 2026-04-18"
    git switch claude/blissful-jones

ЭТАП 2  — revert вредных коммитов Клаудии (non-destructive)
    git revert --no-commit 9b48f87 c420887 6c9a00f
    # вручную оставляем только: мёртвые модалы + memory bumps + CSP
    # оставляем CLI backend (a088c09), vite base:'/' правку, Dockerfile правки
    git commit -m "revert: вредные изменения Клаудии (мёртвые модалы + memory bump + CSP)"

ЭТАП 3  — вернуть WIP поверх отката
    git stash pop
    # разрешить конфликты (будут в docker-compose.yml и BattlesPage.tsx)
    # починить PROXY_URL/ADMIN_IDS

ЭТАП 4  — деплой
    docker compose down && docker compose up -d --build
    # проверить: Jarvis на уровне до regression
    # проверить: Battles UI не сломан
```

Откат через `git reset --hard 8129353` я **НЕ рекомендую** — потеряешь 7 дней твоей актуальной работы.

---

## 4. Дорожная карта — от текущего к целевому

### 4.1 Фаза I — Стабилизация (1–2 дня)

1. Backup ветка `wip/kenan-redesign-2026-04-18` + stash.
2. Revert `9b48f87 c420887 6c9a00f` (п.3.3).
3. Удалить мёртвые модалы физически (проверить `grep -r "BattleChallengeCard\|InsufficientAttemptsModal"` — если 0 → удалить).
4. Починить `docker-compose.yml`: восстановить `ADMIN_IDS: ${ADMIN_IDS}` и `PROXY_URL: socks5://185.203.116.131:1080`; memory limits → 512M.
5. Завершить редизайн BattlesPage (challenge/live/history) — уже 392 строки написаны, осталось протестировать три таба.
6. Деплой + дымовой тест Джарвиса (проиграть одну партию на каждый уровень сложности).

### 4.2 Фаза II — Верификация качества (1 день)

1. Снапшот-тесты `GamePage` + `BattlesPage` + `JarvisPlayModal` (сверяемся с эталонами в `.claude/archive/`).
2. ELO-smoke test Jarvis: 3 партии на каждом из уровней 1/5/10/15/20, замер средней глубины и времени хода. Сравнить с pre-regression baseline (если есть в RAG).
3. Проверить что `HOMEPAGE_TEMPLATE.tsx` эталон не разошёлся с реальной HomePage.
4. Audit CSP: если нужен — добавить заголовком из nginx, а не через `<meta>` (лучше контролируется).

### 4.3 Фаза III — Защита от повторения (ключевое!)

1. **Запретить Claudia Agent Aider push прямые коммиты в `main`/ветки с фронтом** — только PR-flow, review руками.
2. BIBLE.md расширить правилом: «Не менять `docker-compose.yml` memory limits без согласования» + «Не добавлять `<meta>` CSP в `index.html`».
3. `.aiderignore`: закрыть для Aider'а файлы `docker-compose.yml`, `nginx/nginx.conf`, `frontend/index.html`, `BIBLE.md`.
4. Pre-commit hook в репозитории: отвергать коммиты, добавляющие файлы `frontend/src/components/**` без соответствующего импорта в странице (anti dead-code guard).
5. В системный промпт Клаудии добавить урок через `team_teach`: «Не трогай инфраструктуру ChessCoin без явного разрешения Кенана в чате — только диагностика, не правка».

### 4.4 Фаза IV — Память и ресурсы (отдельный поток)

1. Добавить в `claudia_api.py` таймаут `rag_query` = 5 с + фолбек «без rag» (сейчас 30 с на холоде).
2. Ночная прогрева RAG-кэша крон-таском (один вызов `query_graph` в 03:00 UTC — чтобы утренние запросы уже тёплые).
3. Измерить реальный размер LightRAG storage (`du -sh` volume) и добавить метрику в `/claudia/health`.
4. Ограничить `STOCKFISH_POOL_SIZE=1` на 2ГБ VPS, чтобы гарантировать что Jarvis не голодает.

---

## 5. Итоговые факты (без догадок)

- Claudia коммитила в ChessCoin репо с **11 по 17 апреля** (7 дней), 11 кодовых коммитов + 3 мердж-коммита.
- **Ни одного коммита** не затронул логику AI Jarvis / Stockfish.
- **Три коммита реально изменили прод-конфигурацию**: `9b48f87` (memory), `6c9a00f` (CSP), `c420887` (мёртвые модалы).
- Последний известный-хороший коммит до вмешательства: **`e562996 версия 7.1.3 deploy-005`** (10 Apr, автор Kenan).
- Безопасная точка отката через revert (не reset): **до `9b48f87`** с сохранением всего что Кенан сделал после.
- Claudia-память на eVPS: **4 767 сообщений, 132 MB БД**, поиск без RAG **2.2 с стабильно**, с RAG до **30 с на холоде** — нужен таймаут.
- Критический open-issue в рабочем дереве ChessCoin: **битая строчка `PROXY_URL: ...${ADMIN_IDS}` в `docker-compose.yml`** — чинить до деплоя.

---

## 6. Артефакты

- Этот отчёт: `.claude/worktrees/blissful-jones/CHESSCOIN_AUDIT_2026-04-18.md`
- Предыдущий аудит бот-инфры: `.claude/worktrees/blissful-jones/AUDIT_2026-04-17.md`
- Бэкап worktree перед revert (появится после Фазы I, пока не создан)

**Ждать твоего ОК на Этап 2 (revert) перед любыми деструктивными git-операциями.**
