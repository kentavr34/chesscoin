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

## Очередь следующих шагов (по § 2 MASTER_PLAN)

1. **§ 2 A.6 хвосты** — GameSetupModal, ShopItemCards, ShopPage,
   GameResultModal, EventEffects, VictoryScreen, FloatingCoins,
   BadgeDetailModal — декоративные эмодзи → SVG/удалить.
3. **§ 2 A.3 проверка** — `showLeaveConfirm` в WarsPage (выход из страны) —
   ещё bottom-sheet или уже centered?
4. **§ 2 C.4** — i18n WarsPage / TournamentsPage: убрать русский хардкод,
   там где должен быть `t.wars.*` / `t.tournaments.*`.
5. **reset-safe TransactionType** — оформить идемпотентную Prisma-миграцию
   `<date>_transaction_type_sync` с `ALTER TYPE ADD VALUE IF NOT EXISTS` × 5,
   чтобы hard-reboot prod не восстановил неполный enum.

> Правило: один пункт = одна запись в журнале сразу после деплоя + визуальной
> проверки. Если шаблон удачный — `🟩 ШАБЛОН` с инструкцией «как повторить».
