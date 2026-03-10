# ChessCoin v5 — Контекст для продолжения разработки

## Читай это первым делом
Это файл для Claude в новом чате. Здесь всё что уже сделано и что нужно сделать дальше.
Проект называется ChessCoin — шахматная мини-игра в Telegram с внутренней валютой, батлами и экономикой.

---

## Стек технологий

- **Backend**: Node.js + TypeScript + Express + Socket.io + Prisma + PostgreSQL + Redis
- **Frontend**: React + Vite + TypeScript + Zustand + react-chessboard + socket.io-client
- **Bot**: Python + aiogram (ещё не написан)
- **Инфраструктура**: Docker Compose (5 контейнеров), nginx (ещё не написан)
- **Деплой**: TimeWeb VPS (IP и домен пока не предоставлены владельцем)

---

## Структура проекта (уже создана)

```
chesscoin-v5/
├── backend/
│   ├── prisma/schema.prisma          ✅ ГОТОВО
│   ├── src/
│   │   ├── index.ts                  ✅ ГОТОВО
│   │   ├── config.ts                 ✅ ГОТОВО
│   │   ├── lib/prisma.ts             ✅ ГОТОВО
│   │   ├── lib/redis.ts              ✅ ГОТОВО
│   │   ├── middleware/auth.ts        ✅ ГОТОВО
│   │   ├── routes/auth.ts            ✅ ГОТОВО
│   │   ├── routes/leaderboard.ts     ✅ ГОТОВО
│   │   ├── routes/profile.ts         ✅ ГОТОВО
│   │   ├── routes/attempts.ts        ✅ ГОТОВО
│   │   ├── services/economy.ts       ✅ ГОТОВО
│   │   ├── services/attempts.ts      ✅ ГОТОВО
│   │   ├── services/auth.ts          ✅ ГОТОВО
│   │   ├── services/game/session.ts  ✅ ГОТОВО
│   │   ├── services/game/finish.ts   ✅ ГОТОВО
│   │   ├── services/game/socket.ts   ✅ ГОТОВО
│   │   ├── services/game/timer.ts    ✅ ГОТОВО
│   │   ├── services/game/format.ts   ✅ ГОТОВО
│   │   └── utils/gradient.ts         ✅ ГОТОВО
│   ├── package.json                  ✅ ГОТОВО
│   ├── tsconfig.json                 ✅ ГОТОВО
│   └── .env.example                  ✅ ГОТОВО
│
├── frontend/
│   ├── src/
│   │   ├── screens/Home.tsx          ✅ ГОТОВО
│   │   ├── screens/Battles.tsx       ✅ ГОТОВО
│   │   ├── screens/Game.tsx          ✅ ГОТОВО
│   │   ├── screens/Rating.tsx        ✅ ГОТОВО
│   │   ├── screens/Profile.tsx       ✅ ГОТОВО
│   │   ├── screens/Nations.tsx       ✅ заглушка (нужна полная реализация)
│   │   ├── screens/Splash.tsx        ✅ ГОТОВО
│   │   ├── components/Avatar.tsx     ✅ ГОТОВО
│   │   ├── components/Layout.tsx     ✅ ГОТОВО
│   │   ├── store/index.ts            ✅ ГОТОВО
│   │   ├── api/client.ts             ✅ ГОТОВО
│   │   ├── api/socket.ts             ✅ ГОТОВО
│   │   ├── App.tsx                   ✅ ГОТОВО
│   │   ├── main.tsx                  ✅ ГОТОВО
│   │   └── styles/global.css         ✅ ГОТОВО
│   ├── index.html                    ✅ ГОТОВО
│   ├── package.json                  ✅ ГОТОВО
│   ├── vite.config.ts                ✅ ГОТОВО
│   └── tsconfig.json                 ✅ ГОТОВО
│
├── bot/                              ❌ НЕ НАПИСАН (Python/aiogram)
├── docker-compose.yml                ✅ ГОТОВО (без Dockerfile'ов)
└── .env.example                      ✅ ГОТОВО
```

---

## Что НЕ сделано (приоритет по порядку)

