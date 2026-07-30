#!/bin/bash
# Страж дрейфа схемы Prisma ↔ прод-БД.
#
# Считает размер diff, ИСКЛЮЧАЯ намеренные архивные таблицы (archive_*):
# они создаются при уборке данных по решению Кенана, в schema.prisma их нет
# и быть не должно — Prisma предлагает их удалить, но это не дрейф.
#
# Порог 104 строки — состояние после разбора 30.07.2026 (см. SCHEMA_DRIFT.md).
# Рост выше порога = кто-то правит схему мимо миграций.
#
# Печатает: DRIFT_OK | DRIFT_GREW

LIMIT="${1:-104}"

N=$(docker exec chesscoin_backend sh -lc \
  'npx prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script 2>/dev/null' \
  | grep -vc 'archive_')

if [ -z "$N" ]; then
  echo DRIFT_GREW
elif [ "$N" -le "$LIMIT" ]; then
  echo DRIFT_OK
else
  echo DRIFT_GREW
fi
