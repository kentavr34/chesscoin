import { Router, Request, Response, NextFunction } from "express";
import { logger, logError } from "@/lib/logger";
import { prisma } from "../lib/prisma";
import { updateBalance } from "../services/economy";
import { cleanDeadPlayers } from "../services/cleanup";
import { TransactionType } from "@prisma/client";

export const botRouter = Router();

// ─── Middleware: только для Python бота (BOT_API_SECRET) ──────────────────────
function botSecretMiddleware(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.BOT_API_SECRET;
  const auth = req.headers.authorization;

  if (!secret || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

botRouter.use(botSecretMiddleware);

// ─── POST /api/v1/bot/notify ──────────────────────────────────────────────────
botRouter.post("/notify", async (req: Request, res: Response) => {
  try {
    const { telegramId, message } = req.body;
    if (!telegramId || !message)
      return res.status(400).json({ error: "telegramId и message обязательны" });

    // Проверяем что пользователь существует
    const user = await prisma.user.findUnique({
      where: { telegramId: String(telegramId) },
      select: { id: true, isBanned: true },
    });
    if (!user || user.isBanned)
      return res.status(404).json({ error: "Пользователь не найден или забанен" });

    // Отправляем через Telegram Bot API
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) return res.status(500).json({ error: "BOT_TOKEN не задан" });

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );

    const tgData = await tgRes.json() as Record<string, unknown>;
    if (!tgData.ok) {
      return res.status(400).json({ error: tgData.description });
    }

    res.json({ success: true });
  } catch (err: unknown) {
    logger.error("[bot/notify]", err);
    res.status(500).json({ error: "Ошибка отправки уведомления" });
  }
});

// ─── GET /api/v1/bot/stats ────────────────────────────────────────────────────
botRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [totalUsers, totalSessions, config] = await Promise.all([
      prisma.user.count({ where: { isBot: false } }),
      prisma.session.count(),
      prisma.platformConfig.findUnique({ where: { id: "singleton" } }),
    ]);

    const totalBattles = await prisma.session.count({
      where: { type: "BATTLE" },
    });

    res.json({
      totalUsers,
      totalSessions,
      totalBattles,
      totalEmitted: config?.totalEmitted?.toString() ?? "0",
      platformReserve: config?.platformReserve?.toString() ?? "0",
      currentPhase: config?.currentPhase ?? 1,
    });
  } catch (err: unknown) {
    logger.error("[bot/stats]", err);
    res.status(500).json({ error: "Ошибка получения статистики" });
  }
});

// ─── POST /api/v1/bot/broadcast ───────────────────────────────────────────────
botRouter.post("/broadcast", async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "text обязателен" });

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) return res.status(500).json({ error: "BOT_TOKEN не задан" });

    // Берём всех не-забаненных пользователей (не-ботов)
    const users = await prisma.user.findMany({
      where: { isBot: false, isBanned: false },
      select: { telegramId: true },
    });

    let sent = 0;
    let failed = 0;

    // Отправляем по 30 в секунду (лимит Telegram)
    for (let i = 0; i < users.length; i++) {
      const { telegramId } = users[i];
      try {
        const r = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: telegramId,
              text,
              parse_mode: "HTML",
            }),
          }
        );
        const d = await r.json() as Record<string, unknown>;
        d.ok ? sent++ : failed++;
      } catch {
        failed++;
      }

      // throttle: 30 msg/sec
      if (i % 30 === 29) await new Promise((r) => setTimeout(r, 1000));
    }

    res.json({ sent, failed });
  } catch (err: unknown) {
    logger.error("[bot/broadcast]", err);
    res.status(500).json({ error: "Ошибка рассылки" });
  }
});

// ─── POST /api/v1/bot/ban ─────────────────────────────────────────────────────
botRouter.post("/ban", async (req: Request, res: Response) => {
  try {
    const { telegramId } = req.body;
    if (!telegramId) return res.status(400).json({ error: "telegramId обязателен" });

    const user = await prisma.user.update({
      where: { telegramId: String(telegramId) },
      data: { isBanned: true },
    });

    res.json({ success: true, userId: user.id });
  } catch (err: unknown) {
    if ((err as Record<string,unknown>).code === "P2025")
      return res.status(404).json({ error: "Пользователь не найден" });
    logger.error("[bot/ban]", err);
    res.status(500).json({ error: "Ошибка бана" });
  }
});

// ── AdminNotification polling ──────────────────────────────────────────────

// GET /api/v1/bot/notifications/pending
botRouter.get("/notifications/pending", async (_req: import("express").Request, res: import("express").Response) => {
  try {
    const notifications = await prisma.adminNotification.findMany({
      where: { sentAt: null },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    res.json({ notifications });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? (err instanceof Error ? (err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err)) : String(err)) : String(err)) });
  }
});

// POST /api/v1/bot/notifications/:id/sent
botRouter.post("/notifications/:id/sent", async (req: import("express").Request, res: import("express").Response) => {
  try {
    await prisma.adminNotification.update({
      where: { id: req.params.id },
      data: { sentAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? (err instanceof Error ? (err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err)) : String(err)) : String(err)) });
  }
});

