#!/bin/bash
# ──────────────────────────────────────────────────────────────
# ChessCoin — Полная очистка сервера и чистая установка
# Запускать когда нужна свежая установка без старых данных
# ──────────────────────────────────────────────────────────────

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ChessCoin — Чистая установка"
echo "  ⚠️  ВСЕ ДАННЫЕ БУДУТ УДАЛЕНЫ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -p "Вы уверены? Введите YES для продолжения: " CONFIRM
if [ "$CONFIRM" != "YES" ]; then echo "Отменено."; exit 0; fi

PROJECT_DIR="/opt/chesscoin"
cd $PROJECT_DIR

# ─── 1. Останавливаем всё ─────────────────────────────────────
echo "🛑 Stopping all containers..."
docker compose down --volumes --remove-orphans 2>/dev/null || true

# ─── 2. Удаляем Docker мусор ──────────────────────────────────
echo "🧹 Cleaning Docker..."
docker system prune -af --volumes 2>/dev/null || true
docker volume prune -f 2>/dev/null || true
docker network prune -f 2>/dev/null || true

# ─── 3. Удаляем старые образы ─────────────────────────────────
echo "🗑️  Removing old images..."
docker images | grep chesscoin | awk '{print $3}' | xargs docker rmi -f 2>/dev/null || true

# ─── 4. Очищаем системный мусор ───────────────────────────────
echo "🧹 System cleanup..."
apt autoremove -y 2>/dev/null || true
apt autoclean -y 2>/dev/null || true

# Очищаем журналы systemd (оставляем последние 100MB)
journalctl --vacuum-size=100M 2>/dev/null || true

# Очищаем старые логи Docker
find /var/lib/docker/containers -name "*.log" -exec truncate -s 0 {} \; 2>/dev/null || true

# ─── 5. Дисковое пространство до/после ───────────────────────
echo "💾 Disk usage after cleanup:"
df -h / | tail -1
du -sh /var/lib/docker/ 2>/dev/null || echo "Docker dir not found"

# ─── 6. Получаем свежий код ───────────────────────────────────
echo "📥 Fresh git pull..."
git fetch origin
git reset --hard origin/main
git clean -fd

# ─── 7. Настройка env ─────────────────────────────────────────
if [ ! -f "$PROJECT_DIR/backend/.env" ]; then
  cp backend/.env.example backend/.env
  echo ""
  echo "⚠️  Заполни backend/.env перед запуском!"
  echo "   nano $PROJECT_DIR/backend/.env"
  exit 1
fi

# ─── 8. Запуск ────────────────────────────────────────────────
echo "🚀 Building and starting..."
docker compose up -d --build

echo "⏳ Waiting for services (30s)..."
sleep 30

echo "🗄️  Running migrations..."
docker compose exec -T backend npx prisma migrate deploy

echo "🌱 Seeding database..."
docker compose exec -T backend npx tsx prisma/seed.ts

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Clean install complete!"
df -h / | tail -1
docker compose ps
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
