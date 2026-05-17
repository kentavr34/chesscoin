-- Идемпотентная синхронизация enum "TransactionType" со схемой Prisma.
-- 2026-05-15: на проде вручную добавляли 5 значений после того, как cron
-- checkTournamentResults падал на отсутствующих enum-вариантах. Эта миграция
-- фиксирует тот же ALTER в репозитории, чтобы reset / fresh DB / новый
-- инстанс не возвращали неполный enum.
--
-- Используем DO-блок с `EXCEPTION WHEN duplicate_object` — Postgres гарантирует,
-- что повторный запуск не падает, даже если значение уже добавлено.

DO $$ BEGIN
  ALTER TYPE "TransactionType" ADD VALUE 'TOURNAMENT_WIN';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE "TransactionType" ADD VALUE 'BATTLE_DONATION';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE "TransactionType" ADD VALUE 'CLAN_WAR_WIN';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE "TransactionType" ADD VALUE 'TON_DEPOSIT';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE "TransactionType" ADD VALUE 'WALLET_UNLOCK';
EXCEPTION WHEN duplicate_object THEN null; END $$;
