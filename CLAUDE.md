# CLAUDE.md — ChessCoin

Этот файл содержит всё необходимое для работы с проектом в новом чате. Читай его первым делом.

---

## Обзор проекта

**ChessCoin** — шахматная мини-игра в Telegram (Mini App) с внутренней валютой ᚙ, системой батлов, лигами, рефералами и токеномикой. Текущая версия: **v5.8.x**.

Пользователь открывает бота `@chessgamecoin_bot` в Telegram → нажимает кнопку → открывается Mini App. Вся авторизация через Telegram `initData`. Игры ведутся через WebSocket в реальном времени.

---

## Стек технологий

| Сервис | Стек |
|---|---|
| **Backend** | Node.js 20 + TypeScript + Express + Socket.io + Prisma ORM + PostgreSQL 16 + Redis 7 |
| **Frontend** | React 18 + Vite + TypeScript + Zustand + react-chessboard + socket.io-client |
| **Bot** | Python 3.11 + aiogram 3.x |
| **Инфраструктура** | Docker Compose (6 контейнеров) + Nginx + Let's Encrypt |
| **Шахматный движок** | chess.js (логика) + minimax с alpha-beta (JARVIS AI, уровни 1–10) |

---

## Структура проекта

```
chesscoin/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Модели БД
│   │   ├── seed.ts                # Начальные данные (страны, предметы, задания)
│   │   └── migrations/            # SQL-миграции
│   ├── src/
│   │   ├── index.ts               # Точка входа, Express + Socket.io сервер
│   │   ├── config.ts              # Вся конфигурация из env-переменных
│   │   ├── middleware/
│   │   │   └── auth.ts            # authMiddleware (JWT), botMiddleware (X-Bot-Secret)
│   │   ├── lib/
│   │   │   ├── prisma.ts          # Singleton Prisma клиент
│   │   │   └── redis.ts           # ioredis: основной, pub/sub для Socket.io adapter
│   │   ├── routes/
│   │   │   ├── auth.ts            # POST /auth/login, POST /auth/refresh, GET /auth/me
│   │   │   ├── profile.ts         # GET /profile/:id, GET /profile/transactions, GET /referrals
│   │   │   ├── leaderboard.ts     # GET /leaderboard
│   │   │   ├── attempts.ts        # POST /attempts/purchase
│   │   │   ├── shop.ts            # GET /shop/items, POST /shop/purchase, POST /shop/equip
│   │   │   ├── tasks.ts           # GET /tasks, POST /tasks/complete
│   │   │   ├── nations.ts         # GET /nations, POST /nations/join
│   │   │   └── bot.ts             # POST /bot/notify, GET /bot/stats (только для бота)
│   │   ├── services/
│   │   │   ├── auth.ts            # JWT sign/verify, Telegram initData проверка
│   │   │   ├── economy.ts         # updateBalance, canEmit, calculateLeague, giveWelcomeBonus
│   │   │   ├── referral.ts        # activateReferral, applyReferralIncome
│   │   │   ├── attempts.ts        # purchaseAttempts, cron восстановления попыток
│   │   │   ├── cleanup.ts         # Cron удаления мёртвых игроков
│   │   │   └── game/
│   │   │       ├── socket.ts      # Все Socket.io обработчики + JARVIS AI (minimax)
│   │   │       ├── session.ts     # createBotSession, createBattleSession, joinBattleSession
│   │   │       ├── finish.ts      # finishSession (начисление наград, ELO)
│   │   │       ├── timer.ts       # Таймер ходов через Redis, watcher
│   │   │       └── format.ts      # formatSession, formatBattlesList
│   │   └── utils/
│   │       └── gradient.ts        # Генерация CSS-градиента аватара из telegramId
│   ├── package.json
│   ├── tsconfig.json              # strict: false, paths: {"@/*": ["src/*"]}
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Роутер + SplashScreen + auth guard
│   │   ├── main.tsx               # React entry
│   │   ├── types/index.ts         # Все TypeScript-интерфейсы (User, GameSession, etc.)
│   │   ├── api/
│   │   │   ├── client.ts          # axios/fetch клиент, управление токенами, refresh
│   │   │   ├── index.ts           # authApi, profileApi, leaderboardApi, etc.
│   │   │   └── socket.ts          # Socket.io клиент (singleton)
│   │   ├── store/
│   │   │   ├── useUserStore.ts    # Zustand: user, isLoading, isAuthenticated
│   │   │   └── useGameStore.ts    # Zustand: sessions, activeSession, battles, drawOfferedBy
│   │   ├── hooks/
│   │   │   ├── useAuth.ts         # Telegram initData → login → setUser
│   │   │   └── useSocket.ts       # Подключение socket, обработка game-событий
│   │   ├── components/
│   │   │   ├── game/              # ChessBoard, CapturedPieces, GameResultModal, CoinPopup
│   │   │   ├── ui/                # AttemptsModal, GameSetupModal, JarvisModal, Toast, Avatar
│   │   │   └── layout/            # BottomNav, PageLayout
│   │   ├── pages/                 # HomePage, BattlesPage, GamePage, LeaderboardPage,
│   │   │                          # NationsPage, ProfilePage, TasksPage, ShopPage, ReferralsPage
│   │   ├── assets/pieces/         # SVG фигур (white/black × king/queen/rook/bishop/knight/pawn)
│   │   ├── lib/haptic.ts          # Telegram haptic feedback
│   │   └── utils/format.ts        # Форматирование чисел, дат
│   ├── index.html
│   ├── vite.config.ts             # Proxy /api/v1 и /socket.io → localhost:3000
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── bot/
│   ├── main.py                    # aiogram Dispatcher, polling, notifications loop
│   ├── handlers/
│   │   ├── start.py               # /start с реферальным параметром, кнопка Mini App
│   │   ├── admin.py               # Команды администратора (только ADMIN_IDS)
│   │   └── notifications.py       # Polling AdminNotification из backend
│   ├── services/
│   │   └── backend.py             # HTTP-клиент к backend API (X-Bot-Secret заголовок)
│   ├── requirements.txt
│   └── Dockerfile
│
├── nginx/
│   └── nginx.conf                 # HTTP→HTTPS редирект, proxy /api/, /socket.io/, /
│
├── docker-compose.yml             # postgres, redis, backend, frontend, bot, nginx
├── .env.example                   # Шаблон переменных окружения
├── CONTEXT_FOR_NEW_CHAT.md        # Устаревший контекстный файл (заменён этим)
└── CLAUDE.md                      # Этот файл
```

