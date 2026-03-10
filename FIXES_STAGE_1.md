# ✅ ChessCoin v5 — Этап 1: Исправленные баги

## Что исправлено

### 1. BigInt сериализация (`backend/src/index.ts`)
Добавлен глобальный патч `BigInt.prototype.toJSON` — теперь все BigInt автоматически
сериализуются в строки при JSON.stringify. Ошибка "Do not know how to serialize a BigInt"
больше не возникнет нигде в приложении.

### 2. Лишний импорт `economy` (`backend/src/routes/shop.ts`)
Удалена строка `import { economy } from "../services/economy"` — она вызывала ошибку
компиляции, так как такого именованного экспорта не существует.

### 3. nginx.conf — домен и X-Frame-Options (`nginx/nginx.conf`)
- `${DOMAIN}` заменён на `chesscoin.app` во всём файле (certbot, ssl_certificate и т.д.)
- Убран `X-Frame-Options SAMEORIGIN` — он блокировал встраивание Telegram Mini App

### 4. Реферальная ссылка в боте (`bot/handlers/start.py`)
Исправлена ошибка: теперь передаётся `referrer_id` (ID пригласившего), а не `str(user.id)`
(ID самого нового пользователя). Реферальная цепочка теперь работает корректно.

### 5. Человеческие тексты ошибок (`backend/src/services/game/session.ts`)
Коды `MAX_SESSIONS_REACHED` и `MAX_BOT_SESSIONS_REACHED` заменены на понятные сообщения:
- "Вы уже участвуете в максимальном количестве игр. Завершите одну из текущих."
- "Вы уже играете с ботом. Завершите текущую игру, чтобы начать новую."

### 6. Логирование Stockfish (`backend/src/services/game/socket.ts`)
Добавлены `console.debug` и `console.warn` с деталями запроса и ответа Stockfish.
Теперь в логах видно: уровень бота, FEN, ответный ход или причину fallback на рандом.

### 7. ADMIN_IDS в .env (`backend/.env`)
Добавлена переменная `ADMIN_IDS=123456789`.
⚠️ **Нужно заменить `123456789` на реальный Telegram ID владельца** (узнать через @userinfobot).

---

## Prisma migrations (сделать вручную на сервере)

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

Или на продакшене:
```bash
npx prisma migrate deploy
```

---

## Деплой на сервер

```bash
# Скопировать исправленные файлы на сервер
scp -r chesscoin-fixed/ user@server:/opt/chesscoin/

# Перезапустить контейнеры
docker-compose down
docker-compose up -d --build
```

---

## Проверка после деплоя

```bash
# Проверка API
curl https://chesscoin.app/health

# Проверка бота — запустить /start ref_ТВОЙ_TG_ID
# Убедиться что реферальная ссылка содержит правильный ID пригласившего

# Проверка WebSocket
# Открыть Mini App → начать игру с ботом → убедиться что бот отвечает
# Смотреть логи: docker logs chesscoin-backend | grep Stockfish
```
