-- Структуризация войн стран: взнос за вступление + донаты в казну + персональный вклад

-- Вклад игрока в казну страны (взнос за вступление + донаты)
ALTER TABLE "country_members" ADD COLUMN IF NOT EXISTS "contribution" BIGINT NOT NULL DEFAULT 0;

-- Новые типы транзакций (если ещё не существуют)
DO $$ BEGIN
  ALTER TYPE "TransactionType" ADD VALUE 'COUNTRY_ENTRY';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE "TransactionType" ADD VALUE 'COUNTRY_DONATION';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Индекс на contribution для быстрых выборок «лучших донаторов»
CREATE INDEX IF NOT EXISTS "country_members_countryId_contribution_idx"
  ON "country_members"("countryId", "contribution" DESC);
