import { ItemType, ItemCategory } from "@prisma/client"; // TAIL-2
import { logger, logError } from "@/lib/logger";
import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { redis } from "@/lib/redis";
import { authMiddleware } from "../middleware/auth";
import { updateBalance } from "@/services/economy";
import { collectToTreasury } from "@/services/treasury";
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
    if (!itemId) return res.status(400).json({ error: "itemId is required" });

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
    // Кенан 31.07.2026: «продажа аватаров и прочих украшательств в магазине»
    // — деньги игрока уходят НА счёт платформы, а не исчезают с баланса.
    await collectToTreasury(userId, BigInt(item.priceCoins.toString()), TransactionType.ITEM_PURCHASE, { itemId: item.id, itemName: item.name });

    // Добавить в инвентарь
    await prisma.userItem.create({
      data: { userId, itemId },
    });

    res.json({ success: true, message: `Purchased: ${item.name}` });
  } catch (err: unknown) {
    logger.error("[shop/purchase]", err);
    res.status(500).json({ error: "Purchase error" });
  }
});

// ─── POST /api/v1/shop/equip ──────────────────────────────────────────────────
shopRouter.post("/equip", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ error: "itemId is required" });

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
    if (!itemId) return res.status(400).json({ error: "itemId is required" });

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
shopRouter.post("/ton/connect", authMiddleware, async (_req: Request, res: Response) => {
  // ЗАКРЫТО 03.08.2026. Вся группа /shop/ton/* — забытая копия денежных
  // путей, которая обходила все правила: подключение кошелька шло БЕЗ
  // подтверждения (1 TON за адрес), покупка начисляла монеты по слову
  // клиента БЕЗ проверки платежа в блокчейне, продажа и вывод уносили
  // монеты из капитала по курсу 1 000 000 за TON вместо 100 000.
  // Рабочие пути — /profile/ton/*: там платёж сверяется с блокчейном.
  res.status(410).json({
    error: "ENDPOINT_RETIRED",
    message: "Этот путь закрыт. Кошелёк и покупка монет — на экране биржи.",
  });
});

// POST /api/v1/shop/ton/buy — купить монеты за TON (начисление после подтверждения платежа)
shopRouter.post("/ton/buy", authMiddleware, async (_req: Request, res: Response) => {
  // ЗАКРЫТО 03.08.2026. Вся группа /shop/ton/* — забытая копия денежных
  // путей, которая обходила все правила: подключение кошелька шло БЕЗ
  // подтверждения (1 TON за адрес), покупка начисляла монеты по слову
  // клиента БЕЗ проверки платежа в блокчейне, продажа и вывод уносили
  // монеты из капитала по курсу 1 000 000 за TON вместо 100 000.
  // Рабочие пути — /profile/ton/*: там платёж сверяется с блокчейном.
  res.status(410).json({
    error: "ENDPOINT_RETIRED",
    message: "Этот путь закрыт. Кошелёк и покупка монет — на экране биржи.",
  });
});

// POST /api/v1/shop/ton/sell — продать монеты за TON (создаёт заявку)
shopRouter.post("/ton/sell", authMiddleware, async (_req: Request, res: Response) => {
  // ЗАКРЫТО (Кенан 03.08.2026), вторая копия закрытых путей из profile.ts.
  // Здесь было хуже: монеты списывались вообще без заявки на выплату И по
  // курсу 1 000 000 монет за TON — вдесятеро мимо правила «100 000 монет
  // за TON». Правило: «у нас нет пока выведения ничего вообще», «крипта
  // идёт на наш криптокошелёк и никак не обратно».
  res.status(403).json({
    error: "WITHDRAWALS_CLOSED",
    message: "Вывод монет за TON закрыт. Продать монеты можно на бирже другому игроку.",
  });
});

// POST /api/v1/shop/ton/withdraw — вывод монет в TON
shopRouter.post("/ton/withdraw", authMiddleware, async (_req: Request, res: Response) => {
  // ЗАКРЫТО (Кенан 03.08.2026), вторая копия закрытых путей из profile.ts.
  // Здесь было хуже: монеты списывались вообще без заявки на выплату И по
  // курсу 1 000 000 монет за TON — вдесятеро мимо правила «100 000 монет
  // за TON». Правило: «у нас нет пока выведения ничего вообще», «крипта
  // идёт на наш криптокошелёк и никак не обратно».
  res.status(403).json({
    error: "WITHDRAWALS_CLOSED",
    message: "Вывод монет за TON закрыт. Продать монеты можно на бирже другому игроку.",
  });
});
