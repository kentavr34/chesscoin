-- Добавляем поле для хранения дат получения JARVIS бейджей
-- {"Beginner":"2026-03-14","Player":"2026-03-15",...}
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "jarvisBadgeDates" JSONB NOT NULL DEFAULT '{}';
