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
import { findIncomingPayment } from '@/lib/tonverify';
import { getIo } from '@/lib/io';
import { updateBalance } from '@/services/economy';
import config from '@/config';
export const exchangeRouter = Router();

const PLATFORM_FEE_PERCENT = 0.005;
// Минимальный размер сделки — 1 TON (Кенан 31.07.2026: «меньше смысла даже
// нет торговать»). При курсе 100 000 монет за TON это 100 000 монет.
// Порог одинаково касается и целого ордера, и частичной покупки.
const MIN_ORDER_COINS      = 100_000n;
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
    res.status(500).json({ error: 'Failed to load orderbook' });
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
    res.status(500).json({ error: 'Failed to load price history' });
  }
});

// ── E4: POST /orders — создать ордер ─────────────────────────────────────────
exchangeRouter.post('/orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amountCoins, priceTon } = req.body;
    if (!amountCoins || !priceTon) return res.status(400).json({ error: 'amountCoins and priceTon are required' });

    const amount = BigInt(String(amountCoins));
    const price  = Number(priceTon);
    if (amount < MIN_ORDER_COINS)  return res.status(400).json({ error: `Minimum ${MIN_ORDER_COINS.toLocaleString()} ᚙ` });
    if (amount > MAX_ORDER_COINS)  return res.status(400).json({ error: `Maximum ${MAX_ORDER_COINS.toLocaleString()} ᚙ` });
    if (price < MIN_PRICE_TON)     return res.status(400).json({ error: `Minimum price is ${MIN_PRICE_TON} TON/1M ᚙ` });
    if (price > MAX_PRICE_TON)     return res.status(400).json({ error: 'Price is too high' });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true, tonWalletAddress: true } });
    if (!user?.tonWalletAddress)   return res.status(403).json({ error: 'TON_WALLET_REQUIRED', message: 'Connect TON wallet to trade on the exchange' });
    if (user.balance < amount)     return res.status(400).json({ error: 'INSUFFICIENT_COINS', message: 'Insufficient ᚙ balance' });

    // P4: Лимит открытых ордеров на пользователя (макс 5)
    const openCount = await prisma.p2POrder.count({ where: { sellerId: userId, status: 'OPEN', orderType: 'SELL' } });
    if (openCount >= 5) return res.status(400).json({ error: 'MAX_OPEN_ORDERS', message: 'Maximum 5 open SELL orders. Cancel an old one before creating a new one.' });

    const totalTon = (Number(amount) / 1_000_000) * price;
    const feeTon   = totalTon * PLATFORM_FEE_PERCENT;

    const order = await prisma.$transaction(async (tx) => {
      await updateBalance(userId, -amount, TransactionType.EXCHANGE_FREEZE, { action: 'freeze_order' }, { tx });
      return tx.p2POrder.create({ data: { sellerId: userId, amountCoins: amount, priceTon: price, totalTon, feeTon, sellerWallet: user.tonWalletAddress!, status: 'OPEN' } });
    });

    logger.info(`[exchange] Created order ${order.id}: ${amount} ᚙ @ ${price} TON/1M by ${userId}`);
    res.json({ order: { id: order.id, amountCoins: order.amountCoins.toString(), priceTon: order.priceTon, totalTon: order.totalTon, feeTon: order.feeTon, status: order.status, createdAt: order.createdAt } });
  } catch (err) {
    logger.error('[exchange/orders POST]', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// ── E5: DELETE /orders/:id — отменить ─────────────────────────────────────────
exchangeRouter.delete('/orders/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId  = req.user!.id;
    const orderId = req.params.id;
    const order   = await prisma.p2POrder.findUnique({ where: { id: orderId } });
    if (!order)                     return res.status(404).json({ error: 'Order not found' });
    if (order.sellerId !== userId)  return res.status(403).json({ error: 'Only the creator can cancel this order' });
    if (order.status !== 'OPEN')    return res.status(409).json({ error: 'Order is already closed' });

    await prisma.$transaction(async (tx) => {
      await tx.p2POrder.update({ where: { id: orderId }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      await updateBalance(userId, order.amountCoins, TransactionType.EXCHANGE_UNFREEZE, { orderId }, { tx });
    });

    logger.info(`[exchange] Cancelled order ${orderId} by ${userId}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('[exchange/orders DELETE]', err);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// ── E6: POST /orders/:id/execute — исполнить ─────────────────────────────────
exchangeRouter.post('/orders/:id/execute', authMiddleware, async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.id;
    const orderId = req.params.id;
    const { boc, partialCoins } = req.body; // E12: partialCoins — купить часть ордера
    // txHash с клиента больше не принимаем ни в каком виде: настоящий хэш
    // кошелёк фронту не отдаёт, а выдуманный доказательством не был.
    // Идемпотентность — ниже, по реальному хэшу найденного платежа.

    const order = await prisma.p2POrder.findUnique({ where: { id: orderId } });
    if (!order)                    return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'OPEN')   return res.status(409).json({ error: 'Order is already closed' });
    if (order.sellerId === buyerId) return res.status(400).json({ error: 'You cannot buy from yourself' });

    const buyer = await prisma.user.findUnique({ where: { id: buyerId }, select: { tonWalletAddress: true } });
    if (!buyer?.tonWalletAddress)  return res.status(403).json({ error: 'TON_WALLET_REQUIRED', message: 'Connect TON wallet to trade' });

    // E12: Частичное исполнение — определяем реальную сумму покупки
    const requestedCoins = partialCoins ? BigInt(String(partialCoins)) : order.amountCoins;
    if (requestedCoins <= 0n) return res.status(400).json({ error: 'Coin amount must be > 0' });
    // Частичная покупка разрешена (как на криптобиржах: ордер на 100 000 можно
    // взять на 10 000), но не мельче минимальной сделки.
    if (requestedCoins < MIN_ORDER_COINS) {
      return res.status(400).json({
        error: 'BELOW_MIN_TRADE',
        message: `Минимальная сделка — ${MIN_ORDER_COINS.toLocaleString()} ᚙ (1 TON)`,
      });
    }
    if (requestedCoins > order.amountCoins) return res.status(400).json({ error: 'Cannot buy more than available in the order' });
    const isPartial    = requestedCoins < order.amountCoins;
    const actualCoins  = requestedCoins;
    const actualTonAmt = (Number(actualCoins) / 1_000_000) * order.priceTon;

    // ── Верификация ОБОИХ переводов по факту в блокчейне ─────────
    // Платформа денег не хранит и ничего не отправляет: покупатель одной
    // TonConnect-транзакцией шлёт 99.5% продавцу и 0.5% комиссии на кошелёк
    // платформы (frontend/src/lib/tonconnect.ts). Наш кошелёк только принимает.
    //
    // Искать по txHash с клиента нельзя: фронт делает псевдо-хэш из BOC,
    // в блокчейне такого нет — верификация всегда возвращала pending, и биржа
    // на этом основании выдавала монеты бесплатно (найдено 30.07.2026).
    // Поэтому ищем сами платежи: от кошелька покупателя, нужной суммы, свежие.
    const platformWallet = config.ton.platformWallet;
    if (!platformWallet) {
      logger.error('[exchange] PLATFORM_TON_WALLET не задан — сделки запрещены');
      return res.status(503).json({ error: 'EXCHANGE_UNAVAILABLE', message: 'Обмен временно недоступен' });
    }

    const feeTonExpected    = actualTonAmt * PLATFORM_FEE_PERCENT;
    const sellerTonExpected = actualTonAmt - feeTonExpected;
    // допуск 3% на газ и округления
    const toNano = (ton: number) => BigInt(Math.floor(ton * 0.97 * 1e9));

    const sellerLeg = await findIncomingPayment({
      toWallet:   order.sellerWallet,
      fromWallet: buyer.tonWalletAddress!,
      minNano:    toNano(sellerTonExpected),
    });
    if (!sellerLeg) {
      return res.status(402).json({
        error:   'TON_TX_NOT_CONFIRMED',
        message: 'Перевод продавцу пока не найден в блокчейне. Повторите через 30 секунд — монеты не списаны.',
      });
    }

    const feeLeg = await findIncomingPayment({
      toWallet:   platformWallet,
      fromWallet: buyer.tonWalletAddress!,
      minNano:    toNano(feeTonExpected),
    });
    if (!feeLeg) {
      return res.status(402).json({
        error:   'FEE_NOT_CONFIRMED',
        message: 'Комиссия платформы пока не найдена в блокчейне. Повторите через 30 секунд — монеты не списаны.',
      });
    }

    // Один и тот же платёж нельзя предъявить дважды — ключ по реальному хэшу.
    const already = await prisma.p2POrder.findFirst({ where: { txHash: sellerLeg.hash } });
    if (already) {
      // Тот же ордер, оплаченный тем же платежом, — не мошенничество, а повтор
      // запроса (сеть, кнопка дважды). Отвечаем успехом, монеты не двигаем.
      if (already.id === orderId) return res.json({ success: true, alreadyExecuted: true });
      return res.status(409).json({ error: 'PAYMENT_ALREADY_USED', message: 'Этот платёж уже использован' });
    }

    // Раньше PENDING «разрешали, но помечали»: монеты уходили покупателю сразу,
    // а фоновая перепроверка при провале ничего не откатывала — в коде прямо
    // стояло «не откатываем (монеты уже начислены)». То есть любой txHash
    // из головы давал бесплатные монеты. Теперь монеты двигаются только
    // после подтверждения платежа в блокчейне (найдено 30.07.2026).
    const verifyStatus = 'VERIFIED';
    const realTxHash = sellerLeg.hash;

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
          data:  { status: 'EXECUTED', buyerId, buyerWallet: buyer.tonWalletAddress!, txHash: realTxHash, txBoc: boc ?? null, executedAt: new Date(), verifyStatus, amountCoins: actualCoins, totalTon: actualTonAmt, feeTon: partialFee },
        });
        if (result.count === 0) throw new Error('ORDER_ALREADY_TAKEN');

        // Создаём новый ордер с остатком (возвращаем монеты продавцу не нужно — они уже там не списывались)
        await tx.p2POrder.create({
          data: { sellerId: order.sellerId, amountCoins: remainCoins, priceTon: order.priceTon, totalTon: remainTon, feeTon: remainTon * PLATFORM_FEE_PERCENT, sellerWallet: order.sellerWallet, status: 'OPEN' },
        });

        await updateBalance(buyerId, actualCoins, TransactionType.EXCHANGE_BUY, { orderId, txHash: realTxHash, partial: true, totalTon: actualTonAmt }, { tx });
        // Остаток НЕ возвращаем на баланс: он остаётся замороженным и обеспечивает
        // новый ордер. Раньше остаток и возвращали продавцу, и оставляли в новом
        // ордере — монеты удваивались (найдено 30.07.2026).
        // Запись о продаже — нулевая, только для истории: монеты списаны при заморозке,
        // а TON пришли продавцу вне платформы. Ненулевая сумма здесь ломала бы
        // инвариант balance == sum(transactions).
        await tx.transaction.create({
          data: { userId: order.sellerId, type: TransactionType.EXCHANGE_SELL, amount: 0n, payload: { orderId, txHash: realTxHash, partial: true, coinsSold: actualCoins.toString(), totalTon: actualTonAmt } }
        });
        return result;
      } else {
        // Полное исполнение (исходная логика)
        const result = await tx.p2POrder.updateMany({
          where: { id: orderId, status: 'OPEN' },
          data:  { status: 'EXECUTED', buyerId, buyerWallet: buyer.tonWalletAddress!, txHash: realTxHash, txBoc: boc ?? null, executedAt: new Date(), verifyStatus },
        });
        if (result.count === 0) throw new Error('ORDER_ALREADY_TAKEN');
        await updateBalance(buyerId, order.amountCoins, TransactionType.EXCHANGE_BUY, { orderId, txHash: realTxHash, totalTon: order.totalTon }, { tx });
        // Нулевая запись для истории: монеты уже списаны при заморозке ордера,
        // TON продавец получил вне платформы. Раньше здесь писалась отрицательная
        // сумма напрямую в transactions, минуя updateBalance — это ломало
        // инвариант balance == sum(transactions).
        await tx.transaction.create({
          data: { userId: order.sellerId, type: TransactionType.EXCHANGE_SELL, amount: 0n, payload: { orderId, txHash: realTxHash, coinsSold: order.amountCoins.toString(), totalTon: order.totalTon, feeTon: order.feeTon } }
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
      { type: 'EXCHANGE_ORDER_SOLD',   payload: { ...notifData, telegramId: sellerUser?.telegramId, buyerName:  buyerUser?.firstName  ?? 'Buyer' } },
      { type: 'EXCHANGE_ORDER_BOUGHT', payload: { ...notifData, telegramId: buyerUser?.telegramId,  sellerName: sellerUser?.firstName ?? 'Seller'   } },
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

    logger.info(`[exchange] Executed order ${orderId}: buyer=${buyerId}, ${order.amountCoins} ᚙ, tx=${realTxHash}`);
    res.json({ success: true, amountCoins: actualCoins.toString(), totalTon: actualTonAmt, feeTon: actualTonAmt * PLATFORM_FEE_PERCENT, isPartial });
  } catch (err) {
    if ((err as Error).message === 'ORDER_ALREADY_TAKEN') {
      return res.status(409).json({ error: 'Order was already bought by another player' });
    }
    logger.error('[exchange/orders/:id/execute]', err);
    res.status(500).json({ error: 'Failed to execute order' });
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
    res.status(500).json({ error: 'Failed to load stats' });
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

    if (!amountCoins || !priceTon) return res.status(400).json({ error: 'amountCoins and priceTon are required' });

    const amount = BigInt(String(amountCoins));
    const price  = Number(priceTon);

    if (amount < MIN_ORDER_COINS) return res.status(400).json({ error: `Minimum ${MIN_ORDER_COINS.toLocaleString()} ᚙ` });
    if (price < MIN_PRICE_TON)    return res.status(400).json({ error: `Minimum price is ${MIN_PRICE_TON} TON/1M ᚙ` });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tonWalletAddress: true } });
    if (!user?.tonWalletAddress) return res.status(403).json({ error: 'TON_WALLET_REQUIRED', message: 'Connect TON wallet to trade' });

    // P4: Лимит BUY-ордеров
    const openBuyCount = await prisma.p2POrder.count({ where: { sellerId: userId, status: 'OPEN', orderType: 'BUY' } });
    if (openBuyCount >= 5) return res.status(400).json({ error: 'MAX_OPEN_ORDERS', message: 'Maximum 5 open BUY orders.' });

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
    res.status(500).json({ error: 'Failed to create BUY order' });
  }
});

// ── E15-2: GET /buy-orders — стакан BUY ордеров ──────────────────────────────
exchangeRouter.get('/buy-orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit  = Math.min(Number(req.query.limit ?? 100), 200);

    // RESERVED показываем тоже: создатель ордера должен увидеть, что продавец
    // нашёлся, и оплатить — без этого экрана сделка не может состояться.
    const orders = await prisma.p2POrder.findMany({
      where:   { orderType: 'BUY', status: { in: ['OPEN', 'RESERVED'] } },
      orderBy: { priceTon: 'desc' }, // лучшая цена (выше) — первая
      take:    limit,
      include: {
        seller: { select: { id: true, firstName: true, elo: true } },
        buyer:  { select: { firstName: true } },
      },
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
        // Кому платить, если ордер зарезервирован продавцом
        reservedAt:     o.reservedAt,
        reservedByName: o.status === 'RESERVED' ? (o.buyer?.firstName ?? null) : null,
        sellerWallet:   o.status === 'RESERVED' ? o.buyerWallet : null,
        isReservedByMe: o.status === 'RESERVED' && o.buyerId === userId,
      })),
    });
  } catch (err) {
    logger.error('[exchange/buy-orders GET]', err);
    res.status(500).json({ error: 'Failed to load BUY orders' });
  }
});

// ── E15-3: DELETE /buy-orders/:id — отменить BUY ордер ───────────────────────
exchangeRouter.delete('/buy-orders/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId  = req.user!.id;
    const orderId = req.params.id;

    const order = await prisma.p2POrder.findUnique({ where: { id: orderId } });
    if (!order)                    return res.status(404).json({ error: 'Order not found' });
    if (order.sellerId !== userId) return res.status(403).json({ error: 'Only the creator can cancel this order' });
    if (order.orderType !== 'BUY') return res.status(400).json({ error: 'This is not a BUY order' });
    if (order.status === 'EXECUTED' || order.status === 'CANCELLED') {
      return res.status(409).json({ error: 'Order is already closed' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.p2POrder.update({
        where: { id: orderId },
        data:  { status: 'CANCELLED', cancelledAt: new Date() },
      });
      // Если продавец уже зарезервировал ордер — его монеты заморожены,
      // возвращаем. Иначе отмена молча съедала чужие монеты.
      if (order.status === 'RESERVED' && order.buyerId) {
        await updateBalance(order.buyerId, order.amountCoins, TransactionType.EXCHANGE_UNFREEZE,
          { orderId, reason: 'buy_order_cancelled' }, { tx });
      }
    });

    logger.info(`[exchange] BUY order cancelled: ${orderId} by ${userId}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('[exchange/buy-orders DELETE]', err);
    res.status(500).json({ error: 'Failed to cancel BUY order' });
  }
});

// ── E15-4: BUY-ордер исполняется В ДВА ШАГА ─────────────────────────────────
//
// Раньше был один шаг /fill: продавец жал «принять», его же кошелёк подписывал
// перевод, а бэкенд «проверял», что покупатель заплатил. Проверка шла по
// псевдо-хэшу с фронта, всегда возвращала pending — и монеты продавца уходили
// покупателю бесплатно (найдено 30.07.2026). Платить за покупателя продавец
// физически не может: TonConnect подписывает только текущим кошельком.
//
// Правильный порядок, не нарушающий канон «платформа денег не хранит»:
//   1. RESERVE — продавец соглашается и замораживает свои монеты;
//   2. SETTLE  — покупатель платит TON напрямую продавцу (99.5%) и комиссию
//      платформе (0.5%), бэкенд находит ОБА платежа в блокчейне и только
//      после этого отдаёт монеты.
// Не оплатил за RESERVE_TTL — резерв снимается, монеты возвращаются продавцу.

// Сколько ждём оплату после резерва. Больше — продавец надолго без монет,
// меньше — покупатель не успевает подтвердить в кошельке.
const RESERVE_TTL_MS = 30 * 60 * 1000;

// ── E15-4a: POST /buy-orders/:id/reserve — продавец соглашается ──────────────
exchangeRouter.post('/buy-orders/:id/reserve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.id; // тот кто принимает BUY = продавец ᚙ
    const orderId  = req.params.id;

    const order = await prisma.p2POrder.findUnique({ where: { id: orderId } });
    if (!order)                      return res.status(404).json({ error: 'Order not found' });
    if (order.orderType !== 'BUY')   return res.status(400).json({ error: 'This is not a BUY order' });
    if (order.status !== 'OPEN')     return res.status(409).json({ error: 'ORDER_NOT_OPEN', message: 'Ордер уже занят или закрыт' });
    if (order.sellerId === sellerId) return res.status(400).json({ error: 'You cannot execute your own order' });

    const seller = await prisma.user.findUnique({ where: { id: sellerId }, select: { balance: true, tonWalletAddress: true } });
    if (!seller?.tonWalletAddress)          return res.status(403).json({ error: 'TON_WALLET_REQUIRED' });
    if (seller.balance < order.amountCoins) return res.status(400).json({ error: 'INSUFFICIENT_COINS', message: 'Недостаточно монет для этого ордера' });

    await prisma.$transaction(async (tx) => {
      const result = await tx.p2POrder.updateMany({
        where: { id: orderId, status: 'OPEN', orderType: 'BUY' },
        data:  { status: 'RESERVED', buyerId: sellerId, buyerWallet: seller.tonWalletAddress!, reservedAt: new Date() },
      });
      if (result.count === 0) throw new Error('ORDER_ALREADY_TAKEN');
      // Монеты замораживаются так же, как в SELL-ордере: продавец больше не
      // может ими распорядиться, пока сделка не завершится или не истечёт.
      await updateBalance(sellerId, -order.amountCoins, TransactionType.EXCHANGE_FREEZE,
        { orderId, action: 'freeze_buy_reserve' }, { tx });
    });

    const [buyerUser, sellerUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: order.sellerId }, select: { telegramId: true } }),
      prisma.user.findUnique({ where: { id: sellerId },       select: { firstName: true } }),
    ]);
    await prisma.adminNotification.create({ data: {
      type: 'EXCHANGE_BUY_RESERVED',
      payload: { orderId, amountCoins: order.amountCoins.toString(), totalTon: order.totalTon,
                 telegramId: buyerUser?.telegramId, sellerName: sellerUser?.firstName ?? 'Seller' },
    } }).catch(() => {});

    try {
      const io = getIo();
      io.emit(`user:${order.sellerId}`, { type: 'exchange:reserved', orderId, totalTon: order.totalTon, role: 'buyer' });
    } catch {}

    logger.info(`[exchange] BUY order reserved: ${orderId} by seller=${sellerId}`);
    res.json({
      success:      true,
      status:       'RESERVED',
      expiresAt:    new Date(Date.now() + RESERVE_TTL_MS),
      amountCoins:  order.amountCoins.toString(),
      totalTon:     order.totalTon,
    });
  } catch (err) {
    if ((err as Error).message === 'ORDER_ALREADY_TAKEN') {
      return res.status(409).json({ error: 'Order already taken by another seller' });
    }
    logger.error('[exchange/buy-orders/:id/reserve]', err);
    res.status(500).json({ error: 'Failed to reserve BUY order' });
  }
});

