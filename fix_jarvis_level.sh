#!/usr/bin/env bash

set -euo pipefail

# ------------------------------------------------------------
# 1. Install npm (nodejs) inside the backend container if missing
# ------------------------------------------------------------
echo "Installing npm inside backend container (if needed)..."
if ! docker exec chesscoin_backend which npm > /dev/null 2>&1; then
  # Detect package manager (Alpine uses apk, Debian/Ubuntu uses apt)
  if docker exec chesscoin_backend which apk > /dev/null 2>&1; then
    echo "Alpine detected – using apk"
    docker exec chesscoin_backend apk add --no-cache nodejs npm
  elif docker exec chesscoin_backend which apt-get > /dev/null 2>&1; then
    echo "Debian/Ubuntu detected – using apt-get"
    docker exec chesscoin_backend apt-get update && docker exec chesscoin_backend apt-get install -y npm
  else
    echo "Cannot determine package manager inside backend container. Install npm manually and re‑run this script."
    exit 1
  fi
else
  echo "npm already installed."
fi

# ------------------------------------------------------------
# 2. Create migration that adds jarvisLevel column
# ------------------------------------------------------------
MIGRATION_DIR="c:/Users/SAM/Desktop/chesscoin/backend/prisma/migrations/20260322_add_jarvis_level"
echo "Creating migration directory $MIGRATION_DIR"
mkdir -p "$MIGRATION_DIR"
cat > "$MIGRATION_DIR/migration.sql" <<'EOF'
-- 20260322_add_jarvis_level: добавляем поле jarvisLevel в таблицу User
DO $$ BEGIN
  ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "jarvisLevel" INTEGER NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN
  -- колонка уже существует – ничего не делаем
END $$;
EOF

# ------------------------------------------------------------
# 3. Apply all pending migrations using a temporary container
# ------------------------------------------------------------
echo "Applying migrations..."
docker run --rm \
  --network chesscoin_app-network \
  -e 'DATABASE_URL=postgresql://chesscoin:Ch3ss_Pr0d_2024!xQ@postgres:5432/chesscoin' \
  chesscoin-backend \
  npx prisma migrate deploy

# ------------------------------------------------------------
# 4. Restart backend (and bot) so they pick up the new schema
# ------------------------------------------------------------
echo "Restarting backend and bot containers..."
# Force‑recreate ensures the containers are rebuilt with the latest code
docker compose up -d --force-recreate backend bot

# ------------------------------------------------------------
# 5. Show final status
# ------------------------------------------------------------
echo "--- Container status ---"
docker ps -a

echo "--- Backend logs (last 20 lines) ---"
docker logs chesscoin_backend --tail 20

echo "Done. The 'jarvisLevel' column should now exist and the backend should be healthy."
