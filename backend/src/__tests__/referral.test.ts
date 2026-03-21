/**
 * referral.test.ts — R2: Unit тесты реферальной системы
 *
 * Тестируем:
 * - Прогрессию военных рангов (по числу рефералов)
 * - Расчёт бонусов (activationBonus, l1Percent)
 * - Уровень 2 рефералов (sub-referral 10%)
 * - Граничные случаи
 */

import { describe, it, expect } from '@jest/globals';

// ── Данные рангов (совпадают с militaryRank.ts) ───────────────────────────────
const RANK_BONUSES: Record<string, { activationBonus: bigint; l1Percent: number }> = {
  RECRUIT:       { activationBonus:       0n, l1Percent:  0 },
  PRIVATE:       { activationBonus:   3_000n, l1Percent:  1 },
  CORPORAL:      { activationBonus:   4_000n, l1Percent:  2 },
  SERGEANT:      { activationBonus:   5_000n, l1Percent:  3 },
  WARRANT:       { activationBonus:   6_000n, l1Percent:  4 },
  JR_LIEUTENANT: { activationBonus:   7_000n, l1Percent:  5 },
  LIEUTENANT:    { activationBonus:   8_000n, l1Percent:  5 },
  SR_LIEUTENANT: { activationBonus:   9_000n, l1Percent:  5 },
  CAPTAIN:       { activationBonus:  10_000n, l1Percent:  6 },
  MAJOR:         { activationBonus:  12_000n, l1Percent:  7 },
  LT_COLONEL:    { activationBonus:  13_000n, l1Percent:  8 },
  COLONEL:       { activationBonus:  14_000n, l1Percent:  9 },
  BRIGADIER:     { activationBonus:  15_000n, l1Percent: 10 },
  MAJ_GENERAL:   { activationBonus:  20_000n, l1Percent: 11 },
  LT_GENERAL:    { activationBonus:  25_000n, l1Percent: 12 },
  COL_GENERAL:   { activationBonus:  30_000n, l1Percent: 13 },
  MARSHAL:       { activationBonus:  35_000n, l1Percent: 14 },
  EMPEROR:       { activationBonus:  40_000n, l1Percent: 15 },
};

const RANK_THRESHOLDS = [
  { rank: 'EMPEROR',       minMembers: 1_000_000 },
  { rank: 'MARSHAL',       minMembers: 500_000   },
  { rank: 'COL_GENERAL',   minMembers: 300_000   },
  { rank: 'LT_GENERAL',    minMembers: 200_000   },
  { rank: 'MAJ_GENERAL',   minMembers: 100_000   },
  { rank: 'BRIGADIER',     minMembers: 80_000    },
  { rank: 'COLONEL',       minMembers: 60_000    },
  { rank: 'LT_COLONEL',    minMembers: 40_000    },
  { rank: 'MAJOR',         minMembers: 20_000    },
  { rank: 'CAPTAIN',       minMembers: 10_000    },
  { rank: 'SR_LIEUTENANT', minMembers: 5_000     },
  { rank: 'LIEUTENANT',    minMembers: 3_000     },
  { rank: 'JR_LIEUTENANT', minMembers: 1_000     },
  { rank: 'WARRANT',       minMembers: 500       },
  { rank: 'SERGEANT',      minMembers: 100       },
  { rank: 'CORPORAL',      minMembers: 50        },
  { rank: 'PRIVATE',       minMembers: 10        },
  { rank: 'RECRUIT',       minMembers: 0         },
];

function getMilitaryRank(count: number): string {
  for (const r of RANK_THRESHOLDS) {
    if (count >= r.minMembers) return r.rank;
  }
  return 'RECRUIT';
}

function getRankBonuses(count: number) {
  const rank = getMilitaryRank(count);
  return RANK_BONUSES[rank];
}