---

## Переменные окружения

Копируй `backend/.env.example` в `backend/.env` и заполняй:

```env
# Обязательные
DATABASE_URL=postgresql://chesscoin:PASSWORD@localhost:5432/chesscoin
JWT_ACCESS_SECRET=...        # случайная строка 32+ символа
JWT_REFRESH_SECRET=...       # другая случайная строка
BOT_TOKEN=...                # от @BotFather
BOT_API_SECRET=...           # произвольный секрет для inter-service auth

# Опциональные (есть дефолты)
SERVER_PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
FRONTEND_URL=http://localhost:5173
MAX_ATTEMPTS=3
ATTEMPT_RESTORE_HOURS=8
ATTEMPT_PRICE=1000
WELCOME_BONUS=5000
```

Корневой `.env.example` используется `docker-compose.yml` и требует:
`POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `BOT_TOKEN`, `BOT_API_SECRET`,
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DOMAIN`.

---

## Локальная разработка

### Backend
```bash
cd backend
cp .env.example .env        # заполнить DATABASE_URL, JWT_*, BOT_TOKEN
npm install
npx prisma migrate dev      # создать БД и применить миграции
npm run seed                 # заполнить начальными данными
npm run dev                  # tsx watch, порт 3000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                  # Vite dev server, порт 5173
                             # proxy /api/v1 и /socket.io → localhost:3000
```

### Bot
```bash
cd bot
pip install -r requirements.txt
BOT_TOKEN=... BACKEND_URL=http://localhost:3000/api/v1 python main.py
```

### Docker (production-like)
```bash
cp .env.example .env         # заполнить все переменные
docker-compose up -d --build
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run seed
```

---

## Команды backend (package.json scripts)

| Команда | Описание |
|---|---|
| `npm run dev` | Запуск с hot-reload через tsx watch |
| `npm run build` | TypeScript компиляция + tsc-alias для path-алиасов |
| `npm start` | Запуск скомпилированного `dist/index.js` |
| `npm run migrate` | `prisma migrate deploy` (production) |
| `npm run migrate:dev` | `prisma migrate dev` (создание новых миграций) |
| `npm run generate` | `prisma generate` (после изменения schema) |
| `npm run seed` | Запуск `prisma/seed.ts` |

