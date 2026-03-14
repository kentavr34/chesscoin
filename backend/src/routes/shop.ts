import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
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
        ...(type ? { type: type as any } : {}),
        ...(category ? { category: category as any } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { priceCoins: "asc" }],
      include: {
        owners: {
          where: { userId: req.user!.id },
          select: { isEquipped: true, purchasedAt: true },
        },
      },
    });

    const itemsWithOwnership = items.map((item) => ({
      ...item,
      owned: item.owners.length > 0,
      equipped: item.owners[0]?.isEquipped ?? false,
      owners: undefined,
    }));

    res.json({ items: itemsWithOwnership });
  } catch (err) {
    console.error("[shop/items]", err);
    res.status(500).json({ error: "Ошибка загрузки магазина" });
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
      return res.status(404).json({ error: "Предмет не найден" });

    // Проверяем что не куплен
    const existing = await prisma.userItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
    });
    if (existing) return res.status(409).json({ error: "Предмет уже куплен" });

    // Проверяем баланс
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    if (user.balance < item.priceCoins)
      return res.status(400).json({ error: "Недостаточно ᚙ" });

    // Снять монеты через updateBalance (создаёт транзакцию автоматически)
    await updateBalance(userId, -BigInt(item.priceCoins.toString()), TransactionType.ITEM_PURCHASE, { itemId: item.id, itemName: item.name });

    // Добавить в инвентарь
    await prisma.userItem.create({
      data: { userId, itemId },
    });

    res.json({ success: true, message: `Куплено: ${item.name}` });
  } catch (err) {
    console.error("[shop/purchase]", err);
    res.status(500).json({ error: "Ошибка покупки" });
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
    if (!userItem) return res.status(404).json({ error: "Предмет не в инвентаре" });

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

    res.json({ success: true, message: `Надето: ${userItem.item.name}` });
  } catch (err) {
    console.error("[shop/equip]", err);
    res.status(500).json({ error: "Ошибка экипировки" });
  }
});
