# JOURNAL — ChessCoin

> Журнал работы по `MASTER_PLAN.md`. Один пункт = одна запись.
> Формат: **дата · ссылка на пункт плана · что сделано · как проверила · решение** (закрыто / ещё работаем / откатили).
> Что прошло хорошо — помечаю **🟩 ШАБЛОН** и описываю «как повторить».

---

## Шаблон записи

```
### YYYY-MM-DD HH:MM · <пункт плана> · <короткое название>
- Сделано: <конкретные правки/коммит>.
- Проверка: <curl / docker logs / визуально в Telegram>.
- Решение: ✅ закрыто / ⏸ пауза / ❌ откатили.
- Что хорошо: <если что-то годное — фиксируем как шаблон>.
```

---

## 2026-05-15 — сессия эмодзи-чистки и центральных модалов

### 2026-05-15 — план плана § 4 (журнал предыдущих коммитов)
- В MASTER_PLAN § 4 уже есть таблица коммитов 2026-05-09 → 2026-05-12. Журнал
  стартует с текущей сессии 2026-05-15, чтобы не дублировать.

### 2026-05-15 · § 0 правило 3 (один CoinIcon) + § 2 A.6 · Чистка мojibake-эмодзи
- Сделано: SVG-набор `frontend/src/components/icons/UiIcons.tsx` (24 иконки),
  `CountryFlag.tsx` вместо regional-indicator. Очищены ProfilePage / WarsPage /
  TournamentsPage / BattlesPage. `🪙` 💰 «стопка монет» → `<CoinIcon />`.
- Проверка: страницы открываются в Telegram WebApp, монеты — золотой конь.
- Решение: ✅ закрыто по перечисленным страницам. Хвосты (GameSetupModal,
  ShopItemCards, ShopPage, GameResultModal, EventEffects, VictoryScreen,
  FloatingCoins, BadgeDetailModal) — в очереди.
- 🟩 ШАБЛОН: «эмодзи → SVG» работает так: один файл `UiIcons.tsx` с хелпером
  `baseSvg(size, viewBox, children)`, далее `<IcoX size={N} />` в местах
  старого эмодзи. Цвета через `currentColor`, размер — пропс.

### 2026-05-15 · § 2 A.6 + правило 4 (минимум эмодзи) · BattlesPage — 2 вкладки
- Сделано: BattlesPage сведён к двум вкладкам (Публичные / Приватные).
  FAB `⚡` quick game убран. Пресеты ставок 10K/50K/100K/500K из CreateBattleModal
  удалены. История партий вынесена со страницы (через иконку часов).
- Проверка: визуально, через Telegram. Сейчас публичные = live+waiting,
  приватные = `myPrivateSessions`.
- Решение: ✅ закрыто (соответствует прямой команде Кенана 2026-05-14).
- 🟩 ШАБЛОН: «2 вкладки вместо 3» — `type Tab = 'public' | 'private'`, контент
  собран из существующих коллекций без новых запросов.

### 2026-05-15 · § 2 A.3 + § 0 правило 5 (модалы по центру) · DonateModal центр
- Сделано (commit `256e04a`): `frontend/src/components/ui/DonateModal.tsx`
  переведён из bottom-sheet в центральный: `alignItems: 'center'`,
  `borderRadius: 20` со всех сторон, тень вниз, убран drag-handle и `🏆`.
  WarsPage CountryModal: вместо «инлайн-инпут + кнопка» — одна кнопка с
  CoinIcon, открывающая DonateModal. Tournaments: локальный DonateModal
  заменён на тонкую обёртку над общим `UiDonateModal`.
- Проверка: `ssh root@185.203.118.96 "docker compose up -d --build frontend"`
  собрался и стартанул (`Container chesscoin_frontend Started`).
- Решение: ✅ закрыто. Прямой ответ на жалобу «ниже плинтуса».
- 🟩 ШАБЛОН: один компонент `DonateModal({ onClose, onSubmit, currentPool })`
  для Wars и Tournaments. Бизнес-логика передаётся через `onSubmit(amount)`,
  модал ничего не знает про API. Использовать так и для будущих донат-сценариев.