// ── Referral start ──────────────────────────────────────────────────────────

// POST /api/v1/bot/referral-start
botRouter.post("/referral-start", async (req: import("express").Request, res: import("express").Response) => {
  try {
    const { newTelegramId, referrerTelegramId } = req.body;
    if (!newTelegramId || !referrerTelegramId) {
      return res.status(400).json({ error: "Missing fields" });
    }
    await prisma.pendingReferral.upsert({
      where: { newTelegramId },
      create: { newTelegramId, referrerTelegramId },
      update: { referrerTelegramId },
    });
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? (err instanceof Error ? (err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err)) : String(err)) : String(err)) });
  }
});

// ── GET /api/v1/bot/stats/detailed ──────────────────────────────────────────
botRouter.get("/stats/detailed", async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    const [
      totalUsers, todayUsers, weekUsers, monthUsers,
      bronzeCount, silverCount, goldCount, diamondCount, championCount, starCount,
      totalSessions, battleSessions, botSessions, friendlySessions,
      waitingSessions, inProgressSessions,
      stuckWaiting, stuckInProgress,
      config,
      commissionAgg,
      tonDeposits, pendingWithdrawals, completedWithdrawals,
    ] = await Promise.all([
      prisma.user.count({ where: { isBot: false } }),
      prisma.user.count({ where: { isBot: false, createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { isBot: false, createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { isBot: false, createdAt: { gte: monthAgo } } }),
      prisma.user.count({ where: { isBot: false, league: "BRONZE" } }),
      prisma.user.count({ where: { isBot: false, league: "SILVER" } }),
      prisma.user.count({ where: { isBot: false, league: "GOLD" } }),
      prisma.user.count({ where: { isBot: false, league: "DIAMOND" } }),
      prisma.user.count({ where: { isBot: false, league: "CHAMPION" } }),
      prisma.user.count({ where: { isBot: false, league: "STAR" } }),
      prisma.session.count(),
      prisma.session.count({ where: { type: "BATTLE" } }),
      prisma.session.count({ where: { type: "BOT" } }),
      prisma.session.count({ where: { type: "FRIENDLY" } }),
      prisma.session.count({ where: { status: "WAITING_FOR_OPPONENT" } }),
      prisma.session.count({ where: { status: "IN_PROGRESS" } }),
      prisma.session.count({ where: { status: "WAITING_FOR_OPPONENT", createdAt: { lt: oneHourAgo } } }),
      prisma.session.count({ where: { status: "IN_PROGRESS", updatedAt: { lt: sixHoursAgo } } }),
      prisma.platformConfig.findUnique({ where: { id: "singleton" } }),
      prisma.transaction.aggregate({ where: { type: "BATTLE_COMMISSION" }, _sum: { amount: true } }),
      prisma.tonTransaction.count({ where: { type: "DEPOSIT" } }),
      prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
      prisma.withdrawalRequest.count({ where: { status: "COMPLETED" } }),
    ]);

    res.json({
      users: {
        total: totalUsers,
        today: todayUsers,
        week: weekUsers,
        month: monthUsers,
        byLeague: {
          BRONZE: bronzeCount,
          SILVER: silverCount,
          GOLD: goldCount,
          DIAMOND: diamondCount,
          CHAMPION: championCount,
          STAR: starCount,
        },
      },
      sessions: {
        total: totalSessions,
        battles: battleSessions,
        bot: botSessions,
        friendly: friendlySessions,
        waiting: waitingSessions,
        inProgress: inProgressSessions,
        stuckWaiting,
        stuckInProgress,
      },
      economy: {
        phase: config?.currentPhase ?? 1,
        totalEmitted: config?.totalEmitted?.toString() ?? "0",
        reserve: config?.platformReserve?.toString() ?? "0",
        tokenPrice: config?.tokenPriceUsd ?? 0,
        totalCommission: (commissionAgg._sum.amount ?? 0n).toString(),
        tonDeposits,
        pendingWithdrawals,
        completedWithdrawals,
      },
    });
  } catch (err: unknown) {
    logger.error("[bot/stats/detailed]", err);
    res.status(500).json({ error: "Ошибка получения детальной статистики" });
  }
});

// ── GET /api/v1/bot/tasks ─────────────────────────────────────────────────────
botRouter.get("/tasks", async (_req: Request, res: Response) => {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { completedBy: true } },
      },
    });
    res.json(tasks.map((t: Record<string,unknown> & { winningAmount?: string | bigint | null }) => ({
      ...t,
      winningAmount: (String(t.winningAmount ?? "0")),
    })));
  } catch (err: unknown) {
    logger.error("[bot/tasks GET]", err);
    res.status(500).json({ error: "Ошибка получения заданий" });
  }
});