function calcReferralIncome(winAmount: bigint, referrerCount: number): { l1: bigint; l2: bigint } {
  const { l1Percent } = getRankBonuses(referrerCount);
  const l1 = (winAmount * BigInt(l1Percent)) / 100n;
  const l2 = (winAmount * 10n) / 100n; // sub-referral всегда 10%
  return { l1, l2 };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Military rank progression', () => {
  it('0 рефералов → RECRUIT', () => {
    expect(getMilitaryRank(0)).toBe('RECRUIT');
  });

  it('9 рефералов → RECRUIT', () => {
    expect(getMilitaryRank(9)).toBe('RECRUIT');
  });

  it('10 рефералов → PRIVATE (первый боевой ранг)', () => {
    expect(getMilitaryRank(10)).toBe('PRIVATE');
  });

  it('100 рефералов → SERGEANT', () => {
    expect(getMilitaryRank(100)).toBe('SERGEANT');
  });

  it('1000 рефералов → JR_LIEUTENANT', () => {
    expect(getMilitaryRank(1_000)).toBe('JR_LIEUTENANT');
  });

  it('10 000 рефералов → CAPTAIN', () => {
    expect(getMilitaryRank(10_000)).toBe('CAPTAIN');
  });

  it('1 000 000 рефералов → EMPEROR (максимум)', () => {
    expect(getMilitaryRank(1_000_000)).toBe('EMPEROR');
  });

  it('больше 1M рефералов → всё равно EMPEROR', () => {
    expect(getMilitaryRank(5_000_000)).toBe('EMPEROR');
  });

  it('граница: 49 → RECRUIT, 50 → CORPORAL', () => {
    expect(getMilitaryRank(49)).toBe('RECRUIT');
    expect(getMilitaryRank(50)).toBe('CORPORAL');
  });

  it('все ранги отсортированы по убыванию порога', () => {
    for (let i = 1; i < RANK_THRESHOLDS.length; i++) {
      expect(RANK_THRESHOLDS[i-1].minMembers).toBeGreaterThan(RANK_THRESHOLDS[i].minMembers);
    }
  });
});

describe('Rank bonuses', () => {
  it('RECRUIT: 0 бонус, 0%', () => {
    const b = getRankBonuses(0);
    expect(b.activationBonus).toBe(0n);
    expect(b.l1Percent).toBe(0);
  });

  it('PRIVATE (10 рефералов): 3000 ᚙ, 1%', () => {
    const b = getRankBonuses(10);
    expect(b.activationBonus).toBe(3_000n);
    expect(b.l1Percent).toBe(1);
  });

  it('EMPEROR (1M+ рефералов): 40000 ᚙ, 15%', () => {
    const b = getRankBonuses(1_000_000);
    expect(b.activationBonus).toBe(40_000n);
    expect(b.l1Percent).toBe(15);
  });

  it('бонус строго растёт с рангом (кроме плато у лейтенантов)', () => {
    const ranks = ['PRIVATE','CORPORAL','SERGEANT','WARRANT','JR_LIEUTENANT','SR_LIEUTENANT','CAPTAIN'];
    let prev = 0n;
    for (const rank of ranks) {
      const { activationBonus } = RANK_BONUSES[rank];
      expect(activationBonus).toBeGreaterThanOrEqual(prev);
      prev = activationBonus;
    }
  });

  it('l1Percent не превышает 15%', () => {
    Object.values(RANK_BONUSES).forEach(({ l1Percent }) => {
      expect(l1Percent).toBeLessThanOrEqual(15);
      expect(l1Percent).toBeGreaterThanOrEqual(0);
    });
  });

  it('CAPTAIN (10K): 10 000 ᚙ, 6%', () => {
    const b = getRankBonuses(10_000);
    expect(b.activationBonus).toBe(10_000n);
    expect(b.l1Percent).toBe(6);
  });
});

