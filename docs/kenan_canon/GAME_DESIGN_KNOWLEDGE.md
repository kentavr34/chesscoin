# ChessCoin — Game Design Knowledge Base

> Снимок знаний о продукте, собранный из исходников рабочей копии
> `C:\Users\SAM\Desktop\chesscoin\` (версия v7.1.0). Все цифры — с прямыми
> ссылками на файлы. LightRAG-граф концепций по проекту знает, но **конкретных
> чисел почти не содержит** (см. раздел «Что не нашлось»).

---

## 0. Технологический контур

- Backend: Node.js + TypeScript + Express + Socket.io + Prisma + PostgreSQL + Redis (`README.md` стр. 38).
- Frontend: React + Vite + TypeScript + Zustand + react-chessboard.
- Bot: Python 3.11 + aiogram 3, бот `@chessgamecoin_bot`, 9 языков (`README.md` стр. 38, `bot/i18n.py`).
- Шахматный движок: Stockfish NNUE 16 single-threaded WASM в Node Worker (`backend/src/services/game/stockfishWorker.ts:119`).
- TON: TonConnect 2.0, верификация через TonCenter API (`README.md` стр. 43).
- S3: Timeweb (аватары, скины), идёт миграция на собственный MinIO (CLAUDE.md).
- Хост: один eVPS `185.203.116.131`, путь `/opt/chesscoin`. Старый `37.77.106.28` удалён.

---

## 1. Игра — режимы

Источник enum: `backend/prisma/schema.prisma:856-860`.

**Типы сессии (`SessionType`)** — три:
- `BATTLE` — 1 vs 1 за ставку (`bet` в схеме).
- `BOT` — против JARVIS (Stockfish).
- `FRIENDLY` — дружеская партия по коду, без ставок.

**Состояния (`SessionStatus`):** `WAITING_FOR_OPPONENT`, `IN_PROGRESS`, `FINISHED`, `TIME_EXPIRED`, `DRAW`, `CANCELLED`.

**Лимит одновременных сессий:** 3 (`backend/src/config.ts:119` → `MAX_ACTIVE_SESSIONS=3`), из них с ботом — 1 (`MAX_BOT_SESSIONS=1`).

**Приватность:** `Session.isPrivate` — публичные/приватные батлы. Публичные открыты зрителям через socket-room `spectate:<sessionId>` (`wars.ts:439`). У сессии хранятся `boardSkinUrl` / `pieceSkinUrl` создателя — оба игрока видят его скины.

**Отдельных «ranked / unranked» сущностей в схеме нет.** ELO растёт независимо от ставок; единственная градация партий — `SessionType`. ❓ нужно уточнить у Кенана: должно ли быть формальное разделение ranked/unranked.

### War-режим (войны стран)

См. раздел 5.

---

## 2. Прогрессия игрока

### ELO и лиги

- Стартовый ELO: 1000 (`schema.prisma:67`).
- Формула обновления: упрощённая Эло, K=32 (`finish.ts:447` — комментарий `Обновление ELO (упрощённая формула К=32)`).
- Лиги (`enum League` + `config.ts:107-114`) — **по балансу, не по ELO!**:
  - `BRONZE` — 0 ᚙ
  - `SILVER` — от 100 000 ᚙ
  - `GOLD` — от 1 000 000 ᚙ
  - `DIAMOND` — от 5 000 000 ᚙ
  - `CHAMPION` — от 10 000 000 ᚙ
  - `STAR` — от 50 000 000 ᚙ

Лига пересчитывается при каждом `updateBalance()` (`economy.ts:79`).

### Военные звания (по числу активированных рефералов)

`backend/src/utils/militaryRank.ts:14-32` — 18 рангов от Новобранца до Императора:

| ранг | minMembers | label |
|---|---|---|
| RECRUIT | 0 | Новобранец 🙂 |
| PRIVATE | 10 | Рядовой 🪖 |
| CORPORAL | 50 | Ефрейтор |
| SERGEANT | 100 | Сержант |
| WARRANT | 500 | Прапорщик |
| JR_LIEUTENANT | 1 000 | Мл. Лейтенант |
| LIEUTENANT | 3 000 | Лейтенант |
| SR_LIEUTENANT | 5 000 | Ст. Лейтенант |
| CAPTAIN | 10 000 | Капитан |
| MAJOR | 20 000 | Майор |
| LT_COLONEL | 40 000 | Подполковник |
| COLONEL | 60 000 | Полковник |
| BRIGADIER | 80 000 | Бригадир |
| MAJ_GENERAL | 100 000 | Генерал-майор |
| LT_GENERAL | 200 000 | Генерал-лейтенант |
| COL_GENERAL | 300 000 | Генерал-полковник |
| MARSHAL | 500 000 | Маршал |
| EMPEROR | 1 000 000 | Император 👑 |

### Попытки (attempts)

`backend/src/services/attempts.ts` + `config.ts:62-68`:

- Стартовый запас: **3** (`maxAttempts=3`).
- Восстановление: **+1 каждые 8 часов** глобальным cron-ом в 00:00 / 08:00 / 16:00 UTC (`attempts.ts:95`). Не привязан к личному времени игрока — единая волна для всех.
- Покупка: **1 000 ᚙ за попытку** (`ATTEMPT_PRICE=1000n`). Только до максимума 3 (`maxPurchasedAttempts=0` — сверх лимита купить нельзя).
- Списание: 1 попытка при старте партии (`useAttempt`).

### JARVIS — 20 уровней

Серверная сила (`backend/src/services/game/stockfishWorker.ts:44-79`) и клиентская витрина (`frontend/src/components/ui/JarvisModal.tsx:15-36`).

| ур. | имя (бейдж) | ELO движка | reward (ᚙ) | depth | randomPct |
|---|---|---|---|---|---|
| 1 | Beginner | 800 | 1 000 | 1 | 70% |
| 2 | Rookie | 900 | 2 000 | 2 | 55% |
| 3 | Player | 1100 | 3 000 | 3 | 40% |
| 4 | Challenger | 1300 | 5 000 | 5 | 25% |
| 5 | Fighter | 1500 | 7 000 | 7 | 15% |
| 6 | Guardian | 1700 | 10 000 | 9 | 8% |
| 7 | Warrior | 1800 | 15 000 | 10 | 5% |
| 8 | Knight | 1950 | 20 000 | 11 | 3% |
| 9 | Expert | 2100 | 30 000 | 12 | 2% |
| 10 | Tactician | 2200 | 40 000 | 13 | 1% |
| 11 | Master | 2300 | 55 000 | 14 | 0% |
| 12 | Grandmaster | 2400 | 75 000 | 15 | 0% |
| 13 | Professional | 2500 | 100 000 | 16 | 0% |
| 14 | Champion | 2600 | 130 000 | 18 | 0% |
| 15 | Elite | 2700 | 170 000 | 20 | 0% |
| 16 | Epic | 2800 | 220 000 | 16 | 0% |
| 17 | Legendary | 2900 | 300 000 | 17 | 0% |
| 18 | Immortal | 3000 | 400 000 | 18 | 0% |
| 19 | Divine | 3100 | 600 000 | 19 | 0% |
| 20 | Mystic (Magnus) | 3200 | 1 000 000 | 20 | 0% |

Имена бейджей зашиты в `finish.ts:282-287`. Цифры reward в JarvisModal.tsx **отличаются от серверных** (frontend показывает 1000-75000, бэк платит 1000-1000000) — фронт устаревший. **Истинные награды — `backend/src/config.ts:84-105` (`BOT_REWARD_*`).**

Правила прогрессии:
- Игрок может играть только до уровня `jarvisLevel + 1` (`session.ts:88-89`).
- При победе на новом уровне `jarvisLevel` инкрементится до `min(20, lvl+1)` (`finish.ts:300`).
- Бейдж `JARVIS_NAMES[lvl]` пушится в `User.jarvisBadges`, дата — в `User.jarvisBadgeDates`.
- Достижение `jarvis_hunter` (5000 ᚙ) — за победу на уровне 20 (`achievements.ts:23,98-99`).

### Login streak

`User.loginStreak`, `User.lastLoginDate` (`schema.prisma:111-112`). ❓ Логика начисления — не нашёл в просканированных файлах.

### Чемпион месяца

Поля `isMonthlyChampion`, `monthlyChampionAt`, `monthlyChampionType` (`ELO | BALANCE | REFERRALS`) (`schema.prisma:118-120`). ❓ cron-логика выбора — не нашёл (вероятно в `services/crons.ts`).

---

## 3. Экономика монет ᚙ

### Эмиссия и фазы

`PlatformConfig` (`schema.prisma:14-36`) + `economy.ts`:

- `hardCap = 100 000 000 000` (100 млрд) — абсолютный лимит.
- `emissionCap = 30 000 000 000` (30 млрд) — порог отключения раздачи.
- `platformReserve` стартует с hard-cap, уменьшается при эмиссии, увеличивается на сумму комиссии батлов (`finish.ts:395-398`).
- Фазы:
  - **Phase 1** — airdrop, эмиссия активна (welcome, bot reward, referral activation bonus).
  - **Phase 2** — рост, авто-переход когда `totalEmitted >= emissionCap` (`economy.ts:20`). Эмиссия выключается, но bot-выплаты идут уже из резерва.
  - **Phase 3** — крипто (TON, P2P).
- `tokenPriceUsd` — текущая цена в USD, default `0.001`.

### Welcome bonus

5 000 ᚙ новому игроку (`config.ts:62`, `economy.ts:122-131`).

### Бот: награда за фигуры (Phase 1)

`config.ts:75-82`:
- Пешка `p` — 100 ᚙ
- Конь `n` — 300 ᚙ
- Слон `b` — 300 ᚙ
- Ладья `r` — 500 ᚙ
- Ферзь `q` — 900 ᚙ
- Король `k` — 1 000 ᚙ (триггер мата)

### Батлы — комиссия

`config.ts:73`: `BATTLE_COMMISSION_PERCENT = 10` (10%).

Логика выплат `finish.ts:338-398`:
- `totalPot = bet * 2`
- `commission = totalPot * 10 / 100`
- `winnerPayout = totalPot - commission`
- При **ничьей** — каждый получает свою ставку обратно, **без комиссии** (`finish.ts:343-354`).
- При победе комиссия идёт в `platformConfig.platformReserve` (увеличивает резерв).
- Поверх выигрыша добавляется `donationPool` зрителей (`finish.ts:376-384`).

### Транзакции

`enum TransactionType` (`schema.prisma:871-908`) — 30+ типов: WELCOME_BONUS, BOT_WIN, BOT_PIECE, BATTLE_WIN, BATTLE_BET, BATTLE_COMMISSION, REFERRAL_BONUS, REFERRAL_INCOME, SUB_REFERRAL_INCOME, ATTEMPT_PURCHASE, ITEM_PURCHASE, CLAN_CONTRIBUTION, TOURNAMENT_ENTRY, TOURNAMENT_WIN, COUNTRY_WAR_WIN, BATTLE_DONATION, EXCHANGE_BUY/SELL/FREEZE/UNFREEZE/FEE, TON_DEPOSIT, WALLET_UNLOCK, PUZZLE_REWARD и др.

---

## 4. Задания (Tasks)

`enum TaskType` (`schema.prisma:910-922`):

**Социальные:**
- `REFERRAL` — пригласить N друзей.
- `ENTER_CODE`, `FOLLOW_LINK`, `SUBSCRIBE_TELEGRAM`.

**Геймплейные (автоматические из `finish.ts`, BUG #1 fix):**
- `DAILY_LOGIN` — войти в игру (сбрасывается ежедневно).
- `FIRST_GAME` — сыграть первую партию.
- `WIN_N` — N побед в батлах.
- `WIN_BOT_N` — N побед над ботом.
- `WIN_STREAK_N` — N побед подряд.
- `PLAY_N` — сыграть N партий любых.

`Task.winningAmount` (BigInt) — награда индивидуально на каждый таск (выставляется в админке/seed). ❓ конкретных стандартных размеров наград в коде не зашито.

Уникальность выполнения — `CompletedTask @@unique([userId, taskId])`.

---

## 5. Кланы / Страны / Войны

В схеме **два параллельных понятия**:

### Clans (старый Stage-3 механизм, `schema.prisma:352-441`)

- 30 предзаполненных стран в seed (`seed.ts:34-65`): RU, BR, DE, IN, US, CN, FR, ES, AR, JP, KR, UA, KZ, BY, PL, TR, IT, GB, CA, AU, MX, ID, NG, EG, IR, UZ, AZ, GE, AM, PH.
- `maxMembers = 100` на клан.
- Роли (`ClanRole`): `SOLDIER | OFFICER | COMMANDER`.
- ClanWar — серия из 5 раундов (`totalRounds=5`), `betPerPlayer`, `prize`, `duration` (default 86 400 сек = 24ч).
- ClanBattle — командный челлендж: пул взносов, `maxSimultaneous=10` партий одновременно (`schema.prisma:583`), длительность 3600..2 592 000 сек.

### Countries / War (актуальная Wars-фича, `schema.prisma:447-546`, `routes/wars.ts`)

- `maxMembers = 1000` на страну (`schema.prisma:458`).
- Один игрок = одна страна (`CountryMember.userId @unique`).
- **Главнокомандующий** — определяется автоматически: топ по `warWins`, при равенстве — кто раньше вступил (`wars.ts:33-37`). **Авто-смена происходит сразу** при изменении `warWins`. ❓ «авто-смена через N дней неактивности» в коде не нашёл — есть только сортировка по `warWins desc, joinedAt asc`. Уточнить у Кенана.
- При активной войне страну покинуть нельзя (`wars.ts:266`), сменить страну тоже нельзя (`wars.ts:233`).
- **Объявить войну может только Главнокомандующий** (`wars.ts:467`).
- Нельзя войну на самих себя; нельзя если кто-то из сторон уже в войне.
- `prizePerWin = 100n` ᚙ — фиксированно зашито в `wars.ts:507` (хотя в схеме default тоже 100). Идёт в казну страны за каждую победу её бойца.
- `duration` — секунды; в схеме комментарий «3600 / 43200 / 86400 / 604800 / 2592000» (`schema.prisma:503`) → 1ч / 12ч / 1д / 7д / 30д.
- **Лимит одновременных боевых сессий внутри войны: 10** (`wars.ts:641-646` — именно это «10 live battles»).
- Авто-матчмейкинг запускается через 5с после объявления войны (`scheduleWarMatches`, `wars.ts:586`).
- Уведомления: командиру защитника + всем бойцам обеих стран (через Socket.IO + бот `AdminNotification`).
- Донат в казну страны (`wars.ts:732`) — любой её член может пополнить, средства идут в `Country.treasury`.

### Что НЕ нашлось в коде про кланы

- **Donation Logic при join/leave** — LightRAG говорит «pending task», в коде только simple-check «нельзя выйти во время войны». ❓
- **«Штрафы за выход / неактивность»** — в коде не найдено. ❓
- **Approve/Reject новых членов командиром** — LightRAG говорит «pending», в `wars.ts` join открытый (любой может вступить если есть место). ❓
- **«Авто-смена командующего за N дней»** — в коде нет, авто-смена идёт по `warWins`. ❓ уточнить.

---

## 6. Турниры

`backend/src/routes/tournaments.ts` + `schema.prisma:668-737`.

Системные турниры создаются cron-ом (`ensureSystemTournaments`, строка 63):

| Тип | Лейбл | EntryFee (ᚙ) | maxPlayers | Период | EndAt |
|---|---|---|---|---|---|
| WORLD | Чемпион Мира | 50 000 | 10 000 | `2026` | +1 год |
| COUNTRY | Чемпион Страны | 25 000 | 10 000 | `2026-04` | начало след. месяца |
| SEASONAL | Чемпион Сезона | 10 000 | 10 000 | `2026-Q2` | начало след. квартала |
| MONTHLY | Чемпион Месяца | 3 000 | 10 000 | `2026-04` | начало след. месяца |
| WEEKLY | Чемпион Недели | 1 000 | 10 000 | `2026-W17` | +7 дней |

(Цифры из `tournaments.ts:37-43,82-91`. Дефолт `Tournament.maxPlayers` в схеме = 256, но system-турниры переопределяют до 10 000.)

**COUNTRY-турнир** требует членства в стране (комментарий T8).

### Распределение призов (`tournaments.ts:380-408`)

- `totalPool = prizePool + donationPool`.
- **WORLD / COUNTRY:** 1-е — 60%, 2-е — 30%, 3-е — 10%.
- **SEASONAL:** 1-е — 30% от пула, остальное остаётся в пуле/резерве.
- **MONTHLY:** 1-е — 20%.
- **WEEKLY:** 1-е — 10%.

Топ-3 получают `tournamentBadges` в профиле (`tournaments.ts:432-456`). Уведомление через `AdminNotification` + socket.

### Зрительский донат

POST `/tournaments/:id/donate` — увеличивает `donationPool` (`tournaments.ts:287`).

### Активные матчи игрока

GET `/tournaments/my-matches` — `IN_PROGRESS` матчи (`tournaments.ts:99`).

❓ Структура bracket (single-elim / round-robin) — формально сохраняется в `TournamentMatch` с полем `round`, но в коде ясной матчмейкинг-логики я не успел найти. Уточнить.

---

## 7. Рефералы

`backend/src/services/referral.ts` (важный комментарий в шапке файла).

- **2 уровня**, без рекурсии. Хранится прямо в `User.referrerId`.
- Ссылка реферала из бота: `?start=ref_<telegramId>` (классика); матч-ссылка `?start=match_<sessionId>` или `refmatch_*` ❓ — в файлах не подтвердил, упомянуто только в задании. Уточнить у Кенана.
- **Реферальный бонус активации (one-time):** только после первой завершённой партии нового игрока (`activateReferral`, `referral.ts:34`). Размер бонуса = от ранга пригласившего:

| ранг | activationBonus (ᚙ) | l1Percent от выигрышей |
|---|---|---|
| RECRUIT / PRIVATE | 3 000 | 1% |
| CORPORAL | 4 000 | 2% |
| SERGEANT | 5 000 | 3% |
| WARRANT | 6 000 | 4% |
| JR_LIEUTENANT | 7 000 | 5% |
| LIEUTENANT / SR_LIEUTENANT | 8 000–9 000 | 5% |
| CAPTAIN | 10 000 | 6% |
| MAJOR | 12 000 | 7% |
| LT_COLONEL | 13 000 | 8% |
| COLONEL | 14 000 | 9% |
| BRIGADIER | 15 000 | 10% |
| MAJ_GENERAL | 20 000 | 11% |
| LT_GENERAL | 25 000 | 12% |
| COL_GENERAL | 30 000 | 13% |
| MARSHAL | 35 000 | 14% |
| EMPEROR | 40 000 | 15% |

(Источник: `militaryRank.ts:37-56`.)

- **L2 (суб-реферал):** фиксированные **10%** от выигрыша (`config.ts:71` → `SUB_REFERRER_INCOME_PERCENT=10`, `referral.ts:152`).
- **L1 % зависит от ранга** реферера в момент выигрыша (от 1% до 15%).
- Activation bonus выплачивается только в Phase 1 (`isEmission: true`).
- Реферальный % с выигрышей — fire-and-forget через `setImmediate`, чтобы не блокировать завершение игры.
- **Стартовый дефолт:** `REFERRER_INCOME_PERCENT=50` в `config.ts:70` — НЕ используется в новом коде (заменено на `getRankBonuses`). Это легаси-env. ❓

---

## 8. TON / Биржа / P2P

`backend/src/routes/exchange.ts` + `schema.prisma:790-825` (P2POrder).

### P2P — цены, лимиты

`exchange.ts:21-25`:
- `PLATFORM_FEE_PERCENT = 0.005` → **0.5% комиссия платформы в TON**.
- `MIN_ORDER_COINS = 10 000 ᚙ`
- `MAX_ORDER_COINS = 100 000 000 ᚙ`
- `MIN_PRICE_TON = 0.00001` за 1 000 000 ᚙ.
- `MAX_PRICE_TON = 100 000`.
- **Максимум 5 открытых SELL-ордеров** на игрока (`exchange.ts:127`).

### Flow (sell-сторона)

1. Продавец создаёт ордер → `EXCHANGE_FREEZE` списывает ᚙ с баланса в резерв ордера.
2. Покупатель отправляет TON через TonConnect, шлёт `txHash` + `txBoc`.
3. Бэкенд верифицирует через `tonverify.ts` (TonCenter API).
4. ᚙ переходят покупателю.
5. Комиссия 0.5% TON капается на `PLATFORM_TON_WALLET`.
6. Если ордер отменён — `EXCHANGE_UNFREEZE` возвращает ᚙ.

BUY-ордера тоже поддерживаются (`P2POrder.orderType = BUY | SELL`), `EXCHANGE_BUY_FREEZE` блокирует TON-резерв.

### TonTransaction (магазинные покупки)

`schema.prisma:770-785`: типы `DEPOSIT | WITHDRAWAL | PURCHASE`.

### WithdrawalRequest

`schema.prisma:748-765`. **Заблокировано в v6** (комментарий «v6 — заблокировано»). Поля: `amountCoins`, `tonWalletAddress`, `tonCommission`, статусы `PENDING | PROCESSING | COMPLETED | FAILED`. ❓ конкретный % комиссии вывода — не зашит, поле `tonCommission` устанавливается на лету (вероятно вручную админом).

### TradeOrder (магазинная биржа TON↔ᚙ)

`schema.prisma:1056-1095`: `BUY | SELL` × `TON | STARS`. `price` — за 1000 монет. ❓ комиссия и точная логика — не успел проверить.

### Курс ᚙ

`PlatformConfig.tokenPriceUsd = 0.001` USD по умолчанию. Цена ордеров на бирже плавающая (priceTon в каждом ордере).

---

## 9. Магазин — товары и цены

`backend/prisma/seed.ts` (full source). Категории:

### Avatar Frames (рамки)

| name | rarity | price (ᚙ) |
|---|---|---|
| Golden Frame | RARE | 50 000 |
| Silver Frame | COMMON | 20 000 |
| Platinum Frame | RARE | 100 000 |
| Diamond Frame | EPIC | 200 000 |
| Fire Frame | EPIC | 200 000 |
| Neon Frame | EPIC | 250 000 |
| Crystal Frame | EPIC | 300 000 |
| Commander Frame | EPIC | 400 000 |
| Legendary Frame ♟ | LEGENDARY | 1 000 000 |
| Champion Frame | LEGENDARY | 2 000 000 |

### Board Skins (10)

Classic 10k → Dark Wood 25k → Marble 75k → Malachite 100k → Gold 150k → Ice 200k → Night 200k → Neon 300k → Desert 350k → Cyber 750k.

### Piece Skins (10)

Standard 5k → Silver 30k → Bronze 40k → Golden 150k → Shadow 200k → Neon 300k → Pixel 400k → Anime 450k → Crystal 500k → Legend Gold 1 500 000.

### Move Animations (10)

Lightning 30k → Stars 40k → Fire 120k → Ice 120k → Explosion 150k → Smoke 200k → Rainbow 250k → Matrix 300k → Portal 500k → Thunder 750k.

### Piece Sets (7)

ChessCoin Original 0 / Emoji Fun 5k / Flat Minimal 15k / Lichess Classic 25k / Glossy 3D 100k / Neon Glow 250k / Crystal Glass 750k.

### Fonts (5, тип FONT)

Inter 0 / Roboto 5k / Montserrat 15k / Playfair Display 25k / Comic Sans MS 100k (SEASONAL).

### Категории `ItemCategory`

`BASIC | PREMIUM | NFT | SEASONAL`.

### Редкости `ItemRarity`

`COMMON | RARE | EPIC | LEGENDARY`.

### Типы `ItemType`

AVATAR_FRAME, BOARD_SKIN, PIECE_SKIN, MOVE_ANIMATION, THEME, PIECE_SET, PREMIUM_AVATAR, WIN_ANIMATION, CAPTURE_EFFECT, SPECIAL_MOVE, FONT.

NFT (`isNft=true`, `nftTokenId`, `totalSupply`, `mintedCount`) — заготовка под v6+, фактических NFT-айтемов в seed нет. ❓

---

## 10. Шахматные «вкусности»

В игре каждая партия может рендериться со скинами создателя (`Session.boardSkinUrl`, `Session.pieceSkinUrl` — `schema.prisma:193-194`). Игроки видят оба скина у обоих.

- **Доска по умолчанию**: Premium Oak (`#DEB887` / `#8B4513`) — из `MEMORY.md`.
- **Тема**: `User.activeTheme` default `"default"` (`schema.prisma:115`). Темы продаются как `ItemType.THEME`.
- **Анимация ходов** (`MOVE_ANIMATION`) — траектория за фигурой при ходе.
- **WIN_ANIMATION** — анимация мата (заготовка V3).
- **CAPTURE_EFFECT** — эффект при взятии фигуры (V3).
- **SPECIAL_MOVE** — анимация спецходов/дебютов (V3).

