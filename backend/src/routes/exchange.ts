import { redis } from '@/lib/redis'; // OPT-8
// ═══════════════════════════════════════════════════════════════
// P2P БИРЖА ChessCoin v7.0.1
// FLOW: Продавец создаёт ордер (монеты заморожены) →
//       Покупатель инициирует TON-транзакцию через TonConnect →
//       Покупатель отправляет proof (boc+txHash) →
//       Бэкенд переводит ᚙ продавец→покупатель
// ЦЕНА: priceTon = цена за 1 000 000 ᚙ в TON
// МИН:  0.00001 TON/1M ᚙ
// ═══════════════════════════════════════════════════════════════
import { Router, Request, Response } from 'express';
import { prisma } from '@/lib/prisma';
import { authMiddleware } from '@/middleware/auth';
import { TransactionType } from '@prisma/client';
import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis';
import { verifyTonTransaction } from '@/lib/tonverify';
import { getIo } from '@/lib/io';
export const exchangeRouter = Router();

const PLATFORM_FEE_PERCENT = 0.005;
const MIN_ORDER_COINS      = 10_000n;
const MAX_ORDER_COINS      = 100_000_000n;
const MIN_PRICE_TON        = 0.00001;
const MAX_PRICE_TON        = 100_000.0;

// ── E2: GET /orders ───────────────────────────────────────────────────────────
exchangeRouter.get('/orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const myOnly = req.query.mine === 'true';
    const limit  = Math.min(Number(req.query.limit ?? 100), 200);

    const orders = await prisma.p2POrder.findMany({
      where:   myOnly ? { sellerId: userId } : { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      include: { seller: { select: { id: true, firstName: true, username: true, elo: true } } },
    });

    res.json({
      orders: orders.map(o => ({
        id:           o.id,
        sellerId:     o.sellerId,
        sellerName:   o.seller.firstName,
        sellerElo:    o.seller.elo,
        amountCoins:  o.amountCoins.toString(),
        priceTon:     o.priceTon,
        totalTon:     o.totalTon,
        sellerWallet: o.sellerWallet,
        status:       o.status,
        createdAt:    o.createdAt,
        isOwn:        o.sellerId === userId,
      })),
    });
  } catch (err) {
    logger.error('[exchange/orders GET]', err);
    res.status(500).json({ error: 'Ошибка загрузки стакана' });
  }
});

