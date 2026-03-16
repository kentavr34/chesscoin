# ChessCoin Перестройка 3.0 — Детальный план реализации

## Принципы упорядочивания
- БД → Backend → Frontend (зависимости строго соблюдаются)
- Стилевой фреймворк раньше отдельных страниц (не переделывать дважды)
- Критические баги — первыми
- Каждый этап не ломает предыдущий

---

## ЭТАП 0: Критический баг — авторизация / кэш профиля

**Проблема:** При входе с другого Telegram-аккаунта на том же устройстве показывается профиль первого пользователя (localStorage/tokens не сбрасываются).

### 0.1 Frontend — `useAuth.ts` + `api/client.ts`
- При `POST /auth/login` **сначала** очищать `localStorage` (токены, user-данные) перед сохранением новых
- В `client.ts` при 401 → refresh → если refresh тоже 401 → `logout()` + очистить всё
- Добавить хеш `telegramId` в ключ localStorage, чтобы данные разных пользователей не перемешивались

### 0.2 Backend — `routes/auth.ts`
- При `POST /auth/login` возвращать актуальный `telegramId` в ответе — фронтенд сравнивает с тем, что в localStorage

---

## ЭТАП 1: БД — новые модели и поля

### 1.1 Prisma: Шахматные задачи и уроки
```prisma
model ChessPuzzle {
  id          String   @id @default(cuid())
  externalId  String   @unique   // lichess ID или наш ID
  type        PuzzleType  // LESSON | DAILY
  title       String
  titleRu     String?
  titleEn     String?
  fen         String             // начальная позиция
  moves       String             // правильные ходы через пробел ("e2e4 e7e5")
  difficulty  Int                // 1-100
  reward      BigInt             // монеты за решение
  category    String?            // opening, endgame, tactic, etc.
  month       Int?               // для ежемесячных daily
  year        Int?
  createdAt   DateTime @default(now())
  completions PuzzleCompletion[]
}

model PuzzleCompletion {
  id        String   @id @default(cuid())
  userId    String
  puzzleId  String
  passedAt  DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  puzzle    ChessPuzzle @relation(fields: [puzzleId], references: [id])
  @@unique([userId, puzzleId])
}

enum PuzzleType {
  LESSON
  DAILY
}
```

### 1.2 Prisma: Сохранённые партии
```prisma
model SavedGame {
  id        String   @id @default(cuid())
  userId    String
  sessionId String
  savedAt   DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  session   Session  @relation(fields: [sessionId], references: [id])
  @@unique([userId, sessionId])
}
```

### 1.3 Prisma: User — новые поля
```prisma
// В модели User добавить:
birthDate    DateTime?
email        String?
phone        String?
passwordHash String?
```

### 1.4 Prisma: TON Connect
```prisma
// В модели User заменить tonWallet String? на:
tonWallet    String?      // подключённый адрес
tonConnected Boolean      @default(false)
```

### 1.5 Prisma: Биржевые ордера
```prisma
model TradeOrder {
  id         String      @id @default(cuid())
  userId     String
  type       OrderType   // BUY | SELL
  currency   OrderCurrency // TON | STARS
  amount     BigInt      // количество монет
  price      Float       // цена за единицу в TON/Stars
  status     OrderStatus @default(OPEN) // OPEN | FILLED | CANCELLED
  createdAt  DateTime    @default(now())
  filledAt   DateTime?
  user       User        @relation(fields: [userId], references: [id])
}

enum OrderType { BUY SELL }
enum OrderCurrency { TON STARS }
enum OrderStatus { OPEN FILLED CANCELLED }
```

### 1.6 Миграция и seed
- `npx prisma migrate dev --name rebuild_3_0`
- `npx prisma generate`
- Обновить `seed.ts`: загрузить 100 уроков (LESSON) + 100 ежемесячных задач (DAILY) с ходами, FEN, сложностью, наградами

---

## ЭТАП 2: Backend — новые маршруты и сервисы

### 2.1 Маршрут `/puzzles` (`backend/src/routes/puzzles.ts`)
```
GET  /puzzles/lessons          → список уроков с прогрессом пользователя
GET  /puzzles/lessons/:id      → один урок (fen, moves, title, reward)
POST /puzzles/lessons/:id/complete → засчитать прохождение + updateBalance
GET  /puzzles/daily            → список ежемесячных заданий (текущий месяц)
GET  /puzzles/daily/:id        → одна задача
POST /puzzles/daily/:id/complete → засчитать + updateBalance
```
- `POST .../complete` — проверяет что `PuzzleCompletion` ещё нет (не начисляет повторно)
- Зарегистрировать в `index.ts`: `app.use(\`${API}/puzzles\`, puzzlesRouter)`