Эталоны UI: `.claude/archive/HOMEPAGE_TEMPLATE.tsx`, `.claude/archive/JARVIS_PLAY_MODAL_TEMPLATE.tsx` (упомянуты в MEMORY, **в текущей рабочей копии папки `.claude/archive/` нет** — только settings/scheduled_tasks/worktrees). ❓ возможно были потеряны.

---

## 11. Telegram-интеграция

- Бот `@chessgamecoin_bot`, токен в `/root/claudia/.env` на сервере.
- `/start` deep-links: `ref_<telegramId>` для рефералов, `match_<sessionId>` (упомянут в задании) ❓.
- 9 языков (`bot/i18n.py`).
- AdminNotification — таблица в БД, бот её опрашивает и шлёт пуши: типы `GAME_WIN`, `WAR_DECLARED`, `WAR_STARTED`, `TOURNAMENT_WIN`, `REFERRAL_ACTIVATED`, `DEAD_PLAYERS_CLEANED` и др.
- WebApp авторизация: Telegram `initData` + HMAC-SHA256 валидация, JWT (access 2h / refresh 7d) — `config.ts:38-42`.
- ADMIN_IDS — список Telegram ID администраторов (env, `README.md` стр. 175).

---

## 12. Админка

`backend/src/routes/admin.ts` (доступ — `User.isAdmin=true`):
- Создание/редактирование товаров магазина (с `priceCoins` в BigInt).
- Создание турниров (Zod-схема: `entryFee` строкой, `maxPlayers` 2..10000).
- Прочее ❓ — не успел читать весь файл, но точка входа есть.

