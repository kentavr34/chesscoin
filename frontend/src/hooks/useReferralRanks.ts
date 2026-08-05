import { useT } from '@/i18n/useT';

interface RankThreshold {
  rank: string;
  label: string;
  minReferrals: number;
  bonus: number;
  pct: number;
}

const RANK_BASE = [
  { rank: 'EMPEROR',      minReferrals: 1_000_000, bonus: 40_000,  pct: 15 },
  { rank: 'MARSHAL',      minReferrals: 500_000,   bonus: 35_000,  pct: 14 },
  { rank: 'COL_GENERAL',  minReferrals: 300_000,   bonus: 30_000,  pct: 13 },
  { rank: 'LT_GENERAL',   minReferrals: 200_000,   bonus: 25_000,  pct: 12 },
  { rank: 'MAJ_GENERAL',  minReferrals: 100_000,   bonus: 20_000,  pct: 11 },
  { rank: 'BRIGADIER',    minReferrals: 80_000,    bonus: 15_000,  pct: 10 },
  { rank: 'COLONEL',      minReferrals: 60_000,    bonus: 14_000,  pct:  9 },
  { rank: 'LT_COLONEL',   minReferrals: 40_000,    bonus: 13_000,  pct:  8 },
  { rank: 'MAJOR',        minReferrals: 20_000,    bonus: 12_000,  pct:  7 },
  { rank: 'CAPTAIN',      minReferrals: 10_000,   bonus: 10_000,  pct:  6 },
  { rank: 'SR_LIEUTENANT',minReferrals: 5_000,    bonus:  9_000,  pct:  5 },
  { rank: 'LIEUTENANT',   minReferrals: 3_000,    bonus:  8_000,  pct:  5 },
  { rank: 'JR_LIEUTENANT',minReferrals: 1_000,    bonus:  7_000,  pct:  5 },
  { rank: 'WARRANT',      minReferrals: 500,       bonus:  6_000,  pct:  4 },
  { rank: 'SERGEANT',     minReferrals: 100,       bonus:  5_000,  pct:  3 },
  { rank: 'CORPORAL',     minReferrals: 50,        bonus:  4_000,  pct:  2 },
  { rank: 'PRIVATE',      minReferrals: 10,        bonus:  3_000,  pct:  1 },
  { rank: 'RECRUIT',      minReferrals: 0,         bonus:      0,  pct:  0 },
];

/**
 * Hook to get localized referral rank thresholds with current language
 * Usage: const ranks = useReferralRanks();
 */
export function useReferralRanks(): RankThreshold[] {
  const t = useT();
  return RANK_BASE.map((base, idx) => ({
    ...base,
    label: t.referrals.ranks[idx].label,
  }));
}

/**
 * Get localized name for a referral rank by its code
 */
export function getRankLabel(t: ReturnType<typeof useT>, rankCode: string): string {
  const rankIdx = RANK_BASE.findIndex(r => r.rank === rankCode);
  if (rankIdx < 0) return rankCode;
  return t.referrals.ranks[rankIdx].label;
}

/**
 * Find rank data by referral count
 */
export function findRankByReferralCount(ranks: RankThreshold[], count: number) {
  return ranks.find(r => count >= r.minReferrals) ?? ranks[ranks.length - 1];
}