// ── POST /api/v1/bot/tasks/create ─────────────────────────────────────────────
botRouter.post("/tasks/create", async (req: Request, res: Response) => {
  try {
    const { taskType, title, description, winningAmount, metadata, icon, status } = req.body;
    if (!taskType || !title || winningAmount == null || !metadata || !icon) {
      return res.status(400).json({ error: "Обязательные поля: taskType, title, winningAmount, metadata, icon" });
    }
    const task = await prisma.task.create({
      data: {
        taskType,
        title,
        description: description ?? null,
        winningAmount: BigInt(winningAmount),
        metadata,
        icon,
        status: status ?? "ACTIVE",
      },
    });
    res.json({ ...task, winningAmount: task.winningAmount.toString() });
  } catch (err: unknown) {
    logger.error("[bot/tasks/create]", err);
    res.status(500).json({ error: "Ошибка создания задания" });
  }
});

// ── PUT /api/v1/bot/tasks/:id/toggle ──────────────────────────────────────────
botRouter.put("/tasks/:id/toggle", async (req: Request, res: Response) => {
  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Задание не найдено" });
    const newStatus = existing.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: { status: newStatus },
    });
    res.json({ ...updated, winningAmount: updated.winningAmount.toString(), status: updated.status });
  } catch (err: unknown) {
    logger.error("[bot/tasks toggle]", err);
    res.status(500).json({ error: "Ошибка изменения статуса" });
  }
});

// ── DELETE /api/v1/bot/tasks/:id ──────────────────────────────────────────────
botRouter.delete("/tasks/:id", async (req: Request, res: Response) => {
  try {
    // Delete completions first, then the task
    await prisma.completedTask.deleteMany({ where: { taskId: req.params.id } });
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: unknown) {
    if ((err as Record<string,unknown>).code === "P2025") return res.status(404).json({ error: "Задание не найдено" });
    logger.error("[bot/tasks delete]", err);
    res.status(500).json({ error: "Ошибка удаления задания" });
  }
});

// ── POST /api/v1/bot/cleanup/dead ─────────────────────────────────────────────
botRouter.post("/cleanup/dead", async (_req: Request, res: Response) => {
  try {
    // Count before
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const beforeCount = await prisma.user.count({
      where: { isBot: false, isBanned: false, referralActivated: false, createdAt: { lt: cutoff } },
    });
    await cleanDeadPlayers();
    res.json({ removed: beforeCount });
  } catch (err: unknown) {
    logger.error("[bot/cleanup/dead]", err);
    res.status(500).json({ error: "Ошибка очистки мёртвых аккаунтов" });
  }
});

// ── POST /api/v1/bot/cleanup/sessions ─────────────────────────────────────────
botRouter.post("/cleanup/sessions", async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    // 1. Cancel WAITING sessions older than 1 hour — refund bets for BATTLE type
    const stuckWaiting = await prisma.session.findMany({
      where: { status: "WAITING_FOR_OPPONENT", createdAt: { lt: oneHourAgo } },
      include: { sides: { select: { playerId: true, isBot: true } } },
    });

    let cancelledWaiting = 0;
    let refundedBets = 0;
    for (const session of stuckWaiting) {
      if (session.type === "BATTLE" && session.bet) {
        const humanSide = session.sides.find((s: Record<string,unknown>) => !s.isBot);
        if (humanSide) {
          await updateBalance(
            humanSide.playerId,
            session.bet,
            TransactionType.BATTLE_WIN,
            { refund: true, sessionId: session.id },
            { isEmission: false }
          );
          refundedBets++;
        }
      }
      await prisma.session.update({
        where: { id: session.id },
        data: { status: "CANCELLED", finishedAt: now },
      });
      cancelledWaiting++;
    }

    // 2. Mark stuck IN_PROGRESS sessions (no activity > 6h) as DRAW
    const stuckInProgress = await prisma.session.findMany({
      where: { status: "IN_PROGRESS", updatedAt: { lt: sixHoursAgo } },
      include: { sides: { select: { id: true } } },
    });

    let drawnStuck = 0;
    for (const session of stuckInProgress) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          status: "DRAW",
          finishedAt: now,
          sides: { updateMany: { where: {}, data: { status: "DRAW" } } },
        },
      });
      drawnStuck++;
    }

    res.json({ cancelledWaiting, drawnStuck, refundedBets });
  } catch (err: unknown) {
    logger.error("[bot/cleanup/sessions]", err);
    res.status(500).json({ error: "Ошибка очистки сессий" });
  }
});

// ── POST /api/v1/bot/restart ──────────────────────────────────────────────────
// Graceful shutdown — Docker/compose автоматически рестартует контейнер
botRouter.post("/restart", async (_req: Request, res: Response) => {
  res.json({ ok: true, message: "Перезапуск инициирован" });
  setTimeout(() => {
    logger.info("[bot/restart] Graceful shutdown by admin command");
    process.exit(0);
  }, 500);
});

// ── GET /api/v1/bot/user-exists — N17: проверка существования пользователя ───
botRouter.get("/user-exists", async (req: Request, res: Response) => {
  try {
    const { telegramId } = req.query as { telegramId?: string };
    if (!telegramId) return res.status(400).json({ error: "telegramId required" });

    const user = await prisma.user.findUnique({
      where: { telegramId: String(telegramId) },
      select: { id: true },
    });

    res.json({ exists: !!user });
  } catch (err: unknown) {
    logger.error("[bot/user-exists]", err);
    res.status(500).json({ error: "Internal error" });
  }
});
