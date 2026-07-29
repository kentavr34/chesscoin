-- Разбор дрейфа схемы (дефект №17), безопасная часть.
--
-- Только АДДИТИВНЫЕ операции: индексы, которые описаны в schema.prisma, но
-- отсутствовали в проде, и два внешних ключа p2p_orders (сирот нет: проверено,
-- 0 строк без соответствующего users.id).
--
-- Что СОЗНАТЕЛЬНО не вошло (см. project_management/registry/SCHEMA_DRIFT.md):
--   · DROP TABLE шести таблиц — среди них чужие (claudia_*, conversations,
--     task_buffer): они живут в этой же БД и принадлежат другому проекту;
--   · DROP COLUMN users.countryCode (7 значений) и countries.commanderUserId —
--     легаси, но данные не удаляем без решения Кенана;
--   · перевод trade_orders.type/currency/status из text в enum и NOT NULL price —
--     требует конверсии данных, отдельная согласованная задача;
--   · DROP INDEX шести индексов — они никому не мешают.

CREATE INDEX IF NOT EXISTS "country_members_countryId_contribution_idx" ON "country_members"("countryId", "contribution");
CREATE INDEX IF NOT EXISTS "sessions_startedAt_idx" ON "sessions"("startedAt");
CREATE INDEX IF NOT EXISTS "sessions_status_type_idx" ON "sessions"("status", "type");
CREATE INDEX IF NOT EXISTS "sessions_status_bet_idx" ON "sessions"("status", "bet");
CREATE INDEX IF NOT EXISTS "tournament_matches_sessionId_idx" ON "tournament_matches"("sessionId");
CREATE INDEX IF NOT EXISTS "users_createdAt_idx" ON "users"("createdAt");
CREATE INDEX IF NOT EXISTS "users_lastLoginDate_idx" ON "users"("lastLoginDate");
CREATE INDEX IF NOT EXISTS "users_isBot_isBanned_idx" ON "users"("isBot", "isBanned");
CREATE INDEX IF NOT EXISTS "users_totalEarned_idx" ON "users"("totalEarned");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'p2p_orders_sellerId_fkey') THEN
    ALTER TABLE "p2p_orders" ADD CONSTRAINT "p2p_orders_sellerId_fkey"
      FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'p2p_orders_buyerId_fkey') THEN
    ALTER TABLE "p2p_orders" ADD CONSTRAINT "p2p_orders_buyerId_fkey"
      FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