// ── E3: GET /price-history ────────────────────────────────────────────────────
exchangeRouter.get('/price-history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const hours       = Math.min(Number(req.query.hours ?? 24), 720);
    const since       = new Date(Date.now() - hours * 3600_000);
    const bucketHours = hours > 168 ? 24 : 1;

    const executed = await prisma.p2POrder.findMany({
      where:   { status: 'EXECUTED', executedAt: { gte: since } },
      select:  { priceTon: true, amountCoins: true, totalTon: true, executedAt: true },
      orderBy: { executedAt: 'asc' },
      take:    1000, // OPT-8: лимит — защита от медленных запросов
    });

    const buckets = new Map<string, { open: number; close: number; high: number; low: number; volume: number }>();
    for (const o of executed) {
      const d  = o.executedAt!;
      const bh = Math.floor(d.getHours() / bucketHours) * bucketHours;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(bh).padStart(2,'0')}:00`;
      if (!buckets.has(key)) buckets.set(key, { open: o.priceTon, close: o.priceTon, high: o.priceTon, low: o.priceTon, volume: 0 });
      const b = buckets.get(key)!;
      b.close  = o.priceTon;
      b.high   = Math.max(b.high, o.priceTon);
      b.low    = Math.min(b.low,  o.priceTon);
      b.volume += o.totalTon;
    }

    const last  = await prisma.p2POrder.findFirst({ where: { status: 'EXECUTED' }, orderBy: { executedAt: 'desc' }, select: { priceTon: true } });
    const prev  = await prisma.p2POrder.findFirst({ where: { status: 'EXECUTED', executedAt: { lte: new Date(Date.now() - 86400_000) } }, orderBy: { executedAt: 'desc' }, select: { priceTon: true } });
    const cur   = last?.priceTon ?? 0;
    const p24   = prev?.priceTon ?? cur;
    const chg24 = p24 > 0 ? Math.round(((cur - p24) / p24) * 10000) / 100 : 0;

    res.json({
      currentPrice: cur,
      change24h:    chg24,
      candles:      Array.from(buckets.entries()).map(([time, b]) => ({ time, ...b })),
      volume24h:    executed.reduce((s, o) => s + o.totalTon, 0),
    });
  } catch (err) {
    logger.error('[exchange/price-history]', err);
    res.status(500).json({ error: 'Ошибка истории цены' });
  }
});

// ── E4: POST /orders — создать ордер ─────────────────────────────────────────
exchangeRouter.post('/orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amountCoins, priceTon } = req.body;
    if (!amountCoins || !priceTon) return res.status(400).json({ error: 'amountCoins и priceTon обязательны' });

    const amount = BigInt(String(amountCoins));
    const price  = Number(priceTon);
    if (amount < MIN_ORDER_COINS)  return res.status(400).json({ error: `Минимум ${MIN_ORDER_COINS.toLocaleString()} ᚙ` });
    if (amount > MAX_ORDER_COINS)  return res.status(400).json({ error: `Максимум ${MAX_ORDER_COINS.toLocaleString()} ᚙ` });
    if (price < MIN_PRICE_TON)     return res.status(400).json({ error: `Минимальная цена ${MIN_PRICE_TON} TON/1M ᚙ` });
    if (price > MAX_PRICE_TON)     return res.status(400).json({ error: `Слишком высокая цена` });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true, tonWalletAddress: true } });
    if (!user?.tonWalletAddress)   return res.status(403).json({ error: 'TON_WALLET_REQUIRED', message: 'Подключи TON-кошелёк для торговли на бирже' });
    if (user.balance < amount)     return res.status(400).json({ error: 'INSUFFICIENT_COINS', message: 'Недостаточно ᚙ на балансе' });

    // P4: Лимит открытых ордеров на пользователя (макс 5)
    const openCount = await prisma.p2POrder.count({ where: { sellerId: userId, status: 'OPEN', orderType: 'SELL' } });
    if (openCount >= 5) return res.status(400).json({ error: 'MAX_OPEN_ORDERS', message: 'Максимум 5 открытых SELL-ордеров. Отмените старый перед созданием нового.' });

    const totalTon = (Number(amount) / 1_000_000) * price;
    const feeTon   = totalTon * PLATFORM_FEE_PERCENT;

    const order = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { balance: { decrement: amount } } });
      await tx.transaction.create({ data: { userId, type: TransactionType.EXCHANGE_FREEZE, amount: -amount, payload: { action: 'freeze_order' } } });
      return tx.p2POrder.create({ data: { sellerId: userId, amountCoins: amount, priceTon: price, totalTon, feeTon, sellerWallet: user.tonWalletAddress!, status: 'OPEN' } });
    });

    logger.info(`[exchange] Created order ${order.id}: ${amount} ᚙ @ ${price} TON/1M by ${userId}`);
    res.json({ order: { id: order.id, amountCoins: order.amountCoins.toString(), priceTon: order.priceTon, totalTon: order.totalTon, feeTon: order.feeTon, status: order.status, createdAt: order.createdAt } });
  } catch (err) {
    logger.error('[exchange/orders POST]', err);
    res.status(500).json({ error: 'Ошибка создания ордера' });
  }
});

// ── E5: DELETE /orders/:id — отменить ─────────────────────────────────────────
exchangeRouter.delete('/orders/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId  = req.user!.id;
    const orderId = req.params.id;
    const order   = await prisma.p2POrder.findUnique({ where: { id: orderId } });
    if (!order)                     return res.status(404).json({ error: 'Ордер не найден' });
    if (order.sellerId !== userId)  return res.status(403).json({ error: 'Только создатель может отменить ордер' });
    if (order.status !== 'OPEN')    return res.status(409).json({ error: 'Ордер уже закрыт' });

    await prisma.$transaction(async (tx) => {
      await tx.p2POrder.update({ where: { id: orderId }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      await tx.user.update({ where: { id: userId }, data: { balance: { increment: order.amountCoins } } });
      await tx.transaction.create({ data: { userId, type: TransactionType.EXCHANGE_UNFREEZE, amount: order.amountCoins, payload: { orderId } } });
    });

    logger.info(`[exchange] Cancelled order ${orderId} by ${userId}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('[exchange/orders DELETE]', err);
    res.status(500).json({ error: 'Ошибка отмены ордера' });
  }
});

