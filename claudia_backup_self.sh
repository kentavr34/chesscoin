#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
# claudia_backup_self.sh — Автономный бэкап Клаудии на Google Drive
#
# Что бэкапит (только Клаудию, компактно ~10-20 MB):
#   • Код: /root/claudia/*.py, *.sh, *.md, bot/, systemd/
#   • Память: CLAUDIA_*.md, BIBLE.md, PROJECT.json, services.json
#   • Vault: /root/claudia/vault/ — зашифрованный архив ключей
#   • Dumps: таблицы claudia.conversations, media_files
#   • LightRAG: kv_store_*.json, graph_chunk_entity_relation.graphml
#
# Что НЕ бэкапит (есть в общем chesscoin-backup):
#   • venv/, __pycache__/, *.pyc, *.wav, *.mp3, logs/*.log
#   • /opt/chesscoin/, /etc/letsencrypt/
#
# Куда: gdrive:claudia_backups/claudia_YYYY-MM-DD_HH-MM.tar.gz
# Ротация: оставляем 14 последних (= 7 дней × 2 бэкапа в сутки)
#
# Запуск: systemd timer claudia-backup.timer (каждые 12 часов)
# ════════════════════════════════════════════════════════════════════════

set -euo pipefail

BACKUP_DIR="/tmp/claudia_backup"
DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_NAME="claudia_${DATE}"
LOG="/root/claudia/logs/backup_self.log"
GDRIVE_DIR="gdrive:claudia_backups"

# Логирование и в файл, и в journalctl
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"
}

log "═══ Автономный бэкап Клаудии ═══"
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

# ── 1. Код и данные Клаудии ──────────────────────────────────────────────
log "[1/4] Код и данные /root/claudia/ ..."
rsync -a \
    --exclude='venv/' \
    --exclude='__pycache__/' \
    --exclude='*.pyc' \
    --exclude='*.pyo' \
    --exclude='logs/*.log' \
    --exclude='logs/*.log.*' \
    --exclude='*.wav' \
    --exclude='*.mp3' \
    --exclude='*.bak.*' \
    --exclude='silero_test*' \
    --exclude='.backups/' \
    /root/claudia/ "$BACKUP_DIR/$BACKUP_NAME/claudia/"

# ── 2. PostgreSQL: таблицы Клаудии (conversations + media_files) ────────
log "[2/4] PostgreSQL дампы ..."
mkdir -p "$BACKUP_DIR/$BACKUP_NAME/postgres"
if PGPASSWORD="${POSTGRES_PASSWORD:-Claudia2026!}" pg_dump -h localhost -U "${POSTGRES_USER:-claudia}" -d "${POSTGRES_DB:-claudia}" \
    -t conversations -t media_files -t tasks 2>/dev/null > "$BACKUP_DIR/$BACKUP_NAME/postgres/claudia_data.sql"; then
    SIZE=$(du -h "$BACKUP_DIR/$BACKUP_NAME/postgres/claudia_data.sql" | cut -f1)
    log "  ✓ conversations + media_files + tasks ($SIZE)"
else
    log "  ⚠ PostgreSQL дамп failed (некритично — полный бэкап сервера всё равно делается в 03:00)"
fi

# ── 3. LightRAG граф знаний (только персональная Клаудия) ───────────────
log "[3/4] LightRAG граф знаний ..."
if [ -d /root/lightrag_data ]; then
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME/lightrag_data"
    rsync -a \
        --exclude='kv_store_llm_response_cache.json' \
        /root/lightrag_data/ "$BACKUP_DIR/$BACKUP_NAME/lightrag_data/"
    SIZE=$(du -sh "$BACKUP_DIR/$BACKUP_NAME/lightrag_data/" | cut -f1)
    log "  ✓ LightRAG данные ($SIZE)"
fi

# ── 4. Архивируем + загружаем ────────────────────────────────────────────
log "[4/4] Архивация и загрузка ..."
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME/"
SIZE=$(du -sh "${BACKUP_NAME}.tar.gz" | cut -f1)
log "Размер: $SIZE"
rm -rf "$BACKUP_NAME/"

# Загрузка на Google Drive
if rclone copy "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" "$GDRIVE_DIR" 2>>"$LOG"; then
    log "✓ Загружено: $GDRIVE_DIR/${BACKUP_NAME}.tar.gz ($SIZE)"
else
    log "✗ Ошибка загрузки на Google Drive"
    exit 1
fi

# ── Ротация: оставляем 14 последних ───────────────────────────────────────
log "Ротация (оставляю 14 копий) ..."
rclone ls "$GDRIVE_DIR" 2>/dev/null | sort -k2 | head -n -14 | awk '{for(i=2;i<=NF;i++)printf "%s ", $i; print ""}' | while IFS= read -r f; do
    f=$(echo "$f" | sed 's/ *$//')
    [ -z "$f" ] && continue
    rclone deletefile "$GDRIVE_DIR/$f" 2>/dev/null && log "  удалён: $f" || true
done

# ── Чистим tmp ─────────────────────────────────────────────────────────────
rm -f "$BACKUP_DIR/${BACKUP_NAME}.tar.gz"
rmdir "$BACKUP_DIR" 2>/dev/null || true

log "═══ Бэкап завершён ═══"