// ── E15-4b: POST /buy-orders/:id/settle — покупатель оплатил ─────────────────
exchangeRouter.post('/buy-orders/:id/settle', authMiddleware, async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.id; // создатель BUY-ордера = покупатель ᚙ
    const orderId = req.params.id;
    const { boc } = req.body; // txHash с клиента не принимаем — см. /orders/:id/execute

    const order = await prisma.p2POrder.findUnique({ where: { id: orderId } });
    if (!order)                      return res.status(404).json({ error: 'Order not found' });
    if (order.orderType !== 'BUY')   return res.status(400).json({ error: 'This is not a BUY order' });
    if (order.status === 'EXECUTED') return res.json({ success: true, alreadyExecuted: true });
    if (order.status !== 'RESERVED') return res.status(409).json({ error: 'ORDER_NOT_RESERVED', message: 'Ордер ещё не принят продавцом' });
    if (order.sellerId !== buyerId)  return res.status(403).json({ error: 'Only the order creator can pay for it' });
    if (!order.buyerId || !order.buyerWallet) return res.status(500).json({ error: 'RESERVATION_BROKEN' });

    const platformWallet = config.ton.platformWallet;
    if (!platformWallet) {
      logger.error('[exchange] PLATFORM_TON_WALLET не задан — сделки запрещены');
      return res.status(503).json({ error: 'EXCHANGE_UNAVAILABLE', message: 'Обмен временно недоступен' });
    }

    const buyer = await prisma.user.findUnique({ where: { id: buyerId }, select: { tonWalletAddress: true } });
    if (!buyer?.tonWalletAddress) return res.status(403).json({ error: 'TON_WALLET_REQUIRED' });

    // Ищем оба платежа в блокчейне: покупатель → продавцу 99.5% и → платформе 0.5%.
    const feeTonExpected    = order.totalTon * PLATFORM_FEE_PERCENT;
    const sellerTonExpected = order.totalTon - feeTonExpected;
    const toNano = (ton: number) => BigInt(Math.floor(ton * 0.97 * 1e9)); // допуск 3% на газ

    const sellerLeg = await findIncomingPayment({
      toWallet:   order.buyerWallet,          // для BUY buyerWallet = кошелёк продавца монет
      fromWallet: buyer.tonWalletAddress,
      minNano:    toNano(sellerTonExpected),
    });
    if (!sellerLeg) {
      return res.status(402).json({ error: 'TON_TX_NOT_CONFIRMED', message: 'Перевод продавцу пока не найден в блокчейне. Повторите через 30 секунд — монеты не списаны.' });
    }

    const feeLeg = await findIncomingPayment({
      toWallet:   platformWallet,
      fromWallet: buyer.tonWalletAddress,
      minNano:    toNano(feeTonExpected),
    });
    if (!feeLeg) {
      return res.status(402).json({ error: 'FEE_NOT_CONFIRMED', message: 'Комиссия платформы пока не найдена в блокчейне. Повторите через 30 секунд — монеты не списаны.' });
    }

    const already = await prisma.p2POrder.findFirst({ where: { txHash: sellerLeg.hash } });
    if (already) {
      if (already.id === orderId) return res.json({ success: true, alreadyExecuted: true });
      return res.status(409).json({ error: 'PAYMENT_ALREADY_USED', message: 'Этот платёж уже использован' });
    }

    const sellerOfCoins = order.buyerId;
    await prisma.$transaction(async (tx) => {
      const result = await tx.p2POrder.updateMany({
        where: { id: orderId, status: 'RESERVED', orderType: 'BUY' },
        data:  { status: 'EXECUTED', txHash: sellerLeg.hash, txBoc: boc ?? null, executedAt: new Date(), verifyStatus: 'VERIFIED' },
      });
      if (result.count === 0) throw new Error('ORDER_ALREADY_TAKEN');

      // Монеты продавца уже заморожены на шаге reserve — здесь только начисление
      // покупателю. Нулевая запись продавцу — для истории, чтобы не сломать
      // инвариант balance == sum(transactions).
      await updateBalance(buyerId, order.amountCoins, TransactionType.EXCHANGE_BUY,
        { orderId, txHash: sellerLeg.hash, orderType: 'BUY_FILL', totalTon: order.totalTon }, { tx });
      await tx.transaction.create({ data: {
        userId: sellerOfCoins, type: TransactionType.EXCHANGE_SELL, amount: 0n,
        payload: { orderId, txHash: sellerLeg.hash, orderType: 'BUY_FILL', coinsSold: order.amountCoins.toString(), totalTon: order.totalTon },
      } });
    });

    const [buyerUser, sellerUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: buyerId },       select: { telegramId: true, firstName: true } }),
      prisma.user.findUnique({ where: { id: sellerOfCoins }, select: { telegramId: true, firstName: true } }),
    ]);
    await prisma.adminNotification.createMany({ data: [
      { type: 'EXCHANGE_ORDER_SOLD',   payload: { amountCoins: order.amountCoins.toString(), totalTon: order.totalTon, telegramId: sellerUser?.telegramId, buyerName: buyerUser?.firstName ?? 'Buyer' } },
      { type: 'EXCHANGE_ORDER_BOUGHT', payload: { amountCoins: order.amountCoins.toString(), totalTon: order.totalTon, telegramId: buyerUser?.telegramId,  sellerName: sellerUser?.firstName ?? 'Seller' } },
    ] }).catch(() => {});

    try {
      const io = getIo();
      const payload = { type: 'exchange:executed', orderId, orderType: 'BUY', amountCoins: order.amountCoins.toString(), totalTon: order.totalTon };
      io.emit(`user:${buyerId}`,       { ...payload, role: 'buyer'  });
      io.emit(`user:${sellerOfCoins}`, { ...payload, role: 'seller' });
    } catch {}

    logger.info(`[exchange] BUY order settled: ${orderId}, buyer=${buyerId}, tx=${sellerLeg.hash}`);
    res.json({ success: true, amountCoins: order.amountCoins.toString(), totalTon: order.totalTon });
  } catch (err) {
    if ((err as Error).message === 'ORDER_ALREADY_TAKEN') {
      return res.status(409).json({ error: 'Order state changed, reload the orderbook' });
    }
    logger.error('[exchange/buy-orders/:id/settle]', err);
    res.status(500).json({ error: 'Failed to settle BUY order' });
  }
});

