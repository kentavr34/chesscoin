/**
 * types/api.ts — R1: Типы для API ответов фронтенда
 */

// V3 - добавляем SPECIAL_MOVE в GameSession equippedItems если нужно

export interface PublicUser {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  avatar?: string | null;
  avatarType?: string;
  avatarGradient?: string;
  elo: number;
  telegramId?: string;
}

export interface SessionSide {
  id: string;
  playerId: string;
  isWhite: boolean;
  isBot: boolean;
  isMe: boolean;
  status: string;
  winningAmount: string | null;
  bet?: string | null;
  player: PublicUser;
}

export interface GameSession {
  id: string;
  status: string;
  type: string;
  fen: string;
  pgn: string;
  code?: string;
  isPrivate?: boolean;
  bet?: string | null;
  donationPool?: string;
  botLevel?: number;
  currentSideId?: string | null;
  winnerSideId?: string | null;
  finishedAt?: string | null;
  createdAt?: string;
  sides: SessionSide[];
  timeSeconds?: number;
}

export interface TournamentFull {
  id: string;
  name: string;
  type: string;
  status: string;
  entryFee: string;
  prizePool: string;
  donationPool: string;
  maxPlayers: number;
  startAt: string;
  endAt: string;
  isJoined: boolean;
  playerCount: number;
  period?: string;
  description?: string;
}

export interface ActiveMatch {
  id: string;
  round: number;
  status: string;
  sessionId?: string | null;
  myUserId?: string;
  tournament?: { name: string; type: string };
  player1?: { userId: string; user?: PublicUser };
  player2?: { userId: string; user?: PublicUser };
}

export interface Country {
  id: string;
  nameRu: string;
  nameEn: string;
  flag: string;
  code: string;
  wins?: number;
  losses?: number;
  memberCount?: number;
}

export interface WarBattle {
  id: string;
  warId: string;
  sessionId?: string | null;
  status: string;
  attackerId: string;
  defenderId: string;
  winnerId?: string | null;
  spectatorCount?: number;
  session?: GameSession | null;
}

export interface Transaction {
  id: string;
  type: string;
  amount: string;
  createdAt: string;
  description?: string | null;
}

// Socket event types
export interface SocketGameEvent {
  type: string;
  sessionId?: string;
  sessionCode?: string;
  matchId?: string;
  tournamentName?: string;
  tournamentType?: string;
  round?: number;
  opponentName?: string;
  prize?: string;
  place?: number;
}
