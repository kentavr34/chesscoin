-- AddColumn: login streak
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "loginStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginDate" TIMESTAMP(3);

-- AddTable: tournaments
CREATE TABLE IF NOT EXISTS "tournaments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entryFee" BIGINT NOT NULL DEFAULT 0,
    "maxPlayers" INTEGER NOT NULL DEFAULT 8,
    "status" TEXT NOT NULL DEFAULT 'REGISTRATION',
    "startAt" TIMESTAMP(3),
    "prizePool" BIGINT NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tournaments_status_idx" ON "tournaments"("status");

-- AddTable: tournament_players
CREATE TABLE IF NOT EXISTS "tournament_players" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seed" INTEGER,
    "eliminated" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tournament_players_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tournament_players_tournamentId_userId_key" ON "tournament_players"("tournamentId", "userId");
CREATE INDEX IF NOT EXISTS "tournament_players_tournamentId_idx" ON "tournament_players"("tournamentId");
CREATE INDEX IF NOT EXISTS "tournament_players_userId_idx" ON "tournament_players"("userId");

ALTER TABLE "tournament_players" ADD CONSTRAINT "tournament_players_tournamentId_fkey"
    FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tournament_players" ADD CONSTRAINT "tournament_players_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddTable: tournament_matches
CREATE TABLE IF NOT EXISTS "tournament_matches" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "player1Id" TEXT,
    "player2Id" TEXT,
    "winnerId" TEXT,
    "round" INTEGER NOT NULL DEFAULT 1,
    "matchOrder" INTEGER NOT NULL DEFAULT 1,
    "sessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tournament_matches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tournament_matches_tournamentId_idx" ON "tournament_matches"("tournamentId");

ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_tournamentId_fkey"
    FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum: TournamentStatus (Prisma handles this internally, PostgreSQL uses TEXT for status)
