# SAFETY_POLICY.md — Политика безопасности изменений

> Цель: **не терять достигнутое**. Регрессия = потеря времени, денег, доверия.
> Этот документ описывает обязательные шаги при любых правках на ChessCoin.

---

## 🟥 АБСОЛЮТНЫЙ ЗАПРЕТ — ЭМОДЗИ В UI

**Правило Кенана 2026-05-14 — записать в память железно:**

> «Никаких эмодзи. 1 эмодзи = 1 раз ты долбаёб.»

### Что под запретом
- Любые `🪙 💰 💵 💴 💶 💷 🟡 🟢 🔴` (стопки монет, кружки статусов) — **только** `<CoinIcon />`.
- `🏆 ⚔️ ♟ 🤝 💔 🎉 🎁 🛒 💸 🔒 🏁 ⏳ ⚡ 👁 👑 ✓ ✗ ★ ☆` — **только** SVG из
  `frontend/src/components/icons/` (`ChessIcons.tsx`, `TournamentIcons.tsx`).
- `🇷🇺 🇺🇸 🇦🇿` regional-indicator флаги — **`<CountryFlag code="RU" />`**
  (текстовый кружок с кодом страны). Не работают в Telegram WebApp mobile.
- `🥇 🥈 🥉` — текст «1 место / 2 место / 3 место» + SVG-корона / медаль.
- `🌅 📚 📢 ✅` декоративные в инфо-слайдах — пересмотреть позже,
  но новых **не добавлять**.

### Единственные допустимые исключения
- **Текстовая руна `ᚙ`** (U+1699, Y-rune) — это валютный знак ChessCoin,
  не эмодзи. Используется как буква. Всё остальное от валюты — `<CoinIcon />`.
- Эмодзи внутри **сообщений Telegram-бота** (`bot/*.py`) — Telegram нормально
  их рендерит в чате. Это **не UI Mini App**.
- Эмодзи в **комментариях кода** (`// 🔥 todo`) — не видны пользователю,
  никого не волнуют.

### Что делать когда хочется добавить эмодзи
1. Открыть `frontend/src/components/icons/ChessIcons.tsx` /
   `TournamentIcons.tsx` / `CoinIcon.tsx` — может уже есть SVG.
2. Если нет — сделать новый SVG в этом же файле, **скопировав
   стиль соседних** (viewBox, currentColor, размер).
3. Использовать как `<NewIcon size={18} />`.
4. Закоммитить с пометкой `feat(icons): добавлен <name> вместо 🎯 эмодзи`.

### Если в существующем коде встретился эмодзи
- **Удалить или заменить на SVG.** Не оставлять «потому что было раньше».
- Зафиксировать факт замены в HISTORY.json.

### Счётчик нарушений
Каждое добавленное эмодзи в UI — это **−1 к доверию Кенана**. Кенан так и
сказал: «1 эмодзи = 1 раз ты долбаёб». Соответствующая запись попадает в
`projects/chesscoin/HISTORY.json` в раздел `lessons_learned`.

---

## ПРАВИЛА КЛАУДЫ ДО НАЧАЛА ИЗМЕНЕНИЙ

### S1. Прочитать пять каноников
1. `MASTER_PLAN.md`
2. `ROADMAP_V3.md` — какая текущая фаза, какие фазы НЕ начаты.
3. `MECHANICS.md` — целевая механика.
4. `projects/chesscoin/HISTORY.json` — что уже FINAL (не трогать).
5. `AUDIT_<последняя_дата>.md` — текущие известные баги.

**Без этого — никаких действий с кодом.**

### S2. Проверить контекст сервера
```bash
getent hosts chesscoin.app           # должно быть 185.203.118.96
git log --oneline -10                # локально
ssh root@185.203.118.96 "cd /opt/chesscoin && git log --oneline -3"
```
Если IP или коммиты разошлись — **остановиться и обновить документы**.

### S3. Определить границы изменения
- **Какой режим затрагиваем?** (BOT / BATTLE / WAR / TOURNAMENT / SHOP / TON)
- **Какие файлы будут изменены?** Сделать список ДО первого Edit.
- **Какие файлы НЕ должны быть тронуты?** Эталоны:
  - `HOMEPAGE_TEMPLATE.tsx` (если есть в архиве)
  - `JarvisPlayModal.tsx` — выбор цвета (icons IcoDice/IcoKingW/IcoKingB)
  - `CreateBattleModal.tsx` — заголовочный SVG скрещенных мечей (b4d9faa)
  - `BattleHistoryCard.tsx` — единый шаблон истории
  - `GameResultModal.tsx`
  - `index.css` (CSS-переменные дизайна)

