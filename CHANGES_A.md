# ChessCoin v5.8.1-A — Этап A: Критические исправления

## 1. Stockfish — встроен как npm пакет ✅
**Проблема:** отдельный Stockfish контейнер недоступен — J.A.R.V.I.S не делал ход.
**Решение:** `npm install stockfish` — WebAssembly движок работает внутри Node.js.
- Нет отдельного контейнера, нет сетевых запросов
- Уровни 1-20 → глубина поиска 1-20
- Таймаут 8 сек → fallback на случайный ход
- Логи: `[Stockfish] bestmove ← e2e4 (depth=5)`

**Изменённые файлы:**
- `backend/src/services/game/socket.ts` — заменена функция `getStockfishMove`
- `backend/package.json` — добавлен `"stockfish": "^16.0.0"`
- `docker-compose.yml` — удалён stockfish сервис, убран STOCKFISH_URL

## 2. ADMIN_IDS = 254450353 ✅
**Изменённые файлы:**
- `backend/.env` — `ADMIN_IDS=254450353`
- `docker-compose.yml` — `ADMIN_IDS: ${ADMIN_IDS:-254450353}`

## 3. Попытки — единый серверный cron ✅
**Проблема:** восстановление было привязано к времени входа каждого игрока.
**Решение:** глобальный cron в 00:00, 08:00, 16:00 UTC — +1 попытка всем у кого < 3.

**Логика:**
- Максимум: 3 попытки (не 6)
- Покупка: только до максимума (1000 ᚙ за штуку)
- Восстановление: сервер сам раздаёт, игрок не может влиять
- Таймер до следующего восстановления — через GET /api/v1/attempts

**Изменённые файлы:**
- `backend/src/services/attempts.ts` — полная переработка
- `backend/src/routes/attempts.ts` — добавлен GET /, обновлён POST /purchase
- `backend/src/config.ts` — `maxPurchasedAttempts: 0`
- `backend/.env` — `MAX_PURCHASED_ATTEMPTS=0`

## 4. docker-compose — сети ✅
- Добавлены `networks: app-network` для всех сервисов
- Явная сеть `bridge` для изоляции контейнеров
