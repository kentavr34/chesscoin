#!/bin/bash
set -e

cd /opt/chesscoin

echo "========================================"
echo "🔍 ChessCoin Production Audit"
echo "========================================"

echo ""
echo "📊 HEALTH CHECK"
echo "----------------------------------------"
curl -s https://chesscoin.app/health | jq . 2>/dev/null || curl -s https://chesscoin.app/health

echo ""
echo "📡 API TEST: Leaderboard"
echo "----------------------------------------"
curl -s https://chesscoin.app/api/v1/leaderboard 2>/dev/null | jq '.users[0:2]' 2>/dev/null || echo "Failed to fetch leaderboard"

echo ""
echo "📦 DOCKER STATUS"
echo "----------------------------------------"
docker compose ps

echo ""
echo "🔴 BACKEND LOGS (последние 30 строк)"
echo "----------------------------------------"
docker compose logs backend --tail=30 || echo "No backend logs"

echo ""
echo "🟡 FRONTEND LOGS (последние 20 строк)"
echo "----------------------------------------"
docker compose logs frontend --tail=20 || echo "No frontend logs"

echo ""
echo "🤖 BOT LOGS (последние 20 строк)"
echo "----------------------------------------"
docker compose logs bot --tail=20 || echo "No bot logs"

echo ""
echo "========================================"
echo "✅ Audit Complete"
echo "========================================"
