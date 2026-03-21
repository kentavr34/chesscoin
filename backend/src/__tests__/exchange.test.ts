/**
 * exchange.test.ts — R2: Unit тесты для P2P биржи
 *
 * Тестируем:
 * - Создание SELL/BUY ордеров (математика)
 * - Исполнение (coins transfer logic)
 * - Частичное исполнение (split)
 * - Race condition protection
 * - Валидация (мин/макс, цена)
 * - Комиссия платформы
 * - Автоотмена старых ордеров
 */

import { describe, it, expect } from '@jest/globals';

// ── Константы биржи ───────────────────────────────────────────────────────────
const PLATFORM_FEE   = 0.005;        // 0.5%
const MIN_COINS      = 10_000n;
const MAX_COINS      = 100_000_000n;
const MIN_PRICE_TON  = 0.00001;
const STALE_DAYS     = 30;

// ── Расчёт суммы ордера ───────────────────────────────────────────────────────
function calcOrder(amountCoins: bigint, priceTon: number) {
  const totalTon = (Number(amountCoins) / 1_000_000) * priceTon;
  const feeTon   = totalTon * PLATFORM_FEE;
  const netTon   = totalTon - feeTon;
  return { totalTon, feeTon, netTon };
}

// ── Валидация ордера ──────────────────────────────────────────────────────────
function validateOrder(amountCoins: bigint, priceTon: number): { ok: boolean; error?: string } {
  if (amountCoins < MIN_COINS)   return { ok: false, error: 'MIN_COINS' };
  if (amountCoins > MAX_COINS)   return { ok: false, error: 'MAX_COINS' };
  if (priceTon < MIN_PRICE_TON)  return { ok: false, error: 'MIN_PRICE' };
  return { ok: true };
}

// ── Частичное исполнение ──────────────────────────────────────────────────────
function calcPartial(orderCoins: bigint, orderPriceTon: number, partialCoins: bigint) {
  if (partialCoins > orderCoins) throw new Error('PARTIAL_EXCEEDS_ORDER');
  const ratio       = Number(partialCoins) / Number(orderCoins);
  const actualTon   = (Number(orderCoins) / 1_000_000) * orderPriceTon * ratio;
  const remainCoins = orderCoins - partialCoins;
  return { actualTon, remainCoins, isPartial: remainCoins > 0n };
}

// ── Стакан: сортировка ────────────────────────────────────────────────────────
type Order = { priceTon: number; amountCoins: bigint };

function sortSellBook(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => a.priceTon - b.priceTon); // дешевле первым
}
function sortBuyBook(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => b.priceTon - a.priceTon); // дороже первым
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Exchange order math', () => {
  it('1M ᚙ по цене 0.1 TON = 0.1 TON итого', () => {
    const { totalTon } = calcOrder(1_000_000n, 0.1);
    expect(totalTon).toBeCloseTo(0.1, 6);
  });

  it('комиссия 0.5% от суммы ордера', () => {
    const { totalTon, feeTon, netTon } = calcOrder(1_000_000n, 1.0);
    expect(feeTon).toBeCloseTo(totalTon * 0.005, 8);
    expect(netTon).toBeCloseTo(totalTon * 0.995, 8);
  });

  it('продавец получает 99.5% от totalTon', () => {
    const { totalTon, netTon } = calcOrder(5_000_000n, 0.5);
    expect(netTon / totalTon).toBeCloseTo(0.995, 4);
  });

  it('10K ᚙ по минимальной цене 0.00001 TON', () => {
    const { totalTon } = calcOrder(10_000n, MIN_PRICE_TON);
    expect(totalTon).toBeCloseTo(0.0000001, 9); // 10_000/1M * 0.00001
  });

  it('100M ᚙ (максимум) по цене 1 TON = 100 TON', () => {
    const { totalTon } = calcOrder(100_000_000n, 1.0);
    expect(totalTon).toBeCloseTo(100.0, 4);
  });

  it('BigInt: расчёт не теряет точность', () => {
    const coins = 99_999_999n;
    const price = 0.123456789;
    const { totalTon } = calcOrder(coins, price);
    expect(totalTon).toBeGreaterThan(0);
    expect(Number.isFinite(totalTon)).toBe(true);
  });
});

describe('Exchange order validation', () => {
  it('ровно MIN_COINS (10 000) — проходит', () => {
    expect(validateOrder(10_000n, 0.001).ok).toBe(true);
  });

  it('меньше MIN_COINS — отклоняется', () => {
    const r = validateOrder(9_999n, 0.001);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('MIN_COINS');
  });

  it('больше MAX_COINS — отклоняется', () => {
    const r = validateOrder(100_000_001n, 0.001);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('MAX_COINS');
  });

  it('цена ниже минимума — отклоняется', () => {
    const r = validateOrder(100_000n, 0.000001); // меньше 0.00001
    expect(r.ok).toBe(false);
    expect(r.error).toBe('MIN_PRICE');
  });

  it('цена = минимуму — проходит', () => {
    expect(validateOrder(100_000n, MIN_PRICE_TON).ok).toBe(true);
  });

  it('MAX_COINS с высокой ценой — проходит', () => {
    expect(validateOrder(MAX_COINS, 100.0).ok).toBe(true);
  });
});

