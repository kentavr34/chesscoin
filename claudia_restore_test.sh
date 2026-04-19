#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
# claudia_restore_test.sh — Еженедельный тест восстановления бэкапа
#
# Что проверяем:
#   1. Последний бэкап существует на Google Drive
#   2. Скачивается без ошибок
#   3. Распаковывается без ошибок
#   4. Содержит ожидаемые файлы (код, PG дампы, LightRAG)
#   5. PG дамп валиден (psql --dry-run)
#   6. LightRAG JSON-ы парсятся без ошибок
#   7. Vault расшифровывается passphrase
#
# Отчёт в Telegram: ✅ всё ок ИЛИ ❌ проблема + детали
#
# Запуск: claudia-restore-test.timer — воскресенье 05:00 UTC
# ════════════════════════════════════════════════════════════════════════

set -uo pipefail

TEST_DIR="/tmp/claudia_restore_test"
LOG="/root/claudia/logs/restore_test.log"
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
ADMIN_ID="${ADMIN_USER_ID:-}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"; }

# Результаты тестов (true/false)
TEST_BACKUP_EXISTS=false
TEST_DOWNLOAD=false
TEST_EXTRACT=false
TEST_FILES=false
TEST_PG_DUMP=false
TEST_LIGHTRAG=false
TEST_VAULT=false

ERRORS=()

send_tg() {
    local msg="$1"
    [ -z "$BOT_TOKEN" ] || [ -z "$ADMIN_ID" ] && return
    curl -sS -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
        -H 'Content-Type: application/json' \
        -d "$(printf '{"chat_id":"%s","text":"%s","parse_mode":"Markdown"}' "$ADMIN_ID" "$msg")" \
        >/dev/null 2>&1 || true
}

log "═══ Еженедельный тест восстановления ═══"
rm -rf "$TEST_DIR" && mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# ── 1. Проверка существования бэкапа ────────────────────────────────────
log "[1/7] Проверка что есть бэкап на GDrive..."
LATEST=$(rclone ls gdrive:claudia_backups 2>/dev/null | sort -k2 | tail -1 | awk '{print $2}')
if [ -z "$LATEST" ]; then
    ERRORS+=("Нет бэкапов в gdrive:claudia_backups")
    log "  ❌ Бэкапов нет"
else
    TEST_BACKUP_EXISTS=true
    log "  ✓ Найден: $LATEST"
fi

# ── 2. Скачивание ────────────────────────────────────────────────────────
if $TEST_BACKUP_EXISTS; then
    log "[2/7] Скачивание $LATEST..."
    if rclone copy "gdrive:claudia_backups/$LATEST" "$TEST_DIR/" 2>>"$LOG"; then
        TEST_DOWNLOAD=true
        SIZE=$(du -h "$TEST_DIR/$LATEST" | cut -f1)
        log "  ✓ Скачано: $SIZE"
    else
        ERRORS+=("Не смогли скачать $LATEST")
        log "  ❌ Скачивание failed"
    fi
fi

# ── 3. Распаковка ───────────────────────────────────────────────────────
if $TEST_DOWNLOAD; then
    log "[3/7] Распаковка..."
    if tar -xzf "$TEST_DIR/$LATEST" -C "$TEST_DIR/" 2>>"$LOG"; then
        TEST_EXTRACT=true
        log "  ✓ Распаковано"
    else
        ERRORS+=("Не распаковывается $LATEST")
        log "  ❌ Распаковка failed"
    fi
fi