### 2.2 Маршрут `/games/saved` (`backend/src/routes/games.ts`)
```
GET  /games/saved              → сохранённые партии пользователя
POST /games/:sessionId/save    → добавить в SavedGame (upsert)
DELETE /games/:sessionId/save  → убрать из сохранённых
```

### 2.3 Маршрут `/shop/orders` (дополнение к `shop.ts`)
```
GET  /shop/orders              → список открытых ордеров + мои ордера
POST /shop/orders              → создать ордер (макс 3 активных)
DELETE /shop/orders/:id        → отменить свой ордер
POST /shop/orders/:id/fill     → исполнить чужой ордер
```
- Проверить наличие TON-кошелька для создания ордера
- Ограничение: 3 активных ордера одновременно на пользователя

### 2.4 Улучшение JARVIS AI — `backend/src/services/game/socket.ts`

**Текущая проблема:** Pure minimax без хорошей оценки позиции — легко ломается тактически.

**Решение:** Улучшить функцию `evaluateBoard` и `getStockfishMove`:
- Добавить оценку **мобильности** (количество доступных ходов)
- Добавить оценку **центра** (поля e4,d4,e5,d5 бонус x1.5)
- Добавить **таблицы позиций фигур** (piece-square tables: стандартные шахматные PST)
- Добавить **обнаружение мата** (приоритет перед всем)
- Для уровня 10 (Mystic): глубина 12, 0% случайных ходов, итеративное углубление с ограничением 3 сек
- Для уровней 8-9: depth 8-10, quiescence search (дополнительный поиск при взятиях)
- Кешировать результаты в transposition table (Map в памяти)

### 2.5 TON Connect backend — `backend/src/routes/profile.ts`
- Добавить `POST /profile/ton/connect` → принять `{ walletAddress, proof }`, верифицировать TON proof, сохранить
- Добавить `POST /profile/ton/disconnect`
- Существующий wallet connect оставить как fallback

### 2.6 Военная механика — `backend/src/routes/nations.ts`
- `POST /nations/leave` — уже должен быть, проверить что работает
- Добавить `GET /nations/:clanId/soldiers` → список бойцов для `/бойцы` кнопки
- Исправить маршрут просмотра профиля из Wars-страницы (возвращать userId через параметр)

---

## ЭТАП 3: Стилевой фреймворк и навигация (Frontend)

### 3.1 `BottomNav.tsx` — убрать вкладку Tasks
- Было 6 вкладок: Play, Battles, Wars, Tournaments, **Tasks**, Profile
- Стало 5 вкладок: Play, Battles, Wars, Tournaments, Profile
- Tasks теперь доступны только с главной страницы (горизонтальная панель)

### 3.2 `PageLayout.tsx` — единый заголовок страниц
Создать компонент `PageHeader`:
```tsx
// Используется в: Battles, Wars, Tournaments, Tasks, Shop
// Заголовок по центру, без иконки перед текстом
// Справа — иконка ⓘ (информация)
// Первое открытие: автоматически показывает InfoPanel (с крестиком)
// Повторно: только по клику на ⓘ
```

Хранить в localStorage `{page}_info_seen: true` после первого закрытия.

### 3.3 Шрифт заголовков страниц
- Убрать эмодзи перед названиями: `⚔️ Батлы` → `Батлы`
- Один размер (20px), Unbounded, #F5C842, по центру
- Войны: убрать иконку 🌍, название по центру

---

## ЭТАП 4: HomePage — профиль

### 4.1 Верхняя панель
- Убрать надпись `Chesscoin` вверху
- Убрать пустую верхнюю полосу (оставить только margin-top ~12px)
- Кнопка магазина 🛍 → перенести на панель профиля рядом с балансом

### 4.2 Баланс
- Уменьшить шрифт суммы монет на 30%
- Рядом добавить иконку 🛍 — ведёт на ShopPage

### 4.3 Военное звание (вместо или рядом с JARVIS-уровнем)
```
Справа от JARVIS статистики:
─────────────────────────────
  Звание
  Сержант          ← на основе количества рефералов
  В подчинении: 126 бойцов
─────────────────────────────
```
Таблица воинских званий по рефералам:
| Бойцов | Звание |
|---|---|
| 0 | Рядовой |
| 5 | Ефрейтор |
| 10 | Капрал |
| 25 | Сержант |
| 50 | Старшина |
| 100 | Лейтенант |
| 250 | Капитан |
| 500 | Майор |
| 1000 | Полковник |
| 5000 | Генерал |

