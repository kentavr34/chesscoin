import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

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

    const user = await prisma.user.findUnique({
      where: { telegramId: String(telegramId) },
      select: { id: true, isBanned: true },
    });
    if (!user || user.isBanned)
      return res.status(404).json({ error: "Пользователь не найден или забанен" });

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) return res.status(500).json({ error: "BOT_TOKEN не задан" });

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: telegramId, text: message, parse_mode: "HTML" }),
      }
    );

    const tgData = await tgRes.json() as any;
    if (!tgData.ok) return res.status(400).json({ error: tgData.description });

    res.json({ success: true });
  } catch (err) {
    console.error("[bot/notify]", err);
    res.status(500).json({ error: "Ошибка отправки уведомления" });
  }
});

// ─── GET /api/v1/bot/stats ────────────────────────────────────────────────────
botRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [totalUsers, totalSessions, config, totalBattles] = await Promise.all([
      prisma.user.count({ where: { isBot: false } }),
      prisma.session.count(),
      prisma.platformConfig.findUnique({ where: { id: "singleton" } }),
      prisma.session.count({ where: { type: "BATTLE" } }),
    ]);

    res.json({
      totalUsers,
      totalSessions,
      totalBattles,
      totalEmitted: config?.totalEmitted?.toString() ?? "0",
      platformReserve: config?.platformReserve?.toString() ?? "0",
      currentPhase: config?.currentPhase ?? 1,
    });
  } catch (err) {
    console.error("[bot/stats]", err);
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

    const users = await prisma.user.findMany({
      where: { isBot: false, isBanned: false },
      select: { telegramId: true },
    });

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < users.length; i++) {
      const { telegramId } = users[i];
      try {
        const r = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: telegramId, text, parse_mode: "HTML" }),
          }
        );
        const d = await r.json() as any;
        d.ok ? sent++ : failed++;
      } catch { failed++; }
      if (i % 30 === 29) await new Promise((r) => setTimeout(r, 1000));
    }

    res.json({ sent, failed });
  } catch (err) {
    console.error("[bot/broadcast]", err);
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
  } catch (err: any) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "Пользователь не найден" });
    console.error("[bot/ban]", err);
    res.status(500).json({ error: "Ошибка бана" });
  }
});

// ─── GET /api/v1/bot/notifications/pending ───────────────────────────────────
// Бот читает непрочитанные AdminNotification и отправляет пользователям
botRouter.get("/notifications/pending", async (_req: Request, res: Response) => {
  try {
    const notifications = await prisma.adminNotification.findMany({
      where: { sentAt: null },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    res.json({ notifications });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/v1/bot/notifications/:id/sent ─────────────────────────────────
botRouter.post("/notifications/:id/sent", async (req: Request, res: Response) => {
  try {
    await prisma.adminNotification.update({
      where: { id: req.params.id },
      data: { sentAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/v1/bot/referral-start ─────────────────────────────────────────
// Бот сохраняет связь реферал→пригласивший ещё до первого auth/login
botRouter.post("/referral-start", async (req: Request, res: Response) => {
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
