-- У Джарвиса больше нет своего счёта (Кенан 31.07.2026).
--
-- «Джарвис не должен иметь своего счёта — он играет от нашего счёта.»
--
-- На балансе бота лежал 1 000 002 124 999 монет — в десять раз больше всего
-- заявленного капитала в 100 млрд. Эти монеты никогда не были частью капитала:
-- бот выдавал из них выигрыши, печатая деньги мимо эмиссии. Теперь награды за
-- победу над ботом платит счёт платформы, а сам бот обнуляется.
--
-- Обнуляем закрывающей проводкой, а не молча: правило «баланс равен сумме
-- транзакций» должно выполняться и для бота.
INSERT INTO transactions (id, "userId", type, amount, payload, "createdAt")
SELECT
    gen_random_uuid()::text,
    u.id,
    'TREASURY_OPENING',
    -(u.balance + COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t."userId" = u.id), 0) - u.balance),
    jsonb_build_object(
      'reason', 'jarvis_account_closed',
      'note', 'Счёт бота закрыт: за Джарвиса платит счёт платформы',
      'previousBalance', u.balance::text
    ),
    now()
FROM users u
WHERE u."telegramId" = '0' AND u."isBot" = true AND u.balance <> 0;

-- Закрывающая проводка обнуляет историю бота целиком.
UPDATE transactions SET amount = -(
    SELECT COALESCE(SUM(t2.amount), 0) FROM transactions t2
    WHERE t2."userId" = transactions."userId" AND t2.id <> transactions.id
)
WHERE payload->>'reason' = 'jarvis_account_closed';

UPDATE users SET balance = 0 WHERE "telegramId" = '0' AND "isBot" = true;