// ── E6: POST /orders/:id/execute — исполнить ─────────────────────────────────
exchangeRouter.post('/orders/:id/execute', authMiddleware, async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.id;
    const orderId = req.params.id;
    const { boc, txHash, partialCoins } = req.body; // E12: partialCoins — купить часть ордера
    if (!txHash) return res.status(400).json({ error: 'txHash обязателен' });

    // Idempotency
    const byHash = await prisma.p2POrder.findFirst({ where: { txHash } });
    if (byHash?.status === 'EXECUTED') return res.json({ success: true, alreadyExecuted: true });

    const order = await prisma.p2POrder.findUnique({ where: { id: orderId } });
    if (!order)                    return res.status(404).json({ error: 'Ордер не найден' });
    if (order.status !== 'OPEN')   return res.status(409).json({ error: 'Ордер уже закрыт' });
    if (order.sellerId === buyerId) return res.status(400).json({ error: 'Нельзя купить у самого себя' });

    const buyer = await prisma.user.findUnique({ where: { id: buyerId }, select: { tonWalletAddress: true } });
    if (!buyer?.tonWalletAddress)  return res.status(403).json({ error: 'TON_WALLET_REQUIRED', message: 'Подключи TON-кошелёк для торговли' });

    // E12: Частичное исполнение — определяем реальную сумму покупки
    const requestedCoins = partialCoins ? BigInt(String(partialCoins)) : order.amountCoins;
    if (requestedCoins <= 0n) return res.status(400).json({ error: 'Количество монет должно быть > 0' });
    if (requestedCoins > order.amountCoins) return res.status(400).json({ error: 'Нельзя купить больше чем в ордере' });
    const isPartial    = requestedCoins < order.amountCoins;
    const actualCoins  = requestedCoins;
    const actualTonAmt = (Number(actualCoins) / 1_000_000) * order.priceTon;

    // ── E11: Верификация TON-транзакции ──────────────────────────
    const verification = await verifyTonTransaction({
      boc,
      txHash,
      expectedTo:  order.sellerWallet,
      expectedTon: actualTonAmt,
      fromAddress: buyer.tonWalletAddress ?? undefined,
    });

    if (verification.status === 'invalid') {
      logger.warn(`[exchange] Invalid TON tx for order ${orderId}: ${verification.reason}`);
      return res.status(422).json({
        error:  'TON_TX_INVALID',
        reason: verification.reason,
        message: 'Транзакция не прошла верификацию. Монеты не списаны.',
      });
    }

    // PENDING = API недоступен или tx ещё не индексирован — разрешаем, но помечаем
    const verifyStatus = verification.status === 'ok' ? 'VERIFIED' : 'PENDING';
    if (verifyStatus === 'PENDING') {
      logger.warn(`[exchange] Order ${orderId} will be re-verified in background: ${verification.reason}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Атомарное обновление: updateMany с фильтром status=OPEN защищает от race condition
      if (isPartial) {
        // E12: Частичное исполнение — разделяем ордер
        const remainCoins  = order.amountCoins - actualCoins;
        const remainTon    = (Number(remainCoins) / 1_000_000) * order.priceTon;
        const partialFee   = actualTonAmt * PLATFORM_FEE_PERCENT;

        // Закрываем текущий ордер
        const result = await tx.p2POrder.updateMany({
          where: { id: orderId, status: 'OPEN' },
          data:  { status: 'EXECUTED', buyerId, buyerWallet: buyer.tonWalletAddress!, txHash, txBoc: boc ?? null, executedAt: new Date(), verifyStatus, amountCoins: actualCoins, totalTon: actualTonAmt, feeTon: partialFee },
        });
        if (result.count === 0) throw new Error('ORDER_ALREADY_TAKEN');

        // Создаём новый ордер с остатком (возвращаем монеты продавцу не нужно — они уже там не списывались)
        await tx.p2POrder.create({
          data: { sellerId: order.sellerId, amountCoins: remainCoins, priceTon: order.priceTon, totalTon: remainTon, feeTon: remainTon * PLATFORM_FEE_PERCENT, sellerWallet: order.sellerWallet, status: 'OPEN' },
        });

        await tx.user.update({ where: { id: buyerId }, data: { balance: { increment: actualCoins } } });
        // Возвращаем разницу продавцу (он заморозил весь ордер, остаток возвращаем)
        await tx.user.update({ where: { id: order.sellerId }, data: { balance: { increment: remainCoins } } });
        await tx.transaction.createMany({
          data: [
            { userId: order.sellerId, type: TransactionType.EXCHANGE_SELL,     amount: -actualCoins,  payload: { orderId, txHash, partial: true, totalTon: actualTonAmt } },
            { userId: order.sellerId, type: TransactionType.EXCHANGE_UNFREEZE, amount:  remainCoins,  payload: { orderId, reason: 'partial_remain' } },
            { userId: buyerId,        type: TransactionType.EXCHANGE_BUY,      amount:  actualCoins,  payload: { orderId, txHash, partial: true, totalTon: actualTonAmt } },
          ],
        });
        return result;
      } else {
        // Полное исполнение (исходная логика)
        const result = await tx.p2POrder.updateMany({
          where: { id: orderId, status: 'OPEN' },
          data:  { status: 'EXECUTED', buyerId, buyerWallet: buyer.tonWalletAddress!, txHash, txBoc: boc ?? null, executedAt: new Date(), verifyStatus },
        });
        if (result.count === 0) throw new Error('ORDER_ALREADY_TAKEN');
        await tx.user.update({ where: { id: buyerId }, data: { balance: { increment: order.amountCoins } } });
        await tx.transaction.createMany({
          data: [
            { userId: order.sellerId, type: TransactionType.EXCHANGE_SELL, amount: -order.amountCoins, payload: { orderId, txHash, totalTon: order.totalTon, feeTon: order.feeTon } },
            { userId: buyerId,        type: TransactionType.EXCHANGE_BUY,  amount:  order.amountCoins, payload: { orderId, txHash, totalTon: order.totalTon } },
          ],
        });
        return result;
      }
    });

    // Уведомления через бот (fire-and-forget)
    // БАГ #4 fix: переименованы sellerUser/buyerUser (избегаем shadow с buyer выше)
    const [sellerUser, buyerUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: order.sellerId }, select: { telegramId: true, firstName: true } }),
      prisma.user.findUnique({ where: { id: buyerId },        select: { telegramId: true, firstName: true } }),
    ]);
    const notifData = { amountCoins: order.amountCoins.toString(), totalTon: order.totalTon };
    await prisma.adminNotification.createMany({ data: [
      { type: 'EXCHANGE_ORDER_SOLD',   payload: { ...notifData, telegramId: sellerUser?.telegramId, buyerName:  buyerUser?.firstName  ?? 'Покупатель' } },
      { type: 'EXCHANGE_ORDER_BOUGHT', payload: { ...notifData, telegramId: buyerUser?.telegramId,  sellerName: sellerUser?.firstName ?? 'Продавец'   } },
    ]}).catch(() => {}); // не блокируем ответ

    // E13: Socket push — немедленное уведомление обоим игрокам
    try {
      const io = getIo();
      const payload = {
        type:        'exchange:executed',
        orderId,
        amountCoins: order.amountCoins.toString(),
        totalTon:    order.totalTon,
      };
      io.emit(`user:${order.sellerId}`, { ...payload, role: 'seller' });
      io.emit(`user:${buyerId}`,        { ...payload, role: 'buyer'  });
    } catch (socketErr) {
      logger.warn('[exchange] Socket emit failed (non-critical):', socketErr);
    }

    logger.info(`[exchange] Executed order ${orderId}: buyer=${buyerId}, ${order.amountCoins} ᚙ, tx=${txHash}`);
    res.json({ success: true, amountCoins: actualCoins.toString(), totalTon: actualTonAmt, feeTon: actualTonAmt * PLATFORM_FEE_PERCENT, isPartial });
  } catch (err) {
    if ((err as Error).message === 'ORDER_ALREADY_TAKEN') {
      return res.status(409).json({ error: 'Ордер уже был куплен другим игроком' });
    }
    logger.error('[exchange/orders/:id/execute]', err);
    res.status(500).json({ error: 'Ошибка исполнения ордера' });
  }
});

// ── STATS: GET /stats ─────────────────────────────────────────────────────────
exchangeRouter.get('/stats', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const [openOrders, volume24h, lastPrice, allTimeVolume] = await Promise.all([
      // Открытые ордера
      prisma.p2POrder.aggregate({
        where: { status: 'OPEN' },
        _count: { id: true },
        _sum:   { amountCoins: true },
      }),
      // Объём за 24ч
      prisma.p2POrder.aggregate({
        where: { status: 'EXECUTED', executedAt: { gte: new Date(Date.now() - 86400_000) } },
        _count: { id: true },
        _sum:   { totalTon: true, amountCoins: true },
      }),
      // Последняя цена
      prisma.p2POrder.findFirst({
        where: { status: 'EXECUTED' },
        orderBy: { executedAt: 'desc' },
        select: { priceTon: true },
      }),
      // Всего сделок
      prisma.p2POrder.count({ where: { status: 'EXECUTED' } }),
    ]);

    res.json({
      openOrdersCount:  openOrders._count.id,
      openOrdersCoins:  (openOrders._sum.amountCoins ?? 0n).toString(),
      volume24hTon:     volume24h._sum.totalTon ?? 0,
      volume24hCoins:   (volume24h._sum.amountCoins ?? 0n).toString(),
      trades24h:        volume24h._count.id,
      lastPrice:        lastPrice?.priceTon ?? 0,
      allTimeTrades:    allTimeVolume,
    });
  } catch (err) {
    logger.error('[exchange/stats]', err);
    res.status(500).json({ error: 'Ошибка статистики' });
  }
});

// ══════════════════════════════════════════════════════════════
// E15: BUY ОРДЕРА — покупатель выставляет цену, продавец принимает
//
// Логика BUY:
// 1. Покупатель создаёт BUY-ордер: указывает кол-во ᚙ и цену (TON/1M)
//    → Никаких монет не нужно, но нужен TON-кошелёк
//    → Ордер появляется в стакане "хочу купить"
// 2. Продавец у которого есть ᚙ видит BUY-ордера
//    → Нажимает "Продать" → его ᚙ замораживаются
//    → Он инициирует TON-транзакцию покупателя через TonConnect
//    → Покупатель платит, продавец получает TON
// ══════════════════════════════════════════════════════════════

// ── E15-1: POST /buy-orders — создать BUY ордер ──────────────────────────────
exchangeRouter.post('/buy-orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amountCoins, priceTon } = req.body;

    if (!amountCoins || !priceTon) return res.status(400).json({ error: 'amountCoins и priceTon обязательны' });

    const amount = BigInt(String(amountCoins));
    const price  = Number(priceTon);

    if (amount < MIN_ORDER_COINS) return res.status(400).json({ error: `Минимум ${MIN_ORDER_COINS.toLocaleString()} ᚙ` });
    if (price < MIN_PRICE_TON)    return res.status(400).json({ error: `Минимальная цена ${MIN_PRICE_TON} TON/1M ᚙ` });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tonWalletAddress: true } });
    if (!user?.tonWalletAddress) return res.status(403).json({ error: 'TON_WALLET_REQUIRED', message: 'Подключи TON-кошелёк для торговли' });

    // P4: Лимит BUY-ордеров
    const openBuyCount = await prisma.p2POrder.count({ where: { sellerId: userId, status: 'OPEN', orderType: 'BUY' } });
    if (openBuyCount >= 5) return res.status(400).json({ error: 'MAX_OPEN_ORDERS', message: 'Максимум 5 открытых BUY-ордеров.' });

    const totalTon = (Number(amount) / 1_000_000) * price;
    const feeTon   = totalTon * PLATFORM_FEE_PERCENT;

    // BUY-ордер: никакой заморозки ᚙ не нужно (покупатель платит TON когда сделка состоится)
    const order = await prisma.p2POrder.create({
      data: {
        orderType:    'BUY',
        sellerId:     userId,       // покупатель ᚙ = создатель BUY-ордера
        amountCoins:  amount,
        priceTon:     price,
        totalTon,
        feeTon,
        sellerWallet: user.tonWalletAddress, // кошелёк покупателя (откуда придёт TON)
        status:       'OPEN',
      },
    });

    logger.info(`[exchange] BUY order created: ${order.id} by ${userId}, ${amount} ᚙ @ ${price} TON/1M`);
    res.json({ order: { id: order.id, orderType: 'BUY', amountCoins: order.amountCoins.toString(), priceTon: order.priceTon, totalTon: order.totalTon, status: order.status } });
  } catch (err) {
    logger.error('[exchange/buy-orders POST]', err);
    res.status(500).json({ error: 'Ошибка создания BUY-ордера' });
  }
});

// ── E15-2: GET /buy-orders — стакан BUY ордеров ──────────────────────────────
exchangeRouter.get('/buy-orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit  = Math.min(Number(req.query.limit ?? 100), 200);

    const orders = await prisma.p2POrder.findMany({
      where:   { orderType: 'BUY', status: 'OPEN' },
      orderBy: { priceTon: 'desc' }, // лучшая цена (выше) — первая
      take:    limit,
      include: { seller: { select: { id: true, firstName: true, elo: true } } },
    });

    res.json({
      orders: orders.map(o => ({
        id:            o.id,
        orderType:     'BUY',
        buyerId:       o.sellerId,  // создатель BUY = покупатель ᚙ
        buyerName:     o.seller.firstName,
        buyerElo:      o.seller.elo,
        amountCoins:   o.amountCoins.toString(),
        priceTon:      o.priceTon,
        totalTon:      o.totalTon,
        buyerWallet:   o.sellerWallet, // кошелёк покупателя
        status:        o.status,
        createdAt:     o.createdAt,
        isOwn:         o.sellerId === userId,
      })),
    });
  } catch (err) {
    logger.error('[exchange/buy-orders GET]', err);
    res.status(500).json({ error: 'Ошибка загрузки BUY-стакана' });
  }
});

// ── E15-3: DELETE /buy-orders/:id — отменить BUY ордер ───────────────────────
exchangeRouter.delete('/buy-orders/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId  = req.user!.id;
    const orderId = req.params.id;

    const order = await prisma.p2POrder.findUnique({ where: { id: orderId } });
    if (!order)                    return res.status(404).json({ error: 'Ордер не найден' });
    if (order.sellerId !== userId) return res.status(403).json({ error: 'Только создатель может отменить ордер' });
    if (order.orderType !== 'BUY') return res.status(400).json({ error: 'Это не BUY-ордер' });
    if (order.status !== 'OPEN')   return res.status(409).json({ error: 'Ордер уже закрыт' });

    await prisma.p2POrder.update({
      where: { id: orderId },
      data:  { status: 'CANCELLED', cancelledAt: new Date() },
    });

    logger.info(`[exchange] BUY order cancelled: ${orderId} by ${userId}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('[exchange/buy-orders DELETE]', err);
    res.status(500).json({ error: 'Ошибка отмены BUY-ордера' });
  }
});