---

## Ключевые соглашения и особенности

### BigInt сериализация
В `backend/src/index.ts` глобально патчится `BigInt.prototype.toJSON`:
```ts
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
```
Все поля `balance`, `totalEmitted`, `bet` и т.д. приходят на фронтенд **строками**. На фронтенде парсить через `BigInt(str)` или просто отображать как строку.

### Path алиасы
- **Backend**: `@/` → `src/` (через `tsconfig-paths` в dev, `tsc-alias` в build)
- **Frontend**: `@/` → `src/` (через Vite alias в `vite.config.ts`)

Всегда используй `@/` вместо относительных путей при импортах.

### TypeScript strict режим
Backend работает с `strict: false`. Не включай строгий режим — сломает существующий код.

### Prisma
- Клиент — singleton в `src/lib/prisma.ts`
- После изменения `schema.prisma` всегда запускай `npm run generate`
- Для новых полей создавай миграцию через `npm run migrate:dev`
- `binaryTargets: ["native", "linux-musl", "linux-musl-openssl-3.0.x"]` — обязательно для Alpine Docker

### Redis
Три экземпляра ioredis в `src/lib/redis.ts`:
- `redis` — основной (кэш, сессии, таймеры)
- `redisPub` / `redisSub` — для Socket.io Redis Adapter (синхронизация между инстансами)

### Авторизация
- **REST API**: `Authorization: Bearer <JWT>` → `authMiddleware` → `req.userId`
- **Socket.io**: токен в `socket.handshake.auth.token` → проверяется в middleware
- **Bot → Backend**: заголовок `X-Bot-Secret: <BOT_API_SECRET>` → `botMiddleware`
- JWT access token: 2 часа, refresh token: 7 дней

---

## База данных — ключевые модели

| Модель | Назначение |
|---|---|
| `User` | Игрок: баланс (BigInt), ELO, лига, попытки, рефералы, JARVIS уровень |
| `Session` | Шахматная партия: FEN, PGN, статус, тип (BOT/BATTLE/FRIENDLY), ставка |
| `SessionSide` | Сторона в партии: игрок, цвет, съеденные фигуры, оставшееся время |
| `Transaction` | Все операции с балансом (amount положительный = приход, отрицательный = расход) |
| `Task` | Задание (подписка, реферал, код) с наградой |
| `Item` | Предметы магазина: рамки, скины доски/фигур, анимации |
| `Clan` | Сборная страны: казна, ELO, войны |
| `PlatformConfig` | Singleton: фаза эмиссии, totalEmitted, hardCap, цена токена |
| `AdminNotification` | Очередь уведомлений для Python-бота |

### Лиги (по балансу)
| Лига | Порог |
|---|---|
| BRONZE | 0+ |
| SILVER | 100,000+ |
| GOLD | 1,000,000+ |
| DIAMOND | 5,000,000+ |
| CHAMPION | 10,000,000+ |
| STAR | 50,000,000+ |

---

## Экономика (токеномика)

### Три фазы
**Фаза 1** (пока `totalEmitted < 30 млрд ᚙ`):
- Welcome бонус новому: **5,000 ᚙ**
- Съеденная фигура (только с ботом): пешка 100, конь/слон 300, ладья 500, ферзь 900, король 1,000
- Победа над ботом уровня N: настраивается в `config.economy.botRewards[N]`
- Реферальный бонус (первая игра реферала): **3,000 ᚙ**
- % от выигрыша реферала: 50% (1-й уровень) + 10% (2-й уровень)

**Фаза 2** (автоматически при `totalEmitted >= emissionCap`):
- Отключается раздача за фигуры и welcome бонус (`canEmit()` возвращает false)
- Игра с ботом: победил → монеты из резерва; проиграл → теряешь ставку

**Фаза 3** (вручную): P2P биржа, вывод на TON-кошелёк

### Попытки (Attempts)
- По умолчанию 3 попытки, восстановление +1 каждые 8 часов (независимо для каждого слота)
- Покупка дополнительных: до 3 штук за 1,000 ᚙ каждая (итого максимум 6)
- Каждая новая партия тратит 1 попытку

