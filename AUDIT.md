# ChessCoin v7.2.0 — Полный аудит
> Дата: 21.03.2026
> Сравнение с MASTERPLAN.md, проверка всего стека
> Метод: полный анализ backend, frontend, bot, infrastructure, security
>
> **Актуальный порядок исправлений и критерии готовности (реконструкция без переписывания с нуля):** см. **[RECONSTRUCTION_TASKS.md](./RECONSTRUCTION_TASKS.md)** (шаги U1–U10, важность `[Ф]`/`[В]`/`[С]`, чеклисты верификации). Ниже — детальный разбор находок; при конфликте приоритет у **номерованной последовательности** в RECONSTRUCTION_TASKS.

---

## Результат: 67 находок

| Severity | Count | Описание |
|----------|-------|----------|
| CRITICAL | 6 | Крэши, секреты в git, сломанные компоненты |
| HIGH | 8 | Обход updateBalance, отсутствие полей, TS strict off |
| MEDIUM | 15 | i18n ошибки, hardcoded русский, кеш, type mismatches |
| LOW | 10 | Дублирование, стилистика, мелочи |
| INFO | 28 | Пройденные проверки (подтверждение MASTERPLAN) |

---

## 🔴 CRITICAL (6)

### C1. `t is not defined` в WarChallengePopup *(RUNTIME CRASH)*
- **Файл:** `frontend/src/components/ui/WarChallengePopup.tsx`
- `useT()` импортирован (строка 1), но `const t = useT()` НЕ вызван внутри компонента
- `t.warChallenge.title/subtitle` используются на строках 77, 92, 108, 122
- Строка 28: повреждённый комментарий `// Автоотклонение через 30 t.warChallenge.secondsунд`
- **Эффект:** Крэш при появлении вызова на войну

### C2. ChessBoard: `pendingPromotion` state не объявлен *(RUNTIME CRASH)*
- **Файл:** `frontend/src/components/game/ChessBoard.tsx`
- `setPendingPromotion()` вызывается (строки 205, 258, 316), `pendingPromotion` читается (строки 300, 301, 317, 352)
- `useState` для этого state ОТСУТСТВУЕТ
- **Эффект:** Превращение пешки невозможно — крэш при попытке

### C3. CountryDetailModal полностью сломан *(25+ TS ошибок)*
- **Файл:** `frontend/src/components/wars/CountryDetailModal.tsx`
- Missing imports: `useUserStore`, `useInfoPopup`, `overlayStyle`, `modalStyle`, `handleBar`, `closeBtnStyle`, `goldBtnFull`, `challengeBtnStyle`, `StatBox`
- Missing type properties: `Country.treasury`, `Country.maxMembers`, `Country.activeWar`, `Country.myMembership`

### C4. DeclareWarModal / WarDetailModal / WarsIntroModal сломаны
- **Файлы:** `frontend/src/components/wars/DeclareWarModal.tsx`, `WarDetailModal.tsx`, `WarsIntroModal.tsx`
- Missing: `overlayStyle`, `modalStyle`, `handleBar`, `closeBtnStyle`, `inputStyle`, `chipBtn`, `goldBtnFull`, `formatTime`
- **Эффект:** Вся секция "Войны" → модалы не работают

### C5. BOT_TOKEN засвечен в git *(SECURITY)*
- **Файл:** `.claude/settings.local.json` (закоммичен!)
- Содержит полный production токен бота: `8741660434:AAG...`
- Также содержит IP сервера `37.77.106.28`, SSH порт `2222`, user `root`
- **Действие:** НЕМЕДЛЕННО ротировать токен через @BotFather

### C6. Admin middleware сломан — admin роуты недоступны
- **Файл:** `backend/src/middleware/auth.ts` строка 32
- `authMiddleware` устанавливает `req.user = { id: userId }` — без `isAdmin`
- `adminOnly` проверяет `req.user?.isAdmin` → всегда `undefined`
- **Эффект:** ВСЕ admin эндпоинты (airdrop, admin panel) возвращают 403

---

## 🟠 HIGH (8)