### 1. Dockerfile'ы (HIGH)
Нужны три файла:
- `backend/Dockerfile` — Node.js 20 alpine, npm ci, prisma generate, build
- `frontend/Dockerfile` — multi-stage: node build + nginx serve
- `bot/Dockerfile` — Python 3.11 alpine, pip install

### 2. nginx конфиг (HIGH)
Файл `nginx/nginx.conf`:
- SSL через certbot / Let's Encrypt
- Проксирование `/api/*` и `/socket.io/*` → backend:3000
- Статика фронтенда → frontend:80
- WebSocket upgrade

### 3. Python Telegram бот (HIGH)
Файлы в `bot/`:
- `main.py` — aiogram 3.x, polling
- `handlers/start.py` — /start с реферальным параметром `?start=ref_TELEGRAMID`, кнопка "Играть" открывает Mini App
- `handlers/admin.py` — рассылки, статистика (только для ADMIN_IDS)
- `services/backend.py` — HTTP клиент к бэкенду (Bearer token = BOT_API_SECRET)
- `requirements.txt`

Бот должен:
- При /start → показать кнопку "♟ Играть в ChessCoin" (WebApp кнопка)
- Принимать реферальный параметр и передавать в Mini App через startParam
- Уведомлять пользователей (через backend bot API) о: начале батла, победе, рефералах

### 4. GitHub Actions CI/CD (MEDIUM)
Файл `.github/workflows/deploy.yml`:
- Триггер: push в main
- SSH на VPS → git pull → docker-compose up -d --build
- Secrets: VPS_HOST, VPS_USER, VPS_SSH_KEY

### 5. Backend — недостающие роуты (MEDIUM)

**Задания (tasks):**
- `GET /api/v1/tasks` — список заданий
- `POST /api/v1/tasks/complete` — отметить выполненным

**Магазин (shop):**
- `GET /api/v1/shop/items?type=AVATAR_FRAME` — список предметов
- `POST /api/v1/shop/purchase` — купить предмет
- `POST /api/v1/shop/equip` — надеть предмет

**Bot API (для Python бота):**
- `POST /api/v1/bot/notify` — отправить уведомление пользователю (middleware: BOT_API_SECRET)
- `GET /api/v1/bot/stats` — статистика для администратора

### 6. Frontend — недостающие экраны (MEDIUM)

**Nations.tsx** — полный экран сборных:
- Список стран с флагами, ELO, количеством участников
- Кнопка "Вступить в сборную"
- Экран активной войны (текущий счёт, round X/5)

**Магазин** — новый экран Shop.tsx:
- Рамки профиля (AVATAR_FRAME)
- Скины доски (BOARD_SKIN)
- Стили фигур (PIECE_SKIN)
- Анимации ходов (MOVE_ANIMATION)

**Задания** — компонент на Home.tsx или отдельный экран:
- Список заданий с иконками
- Прогресс выполнения
- Кнопка "Выполнить" (открывает ссылку / проверяет подписку)

### 7. Seed данные (LOW)
Файл `backend/prisma/seed.ts`:
- Создать предметы в магазине (рамки, скины)
- Создать тестовые задания
- Создать сборные по странам (RU, BR, DE, IN, US, CN и др.)
- Создать бота J.A.R.V.I.S (telegramId: "0")

---

## Важные детали проекта

### BOT_TOKEN
`8741660434:AAHVDqkXMUWQ8tbMSjjifvduuoCGK_l7RGU`
(Уже в backend/.env)

### Дизайн система (фронтенд)
Тёмная тема Telegram:
- `--bg: #0B0D11` — основной фон
- `--bg-2: #13161E` — карточки
- `--gold: #F5C842` — акцент (кнопки, активные элементы)
- `--violet: #7B61FF` — вторичный акцент
- Шрифты: Unbounded (заголовки), Inter (текст), JetBrains Mono (цифры)

### Экономика — три фазы

**Фаза 1** (сейчас, пока totalEmitted < 30 млрд ᚙ):
- Welcome бонус новому пользователю: 5,000 ᚙ
- За съеденную фигуру: пешка 100, конь/слон 300, ладья 500, ферзь 900, король 1000
- Победа над ботом уровня N: N × 1,000 ᚙ
- Реферальный бонус (первая игра реферала): 3,000 ᚙ
- % от выигрыша: 50% (уровень 1) + 10% (уровень 2)

