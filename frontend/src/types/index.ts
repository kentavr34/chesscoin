// ─────────────────────────────────────────
// Типы совпадают с backend auth formatUser + Prisma schema
// ─────────────────────────────────────────

// Совпадает с Prisma enum League
export type League = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND' | 'CHAMPION' | 'STAR';
export type SessionType = 'BOT' | 'BATTLE' | 'FRIENDLY';
export type SessionStatus = 'WAITING_FOR_OPPONENT' | 'IN_PROGRESS' | 'FINISHED' | 'DRAW' | 'CANCELLED' | 'TIME_EXPIRED';

export interface UserPublic {
  id: string;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  avatar?: string | null;
  avatarType?: string | null;
  avatarGradient?: string | null;
  elo: number;
  league: League;
}

// Совпадает с formatUser() в backend/src/routes/auth.ts
export interface User extends UserPublic {
  telegramId: string;
  balance: string;        // bigint как строка
  totalEarned: string;
  totalSpent: string;
  attempts: number;
  maxAttempts: number;
  attemptSlots: string[]; // DateTime[]
  isBanned: boolean;
  referrerId?: string | null;
  activeSessions: ActiveSessionRef[];
  createdAt: string;
  // Поля из Prisma которые могут прийти расширенно
  nationId?: string | null;
  nationRank?: string | null;
  referralCode?: string | null;
  nextAttemptAt?: string | null;
  totalGames?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  winStreak?: number;
  loginStreak?: number;
  referralCount?: number;
  teamSize?: number;
  militaryRank?: MilitaryRankInfo;
  tonWalletAddress?: string | null;
  tonConnectedAt?: string | null;
}

export interface ActiveSessionRef {
  id: string;
  type: SessionType;
  status: SessionStatus;
  fen?: string;
  bet?: string | null;
  botLevel?: number | null;
  sides?: Array<{
    isWhite: boolean;
    timeLeft: number;
    isBot: boolean;
    player: { firstName: string; avatar?: string | null };
  }>;
}

export interface SessionSide {
  id: string;
  playerId: string;
  isWhite: boolean;
  isBot: boolean;
  status: string;
  eatenPieces: string[];
  winningAmount: string | null;
  timeLeft: number;
  player: UserPublic;
}

export interface GameSession {
  id: string;
  code: string;
  type: SessionType;
  status: SessionStatus;
  fen: string;
  pgn: string;
  bet: string | null;
  botLevel: number | null;
  currentSideId: string | null;
  winnerSideId: string | null;
  isSurrender: boolean;
  isPrivate: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  sides: SessionSide[];
  isMyTurn: boolean | null;
  mySideId: string | null;
  pieceCoins?: string | null; // монеты за взятые фигуры (только бот-игры, при завершении)
}

export interface BattleLobbyItem {
  id: string;
  code: string;
  bet: string;
  duration: number;
  createdAt: string;
  spectatorCount?: number;  // зрители батла
  creator: {
    firstName: string;
    avatar?: string | null;
    avatarGradient?: string | null;
    elo: number;
    league: League;
    isWhite: boolean;
  } | null;
}

// Leaderboard — backend возвращает плоский массив users с balance
export interface LeaderboardUser extends UserPublic {
  balance: string;
}

export interface Nation {
  id: string;
  flag: string;
  name: string;
  countryCode?: string;
  elo?: number;
  memberCount?: number;
  avgElo?: number;
  wins?: number;
  losses?: number;
  // Из backend Clan model
  myMembership?: { role: string } | null;
  _count?: { members: number };
}

export interface Transaction {
  id: string;
  type: string;
  amount: string;
  createdAt: string;
  payload?: Record<string, unknown> | null;
}

export type ItemType = 'AVATAR_FRAME' | 'BOARD_SKIN' | 'PIECE_SKIN' | 'MOVE_ANIMATION' | 'THEME';
export type ItemRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface ShopItem {
  id: string;
  name: string;
  description?: string | null;
  type: ItemType;
  category: string;
  rarity: ItemRarity;
  priceCoins: string;
  imageUrl?: string | null;
  previewUrl?: string | null;
  isActive: boolean;
  sortOrder: number;
  owned: boolean;
  equipped: boolean;
}

