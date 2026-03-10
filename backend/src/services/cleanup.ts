import cron from "node-cron";
import { prisma } from "@/lib/prisma";

// ═══════════════════════════════════════════════════════════════
// CRON: Чистка мёртвых игроков — раз в месяц (1-го числа в 03:00 UTC)
//
// Мёртвый игрок = зарегистрировался > 30 дней назад
//                 И ни разу не сыграл ни одной партии (referralActivated = false)
//                 И не является ботом / забаненным
//
// Почему referralActivated: этот флаг ставится в true в processReferralFirstGame()
// ровно при первом завершении любой партии — идеальный индикатор активности.
// ═══════════════════════════════════════════════════════════════

export const cleanDeadPlayers = async (): Promise<void> => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30); // 30 дней назад

  console.log("[Cleanup] Starting dead player cleanup...");

  // 1. Найти мёртвых игроков
  const dead = await prisma.user.findMany({
    where: {
      isBot: false,
      isBanned: false,
      referralActivated: false,       // ни разу не завершил партию
      createdAt: { lt: cutoff },      // старше 30 дней
    },
    select: {
      id: true,
      telegramId: true,
      firstName: true,
      createdAt: true,
      balance: true,
    },
  });

  if (dead.length === 0) {
    console.log("[Cleanup] No dead players found. All good.");
    return;
  }

  console.log(`[Cleanup] Found ${dead.length} dead players to remove`);

  const deadIds = dead.map((u) => u.id);

  // 2. Архивируем статистику ПЕРЕД удалением (для аналитики)
  await prisma.analyticsCleanup.create({
    data: {
      removedCount: dead.length,
      removedAt: new Date(),
      snapshot: dead.map((u) => ({
        id: u.id,
        telegramId: u.telegramId,
        firstName: u.firstName,
        createdAt: u.createdAt.toISOString(),
        balance: u.balance.toString(),
      })),
    },
  });

  // 3. Удаляем каскадно (Prisma schema: onDelete: Cascade на связанных моделях)
  //    Удаляются: Transaction, SessionSide (через Session), Task completions
  //    Сессии в которых они участвовали НЕ удаляются (история игр других игроков)
  await prisma.user.deleteMany({
    where: { id: { in: deadIds } },
  });

  console.log(`[Cleanup] ✅ Removed ${dead.length} dead players + their data`);

  // 4. Уведомить админа через backend event (бот подхватит)
  await prisma.adminNotification.create({
    data: {
      type: "DEAD_PLAYERS_CLEANED",
      payload: {
        count: dead.length,
        cutoffDate: cutoff.toISOString(),
      },
    },
  });
};

// ─────────────────────────────────────────
// Запуск cron — 1-го числа каждого месяца в 03:00 UTC
// ─────────────────────────────────────────
export const startCleanupCron = (): void => {
  // "0 3 1 * *" = 03:00 UTC первого числа каждого месяца
  cron.schedule("0 3 1 * *", async () => {
    console.log("[Cleanup] Monthly cron tick — running dead player cleanup...");
    await cleanDeadPlayers().catch((err) =>
      console.error("[Cleanup Cron] Error:", err)
    );
  });

  console.log("[Cleanup] Cron started: monthly cleanup on 1st at 03:00 UTC");
};