### 4.4 Флаг страны рядом с именем
- Если `user.countryId` не null — показывать эмодзи флага страны рядом с именем

### 4.5 Попытки (Attempts) — таймер обратного отсчёта
- После использования звезды: показывать `до следующей звезды осталось ⏱ 07:43:21`
- Таймер тикает в реальном времени (setInterval 1 сек)
- Когда все 3 звезды — таймер скрыт

### 4.6 Значок `+` рядом со звёздами
- После ряда звёзд добавить `+` который открывает AttemptsModal

### 4.7 Чемпион (если есть данные)
- Если `user.championTitle` (новое поле) → между балансом и JARVIS блоком:
  `🏆 Чемпион месяца Март 2026`

---

## ЭТАП 5: GameResultModal — ручное закрытие

### 5.1 `GameResultModal.tsx`
- Убрать `setTimeout` 3 секунды и автоматическое закрытие
- Добавить кнопки: **Реванш** (если бот) | **Закрыть** (переход на главную)
- При "Закрыть" → `navigate('/')`
- Убрать таймер-счётчик (он был для авто-закрытия)
- Оставить только Реванш + Закрыть для бот-игр; для батлов — только Закрыть

---

## ЭТАП 6: Battles — UX-исправления

### 6.1 Кнопка закрытия ожидающего батла
- В `BattlesPage.tsx` — окно ожидания соперника имеет кнопку ✕ (закрыть, батл остаётся активным)
- При нажатии ✕ → скрыть оверлей, пользователь видит список батлов
- Батл остаётся в списке Waiting до отмены или принятия
- Добавить кнопку **Отменить батл** в карточке своего батла в Waiting-списке

### 6.2 Инфо-кнопка в батлах
- В заголовке BattlesPage (справа, уровень с заголовком) — кнопка ⓘ (см. §3.2)
- Текст: объяснение батл-системы (ставки, комиссия 10%, ELO)
- Первое открытие страницы: InfoPanel выскакивает автоматически

### 6.3 Модал создания батла — положение
- Сдвинуть вверх чтобы кнопка "Создать" была видна без скролла
- `bottom: 0` → `top: 10%` или использовать `height: 85vh` с `overflow-y: auto`

---

## ЭТАП 7: Tasks — полный рефакторинг

### 7.1 Структура страницы
- Убрать вкладку Tasks из BottomNav (уже в §3.1)
- Tasks доступны с HomePage по горизонтальной панели
- Категории: **Обучение** (LESSON уроки) | **Задачи дня** (DAILY) | **Социальные** (SOCIAL) | **Прочие**

### 7.2 Обучающие уроки (LESSON) — экран в приложении

**Режим "Урок":**
1. Открывается наша шахматная доска с FEN урока
2. Вверху — название урока на языке приложения
3. Кнопки: ◀ ▶ для перехода по ходам (как в просмотре истории)
4. После последнего хода → кнопка **Тест**

**Режим "Тест":**
1. Та же доска, та же позиция с начала — но без подсказки
2. Игрок должен повторить ходы в точности
3. В истории ходов неправильный ход → красный цвет
4. Если есть хоть один красный → кнопки:
   - **Пройти повторно** (reset теста)
   - **Смотреть обучение** (вернуть в режим Урок)
5. Если все ходы правильные → кнопка **Принять**
6. При нажатии Принять → уведомление победы: "Успешно! +X монет за этот урок. Попробовать следующий?"
7. Кнопки: **Повторить** (не начисляет) | **Следующий**

**Компонент:** `PuzzleLessonPage.tsx` (новая страница)
- Принимает `puzzleId`, тип = LESSON
- Два режима: `lessonMode` / `testMode`
- Использует `chess.js` для валидации ходов
- Хранит `testMoves: { san: string, correct: boolean }[]`

### 7.3 Ежедневные задачи (DAILY)

**Экран задачи:**
1. Открывается доска с FEN задачи
2. Уведомление с условием задачи (крестик закрывает)
3. Кнопка ⓘ справа → при нажатии открывает описание этой конкретной задачи
4. Игрок делает ходы — без подсказок
5. Если решение верное → уведомление победы + монеты
6. Выполненные задачи исчезают из списка

**Компонент:** `PuzzleDailyPage.tsx` (новая страница)

### 7.4 Добавить маршруты в `App.tsx`
```tsx
<Route path="/puzzle/lesson/:id" element={<PuzzleLessonPage />} />
<Route path="/puzzle/daily/:id" element={<PuzzleDailyPage />} />
```