// ── E15-4: POST /buy-orders/:id/fill — продавец принимает BUY-ордер ──────────
exchangeRouter.post('/buy-orders/:id/fill', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.id; // тот кто принимает BUY = продавец ᚙ
    const orderId  = req.params.id;
    const { boc, txHash } = req.body;
    if (!txHash) return res.status(400).json({ error: 'txHash обязателен' });

    // Idempotency
    const byHash = await prisma.p2POrder.findFirst({ where: { txHash } });
    if (byHash?.status === 'EXECUTED') return res.json({ success: true, alreadyExecuted: true });

    const order = await prisma.p2POrder.findUnique({ where: { id: orderId } });
    if (!order)                     return res.status(404).json({ error: 'Ордер не найден' });
    if (order.orderType !== 'BUY')  return res.status(400).json({ error: 'Это не BUY-ордер' });
    if (order.status !== 'OPEN')    return res.status(409).json({ error: 'Ордер уже закрыт' });
    if (order.sellerId === sellerId) return res.status(400).json({ error: 'Нельзя исполнить свой собственный ордер' });

    // Проверяем у продавца достаточно ᚙ
    const seller = await prisma.user.findUnique({ where: { id: sellerId }, select: { balance: true, tonWalletAddress: true } });
    if (!seller?.tonWalletAddress) return res.status(403).json({ error: 'TON_WALLET_REQUIRED' });
    if (seller.balance < order.amountCoins) return res.status(400).json({ error: 'INSUFFICIENT_COINS', message: 'Недостаточно ᚙ для исполнения этого ордера' });

    // Верификация TON: покупатель (order.sellerWallet) должен был отправить TON продавцу (seller.tonWalletAddress)
    const verification = await verifyTonTransaction({
      boc,
      txHash,
      expectedTo:  seller.tonWalletAddress,
      expectedTon: order.totalTon,
      fromAddress: order.sellerWallet,
    });

    if (verification.status === 'invalid') {
      return res.status(422).json({ error: 'TON_TX_INVALID', reason: verification.reason });
    }

    const verifyStatus = verification.status === 'ok' ? 'VERIFIED' : 'PENDING';

    // Атомарная сделка
    await prisma.$transaction(async (tx) => {
      const result = await tx.p2POrder.updateMany({
        where: { id: orderId, status: 'OPEN', orderType: 'BUY' },
        data:  { status: 'EXECUTED', buyerId: sellerId, buyerWallet: seller.tonWalletAddress!, txHash, txBoc: boc ?? null, executedAt: new Date(), verifyStatus },
      });
      if (result.count === 0) throw new Error('ORDER_ALREADY_TAKEN');

      // ᚙ от продавца → покупателю ᚙ (создателю BUY-ордера)
      await tx.user.update({ where: { id: sellerId },       data: { balance: { decrement: order.amountCoins } } });
      await tx.user.update({ where: { id: order.sellerId }, data: { balance: { increment: order.amountCoins } } });

      await tx.transaction.createMany({
        data: [
          { userId: sellerId,       type: TransactionType.EXCHANGE_SELL, amount: -order.amountCoins, payload: { orderId, txHash, orderType: 'BUY_FILL', totalTon: order.totalTon } },
          { userId: order.sellerId, type: TransactionType.EXCHANGE_BUY,  amount:  order.amountCoins, payload: { orderId, txHash, orderType: 'BUY_FILL', totalTon: order.totalTon } },
        ],
      });
    });

    // Уведомления (fire-and-forget)
    const [buyer, sellerUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: order.sellerId }, select: { telegramId: true, firstName: true } }),
      prisma.user.findUnique({ where: { id: sellerId },       select: { telegramId: true, firstName: true } }),
    ]);
    await prisma.adminNotification.createMany({ data: [
      { type: 'EXCHANGE_ORDER_SOLD',   payload: { amountCoins: order.amountCoins.toString(), totalTon: order.totalTon, telegramId: sellerUser?.telegramId, buyerName: buyer?.firstName  ?? 'Покупатель' } },
      { type: 'EXCHANGE_ORDER_BOUGHT', payload: { amountCoins: order.amountCoins.toString(), totalTon: order.totalTon, telegramId: buyer?.telegramId,      sellerName: sellerUser?.firstName ?? 'Продавец' } },
    ]}).catch(() => {});

    // Socket push
    try {
      const io = getIo();
      const payload = { type: 'exchange:executed', orderId, orderType: 'BUY', amountCoins: order.amountCoins.toString(), totalTon: order.totalTon };
      io.emit(`user:${order.sellerId}`, { ...payload, role: 'buyer'  });
      io.emit(`user:${sellerId}`,       { ...payload, role: 'seller' });
    } catch {}

    logger.info(`[exchange] BUY order filled: ${orderId} by seller=${sellerId}`);
    res.json({ success: true, amountCoins: order.amountCoins.toString(), totalTon: order.totalTon });
  } catch (err) {
    if ((err as Error).message === 'ORDER_ALREADY_TAKEN') {
      return res.status(409).json({ error: 'Ордер уже исполнен другим продавцом' });
    }
    logger.error('[exchange/buy-orders/:id/fill]', err);
    res.status(500).json({ error: 'Ошибка исполнения BUY-ордера' });
  }
});

