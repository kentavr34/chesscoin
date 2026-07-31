-- Подтверждение TON-кошелька (Кенан 31.07.2026).
--
-- Правило: оплата 1 TON — единоразовая и привязана к АДРЕСУ, а не к аккаунту.
-- Оплатил за адрес — этот кошелёк подключается бесплатно всегда, сколько бы
-- раз ни переподключался. Захотел привязать ДРУГОЙ адрес — это ещё один
-- кошелёк, его надо подтверждать отдельно, ещё за 1 TON.
CREATE TABLE IF NOT EXISTS "ton_wallet_confirmations" (
    "id"            TEXT PRIMARY KEY,
    "userId"        TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "txHash"        TEXT,               -- хэш платежа; NULL у унаследованных
    "confirmedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ton_wallet_confirmations_user_wallet_key" UNIQUE ("userId", "walletAddress")
);

CREATE INDEX IF NOT EXISTS "ton_wallet_confirmations_userId_idx"
    ON "ton_wallet_confirmations"("userId");

-- Кошельки, привязанные ДО введения платы, считаем подтверждёнными: закрываем
-- дыру на будущее, не отключая тех, кто уже пользовался.
INSERT INTO "ton_wallet_confirmations" ("id", "userId", "walletAddress", "txHash", "confirmedAt")
SELECT gen_random_uuid()::text, u.id, u."tonWalletAddress", NULL, COALESCE(u."tonConnectedAt", now())
FROM users u
WHERE u."tonWalletAddress" IS NOT NULL
ON CONFLICT ("userId", "walletAddress") DO NOTHING;
