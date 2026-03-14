export type MilitaryRank =
  | 'PRIVATE' | 'CORPORAL' | 'SERGEANT' | 'LIEUTENANT'
  | 'CAPTAIN' | 'MAJOR' | 'COLONEL' | 'GENERAL' | 'MARSHAL' | 'PRESIDENT';

export const MILITARY_RANKS: { rank: MilitaryRank; minReferrals: number; label: string; emoji: string }[] = [
  { rank: 'PRESIDENT', minReferrals: 1_000_000, label: 'Президент',  emoji: '🏛️' },
  { rank: 'MARSHAL',   minReferrals: 5_000,     label: 'Маршал',     emoji: '⭐⭐⭐' },
  { rank: 'GENERAL',   minReferrals: 1_000,     label: 'Генерал',    emoji: '⭐⭐' },
  { rank: 'COLONEL',   minReferrals: 300,        label: 'Полковник',  emoji: '⭐' },
  { rank: 'MAJOR',     minReferrals: 150,        label: 'Майор',      emoji: '🔰' },
  { rank: 'CAPTAIN',   minReferrals: 75,         label: 'Капитан',    emoji: '🎖️' },
  { rank: 'LIEUTENANT',minReferrals: 30,         label: 'Лейтенант',  emoji: '🏅' },
  { rank: 'SERGEANT',  minReferrals: 15,         label: 'Сержант',    emoji: '🎯' },
  { rank: 'CORPORAL',  minReferrals: 5,          label: 'Ефрейтор',   emoji: '🔹' },
  { rank: 'PRIVATE',   minReferrals: 0,          label: 'Рядовой',    emoji: '🪖' },
];

export const getMilitaryRank = (referralCount: number): { rank: MilitaryRank; label: string; emoji: string; minReferrals: number } => {
  for (const r of MILITARY_RANKS) {
    if (referralCount >= r.minReferrals) return r;
  }
  return MILITARY_RANKS[MILITARY_RANKS.length - 1];
};

export const getNextRank = (referralCount: number): { rank: MilitaryRank; label: string; emoji: string; minReferrals: number } | null => {
  const current = getMilitaryRank(referralCount);
  const idx = MILITARY_RANKS.findIndex(r => r.rank === current.rank);
  if (idx <= 0) return null;
  return MILITARY_RANKS[idx - 1];
};