export interface Task {
  id: string;
  type: string;
  taskType?: string;
  title: string;
  description?: string;
  winningAmount?: string;
  reward?: string;
  isCompleted?: boolean;
  completed?: boolean;
  status?: string;
  metadata?: Record<string, unknown>;
  progress?: number;
  maxProgress?: number;
}

// Военное звание
export type MilitaryRankType =
  | 'RECRUIT' | 'PRIVATE' | 'CORPORAL' | 'SERGEANT' | 'WARRANT'
  | 'JR_LIEUTENANT' | 'LIEUTENANT' | 'SR_LIEUTENANT' | 'CAPTAIN'
  | 'MAJOR' | 'LT_COLONEL' | 'COLONEL' | 'BRIGADIER'
  | 'MAJ_GENERAL' | 'LT_GENERAL' | 'COL_GENERAL'
  | 'MARSHAL' | 'EMPEROR';

export interface MilitaryRankInfo {
  rank: MilitaryRankType;
  label: string;
  emoji: string;
  minMembers: number;
  activationBonus?: string;
  l1Percent?: number;
}

// Клановые войны
export interface ClanWar {
  id: string;
  attackerClanId: string;
  defenderClanId: string;
  attackerClan: { name: string; flag: string; countryCode: string; elo?: number; treasury?: string; };
  defenderClan: { name: string; flag: string; countryCode: string; elo?: number; treasury?: string; };
  status: 'IN_PROGRESS' | 'FINISHED';
  attackerWins: number;
  defenderWins: number;
  prize: string;
  duration: number;
  endAt?: string | null;
  isPending: boolean;
  isPublished: boolean;
  winnerClanId?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}

export interface ClanMemberData {
  id: string;
  userId: string;
  clanId: string;
  role: 'SOLDIER' | 'OFFICER' | 'COMMANDER';
  contribution: string;
  warWins: number;
  warLosses: number;
  isPending: boolean;
  pendingContribution?: string;
  joinedAt: string;
  user?: {
    id: string;
    firstName: string;
    username?: string | null;
    avatar?: string | null;
    avatarGradient?: string | null;
    elo: number;
    league: League;
    referralCount?: number;
  };
}

// Расширенный тип турнира
export interface TournamentFull {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  description?: string | null;
  entryFee: string;
  maxPlayers: number;
  currentPlayers: number;
  status: 'REGISTRATION' | 'IN_PROGRESS' | 'FINISHED';
  startAt?: string | null;
  endAt?: string | null;
  period?: string | null;
  prizePool: string;
  donationPool: string;
  totalPool: string;
  isJoined: boolean;
  myStats?: { wins: number; losses: number; draws: number; points: number } | null;
}

// Клановые батлы (командные соревнования)
export type ClanBattleStatus = 'PENDING' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';

export interface ClanBattle {
  id: string;
  challengerClanId: string;
  defenderClanId: string;
  challengerClan: { id: string; name: string; flag: string; elo?: number };
  defenderClan:   { id: string; name: string; flag: string; elo?: number };
  status: ClanBattleStatus;
  pool: string;
  maxSimultaneous: number;
  activeGames: number;
  challengerWins: number;
  defenderWins: number;
  totalGames: number;
  winnerClanId?: string | null;
  duration: number;
  startedAt?: string | null;
  endAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  myContribution?: { amount: string; clanId: string } | null;
  _count?: { contributions: number; games: number };
}

export interface ClanBattleContribution {
  id: string;
  battleId: string;
  userId: string;
  clanId: string;
  amount: string;
  paidOut: boolean;
  paidAmount: string;
}

// Реферальная программа
export interface ReferralInfo {
  total: number;
  active: number;         // сыграли хотя бы одну партию
  totalIncome: string;    // bigint строка — суммарно заработано
  refLink: string;
  referrals: ReferralUser[];
}

export interface ReferralUser {
  id: string;
  firstName: string;
  username?: string | null;
  elo: number;
  referralActivated: boolean;
  createdAt: string;
}