### Батл (PvP)
- Комиссия 10% с банка (банк = ставка × 2)
- Победитель получает 90% от банка
- ELO изменяется только в батлах, K=32, минимум 100

### Единственная функция для операций с балансом
```ts
// backend/src/services/economy.ts
await updateBalance(userId, amount, TransactionType.BOT_WIN, payload, { isEmission: true });
```
**Никогда не обновляй `user.balance` напрямую через Prisma** — только через `updateBalance`.

---

## Socket.io события

### Клиент → Сервер

| Событие | Данные | Описание |
|---|---|---|
| `game:current` | — | Получить активные сессии при reconnect |
| `game:create:bot` | `{ color, botLevel, timeSeconds? }` | Новая игра с ботом |
| `game:create:battle` | `{ color, duration, bet, isPrivate? }` | Новый батл |
| `game:create:friendly` | `{ color, duration }` | Дружеская игра |
| `game:join` | `{ code }` | Присоединиться к батлу/дружеской по коду |
| `game:move` | `{ sessionId, from, to, promotion? }` | Сделать ход |
| `game:surrender` | `{ sessionId }` | Сдаться |
| `game:cancel` | `{ sessionId }` | Отменить ожидающий батл (возврат ставки) |
| `game:offer_draw` | `{ sessionId }` | Предложить ничью |
| `game:accept_draw` | `{ sessionId }` | Принять ничью |
| `game:decline_draw` | `{ sessionId }` | Отклонить ничью |
| `battles:subscribe` | — | Подписаться на лобби батлов |
| `battles:unsubscribe` | — | Отписаться от лобби |
| `spectate` | `{ sessionId }` | Наблюдать за партией |
| `unspectate` | `{ sessionId }` | Перестать наблюдать |
| `ping` | — | Проверка соединения |

### Сервер → Клиент

| Событие | Данные | Описание |
|---|---|---|
| `game` | `GameSession` | Обновление состояния партии |
| `game:over` | `{ status, surrender? }` | Конец партии |
| `game:started` | `{ sessionId }` | Соперник присоединился |
| `game:draw_offered` | `{ by: userId }` | Предложение ничьей |
| `game:draw_declined` | `{ by: userId }` | Ничья отклонена |
| `battles:list` | `BattleLobbyItem[]` | Список активных батлов |
| `pong` | — | Ответ на ping |

---

## REST API

Базовый путь: `/api/v1`

| Метод | Путь | Auth | Описание |
|---|---|---|---|
| POST | `/auth/login` | — | Вход через Telegram initData |
| POST | `/auth/refresh` | — | Обновление токенов |
| GET | `/auth/me` | JWT | Текущий пользователь |
| GET | `/leaderboard` | JWT | `?league=GOLD&limit=50` |
| GET | `/profile/:userId` | JWT | Профиль игрока |
| GET | `/profile/transactions` | JWT | `?limit=20&offset=0` |
| GET | `/referrals` | JWT | Реферальная программа |
| POST | `/attempts/purchase` | JWT | Купить попытку |
| GET | `/shop/items` | JWT | `?type=AVATAR_FRAME` |
| POST | `/shop/purchase` | JWT | Купить предмет |
| POST | `/shop/equip` | JWT | Надеть предмет |
| GET | `/tasks` | JWT | Список заданий |
| POST | `/tasks/complete` | JWT | Выполнить задание |
| GET | `/nations` | JWT | Список сборных |
| POST | `/nations/join` | JWT | Вступить в сборную |
| POST | `/bot/notify` | Bot-Secret | Отправить уведомление |
| GET | `/bot/stats` | Bot-Secret | Статистика для админа |
| GET | `/health` | — | Статус сервера, фаза, эмиссия |

---

## JARVIS AI (уровни бота)

Движок реализован в `backend/src/services/game/socket.ts` функцией `getStockfishMove`.
Использует minimax с alpha-beta отсечением (без Stockfish, чистый chess.js).

