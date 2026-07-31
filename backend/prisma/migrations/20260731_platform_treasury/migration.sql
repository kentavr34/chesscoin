-- Счёт платформы (Кенан 31.07.2026).
--
-- «Сделай отдельный счёт нашей платформы, чтобы пересчёт с нашего счёта на счёт
-- клиентов и обратно шёл по чистой и чёткой бухгалтерии. Сейчас у нас просто
-- идут начисления, а не внутренние транзакции.»
--
-- Заводим настоящий аккаунт-казну. С этого момента продажа монет игроку — это
-- перевод между двумя счетами с двумя записями в истории, а не появление монет
-- из ниоткуда. Баланс казны обеспечен открывающей проводкой, поэтому правило
-- «баланс равен сумме транзакций» выполняется и для неё.
--
-- Общий капитал 100 млрд. В обращении у игроков — то, что уже выдано.
-- Казна = 100 млрд минус обращение.

-- Отдельный тип проводки: открывающий баланс казны — не награда и не покупка,
-- он должен читаться в истории своим именем.
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'TREASURY_OPENING';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'TREASURY_SALE';
INSERT INTO users (id, "telegramId", "firstName", balance, "isBot", "createdAt", "updatedAt", "attemptSlots")
SELECT
    'platform-treasury-0000-0000-000000000001',
    'platform_treasury',
    'ChessCoin',
    0,
    true,            -- служебный: не попадает в рейтинги и статистику игроков
    now(), now(), '{}'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE "telegramId" = 'platform_treasury');

-- Открывающая проводка: столько монет казна получает при заведении счёта.
-- Считаем от общего капитала за вычетом того, что уже на руках у живых игроков.
WITH circulation AS (
    SELECT COALESCE(SUM(balance), 0)::bigint AS coins
    FROM users
    WHERE "isBot" = false AND "telegramId" <> 'platform_treasury'
), opening AS (
    SELECT (100000000000::bigint - (SELECT coins FROM circulation)) AS amount
)
INSERT INTO transactions (id, "userId", type, amount, payload, "createdAt")
SELECT
    gen_random_uuid()::text,
    (SELECT id FROM users WHERE "telegramId" = 'platform_treasury'),
    'TREASURY_OPENING',
    (SELECT amount FROM opening),
    jsonb_build_object(
      'reason', 'opening_balance',
      'note', 'Открывающая проводка счёта платформы: общий капитал 100 млрд минус обращение'
    ),
    now()
WHERE NOT EXISTS (
    SELECT 1 FROM transactions t
    JOIN users u ON u.id = t."userId"
    WHERE u."telegramId" = 'platform_treasury' AND t.payload->>'reason' = 'opening_balance'
);

-- Баланс казны = сумма её транзакций.
UPDATE users SET balance = (
    SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t."userId" = users.id
)
WHERE "telegramId" = 'platform_treasury';