Также: `screenshotter.ts`, `airdrop.ts` — отдельные админ-маршруты.

---

## 13. Уроки / задачки (Puzzles)

`schema.prisma:1022-1053`:
- Импортируются из Lichess (`Puzzle.id` = lichess PuzzleId).
- Поля: `fen` (стартовая), `moves` (UCI правильные ходы), `rating` 500-3000, `themes` (fork/pin/mateIn2…), `reward` (BigInt, рассчитан при импорте).
- `isDaily=true, dailyDate` — задача дня.
- `CompletedPuzzle` — уникальная пара `userId+puzzleId`, начисление `PUZZLE_REWARD`.

Источник наград: `prisma/seeds/puzzles.ts` функция `calcPuzzleReward` — не читал. ❓ формула.

---

## 14. Антифрод / античит

В коде явных античит-проверок не нашёл. Косвенные:
- `User.isBanned`, `User.isBot` — флаги.
- `AnalyticsCleanup` — архив удалённых «мёртвых» игроков (`schema.prisma:989-994`).
- Helmet, rate-limit, Zod на всех POST (`README.md` стр. 322-329).
- Race condition protection в P2P (`README.md` стр. 327): atomic transactions + Redis distributed lock.
- TON-верификация через TonCenter (`tonverify.ts`) — защищает от поддельных txHash.

