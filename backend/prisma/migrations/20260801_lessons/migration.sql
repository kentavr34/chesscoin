-- Уроки обучения (Кенан 01.08.2026).
-- Линейка от простого к сложному; тексты — ключами в ui_texts.
CREATE TABLE IF NOT EXISTS "lessons" (
    "id"         INTEGER PRIMARY KEY,
    "block"      TEXT NOT NULL,
    "titleKey"   TEXT NOT NULL,
    "explainKey" TEXT NOT NULL,
    "fen"        TEXT NOT NULL,
    "moves"      TEXT[] NOT NULL,
    "reward"     BIGINT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "lessons_block_idx" ON "lessons"("block");
