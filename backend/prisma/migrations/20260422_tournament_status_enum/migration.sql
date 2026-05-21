-- 2026-04-22: синхронизация tournaments.status с Prisma-схемой.
-- До этой миграции колонка была text, Prisma-схема объявляла enum TournamentStatus.
-- Prisma findFirst с { status: { in: [...] } } падал:
--   operator does not exist: text = "TournamentStatus"
-- Идемпотентно: если колонка уже enum — ALTER TYPE ничего не меняет.

DO $$
BEGIN
  IF (
    SELECT data_type
    FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'status'
  ) = 'text' THEN
    ALTER TABLE "tournaments" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "tournaments"
      ALTER COLUMN "status" TYPE "TournamentStatus"
      USING "status"::"TournamentStatus";
    ALTER TABLE "tournaments"
      ALTER COLUMN "status" SET DEFAULT 'REGISTRATION'::"TournamentStatus";
  END IF;
END$$;