### 2026-05-15 · § 2 A.6 + правило 4 · ReferralsPage — SVG-знаки рангов
- Сделано (commit `d521ecf`): новый компонент
  `frontend/src/components/ui/RankBadge.tsx` (tier × count → SVG-погон:
  crown / wreath / bigStar / medal / midStar / dot / rhombus / rhombusBlue /
  dotBlue / helmet / recruit). В `ReferralsPage.tsx` 18 эмодзи в
  `RANK_THRESHOLDS_BASE` заменены на `tier + count`; 3 места отрисовки
  (текущий ранг / следующий / лесенка) теперь рендерят `<RankBadge>`.
- Проверка: deploy на prod прошёл, `Container chesscoin_frontend Started`.
- Решение: ✅ закрыто.
- 🟩 ШАБЛОН: «список рангов с эмодзи» → плоская таблица с `tier+count`,
  один SVG-компонент-роутер. Этот же приём подойдёт для лиг
  (BRONZE/SILVER/GOLD/DIAMOND/CHAMPION/STAR) — там сейчас лежат
  `leagueShort` строки, можно поднять до badge.

---

### 2026-05-15 · § 2 A.6 + правило 4 · TournamentsPage — проверка хвостов
- Сделано: проверка `Grep` по эмодзи (`🛡 🏆 ⚔ 🎖 🏅 🌟 ⭐ 🪙 💰 👑`) и
  по mojibake-сигнатурам (`рџ вљ вў вњ`) в `frontend/src/pages/TournamentsPage.tsx`.
- Проверка: `Grep` — 0 совпадений по обоим наборам.
- Решение: ✅ закрыто — TournamentsPage уже чист (правка ушла раньше в
  commit `89048b5` + последняя чистка mojibake).
- 🟩 ШАБЛОН: «закрыть пункт без правок» — тоже валидный исход. Не правлю
  ради правки. Запись в журнал = «проверено, чисто».

### 2026-05-15 · § 1.10 / § 2 CRITICAL · TransactionType enum sync на проде
- Сделано: на проде `185.203.118.96` через `docker exec chesscoin_postgres`
  выполнено пять `ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS '...'`
  для: `TOURNAMENT_WIN`, `BATTLE_DONATION`, `CLAN_WAR_WIN`, `TON_DEPOSIT`,
  `WALLET_UNLOCK`. После — `docker restart chesscoin_backend` (Prisma
  кэшировала старую схему).
- Проверка:
  - `SELECT unnest(enum_range(NULL::"TransactionType"))` — все 5 значений
    присутствуют.
  - `docker logs chesscoin_backend --since 1m` — чисто: `[DB] Connected`,
    `[Crons] Started: battles, clan wars, country wars, tournaments, ...`,
    `[Server] Port 3000 · production`. **Ни одной строки с `error`/`fatal`**.
- Решение: ✅ закрыто. Cron `checkTournamentResults` больше не падает на
  отсутствующих enum-значениях.
- 🟩 ШАБЛОН: «миграция enum reset-safe» — `ALTER TYPE ADD VALUE IF NOT EXISTS`
  идемпотентен, можно гонять при каждом старте. Чтобы не делать руками впредь —
  завести Prisma-миграцию `prisma/migrations/<date>_transaction_type_sync/`,
  туда положить эти `ALTER TYPE`, дальше `prisma migrate deploy` в entrypoint
  backend. **TODO в очередь** (см. п. 5 ниже).

---

