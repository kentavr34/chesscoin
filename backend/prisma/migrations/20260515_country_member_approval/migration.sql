-- B.3 MASTER_PLAN: approve/reject вступления в страну главкомом.
-- Добавляем статус заявки. APPROVED — для всех существующих (default),
-- так как они уже в стране со списанным взносом.

DO $$ BEGIN
  CREATE TYPE "CountryMemberStatus" AS ENUM ('PENDING', 'APPROVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "country_members"
  ADD COLUMN IF NOT EXISTS "status" "CountryMemberStatus" NOT NULL DEFAULT 'APPROVED';

CREATE INDEX IF NOT EXISTS "country_members_countryId_status_idx"
  ON "country_members"("countryId", "status");
