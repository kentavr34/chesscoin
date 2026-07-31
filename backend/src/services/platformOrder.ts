/**
 * Постоянный ордер платформы на бирже (Кенан 31.07.2026).
 *
 * «Пусть эти монеты вращаются по циклу. Автоматически один из ордеров,
 * постоянный ордер, пока все 100 миллиардов не будут распроданы. Этот ордер
 * может находиться в постоянном доступе. Сейчас 1 тонн равняется 100 тысяч
 * монет. Если кто-то продаёт дешевле, то наш ордер оказывается ниже по стакану.»
 *
 * Устроено намеренно просто: это ОБЫЧНЫЙ SELL-ордер от счёта платформы.
 * Никаких особых веток в горячем пути — покупка у платформы идёт тем же кодом,
 * что и покупка у игрока: та же проверка платежа в блокчейне, то же частичное
 * исполнение, та же бухгалтерия. Отличается только продавец.
 *
 * Монеты при выставлении замораживаются со счёта казны, как у любого продавца,
 * поэтому «баланс равен сумме транзакций» выполняется и для платформы.
 */
import { TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger, logError } from "@/lib/logger";
import { updateBalance } from "@/services/economy";
import config from "@/config";

export const TREASURY_TELEGRAM_ID = "platform_treasury";

// Базовый курс: 1 TON = 100 000 монет. В ордере цена указывается за миллион
// монет, значит миллион стоит 10 TON.
export const BASE_PRICE_TON_PER_MILLION = 10;

// Размер витрины. Весь резерв в один ордер класть нельзя: покупателю
// показывают объём ордера, и «99 миллиардов» в стакане выглядят как ошибка.
// Ордер пополняется по мере раскупания — до тех пор, пока в казне есть монеты.
const SHOWCASE_COINS = 10_000_000n;

// Ниже этого остатка ордер считаем «подъеденным» и досыпаем до витрины.
const REFILL_BELOW = 2_000_000n;

/**
 * Поддерживать в стакане один открытый ордер платформы.
 * Вызывается из cron и безопасен к повторному запуску.
 */
export async function ensurePlatformOrder(): Promise<void> {
  try {
    const treasury = await prisma.user.findUnique({
      where: { telegramId: TREASURY_TELEGRAM_ID },
      select: { id: true, balance: true, tonWalletAddress: true },
    });
    if (!treasury) return; // счёт платформы ещё не заведён — миграция не применена

    const platformWallet = config.ton.platformWallet;
    if (!platformWallet) {
      logger.warn("[PlatformOrder] PLATFORM_TON_WALLET не задан — ордер не выставляем");
      return;
    }

    // Кошелёк казны — кошелёк платформы: покупатель платит напрямую на него.
    // Платформа по-прежнему только принимает и ничего не отправляет.
    if (treasury.tonWalletAddress !== platformWallet) {
      await prisma.user.update({
        where: { id: treasury.id },
        data: { tonWalletAddress: platformWallet, tonConnectedAt: new Date() },
      });
    }

    const open = await prisma.p2POrder.findFirst({
      where: { sellerId: treasury.id, status: "OPEN", orderType: "SELL" },
      select: { id: true, amountCoins: true },
    });

    // Ордер на месте и достаточно полный — ничего не делаем.
    if (open && open.amountCoins >= REFILL_BELOW) return;

    const wanted = open ? SHOWCASE_COINS - open.amountCoins : SHOWCASE_COINS;
    const amount = treasury.balance < wanted ? treasury.balance : wanted;
    if (amount <= 0n) {
      // Казна пуста — все 100 млрд распроданы. Это не ошибка, а конец эмиссии.
      if (!open) logger.info("[PlatformOrder] Казна пуста, новый ордер не выставляем");
      return;
    }

    const totalTon = (Number(amount) / 1_000_000) * BASE_PRICE_TON_PER_MILLION;

    await prisma.$transaction(async (tx) => {
      // Монеты уходят с баланса казны в заморозку — как у любого продавца.
      await updateBalance(treasury.id, -amount, TransactionType.EXCHANGE_FREEZE,
        { action: "freeze_platform_order" }, { tx });

      if (open) {
        // Досыпаем существующий ордер, чтобы не плодить строки в стакане.
        await tx.p2POrder.update({
          where: { id: open.id },
          data: {
            amountCoins: open.amountCoins + amount,
            totalTon: (Number(open.amountCoins + amount) / 1_000_000) * BASE_PRICE_TON_PER_MILLION,
          },
        });
      } else {
        await tx.p2POrder.create({
          data: {
            orderType: "SELL",
            sellerId: treasury.id,
            amountCoins: amount,
            priceTon: BASE_PRICE_TON_PER_MILLION,
            totalTon,
            feeTon: totalTon * 0.005,
            sellerWallet: platformWallet,
            status: "OPEN",
          },
        });
      }
    });

    logger.info(`[PlatformOrder] Витрина пополнена на ${amount} ᚙ по ${BASE_PRICE_TON_PER_MILLION} TON/1M`);
  } catch (err: unknown) {
    logError("[PlatformOrder]", err);
  }
}