---

## ЭТАП 8: Nations/Wars — реструктуризация

### 8.1 Панель своей страны
Под флагом добавить:
```
Казна: 12,500 ᚙ   Бойцы: 47   Победы: 12
```
Кнопки ниже:
- **Донат** → открывает модал с вводом суммы
- **Бойцы** → открывает список участников (с профилями)
- **Сражения** → фильтрует список войн по этой стране
- **Выйти** → подтверждение + `POST /nations/leave`

### 8.2 Основная страница Nations
Структура после панели своей страны:
1. Строка поиска
2. Три кнопки на одной панели: **Страны** | **Войны** | **История**
3. Ниже — соответствующий контент

Убрать все другие вкладки (clan, wars, battles, members, ranking → заменить этой упрощённой структурой).

### 8.3 Клик на профиль бойца
- В списке бойцов страны / в войнах: клик на аватар → `navigate(\`/profile/${userId}\`)`
- НЕ переходить на свой профиль — переходить на профиль кликнутого игрока

---

## ЭТАП 9: Profile Public — улучшения

### 9.1 Загрузка и обрезка фото
- Добавить cropper при загрузке аватара (библиотека `react-easy-crop` или inline canvas)
- Обрезка под круг аватара

### 9.2 Флаг страны рядом с именем
- Если пользователь в стране → показывать флаг (эмодзи) рядом с именем на всех профилях

### 9.3 Вкладка Аналитика
- Перевести все лейблы на текущий язык приложения
- Убрать кнопку "Реферальная ссылка" из вкладки

### 9.4 Кнопка настроек (звёздочка ⚙)
- Сейчас вверху справа — переименовать в настоящую шестерёнку ⚙
- При нажатии → `SettingsPage` (новая страница)
- На **чужом** профиле: эта кнопка → **Сразиться** (создать challenge)

### 9.5 `SettingsPage.tsx` (новая страница)
Поля:
- Язык (ru/en + другие)
- Вибрация (on/off)
- Дата рождения
- Email
- Мобильный
- Пароль (смена)
- (placeholder) Face ID / Touch ID

### 9.6 Поднять контент выше
- Уменьшить отступ над аватаром (сейчас слишком много пустого пространства)

### 9.7 Иконка сохранения партии
- На каждой карточке истории игр → иконка 🔖 (контурная)
- При нажатии → `POST /games/:sessionId/save`, иконка становится заполненной
- На вкладке профиля добавить **Сохранённые** — отдельная вкладка

### 9.8 Бейджи
- Текущий размер бейджа → уменьшить ширину вдвое
- В одной строке = 2 бейджа
- Добавить стиль `ChampionBadge` для турнирных побед

### 9.9 Страница рефералов
- Звания отображать в одну горизонтальную строку (от рядового до генерала)
- Кнопки-шевроны: шире по высоте, одинаковой длины, текст звания **вне** кнопки
- Активный шеврон (достигнутое звание) → подсветка цветом темы игрока

---

## ЭТАП 10: Shop — TON Connect + биржа

### 10.1 TON Connect (настоящий)
- Установить `@tonconnect/ui-react`
- Заменить ручной ввод адреса на TON Connect SDK
- При подключении: уведомление в стиле победы "Кошелёк подключён!"
- Проверить баланс: если < 1 TON → уведомление "Недостаточно TON"
- После подключения → списать 1 TON как разовую комиссию

### 10.2 Структура ShopPage
**Панель баланса** (вверху):
- Слева: баланс монет
- По центру: кнопка `[Подключить TON]` / `[TON: подключён ✓]`
- Справа: курс ᚙ/TON

**Две секции ниже:**
- **Монеты** → биржа (ордера)
- **Стили** → инвентарь

### 10.3 Биржа (раздел Монеты)
- Список открытых ордеров (BUY/SELL)
- Кнопка `+ Создать ордер`
- Модал создания: Купить / Продать; количество (слайдер 10000→10M); за TON / Stars
- Максимум 3 активных ордера (проверка на бэке)
- Без кошелька: красивое уведомление "Подключите кошелёк"
- Исполнение чужого ордера: кнопка Купить/Продать в карточке ордера

### 10.4 Стили (раздел Стили)
- Фильтры: Рамки | Доски | Фигуры | Анимации | Темы | Аватары
- Сортировка: по цене | по дате
- Вверху: **Мои предметы** (уже куплены)
- Ниже: **Магазин** (доступные к покупке)
- При нажатии **Применить** → изменения применяются ко всей платформе немедленно

