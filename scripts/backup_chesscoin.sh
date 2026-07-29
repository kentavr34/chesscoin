#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# ПОЛНЫЙ БЭКАП ПРОЕКТА CHESSCOIN — только папка проекта, не сервер целиком.
# Создан 2026-07-29 по требованию Кенана: проект должен восстанавливаться
# целиком на любом другом диске/сервере, независимо от Claudia и Jobus.
#
# Состав: код (git-бандл со всей историей + рабочее дерево) · БД игры ·
#         независимая память проекта (chesscoin_pm + выжимка по project='chesscoin') ·
#         аватары · конфиги · секреты (зашифрованы отдельно) · инструкция восстановления.
#
# Назначение: Google Drive (gdrive:chesscoin-backups/) + Telegram-группа.
#
# Запуск:  bash /opt/chesscoin/scripts/backup_chesscoin.sh [метка]
#          метка попадёт в имя файла, например: bash backup_chesscoin.sh before-cleanup
# ═══════════════════════════════════════════════════════════════════════
set -uo pipefail

PROJ=/opt/chesscoin
LABEL="${1:-manual}"
TS=$(date +%Y-%m-%d_%H-%M)
NAME="chesscoin_${TS}_${LABEL}"
WORK="/tmp/${NAME}"
ARCHIVE="/tmp/${NAME}.tar.gz"
GDRIVE_DIR="gdrive:chesscoin-backups"
TG_CHAT="${TG_CHAT:--1001963289478}"          # группа бэкапов (решение Кенана 2026-07-29)
PASSFILE=/root/.chesscoin_backup_pass          # ключ шифрования секретов, НЕ в архиве

log() { echo "[$(date '+%F %T')] $*"; }

log "=== БЭКАП CHESSCOIN: ${NAME} ==="
mkdir -p "$WORK"

# ── 1. Код: бандл со всей историей + рабочее дерево ────────────────────
log "[1/7] Код"
git -C "$PROJ" bundle create "$WORK/code_full_history.bundle" --all 2>/dev/null \
  && log "  bundle: $(du -h "$WORK/code_full_history.bundle" | cut -f1)" || log "  ⚠ bundle FAILED"
tar -czf "$WORK/worktree.tar.gz" -C "$PROJ" \
  --exclude=node_modules --exclude=.git --exclude=dist --exclude=avatars \
  --exclude='*.tar.gz' . 2>/dev/null \
  && log "  дерево: $(du -h "$WORK/worktree.tar.gz" | cut -f1)" || log "  ⚠ worktree FAILED"
git -C "$PROJ" log --oneline -1 > "$WORK/HEAD.txt" 2>/dev/null

# ── 2. БД игры ─────────────────────────────────────────────────────────
log "[2/7] БД chesscoin"
docker exec chesscoin_postgres pg_dump -U chesscoin chesscoin --no-owner --no-acl \
  > "$WORK/chesscoin_db.sql" 2>/dev/null \
  && log "  дамп: $(du -h "$WORK/chesscoin_db.sql" | cut -f1)" || log "  ⚠ FAILED"

# ── 3. Независимая память проекта ──────────────────────────────────────
# Схема chesscoin_pm целиком + выжимка всего, что относится к project='chesscoin'
# из общей памяти Claudia. Цель: перенести проект вместе с его историей и опытом,
# не таща за собой чужую базу.
log "[3/7] Память проекта (управляющий контур)"
docker exec chesscoin_postgres pg_dump -U claudia -d claudia -n chesscoin_pm --no-owner --no-acl \
  > "$WORK/chesscoin_pm_schema.sql" 2>/dev/null \
  && log "  chesscoin_pm: $(du -h "$WORK/chesscoin_pm_schema.sql" | cut -f1)" || log "  ⚠ FAILED"

# ── 4. Аватары (пользовательские данные, в git их нет) ─────────────────
log "[4/7] Аватары"
if [ -d "$PROJ/avatars" ]; then
  tar -czf "$WORK/avatars.tar.gz" -C "$PROJ" avatars 2>/dev/null \
    && log "  аватары: $(du -h "$WORK/avatars.tar.gz" | cut -f1)"
else
  log "  каталога avatars нет"
fi

# ── 5. Секреты — отдельным зашифрованным файлом ────────────────────────
log "[5/7] Секреты (AES-256, ключ вне архива)"
if [ ! -f "$PASSFILE" ]; then
  openssl rand -base64 32 > "$PASSFILE" && chmod 600 "$PASSFILE"
  log "  ⚠ создан новый ключ $PASSFILE — СОХРАНИТЬ ЕГО ОТДЕЛЬНО, иначе секреты не расшифровать"
fi
if [ -f "$PROJ/.env" ]; then
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
    -in "$PROJ/.env" -out "$WORK/env.enc" -pass "file:$PASSFILE" 2>/dev/null \
    && log "  env.enc готов" || log "  ⚠ шифрование FAILED"
fi
cp "$PROJ/docker-compose.yml" "$WORK/" 2>/dev/null
cp "$PROJ/.secrets.enc" "$WORK/" 2>/dev/null

# ── 6. Инструкция восстановления ───────────────────────────────────────
cat > "$WORK/RESTORE.md" <<'RESTORE'
# Восстановление ChessCoin из этого архива

