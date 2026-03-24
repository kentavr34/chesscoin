import { Router, Request, Response } from "express";
import { authMiddleware, AuthRequest } from "@/middleware/auth";
import { purchaseAttempts, getSecondsUntilNextRestore } from "@/services/attempts";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const router = Router();

// POST /api/v1/attempts/purchase — купить попытки
router.post("/purchase", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const count = req.body.count ? parseInt(req.body.count) : 1;

    await purchaseAttempts(userId, count);

    // Инвалидируем кеш user:me чтобы фронтенд получил актуальные данные
    try { await redis.del(`user:me:${userId}`); } catch {}

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { attempts: true, maxAttempts: true, balance: true },
    });

    res.json({
      attempts: user.attempts,
      maxAttempts: user.maxAttempts,
      balance: user.balance.toString(),
      nextRestoreSeconds: getSecondsUntilNextRestore(),
    });
  } catch (err: unknown) {
    res.status(400).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// GET /api/v1/attempts — текущее состояние попыток
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { attempts: true, maxAttempts: true, balance: true },
    });

    res.json({
      attempts: user.attempts,
      maxAttempts: user.maxAttempts,
      balance: user.balance.toString(),
      nextRestoreSeconds: getSecondsUntilNextRestore(),
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

export default router;