### 10.5 10 предметов каждой категории
Создать в seed.ts (или через admin API):
- 10 рамок аватара (Bronze, Silver, Gold, Diamond, Champion, Star, Neon, Fire, Ice, Royal)
- 10 скинов доски (Classic, Dark, Wood, Marble, Neon, Ocean, Desert, Forest, Obsidian, Crystal)
- 10 скинов фигур (Default, Pixel, Medieval, Futuristic, Minimal, Gold, Stone, Glass, Shadow, Royal)
- 10 анимаций (None, Sparkle, Fire, Ice, Lightning, Stars, Confetti, Matrix, Pulse, Rainbow)
- 10 тем (Dark, Midnight, Emerald, Ruby, Sapphire, Amber, Rose, Slate, Violet, Obsidian)
- 10 аватаров (если применимо)

### 10.6 Применение тем глобально
- `useSettingsStore` хранит активную тему
- Все страницы читают цвета из store (заменить хардкод #0B0D11 на `theme.background`)
- При смене темы → все страницы обновляются без перезагрузки

---

## ЭТАП 11: CHECO Token Plan (документация + подготовка)

### 11.1 Создание файла `CHECO_TOKEN_PLAN.md`
Подробный план выпуска токена на TON:
1. Разработка Jetton-контракта (стандарт TEP-74)
2. Параметры: CHECO, Chess Coin, 100 млрд, дефляционная система
3. Деплой через tonweb / ton-core
4. Привязка к кошельку `UQDZNHJrTBJ9asNgL15bf-8Ud4Rleku-oP6TSlbg6EWXfq7y`
5. Листинг на DEX (STON.fi / DeDust)
6. Интеграция в платформу для Phase 3

### 11.2 Smart contract template
Создать `contracts/checo_jetton.fc` — базовый FunC контракт Jetton

---

## ПОРЯДОК РЕАЛИЗАЦИИ (финальный)

| # | Задача | Зависит от | Файлы |
|---|---|---|---|
| 0 | Баг авторизации | — | `useAuth.ts`, `client.ts` |
| 1 | Prisma schema + migrate | — | `schema.prisma` |
| 2 | Backend: puzzles маршрут | 1 | `routes/puzzles.ts`, `index.ts` |
| 3 | Backend: saved games маршрут | 1 | `routes/games.ts` |
| 4 | Backend: orders маршрут | 1 | `routes/shop.ts` |
| 5 | JARVIS AI улучшение | — | `services/game/socket.ts` |
| 6 | Backend: nations/leave fix | — | `routes/nations.ts` |
| 7 | BottomNav: убрать Tasks | — | `BottomNav.tsx` |
| 8 | PageHeader компонент | — | `components/layout/PageHeader.tsx` |
| 9 | GameResultModal: ручное закрытие | — | `GameResultModal.tsx` |
| 10 | Battles: закрыть оверлей + инфо + модал вверх | — | `BattlesPage.tsx` |
| 11 | HomePage: профиль UI | — | `HomePage.tsx` |
| 12 | Profile Public: флаг, бейджи, настройки | — | `ProfilePage.tsx` |
| 13 | SettingsPage новая | — | `SettingsPage.tsx` |
| 14 | Tasks: PuzzleLessonPage | 2 | `PuzzleLessonPage.tsx` |
| 15 | Tasks: PuzzleDailyPage | 2 | `PuzzleDailyPage.tsx` |
| 16 | Tasks: рефакторинг TasksPage | 14,15 | `TasksPage.tsx` |
| 17 | Nations: реструктуризация | 6 | `NationsPage.tsx` |
| 18 | Shop: TON Connect + биржа | 4 | `ShopPage.tsx` |
| 19 | Стили: 10 предметов + глобальные темы | 18 | `seed.ts`, `useSettingsStore.ts` |
| 20 | Иконка сохранения партии | 3 | `ProfilePage.tsx`, `GamePage.tsx` |
| 21 | Рефералы: звания-шевроны | — | `ReferralsPage.tsx` |
| 22 | CHECO Token документация | — | `CHECO_TOKEN_PLAN.md` |
| 23 | Deploy: migrate + seed + build | всё | SSH на 37.77.106.28 |

---

## Оценка объёма
- Новые файлы: ~15
- Изменённые файлы: ~25
- Новые DB-модели: 4
- Новые backend-маршруты: ~20 endpoints
- Новые frontend-страницы: 4

Реализация ведётся последовательно по порядку выше, каждый этап коммитится отдельно.