Если **необходимо** изменить эталон — **спросить Кенана**, не редактировать
молча.

---

## ОБЯЗАТЕЛЬНЫЙ ЦИКЛ: «BACKUP → EDIT → VERIFY → DEPLOY → VERIFY → LOG»

### B. BACKUP (перед фазой или большим коммитом)

```bash
TS=$(date +%Y%m%d-%H%M%S)

# Git точка отката
git tag backup-$TS-pre-<short-task-name>
git push origin backup-$TS-pre-<short-task-name>

# Бэкап БД prod
ssh root@185.203.118.96 "
  docker exec chesscoin_postgres pg_dump -U chesscoin chesscoin |
  gzip > /root/backups/db-prod-pre-$TS.sql.gz
"

# Бэкап кода prod
ssh root@185.203.118.96 "
  tar -C /opt -czf /root/backups/code-prod-pre-$TS.tar.gz chesscoin \
    --exclude='chesscoin/node_modules' \
    --exclude='chesscoin/frontend/node_modules' \
    --exclude='chesscoin/.git'
"
```

**Откат одной командой:**
```bash
ssh root@185.203.118.96 "
  cd /opt/chesscoin && git checkout backup-<TAG> &&
  gunzip < /root/backups/db-prod-pre-<TS>.sql.gz |
    docker exec -i chesscoin_postgres psql -U chesscoin chesscoin &&
  docker compose up -d --build backend frontend
"
```

### E. EDIT — Хирургические правки

**Правила:**
- **Один файл = один логический фикс** в одном коммите. Если нужно тронуть 3
  файла — это всё ещё один фикс, но не «заодно поправил соседний баг».
- **Перед Edit прочесть весь блок кода** — не только строки которые меняешь.
  Понимать контекст функции, какие импорты, какие side-effects.
- **Если непонятно** — задать вопрос Кенану, не угадывать.
- **Никаких массовых `grep -r` правок** без явного разрешения. Каждое
  изменение точечное.
- **Не удалять** код, который кажется «лишним». Сначала спросить.
- **Не переименовывать** функции / типы / props — они могут использоваться
  где-то ещё, breaking change.

### V1. VERIFY (локально перед коммитом)

```bash
# TypeScript: проверить сборку
cd frontend && npm run build || echo FAIL

# Подсчёт регрессий в типах
grep -rn "any\b" frontend/src/<changed-files> || echo "no any"

# Очевидные несовместимости
git diff HEAD~1
```

Если build падает — **остановиться, разобраться**, не пушить.

### D. DEPLOY — один коммит за раз

```bash
git add <specific-files>     # никогда git add -A без проверки
git commit -m "fix(<area>): <что и почему>"
git push origin main

ssh root@185.203.118.96 "
  cd /opt/chesscoin &&
  git pull origin main &&
  docker compose up -d --build <frontend|backend>
"
```

**Никаких массовых деплоев.** Один коммит — один деплой — одна проверка.

### V2. VERIFY (на проде)

```bash
ssh root@185.203.118.96 "
  sleep 8 &&
  docker ps --format '{{.Names}}\t{{.Status}}' | grep chesscoin &&
  docker logs chesscoin_backend --since 1m | grep -iE 'error|fatal' | head -10
"

curl -sS -I https://chesscoin.app/ | grep -E 'HTTP|last-modified'
curl -sS https://chesscoin.app/ | grep -oE 'src=\"/assets/index-[^\"]*\\.js' | head -1
```

Если в логах **новые ошибки** или контейнер не healthy — **немедленный откат**
по команде из B. Без раздумий.

### L. LOG (после успешного деплоя)

1. **Запись в `projects/chesscoin/HISTORY.json`**:
```json
{
  "date": "2026-MM-DD",
  "title": "что именно сделано",
  "status": "FINAL",
  "commit": "abc1234",
  "files": ["frontend/src/...", "backend/src/..."],
  "verified_on_prod": true,
  "notes": "что Кенан тестил, что подтвердил"
}
```

2. **Отчёт Кенану**: 1–3 строки.
   - что починено,
   - какой коммит,
   - что проверить.