Stockfish-античит / детекция движков на стороне игроков — **не нашёл**. ❓ не реализовано? Уточнить.

---

## 15. Бэкенд-маршруты — обзорно

Из `backend/src/routes/`:
- `admin.ts` — админ-панель.
- `airdrop.ts` — раздача монет в Phase 1.
- `attempts.ts` — состояние и покупка попыток.
- `auth.ts` — Telegram initData → JWT.
- `bot.ts` — внутренний bot↔backend API.
- `exchange.ts` — P2P биржа.
- `games.ts` — список активных партий, история.
- `leaderboard.ts` — рейтинги.
- `nations.ts` — страны (UI-обёртка). LightRAG называет «NationsPage» — это страница на фронте, маршрут `/nations`. На бэке логика — в `wars.ts` + `nations.ts`.
- `profile.ts` — профиль, история, бейджи.
- `puzzles.ts` — пазлы.
- `screenshotter.ts` — генерация шер-картинок.
- `shop.ts` — магазин.
- `tasks.ts` — задания.
- `tournaments.ts` — турниры.
- `wars.ts` — войны стран.

---

## ❓ Что не нашлось / нужно уточнить у Кенана

1. **Авто-смена Главнокомандующего за N дней неактивности** — в коде только сортировка по `warWins desc, joinedAt asc`, временная неактивность не учитывается. **Сколько дней?** Нужно реализовать.
2. **Approve/Reject командиром новых членов страны** — в `wars.ts` join открытый, любой вступает свободно. LightRAG помечает это «pending». Нужна ли реальная модерация?
3. **Donation-логика при join/leave страны** (штрафы, сборы) — отсутствует в коде.
4. **«Штрафы» (penalties) клана/страны** — нигде не нашёл.
5. **Точная % комиссии вывода TON** (`WithdrawalRequest.tonCommission`) — поле есть, дефолта нет.
6. **Структура bracket турниров** (single-elim? round-robin? Swiss?) — `TournamentMatch.round` есть, но логика наполнения матчей не найдена в просканированных файлах.
7. **Match-ссылка `match_<sessionId>` / `refmatch_*`** — в коде бэка прямого упоминания не нашёл. Это deep-link бота, нужно проверить `bot/handlers/start.py`.
8. **Античит / детекция Stockfish-помощи** — не реализован.
9. **Reward за puzzle** — формула в `prisma/seeds/puzzles.ts:calcPuzzleReward`, не читал.
10. **Login streak** — поля есть, логика начисления не найдена (вероятно в `services/crons.ts` или `auth.ts`).
11. **Чемпион месяца** — поля есть, cron-выбор не найден.
12. **Размеры наград стандартных тасков** (DAILY_LOGIN, FIRST_GAME, WIN_N…) — задаются индивидуально в Task.winningAmount при сидинге, конкретных дефолтов в коде не зашито.
13. **Расхождение reward в JarvisModal.tsx (фронт) vs config.ts (бэк)** — фронт показывает 1k-75k, бэк платит 1k-1М. **Кому верить?** Скорее всего фронт устаревший.
14. **Архивные эталоны** `.claude/archive/HOMEPAGE_TEMPLATE.tsx` и `JARVIS_PLAY_MODAL_TEMPLATE.tsx` — упомянуты в MEMORY.md как «неприкосновенные эталоны», но в рабочей копии папки `.claude/archive/` нет. Возможно потеряны.
15. **REFERRER_INCOME_PERCENT=50** в `config.ts:70` — выглядит как мёртвый legacy env (новая логика берёт % из ранга). Проверить можно ли удалять.

