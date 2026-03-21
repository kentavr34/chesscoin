-- v7.2.0: TradeOrder (TON-обмен в магазине, из GitHub)
CREATE TABLE IF NOT EXISTS "trade_orders" (
  "id"          TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"      TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "currency"    TEXT NOT NULL DEFAULT 'TON',
  "amount"      BIGINT NOT NULL,
  "priceUsd"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalUsd"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"      TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "executedAt"  TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "trade_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id")
);
CREATE INDEX IF NOT EXISTS "trade_orders_userId_idx" ON "trade_orders"("userId");
CREATE INDEX IF NOT EXISTS "trade_orders_status_idx" ON "trade_orders"("status");

DO $$ BEGIN
  ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'TRADE_BUY';
  ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'TRADE_SELL';
  ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'PUZZLE_REWARD';
EXCEPTION WHEN duplicate_object THEN null; END $$;
