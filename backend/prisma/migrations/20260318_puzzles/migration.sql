-- CreateTable: puzzles
CREATE TABLE "puzzles" (
    "id" TEXT NOT NULL,
    "fen" TEXT NOT NULL,
    "moves" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rating" INTEGER NOT NULL,
    "themes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "reward" BIGINT NOT NULL,
    "isDaily" BOOLEAN NOT NULL DEFAULT false,
    "dailyDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "puzzles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "completed_puzzles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "solvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reward" BIGINT NOT NULL,
    CONSTRAINT "completed_puzzles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "puzzles_rating_idx" ON "puzzles"("rating");
CREATE INDEX "puzzles_isDaily_dailyDate_idx" ON "puzzles"("isDaily", "dailyDate");
CREATE UNIQUE INDEX "completed_puzzles_userId_puzzleId_key" ON "completed_puzzles"("userId", "puzzleId");
CREATE INDEX "completed_puzzles_userId_idx" ON "completed_puzzles"("userId");

ALTER TABLE "completed_puzzles"
    ADD CONSTRAINT "completed_puzzles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "completed_puzzles"
    ADD CONSTRAINT "completed_puzzles_puzzleId_fkey"
    FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
