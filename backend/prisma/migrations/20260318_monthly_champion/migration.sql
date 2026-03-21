-- Migration: Monthly Champion fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isMonthlyChampion" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "monthlyChampionAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "monthlyChampionType" TEXT;
