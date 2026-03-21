-- ChessCoin v5.8.3 — Initial Migration
-- Generated from prisma/schema.prisma

-- CreateEnum
CREATE TYPE "AvatarType" AS ENUM ('TELEGRAM', 'GRADIENT', 'UPLOAD', 'NFT');

-- CreateEnum
CREATE TYPE "League" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'CHAMPION', 'STAR');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('WAITING_FOR_OPPONENT', 'IN_PROGRESS', 'FINISHED', 'TIME_EXPIRED', 'DRAW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('BATTLE', 'BOT', 'FRIENDLY');

-- CreateEnum
CREATE TYPE "SessionSideStatus" AS ENUM ('WAITING_FOR_OPPONENT', 'IN_PROGRESS', 'WON', 'LOST', 'OFFERED_A_DRAW', 'DRAW');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('WELCOME_BONUS', 'BOT_WIN', 'BOT_PIECE', 'BATTLE_WIN', 'REFERRAL_BONUS', 'REFERRAL_INCOME', 'SUB_REFERRAL_INCOME', 'TASK_REWARD', 'FRIENDLY_WIN', 'BATTLE_BET', 'BATTLE_COMMISSION', 'BOT_LOSS', 'ATTEMPT_PURCHASE', 'ITEM_PURCHASE', 'CLAN_CONTRIBUTION', 'TOURNAMENT_ENTRY', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('REFERRAL', 'ENTER_CODE', 'FOLLOW_LINK', 'SUBSCRIBE_TELEGRAM');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('AVATAR_FRAME', 'BOARD_SKIN', 'PIECE_SKIN', 'MOVE_ANIMATION');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('BASIC', 'PREMIUM', 'NFT', 'SEASONAL');

-- CreateEnum
CREATE TYPE "ItemRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "ClanRole" AS ENUM ('SOLDIER', 'OFFICER', 'COMMANDER');

-- CreateEnum
CREATE TYPE "ClanWarStatus" AS ENUM ('IN_PROGRESS', 'FINISHED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "P2POrderStatus" AS ENUM ('OPEN', 'EXECUTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "platform_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "hardCap" BIGINT NOT NULL DEFAULT 100000000000,
    "emissionCap" BIGINT NOT NULL DEFAULT 30000000000,
    "totalEmitted" BIGINT NOT NULL DEFAULT 0,
    "platformReserve" BIGINT NOT NULL DEFAULT 100000000000,
    "currentPhase" INTEGER NOT NULL DEFAULT 1,
    "tokenPriceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.001,
    "priceUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalUsersSnapshot" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "username" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ru',
    "avatar" TEXT,
    "avatarType" "AvatarType" NOT NULL DEFAULT 'TELEGRAM',
    "avatarGradient" TEXT,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "totalEarned" BIGINT NOT NULL DEFAULT 0,
    "totalSpent" BIGINT NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 3,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "attemptSlots" TIMESTAMP(3)[],
    "elo" INTEGER NOT NULL DEFAULT 1000,
    "league" "League" NOT NULL DEFAULT 'BRONZE',
    "referrerId" TEXT,
    "referrerIncome" BIGINT NOT NULL DEFAULT 0,
    "subReferrerIncome" BIGINT NOT NULL DEFAULT 0,
    "referralActivated" BOOLEAN NOT NULL DEFAULT false,
    "tonWalletAddress" TEXT,
    "tonConnectedAt" TIMESTAMP(3),
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "status" "SessionStatus" NOT NULL,
    "type" "SessionType" NOT NULL,
    "fen" TEXT NOT NULL,
    "pgn" TEXT NOT NULL,
    "currentSideId" TEXT,
    "winnerSideId" TEXT,
    "isSurrender" BOOLEAN NOT NULL DEFAULT false,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "duration" INTEGER,
    "turnStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bet" BIGINT,
    "botLevel" INTEGER,
    "finishedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_sides" (
    "id" TEXT NOT NULL,
    "status" "SessionSideStatus" NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "isWhite" BOOLEAN NOT NULL DEFAULT true,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "eatenPieces" JSONB NOT NULL DEFAULT '[]',
    "winningAmount" BIGINT,
    "timeLeft" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "session_sides_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Active sessions pivot
CREATE TABLE "_ActiveUserSessions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "taskType" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'ACTIVE',
    "icon" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB NOT NULL,
    "winningAmount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "completed_tasks" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "completed_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "type" "ItemType" NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "previewUrl" TEXT,
    "priceCoins" BIGINT NOT NULL,
    "rarity" "ItemRarity" NOT NULL DEFAULT 'COMMON',
    "isNft" BOOLEAN NOT NULL DEFAULT false,
    "nftTokenId" TEXT,
    "totalSupply" INTEGER,
    "mintedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "isEquipped" BOOLEAN NOT NULL DEFAULT false,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nftTxHash" TEXT,
    "transferredAt" TIMESTAMP(3),
    CONSTRAINT "user_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "description" TEXT,
    "treasury" BIGINT NOT NULL DEFAULT 0,
    "elo" INTEGER NOT NULL DEFAULT 1000,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clan_members" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ClanRole" NOT NULL DEFAULT 'SOLDIER',
    "contribution" BIGINT NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clan_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clan_wars" (
    "id" TEXT NOT NULL,
    "attackerClanId" TEXT NOT NULL,
    "defenderClanId" TEXT NOT NULL,
    "status" "ClanWarStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "attackerWins" INTEGER NOT NULL DEFAULT 0,
    "defenderWins" INTEGER NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 5,
    "betPerPlayer" BIGINT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "clan_wars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCoins" BIGINT NOT NULL,
    "tonWalletAddress" TEXT NOT NULL,
    "tonCommission" DOUBLE PRECISION,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "p2p_orders" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT,
    "amountCoins" BIGINT NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "totalUsd" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDT',
    "status" "P2POrderStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    CONSTRAINT "p2p_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsCleanup" (
    "id" TEXT NOT NULL,
    "removedCount" INTEGER NOT NULL,
    "removedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,
    CONSTRAINT "AnalyticsCleanup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingReferral" (
    "id" TEXT NOT NULL,
    "newTelegramId" TEXT NOT NULL,
    "referrerTelegramId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingReferral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramId_key" ON "users"("telegramId");
CREATE INDEX "users_balance_idx" ON "users"("balance");
CREATE INDEX "users_elo_idx" ON "users"("elo");
CREATE INDEX "users_league_idx" ON "users"("league");
CREATE INDEX "users_referrerId_idx" ON "users"("referrerId");
CREATE INDEX "users_telegramId_idx" ON "users"("telegramId");

CREATE UNIQUE INDEX "sessions_code_key" ON "sessions"("code");
CREATE INDEX "sessions_status_idx" ON "sessions"("status");
CREATE INDEX "sessions_type_idx" ON "sessions"("type");
CREATE INDEX "sessions_code_idx" ON "sessions"("code");

CREATE INDEX "session_sides_playerId_idx" ON "session_sides"("playerId");
CREATE INDEX "session_sides_sessionId_idx" ON "session_sides"("sessionId");

CREATE UNIQUE INDEX "_ActiveUserSessions_AB_unique" ON "_ActiveUserSessions"("A", "B");
CREATE INDEX "_ActiveUserSessions_B_index" ON "_ActiveUserSessions"("B");

CREATE INDEX "transactions_userId_idx" ON "transactions"("userId");
CREATE INDEX "transactions_userId_createdAt_idx" ON "transactions"("userId", "createdAt");
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

CREATE UNIQUE INDEX "completed_tasks_userId_taskId_key" ON "completed_tasks"("userId", "taskId");

CREATE INDEX "items_type_idx" ON "items"("type");
CREATE INDEX "items_category_idx" ON "items"("category");
CREATE INDEX "items_isNft_idx" ON "items"("isNft");

CREATE UNIQUE INDEX "user_items_userId_itemId_key" ON "user_items"("userId", "itemId");
CREATE INDEX "user_items_userId_idx" ON "user_items"("userId");
CREATE INDEX "user_items_itemId_idx" ON "user_items"("itemId");

CREATE UNIQUE INDEX "clans_name_key" ON "clans"("name");
CREATE UNIQUE INDEX "clans_countryCode_key" ON "clans"("countryCode");

CREATE UNIQUE INDEX "clan_members_userId_key" ON "clan_members"("userId");
CREATE INDEX "clan_members_clanId_idx" ON "clan_members"("clanId");

CREATE INDEX "withdrawal_requests_userId_idx" ON "withdrawal_requests"("userId");
CREATE INDEX "withdrawal_requests_status_idx" ON "withdrawal_requests"("status");

CREATE INDEX "p2p_orders_status_idx" ON "p2p_orders"("status");
CREATE INDEX "p2p_orders_sellerId_idx" ON "p2p_orders"("sellerId");

CREATE INDEX "AdminNotification_sentAt_idx" ON "AdminNotification"("sentAt");

CREATE UNIQUE INDEX "PendingReferral_newTelegramId_key" ON "PendingReferral"("newTelegramId");
CREATE INDEX "PendingReferral_newTelegramId_idx" ON "PendingReferral"("newTelegramId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "session_sides" ADD CONSTRAINT "session_sides_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session_sides" ADD CONSTRAINT "session_sides_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "_ActiveUserSessions" ADD CONSTRAINT "_ActiveUserSessions_A_fkey" FOREIGN KEY ("A") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ActiveUserSessions" ADD CONSTRAINT "_ActiveUserSessions_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "completed_tasks" ADD CONSTRAINT "completed_tasks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "completed_tasks" ADD CONSTRAINT "completed_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_items" ADD CONSTRAINT "user_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_items" ADD CONSTRAINT "user_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "clans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clan_wars" ADD CONSTRAINT "clan_wars_attackerClanId_fkey" FOREIGN KEY ("attackerClanId") REFERENCES "clans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clan_wars" ADD CONSTRAINT "clan_wars_defenderClanId_fkey" FOREIGN KEY ("defenderClanId") REFERENCES "clans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
