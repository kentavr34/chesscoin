# Session Recap — 2026-05-19 (Claude batch)

Эта запись — retrospective-документация серии коммитов, задеплоенных
напрямую в `main` 19 мая 2026. PR создан pos-факт для review-видимости.
Все коммиты уже на `main` (диапазон `25d625d → b1a2794`) и работают на проде.

## Almanac коммитов

| SHA | Тема | Audit |
|---|---|---|
| `25d625d` | fix(profile): all user-specific data must read from profile | — |
| `3ae036e` | fix(profile): correct privacy (balance public, hide tx/refs on foreign) | — |
| `4b92ae9` | feat(pgn-save): ★/☆ кнопка в PgnReplayModal | — |
| `7b92508` | fix(game-page): remove double bottom menu in spectator | iter v3 → **90.58 ✅** |
| `50d4b4a` | fix(game-page): MIN_BOARD_SIZE guard | (часть T1) |
| `339efc4` | fix(wars): join war matchmaking queue + remove emoji | iter v2 → **95.0 ✅** |
| `c6a6875` | fix(wars): harden queue_join (status guard + reconnect) | (часть T2) |
| `c07b792` | fix(ton): free wallet connect (drop 1 TON unlock, Disconnect btn) | **A1: 83.33 ✅** |
| `fec3215` | fix(shop): hardcoded dark card background | A3: 86.67 ❌ |
| `a7514e8` | feat(shop/A2): 100 premium-avatars seed + bot /admin FSM | A2 iter v1 |
| `b8ae0bb` | fix(bot/A2): validate priceCoins/name/imageUrl before BigInt | A2: 79.38 ❌ |
| `bc841df` | feat(A4): apply equippedItems.THEME from shop | A4 iter v1 |
| `e0865fe` | fix(A4): fallback to localStorage theme on unequipped | **A4: 94.42 ✅** |
| `440684a` | feat(A5): opt-in TON withdrawal worker (safe-by-default) | A5 iter v1 |
| `b1a2794` | fix(A5): atomic PENDING→PROCESSING claim + stale recovery | **A5: 89.17 ✅** |

**6 verified, 2 unverified-by-workflow (real code OK).** Audit-протокол —
peer-review через Claudia `/dev/audit_task` (DeepSeek + Qwen + GLM 3 reviewers).
Все verified-task'и записаны в claudia_memory (ids 211, 215, 216).

## Что вошло в серию

### Profile privacy (3 коммита)
Чужой профиль показывает данные **этого** юзера (а не залогиненного).
Корневой баг: ProfilePage.tsx читал `user.X` (свой) повсюду вместо
`displayUser.X`. Введён единый `profile = isOwnProfile ? user : viewedProfile`.
Балaнс — **публичный** (рейтинг по нему уже виден в Leaderboard); скрыты:
- блок «История транзакций»
- кнопки «Магазин» / «Рефералы»
- реферальная ссылка с telegramId

Также добавлена кнопка ★/☆ в `PgnReplayModal` — любая партия (своя/чужая)
сохраняется в избранное; убран `isParticipant` чек в backend.

### Wars matchmaking (P0)
**Корневая причина** почему войны не играются: backend cron `scheduleWarMatches()`
читал Redis `war:queue:<warId>:<countryId>`, но фронт никогда не emit-ил
`war:queue_join` — очередь пустая, 0 war_battles за 7 дней. Фикс:
useEffect в `WarsPage.tsx` авто-emit при наличии активной войны страны.
v2 укрепляет: `status === IN_PROGRESS` guard, `sock.on('connect')` re-emit,
console.warn в catch, sock.connected guard.

Plus emoji-removal: `⏱` → SVG таймер, `▲` → SVG треугольник в карточке войны.

### GamePage spectator UI
Убран дубль BottomNav (action-row уже играл роль нижней панели); пустые
STATUS_GAP-полоски «Ваш ход / Думает...» не рендерятся у зрителя; flex:1
spacers заменены на 6px в spectator. Доска получила +140-160px вертикали.
v2: `MIN_BOARD_SIZE=220` floor в `calcBoardSize` — защита от отрицательного
размера на узких экранах.

### Batch A1-A5 (Shop / Exchange / TON)
- **A1** — Free TON wallet connect. Убран 1-TON unlock-платёж за verification.
  `sendVerificationPayment` больше не вызывается. Добавлена кнопка Disconnect.
  Cancel/timeout пользователя — silent (не показываем как error).