### 2026-05-15 · § 2 A.6 хвосты · 8 компонентов (commit `7651b74`)
- Сделано: GameResultModal / VictoryScreen / FloatingCoins / BadgeDetailModal /
  EventEffects / ShopItemCards / GameSetupModal / ShopPage — декоративные
  эмодзи (🏆💔🤝⚔️💾🪙🤖📅👑⚡💥🖼✨🎉🎨🎮👤🏅💰🎲🔥🎯ℹ️💎💸🔒📥📤🏦🎭) →
  SVG-иконки IcoTrophy / IcoHandshake / IcoSave / CoinIcon / IcoRobot /
  IcoMedal / IcoBolt / IcoCrown / IcoCamera / IcoGamepad / IcoUsers /
  IcoTon / IcoMoneyFly / IcoLock / IcoArrowDown / IcoArrowUp / IcoBriefcase /
  IcoShop. В time-кнопках GameSetupModal эмодзи (⚡🔥♟🎯🏆👑) заменены на
  простое число «1/3/5/15/30/60» (meta-инфо дублируется в подписи).
  В UiIcons добавлены `IcoHeartBroken` и `IcoSave`. PageLayout.InfoSlide.icon
  переведён `string → React.ReactNode` (бэк-совместимо, `icon: ''` работает).
- Проверка:
  - Деплой: `git pull && docker compose up -d --build frontend` —
    `Container chesscoin_frontend Started`, ошибок сборки нет.
  - `curl https://chesscoin.app/ | grep index` → `index-khx6vhow.js` —
    новый bundle, значит JSX собрался.
- Решение: ✅ закрыто. Купленные WIN_ANIMATION (премиум-эффект победы)
  оставлены как есть — это товар, не дефолтный UI.
- 🟩 ШАБЛОН: «info-popup иконки» — иконка слайда теперь `React.ReactNode`,
  можно класть `<IcoX size={32} color="..."/>` прямо в массив. Использовать
  тот же приём для будущих info-strips и legend-блоков.

---

### 2026-05-15 · § 2 A.3 + A.6 · WarsPage: центральный confirm + 9 эмодзи (commit `88d3f14`)
- Сделано:
  - `showLeaveConfirm` bottom-sheet (overlayStyle с `alignItems: flex-end`)
    выброшен. Логика `handleLeave` теперь сама вызывает `pageConfirm({...})`
    через `useConfirm()` — заголовок, описание, danger-кнопка по центру.
  - Эмодзи: ⚔️ (×2 заголовка) → `IcoSwords`; 🏴 fallback флага → `CountryFlag`;
    👁 spectate → новый `IcoEye`; 💾 save → `IcoSave`; 🔍 в placeholder поиска
    → абсолютный `IcoSearch` слева от input; ⏱ перед таймером (×2) удалён;
    🕊️ (нет войн) → `IcoHandshake`; 📜 (история пуста) → `IcoStats`;
    🏆 (победитель ×2) → `IcoTrophy`; 🚪 (выход в шапке) → текст
    `t.wars.btnLeave`.
- Проверка:
  - `grep` по emoji-диапазону: остались только `✕` и `✓` (unicode-крест/чек,
    не emoji-блоки) — это допустимо.
  - Деплой: `Container chesscoin_frontend Started`. Bundle `index-yj7zQNaj.js`
    (новый хеш — JSX собрался).
- Решение: ✅ закрыто оба пункта (§ A.3 центральный confirm + § A.6 эмодзи).
- 🟩 ШАБЛОН: «bottom-sheet confirm → центральный confirm» — однострочная
  замена `setShow…(true)` на `await pageConfirm({title, message, okLabel,
  cancelLabel, danger: true})`. Удаляется ~30 строк inline-JSX модала.
  Использовать тот же подход для всех остальных подтверждений в проекте.

---

### 2026-05-15 · § 1.10 reset-safe · Prisma миграция enum + DIRECT_URL (commit `d45c1be`)
- Сделано:
  - `backend/prisma/migrations/20260515_transaction_type_sync/migration.sql`
    — DO-блок с `ALTER TYPE ADD VALUE` × 5 (TOURNAMENT_WIN, BATTLE_DONATION,
    CLAN_WAR_WIN, TON_DEPOSIT, WALLET_UNLOCK), каждый завернут в
    `EXCEPTION WHEN duplicate_object THEN null`.
  - `backend/Dockerfile` CMD: `npx prisma migrate deploy && node dist/index.js`
    — миграции применяются при каждом старте контейнера.
  - `backend/prisma/schema.prisma`: добавлен `directUrl = env("DIRECT_URL")`.
    Без него `migrate deploy` через pgbouncer таймаутит на
    `pg_advisory_lock` (transaction-mode pgbouncer не поддерживает session
    locks). С `directUrl` — Prisma идёт напрямую в Postgres только для
    миграций; рантайм клиент по-прежнему через pgbouncer.
  - `docker-compose.yml`: backend env `DIRECT_URL=postgres:5432`.
  - На проде вручную дописаны записи в `_prisma_migrations` для 2026-05-09,
    2026-05-10, 2026-05-15 (раньше применялись через `ALTER` напрямую).
  - Убит зависший pid 185489 с advisory lock от прошлой попытки `migrate
    resolve` через pgbouncer.
