-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Stages 2-5 — Battles, Clans, Tournaments, Shop
-- ═══════════════════════════════════════════════════════════════

-- ─── Stage 2: Battles — пул донатов, реферальный батл ────────────
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "donationPool" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "referralCreatorId" TEXT;

-- ─── Stage 2: Военные звания пользователей ───────────────────────
-- (вычисляются динамически из числа рефералов, но кэшируем для производительности)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "militaryRank" TEXT NOT NULL DEFAULT 'PRIVATE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referralCount" INTEGER NOT NULL DEFAULT 0;

-- ─── Stage 3: Кланы — лидер, макс участников, война ─────────────
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "leaderId" TEXT;
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "maxMembers" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "totalWarWins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "totalWarLosses" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "achievements" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "lastPostedBattleId" TEXT;

-- ─── Stage 3: Участники клана — война, взнос, ожидание ───────────
ALTER TABLE "clan_members" ADD COLUMN IF NOT EXISTS "warWins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "clan_members" ADD COLUMN IF NOT EXISTS "warLosses" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "clan_members" ADD COLUMN IF NOT EXISTS "isPending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clan_members" ADD COLUMN IF NOT EXISTS "pendingContribution" BIGINT NOT NULL DEFAULT 0;

-- ─── Stage 3: Войны между кланами — переработка ──────────────────
ALTER TABLE "clan_wars" ADD COLUMN IF NOT EXISTS "duration" INTEGER NOT NULL DEFAULT 86400;
ALTER TABLE "clan_wars" ADD COLUMN IF NOT EXISTS "endAt" TIMESTAMP(3);
ALTER TABLE "clan_wars" ADD COLUMN IF NOT EXISTS "prize" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "clan_wars" ADD COLUMN IF NOT EXISTS "attackerTreasury" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "clan_wars" ADD COLUMN IF NOT EXISTS "defenderTreasury" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "clan_wars" ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clan_wars" ADD COLUMN IF NOT EXISTS "winnerClanId" TEXT;
ALTER TABLE "clan_wars" ADD COLUMN IF NOT EXISTS "isPending" BOOLEAN NOT NULL DEFAULT false;

-- Индекс для активных войн
CREATE INDEX IF NOT EXISTS "clan_wars_status_idx" ON "clan_wars"("status");
CREATE INDEX IF NOT EXISTS "clan_wars_attackerClanId_idx" ON "clan_wars"("attackerClanId");
CREATE INDEX IF NOT EXISTS "clan_wars_defenderClanId_idx" ON "clan_wars"("defenderClanId");

-- ─── Stage 4: Турниры — тип, период, взнос ───────────────────────
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'WORLD';
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "period" TEXT;
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "endAt" TIMESTAMP(3);
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "winnerId" TEXT;
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "donationPool" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "lastPublishedAt" TIMESTAMP(3);

-- ─── Stage 4: Участники турнира — победы, очки ────────────────────
ALTER TABLE "tournament_players" ADD COLUMN IF NOT EXISTS "wins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tournament_players" ADD COLUMN IF NOT EXISTS "losses" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tournament_players" ADD COLUMN IF NOT EXISTS "draws" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tournament_players" ADD COLUMN IF NOT EXISTS "points" FLOAT NOT NULL DEFAULT 0;
ALTER TABLE "tournament_players" ADD COLUMN IF NOT EXISTS "skippedMatches" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tournament_players" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tournament_players" ADD COLUMN IF NOT EXISTS "contribution" BIGINT NOT NULL DEFAULT 0;

-- ─── Stage 5: Магазин — TON транзакции ───────────────────────────
CREATE TABLE IF NOT EXISTS "ton_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,          -- 'DEPOSIT' | 'WITHDRAWAL' | 'PURCHASE'
    "amountTon" FLOAT NOT NULL,
    "amountCoins" BIGINT NOT NULL DEFAULT 0,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "itemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "ton_transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ton_transactions_userId_idx" ON "ton_transactions"("userId");
CREATE INDEX IF NOT EXISTS "ton_transactions_status_idx" ON "ton_transactions"("status");

-- ─── Обновляем referralCount для существующих пользователей ──────
UPDATE "users" u SET "referralCount" = (
    SELECT COUNT(*) FROM "users" r WHERE r."referrerId" = u.id
);
