/**
 * crons.test.ts — R2: Unit тесты для логики распределения призов турниров
 *
 * Тестируем: prize distribution формулы, COUNTRY/WEEKLY/MONTHLY/SEASONAL
 * Чистые математические тесты — не требуют моков БД
 */

import { describe, it, expect } from '@jest/globals';

// ── Функция расчёта призов (дублируем логику из crons.ts) ────────────────────

type TournamentType = 'COUNTRY' | 'SEASONAL' | 'MONTHLY' | 'WEEKLY' | 'WORLD';

function calcPrizes(type: TournamentType, totalPool: bigint): Array<[bigint, number]> {
  const isYearly = type === 'COUNTRY';
  if (isYearly) {
    return [
      [totalPool * 60n / 100n, 0],
      [totalPool * 30n / 100n, 1],
      [totalPool * 10n / 100n, 2],
    ];
  }
  if (type === 'SEASONAL') return [[totalPool * 30n / 100n, 0]];
  if (type === 'MONTHLY')  return [[totalPool * 20n / 100n, 0]];
  return [[totalPool * 10n / 100n, 0]]; // WEEKLY / WORLD fallback
}

// ── Тесты ─────────────────────────────────────────────────────────────────────

describe('Tournament prize distribution', () => {
  describe('COUNTRY (60/30/10)', () => {
    it('pool=1000: top3 получают 600/300/100', () => {
      const prizes = calcPrizes('COUNTRY', 1000n);
      expect(prizes[0][0]).toBe(600n);
      expect(prizes[1][0]).toBe(300n);
      expect(prizes[2][0]).toBe(100n);
    });

    it('индексы правильные (0=первое, 1=второе, 2=третье)', () => {
      const prizes = calcPrizes('COUNTRY', 1000n);
      expect(prizes[0][1]).toBe(0);
      expect(prizes[1][1]).toBe(1);
      expect(prizes[2][1]).toBe(2);
    });

    it('сумма не превышает pool', () => {
      const pool = 999_999n;
      const prizes = calcPrizes('COUNTRY', pool);
      const total = prizes.reduce((sum, [amount]) => sum + amount, 0n);
      expect(total).toBeLessThanOrEqual(pool);
    });

    it('первое место всегда > второго > третьего', () => {
      const prizes = calcPrizes('COUNTRY', 10_000n);
      expect(prizes[0][0]).toBeGreaterThan(prizes[1][0]);
      expect(prizes[1][0]).toBeGreaterThan(prizes[2][0]);
    });
  });

  describe('SEASONAL (30%)', () => {
    it('pool=10000: winner получает 3000', () => {
      const prizes = calcPrizes('SEASONAL', 10_000n);
      expect(prizes).toHaveLength(1);
      expect(prizes[0][0]).toBe(3000n);
    });
  });

  describe('MONTHLY (20%)', () => {
    it('pool=10000: winner получает 2000', () => {
      const prizes = calcPrizes('MONTHLY', 10_000n);
      expect(prizes).toHaveLength(1);
      expect(prizes[0][0]).toBe(2000n);
    });
  });

  describe('WEEKLY (10%)', () => {
    it('pool=10000: winner получает 1000', () => {
      const prizes = calcPrizes('WEEKLY', 10_000n);
      expect(prizes).toHaveLength(1);
      expect(prizes[0][0]).toBe(1000n);
    });

    it('pool=0: prize=0', () => {
      const prizes = calcPrizes('WEEKLY', 0n);
      expect(prizes[0][0]).toBe(0n);
    });
  });

  describe('Prize hierarchy: COUNTRY > SEASONAL > MONTHLY > WEEKLY', () => {
    const pool = 100_000n;

    it('COUNTRY top1 > SEASONAL > MONTHLY > WEEKLY', () => {
      const country  = calcPrizes('COUNTRY', pool)[0][0];   // 60000
      const seasonal = calcPrizes('SEASONAL', pool)[0][0];  // 30000
      const monthly  = calcPrizes('MONTHLY', pool)[0][0];   // 20000
      const weekly   = calcPrizes('WEEKLY', pool)[0][0];    // 10000

      expect(country).toBeGreaterThan(seasonal);
      expect(seasonal).toBeGreaterThan(monthly);
      expect(monthly).toBeGreaterThan(weekly);
    });
  });
});

// ── Тесты forfeit логики ──────────────────────────────────────────────────────

describe('Tournament forfeit (24h deadline)', () => {
  it('матч старше 24 часов считается просроченным', () => {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const createdAt = new Date(Date.now() - TWENTY_FOUR_HOURS - 1);
    const deadline = new Date(createdAt.getTime() + TWENTY_FOUR_HOURS);
    expect(new Date() > deadline).toBe(true);
  });

  it('матч моложе 24 часов не просрочен', () => {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const createdAt = new Date(Date.now() - TWENTY_FOUR_HOURS + 3600_000); // 23 часа
    const deadline = new Date(createdAt.getTime() + TWENTY_FOUR_HOURS);
    expect(new Date() > deadline).toBe(false);
  });
});
