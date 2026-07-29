-- Защита от повторного зачисления одного и того же TON-платежа.
-- Аддитивно: новая таблица, существующие данные не трогаются.
CREATE TABLE IF NOT EXISTS "ton_deposits" (
    "txHash"        TEXT NOT NULL,
    "lt"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "valueNano"     BIGINT NOT NULL,
    "coinsCredited" BIGINT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ton_deposits_pkey" PRIMARY KEY ("txHash")
);
CREATE INDEX IF NOT EXISTS "ton_deposits_userId_idx" ON "ton_deposits"("userId");