/**
 * Снять протухшие резервы BUY-ордеров и вернуть монеты продавцам.
 * Без этого продавец, чей покупатель не заплатил, остаётся без монет навсегда.
 * Вызывается из cron.
 */
export async function releaseExpiredReservations(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - RESERVE_TTL_MS);
    const stale = await prisma.p2POrder.findMany({
      where: { orderType: 'BUY', status: 'RESERVED', reservedAt: { lt: cutoff } },
      take:  50,
    });
    for (const order of stale) {
      if (!order.buyerId) continue;
      const sellerOfCoins = order.buyerId;
      await prisma.$transaction(async (tx) => {
        const result = await tx.p2POrder.updateMany({
          where: { id: order.id, status: 'RESERVED' },
          data:  { status: 'OPEN', buyerId: null, buyerWallet: null, reservedAt: null },
        });
        if (result.count === 0) return; // успели оплатить — не трогаем
        await updateBalance(sellerOfCoins, order.amountCoins, TransactionType.EXCHANGE_UNFREEZE,
          { orderId: order.id, reason: 'reservation_expired' }, { tx });
      });
      logger.warn(`[exchange] Резерв BUY-ордера ${order.id.slice(0, 8)} истёк, монеты возвращены продавцу`);
    }
  } catch (err) {
    logger.error('[exchange/releaseExpiredReservations]', err);
  }
}

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
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});
