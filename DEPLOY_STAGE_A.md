# ChessCoin v5.8.1-A — Деплой этапа A

## Что изменено

1. **Stockfish** — теперь npm пакет внутри backend, не отдельный контейнер
2. **ADMIN_IDS** = 254450353 (@dockenan)
3. **Попытки** — единый серверный cron (00:00, 08:00, 16:00 UTC)
4. **docker-compose** — добавлены networks, ADMIN_IDS, убран stockfish сервис

---

## Шаги деплоя на сервере

### 1. Загрузить архив
```bash
scp chesscoin-v581-A.zip root@37.77.106.28:/opt/
```

### 2. Создать Prisma migration (ОДИН РАЗ, делается локально или на сервере)
```bash
cd /opt/chesscoin/backend

# Если первый раз (нет папки migrations)
npx prisma migrate dev --name init

# Если уже есть данные в БД
npx prisma db push
```

### 3. Перезапустить контейнеры
```bash
cd /opt/chesscoin
docker compose down
docker compose up -d --build
```

### 4. Проверка
```bash
# Статус
docker compose ps

# Логи backend (смотрим что Stockfish запустился)
docker compose logs -f backend | grep -i "stockfish\|cron\|server"

# Health check
curl https://chesscoin.app/health

# Проверить J.A.R.V.I.S — открыть Mini App, начать игру с ботом
# В логах должно появиться: [Stockfish] bestmove ←
```

### 5. Если нужно пересоздать базу данных
```bash
# Бэкап сделан: /root/backup_20260308_1840.sql (9.2MB)
# Для восстановления:
docker compose exec postgres psql -U chesscoin chesscoin < /root/backup_20260308_1840.sql
```

---

## Важные переменные .env на сервере

Убедись что в /opt/chesscoin/.env есть:
```
DOMAIN=chesscoin.app
POSTGRES_PASSWORD=X00CgFQ_GZoVEZs_lkAOkG9N0m6NJiqS
REDIS_PASSWORD=uhfVmcpf9Do3D6F7ZpyI
BOT_TOKEN=8741660434:AAHVDqkXMUWQ8tbMSjjifvduuoCGK_l7RGU
BOT_API_SECRET=BotSecret_Ch3ss_Internal_2024
JWT_ACCESS_SECRET=a9f2c8e1d4b7a3f6...
JWT_REFRESH_SECRET=b8e1d4c7a0f3b6...
ADMIN_IDS=254450353
S3_ENDPOINT=https://s3.twcstorage.ru
S3_BUCKET=799d3c02-99e72b95-3b78-492f-af40-bfc39c0f8bb7
S3_ACCESS_KEY=GBZQW3Q2QMSLFBY6IXOH
S3_SECRET_ACCESS_KEY=IDo7bC66zeCTEMDgaTd8AMBiAD6CqGnakAz1Pv8z
```