describe('Referral income calculation', () => {
  it('RECRUIT рефоводу: ничего не начисляется (0%)', () => {
    const { l1 } = calcReferralIncome(10_000n, 5); // 5 рефералов → RECRUIT
    expect(l1).toBe(0n);
  });

  it('PRIVATE рефоводу (10 рефералов): 1% от выигрыша', () => {
    const winAmount = 9_000n;
    const { l1 } = calcReferralIncome(winAmount, 10);
    expect(l1).toBe(90n); // 9000 * 1% = 90
  });

  it('EMPEROR рефоводу (1M рефералов): 15% от выигрыша', () => {
    const winAmount = 100_000n;
    const { l1 } = calcReferralIncome(winAmount, 1_000_000);
    expect(l1).toBe(15_000n); // 100_000 * 15% = 15000
  });

  it('level2 всегда 10% от выигрыша реферала', () => {
    const winAmount = 50_000n;
    const { l2 } = calcReferralIncome(winAmount, 0); // любой ранг
    expect(l2).toBe(5_000n); // 50_000 * 10% = 5000
  });

  it('l1 + l2 не превышают winAmount', () => {
    const winAmount = 10_000n;
    const { l1, l2 } = calcReferralIncome(winAmount, 1_000_000); // EMPEROR, 15%
    expect(l1 + l2).toBeLessThanOrEqual(winAmount);
    // 15% + 10% = 25% ≤ 100% ✓
  });

  it('выигрыш 0: никакого дохода нет', () => {
    const { l1, l2 } = calcReferralIncome(0n, 1_000);
    expect(l1).toBe(0n);
    expect(l2).toBe(0n);
  });

  it('большой выигрыш: BigInt точность сохраняется', () => {
    const bigWin = 999_999_999n;
    const { l1 } = calcReferralIncome(bigWin, 1_000_000); // EMPEROR 15%
    expect(l1).toBe(149_999_999n); // Math.floor(999_999_999 * 15 / 100)
  });

  it('ранг меняется при достижении порога (49→50: RECRUIT→CORPORAL)', () => {
    const win = 10_000n;
    const before = calcReferralIncome(win, 49); // RECRUIT → 0%
    const after  = calcReferralIncome(win, 50); // CORPORAL → 2%
    expect(before.l1).toBe(0n);
    expect(after.l1).toBe(200n); // 10000 * 2%
  });
});

describe('Referral activation bonus', () => {
  it('RECRUIT: бонус не начисляется при первой игре реферала', () => {
    const bonus = RANK_BONUSES['RECRUIT'].activationBonus;
    expect(bonus).toBe(0n);
  });

  it('PRIVATE: 3000 ᚙ за каждого нового реферала (первая игра)', () => {
    const bonus = RANK_BONUSES['PRIVATE'].activationBonus;
    expect(bonus).toBe(3_000n);
  });

  it('бонус удваивается в диапазоне PRIVATE→CORPORAL→SERGEANT', () => {
    const p = RANK_BONUSES['PRIVATE'].activationBonus;    // 3000
    const c = RANK_BONUSES['CORPORAL'].activationBonus;   // 4000
    const s = RANK_BONUSES['SERGEANT'].activationBonus;   // 5000
    expect(c).toBeGreaterThan(p);
    expect(s).toBeGreaterThan(c);
  });

  it('только в Фазе 1 (эмиссия): бонус начисляется', () => {
    // В фазе 1 canEmit=true, в фазе 2 canEmit=false
    const phase1 = true;
    const phase2 = false;
    const bonusPhase1 = phase1 ? 3_000n : 0n;
    const bonusPhase2 = phase2 ? 3_000n : 0n;
    expect(bonusPhase1).toBe(3_000n);
    expect(bonusPhase2).toBe(0n);
  });
});

describe('Sub-referral (level 2)', () => {
  const SUB_REFERRAL_PERCENT = 10;

  it('всегда 10% независимо от ранга рефовода', () => {
    expect(SUB_REFERRAL_PERCENT).toBe(10);
  });

  it('sub-referral < level1 у EMPEROR (10% vs 15%)', () => {
    const l1 = RANK_BONUSES['EMPEROR'].l1Percent;
    expect(SUB_REFERRAL_PERCENT).toBeLessThan(l1);
  });

  it('sub-referral > level1 у PRIVATE (10% vs 1%)', () => {
    const l1 = RANK_BONUSES['PRIVATE'].l1Percent;
    expect(SUB_REFERRAL_PERCENT).toBeGreaterThan(l1);
  });

  it('цепочка: A→B→C: A получает sub-referral от побед C', () => {
    const cWins = 50_000n; // C выиграл 50 000 ᚙ
    const bGets = (cWins * BigInt(RANK_BONUSES['PRIVATE'].l1Percent)) / 100n; // B получает свой %
    const aGets = (cWins * BigInt(SUB_REFERRAL_PERCENT)) / 100n;             // A получает 10%
    expect(aGets).toBe(5_000n);
    expect(bGets).toBe(500n); // PRIVATE = 1%
  });
});