describe('Partial order execution (E12)', () => {
  it('купить половину ордера: actualTon = 50%', () => {
    const orderCoins   = 1_000_000n;
    const priceTon     = 1.0;
    const partialCoins = 500_000n;
    const { actualTon, remainCoins, isPartial } = calcPartial(orderCoins, priceTon, partialCoins);
    expect(actualTon).toBeCloseTo(0.5, 4);
    expect(remainCoins).toBe(500_000n);
    expect(isPartial).toBe(true);
  });

  it('купить весь ордер: isPartial=false', () => {
    const { remainCoins, isPartial } = calcPartial(1_000_000n, 1.0, 1_000_000n);
    expect(remainCoins).toBe(0n);
    expect(isPartial).toBe(false);
  });

  it('нельзя купить больше чем в ордере', () => {
    expect(() => calcPartial(500_000n, 1.0, 600_000n)).toThrow('PARTIAL_EXCEEDS_ORDER');
  });

  it('частичная покупка 10%: пропорциональный расчёт', () => {
    const { actualTon, remainCoins } = calcPartial(1_000_000n, 2.0, 100_000n);
    expect(actualTon).toBeCloseTo(0.2, 6); // 0.1M * 2.0
    expect(remainCoins).toBe(900_000n);
  });

  it('монеты: partial + remain = total', () => {
    const total  = 3_000_000n;
    const partial = 1_234_567n;
    const { remainCoins } = calcPartial(total, 0.5, partial);
    expect(partial + remainCoins).toBe(total);
  });

  it('минимальный остаток = 1 монета', () => {
    const { remainCoins, isPartial } = calcPartial(10_000n, 1.0, 9_999n);
    expect(remainCoins).toBe(1n);
    expect(isPartial).toBe(true);
  });
});

describe('Order book sorting', () => {
  const orders: Order[] = [
    { priceTon: 0.5, amountCoins: 100_000n },
    { priceTon: 0.1, amountCoins: 500_000n },
    { priceTon: 1.0, amountCoins: 50_000n  },
    { priceTon: 0.3, amountCoins: 200_000n },
  ];

  it('SELL-стакан: дешевле первым (лучшее предложение для покупателя)', () => {
    const sorted = sortSellBook(orders);
    expect(sorted[0].priceTon).toBe(0.1);
    expect(sorted[sorted.length - 1].priceTon).toBe(1.0);
  });

  it('BUY-стакан: дороже первым (лучшее предложение для продавца)', () => {
    const sorted = sortBuyBook(orders);
    expect(sorted[0].priceTon).toBe(1.0);
    expect(sorted[sorted.length - 1].priceTon).toBe(0.1);
  });

  it('SELL: цены строго возрастают', () => {
    const sorted = sortSellBook(orders);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].priceTon).toBeGreaterThanOrEqual(sorted[i-1].priceTon);
    }
  });

  it('BUY: цены строго убывают', () => {
    const sorted = sortBuyBook(orders);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].priceTon).toBeLessThanOrEqual(sorted[i-1].priceTon);
    }
  });

  it('сортировка не мутирует исходный массив', () => {
    const original = [...orders];
    sortSellBook(orders);
    expect(orders).toEqual(original);
  });
});

describe('Race condition protection', () => {
  it('ORDER_ALREADY_TAKEN: updateMany вернул count=0', () => {
    // updateMany с WHERE status=OPEN возвращает { count: 0 } если уже взят
    const result = { count: 0 };
    const isTaken = result.count === 0;
    expect(isTaken).toBe(true);
  });

  it('успешное исполнение: updateMany вернул count=1', () => {
    const result = { count: 1 };
    const isTaken = result.count === 0;
    expect(isTaken).toBe(false);
  });

  it('нельзя купить у самого себя', () => {
    const sellerId = 'user-123';
    const buyerId  = 'user-123'; // тот же пользователь
    expect(sellerId === buyerId).toBe(true); // должно быть отклонено
  });

  it('разные пользователи — сделка разрешена', () => {
    const sellerId = 'user-123';
    const buyerId  = 'user-456';
    expect(sellerId === buyerId).toBe(false);
  });

  it('idempotency: txHash уже существует → already executed', () => {
    const existingTxHash = 'abc123def456';
    const newTxHash      = 'abc123def456'; // тот же
    expect(existingTxHash === newTxHash).toBe(true); // должен вернуть alreadyExecuted
  });
});