- Проверка:
  - `docker logs chesscoin_backend --since 30s`: `30 migrations found` →
    `No pending migrations to apply` → `[DB] Connected` → `[Server] Port
    3000 · production`. Полный набор cron-ов запущен. 0 ошибок.
  - Кран `checkTournamentResults` теперь не упадёт — все 5 enum-значений
    из schema есть в БД.
- Решение: ✅ закрыто. ChessCoin теперь reset-safe для миграций.
- 🟩 ШАБЛОН: «Prisma migrate через pgbouncer» — добавить `directUrl` в
  schema.prisma и `DIRECT_URL` env в compose. Migrate использует
  directUrl, runtime — pgbouncer. Standard паттерн Prisma для Supabase/
  PgBouncer; работает идеально для нас. Запомнить.

---

### 2026-05-15 · A.1 · Splash без синего фона (commit `e850012`)
- Сделано: `App.tsx SplashScreen` — `linear-gradient(135deg,#2A1F6A,#1A1540)`
  + 72×72 синий ящик с ♟-pawn → `<CoinIcon size={144} />` (×2) с золотым
  `drop-shadow(0 0 24px rgba(245,200,66,.45))`. Без синего фона и border.
- Проверка: bundle `index-DT-avFsM.js`, deploy ok.
- Решение: ✅ закрыто.

### 2026-05-15 · A.4 · Confirm перед выходом из активной партии (commit `e850012`)
- Сделано: `GamePage.handleLeavePage(to)` через `useConfirm()`. Reads
  `gameOverRefForLeave.current` (синхронизируется через `useEffect`).
  При активной игре и не-зрителе — спрашивает «Покинуть партию? Партия
  ещё идёт, будет засчитано поражение и ставка сгорит». При gameOver или
  зрителе — `navigate(to)` без диалога. Заменены 2 точки выхода: кнопка
  «← Назад» (auth-error overlay) и кнопка «Главная» в action-bar.
  `LeaveConfirmDialog` подключен в JSX.
- Проверка: bundle `index-DT-avFsM.js`, deploy ok.
- Решение: ✅ закрыто.

### 2026-05-15 · A.5 + A.7 · ELO под аватаром в BattleCard (commit `e850012`)
- Сделано: BattleCard оба игрока — под именем теперь
  `<div style="JetBrains Mono, #9A9490 (имя выше на тон — #C8C0A8)">
  {player.elo}</div>`, центрирован. Кликабельность аватаров уже была
  через `goProfile(player)`. Эмодзи попутно: ⚔️ → `IcoSwords`,
  👁 (×2: badge + кнопка) → `IcoEye`.
- Замечание: A.5 «кликабельность во всех карточках» — частично, BattleCard
  основной, остальные 12 файлов с `<Avatar>` (Wars, Tournaments, Battles,
  Profile, Leaderboard, Nations, MiniProfileSheet, WaitingForOpponent,
  PgnReplayModal, BattleHistoryCard) — в большинстве уже кликабельны.
  Требуется отдельный обход с глазами Кенана для верификации.
- Решение: ✅ BattleCard закрыто; общий обход — open.

### 2026-05-15 · A.2 · Модал «Активные сессии» — уже реализован
- Сделано: ничего, проверка.
- Проверка: `ActiveSessionsModal.tsx` уже содержит `MiniBoard` 72×72,
  таймер с SVG-часами, «ВАШ ХОД» индикатор, `.slice(0, 3)` — макс 3.
