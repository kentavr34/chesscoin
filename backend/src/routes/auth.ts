import { Router, Request, Response } from "express";
import { z } from "zod";
import { loginWithTelegram, refreshAccessToken } from "@/services/auth";
import { authMiddleware, AuthRequest } from "@/middleware/auth";
import { checkAndRestoreUserAttempts, getSecondsUntilNextRestore } from "@/services/attempts";
import { prisma } from "@/lib/prisma";

const router = Router();

// POST /auth/login — вход через Telegram initData
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { initData, referrer } = z
      .object({
        initData: z.string(),
        referrer: z.string().optional(),
      })
      .parse(req.body);

    const result = await loginWithTelegram(initData, referrer);
    res.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: formatUser(result.user),
    });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// POST /auth/refresh
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = z
      .object({ refreshToken: z.string() })
      .parse(req.body);

    const result = await refreshAccessToken(refreshToken);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// GET /auth/me — текущий пользователь
router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;

    // Восстанавливаем попытки при каждом входе
    const user = await checkAndRestoreUserAttempts(userId);

    const fullUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        activeSessions: {
          select: {
            id: true,
            type: true,
            status: true,
            fen: true,
            bet: true,
            botLevel: true,
            sides: {
              select: {
                isWhite: true,
                timeLeft: true,
                isBot: true,
                player: { select: { firstName: true, avatar: true } },
              },
            },
          },
        },
      },
    });

    res.json(formatUser(fullUser));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Форматирование ───────────────────────────────
const formatUser = (user: any) => ({
  id: user.id,
  telegramId: user.telegramId,
  firstName: user.firstName,
  lastName: user.lastName,
  username: user.username,
  language: user.language,
  avatar: user.avatar,
  avatarType: user.avatarType,
  avatarGradient: user.avatarGradient,
  balance: user.balance?.toString() ?? "0",
  totalEarned: user.totalEarned?.toString() ?? "0",
  totalSpent: user.totalSpent?.toString() ?? "0",
  attempts: user.attempts,
  maxAttempts: user.maxAttempts,
  attemptSlots: user.attemptSlots,
  nextRestoreSeconds: getSecondsUntilNextRestore(),
  elo: user.elo,
  league: user.league,
  activeSessions: user.activeSessions ?? [],
  createdAt: user.createdAt,
});

export default router;
