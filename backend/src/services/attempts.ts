import cron from "node-cron";
import { logger, logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import config from "@/config";
import { updateBalance } from "@/services/economy";
import { TransactionType } from "@prisma/client";

// ─────────────────────────────────────────
// Использовать попытку (при старте игры)
// ─────────────────────────────────────────
export const useAttempt = async (userId: string, tx?: import("@prisma/client").Prisma.TransactionClient): Promise<void> => {
  const db = tx ?? prisma;
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.attempts <= 0) {
    throw new Error("Not enough attempts. Wait for recovery or buy more.");
  }

  await db.user.update({
    where: { id: userId },
    data: { attempts: { decrement: 1 } },
  });
};

// ─────────────────────────────────────────
// Купить попытки (до максимума 3)
// ─────────────────────────────────────────
export const purchaseAttempts = async (
  userId: string,
  count: number
): Promise<void> => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const max = config.economy.maxAttempts;

  const canBuy = max - user.attempts;
  if (canBuy <= 0) {
    throw new Error("You already have max attempts.");
  }

  const actualCount = Math.min(count, canBuy);
  const totalCost = config.economy.attemptPrice * BigInt(actualCount);

  if (user.balance < totalCost) {
    throw new Error(`Недостаточно монет. Нужно ${totalCost} ᚙ.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { balance: { decrement: totalCost }, totalSpent: { increment: totalCost }, attempts: { increment: actualCount } },
    });
    await tx.transaction.create({
      data: { userId, type: TransactionType.ATTEMPT_PURCHASE, amount: -totalCost, payload: { count: actualCount } },
    });
  });
};

// ─────────────────────────────────────────
// Единый серверный cron — каждые 8 часов
// +1 попытка ВСЕМ у кого < 3
// НЕ привязан к времени конкретного игрока
// ─────────────────────────────────────────
export const restoreAllAttempts = async (): Promise<void> => {
  const max = config.economy.maxAttempts;

  const result = await prisma.user.updateMany({
    where: {
      isBot: false,
      isBanned: false,
      attempts: { lt: max },
    },
    data: {
      attempts: { increment: 1 },
    },
  });

  // Убеждаемся что никто не превысил максимум
  await prisma.user.updateMany({
    where: {
      attempts: { gt: max },
    },
    data: {
      attempts: max,
    },
  });

  logger.info(`[Attempts] ✅ Restored +1 for ${result.count} users (max=${max})`);
};

// ─────────────────────────────────────────
// Запуск cron — каждые 8 часов в 00, 08, 16
// ─────────────────────────────────────────
export const startAttemptsCron = (): void => {
  // 0 0,8,16 * * *  → в полночь, 8 утра, 16 часов (UTC)
  cron.schedule("0 0,8,16 * * *", async () => {
    logger.info("[Attempts] Cron tick — restoring...");
    await restoreAllAttempts().catch((err) =>
      logger.error("[Attempts Cron] Error:", err)
    );
  });

  logger.info("[Attempts] Cron started: +1 every 8h (00:00, 08:00, 16:00 UTC)");
};

// ─────────────────────────────────────────
// Проверить попытки при входе в приложение
// (просто возвращаем текущее состояние —
//  восстановление идёт глобально по cron)
// ─────────────────────────────────────────
export const checkAndRestoreUserAttempts = async (userId: string) => {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, attempts: true, maxAttempts: true },
  });
};

// ─────────────────────────────────────────
// Получить сколько секунд до следующего
// восстановления (для UI таймера)
// ─────────────────────────────────────────
export const getSecondsUntilNextRestore = (): number => {
  const now = new Date();
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  const s = now.getUTCSeconds();

  // Ближайшее время восстановления: 0, 8, 16 UTC
  const nextHour = [0, 8, 16].find((x) => x > h) ?? 24;
  const diffH = nextHour - h;
  return diffH * 3600 - m * 60 - s;
};