### H1. Множественные обходы `updateBalance()`
- **MASTERPLAN:** "Все операции с балансом ONLY через `updateBalance()`"
- **Реальность:** Прямой `prisma.user.update({ balance: increment })` в:
  - `exchange.ts` (7 мест)
  - `gameTasks.ts` (2 места)
  - `tasks.ts:241` (puzzle rewards)
  - `tournaments.ts:242` (entry fee)
  - `wars.ts:741` (war contribution)
  - `cleanup.ts:97` (refund)
  - `crons.ts:663` (order cancellation refund)
- **Эффект:** Пропускаются: league recalc, totalEarned/totalSpent, emission tracking, cache invalidation

### H2. `formatUser()` не возвращает `wins` и `losses`
- **Файл:** `backend/src/routes/auth.ts`
- Frontend использует `user.wins` и `user.losses` → получает `undefined`
- `rank` внутри `militaryRank.rank`, а не `user.rank` отдельно

### H3. TypeScript `strict: false` *(вся строгость отключена)*
- **Файл:** `backend/tsconfig.json`
- `noImplicitAny: false`, `strictNullChecks: false`, `strictFunctionTypes: false`
- `noEmitOnError: false` — компилятор выдаёт JS даже с ошибками

### H4. Debug login bypass в продакшне
- **Файл:** `backend/src/services/auth.ts` строки 44-47
- Если `DEBUG=true` + initData начинается с `"debug:"` → auth полностью обходится
- `BOT_API_SECRET` по умолчанию `"internal_secret"`

### H5. `.claude/` не в `.gitignore`
- Файл `.claude/settings.local.json` содержит серверные данные и засвечен в git
- **Действие:** Добавить `.claude/` в `.gitignore`, удалить из tracking

### H6. api/index.ts: Missing type imports `ActiveMatch` и `Country`
- **Файл:** `frontend/src/api/index.ts`
- `ActiveMatch` (строка 184) и `Country` (строки 190, 192, 194) используются, но не импортированы

### H7. BadgeDetailModal: `JARVIS_LEVELS` не определён
- **Файл:** `frontend/src/components/profile/BadgeDetailModal.tsx` строка 10
- `JARVIS_LEVELS` используется но не импортирован

### H8. PgnReplayModal: `useEffect` не импортирован
- **Файл:** `frontend/src/components/profile/PgnReplayModal.tsx` строка 12

---

## 🟡 MEDIUM (15)

### M1. i18n: English `gameSetup` содержит русский текст
- **Файл:** `frontend/src/i18n/translations.ts` строки 208-211
- `en.gameSetup.title: 'Настройка игры'`, `duration: 'Контроль времени'`, `color: 'Цвет'`

### M2. i18n: English `notifications` содержит русский текст
- **Файл:** `translations.ts` строки 262-266

### M3. i18n: `en.profile` отсутствуют ключи `monthlyChampion`
- Ключи `monthlyChampion`, `monthlyChampionDate`, `noChampionYet` есть в `ru`, но не в `en`

### M4. ActiveSessionsModal: hardcoded русский текст
- `TYPE_LABEL` и `STATUS_LABEL` — hardcoded Russian вместо i18n

### M5. `game:create:bot` не сохраняет скины
- **MASTERPLAN S3:** Скины создателя видны обоим игрокам
- `createBotSession()` НЕ читает `boardSkinUrl`/`pieceSkinUrl` — только `createBattleSession()` делает

### M6. Duplicate redis import
- **Файл:** `backend/src/routes/exchange.ts` — `import { redis }` на строках 1 И 16

### M7. `expiresIn: 0` на Telegram initData validation
- **Файл:** `backend/src/services/auth.ts` строка 51
- Replay attack вектор — старый initData принимается бессрочно

### M8. No health check на backend service в docker-compose

### M9. Bot i18n: 6 языков без ключей `welcome_returning`
- uk, de, es, fr, tr, pt, zh — нет fallback для returning users

### M10. `game:cancel` не создаёт Transaction запись

### M11. Bot rewards regression: level 11-20 ниже 6-10
- Level 10 = 50,000 ᚙ, level 11 = 11,000 ᚙ — вероятно ошибка

### M12. ShopPage: Duplicate `border` key in style
- Строки 629 и 634 — мертвый код

### M13. GameSetupModal: `t` shadowed в `.map((t) => ...)`

