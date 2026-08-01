-- Дефект 40: монеты за съеденную у Джарвиса фигуру дописывались игроку на
-- баланс без списания со счёта платформы. За сутки после открытия счёта так
-- напечаталось 1800 монет (8 начислений BOT_PIECE), и капитал перестал
-- сходиться: обращение + казна = 100 000 001 800 при капитале 100 млрд.
--
-- Код исправлен: выплата идёт через payFromTreasury. Здесь — исправление уже
-- случившегося. Монеты игрокам заработаны честно и остаются у них; недостающее
-- списание делаем с казны задним числом, как и должно было быть.
--
-- Кенан 01.08.2026: «война не должна генерировать монеты» — то же правило и
-- для игры с ботом: за Джарвиса платим мы.

DO $$
DECLARE
  t_id     text;
  opening  timestamp;
  unpaired bigint;
BEGIN
  SELECT id INTO t_id FROM users WHERE "telegramId" = 'platform_treasury';
  IF t_id IS NULL THEN
    RAISE NOTICE 'счёт платформы не найден — правка пропущена';
    RETURN;
  END IF;

  SELECT max("createdAt") INTO opening FROM transactions WHERE type = 'TREASURY_OPENING';

  -- Ровно то, что напечаталось после открытия счёта: сумма BOT_PIECE, которая
  -- не была уравновешена списанием с казны.
  SELECT coalesce(sum(amount), 0) INTO unpaired
  FROM transactions
  WHERE type = 'BOT_PIECE' AND "createdAt" > opening;

  IF unpaired <= 0 THEN
    RAISE NOTICE 'печати не было — правка не нужна';
    RETURN;
  END IF;

  UPDATE users SET balance = balance - unpaired WHERE id = t_id;

  INSERT INTO transactions (id, "userId", amount, type, payload, "createdAt")
  VALUES (gen_random_uuid()::text, t_id, -unpaired, 'BOT_PIECE',
          jsonb_build_object(
            'reason', 'correction_defect_40',
            'note', 'списание за уже выданные монеты за фигуры Джарвиса',
            'direction', 'to_player'),
          now());

  RAISE NOTICE 'казна уменьшена на % — капитал восстановлен', unpaired;
END $$;
