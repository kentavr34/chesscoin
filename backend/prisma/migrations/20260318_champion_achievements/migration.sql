-- Чемпион месяца
ALTER TABLE "users" ADD COLUMN "isMonthlyChampion" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "monthlyChampionAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "monthlyChampionType" TEXT;

-- Достижения и бейджи
ALTER TABLE "users" ADD COLUMN "achievements" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "users" ADD COLUMN "tournamentBadges" JSONB NOT NULL DEFAULT '[]';

-- Индекс для быстрого поиска чемпиона
CREATE INDEX "users_isMonthlyChampion_idx" ON "users"("isMonthlyChampion");
