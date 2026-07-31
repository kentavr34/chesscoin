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
 * Пороги ужесточения выдачи (Кенан 31.07.2026).
 *
 * «При расходе более тридцати миллиардов будем внедрять новые механизмы:
 * раздача уменьшается, обратный закуп увеличивается. После шестидесяти
 * миллиардов — ещё жёстче: одаривать только за рефералку, всё остальное
 * переходит на спарринг, где игрок получает только выигранное, а не подаренное.»
 *
 * Пока это только наблюдение: цифра показывается в статистике, автоматика
 * ничего не меняет. Механизмы внедряем по слову Кенана, когда порог подойдёт.
 */
export const PHASE_THRESHOLDS = {
  soft: 30_000_000_000n,  // раздача уменьшается, обратный закуп растёт
  hard: 60_000_000_000n,  // подарки только за рефералку, остальное — ставки
};

export interface CirculationStats {
  capital: string;          // весь капитал, 100 млрд
  circulation: string;      // сколько монет реально на руках
  circulationPercent: number;
  treasury: string;         // не выпущено: счёт платформы + его витрина
  playersBalance: string;   // на балансах игроков
  frozenInOrders: string;   // заморожено в ордерах игроков на бирже
  countriesTreasury: string;
  tournamentsPool: string;
  showcase: string;         // витрина платформы в стакане
  phase: "free" | "soft" | "hard"; // достигнутый порог ужесточения
  nextThreshold: string | null;
  balanced: boolean;        // обращение + казна = капитал
}

/**
 * Монеты в обращении — для статистики (Кенан 31.07.2026: «добавь элемент про
 * монеты в обращении в статистику, чтобы я мог её получать»).
 *
 * Обращение — это всё, что уже ушло со счёта платформы: балансы игроков,
 * их замороженные в ордерах монеты, казны стран и призовые фонды турниров.
 * Резерв платформы обращением НЕ является — раньше он в эту цифру входил,
 * и «в обращении» показывало почти весь капитал.
 */
export async function getCirculationStats(): Promise<CirculationStats> {
  const treasuryId = await getTreasuryId();

  const [players, treasuryUser, orders, countries, tournaments] = await Promise.all([
    prisma.user.aggregate({
      _sum: { balance: true },
      where: { isBot: false, ...(treasuryId ? { id: { not: treasuryId } } : {}) },
    }),
    treasuryId
      ? prisma.user.findUnique({ where: { id: treasuryId }, select: { balance: true } })
      : Promise.resolve(null),
    prisma.p2POrder.groupBy({
      by: ["sellerId"],
      where: { status: "OPEN", orderType: "SELL" },
      _sum: { amountCoins: true },
    }),
    prisma.country.aggregate({ _sum: { treasury: true } }),
    prisma.tournament.aggregate({
      _sum: { prizePool: true, donationPool: true },
      where: { status: { in: ["REGISTRATION", "IN_PROGRESS"] } },
    }),
  ]);

  const playersBalance = players._sum.balance ?? 0n;
  const treasuryBalance = treasuryUser?.balance ?? 0n;

  // Заморозку в ордерах делим: витрина платформы — это ещё не обращение.
  let showcase = 0n;
  let frozenInOrders = 0n;
  for (const row of orders) {
    const sum = row._sum.amountCoins ?? 0n;
    if (treasuryId && row.sellerId === treasuryId) showcase += sum;
    else frozenInOrders += sum;
  }

  const countriesTreasury = countries._sum.treasury ?? 0n;
  const tournamentsPool =
    (tournaments._sum.prizePool ?? 0n) + (tournaments._sum.donationPool ?? 0n);

  const circulation = playersBalance + frozenInOrders + countriesTreasury + tournamentsPool;
  const notIssued = treasuryBalance + showcase;

  const phase: CirculationStats["phase"] =
    circulation >= PHASE_THRESHOLDS.hard ? "hard"
    : circulation >= PHASE_THRESHOLDS.soft ? "soft"
    : "free";
  const nextThreshold =
    phase === "free" ? PHASE_THRESHOLDS.soft
    : phase === "soft" ? PHASE_THRESHOLDS.hard
    : null;

  return {
    capital: TOTAL_CAPITAL.toString(),
    circulation: circulation.toString(),
    // Доля обращения от капитала с точностью до сотой процента.
    circulationPercent: Number((circulation * 10_000n) / TOTAL_CAPITAL) / 100,
    treasury: notIssued.toString(),
    playersBalance: playersBalance.toString(),
    frozenInOrders: frozenInOrders.toString(),
    countriesTreasury: countriesTreasury.toString(),
    tournamentsPool: tournamentsPool.toString(),
    showcase: showcase.toString(),
    phase,
    nextThreshold: nextThreshold ? nextThreshold.toString() : null,
    balanced: circulation + notIssued === TOTAL_CAPITAL,
  };
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
