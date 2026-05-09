-- Sprint 4: Swiss-system tournaments + 24h autoloss
ALTER TABLE "tournament_matches" ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMP(3);
ALTER TABLE "tournament_matches" ADD COLUMN IF NOT EXISTS "points" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "tournament_matches" ADD COLUMN IF NOT EXISTS "buchholz" DOUBLE PRECISION NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "tournament_matches_deadline_idx" ON "tournament_matches"("deadline");
