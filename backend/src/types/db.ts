/**
 * types/db.ts — R1: Строгие TypeScript типы для Prisma результатов
 *
 * Использование:
 *   import type { SessionWithSides, TournamentWithPlayers } from "@/types/db";
 */

import type {
  Session, SessionSide, User, Transaction, Tournament, TournamentPlayer,
  TournamentMatch, Country, CountryMember, CountryWar, WarBattle,
  Item, UserItem, Clan, ClanMember, SavedGame, Task, CompletedTask,
  Prisma,
} from "@prisma/client";

// ── Сессии ───────────────────────────────────────────────────────────────────

export type SessionSideWithPlayer = SessionSide & {
  player: Pick<User, "id" | "firstName" | "lastName" | "username" | "avatar" | "avatarType" | "avatarGradient" | "elo">;
};

export type SessionWithSides = Session & {
  sides: SessionSideWithPlayer[];
};

export type SessionWithSidesAndBattle = SessionWithSides & {
  warBattle?: WarBattle | null;
};

// ── Турниры ──────────────────────────────────────────────────────────────────

export type TournamentPlayerWithUser = TournamentPlayer & {
  user: Pick<User, "id" | "firstName" | "lastName" | "username" | "avatar" | "avatarType" | "avatarGradient" | "elo" | "telegramId">;
};

export type TournamentWithPlayers = Tournament & {
  players: TournamentPlayerWithUser[];
  _count?: { players: number };
};

export type TournamentMatchWithPlayers = TournamentMatch & {
  player1: TournamentPlayerWithUser;
  player2: TournamentPlayerWithUser | null;
  tournament: Pick<Tournament, "id" | "name" | "type">;
};

// ── Войны и страны ───────────────────────────────────────────────────────────

export type CountryWarWithCountries = CountryWar & {
  attackerCountry: Pick<Country, "id" | "nameRu" | "nameEn" | "flag" | "code">;
  defenderCountry: Pick<Country, "id" | "nameRu" | "nameEn" | "flag" | "code">;
};

export type WarBattleWithSession = WarBattle & {
  session: SessionWithSides | null;
};

export type CountryMemberWithUser = CountryMember & {
  user: Pick<User, "id" | "firstName" | "lastName" | "username" | "avatar" | "avatarType" | "avatarGradient" | "elo">;
};

// ── Магазин ──────────────────────────────────────────────────────────────────

export type UserItemWithItem = UserItem & {
  item: Item;
};

// ── Пользователи ─────────────────────────────────────────────────────────────

export type PublicUser = Pick<
  User,
  "id" | "firstName" | "lastName" | "username" | "avatar" | "avatarType" | "avatarGradient" | "elo"
>;

export type UserWithBalance = Pick<
  User,
  "id" | "telegramId" | "firstName" | "balance" | "elo" | "isBanned" | "isAdmin"
>;

// ── Socket events ─────────────────────────────────────────────────────────────

export interface GameMoveEvent {
  sessionId: string;
  from: string;
  to: string;
  promotion?: string;
}

export interface GameCreateBotEvent {
  color: "white" | "black";
  botLevel: number;
  timeSeconds?: number;
}

export interface GameJoinEvent {
  code: string;
}

// ── Admin ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  users: number;
  sessions: number;
  activeSessions: number;
  battlesToday: number;
  currentPhase: number;
  platformReserve: string;
  totalEmitted: string;
}