**Фаза 2** (автоматически при 30 млрд):
- Отключается: раздача за фигуры, welcome бонус
- Игра с ботом: победил → берёшь из резерва, проиграл → теряешь
- Рефералы работают вечно

**Фаза 3** (вручную): P2P биржа, вывод на TON

### Попытки (Attempts)
- Базовый максимум: 3
- Восстановление: +1 каждые 8 часов независимо для каждого слота
- Можно купить до +3 дополнительных (итого макс 6) за 1,000 ᚙ каждая
- Каждая игра тратит 1 попытку при старте

### Мультисессии
- До 3 одновременных партий
- Максимум 1 бот-сессия одновременно
- Reconnect автоматический (socket.io комната по sessionId)

### Комиссия батла
10% с банка. Банк = ставка × 2. Победитель получает 90%. Комиссия → platform_reserve.

### ELO
Формула Эло K=32. Меняется только в батлах. Минимум 100.

### Лиги (по балансу)
- Бронза: 0+
- Серебро: 100K+
- Золото: 1M+
- Алмаз: 5M+
- Чемпион: 10M+
- Звезда: 50M+

---

## Инфраструктура (TimeWeb VPS)

Уже есть docker-compose.yml с 5 контейнерами:
1. `chesscoin_postgres` — PostgreSQL 16
2. `chesscoin_redis` — Redis 7
3. `chesscoin_stockfish` — Stockfish для ходов бота
4. `chesscoin_backend` — Node.js API
5. `chesscoin_frontend` — React (nginx static)
6. `chesscoin_bot` — Python бот (в compose есть, Dockerfile нет)

IP и домен от владельца ещё не получены.

---

## Socket.io события (уже реализованы в backend)

**Клиент → Сервер:**
- `game:current` → получить активные сессии
- `game:create:bot` { color, botLevel } → создать игру с ботом
- `game:create:battle` { color, duration, bet } → создать батл
- `game:create:friendly` { color, duration } → дружеская игра
- `game:join` { code } → присоединиться к батлу по коду
- `game:move` { sessionId, from, to, promotion } → сделать ход
- `game:surrender` { sessionId } → сдаться
- `game:cancel` { sessionId } → отменить ожидающий батл
- `game:offer_draw` { sessionId } → предложить ничью
- `game:accept_draw` { sessionId } → принять ничью
- `game:decline_draw` { sessionId } → отклонить ничью
- `battles:subscribe` → подписаться на лобби батлов
- `battles:unsubscribe` → отписаться

**Сервер → Клиент:**
- `game` session → обновление состояния игры
- `game:over` { status, winnerSideId } → конец игры
- `game:started` { sessionId } → соперник присоединился
- `game:draw_offered` { by } → предложение ничьей
- `game:draw_declined` { by } → ничья отклонена
- `battles:list` [...] → список активных батлов

---

## REST API (уже реализованы)

- `POST /api/v1/auth/login` { initData, referrer? }
- `POST /api/v1/auth/refresh` { refreshToken }
- `GET /api/v1/auth/me`
- `GET /api/v1/leaderboard?league=GOLD&limit=50`
- `GET /api/v1/profile/:userId`
- `GET /api/v1/profile/transactions?limit=20&offset=0`
- `GET /api/v1/referrals`
- `POST /api/v1/attempts/purchase`

---

## Продолжение разработки — с чего начать в новом чате

Приоритет:
1. Написать `backend/Dockerfile`, `frontend/Dockerfile`, `bot/Dockerfile`
2. Написать `nginx/nginx.conf`
3. Написать Python Telegram бот (`bot/` папка)
4. Написать `backend/prisma/seed.ts` с данными магазина и заданий
5. Написать роуты для заданий и магазина
6. Написать `Shop.tsx` экран

Когда владелец даст IP и домен — деплоить одной командой:
```bash
git clone <repo> && cd chesscoin-v5
cp .env.example .env && nano .env  # заполнить пароли
docker-compose up -d --build
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run seed
```