---

## ЧТО ЗАПРЕЩЕНО (учёт прошлых грабель)

### F1. «Заодно поправил соседнее»
**Никогда.** Если в одном файле увидел другой баг — записать в HISTORY как
WIP, выйти из файла, сделать отдельным коммитом потом.

### F2. «Refactor этого модуля для удобства»
**Никогда без явного запроса Кенана.** Refactor = breaking change для
зависимых файлов.

### F3. Удаление «лишних» эмодзи / комментариев / kода
Только в рамках задачи которая это просит. `git blame` показывает кто и когда
добавил — может это Кенан явно одобрил.

### F4. Игнорирование TypeScript ошибок
Vite build не падает на TS-ошибках, но runtime баг будет. **Всегда** запускать
`npm run build` локально и читать ошибки.

### F5. Деплой без проверки логов прода
После `docker compose up -d --build` обязательно `docker logs --since 1m`.
**Любая `prisma:error` или `Fatal:` = немедленный откат.**

### F6. Использование `git reset --hard` или `git push -f`
**Никогда** без явного «да» от Кенана. Откат через `git checkout` + новый
коммит-revert.

### F7. Прямые правки на проде (`docker exec ... edit`)
Запрещено за исключением:
- ALTER TABLE / ALTER TYPE с предварительной фиксацией в репо (migration.sql).
- Hot-fix конфига с обязательной фиксацией в `docker-compose.yml`.

В любом случае — записать в HISTORY с указанием «применено вручную на проде,
причина: ...».

---

## ИСПОЛЬЗОВАНИЕ ВЕРСИОНИРОВАНИЯ

### Backup-точки в git
- `backup-YYYY-MM-DD-pre-<task>` — перед каждой фазой или большим коммитом.
- Хранить **минимум последние 5**, можно периодически чистить старые.

### Текущий список бэкап-точек

| Tag | Что было |
|---|---|
| `backup-2026-05-12-pre-rank-fix` | До фиксов «Кубки» и эмодзи. Активный rollback-target. |

### Бэкапы БД prod (на сервере)

| Файл | Что |
|---|---|
| `/root/backups/db-prod-pre-rank-fix-20260512-004116.sql.gz` | Соответствует tag-у выше |
| `/root/backups/chesscoin-legacy-final/db-20260512-021139.sql` | Финальный дамп legacy перед чисткой |

---

## ОБЯЗАТЕЛЬНЫЕ ЧЕКИ ПЕРЕД КАЖДОЙ СЕССИЕЙ

```bash
# 1. Где мы вообще
getent hosts chesscoin.app
git log --oneline -5

# 2. Что на проде
ssh root@185.203.118.96 "cd /opt/chesscoin && git log --oneline -3"
ssh root@185.203.118.96 "docker ps --format '{{.Names}}\t{{.Status}}' | grep chesscoin"
ssh root@185.203.118.96 "docker logs chesscoin_backend --since 1h | grep -iE 'error|fatal' | tail -10"

# 3. Что в БД (для понимания живых данных)
ssh root@185.203.118.96 "docker exec chesscoin_postgres psql -U chesscoin -c \"
  SELECT 'sessions IN_PROGRESS', count(*) FROM sessions WHERE status='IN_PROGRESS'
  UNION ALL SELECT 'tournament_matches IN_PROGRESS', count(*) FROM tournament_matches WHERE status='IN_PROGRESS'
  UNION ALL SELECT 'country_wars IN_PROGRESS', count(*) FROM country_wars WHERE status='IN_PROGRESS';
\""
```

Если что-то не сходится с памятью — **обновить документы перед действиями**.

---

## РОЛЬ КЛАУДЫ

- **Не утверждать «сделано» без visual proof.** Бинарный исход: либо есть
  доказательство (curl/screenshot/log), либо «не подтверждено, нужна проверка
  Кенаном».
- **«Не получилось» = «не получилось».** Не переписывать в «сделано
  частично» или «в процессе».
- **Не выдумывать причины.** Точный текст ошибки в кавычках → google → доки.
- **Если запрос неясен** — задать вопрос **до** правки. Не интерпретировать
  «как поняла».

---

## ВЕРСИОНИРОВАНИЕ ЭТОГО ДОКУМЕНТА

- v1 (2026-05-14) — первая версия. Может расширяться при каждом инциденте,
  чтобы он больше не повторился.
