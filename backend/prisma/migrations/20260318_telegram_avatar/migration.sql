-- Migration: добавляем поле telegramAvatar для хранения оригинального аватара из Telegram
-- Это позволяет восстановить Telegram-аватар после снятия премиум-аватара из магазина

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegramAvatar" TEXT;

-- Заполняем существующим avatar у пользователей с типом TELEGRAM
UPDATE "users" SET "telegramAvatar" = "avatar" WHERE "avatarType" = 'TELEGRAM' AND "avatar" IS NOT NULL;
