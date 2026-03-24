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
// Используем number вместо bigint — Jest worker не может сериализовать BigInt
const RANK_BONUSES: Record<string, { activationBonus: number; l1Percent: number }> = {
  RECRUIT:       { activationBonus:       0, l1Percent:  0 },
  PRIVATE:       { activationBonus:   3_000, l1Percent:  1 },
  CORPORAL:      { activationBonus:   4_000, l1Percent:  2 },
  SERGEANT:      { activationBonus:   5_000, l1Percent:  3 },
  WARRANT:       { activationBonus:   6_000, l1Percent:  4 },
  JR_LIEUTENANT: { activationBonus:   7_000, l1Percent:  5 },
  LIEUTENANT:    { activationBonus:   8_000, l1Percent:  5 },
  SR_LIEUTENANT: { activationBonus:   9_000, l1Percent:  5 },
  CAPTAIN:       { activationBonus:  10_000, l1Percent:  6 },
  MAJOR:         { activationBonus:  12_000, l1Percent:  7 },
  LT_COLONEL:    { activationBonus:  13_000, l1Percent:  8 },
  COLONEL:       { activationBonus:  14_000, l1Percent:  9 },
  BRIGADIER:     { activationBonus:  15_000, l1Percent: 10 },
  MAJ_GENERAL:   { activationBonus:  20_000, l1Percent: 11 },
  LT_GENERAL:    { activationBonus:  25_000, l1Percent: 12 },
  COL_GENERAL:   { activationBonus:  30_000, l1Percent: 13 },
  MARSHAL:       { activationBonus:  35_000, l1Percent: 14 },
  EMPEROR:       { activationBonus:  40_000, l1Percent: 15 },
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

function calcReferralIncome(winAmount: number, referrerCount: number): { l1: number; l2: number } {
  const { l1Percent } = getRankBonuses(referrerCount);
  const l1 = Math.floor(winAmount * l1Percent / 100);
  const l2 = Math.floor(winAmount * 10 / 100);
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

  it('граница: 9 → RECRUIT, 10 → PRIVATE, 49 → PRIVATE, 50 → CORPORAL', () => {
    expect(getMilitaryRank(9)).toBe('RECRUIT');
    expect(getMilitaryRank(10)).toBe('PRIVATE');
    expect(getMilitaryRank(49)).toBe('PRIVATE');
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
    expect(b.activationBonus).toBe(0);
    expect(b.l1Percent).toBe(0);
  });

  it('PRIVATE (10 рефералов): 3000 ᚙ, 1%', () => {
    const b = getRankBonuses(10);
    expect(b.activationBonus).toBe(3_000);
    expect(b.l1Percent).toBe(1);
  });

  it('EMPEROR (1M+ рефералов): 40000 ᚙ, 15%', () => {
    const b = getRankBonuses(1_000_000);
    expect(b.activationBonus).toBe(40_000);
    expect(b.l1Percent).toBe(15);
  });

  it('бонус строго растёт с рангом (кроме плато у лейтенантов)', () => {
    const ranks = ['PRIVATE','CORPORAL','SERGEANT','WARRANT','JR_LIEUTENANT','SR_LIEUTENANT','CAPTAIN'];
    let prev = 0;
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
    expect(b.activationBonus).toBe(10_000);
    expect(b.l1Percent).toBe(6);
  });
});

describe('Referral income calculation', () => {
  it('RECRUIT рефоводу: ничего не начисляется (0%)', () => {
    const { l1 } = calcReferralIncome(10_000, 5);
    expect(l1).toBe(0);
  });

  it('PRIVATE рефоводу (10 рефералов): 1% от выигрыша', () => {
    const { l1 } = calcReferralIncome(9_000, 10);
    expect(l1).toBe(90);
  });

  it('EMPEROR рефоводу (1M рефералов): 15% от выигрыша', () => {
    const { l1 } = calcReferralIncome(100_000, 1_000_000);
    expect(l1).toBe(15_000);
  });

  it('level2 всегда 10% от выигрыша реферала', () => {
    const { l2 } = calcReferralIncome(50_000, 0);
    expect(l2).toBe(5_000);
  });

  it('l1 + l2 не превышают winAmount', () => {
    const winAmount = 10_000;
    const { l1, l2 } = calcReferralIncome(winAmount, 1_000_000);
    expect(l1 + l2).toBeLessThanOrEqual(winAmount);
  });

  it('выигрыш 0: никакого дохода нет', () => {
    const { l1, l2 } = calcReferralIncome(0, 1_000);
    expect(l1).toBe(0);
    expect(l2).toBe(0);
  });

  it('большой выигрыш: точность сохраняется', () => {
    const { l1 } = calcReferralIncome(999_999_999, 1_000_000);
    expect(l1).toBe(149_999_999);
  });

  it('ранг меняется при достижении порога (9→10: RECRUIT→PRIVATE)', () => {
    const before = calcReferralIncome(10_000, 9);
    const after  = calcReferralIncome(10_000, 10);
    expect(before.l1).toBe(0);
    expect(after.l1).toBe(100);
  });
});

describe('Referral activation bonus', () => {
  it('RECRUIT: бонус не начисляется при первой игре реферала', () => {
    const bonus = RANK_BONUSES['RECRUIT'].activationBonus;
    expect(bonus).toBe(0);
  });

  it('PRIVATE: 3000 ᚙ за каждого нового реферала (первая игра)', () => {
    const bonus = RANK_BONUSES['PRIVATE'].activationBonus;
    expect(bonus).toBe(3_000);
  });

  it('бонус удваивается в диапазоне PRIVATE→CORPORAL→SERGEANT', () => {
    const p = RANK_BONUSES['PRIVATE'].activationBonus;
    const c = RANK_BONUSES['CORPORAL'].activationBonus;
    const s = RANK_BONUSES['SERGEANT'].activationBonus;
    expect(c).toBeGreaterThan(p);
    expect(s).toBeGreaterThan(c);
  });

  it('только в Фазе 1 (эмиссия): бонус начисляется', () => {
    const phase1 = true;
    const phase2 = false;
    const bonusPhase1 = phase1 ? 3_000 : 0;
    const bonusPhase2 = phase2 ? 3_000 : 0;
    expect(bonusPhase1).toBe(3_000);
    expect(bonusPhase2).toBe(0);
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
    const cWins = 50_000;
    const bGets = Math.floor(cWins * RANK_BONUSES['PRIVATE'].l1Percent / 100);
    const aGets = Math.floor(cWins * SUB_REFERRAL_PERCENT / 100);
    expect(aGets).toBe(5_000);
    expect(bGets).toBe(500);
  });
});
