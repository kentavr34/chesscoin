#!/bin/bash
# ──────────────────────────────────────────────────────────────
# ChessCoin — Резервное копирование PostgreSQL → S3
# M4: Запускается ежедневно в 03:00 UTC
#
# Установка cron на сервере:
#   crontab -e
#   0 3 * * * /opt/chesscoin/scripts/backup-db.sh >> /var/log/chesscoin-backup.log 2>&1
#
# Зависимости:
#   apt install postgresql-client awscli -y
#   aws configure  (или использовать env переменные)
# ──────────────────────────────────────────────────────────────

set -e

# ─── Конфиг ──────────────────────────────────────────────────
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
BACKUP_FILE="/tmp/chesscoin_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30   # хранить последние 30 дней

# Из .env файла проекта
PROJECT_DIR="/opt/chesscoin"
source "${PROJECT_DIR}/backend/.env" 2>/dev/null || true

# S3 настройки
S3_BUCKET="${S3_BUCKET:-chesscoin-backups}"
S3_ENDPOINT="${S3_ENDPOINT:-https://s3.timeweb.cloud}"
S3_PREFIX="db-backups"

# ─── Дамп БД ─────────────────────────────────────────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup..."

# Запускаем pg_dump внутри docker контейнера
docker compose -f "${PROJECT_DIR}/docker-compose.yml" exec -T postgres \
  pg_dump -U chesscoin chesscoin | gzip > "${BACKUP_FILE}"

BACKUP_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Dump created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ─── Загрузка на S3 ──────────────────────────────────────────
S3_PATH="s3://${S3_BUCKET}/${S3_PREFIX}/chesscoin_backup_${TIMESTAMP}.sql.gz"

AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY}" \
AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}" \
aws s3 cp "${BACKUP_FILE}" "${S3_PATH}" \
  --endpoint-url "${S3_ENDPOINT}" \
  --quiet

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Uploaded to ${S3_PATH}"

# ─── Удаляем локальный файл ───────────────────────────────────
rm -f "${BACKUP_FILE}"

# ─── Удаляем старые бэкапы на S3 (старше 30 дней) ────────────
CUTOFF=$(date -d "${RETENTION_DAYS} days ago" '+%Y-%m-%d')

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning backups older than ${CUTOFF}..."

AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY}" \
AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}" \
aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" \
  --endpoint-url "${S3_ENDPOINT}" | \
  awk '{print $4}' | \
  while read -r file; do
    FILE_DATE=$(echo "$file" | grep -oP '\d{4}-\d{2}-\d{2}' | head -1)
    if [[ ! -z "$FILE_DATE" ]] && [[ "$FILE_DATE" < "$CUTOFF" ]]; then
      AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY}" \
      AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}" \
      aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/${file}" \
        --endpoint-url "${S3_ENDPOINT}" --quiet
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deleted old backup: ${file}"
    fi
  done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Backup completed successfully"

# ─── Восстановление (для справки) ────────────────────────────
# aws s3 cp s3://${S3_BUCKET}/${S3_PREFIX}/chesscoin_backup_YYYY-MM-DD_HH-MM-SS.sql.gz /tmp/restore.sql.gz --endpoint-url ${S3_ENDPOINT}
# gunzip /tmp/restore.sql.gz
# docker compose exec -T postgres psql -U chesscoin chesscoin < /tmp/restore.sql
