#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
# claudia_vault_backup.sh — Шифрованный бэкап архива ключей Клаудии
#
# Собирает:
#   • /root/claudia/.env              (все API ключи)
#   • /root/claudia/gdrive_service_account.json
#   • /root/.config/rclone/rclone.conf
#   • /root/claudia/vault/INVENTORY.md
#
# Шифрует GPG симметрично через passphrase из /root/.claudia_vault_passphrase.
# Загружает на gdrive:claudia_vault/vault_YYYY-MM-DD_HH-MM.tar.gz.enc
# Ротация: 14 копий.
#
# Запуск: systemd claudia-vault-backup.timer (каждые 12ч)
# ════════════════════════════════════════════════════════════════════════

set -euo pipefail

PASSPHRASE_FILE="/root/.claudia_vault_passphrase"
BACKUP_DIR="/tmp/claudia_vault_backup"
DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_NAME="vault_${DATE}"
LOG="/root/claudia/logs/vault_backup.log"
GDRIVE_DIR="gdrive:claudia_vault"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"; }

# ── Проверка passphrase ──────────────────────────────────────────────────
if [ ! -f "$PASSPHRASE_FILE" ]; then
    log "❌ Passphrase файл не найден: $PASSPHRASE_FILE"
    log "   Создайте: echo 'your_strong_password' > $PASSPHRASE_FILE && chmod 600 $PASSPHRASE_FILE"
    exit 1
fi

PASSPHRASE=$(cat "$PASSPHRASE_FILE")
if [ -z "$PASSPHRASE" ] || [ ${#PASSPHRASE} -lt 16 ]; then
    log "❌ Passphrase слишком короткий (нужно минимум 16 символов)"
    exit 1
fi

log "═══ Шифрованный бэкап vault ═══"
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

# ── Собираем чувствительные данные ───────────────────────────────────────
log "Собираю файлы..."
cp /root/claudia/.env                       "$BACKUP_DIR/$BACKUP_NAME/env" 2>/dev/null || true
cp /root/claudia/gdrive_service_account.json "$BACKUP_DIR/$BACKUP_NAME/" 2>/dev/null || true
cp /root/.config/rclone/rclone.conf          "$BACKUP_DIR/$BACKUP_NAME/rclone.conf" 2>/dev/null || true

# Vault целиком (может содержать дополнительные ключи)
if [ -d /root/claudia/vault ]; then
    cp -r /root/claudia/vault "$BACKUP_DIR/$BACKUP_NAME/vault"
fi

# Hostname+timestamp для идентификации
echo "Hostname: $(hostname)"            > "$BACKUP_DIR/$BACKUP_NAME/META.txt"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$BACKUP_DIR/$BACKUP_NAME/META.txt"
echo "Server: 185.203.116.131"         >> "$BACKUP_DIR/$BACKUP_NAME/META.txt"

# ── Архивируем + шифруем ─────────────────────────────────────────────────
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME/"
chmod 600 "${BACKUP_NAME}.tar.gz"
rm -rf "$BACKUP_NAME/"

log "Шифрую GPG (AES256)..."
echo "$PASSPHRASE" | gpg --batch --yes --passphrase-fd 0 \
    --symmetric --cipher-algo AES256 \
    --output "${BACKUP_NAME}.tar.gz.enc" \
    "${BACKUP_NAME}.tar.gz"

rm -f "${BACKUP_NAME}.tar.gz"
SIZE=$(du -h "${BACKUP_NAME}.tar.gz.enc" | cut -f1)
log "Шифрованный размер: $SIZE"

# ── Загружаем на GDrive ──────────────────────────────────────────────────
log "Загружаю на Google Drive..."
if rclone copy "$BACKUP_DIR/${BACKUP_NAME}.tar.gz.enc" "$GDRIVE_DIR" 2>>"$LOG"; then
    log "✓ Загружено: $GDRIVE_DIR/${BACKUP_NAME}.tar.gz.enc ($SIZE)"
else
    log "✗ Ошибка загрузки"
    exit 1
fi

# ── Ротация 14 копий ─────────────────────────────────────────────────────
rclone ls "$GDRIVE_DIR" 2>/dev/null | sort -k2 | head -n -14 | awk '{for(i=2;i<=NF;i++)printf "%s ", $i; print ""}' | while IFS= read -r f; do
    f=$(echo "$f" | sed 's/ *$//')
    [ -z "$f" ] && continue
    rclone deletefile "$GDRIVE_DIR/$f" 2>/dev/null && log "  удалён: $f" || true
done

rm -f "$BACKUP_DIR/${BACKUP_NAME}.tar.gz.enc"
rmdir "$BACKUP_DIR" 2>/dev/null || true

log "═══ Vault бэкап завершён ═══"
