#!/bin/bash
# ──────────────────────────────────────────────────────────────
# ChessCoin — быстрый деплой на сервере
# Использование: ./scripts/deploy.sh [--no-build] [--migrate-only]
# ──────────────────────────────────────────────────────────────

set -e

SKIP_BUILD=false
MIGRATE_ONLY=false

for arg in "$@"; do
  case $arg in
    --no-build)    SKIP_BUILD=true ;;
    --migrate-only) MIGRATE_ONLY=true ;;
  esac
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ChessCoin Deploy — $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Проверяем что мы в правильной директории
if [ ! -f "docker-compose.yml" ]; then
  echo "❌ Запускай из корня проекта: /opt/chesscoin"
  exit 1
fi

# Только миграции (быстро, без пересборки)
if [ "$MIGRATE_ONLY" = true ]; then
  echo "🗄️  Применяем миграции..."
  docker compose exec -T backend npx prisma migrate deploy
  echo "✅ Миграции применены"
  exit 0
fi

# Обновляем код
echo "📥 Git pull..."
git pull origin main

if [ "$SKIP_BUILD" = false ]; then
  # Пересобираем контейнеры
  echo "🐳 Docker compose build..."
  docker compose build --parallel
fi

# Перезапускаем
echo "🔄 Restart services..."
docker compose up -d --remove-orphans

# Ждём backend
echo "⏳ Waiting for backend (15s)..."
sleep 15

# Миграции
echo "🗄️  Prisma migrate deploy..."
docker compose exec -T backend npx prisma migrate deploy

# Health check
echo "❤️  Health check..."
MAX_TRIES=12
for i in $(seq 1 $MAX_TRIES); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "✅ Health OK (attempt $i)"
    break
  fi
  echo "   Attempt $i/$MAX_TRIES: HTTP $STATUS..."
  sleep 5
  if [ $i -eq $MAX_TRIES ]; then
    echo "❌ Health check failed! Logs:"
    docker compose logs backend --tail=40
    exit 1
  fi
done

# Статус
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker compose ps
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deploy completed!"