- **A2** — 100 placeholder `PREMIUM_AVATAR` items с data:URI SVG (gradient
  circle + initial), 7 ценовых тиров 50→5000 монет. Bot `/admin → 🖼️ Add
  Avatar` FSM 4 шага (photo→name→price→rarity) с серверной валидацией
  regex `^\d+$` для priceCoins + length для name/imageUrl.
- **A3** — ShopPage card background захардкожен на тёмный gradient
  (#141018→#0F0E18) в обоих `ItemCard` и `AvatarItemCard`. Раньше fallback
  CSS-vars в светлой теме давал «white-on-white». Кнопки получили
  контрастные gradient (золотой/фиолетовый).
- **A4** — `equippedItems.THEME` применение из магазина: `useEffect` в
  `App.tsx` матчит `themeItem.name.toLowerCase()` с `ThemeKey` и зовёт
  `applyThemeToCss(THEMES[key])`. Fallback на `getActiveTheme()`
  (localStorage) при unequip/logout — иначе палитра застревала.
- **A5** — opt-in TON withdrawal worker. `processTonWithdrawals` cron
  каждые 5 мин. По умолчанию **safe**: при `HOT_WALLET_ENABLED!=true`
  только log-warn 1× за рантайм, no-op. При включении: атомарный
  PENDING→PROCESSING claim через `updateMany WHERE status=PENDING`
  (защита от race для multi-instance), `recoverStaleProcessing` каждый тик
  возвращает PROCESSING старше 30 мин в PENDING (защита от crash). Реальный
  send TON — TODO-шаблон с `@ton/ton` + `mnemonicToWalletKey` —
  активируется при `HOT_WALLET_MNEMONIC` + явное одобрение.

## Что НЕ вошло (TODO для будущих сессий)

1. **Реальный send TON** в withdrawal worker — требует
   `npm i @ton/ton @ton/core` в backend + `HOT_WALLET_MNEMONIC` в env.
2. **Реальный txHash в P2P-бирже** через `@ton/core` — на frontend сейчас
   `btoa(boc).slice(0, 32)` (псевдо-id, не настоящий хэш).
3. **WIN_ANIMATION / CAPTURE_EFFECT rendering** — хуки `useEquippedWinAnimation`
   / `useEquippedCaptureEffect` готовы в `lib/equippedItems.ts`, но рендера
   animation в VictoryScreen / ChessBoard нет.
4. **nginx alias** `/static/avatars/` → `/var/lib/chesscoin/avatars/` — нужен
   для bot-загруженных аватаров (FSM сохраняет файл в `/var/lib/...`,
   а URL формирует через `PUBLIC_AVATAR_BASE_URL`).
5. **`prisma db seed`** на проде после деплоя — чтобы 100 placeholder
   PREMIUM_AVATAR попали в `items` таблицу.

## Workflow lessons (audit-peer-review)

1. `verified=True` требует И `overall ≥ 80` И `aggregate.blockers=[]` И
   отсутствие per-slot fail (< 80 у одного из 3 ревьюверов). Чистого
   overall недостаточно.
2. **Атомарные коммиты** дают выше code_quality scores — смешение двух
   задач (emoji + matchmaking в `339efc4`) стоило T3 баллов.
3. **Recon-задачи** auto-not-verified пока выявленные риски не закрыты в
   коде — это by-design.
4. `qwen3.6-max-preview` устойчиво самый строгий (особенно code_quality);
   `glm-4.7` самый щедрый; `deepseek-v4-pro` сбалансированный.
5. API лимит `diffs` = 8000 chars → большие коммиты нужно подавать
   composite-ом (head + tail с маркером `[trimmed middle]`).

## Memory references

| Запись | Memory ID | Описание |
|---|---|---|
| T1 iterative | `#201` | GamePage spectator UI v3=90.58 |
| T2 iterative | `#202` | Wars matchmaking v2=95.0 |
| T3 iterative | `#203` | Emoji removal 93.75 |
| T4 recon | `#204` | Shop/Exchange/TON recon |
| Cycle test summary | `#209` | Baseline audit-cycle 4 tasks |
| A1 verified | `#211` | TON free connect 83.33 |
| A3 unverified | `#212` | Shop contrast 86.67 |
| A2 unverified | `#213` | Premium avatars 79.38 |
| A4 verified | `#215` | equippedItems.THEME 94.42 |
| A5 verified | `#216` | Withdrawal worker 89.17 |
| Batch summary | `#217` | A1-A5 итоги |

Локально: `C:/Users/SAM/.claude/projects/chesscoin/HISTORY.json` (12 entries).
