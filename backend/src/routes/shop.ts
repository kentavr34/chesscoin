import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
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

// ─── TRADE ORDERS (биржа монет) ───────────────────────────────────────────────

// GET /api/v1/shop/orders — список открытых ордеров + мои
shopRouter.get("/orders", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;

  const [allOrders, myOrders] = await Promise.all([
    prisma.tradeOrder.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: {
        user: { select: { id: true, firstName: true, username: true, avatar: true, avatarGradient: true } },
      },
    }),
    prisma.tradeOrder.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  res.json({
    orders: allOrders.map((o: any) => ({
      id: o.id,
      userId: o.userId,
      user: o.user,
      type: o.type,
      currency: o.currency,
      amount: o.amount.toString(),
      price: o.price,
      status: o.status,
      createdAt: o.createdAt,
      isOwn: o.userId === userId,
    })),
    myOrders: myOrders.map((o: any) => ({
      id: o.id,
      type: o.type,
      currency: o.currency,
      amount: o.amount.toString(),
      price: o.price,
      status: o.status,
      createdAt: o.createdAt,
      filledAt: o.filledAt,
    })),
  });
});

// POST /api/v1/shop/orders — создать ордер (макс 3 активных)
shopRouter.post("/orders", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { type, currency, amount, price } = req.body;

  if (!type || !currency || !amount || !price) {
    return res.status(400).json({ error: "Все поля обязательны" });
  }

  // Проверяем кошелёк
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tonWalletAddress: true, balance: true },
  });

  if (!user) return res.status(404).json({ error: "Пользователь не найден" });
  if (!user.tonWalletAddress) {
    return res.status(403).json({ error: "Подключите TON-кошелёк для торговли" });
  }

  // Макс 3 активных ордера
  const activeCount = await prisma.tradeOrder.count({
    where: { userId, status: "OPEN" },
  });

  if (activeCount >= 3) {
    return res.status(400).json({ error: "Максимум 3 активных ордера. Отмените один из существующих." });
  }

  const amountBig = BigInt(amount);

  // Для продажи — проверяем баланс и блокируем монеты
  if (type === "SELL") {
    if (user.balance < amountBig) {
      return res.status(400).json({ error: "Недостаточно монет для продажи" });
    }
    await updateBalance(userId, -amountBig, TransactionType.TRADE_SELL, { action: "lock", orderId: "pending" });
  }

  const order = await prisma.tradeOrder.create({
    data: { userId, type, currency, amount: amountBig, price: parseFloat(price) },
  });

  res.json({
    id: order.id,
    type: order.type,
    currency: order.currency,
    amount: order.amount.toString(),
    price: order.price,
    status: order.status,
    createdAt: order.createdAt,
  });
});

// DELETE /api/v1/shop/orders/:id — отменить свой ордер
shopRouter.delete("/orders/:id", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;

  const order = await prisma.tradeOrder.findUnique({ where: { id: req.params.id } });
  if (!order || order.userId !== userId) {
    return res.status(404).json({ error: "Ордер не найден" });
  }
  if (order.status !== "OPEN") {
    return res.status(400).json({ error: "Ордер уже закрыт" });
  }

  // Возвращаем монеты если SELL
  if (order.type === "SELL") {
    await updateBalance(userId, order.amount, TransactionType.TRADE_SELL, { action: "unlock", orderId: order.id });
  }

  await prisma.tradeOrder.update({
    where: { id: order.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  res.json({ cancelled: true });
});

// POST /api/v1/shop/orders/:id/fill — исполнить чужой ордер
shopRouter.post("/orders/:id/fill", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;

  const order = await prisma.tradeOrder.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { balance: true } } },
  });

  if (!order || order.status !== "OPEN") {
    return res.status(404).json({ error: "Ордер не найден или уже закрыт" });
  }
  if (order.userId === userId) {
    return res.status(400).json({ error: "Нельзя исполнить свой ордер" });
  }

  const buyer = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true, tonWalletAddress: true } });
  if (!buyer) return res.status(404).json({ error: "Пользователь не найден" });
  if (!buyer.tonWalletAddress) {
    return res.status(403).json({ error: "Подключите TON-кошелёк для торговли" });
  }

  // Если кто-то хочет купить — проверяем баланс покупателя монет
  if (order.type === "SELL") {
    // order.type=SELL: продавец продаёт, исполнитель покупает за TON/STARS (внешне)
    // Монеты уже заблокированы у продавца — переводим исполнителю
    await updateBalance(userId, order.amount, TransactionType.TRADE_BUY, { orderId: order.id });
  } else {
    // order.type=BUY: покупатель купил, исполнитель продаёт монеты
    if (buyer.balance < order.amount) {
      return res.status(400).json({ error: "Недостаточно монет" });
    }
    await updateBalance(userId, -order.amount, TransactionType.TRADE_SELL, { orderId: order.id });
    await updateBalance(order.userId, order.amount, TransactionType.TRADE_BUY, { orderId: order.id });
  }

  await prisma.tradeOrder.update({
    where: { id: order.id },
    data: { status: "FILLED", filledAt: new Date(), filledByUserId: userId },
  });

  res.json({ filled: true });
});

