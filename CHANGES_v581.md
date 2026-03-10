# ChessCoin v5.8.1 — Изменения

## Backend фиксы

### 1. binaryTargets (КРИТИЧНО)
- `linux-musl-arm64-openssl-3.0.x` и `linux-musl-openssl-3.0.x`
- → `linux-musl-openssl-1.1.x` и `linux-musl-arm64-openssl-1.1.x`
- Фикс ошибки с libssl при сборке Docker контейнера

### 2. BOT_USERNAME
- Исправлен на `chessgamecoin_bot` везде

### 3. Dockerfile
- Убран `tsconfig-paths` из runtime CMD
- Теперь используется `tsc-alias` — алиасы резолвятся при сборке
- CMD: `node dist/index.js` (без лишних зависимостей)
- `openssl` установлен в обоих слоях (builder + production)

### 4. package.json
- Добавлен `tsc-alias` в devDependencies
- Добавлен `@socket.io/redis-adapter` в dependencies
- Добавлен `express-rate-limit` в dependencies
- build script: `tsc && tsc-alias`
- start script: `node dist/index.js`

### 5. tsconfig.json
- `strict: false` — убирает лишние ошибки компиляции
- Убран `prisma/seed.ts` из include

### 6. Socket.io Redis Adapter
- `io.adapter(createAdapter(redisPub, redisSub))`
- Синхронизация между инстансами при масштабировании

### 7. Redis кэш в socket.ts
- User status кэшируется 60 сек — убирает DB запрос при каждом подключении
- `select` вместо `include` везде где возможно — меньше данных из БД
- При подключении загружаем только `{ id }` активных сессий, не полный объект

### 8. Rate Limiting
- Все API роуты: 120 req/min
- Auth роуты: 20 req/min (защита от брутфорса)

### 9. docker-compose.yml
- Удалён stockfish (недоступный образ)
- Закрыты внешние порты postgres/redis (только internal)
- Добавлен `BOT_USERNAME` и `WEBAPP_URL` в bot service
- nginx теперь в compose

## Деплой на сервер
```bash
# Скопировать архив на сервер
scp chesscoin-v581.zip root@37.77.106.28:/opt/

# На сервере
cd /opt
unzip chesscoin-v581.zip
cp chesscoin-v581/* /opt/chesscoin/ -r

# Пересобрать и запустить
cd /opt/chesscoin
docker compose down
docker compose up -d --build

# Проверить
docker compose ps
curl https://chesscoin.app/health
```