---

## Источники, по которым собирался документ

- `C:\Users\SAM\Desktop\chesscoin\backend\prisma\schema.prisma` (главный — все модели и enum'ы)
- `C:\Users\SAM\Desktop\chesscoin\backend\src\config.ts` (все цифры экономики)
- `C:\Users\SAM\Desktop\chesscoin\backend\src\services\economy.ts`
- `C:\Users\SAM\Desktop\chesscoin\backend\src\services\referral.ts`
- `C:\Users\SAM\Desktop\chesscoin\backend\src\services\attempts.ts`
- `C:\Users\SAM\Desktop\chesscoin\backend\src\services\game\stockfishWorker.ts`
- `C:\Users\SAM\Desktop\chesscoin\backend\src\services\game\finish.ts`
- `C:\Users\SAM\Desktop\chesscoin\backend\src\services\achievements.ts`
- `C:\Users\SAM\Desktop\chesscoin\backend\src\utils\militaryRank.ts`
- `C:\Users\SAM\Desktop\chesscoin\backend\src\routes\wars.ts`
- `C:\Users\SAM\Desktop\chesscoin\backend\src\routes\tournaments.ts`
- `C:\Users\SAM\Desktop\chesscoin\backend\src\routes\exchange.ts`
- `C:\Users\SAM\Desktop\chesscoin\backend\prisma\seed.ts` (магазин полностью)
- `C:\Users\SAM\AppData\Local\Temp\chesscoin-ui\frontend\src\components\ui\JarvisModal.tsx`
- `C:\Users\SAM\Desktop\chesscoin\README.md`
- `C:\Users\SAM\Desktop\chesscoin\CLAUDE.md`
- `C:\Users\SAM\.claude\projects\C--Users-SAM-Desktop-chesscoin\memory\MEMORY.md`
- LightRAG `185.203.116.131:9621` (9 hybrid-запросов; даёт высокоуровневые «pending tasks», конкретных цифр почти нет — вся правда в коде)