// ─── TON WALLET ENDPOINTS ────────────────────────────────────────────────────

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
      return res.status(400).json({ error: "Неверный формат адреса TON (UQ... или EQ...)" });
    }

    const userId = req.user!.id;

    // Проверяем не занят ли адрес другим пользователем
    const existing = await prisma.user.findFirst({
      where: { tonWalletAddress: walletAddress, id: { not: userId } },
    });
    if (existing) {
      return res.status(409).json({ error: "Этот адрес уже привязан к другому аккаунту" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { tonWalletAddress: walletAddress },
    });

    res.json({ success: true, walletAddress });
  } catch (err) {
    console.error("[shop/ton/connect]", err);
    res.status(500).json({ error: "Ошибка подключения кошелька" });
  }
});

// POST /api/v1/shop/ton/buy — купить монеты за TON (начисление после подтверждения платежа)
shopRouter.post("/ton/buy", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.tonWalletAddress) {
      return res.status(403).json({ error: "Сначала подключите TON кошелёк" });
    }

    const { tonAmount } = req.body;
    const ton = parseFloat(tonAmount);
    if (!ton || ton < 0.1) {
      return res.status(400).json({ error: "Минимальная сумма: 0.1 TON" });
    }

    const COINS_PER_TON = 1_000_000;
    const FEE = 0.005;
    const grossCoins = BigInt(Math.round(ton * COINS_PER_TON));
    const feeCoins = BigInt(Math.round(Number(grossCoins) * FEE));
    const netCoins = grossCoins - feeCoins;

    await updateBalance(userId, netCoins, TransactionType.TRADE_BUY, { source: "TON", tonAmount: ton });

    res.json({ coinsReceived: netCoins.toString(), tonAmount: ton });
  } catch (err) {
    console.error("[shop/ton/buy]", err);
    res.status(500).json({ error: "Ошибка покупки монет" });
  }
});

// POST /api/v1/shop/ton/sell — продать монеты за TON (создаёт заявку)
shopRouter.post("/ton/sell", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.tonWalletAddress) {
      return res.status(403).json({ error: "Сначала подключите TON кошелёк" });
    }

    const { coinsAmount } = req.body;
    const coins = BigInt(String(coinsAmount).replace(/\D/g, "") || "0");
    if (coins < 1_000_000n) {
      return res.status(400).json({ error: "Минимум 1,000,000 ᚙ" });
    }
    if (user.balance < coins) {
      return res.status(400).json({ error: "Недостаточно монет" });
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
    console.error("[shop/ton/sell]", err);
    res.status(500).json({ error: "Ошибка продажи монет" });
  }
});

// POST /api/v1/shop/ton/withdraw — вывод монет в TON
shopRouter.post("/ton/withdraw", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.tonWalletAddress) {
      return res.status(403).json({ error: "Сначала подключите TON кошелёк" });
    }

    const { coinsAmount } = req.body;
    const coins = BigInt(String(coinsAmount).replace(/\D/g, "") || "0");
    if (coins < 1_000_000n) {
      return res.status(400).json({ error: "Минимум 1,000,000 ᚙ для вывода" });
    }
    if (user.balance < coins) {
      return res.status(400).json({ error: "Недостаточно монет" });
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
    console.error("[shop/ton/withdraw]", err);
    res.status(500).json({ error: "Ошибка вывода" });
  }
});
