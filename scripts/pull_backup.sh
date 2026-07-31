#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# ЗАБРАТЬ СВЕЖИЙ БЭКАП НА ЛОКАЛЬНУЮ МАШИНУ — третье зеркало.
#
# Кенан 31.07.2026: копия должна лежать в трёх местах — Telegram-группа,
# Google Drive и локальный компьютер. Первые два делает
# backup_chesscoin.sh на сервере, этот скрипт закрывает третье.
#
# Запуск с рабочей машины:
#   bash scripts/pull_backup.sh              → в D:/Документы/chesscoin-backups
#   bash scripts/pull_backup.sh /куда/класть
# ═══════════════════════════════════════════════════════════════════════
set -uo pipefail

SERVER="root@45.67.216.36"
KEY="${CHESSCOIN_SSH_KEY:-C:/Users/SAM/.ssh/claude_deploy_key}"
REMOTE_DIR=/opt/chesscoin-backups
DEST="${1:-D:/Документы/chesscoin-backups}"

log() { echo "[$(date '+%F %T')] $*"; }

mkdir -p "$DEST" || { log "не могу создать $DEST"; exit 1; }

log "ищу свежий архив на сервере…"
LATEST=$(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=20 "$SERVER" \
  "ls -1t $REMOTE_DIR/chesscoin_*.tar.gz 2>/dev/null | head -1")

if [ -z "$LATEST" ]; then
  log "на сервере нет ни одного архива в $REMOTE_DIR"
  log "сначала: ssh $SERVER 'bash /opt/chesscoin/scripts/backup_chesscoin.sh'"
  exit 1
fi

NAME=$(basename "$LATEST")
log "качаю $NAME"
if scp -i "$KEY" -o BatchMode=yes "$SERVER:$LATEST" "$DEST/"; then
  SIZE=$(du -h "$DEST/$NAME" | cut -f1)
  log "готово: $DEST/$NAME ($SIZE)"
else
  log "не скачалось"
  exit 1
fi

# Сверяем контрольную сумму: молчаливо битый архив хуже отсутствующего.
REMOTE_SUM=$(ssh -i "$KEY" -o BatchMode=yes "$SERVER" "sha256sum $LATEST | cut -d' ' -f1")
LOCAL_SUM=$(sha256sum "$DEST/$NAME" | cut -d' ' -f1)
if [ "$REMOTE_SUM" = "$LOCAL_SUM" ]; then
  log "контрольная сумма сошлась"
else
  log "⚠ СУММЫ НЕ СОШЛИСЬ — архив скачался повреждённым"
  exit 1
fi
