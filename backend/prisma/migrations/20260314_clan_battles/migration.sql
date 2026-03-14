-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Clan Battles — командные соревнования между кланами
-- ═══════════════════════════════════════════════════════════════

-- ─── Снимаем ограничение на количество участников клана ───────────────────────
-- maxMembers остаётся в схеме, но больше не используется как жёсткий лимит.
-- Оставляем колонку для обратной совместимости.

-- ─── Новый enum статуса клановых батлов ──────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "ClanBattleStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'FINISHED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ─── Таблица клановых батлов ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "clan_battles" (
  "id"                 TEXT        NOT NULL,
  "challengerClanId"   TEXT        NOT NULL,
  "defenderClanId"     TEXT        NOT NULL,
  "status"             "ClanBattleStatus" NOT NULL DEFAULT 'PENDING',
  "pool"               BIGINT      NOT NULL DEFAULT 0,
  "maxSimultaneous"    INTEGER     NOT NULL DEFAULT 10,
  "activeGames"        INTEGER     NOT NULL DEFAULT 0,
  "challengerWins"     INTEGER     NOT NULL DEFAULT 0,
  "defenderWins"       INTEGER     NOT NULL DEFAULT 0,
  "totalGames"         INTEGER     NOT NULL DEFAULT 0,
  "winnerClanId"       TEXT,
  "duration"           INTEGER     NOT NULL,
  "startedAt"          TIMESTAMP(3),
  "endAt"              TIMESTAMP(3),
  "finishedAt"         TIMESTAMP(3),
  "isPublished"        BOOLEAN     NOT NULL DEFAULT false,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "clan_battles_pkey" PRIMARY KEY ("id")
);

-- ─── Таблица взносов участников ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "clan_battle_contributions" (
  "id"         TEXT        NOT NULL,
  "battleId"   TEXT        NOT NULL,
  "userId"     TEXT        NOT NULL,
  "clanId"     TEXT        NOT NULL,
  "amount"     BIGINT      NOT NULL,
  "paidOut"    BOOLEAN     NOT NULL DEFAULT false,
  "paidAmount" BIGINT      NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "clan_battle_contributions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clan_battle_contributions_battleId_userId_key" UNIQUE ("battleId", "userId")
);

-- ─── Таблица партий в рамках батла ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "clan_battle_games" (
  "id"           TEXT        NOT NULL,
  "battleId"     TEXT        NOT NULL,
  "sessionId"    TEXT        NOT NULL,
  "player1Id"    TEXT        NOT NULL,
  "player2Id"    TEXT        NOT NULL,
  "clan1Id"      TEXT        NOT NULL,
  "clan2Id"      TEXT        NOT NULL,
  "winnerId"     TEXT,
  "winnerClanId" TEXT,
  "status"       TEXT        NOT NULL DEFAULT 'IN_PROGRESS',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt"   TIMESTAMP(3),

  CONSTRAINT "clan_battle_games_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clan_battle_games_sessionId_key" UNIQUE ("sessionId")
);

-- ─── Индексы ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "clan_battles_status_idx"            ON "clan_battles"("status");
CREATE INDEX IF NOT EXISTS "clan_battles_challengerClanId_idx"  ON "clan_battles"("challengerClanId");
CREATE INDEX IF NOT EXISTS "clan_battles_defenderClanId_idx"    ON "clan_battles"("defenderClanId");

CREATE INDEX IF NOT EXISTS "clan_battle_contributions_battleId_idx" ON "clan_battle_contributions"("battleId");
CREATE INDEX IF NOT EXISTS "clan_battle_games_battleId_idx"         ON "clan_battle_games"("battleId");
CREATE INDEX IF NOT EXISTS "clan_battle_games_sessionId_idx"        ON "clan_battle_games"("sessionId");

-- ─── Внешние ключи ────────────────────────────────────────────────────────────
ALTER TABLE "clan_battles"
  ADD CONSTRAINT IF NOT EXISTS "clan_battles_challengerClanId_fkey"
    FOREIGN KEY ("challengerClanId") REFERENCES "clans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clan_battles"
  ADD CONSTRAINT IF NOT EXISTS "clan_battles_defenderClanId_fkey"
    FOREIGN KEY ("defenderClanId") REFERENCES "clans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clan_battle_contributions"
  ADD CONSTRAINT IF NOT EXISTS "clan_battle_contributions_battleId_fkey"
    FOREIGN KEY ("battleId") REFERENCES "clan_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clan_battle_games"
  ADD CONSTRAINT IF NOT EXISTS "clan_battle_games_battleId_fkey"
    FOREIGN KEY ("battleId") REFERENCES "clan_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