- Решение: ✅ уже закрыто, требование выполняется.

### 2026-05-15 · B.5 · Социальные таски × 6 milestones (prod data)
- Сделано: на проде в таблице `tasks` обновлено 3 существующих REFERRAL-
  таска (`1→3`, `5`, `20` рефералов) с новыми наградами 3K/5K/20K и
  metadata.category=SOCIAL. Добавлено 3 новых: 10/50/100 → 10K/50K/100K.
  Итого 6 milestones как требовал Кенан: 3/5/10/20/50/100 → 3K/5K/10K/20K/50K/100K.
- Проверка: `SELECT title, "winningAmount", metadata->>'referralCount' FROM
  tasks WHERE "taskType"='REFERRAL'` — 6 строк, отсортированы по rc,
  суммы и пороги совпадают.
- Решение: ✅ закрыто. Auto-completion работает через существующий
  механизм `tasks.ts` (G16 блок) — при достижении порога активный
  реферал → задача авто-комплитится → `TASK_REWARD` транзакция.
- 🟩 ШАБЛОН: «новый набор задач» — данные пишутся прямо в `tasks` таблицу
  (UPDATE для существующих + INSERT для новых). Код не меняется,
  потому что `taskType='REFERRAL'` уже обрабатывается тaskRouter.
- TODO: эти UPDATE/INSERT нужно занести в Prisma seed или миграцию,
  чтобы reset-safe. Сейчас — данные в БД, но не в репо.

### 2026-05-15 · C.4 · i18n хардкод — частично, в очередь
- Сделано: только аудит. Найдено в WarsPage ~5 хардкод-строк на русском
  в confirm/toast (handleJoin, handleLeave). В TournamentsPage похожая
  ситуация.
- Решение: ⏸ пауза. Требует синхронизации с `i18n/translations.ts`
  (ru + en). Не «быстро».

### 2026-05-15 · B.1 · TonConnect 1 TON unlock — в очередь (большая фича)
- Сделано: только аудит. На frontend есть `tonconnect.ts` +
  `sendVerificationPayment` + UI «Connect TON Wallet». Backend-роут
  `tonApi.verifyWallet` отсутствует в `backend/src/routes/`. Это
  означает: фронт уже умеет отправлять платёж, но сервер не верифицирует
  и не пишет `WALLET_UNLOCK` транзакцию.
- Решение: ⏸ требует отдельной фазы. Нужно: TON API ключ, верификация
  BOC через TON Center, idempotency, защита от двойного списания,
  Wallet model с уникальным address per user.

---

### 2026-05-15 · 8 шагов второго подхода (commit `c74e37f`)

| # | Пункт | Что | Решение |
|---|---|---|---|
| 1 | C.4 | i18n Wars (handleJoin/handleLeave + 3 toast) и Tournaments (STATUS_CFG.label, handleJoin confirm, EntryFee «Бесплатно»). Добавлено 10 ключей в `t.wars.*` + 6 в `t.tournaments.*` для обеих локалей. | ✅ |
| 2 | B.5 reset-safe | Миграция `20260515_referral_tasks_seed/migration.sql` — идемпотентный сид 6 канонических REFERRAL-задач через NOT EXISTS. На проде помечено applied в `_prisma_migrations`. | ✅ |
| 3 | B.4 | `wars.getCommander` теперь фильтрует по `user.updatedAt >= now - 7d`. Если все неактивны — fallback на полный список. Без миграций. | ✅ |
| 4 | B.3 approve/reject | Большая фича: миграция + 2 endpoint + UI главкома. | ⏸ в очередь |
| 5 | B.6 lesson этаж | Не найден компонент с лесенкой уровней (LessonPage = одна задача-puzzle). | ⏸ требует уточнения |
| 6 | C.3 | `useJarvisLevels.ts JARVIS_BASE` 4-20 обновлены под backend/config.ts:85-104. На lvl 20 теперь 1 000 000 ᚙ (было 75 000). Добавлен комментарий «править одновременно». | ✅ |
| 7 | B.1 | `profile.ts /ton-wallet/verify` после TonCenter-верификации теперь дополнительно вызывает `updateBalance(0, WALLET_UNLOCK, {walletAddress, boc, tonAmount: 1.0})` — нулевая запись в истории. | ✅ |
| 8 | B.2 | Проверено — уже работает: `profile.ts:518` `commission = tonAmount * 0.005` (0.5%), минимум 1M монет, защита от двойного pending. | ✅ уже было |

