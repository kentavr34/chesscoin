-- BUY-ордер теперь исполняется в два шага: продавец резервирует и замораживает
-- монеты, покупатель платит TON и только тогда монеты уходят. Раньше один шаг
-- /fill отдавал монеты по непроверяемому псевдо-хэшу (найдено 30.07.2026).
--
-- Аддитивно: новое значение енума и новая nullable-колонка. Существующие
-- ордера не трогаются.

-- ALTER TYPE ... ADD VALUE нельзя выполнять внутри транзакции в старых версиях
-- Postgres, поэтому IF NOT EXISTS и отдельным стейтментом.
ALTER TYPE "P2POrderStatus" ADD VALUE IF NOT EXISTS 'RESERVED';

ALTER TABLE "p2p_orders" ADD COLUMN IF NOT EXISTS "reservedAt" TIMESTAMP(3);
