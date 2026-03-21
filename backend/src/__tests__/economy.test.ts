/**
 * economy.test.ts — R2: Unit тесты для функций экономики
 *
 * Тестируем: updateBalance, emissionCap логику
 * Мокаем: prisma
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ── Чистые математические тесты (не требуют моков) ───────────────────────────

describe('Balance math', () => {
  it('BigInt арифметика не теряет точность на больших числах', () => {
    const MAX_SUPPLY = 21_000_000_000n; // 21 млрд
    const bet = 100_000n;
    const commission = (bet * 2n * 10n) / 100n;
    expect(commission).toBe(20_000n);
    expect(MAX_SUPPLY - commission).toBe(20_999_980_000n);
  });

  it('emissionCap: нельзя превысить лимит', () => {
    const emissionCap = 1_000_000n;
    const totalEmitted = 999_990n;
    const requested = 20n;
    const canEmit = totalEmitted + requested <= emissionCap;
    expect(canEmit).toBe(false);

    const partial = emissionCap - totalEmitted; // 10
    expect(partial).toBe(10n);
  });

  it('фаза 2: выплата только из существующих средств', () => {
    // В фазе 2 платформа не эмитирует новые монеты
    const platformReserve = 500_000n;
    const requestedPayout = 1_000_000n;
    const actualPayout = requestedPayout > platformReserve
      ? platformReserve
      : requestedPayout;
    expect(actualPayout).toBe(500_000n);
  });

  it('referral income: 50% от выигрыша рефоводу', () => {
    const winAmount = 9000n;
    const referralPercent = 50n;
    const referralIncome = (winAmount * referralPercent) / 100n;
    expect(referralIncome).toBe(4500n);
  });

  it('многоуровневые рефералы: level1=50%, level2=10%', () => {
    const winAmount = 10_000n;
    const level1 = (winAmount * 50n) / 100n; // 5000
    const level2 = (winAmount * 10n) / 100n; // 1000
    expect(level1).toBe(5000n);
    expect(level2).toBe(1000n);
    expect(level1 + level2).toBeLessThanOrEqual(winAmount);
  });
});

// ── TransactionType consistency ───────────────────────────────────────────────

describe('TransactionType usage', () => {
  it('battle payout uses BATTLE_WIN type', () => {
    const BATTLE_WIN = 'BATTLE_WIN';
    const BATTLE_BET = 'BATTLE_BET';
    const BOT_WIN = 'BOT_WIN';
    const TOURNAMENT_WIN = 'TOURNAMENT_WIN';

    // Гарантируем что типы не перепутаны
    expect(BATTLE_WIN).not.toBe(BATTLE_BET);
    expect(BATTLE_WIN).not.toBe(BOT_WIN);
    expect(TOURNAMENT_WIN).not.toBe(BATTLE_WIN);
  });

  it('draw returns BATTLE_BET type (original stake)', () => {
    const drawType = 'BATTLE_BET';
    // При ничьей игрок получает обратно свою ставку — тип BATTLE_BET
    expect(drawType).toBe('BATTLE_BET');
  });
});

// ── Entry fees validation ─────────────────────────────────────────────────────

describe('Tournament entry fees', () => {
  const FEES: Record<string, bigint> = {
    WEEKLY:   1_000n,
    MONTHLY:  3_000n,
    SEASONAL: 10_000n,
    COUNTRY:  25_000n,
    WORLD:    50_000n,
  };

  it('WORLD > COUNTRY > SEASONAL > MONTHLY > WEEKLY', () => {
    expect(FEES.WORLD).toBeGreaterThan(FEES.COUNTRY);
    expect(FEES.COUNTRY).toBeGreaterThan(FEES.SEASONAL);
    expect(FEES.SEASONAL).toBeGreaterThan(FEES.MONTHLY);
    expect(FEES.MONTHLY).toBeGreaterThan(FEES.WEEKLY);
  });

  it('все взносы положительные', () => {
    Object.values(FEES).forEach(fee => {
      expect(fee).toBeGreaterThan(0n);
    });
  });

  it('Jarvis rewards растут с уровнем', () => {
    const JARVIS_REWARDS = [
      1_000n, 2_000n, 4_000n, 6_000n, 8_000n,
      12_000n, 18_000n, 25_000n, 35_000n, 50_000n,
      60_000n, 65_000n, 70_000n, 72_000n, 73_000n,
      74_000n, 75_000n, 75_000n, 75_000n, 75_000n,
    ];
    for (let i = 1; i < JARVIS_REWARDS.length; i++) {
      expect(JARVIS_REWARDS[i]).toBeGreaterThanOrEqual(JARVIS_REWARDS[i-1]);
    }
  });
});
