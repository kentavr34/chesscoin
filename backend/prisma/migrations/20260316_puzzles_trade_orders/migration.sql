-- ─────────────────────────────────────────────────────────────────────
-- Migration: 20260316_puzzles_trade_orders
-- Adds: chess_puzzles, puzzle_completions, trade_orders tables + enums
-- ─────────────────────────────────────────────────────────────────────

-- Enums
DO $$ BEGIN
  CREATE TYPE "PuzzleType" AS ENUM ('LESSON', 'DAILY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TradeOrderType" AS ENUM ('BUY', 'SELL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TradeOrderCurrency" AS ENUM ('TON', 'STARS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TradeOrderStatus" AS ENUM ('OPEN', 'FILLED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ChessPuzzle
CREATE TABLE IF NOT EXISTS "chess_puzzles" (
    "id"         TEXT NOT NULL,
    "externalId" TEXT,
    "type"       "PuzzleType" NOT NULL,
    "titleRu"    TEXT NOT NULL,
    "titleEn"    TEXT NOT NULL,
    "descRu"     TEXT,
    "descEn"     TEXT,
    "fen"        TEXT NOT NULL,
    "moves"      TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "reward"     BIGINT NOT NULL DEFAULT 1000,
    "category"   TEXT,
    "month"      INTEGER,
    "year"       INTEGER,
    "isActive"   BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"  INTEGER NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chess_puzzles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "chess_puzzles_externalId_key" ON "chess_puzzles"("externalId");
CREATE INDEX IF NOT EXISTS "chess_puzzles_type_idx"       ON "chess_puzzles"("type");
CREATE INDEX IF NOT EXISTS "chess_puzzles_difficulty_idx" ON "chess_puzzles"("difficulty");

-- PuzzleCompletion
CREATE TABLE IF NOT EXISTS "puzzle_completions" (
    "id"       TEXT NOT NULL,
    "userId"   TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "passedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puzzle_completions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "puzzle_completions_userId_puzzleId_key"
    ON "puzzle_completions"("userId", "puzzleId");
CREATE INDEX IF NOT EXISTS "puzzle_completions_userId_idx" ON "puzzle_completions"("userId");

ALTER TABLE "puzzle_completions"
    ADD CONSTRAINT "puzzle_completions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "puzzle_completions"
    ADD CONSTRAINT "puzzle_completions_puzzleId_fkey"
    FOREIGN KEY ("puzzleId") REFERENCES "chess_puzzles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- TradeOrder
CREATE TABLE IF NOT EXISTS "trade_orders" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "type"           "TradeOrderType" NOT NULL,
    "currency"       "TradeOrderCurrency" NOT NULL,
    "amount"         BIGINT NOT NULL,
    "price"          DOUBLE PRECISION NOT NULL,
    "status"         "TradeOrderStatus" NOT NULL DEFAULT 'OPEN',
    "filledByUserId" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filledAt"       TIMESTAMP(3),
    "cancelledAt"    TIMESTAMP(3),

    CONSTRAINT "trade_orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "trade_orders_status_idx" ON "trade_orders"("status");
CREATE INDEX IF NOT EXISTS "trade_orders_userId_idx" ON "trade_orders"("userId");

ALTER TABLE "trade_orders"
    ADD CONSTRAINT "trade_orders_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