| Уровень | Название | Глубина | Случайный ход (%) | Награда |
|---|---|---|---|---|
| 1 | Beginner | 1 | 20% | 1,000 ᚙ |
| 2 | Player | 2 | 17% | 3,000 ᚙ |
| 3 | Fighter | 2 | 14% | 5,000 ᚙ |
| 4 | Warrior | 3 | 11% | 7,000 ᚙ |
| 5 | Expert | 3 | 9% | 10,000 ᚙ |
| 6 | Master | 4 | 7% | 13,000 ᚙ |
| 7 | Professional | 5 | 5% | 17,000 ᚙ |
| 8 | Epic | 6 | 3% | 21,000 ᚙ |
| 9 | Legendary | 8 | 1% | 26,000 ᚙ |
| 10 | Mystic | 10 | 0% | 30,000 ᚙ |

Пользователь открывает уровни последовательно: победить уровень N → разблокировать уровень N+1.
Прогресс хранится в `User.jarvisLevel` и `User.jarvisBadges`.

---

## Дизайн-система (фронтенд)

Тёмная тема, inline-стили (без CSS-файлов):

```
Цвета:
  #0B0D11  — основной фон
  #13161E  — фон карточек
  #1C2030  — бордеры, разделители
  #F5C842  — золотой акцент (кнопки, заголовки, монеты)
  #7B61FF  — фиолетовый акцент (вторичные действия)
  #8B92A8  — вторичный текст
  #4A5270  — disabled / placeholder

Шрифты (Google Fonts):
  'Unbounded'       — заголовки, брендинг
  'Inter'           — основной текст
  'JetBrains Mono'  — числа, балансы, коды
```

---

## Фронтенд — ключевые паттерны

### Zustand stores
```ts
// Пользователь
const { user, isLoading, isAuthenticated, setUser, logout } = useUserStore();

// Игра
const { sessions, activeSession, battles, upsertSession, setActiveSession } = useGameStore();
```

### Авторизация (useAuth)
При монтировании `App`:
1. Проверяет наличие токена → `GET /auth/me`
2. Если нет — берёт `Telegram.WebApp.initData`
3. Вызывает `POST /auth/login` → сохраняет токены → `setUser`
4. В DEV режиме без Telegram работает с mock `'dev_mock'`

### Socket (useSocket)
- Подключается после аутентификации
- При `game:move`, `game` и `game:over` → обновляет `useGameStore`
- При `battles:list` → обновляет список батлов

### Мультисессии
До 3 одновременных партий. Максимум 1 бот-сессия. Каждая сессия — отдельная Socket.io комната.

---

## Деплой

### Первый деплой
```bash
git clone <repo> && cd chesscoin
cp .env.example .env
nano .env   # заполнить: POSTGRES_PASSWORD, REDIS_PASSWORD, BOT_TOKEN,
            #            BOT_API_SECRET, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, DOMAIN
docker-compose up -d --build
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run seed
```

### SSL (Let's Encrypt)
```bash
certbot certonly --webroot -w /var/www/certbot -d chesscoin.app -d www.chesscoin.app
docker-compose restart nginx
```

### Обновление
```bash
git pull origin main
docker-compose up -d --build backend frontend bot
docker-compose exec backend npx prisma migrate deploy
```

### Мониторинг
```bash
docker-compose logs -f backend    # логи API
docker-compose logs -f bot        # логи бота
curl https://chesscoin.app/health # статус: версия, фаза, эмиссия
```

---

## Типичные задачи

### Добавить новый REST-маршрут
1. Создать файл `backend/src/routes/myroute.ts`
2. Зарегистрировать в `backend/src/index.ts`: `app.use(\`${API}/myroute\`, myRouter)`
3. Добавить тип в `frontend/src/api/index.ts`

### Добавить поле в БД
1. Изменить `backend/prisma/schema.prisma`
2. `npm run migrate:dev` (dev) или создать файл в `migrations/` (prod)
3. `npm run generate`
4. Обновить TypeScript типы на фронтенде в `frontend/src/types/index.ts`

### Изменить экономику
Все параметры настраиваются через `.env` без перекомпиляции (см. `backend/src/config.ts`).
Операции с балансом — **только** через `updateBalance()` из `services/economy.ts`.

### Добавить новое Socket.io событие
1. Добавить обработчик в `backend/src/services/game/socket.ts` внутри `io.on('connection', ...)`
2. Добавить emit/on в `frontend/src/api/socket.ts`
3. Обработать в `frontend/src/hooks/useSocket.ts`
