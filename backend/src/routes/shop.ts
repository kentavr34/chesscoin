import { ItemType, ItemCategory } from "@prisma/client"; // TAIL-2
import { logger, logError } from "@/lib/logger";
import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { redis } from "@/lib/redis";
import { authMiddleware } from "../middleware/auth";
import { updateBalance } from "@/services/economy";
import { TransactionType } from "@prisma/client";

export const shopRouter = Router();

// ─── GET /api/v1/shop/items?type=AVATAR_FRAME ────────────────────────────────
shopRouter.get("/items", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { type, category } = req.query;

    const items = await prisma.item.findMany({
      where: {
        isActive: true,
        ...(type ? { type: type as ItemType } : {}),
        ...(category ? { category: category as ItemCategory } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { priceCoins: "asc" }],
      include: {
        owners: {
          where: { userId: req.user!.id },
          select: { isEquipped: true, purchasedAt: true },
        },
      },
    });

    const itemsWithOwnership = (items as any[]).map((item: any) => ({
      ...item,
      owned: ((item.owners as Array<{ userId?: string; isEquipped?: boolean }> | undefined) ?? []).length > 0,
      equipped: ((item.owners as Array<{ userId?: string; isEquipped?: boolean }> | undefined) ?? [])[0]?.isEquipped ?? false,
      owners: undefined,
    }));

    res.json({ items: itemsWithOwnership });
  } catch (err: unknown) {
    logger.error("[shop/items]", err);
    res.status(500).json({ error: "Failed to load shop" });
  }
});

// ─── POST /api/v1/shop/purchase ───────────────────────────────────────────────
shopRouter.post("/purchase", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ error: "itemId обязателен" });

    const userId = req.user!.id;

    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item || !item.isActive)
      return res.status(404).json({ error: "Item not found" });

    // Проверяем что не куплен
    const existing = await prisma.userItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
    });
    if (existing) return res.status(409).json({ error: "Item already purchased" });

    // Проверяем баланс
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.balance < item.priceCoins)
      return res.status(400).json({ error: "Not enough ᚙ" });

    // Снять монеты через updateBalance (создаёт транзакцию автоматически)
    await updateBalance(userId, -BigInt(item.priceCoins.toString()), TransactionType.ITEM_PURCHASE, { itemId: item.id, itemName: item.name });

    // Добавить в инвентарь
    await prisma.userItem.create({
      data: { userId, itemId },
    });

    res.json({ success: true, message: `Куплено: ${item.name}` });
  } catch (err: unknown) {
    logger.error("[shop/purchase]", err);
    res.status(500).json({ error: "Purchase error" });
  }
});

// ─── POST /api/v1/shop/equip ──────────────────────────────────────────────────
shopRouter.post("/equip", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ error: "itemId обязателен" });

    const userId = req.user!.id;

    const userItem = await prisma.userItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
      include: { item: true },
    });
    if (!userItem) return res.status(404).json({ error: "Item not in inventory" });

    const itemType = userItem.item.type;

    // Снимаем все предметы того же типа
    await prisma.userItem.updateMany({
      where: {
        userId,
        item: { type: itemType },
        isEquipped: true,
      },
      data: { isEquipped: false },
    });

    // Надеваем новый
    await prisma.userItem.update({
      where: { userId_itemId: { userId, itemId } },
      data: { isEquipped: true },
    });

    // При экипировке PREMIUM_AVATAR — обновляем avatar и avatarType пользователя,
    // чтобы аватар отображался во всём приложении (профиль, доска, лидерборд)
    if (itemType === "PREMIUM_AVATAR" && userItem.item.imageUrl) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          avatar: userItem.item.imageUrl,
          avatarType: "NFT", // используем NFT как тип для premium-аватаров из магазина
        },
      });
    }

    try { await redis.del(`user:me:${userId}`); } catch {}
    res.json({ success: true, message: `Equipped: ${userItem.item.name}` });
  } catch (err: unknown) {
    logger.error("[shop/equip]", err);
    res.status(500).json({ error: "Equip error" });
  }
});

// ─── POST /api/v1/shop/unequip ────────────────────────────────────────────────
// Снять предмет и вернуть дефолтный аватар (Telegram или градиент)
shopRouter.post("/unequip", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ error: "itemId обязателен" });

    const userId = req.user!.id;

    const userItem = await prisma.userItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
      include: { item: true },
    });
    if (!userItem) return res.status(404).json({ error: "Item not in inventory" });

    await prisma.userItem.update({
      where: { userId_itemId: { userId, itemId } },
      data: { isEquipped: false },
    });

    // Если снимали PREMIUM_AVATAR — восстанавливаем исходный Telegram-аватар
    if (userItem.item.type === "PREMIUM_AVATAR") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { telegramAvatar: true },
      });
      await prisma.user.update({
        where: { id: userId },
        data: {
          avatar: (user as Record<string,unknown>)?.telegramAvatar ?? null,
          avatarType: (user as Record<string,unknown>)?.telegramAvatar ? "TELEGRAM" : "GRADIENT",
        },
      });
    }

    try { await redis.del(`user:me:${userId}`); } catch {}
    res.json({ success: true });
  } catch (err: unknown) {
    logger.error("[shop/unequip]", err);
    res.status(500).json({ error: "Unequip error" });
  }
});