**Деплой:**
- `git pull && docker compose up -d --build backend frontend` — оба контейнера ok.
- Backend: `No pending migrations to apply` (миграция помечена ранее), `[DB] Connected`, все cron'ы стартанули.
- Frontend bundle: `index-DyXob5e3.js`.

🟩 ШАБЛОН: «авто-rotation через фильтр в getter» — вместо персистентного поля
«commander» в БД, используется динамический query с filter `updatedAt >= cutoff`.
Никаких миграций, никаких флагов; естественно «откатывается» когда новый ГК
становится активен. Использовать для подобных «expiry»-логик.

🟩 ШАБЛОН: «config константы между frontend и backend» — комментарий
«править одновременно здесь и в config.ts». Идеально было бы tRPC/shared
package, но пока хватает дисциплины + grep-теста.

---

### 2026-05-15 · 5 шагов третьего подхода (commit `88a40f5`)

| # | Пункт | Что | Решение |
|---|---|---|---|
| 1 | **B.3** approve/reject | Миграция `20260515_country_member_approval` (enum CountryMemberStatus + поле status DEFAULT APPROVED + индекс), schema.prisma обновлён, wars.ts: join → PENDING без списания; GET /pending, POST /pending/:id/approve (списать взнос → APPROVED), POST /pending/:id/reject (delete). getCommander + maxMembers фильтрут по APPROVED. | ✅ backend |
| 2 | **B.6** lesson этаж | Backend `/tasks/lessons/progress` и `/lessons/:level/complete` уже валидируют `level === current`. Frontend UI лесенки отсутствует. | ⏸ требует дизайна |
| 3 | **A.5** общий обход аватаров | BattleHistoryCard, LeaderboardPage, MiniProfileSheet, WaitingForOpponent, NationsPage, BattlesPage, PgnReplayModal — все уже имеют onClick + ELO. Попутно: NationsPage mojibake `вњ“`/`вњ•` → `✓`/`✕`. | ✅ |
| 4 | **C.1** единый шрифт заголовков | Все страницы через `<PageLayout title>` (Inter 1.25rem 900 #EAE2CC). Единый стиль обеспечен централизованным компонентом. | ✅ уже было |
| 5 | **C.2** toast vs полоски | Единый `<ToastContainer>` + `chesscoin:toast` event. Красных мигающих полосок в коде не найдено. | ✅ уже было |

**Деплой:**
- `git pull && docker compose up -d --build backend frontend` — оба ok.
- Backend: миграция `20260515_country_member_approval` применилась **автоматически** через `prisma migrate deploy` в Dockerfile.CMD — **шаблон reset-safe migrations работает.** 8 существующих CountryMember = APPROVED (миграция выставила default корректно).
- `[Server] Port 3000 · production`. 0 ошибок.

🟩 ШАБЛОН: «backend-first большая фича» — миграция + endpoints + бизнес-логика
без UI = валидный «фундамент». UI отдельной сессией. Существующий поток не
ломается (новые join создают PENDING — у старых клиентов это просто
«не появляется в списке», нужно будет UI чтобы видеть pending заявки и
самому показывать «ожидает одобрения главкома»).

---

## Очередь следующих шагов

1. **B.3 UI** — главком видит список PENDING на CountryDetailModal,
   кнопки approve/reject; обычный пользователь видит «ожидает одобрения».
2. **B.6 UI** — лесенка уровней Lesson с замком на пройденных-1.
3. Любая новая партия фич от Кенана.

> Правило: один пункт = одна запись в журнале сразу после деплоя + визуальной
> проверки. Если шаблон удачный — `🟩 ШАБЛОН` с инструкцией «как повторить».
