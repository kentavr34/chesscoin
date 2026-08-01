-- Фантомные кассы завершённых турниров (Кенан 01.08.2026).
--
-- Приз выплачивался, но число в строке турнира не обнулялось: в FINISHED
-- турнирах висело около 6 млн монет, которых нигде нет. Пока такие строки
-- существуют, капитал не сходится, а отчёт врёт.
UPDATE tournaments SET "prizePool" = 0, "donationPool" = 0
WHERE status = 'FINISHED' AND ("prizePool" > 0 OR "donationPool" > 0);

-- Приводим счёт платформы к тождеству: обращение + казна = 100 млрд.
-- Расхождение появилось от выплат, у которых не было встречного списания
-- (призы турниров платились «из воздуха», комиссия уходила в счётчик).
-- Правим отдельной проводкой, чтобы в истории осталась и ошибка, и поправка.
WITH parts AS (
  SELECT
    (SELECT COALESCE(SUM(balance), 0) FROM users
      WHERE "isBot" = false AND "telegramId" <> 'platform_treasury') AS players,
    (SELECT COALESCE(SUM("amountCoins"), 0) FROM p2p_orders o
      JOIN users u ON u.id = o."sellerId"
      WHERE o.status = 'OPEN' AND o."orderType" = 'SELL'
        AND u."telegramId" <> 'platform_treasury') AS frozen,
    (SELECT COALESCE(SUM("amountCoins"), 0) FROM p2p_orders o
      JOIN users u ON u.id = o."sellerId"
      WHERE o.status = 'OPEN' AND o."orderType" = 'SELL'
        AND u."telegramId" = 'platform_treasury') AS showcase,
    (SELECT COALESCE(SUM(treasury), 0) FROM countries) AS countries,
    (SELECT COALESCE(SUM("prizePool") + SUM("donationPool"), 0) FROM tournaments
      WHERE status IN ('REGISTRATION','IN_PROGRESS')) AS tours,
    (SELECT balance FROM users WHERE "telegramId" = 'platform_treasury') AS treasury
), delta AS (
  SELECT 100000000000::bigint
         - (players + frozen + countries + tours + showcase + treasury) AS amount
  FROM parts
)
INSERT INTO transactions (id, "userId", type, amount, payload, "createdAt")
SELECT gen_random_uuid()::text,
       (SELECT id FROM users WHERE "telegramId" = 'platform_treasury'),
       'TREASURY_OPENING',
       (SELECT amount FROM delta),
       jsonb_build_object(
         'reason', 'capital_realign',
         'note', 'Выравнивание после фантомных касс турниров'
       ),
       now()
WHERE (SELECT amount FROM delta) <> 0;

UPDATE users SET balance = (
  SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t."userId" = users.id
) WHERE "telegramId" = 'platform_treasury';
