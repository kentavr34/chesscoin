export type MilitaryRank =
  | 'RECRUIT' | 'PRIVATE' | 'CORPORAL' | 'SERGEANT' | 'WARRANT'
  | 'JR_LIEUTENANT' | 'LIEUTENANT' | 'SR_LIEUTENANT' | 'CAPTAIN'
  | 'MAJOR' | 'LT_COLONEL' | 'COLONEL' | 'BRIGADIER'
  | 'MAJ_GENERAL' | 'LT_GENERAL' | 'COL_GENERAL'
  | 'MARSHAL' | 'EMPEROR';

export const MILITARY_RANKS: {
  rank: MilitaryRank;
  minMembers: number;
  label: string;
  emoji: string;
}[] = [
  { rank: 'EMPEROR',      minMembers: 1_000_000, label: 'Император',          emoji: '👑'    },
  { rank: 'MARSHAL',      minMembers: 500_000,   label: 'Маршал',              emoji: '🏅'    },
  { rank: 'COL_GENERAL',  minMembers: 300_000,   label: 'Генерал-полковник',   emoji: '🌟🌟🌟' },
  { rank: 'LT_GENERAL',   minMembers: 200_000,   label: 'Генерал-лейтенант',   emoji: '🌟🌟'  },
  { rank: 'MAJ_GENERAL',  minMembers: 100_000,   label: 'Генерал-майор',       emoji: '🌟'    },
  { rank: 'BRIGADIER',    minMembers: 80_000,    label: 'Бригадир',            emoji: '🎖️'    },
  { rank: 'COLONEL',      minMembers: 60_000,    label: 'Полковник',           emoji: '⭐⭐⭐'  },
  { rank: 'LT_COLONEL',   minMembers: 40_000,    label: 'Подполковник',        emoji: '⭐⭐'   },
  { rank: 'MAJOR',        minMembers: 20_000,    label: 'Майор',               emoji: '⭐'    },
  { rank: 'CAPTAIN',      minMembers: 10_000,    label: 'Капитан',             emoji: '🔵🔵🔵🔵'},
  { rank: 'SR_LIEUTENANT',minMembers: 5_000,     label: 'Старший Лейтенант',   emoji: '🔵🔵🔵'  },
  { rank: 'LIEUTENANT',   minMembers: 3_000,     label: 'Лейтенант',           emoji: '🔵🔵'   },
  { rank: 'JR_LIEUTENANT',minMembers: 1_000,     label: 'Младший Лейтенант',   emoji: '🔵'    },
  { rank: 'WARRANT',      minMembers: 500,       label: 'Прапорщик',           emoji: '🔶'    },
  { rank: 'SERGEANT',     minMembers: 100,       label: 'Сержант',             emoji: '🔷'    },
  { rank: 'CORPORAL',     minMembers: 50,        label: 'Ефрейтор',            emoji: '🔹'    },
  { rank: 'PRIVATE',      minMembers: 10,        label: 'Рядовой',             emoji: '🪖'    },
  { rank: 'RECRUIT',      minMembers: 0,         label: 'Новобранец',          emoji: '🙂'    },
];

// Бонусы per rank:
// activationBonus = единоразовый бонус за нового члена команды (когда он сыграет первую игру)
// l1Percent       = % от выигрышей прямых рефералов (уровень 1)
export const RANK_BONUSES: Record<MilitaryRank, { activationBonus: bigint; l1Percent: number }> = {
  RECRUIT:       { activationBonus:   3_000n, l1Percent:  1 },
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

export const getMilitaryRank = (memberCount: number): typeof MILITARY_RANKS[0] => {
  for (const r of MILITARY_RANKS) {
    if (memberCount >= r.minMembers) return r;
  }
  return MILITARY_RANKS[MILITARY_RANKS.length - 1];
};

export const getNextRank = (memberCount: number): typeof MILITARY_RANKS[0] | null => {
  const current = getMilitaryRank(memberCount);
  const idx = MILITARY_RANKS.findIndex(r => r.rank === current.rank);
  if (idx <= 0) return null;
  return MILITARY_RANKS[idx - 1];
};

export const getRankBonuses = (memberCount: number) => {
  const r = getMilitaryRank(memberCount);
  return RANK_BONUSES[r.rank];
};
