#!/bin/bash
# ──────────────────────────────────────────────────────────────
# ChessCoin — первоначальная настройка VPS (Ubuntu 22.04)
# Запускать один раз от root
# ──────────────────────────────────────────────────────────────

set -e

echo "🔧 Setting up ChessCoin server..."

# Обновляем систему
apt update && apt upgrade -y

# Docker
if ! command -v docker &> /dev/null; then
  echo "📦 Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker $SUDO_USER
fi

# Docker Compose plugin
apt install docker-compose-plugin -y

# Certbot
apt install certbot -y

# Создаём директорию для проекта
mkdir -p /opt/chesscoin
mkdir -p /var/www/certbot

echo ""
echo "✅ Server setup complete!"
echo ""
echo "Следующие шаги:"
echo "1. git clone https://github.com/kentavr34/chesscoin.git /opt/chesscoin"
echo "2. certbot certonly --standalone -d chesscoin.app -d www.chesscoin.app"
echo "3. cp /opt/chesscoin/backend/.env.example /opt/chesscoin/backend/.env"
echo "4. nano /opt/chesscoin/backend/.env  # заполнить секреты"
echo "5. cd /opt/chesscoin && docker compose up -d --build"
echo "6. docker compose exec backend npx prisma migrate deploy"
echo "7. docker compose exec backend npx tsx prisma/seed.ts"