Архив самодостаточен: проект поднимается на любом чистом сервере,
без Claudia, Jobus и какой-либо внешней инфраструктуры.

## 1. Код
    git clone code_full_history.bundle chesscoin      # вся история веток
    # либо только рабочее состояние:
    mkdir chesscoin && tar -xzf worktree.tar.gz -C chesscoin
`HEAD.txt` — на каком коммите снят бэкап.

## 2. Секреты
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in env.enc -out .env -pass file:<ключ>
Ключ лежал на прод-сервере в `/root/.chesscoin_backup_pass` и в архив НЕ входит.
Запасной вариант — `.secrets.enc` (пароль у Кенана на телефоне):
    python tools/secrets_decrypt.py .secrets.enc <passphrase>

## 3. Базы
    docker compose up -d postgres
    docker exec -i <postgres> psql -U chesscoin -d chesscoin < chesscoin_db.sql
    docker exec -i <postgres> psql -U <role> -d <db>      < chesscoin_pm_schema.sql
`chesscoin_pm` — управляющий контур: мои ошибки, решения, боевые пути,
эталон достигнутого, реестр файлов, журнал. Схема самостоятельная,
её можно поднять в любой базе.

## 4. Данные
    tar -xzf avatars.tar.gz -C /opt/chesscoin

## 5. Запуск
    docker compose up -d --build
Проверка: `docker exec chesscoin_backend sh -lc "wget -qO- http://localhost:3000/health"`
Затем прогнать эталон: `python project_management/tools/regression.py`
RESTORE

# ── 7. Упаковка и отправка ─────────────────────────────────────────────
log "[6/7] Упаковка"
tar -czf "$ARCHIVE" -C /tmp "$NAME" 2>/dev/null
SIZE=$(du -h "$ARCHIVE" | cut -f1)
BYTES=$(stat -c%s "$ARCHIVE")
log "  архив: $SIZE"

log "[7/7] Отправка"
if timeout 900 rclone copy "$ARCHIVE" "$GDRIVE_DIR/" --low-level-retries 3 2>&1 | tail -2; then
  log "  GDrive: OK → $GDRIVE_DIR/$(basename "$ARCHIVE")"
else
  log "  ⚠ GDrive FAILED"
fi

# Токен доставки: сначала свой бот ChessCoin, затем бот-архивариус.
# Свой бот заработает, как только его добавят в группу бэкапов
# (сейчас Telegram отвечает «chat not found» — бота там нет).
# Доставка. Приоритет — своими силами, чтобы проект не зависел от чужого бота:
#   1) бот ChessCoin в группу бэкапов (заработает, когда его туда добавят);
#   2) бот ChessCoin в личку владельцу (ADMIN_IDS) — уже полностью наш канал;
#   3) бот-архивариус Claudia в ту же группу — последний резерв.
TOKEN=$(grep -E '^BOT_TOKEN=' "$PROJ/.env" 2>/dev/null | cut -d= -f2- | tr -d '"')
ADMIN=$(grep -E '^ADMIN_IDS=' "$PROJ/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' | cut -d, -f1)
probe() { curl -s -m 15 "https://api.telegram.org/bot$1/getChat?chat_id=$2" | grep -q '"ok":true'; }

if [ -n "$TOKEN" ] && probe "$TOKEN" "$TG_CHAT"; then
  log "  канал: свой бот → группа бэкапов"
elif [ -n "$TOKEN" ] && [ -n "$ADMIN" ] && probe "$TOKEN" "$ADMIN"; then
  TG_CHAT="$ADMIN"
  log "  канал: свой бот → личка владельца (бот в группу не добавлен)"
else
  ALT=$(grep -E '^ARCHIVIST_BOT_TOKEN=' /opt/claudia/.env 2>/dev/null | cut -d= -f2- | tr -d '"')
  if [ -n "$ALT" ] && probe "$ALT" "$TG_CHAT"; then
    TOKEN="$ALT"
    log "  канал: резервный — бот-архивариус Claudia"
  fi
fi
if [ -n "$TOKEN" ]; then
  TEXT="📦 ChessCoin backup: ${NAME}
Размер: ${SIZE}
Коммит: $(cat "$WORK/HEAD.txt" 2>/dev/null)
GDrive: ${GDRIVE_DIR}/$(basename "$ARCHIVE")
Состав: код+история · БД игры · память проекта · аватары · секреты(AES)"
  curl -s -m 30 -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TG_CHAT}" --data-urlencode "text=${TEXT}" \
    -o /tmp/tg_msg.json && log "  Telegram sendMessage: $(grep -o '"ok":[a-z]*' /tmp/tg_msg.json)"
  if [ "$BYTES" -le 47185920 ]; then
    curl -s -m 300 -X POST "https://api.telegram.org/bot${TOKEN}/sendDocument" \
      -F "chat_id=${TG_CHAT}" -F "document=@${ARCHIVE}" \
      -o /tmp/tg_doc.json && log "  Telegram sendDocument: $(grep -o '"ok":[a-z]*' /tmp/tg_doc.json)"
  else
    log "  файл >45MB — в Telegram ушло только уведомление, сам архив на GDrive"
  fi
else
  log "  ⚠ BOT_TOKEN не найден — Telegram пропущен"
fi

rm -rf "$WORK"
log "=== ГОТОВО: $ARCHIVE ($SIZE) ==="
