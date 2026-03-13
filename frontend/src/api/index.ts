import { api } from './client';
import type {
  User, GameSession, BattleLobbyItem, LeaderboardUser,
  Nation, Transaction, Task,
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
  list: () =>
    api.get<{ clans: Nation[] }>('/nations/clans'),
  getWars: () =>
    api.get<{ wars: any[] }>('/nations/wars'),
  join: (clanId: string) =>
    api.post<{ success: boolean }>('/nations/join', { clanId }),
  leave: () =>
    api.post<{ success: boolean }>('/nations/leave'),
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
  list: () =>
    api.get<{ tournaments: TournamentItem[] }>('/tournaments'),
  get: (id: string) =>
    api.get<{ tournament: any }>(`/tournaments/${id}`),
  join: (id: string) =>
    api.post<{ ok: boolean }>(`/tournaments/${id}/join`),
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

export interface ShopItem {
  id: string;
  name: string;
  type: string;
  category: string;
  priceCoins: string;
  isActive: boolean;
  sortOrder: number;
  owned: boolean;
  equipped: boolean;
  meta?: Record<string, unknown>;
}
