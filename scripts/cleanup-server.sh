#!/bin/bash
# ──────────────────────────────────────────────────────────────
# ChessCoin — Очистка сервера перед чистой установкой
# Удаляет: Docker volumes, старые images, logs, temp files
# ВНИМАНИЕ: удаляет все данные БД! Только для чистой установки.
# ──────────────────────────────────────────────────────────────

set -e

echo "⚠️  ВНИМАНИЕ: Это полностью очистит сервер!"
echo "    Будут удалены: Docker volumes, images, контейнеры"
echo "    База данных будет УДАЛЕНА"
echo ""
read -p "Продолжить? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Отменено."
    exit 0
fi

echo ""
echo "🧹 Начинаем очистку..."

# Останавливаем контейнеры
if [ -f /opt/chesscoin/docker-compose.yml ]; then
    echo "Stopping containers..."
    cd /opt/chesscoin && docker compose down --volumes 2>/dev/null || true
fi

# Удаляем все Docker volumes (БД, Redis)
echo "Removing Docker volumes..."
docker volume prune -f

# Удаляем старые images
echo "Removing old Docker images..."
docker image prune -af

# Удаляем dangling builds
docker buildx prune -f 2>/dev/null || true

# Очищаем системные логи Docker
echo "Cleaning Docker logs..."
find /var/lib/docker/containers -name "*.log" -exec truncate -s 0 {} \; 2>/dev/null || true

# Очищаем apt cache
echo "Cleaning apt cache..."
apt-get clean
apt-get autoremove -y 2>/dev/null || true

# Очищаем старые логи системы
echo "Cleaning system logs..."
journalctl --vacuum-time=7d 2>/dev/null || true
find /var/log -name "*.gz" -delete 2>/dev/null || true

# Temp files
rm -rf /tmp/* 2>/dev/null || true

echo ""
echo "📊 Disk usage after cleanup:"
df -h /

echo ""
echo "✅ Очистка завершена!"
echo ""
echo "Следующий шаг — чистая установка:"
echo "  cd /opt/chesscoin"
echo "  git pull origin main"
echo "  cp backend/.env.example backend/.env"
echo "  nano backend/.env  # заполнить секреты"
echo "  docker compose up -d --build"
echo "  docker compose exec backend npx prisma migrate deploy"
echo "  docker compose exec backend npx tsx prisma/seed.ts"
