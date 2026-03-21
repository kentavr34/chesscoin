-- v7.0.8: TON transaction verification
ALTER TABLE "p2p_orders"
  ADD COLUMN IF NOT EXISTS "verifyStatus" TEXT NOT NULL DEFAULT 'NONE';

-- Индекс для фонового крона (находить PENDING транзакции)
CREATE INDEX IF NOT EXISTS "p2p_orders_verifyStatus_idx" ON "p2p_orders"("verifyStatus")
  WHERE "verifyStatus" = 'PENDING';