// ── P2: GET /leaderboard — топ трейдеров (с Redis кешем 5 мин) ───────────────
exchangeRouter.get('/leaderboard', authMiddleware, async (req: Request, res: Response) => {
  try {
    const period = req.query.period as string ?? '30d';
    // OPT-8: Кеш лидерборда 5 минут (не меняется часто)
    const cacheKey = `exchange:leaderboard:${period}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    } catch {}
    const since  = period === '7d'
      ? new Date(Date.now() - 7  * 86400_000)
      : period === '24h'
      ? new Date(Date.now() - 86400_000)
      : new Date(Date.now() - 30 * 86400_000); // 30d default

    // Агрегируем по sellerId (продавцы ᚙ)
    const sellers = await prisma.p2POrder.groupBy({
      by:      ['sellerId'],
      where:   { status: 'EXECUTED', executedAt: { gte: since } },
      _count:  { id: true },
      _sum:    { totalTon: true, amountCoins: true },
      orderBy: { _sum: { totalTon: 'desc' } },
      take:    20,
    });

    // Получаем имена
    const userIds  = sellers.map(s => s.sellerId);
    const users    = await prisma.user.findMany({
      where:  { id: { in: userIds } },
      select: { id: true, firstName: true, elo: true, avatar: true, avatarType: true },
    });
    const userMap  = new Map(users.map(u => [u.id, u]));

    const leaderboard = sellers.map((s, i) => ({
      rank:        i + 1,
      userId:      s.sellerId,
      name:        userMap.get(s.sellerId)?.firstName ?? '?',
      elo:         userMap.get(s.sellerId)?.elo ?? 0,
      trades:      s._count.id,
      volumeTon:   s._sum.totalTon ?? 0,
      volumeCoins: (s._sum.amountCoins ?? 0n).toString(),
    }));

    const lbResult = { period, leaderboard };
    try { await redis.setex(cacheKey, 300, JSON.stringify(lbResult)); } catch {}
    res.json(lbResult);
  } catch (err) {
    logger.error('[exchange/leaderboard]', err);
    res.status(500).json({ error: 'Ошибка лидерборда' });
  }
});
