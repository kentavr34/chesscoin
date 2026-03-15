-- AddEnum: CountryWarStatus
DO $$ BEGIN
  CREATE TYPE "CountryWarStatus" AS ENUM ('IN_PROGRESS', 'FINISHED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddEnum: COUNTRY_WAR_WIN to TransactionType
DO $$ BEGIN
  ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'COUNTRY_WAR_WIN';
EXCEPTION WHEN others THEN null; END $$;

-- CreateTable: countries
CREATE TABLE IF NOT EXISTS "countries" (
    "id"         TEXT NOT NULL,
    "code"       TEXT NOT NULL,
    "nameRu"     TEXT NOT NULL,
    "nameEn"     TEXT NOT NULL,
    "flag"       TEXT NOT NULL,
    "treasury"   BIGINT NOT NULL DEFAULT 0,
    "wins"       INTEGER NOT NULL DEFAULT 0,
    "losses"     INTEGER NOT NULL DEFAULT 0,
    "maxMembers" INTEGER NOT NULL DEFAULT 1000,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "countries_code_key" ON "countries"("code");
CREATE INDEX IF NOT EXISTS "countries_wins_idx" ON "countries"("wins");

-- CreateTable: country_members
CREATE TABLE IF NOT EXISTS "country_members" (
    "id"        TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "warWins"   INTEGER NOT NULL DEFAULT 0,
    "warLosses" INTEGER NOT NULL DEFAULT 0,
    "joinedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "country_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "country_members_userId_key" ON "country_members"("userId");
CREATE INDEX IF NOT EXISTS "country_members_countryId_warWins_idx" ON "country_members"("countryId", "warWins");
ALTER TABLE "country_members" ADD CONSTRAINT "country_members_countryId_fkey"
    FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "country_members" ADD CONSTRAINT "country_members_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: country_wars
CREATE TABLE IF NOT EXISTS "country_wars" (
    "id"                TEXT NOT NULL,
    "attackerCountryId" TEXT NOT NULL,
    "defenderCountryId" TEXT NOT NULL,
    "status"            "CountryWarStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "attackerWins"      INTEGER NOT NULL DEFAULT 0,
    "defenderWins"      INTEGER NOT NULL DEFAULT 0,
    "prizePerWin"       BIGINT NOT NULL DEFAULT 100,
    "duration"          INTEGER NOT NULL,
    "startedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt"             TIMESTAMP(3) NOT NULL,
    "finishedAt"        TIMESTAMP(3),
    "winnerCountryId"   TEXT,
    "declaredByUserId"  TEXT NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "country_wars_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "country_wars_status_idx" ON "country_wars"("status");
CREATE INDEX IF NOT EXISTS "country_wars_attackerCountryId_idx" ON "country_wars"("attackerCountryId");
CREATE INDEX IF NOT EXISTS "country_wars_defenderCountryId_idx" ON "country_wars"("defenderCountryId");
ALTER TABLE "country_wars" ADD CONSTRAINT "country_wars_attackerCountryId_fkey"
    FOREIGN KEY ("attackerCountryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "country_wars" ADD CONSTRAINT "country_wars_defenderCountryId_fkey"
    FOREIGN KEY ("defenderCountryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: war_battles
CREATE TABLE IF NOT EXISTS "war_battles" (
    "id"                TEXT NOT NULL,
    "warId"             TEXT NOT NULL,
    "sessionId"         TEXT NOT NULL,
    "attackerId"        TEXT NOT NULL,
    "defenderId"        TEXT NOT NULL,
    "attackerCountryId" TEXT NOT NULL,
    "defenderCountryId" TEXT NOT NULL,
    "winnerId"          TEXT,
    "winnerCountryId"   TEXT,
    "status"            TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt"        TIMESTAMP(3),
    CONSTRAINT "war_battles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "war_battles_sessionId_key" ON "war_battles"("sessionId");
CREATE INDEX IF NOT EXISTS "war_battles_warId_idx" ON "war_battles"("warId");
ALTER TABLE "war_battles" ADD CONSTRAINT "war_battles_warId_fkey"
    FOREIGN KEY ("warId") REFERENCES "country_wars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "war_battles" ADD CONSTRAINT "war_battles_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: saved_games
CREATE TABLE IF NOT EXISTS "saved_games" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "savedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saved_games_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "saved_games_userId_sessionId_key" ON "saved_games"("userId", "sessionId");
CREATE INDEX IF NOT EXISTS "saved_games_userId_idx" ON "saved_games"("userId");
ALTER TABLE "saved_games" ADD CONSTRAINT "saved_games_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "saved_games" ADD CONSTRAINT "saved_games_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddColumn to users: hasSeenWarsIntro
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hasSeenWarsIntro" BOOLEAN NOT NULL DEFAULT false;
