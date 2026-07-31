/**
 * Счёт платформы: все монеты приходят и уходят отсюда.
 *
 * Кенан 31.07.2026: «Джарвис не должен иметь своего счёта — он играет от
 * нашего счёта. В обращении должно быть 100 млрд. Где за Джарвиса платим мы —
 * и за реферал, и за задания, и за обучение. С нашего счёта игрокам, и со
 * счёта игроков нам — комиссия стола 10% при всех играх, продажа аватаров и
 * прочих украшательств в магазине.»
 *
 * До этого награды просто дописывались игроку на баланс: монеты возникали из
 * ниоткуда, и проследить, откуда они взялись, было невозможно. Теперь любая
 * выдача — перевод со счёта платформы, любой сбор — перевод на него. Две
 * записи в истории на каждое движение, капитал остаётся равным 100 млрд.
 */
import { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger, logError } from "@/lib/logger";
import { updateBalance } from "@/services/economy";

export const TREASURY_TELEGRAM_ID = "platform_treasury";

/** Весь выпуск монет ограничен этой суммой. */
export const TOTAL_CAPITAL = 100_000_000_000n;

let cachedTreasuryId: string | null = null;

/** id счёта платформы. Кэшируем: он не меняется за время жизни процесса. */
export async function getTreasuryId(): Promise<string | null> {
  if (cachedTreasuryId) return cachedTreasuryId;
  const t = await prisma.user.findUnique({
    where: { telegramId: TREASURY_TELEGRAM_ID },
    select: { id: true },
  });
  cachedTreasuryId = t?.id ?? null;
  return cachedTreasuryId;
}

type Tx = { tx?: Prisma.TransactionClient };

/**
 * Выдать игроку монеты СО СЧЁТА ПЛАТФОРМЫ.
 *
 * Если в казне не хватает — выдаём столько, сколько есть, и громко пишем в лог:
 * молча напечатать недостающее было бы возвратом к старому поведению, а тихо
 * отказать — потерять награду игрока.
 */
export async function payFromTreasury(
  userId: string,
  amount: bigint,
  type: TransactionType,
  payload: Record<string, unknown> = {},
  opts: Tx = {},
): Promise<bigint> {
  if (amount <= 0n) return 0n;

  const treasuryId = await getTreasuryId();
  if (!treasuryId) {
    // Счёт ещё не заведён (миграция не применена) — ведём себя как раньше,
    // чтобы игра не встала, но оставляем след.
    logger.error("[Treasury] Счёт платформы не найден — выдача без списания");
    await updateBalance(userId, amount, type, payload, opts);
    return amount;
  }
  if (treasuryId === userId) return 0n; // сам себе не платит

  const client = opts.tx ?? prisma;
  const treasury = await client.user.findUnique({
    where: { id: treasuryId },
    select: { balance: true },
  });
  const available = treasury?.balance ?? 0n;
  const paid = available < amount ? available : amount;

  if (paid < amount) {
    logError("[Treasury] Казна пуста", new Error(
      `запрошено ${amount}, доступно ${available} — выдано ${paid}`));
  }
  if (paid <= 0n) return 0n;

  await updateBalance(treasuryId, -paid, type,
    { ...payload, direction: "to_player", playerId: userId }, opts);
  await updateBalance(userId, paid, type, payload, opts);

  // Счётчики эмиссии остаются на месте: на них смотрят админка и лимит
  // выпуска. Раньше их двигал флаг isEmission у каждого начисления — теперь
  // источник истины один, сам перевод со счёта платформы.
  await client.platformConfig.update({
    where: { id: "singleton" },
    data: { totalEmitted: { increment: paid }, platformReserve: { decrement: paid } },
  }).catch(err => logError("[Treasury] счётчики эмиссии", err));

  return paid;
}

/**
 * Забрать монеты у игрока НА СЧЁТ ПЛАТФОРМЫ: комиссия стола, покупки в
 * магазине, проигрыш боту. Раньше такие монеты просто исчезали с баланса.
 */
export async function collectToTreasury(
  userId: string,
  amount: bigint,
  type: TransactionType,
  payload: Record<string, unknown> = {},
  opts: Tx = {},
): Promise<void> {
  if (amount <= 0n) return;

  const treasuryId = await getTreasuryId();
  if (treasuryId === userId) return;

  await updateBalance(userId, -amount, type, payload, opts);
  if (!treasuryId) {
    logger.error("[Treasury] Счёт платформы не найден — списание без зачисления");
    return;
  }
  await updateBalance(treasuryId, amount, type,
    { ...payload, direction: "from_player", playerId: userId }, opts);
}