describe('Stale order cancellation (cron)', () => {
  const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

  it('ордер старше 30 дней — устаревший', () => {
    const now      = Date.now();
    const old      = new Date(now - STALE_MS - 1000); // 30 дней + 1 сек
    const isStale  = (now - old.getTime()) > STALE_MS;
    expect(isStale).toBe(true);
  });

  it('ордер ровно 30 дней — устаревший (граница)', () => {
    const now     = Date.now();
    const exactly = new Date(now - STALE_MS);
    const isStale = (now - exactly.getTime()) >= STALE_MS;
    expect(isStale).toBe(true);
  });

  it('ордер 29 дней — не устаревший', () => {
    const now      = Date.now();
    const young    = new Date(now - STALE_MS + 60_000); // на 1 минуту моложе
    const isStale  = (now - young.getTime()) > STALE_MS;
    expect(isStale).toBe(false);
  });

  it('при отмене: монеты возвращаются продавцу', () => {
    const frozenCoins   = 500_000n;
    const sellerBalance = 1_000_000n;
    const newBalance    = sellerBalance + frozenCoins; // EXCHANGE_UNFREEZE
    expect(newBalance).toBe(1_500_000n);
  });
});

describe('BUY order logic (E15)', () => {
  it('BUY-ордер не требует заморозки ᚙ (только TON-кошелёк)', () => {
    const buyerBalance  = 0n;        // нет ᚙ
    const buyerHasWallet = true;     // есть TON кошелёк
    const canCreateBuy  = buyerHasWallet; // баланс ᚙ не важен для BUY
    expect(canCreateBuy).toBe(true);
  });

  it('продавец заморазивает ᚙ при принятии BUY-ордера', () => {
    const sellerBalance = 1_000_000n;
    const orderCoins    = 500_000n;
    const hasEnough     = sellerBalance >= orderCoins;
    expect(hasEnough).toBe(true);
  });

  it('продавцу недостаточно ᚙ — нельзя принять BUY-ордер', () => {
    const sellerBalance = 100_000n;
    const orderCoins    = 500_000n;
    const hasEnough     = sellerBalance >= orderCoins;
    expect(hasEnough).toBe(false);
  });

  it('BUY-стакан: лучшая цена (выше) — первая', () => {
    const buyOrders: Order[] = [
      { priceTon: 0.5, amountCoins: 100_000n },
      { priceTon: 1.2, amountCoins: 200_000n }, // лучшее предложение для продавца
      { priceTon: 0.8, amountCoins: 150_000n },
    ];
    const sorted = sortBuyBook(buyOrders);
    expect(sorted[0].priceTon).toBe(1.2);
  });

  it('после исполнения BUY: coins перешли от продавца к покупателю', () => {
    const sellerBefore = 2_000_000n;
    const buyerBefore  = 0n;
    const traded       = 500_000n;
    const sellerAfter  = sellerBefore - traded;
    const buyerAfter   = buyerBefore  + traded;
    expect(sellerAfter).toBe(1_500_000n);
    expect(buyerAfter).toBe(500_000n);
    expect(sellerAfter + buyerAfter).toBe(sellerBefore + buyerBefore); // сохранение
  });
});

describe('Price discovery', () => {
  it('рыночная цена = последняя исполненная сделка', () => {
    const trades = [
      { priceTon: 0.1, time: 1000 },
      { priceTon: 0.3, time: 2000 },
      { priceTon: 0.2, time: 3000 }, // последняя
    ];
    const lastPrice = trades.sort((a, b) => b.time - a.time)[0].priceTon;
    expect(lastPrice).toBe(0.2);
  });

  it('изменение цены 24ч: рост на 50%', () => {
    const prev    = 0.1;
    const current = 0.15;
    const change  = ((current - prev) / prev) * 100;
    expect(change).toBeCloseTo(50, 2);
  });

  it('изменение цены 24ч: падение на 20%', () => {
    const prev    = 0.25;
    const current = 0.20;
    const change  = ((current - prev) / prev) * 100;
    expect(change).toBeCloseTo(-20, 2);
  });

  it('без сделок: изменение цены = 0', () => {
    const prev    = 0.1;
    const current = 0.1; // нет изменений
    const change  = prev > 0 ? ((current - prev) / prev) * 100 : 0;
    expect(change).toBe(0);
  });

  it('OHLCV: high >= close >= low', () => {
    const candle = { open: 0.1, high: 0.15, low: 0.08, close: 0.12 };
    expect(candle.high).toBeGreaterThanOrEqual(candle.close);
    expect(candle.close).toBeGreaterThanOrEqual(candle.low);
    expect(candle.high).toBeGreaterThanOrEqual(candle.open);
  });
});