### M14. Avatar.tsx: `equippedItems` нет на типе `UserPublic`

### M15. No CI build/test step перед деплоем

---

## 🟢 LOW (10)

| # | Описание |
|---|----------|
| L1 | Hardcoded version `v7.2.0` в deploy notification |
| L2 | Redundant `import os` в `bot/main.py` строка 93 |
| L3 | Redundant `parse_mode="HTML"` в bot handlers |
| L4 | Нет log rotation на postgres/redis контейнерах |
| L5 | `format.ts`: Multiple `(session as any)` casts |
| L6 | 3 uses of `any` в route files: tasks.ts:33, games.ts:46,78 |
| L7 | Debug login возвращает другую форму user объекта |
| L8 | Gzip compression дублируется в outer nginx и frontend nginx |
| L9 | Duplicate type definitions `ActiveMatch`/`Country` в types/ |
| L10 | Weak default `BOT_WEBHOOK_SECRET: "chesscoin_wh_secret"` |

---

## ✅ MASTERPLAN Compliance Check

| Задача | Статус | Примечание |
|--------|--------|------------|
| **S1** — Visual tab (boards+figures) | ✅ PASS | 4 sub-tabs: boards, figures, sets, animations |
| **S2** — Exchange tab в магазине | ✅ PASS | Locked/unlocked screen, full UI |
| **S3** — Скины создателя в игре | ⚠️ PARTIAL | Работает для BATTLE, НЕ для BOT (M5) |
| **E1** — P2POrder schema | ✅ PASS | Все поля, relations |
| **E2** — GET /orders стакан | ✅ PASS | + ?mine=true |
| **E3** — GET /price-history | ✅ PASS | ?hours=24/168/720 |
| **E4** — POST /orders | ✅ PASS | 10K min, price validation |
| **E5** — DELETE /orders/:id | ✅ PASS | Own OPEN only, coins returned |
| **E6** — POST /orders/:id/execute | ✅ PASS | boc/txHash, idempotency |
| **E7** — ExchangeTab frontend | ✅ PASS | Price, chart, orderbook, buttons |
| **E8** — Create order modal | ✅ PASS | Slider, quick buttons, fee calc |
| **E9** — Execute order modal | ✅ PASS | TonConnect integration |
| **E10** — exchangeApi client | ✅ PASS | All methods + extras |
| **Архитектура: updateBalance()** | ❌ FAIL | 14+ мест обходят (H1) |
| **Архитектура: Max 3 sessions** | ✅ PASS | Validated in backend |
| **Экономика: 0.5% fee** | ✅ PASS | Implemented |

---

## 🚨 Приоритет исправлений

### Немедленно (security)
1. ⛔ Ротировать BOT_TOKEN через @BotFather (C5)
2. ⛔ Добавить `.claude/` в `.gitignore`, удалить из tracking (H5)
3. ⛔ Очистить git history от токена (git filter-repo)

### Блокирующие (runtime crashes)
4. 🔴 Исправить WarChallengePopup — добавить `const t = useT()` (C1)
5. 🔴 Исправить ChessBoard — добавить `pendingPromotion` state (C2)
6. 🔴 Исправить admin middleware — включить `isAdmin` в `req.user` (C6)
7. 🔴 Исправить wars модалы — восстановить imports (C3, C4)

### Важные (архитектура)
8. 🟠 Перевести updateBalance() — заменить 14 прямых обращений (H1)
9. 🟠 formatUser() — добавить wins, losses, rank (H2)
10. 🟠 Отключить debug bypass в production (H4)

---

## 📊 Общая оценка

| Категория | Оценка |
|-----------|--------|
| MASTERPLAN задачи (S1-S3, E1-E10) | **12/13** выполнено (S3 partial) |
| Безопасность | ⛔ **КРИТИЧНО** — токен в git |
| Стабильность frontend | ⚠️ **6 компонентов** с runtime crashes |
| Стабильность backend | ✅ Работает, но с обходами архитектуры |
| i18n | ⚠️ Русский текст в English locale |
| TypeScript | ⚠️ strict off, **70+ ошибок** tsc |
| Тесты | ⚠️ 8 файлов, но без auth/socket/shop покрытия |
| Infrastructure | ✅ Docker/nginx/CI работают |
