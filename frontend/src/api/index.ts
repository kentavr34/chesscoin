import { api } from './client';
import type {
  User, GameSession, BattleLobbyItem, LeaderboardUser,
  Nation, Transaction, Task, ShopItem, ClanWar, ClanMemberData, TournamentFull, ClanBattle,
} from '@/types';

// ── AUTH ──────────────────────────────────────────────
export const authApi = {
  login: (initData: string, referrer?: string) =>
    api.post<{ accessToken: string; refreshToken: string; user: User }>(
      '/auth/login',
      { initData, referrer }
    ),
  refresh: (refreshToken: string) =>
    api.post<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh',
      { refreshToken }
    ),
  me: () => api.get<User>('/auth/me'),
};

// ── PROFILE ───────────────────────────────────────────
export const profileApi = {
  getUser: (userId: string) =>
    api.get<User>(`/profile/${userId}`),
  getTransactions: (limit = 20, offset = 0) =>
    api.get<{ total: number; transactions: Transaction[] }>(
      `/profile/transactions?limit=${limit}&offset=${offset}`
    ),
  getReferrals: () =>
    api.get<{
      total: number;
      active: number;
      totalIncome: string;
      refLink: string;
      referrals: UserPublicMin[];
    }>('/profile/referrals'),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return api.postForm<{ success: boolean; avatar: string }>('/profile/avatar', form);
  },
  deleteAvatar: () =>
    api.delete<{ success: boolean }>('/profile/avatar'),
};

interface UserPublicMin {
  id: string;
  firstName: string;
  username?: string | null;
  elo: number;
  referralActivated: boolean;
  createdAt: string;
}

// ── LEADERBOARD ───────────────────────────────────────
export const leaderboardApi = {
  get: (params?: { league?: string; limit?: number; offset?: number; search?: string; sort?: string }) => {
    const qs = new URLSearchParams();
    if (params?.league)  qs.set('league',  params.league);
    if (params?.limit)   qs.set('limit',   String(params.limit));
    if (params?.offset)  qs.set('offset',  String(params.offset));
    if (params?.search)  qs.set('search',  params.search);
    if (params?.sort)    qs.set('sort',    params.sort);
    const q = qs.toString();
    return api.get<{ total: number; myRank: number; users: LeaderboardUser[] }>(
      `/leaderboard${q ? '?' + q : ''}`
    );
  },
};

// ── NATIONS ───────────────────────────────────────────
export const nationsApi = {
  list: () => api.get<{ clans: Nation[] }>('/nations/clans'),
  getMy: () => api.get<{ clan: any; membership: any; activeWar: ClanWar | null }>('/nations/my'),
  getMembers: () => api.get<{ members: ClanMemberData[] }>('/nations/members'),
  getWars: () => api.get<{ wars: ClanWar[] }>('/nations/wars'),
  getChallenges: () => api.get<{ challenges: any[] }>('/nations/war-challenges'),
  join: (clanId: string, contribution?: number) =>
    api.post<{ success: boolean; pending: boolean }>('/nations/join', { clanId, contribution }),
  leave: () => api.post<{ success: boolean }>('/nations/leave'),
  contribute: (amount: string) =>
    api.post<{ success: boolean }>('/nations/contribute', { amount }),
  approveMember: (memberId: string, approve: boolean) =>
    api.post<{ success: boolean }>(`/nations/members/${memberId}/approve`, { approve }),
  kickMember: (targetUserId: string) =>
    api.post<{ success: boolean }>(`/nations/members/${targetUserId}/kick`),
  challengeWar: (defenderClanId: string, duration: number) =>
    api.post<{ success: boolean; war: any }>('/nations/war/challenge', { defenderClanId, duration }),
  acceptWar: (warId: string) =>
    api.post<{ success: boolean }>(`/nations/war/${warId}/accept`),
};

// ── CLAN BATTLES ──────────────────────────────────────
export const clanBattlesApi = {
  list: () =>
    api.get<{ battles: ClanBattle[] }>('/nations/battles'),
  get: (id: string) =>
    api.get<{ battle: ClanBattle }>(`/nations/battle/${id}`),
  challenge: (defenderClanId: string, duration: number, bet: string) =>
    api.post<{ success: boolean; battle: ClanBattle }>('/nations/battle/challenge', {
      defenderClanId, duration, bet,
    }),
  join: (id: string, bet: string) =>
    api.post<{ success: boolean; pool: string }>(`/nations/battle/${id}/join`, { bet }),
  startGame: (id: string, opponentId: string) =>
    api.post<{ success: boolean; battleId: string }>(`/nations/battle/${id}/start-game`, { opponentId }),
  settle: (id: string) =>
    api.post<{ success: boolean }>(`/nations/battle/${id}/settle`, {}),
};

// ── TASKS ─────────────────────────────────────────────
export const tasksApi = {
  list: () =>
    api.get<{ tasks: Task[] }>('/tasks'),
  complete: (taskId: string, code?: string) =>
    api.post<{ success: boolean; reward: string; message: string }>(
      '/tasks/complete',
      { taskId, ...(code ? { code } : {}) }
    ),
};

// ── SHOP ──────────────────────────────────────────────
export const shopApi = {
  getItems: (type?: string) =>
    api.get<{ items: ShopItem[] }>(`/shop/items${type ? '?type=' + type : ''}`),
  purchase: (itemId: string) =>
    api.post<{ success: boolean; message: string }>('/shop/purchase', { itemId }),
  equip: (itemId: string) =>
    api.post<{ success: boolean; message: string }>('/shop/equip', { itemId }),
  buyAttempts: (count = 1) =>
    api.post<{ attempts: number; balance: string }>('/attempts/purchase', { count }),
};

// ── TOURNAMENTS ───────────────────────────────────────
export const tournamentsApi = {
  list: () => api.get<{ tournaments: TournamentFull[] }>('/tournaments'),
  get: (id: string) => api.get<{ tournament: any }>(`/tournaments/${id}`),
  join: (id: string) => api.post<{ ok: boolean }>(`/tournaments/${id}/join`),
  leave: (id: string) => api.post<{ ok: boolean }>(`/tournaments/${id}/leave`),
  donate: (id: string, amount: string) =>
    api.post<{ ok: boolean }>(`/tournaments/${id}/donate`, { amount }),
};

export interface TournamentItem {
  id: string;
  name: string;
  description?: string | null;
  entryFee: string;
  maxPlayers: number;
  currentPlayers: number;
  status: 'REGISTRATION' | 'IN_PROGRESS' | 'FINISHED';
  startAt?: string | null;
  prizePool: string;
  isJoined: boolean;
}

