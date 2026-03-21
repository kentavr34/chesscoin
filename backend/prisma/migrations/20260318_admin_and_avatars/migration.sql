-- Migration: isAdmin field + PREMIUM_AVATAR in ItemType

-- 1. isAdmin на пользователе
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- 2. PREMIUM_AVATAR в ItemType (если не добавлен предыдущей миграцией)
DO $$ BEGIN
  ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'PREMIUM_AVATAR';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. telegramAvatar (если не добавлен предыдущей миграцией)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegramAvatar" TEXT;

UPDATE "users" SET "telegramAvatar" = "avatar"
WHERE "avatarType" = 'TELEGRAM' AND "avatar" IS NOT NULL AND "telegramAvatar" IS NULL;
