-- Migration: добавляем PREMIUM_AVATAR в ItemType enum
-- и поле telegramAvatar в таблицу users

-- 1. Добавляем новое значение в enum ItemType
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'PREMIUM_AVATAR';

-- 2. Поле telegramAvatar уже добавлено в миграции 20260318_telegram_avatar
-- (на случай если запускается отдельно)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegramAvatar" TEXT;

-- 3. Заполняем telegramAvatar из avatar для пользователей с TELEGRAM-типом
UPDATE "users" SET "telegramAvatar" = "avatar"
WHERE "avatarType" = 'TELEGRAM' AND "avatar" IS NOT NULL AND "telegramAvatar" IS NULL;