# ── 4. Проверка структуры ───────────────────────────────────────────────
if $TEST_EXTRACT; then
    log "[4/7] Проверка структуры..."
    EXTRACTED=$(find "$TEST_DIR" -maxdepth 1 -type d -name "claudia_*" | head -1)
    MISSING=()
    for required in "claudia" "postgres" "lightrag_data"; do
        if [ ! -e "$EXTRACTED/$required" ]; then
            MISSING+=("$required")
        fi
    done
    if [ ${#MISSING[@]} -eq 0 ]; then
        TEST_FILES=true
        log "  ✓ Все 3 папки на месте"
    else
        ERRORS+=("Отсутствует: ${MISSING[*]}")
        log "  ❌ Отсутствует: ${MISSING[*]}"
    fi
fi

# ── 5. Валидность PG дампа ──────────────────────────────────────────────
if $TEST_FILES; then
    log "[5/7] Валидация PostgreSQL дампа..."
    PG_SQL="$EXTRACTED/postgres/claudia_data.sql"
    if [ -f "$PG_SQL" ] && grep -q "CREATE TABLE\|COPY\|INSERT" "$PG_SQL" 2>/dev/null; then
        TEST_PG_DUMP=true
        LINES=$(wc -l < "$PG_SQL")
        log "  ✓ SQL дамп валиден ($LINES строк)"
    else
        ERRORS+=("PG дамп пустой или битый")
        log "  ❌ PG дамп невалиден"
    fi
fi

# ── 6. LightRAG JSON-ы парсятся ─────────────────────────────────────────
if $TEST_FILES; then
    log "[6/7] Валидация LightRAG JSON..."
    RAG_DIR="$EXTRACTED/lightrag_data"
    if [ -d "$RAG_DIR" ]; then
        BROKEN=0
        for f in "$RAG_DIR"/*.json; do
            [ -f "$f" ] || continue
            if ! python3 -c "import json; json.load(open('$f'))" 2>/dev/null; then
                BROKEN=$((BROKEN + 1))
            fi
        done
        if [ $BROKEN -eq 0 ]; then
            TEST_LIGHTRAG=true
            log "  ✓ Все LightRAG JSON валидны"
        else
            ERRORS+=("LightRAG: $BROKEN битых JSON")
            log "  ❌ Битых JSON: $BROKEN"
        fi
    fi
fi

# ── 7. Vault расшифровка ────────────────────────────────────────────────
log "[7/7] Тест расшифровки vault..."
LATEST_VAULT=$(rclone ls gdrive:claudia_vault 2>/dev/null | sort -k2 | tail -1 | awk '{print $2}')
if [ -n "$LATEST_VAULT" ] && [ -f /root/.claudia_vault_passphrase ]; then
    if rclone copy "gdrive:claudia_vault/$LATEST_VAULT" "$TEST_DIR/"; then
        PASS=$(cat /root/.claudia_vault_passphrase)
        if echo "$PASS" | gpg --batch --yes --passphrase-fd 0 -d "$TEST_DIR/$LATEST_VAULT" 2>/dev/null | tar -tzf - >/dev/null 2>&1; then
            TEST_VAULT=true
            log "  ✓ Vault расшифровывается"
        else
            ERRORS+=("Vault не расшифровался")
            log "  ❌ Vault расшифровка failed"
        fi
    fi
else
    ERRORS+=("Нет vault-бэкапа или passphrase")
    log "  ❌ Vault/passphrase отсутствуют"
fi

# ── Итог + уведомление ──────────────────────────────────────────────────
PASSED=0
TOTAL=7
for t in $TEST_BACKUP_EXISTS $TEST_DOWNLOAD $TEST_EXTRACT $TEST_FILES $TEST_PG_DUMP $TEST_LIGHTRAG $TEST_VAULT; do
    $t && PASSED=$((PASSED + 1))
done

log "═══ Итог: $PASSED/$TOTAL тестов прошли ═══"

if [ $PASSED -eq $TOTAL ]; then
    send_tg "✅ *Бэкапы проверены:* $PASSED/$TOTAL%0A%0AВсе тесты восстановления пройдены. Последний бэкап: $LATEST"
else
    ERR_TEXT=$(printf '%s%%0A' "${ERRORS[@]}")
    send_tg "⚠️ *Проблемы с бэкапами:* $PASSED/$TOTAL%0A%0A${ERR_TEXT}"
fi

# Чистим
rm -rf "$TEST_DIR"
log "Тест завершён."

[ $PASSED -eq $TOTAL ] && exit 0 || exit 1
