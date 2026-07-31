-- Поправка открывающего баланса казны.
--
-- Открывающая проводка считала обращение только по балансам игроков и не
-- учла монеты, лежащие в казнах стран и призовых фондах турниров. Из-за этого
-- капитал получался больше 100 млрд ровно на эту сумму.
--
-- Списываем излишек с казны отдельной проводкой, а не правкой прежней:
-- история должна показывать, что была ошибка и как её поправили.
WITH extra AS (
    SELECT
        COALESCE((SELECT SUM(treasury) FROM countries), 0)
      + COALESCE((SELECT SUM("prizePool") + SUM("donationPool") FROM tournaments
                  WHERE status IN ('REGISTRATION','IN_PROGRESS')), 0) AS amount
)
INSERT INTO transactions (id, "userId", type, amount, payload, "createdAt")
SELECT
    gen_random_uuid()::text,
    (SELECT id FROM users WHERE "telegramId" = 'platform_treasury'),
    'TREASURY_OPENING',
    -(SELECT amount FROM extra),
    jsonb_build_object(
      'reason', 'opening_correction',
      'note', 'Открывающий баланс не учитывал казны стран и фонды турниров'
    ),
    now()
WHERE (SELECT amount FROM extra) > 0
  AND NOT EXISTS (
    SELECT 1 FROM transactions t
    JOIN users u ON u.id = t."userId"
    WHERE u."telegramId" = 'platform_treasury' AND t.payload->>'reason' = 'opening_correction'
  );

UPDATE users SET balance = (
    SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t."userId" = users.id
)
WHERE "telegramId" = 'platform_treasury';
