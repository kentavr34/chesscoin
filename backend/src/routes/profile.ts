import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authMiddleware, AuthRequest } from "@/middleware/auth";

const router = Router();

// ВАЖНО: /transactions и /referrals ДОЛЖНЫ быть ДО /:userId
// иначе Express поймает слово "transactions" как userId

// GET /profile/transactions — история транзакций
router.get("/transactions", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { limit, offset } = z.object({
      limit:  z.coerce.number().min(1).max(100).default(20),
      offset: z.coerce.number().min(0).default(0),
    }).parse(req.query);

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.transaction.count({ where: { userId } }),
    ]);

    res.json({
      total,
      transactions: transactions.map(tx => ({
        ...tx,
        amount: tx.amount.toString(),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /profile/referrals — реферальная информация
router.get("/referrals", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        telegramId: true,
        referrerIncome: true,
        subReferrerIncome: true,
        referrals: {
          select: {
            id: true, firstName: true, lastName: true,
            avatar: true, avatarGradient: true,
            referralActivated: true, elo: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) return res.status(404).json({ error: "Not found" });

    const totalIncome = user.referrerIncome + user.subReferrerIncome;
    // Активные = сыграли хотя бы одну партию
    const activeCount = user.referrals.filter((r) => r.referralActivated).length;

    res.json({
      total: user.referrals.length,
      active: activeCount,
      totalIncome: totalIncome.toString(),
      level1Income: user.referrerIncome.toString(),
      level2Income: user.subReferrerIncome.toString(),
      refLink: `https://t.me/chessgamecoin_bot?start=ref_${user.telegramId}`,
      referrals: user.referrals,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /profile/:userId — публичный профиль (должен быть последним!)
router.get("/:userId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: {
        id: true, firstName: true, lastName: true, username: true,
        avatar: true, avatarType: true, avatarGradient: true,
        elo: true, league: true, totalEarned: true, createdAt: true,
        isBanned: true,
        sides: {
          select: { status: true },
          take: 100,
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    if (!user || user.isBanned) {
      return res.status(404).json({ error: "User not found" });
    }

    // Считаем статистику
    const wins   = user.sides.filter(s => s.status === "WON").length;
    const losses = user.sides.filter(s => s.status === "LOST").length;
    const draws  = user.sides.filter(s => s.status === "DRAW").length;

    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      avatar: user.avatar,
      avatarType: user.avatarType,
      avatarGradient: user.avatarGradient,
      elo: user.elo,
      league: user.league,
      totalEarned: user.totalEarned.toString(),
      createdAt: user.createdAt,
      stats: { wins, losses, draws, total: user.sides.length },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
