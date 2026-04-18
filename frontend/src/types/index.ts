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
  equippedItems?: Record<string, { id: string; name: string; imageUrl?: string | null }>;
  isMonthlyChampion?: boolean;
  country?: string | null;
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
  hasSeenWarsIntro?: boolean;
  activeTheme?: string;
  equippedItems?: {
    AVATAR_FRAME?:    { id: string; name: string; imageUrl?: string | null };
    BOARD_SKIN?:      { id: string; name: string; imageUrl?: string | null };
    PIECE_SKIN?:      { id: string; name: string; imageUrl?: string | null };
    MOVE_ANIMATION?:  { id: string; name: string; imageUrl?: string | null };
    THEME?:           { id: string; name: string; imageUrl?: string | null };
    PREMIUM_AVATAR?:  { id: string; name: string; imageUrl?: string | null }; // R1
    PIECE_SET?:       { id: string; name: string; imageUrl?: string | null };
    WIN_ANIMATION?:   { id: string; name: string; imageUrl?: string | null }; // V3
    CAPTURE_EFFECT?:  { id: string; name: string; imageUrl?: string | null }; // V3
    SPECIAL_MOVE?:    { id: string; name: string; imageUrl?: string | null }; // V3
    FONT?:            { id: string; name: string; imageUrl?: string | null }; // D10
  };
  nextRestoreSeconds?: number; // R1: for attempts timer
  jarvisLevel?: number;        // R1: Jarvis level progress
  rank?: number;               // TAIL-4: военный ранг (число)
  isMonthlyChampion?: boolean; // R1
  monthlyChampionAt?: string | null; // R1
  tournamentBadges?: Array<{ id: string; name: string; type: string; date?: string }>; // R1
  jarvisBadges?: string[];     // R1
  jarvisBadgeDates?: Record<string, string> | null; // R1
  achievements?: Array<{ id: string; date: string }>; // R1
  countryMember?: {            // R1
    country?: { id: string; flag: string; nameRu: string; nameEn: string };
    role?: string;
    isCommander?: boolean;
  } | null;
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
  isMe?: boolean;
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
  pieceCoins?: string | null;
  // S3: скины создателя батла
  boardSkinUrl?: string | null;
  pieceSkinUrl?: string | null; // монеты за взятые фигуры (только бот-игры, при завершении)
  spectatorCount?: number;      // зрители батла (live)
}

export interface BattleLobbyItem {
  id: string;
  code: string;
  bet: string;
  duration: number;
  createdAt: string;
  spectatorCount?: number;  // зрители батла
  creator: {
    id: string;
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

export type ItemType = 'AVATAR_FRAME' | 'BOARD_SKIN' | 'PIECE_SKIN' | 'PIECE_SET' | 'MOVE_ANIMATION' | 'THEME' | 'PREMIUM_AVATAR' | 'WIN_ANIMATION' | 'CAPTURE_EFFECT' | 'SPECIAL_MOVE' | 'FONT';
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
  name?: string;
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


// Этап 4: Шахматная задача
export interface PuzzleItem {
  id: string;
  fen: string;
  moves: string[];   // правильные ходы в UCI-нотации (e2e4)
  rating: number;
  themes: string[];
  reward: string;    // bigint строка
  isDaily: boolean;
  dailyDate?: string;
}

// R1: типы для ответов REST/socket, совместимые с backend — из ./api (без дублирования SessionSide/GameSession из этого файла)
export type { ActiveMatch, Country, WarBattle, SocketGameEvent } from "./api";
