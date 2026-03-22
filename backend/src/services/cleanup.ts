import cron from "node-cron";
import { logger, logError } from "@/lib/logger"; // Q2
import { prisma } from "@/lib/prisma";
import { TransactionType } from "@prisma/client";

// ═══════════════════════════════════════════════════════════════
// CRON: Чистка мёртвых игроков + зависших батлов
// Запускается раз в месяц (1-го числа в 03:00 UTC)
// ═══════════════════════════════════════════════════════════════

export const cleanDeadPlayers = async (): Promise<void> => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  logger.info("[Cleanup] Starting dead player cleanup...");

  const dead = await prisma.user.findMany({
    where: {
      isBot: false,
      isBanned: false,
      referralActivated: false,
      createdAt: { lt: cutoff },
    },
    select: {
      id: true, telegramId: true, firstName: true,
      createdAt: true, balance: true,
    },
  });

  if (dead.length === 0) {
    logger.info("[Cleanup] No dead players found. All good.");
  } else {
    logger.info(`[Cleanup] Found ${dead.length} dead players to remove`);
    const deadIds = dead.map((u: Record<string,unknown>) => u.id);

    await prisma.analyticsCleanup.create({
      data: {
        removedCount: dead.length,
        removedAt: new Date(),
        snapshot: dead.map((u: Record<string,unknown>) => ({
          id: u.id, telegramId: u.telegramId, firstName: u.firstName,
          createdAt: (u.createdAt as Date).toISOString(), balance: (u.balance as bigint).toString(),
        })) as any,
      },
    });

    await prisma.user.deleteMany({ where: { id: { in: deadIds as string[] } } });
    logger.info(`[Cleanup] ✅ Removed ${dead.length} dead players`);

    await prisma.adminNotification.create({
      data: {
        type: "DEAD_PLAYERS_CLEANED",
        payload: { count: dead.length, cutoffDate: cutoff.toISOString() },
      },
    });
  }

  // B2: Чистка зависших батлов WAITING_FOR_OPPONENT старше 30 дней
  await cleanStaleBattles(cutoff);
};

// B2: Отменяем батлы в статусе WAITING_FOR_OPPONENT старше 30 дней
// и возвращаем ставку создателю
const cleanStaleBattles = async (cutoff: Date): Promise<void> => {
  logger.info("[Cleanup] Checking stale battles...");

  const staleBattles = await prisma.session.findMany({
    where: {
      status: "WAITING_FOR_OPPONENT",
      type: "BATTLE",
      createdAt: { lt: cutoff },
      bet: { gt: 0n },
    },
    include: {
      sides: { include: { player: { select: { id: true, firstName: true } } } },
    },
  });

  if (staleBattles.length === 0) {
    logger.info("[Cleanup] No stale battles found.");
    return;
  }

  logger.info(`[Cleanup] Found ${staleBattles.length} stale battles to cancel`);
  let refunded = 0;

  for (const battle of staleBattles) {
    const creator = battle.sides[0];
    try {
      // Q1 fix: возврат ставки + отмена батла в одной атомарной транзакции
      // Если сервер упадёт между операциями — откатится всё целиком
      await prisma.$transaction(async (tx: import("@prisma/client").Prisma.TransactionClient) => {
        // TAIL-1: используем REFUND — семантически правильный тип для возврата ставки
        if (creator && battle.bet > 0n) {
          await tx.user.update({
            where: { id: creator.playerId },
            data: { balance: { increment: battle.bet } }, // refund — не эмиссия, не totalEarned
          });
          await tx.transaction.create({
            data: {
              userId: creator.playerId,
              amount: battle.bet,
              type: TransactionType.REFUND,
              payload: { sessionId: battle.id, description: "stale_battle_refund" },
            },
          });
        }
        await tx.session.update({
          where: { id: battle.id },
          data: {
            status: "CANCELLED",
            activeUsers: { set: [] },
          },
        });
      });

      refunded++;
    } catch (err: unknown) {
      logger.error(`[Cleanup] Failed to cancel battle ${battle.id}:`, err);
    }
  }

  logger.info(`[Cleanup] ✅ Cancelled ${refunded} stale battles, refunded bets`);
};

// ─────────────────────────────────────────
// Запуск cron — 1-го числа каждого месяца в 03:00 UTC
// ─────────────────────────────────────────
export const startCleanupCron = (): void => {
  // "0 3 1 * *" = 03:00 UTC первого числа каждого месяца
  cron.schedule("0 3 1 * *", async () => {
    logger.info("[Cleanup] Monthly cron tick — running dead player cleanup...");
    await cleanDeadPlayers().catch((err) =>
      logError("[Cleanup Cron] Error:", err)
    );
  });

  logger.info("[Cleanup] Cron started: monthly cleanup on 1st at 03:00 UTC");
};
