import { Router, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import { prisma } from "@/lib/prisma";
import { authMiddleware, AuthRequest } from "@/middleware/auth";
import { uploadToS3, deleteFromS3 } from "@/lib/s3";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

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

// POST /profile/avatar — загрузка кастомного аватара
router.post(
  "/avatar",
  authMiddleware,
  upload.single("avatar"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).userId;
      if (!req.file) return res.status(400).json({ error: "Файл не передан" });

      const ext = req.file.mimetype.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
      const key = `avatars/${userId}.${ext}`;

      // Delete old custom avatar from S3 if exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatar: true, avatarType: true },
      });
      if (user?.avatarType === "UPLOAD" && user.avatar) {
        const oldKey = user.avatar.split(".ru/")[1]?.split("/").slice(1).join("/");
        if (oldKey) await deleteFromS3(oldKey).catch(() => {});
      }

      const url = await uploadToS3(key, req.file.buffer, req.file.mimetype);

      await prisma.user.update({
        where: { id: userId },
        data: { avatar: url, avatarType: "UPLOAD" },
      });

      res.json({ success: true, avatar: url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// DELETE /profile/avatar — удалить кастомный аватар (вернуть gradient)
router.delete("/avatar", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true, avatarType: true },
    });
    if (user?.avatarType === "UPLOAD" && user.avatar) {
      const oldKey = user.avatar.split(".ru/")[1]?.split("/").slice(1).join("/");
      if (oldKey) await deleteFromS3(oldKey).catch(() => {});
    }
    await prisma.user.update({
      where: { id: userId },
      data: { avatar: null, avatarType: "GRADIENT" },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /profile/ton-wallet — подключить TON кошелёк
router.post("/ton-wallet", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { walletAddress } = req.body;
    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length < 20) {
      return res.status(400).json({ error: "Некорректный адрес кошелька" });
    }
    // Check wallet not already linked to another account
    const existing = await prisma.user.findFirst({
      where: { tonWalletAddress: walletAddress, id: { not: userId } },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({ error: "Этот кошелёк уже привязан к другому аккаунту" });
    }
    await prisma.user.update({
      where: { id: userId },
      data: { tonWalletAddress: walletAddress, tonConnectedAt: new Date() },
    });
    res.json({ success: true, walletAddress });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /profile/ton-wallet — отвязать TON кошелёк
router.delete("/ton-wallet", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    await prisma.user.update({
      where: { id: userId },
      data: { tonWalletAddress: null, tonConnectedAt: null },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /profile/ton/withdraw — запрос на вывод (создаёт WithdrawalRequest)
router.post("/ton/withdraw", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { amountCoins } = req.body;
    if (!amountCoins || BigInt(amountCoins) < 1_000_000n) {
      return res.status(400).json({ error: "Минимальная сумма вывода: 1,000,000 ᚙ" });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, tonWalletAddress: true },
    });
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    if (!user.tonWalletAddress) {
      return res.status(400).json({ error: "Сначала подключите TON кошелёк" });
    }
    if (user.balance < BigInt(amountCoins)) {
      return res.status(400).json({ error: "Недостаточно монет" });
    }
    // Check no pending withdrawal exists
    const pending = await prisma.withdrawalRequest.findFirst({
      where: { userId, status: "PENDING" },
    });
    if (pending) {
      return res.status(409).json({ error: "У вас уже есть активная заявка на вывод" });
    }
    // Calculate TON equivalent (placeholder rate: 1 TON = 1,000,000 ᚙ)
    const tonAmount = Number(amountCoins) / 1_000_000;
    const commission = tonAmount * 0.005; // 0.5% commission
    const netTon = tonAmount - commission;

    // Deduct from balance
    const { updateBalance } = await import("@/services/economy");
    const { TransactionType } = await import("@prisma/client");
    await updateBalance(userId, -BigInt(amountCoins), TransactionType.WITHDRAWAL, {
      tonWallet: user.tonWalletAddress,
      tonAmount: netTon,
    });

    const withdrawal = await prisma.withdrawalRequest.create({
      data: {
        userId,
        amountCoins: BigInt(amountCoins),
        tonWalletAddress: user.tonWalletAddress,
        tonCommission: commission,
        status: "PENDING",
      },
    });

    res.json({ success: true, withdrawal: { ...withdrawal, amountCoins: withdrawal.amountCoins.toString() }, netTon });
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
