-- PR-1: source-теги sessions, дедлайн партии, share-токен,
-- per-war счётчик побед бойца страны.
--
-- Идемпотентно: IF NOT EXISTS на колонках, DO $$ на enum, безопасный backfill.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. SessionSource enum
-- ─────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "SessionSource" AS ENUM ('PRIVATE', 'PUBLIC', 'TOURNAMENT', 'WAR', 'BOT_PRACTICE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Session: новые колонки
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "sourceType"    "SessionSource" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS "sourceRefId"   TEXT,
  ADD COLUMN IF NOT EXISTS "deadlineAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "acceptedByAll" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "shareToken"    TEXT;

-- Уникальный токен. Заполняем существующим строкам id (UUID) — уникален.
UPDATE "sessions" SET "shareToken" = "id" WHERE "shareToken" IS NULL;

ALTER TABLE "sessions" ALTER COLUMN "shareToken" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "sessions_shareToken_key"
  ON "sessions"("shareToken");

CREATE INDEX IF NOT EXISTS "sessions_sourceType_status_idx"
  ON "sessions"("sourceType", "status");

CREATE INDEX IF NOT EXISTS "sessions_deadlineAt_idx"
  ON "sessions"("deadlineAt");

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Backfill source для существующих sessions
--    Порядок важен: сначала WAR/TOURNAMENT (точные привязки), потом BOT,
--    в конце PRIVATE/PUBLIC по флагу isPrivate.
-- ─────────────────────────────────────────────────────────────────────────

-- WAR-партии: linked через war_battles.session_id
UPDATE "sessions" s SET
  "sourceType"  = 'WAR',
  "sourceRefId" = wb."warId",
  "deadlineAt"  = COALESCE(s."deadlineAt", s."createdAt" + interval '24 hours')
FROM "war_battles" wb
WHERE wb."sessionId" = s.id;

-- TOURNAMENT-партии: linked через tournament_matches.sessionId
UPDATE "sessions" s SET
  "sourceType"  = 'TOURNAMENT',
  "sourceRefId" = tm."tournamentId",
  "deadlineAt"  = COALESCE(s."deadlineAt", s."createdAt" + interval '24 hours')
FROM "tournament_matches" tm
WHERE tm."sessionId" = s.id;

-- BOT-партии: type=BOT
UPDATE "sessions" SET "sourceType" = 'BOT_PRACTICE'
WHERE "type" = 'BOT' AND "sourceType" = 'PUBLIC';

-- Остальные BATTLE WAITING_FOR_OPPONENT / IN_PROGRESS — по флагу isPrivate
UPDATE "sessions" SET
  "sourceType"  = CASE WHEN "isPrivate" THEN 'PRIVATE'::"SessionSource" ELSE 'PUBLIC'::"SessionSource" END,
  "deadlineAt"  = COALESCE("deadlineAt", "createdAt" + interval '30 days')
WHERE "type" = 'BATTLE'
  AND "sourceType" = 'PUBLIC'
  AND ("deadlineAt" IS NULL);

-- acceptedByAll: для IN_PROGRESS / FINISHED / DRAW / TIME_EXPIRED partий = true
-- (оба уже играли); для WAITING_FOR_OPPONENT = false (старт ещё не случился).
UPDATE "sessions" SET "acceptedByAll" = true
WHERE "status" IN ('IN_PROGRESS', 'FINISHED', 'DRAW', 'TIME_EXPIRED');

-- ─────────────────────────────────────────────────────────────────────────
-- 4. CountryMember: warWinsCurrent (per-war счётчик)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "country_members"
  ADD COLUMN IF NOT EXISTS "warWinsCurrent" INTEGER NOT NULL DEFAULT 0;