// ── Из GitHub: TON-обмен ─────────────────────────────────────────────────────
// GET /api/v1/shop/ton/rate — курс TON → монеты
shopRouter.get("/ton/rate", authMiddleware, async (_req: Request, res: Response) => {
  res.json({
    coinsPerTon: 1_000_000,
    coinsPerUsdt: 200_000,
    tonUsdt: 5.5,
  });
});

// POST /api/v1/shop/ton/connect — подключить TON кошелёк (после оплаты 1 TON)
shopRouter.post("/ton/connect", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress || !String(walletAddress).match(/^(UQ|EQ)[A-Za-z0-9_-]{46}$/)) {
      return res.status(400).json({ error: "Invalid TON address format (UQ... or EQ...)" });
    }

    const userId = req.user!.id;

    // Проверяем не занят ли адрес другим пользователем
    const existing = await prisma.user.findFirst({
      where: { tonWalletAddress: walletAddress, id: { not: userId } },
    });
    if (existing) {
      return res.status(409).json({ error: "This address is already linked to another account" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { tonWalletAddress: walletAddress },
    });

    res.json({ success: true, walletAddress });
  } catch (err) {
    logger.error("[shop/ton/connect]", err);
    res.status(500).json({ error: "Wallet connection error" });
  }
});

// POST /api/v1/shop/ton/buy — купить монеты за TON (начисление после подтверждения платежа)
shopRouter.post("/ton/buy", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.tonWalletAddress) {
      return res.status(403).json({ error: "Connect TON wallet first" });
    }

    const { tonAmount } = req.body;
    const ton = parseFloat(tonAmount);
    if (!ton || ton < 0.1) {
      return res.status(400).json({ error: "Minimum amount: 0.1 TON" });
    }

    const COINS_PER_TON = 1_000_000;
    const FEE = 0.005;
    const grossCoins = BigInt(Math.round(ton * COINS_PER_TON));
    const feeCoins = BigInt(Math.round(Number(grossCoins) * FEE));
    const netCoins = grossCoins - feeCoins;

    await updateBalance(userId, netCoins, TransactionType.TRADE_BUY, { source: "TON", tonAmount: ton });

    res.json({ coinsReceived: netCoins.toString(), tonAmount: ton });
  } catch (err) {
    logger.error("[shop/ton/buy]", err);
    res.status(500).json({ error: "Coin purchase error" });
  }
});

// POST /api/v1/shop/ton/sell — продать монеты за TON (создаёт заявку)
shopRouter.post("/ton/sell", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.tonWalletAddress) {
      return res.status(403).json({ error: "Connect TON wallet first" });
    }

    const { coinsAmount } = req.body;
    const coins = BigInt(String(coinsAmount).replace(/\D/g, "") || "0");
    if (coins < 1_000_000n) {
      return res.status(400).json({ error: "Minimum 1,000,000 ᚙ" });
    }
    if (user.balance < coins) {
      return res.status(400).json({ error: "Not enough coins" });
    }

    const COINS_PER_TON = 1_000_000;
    const FEE = 0.005;
    const grossTon = Number(coins) / COINS_PER_TON;
    const feeTon = grossTon * FEE;
    const netTon = grossTon - feeTon;

    await updateBalance(userId, -coins, TransactionType.TRADE_SELL, {
      source: "TON_SELL",
      netTon,
      toWallet: user.tonWalletAddress,
    });

    res.json({ tonAmount: grossTon, netTon, feeTon, status: "PENDING" });
  } catch (err) {
    logger.error("[shop/ton/sell]", err);
    res.status(500).json({ error: "Coin sale error" });
  }
});

// POST /api/v1/shop/ton/withdraw — вывод монет в TON
shopRouter.post("/ton/withdraw", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.tonWalletAddress) {
      return res.status(403).json({ error: "Connect TON wallet first" });
    }

    const { coinsAmount } = req.body;
    const coins = BigInt(String(coinsAmount).replace(/\D/g, "") || "0");
    if (coins < 1_000_000n) {
      return res.status(400).json({ error: "Minimum 1,000,000 ᚙ for withdrawal" });
    }
    if (user.balance < coins) {
      return res.status(400).json({ error: "Not enough coins" });
    }

    const COINS_PER_TON = 1_000_000;
    const FEE = 0.005;
    const grossTon = Number(coins) / COINS_PER_TON;
    const feeTon = grossTon * FEE;
    const netTon = grossTon - feeTon;

    await updateBalance(userId, -coins, TransactionType.TRADE_SELL, {
      source: "TON_WITHDRAW",
      netTon,
      toWallet: user.tonWalletAddress,
    });

    res.json({ netTon, feeTon, grossTon, toWallet: user.tonWalletAddress, status: "PENDING" });
  } catch (err) {
    logger.error("[shop/ton/withdraw]", err);
    res.status(500).json({ error: "Withdrawal error" });
  }
});
