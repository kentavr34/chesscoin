import { api, apiFetch } from './client';
import type {
  User, GameSession, BattleLobbyItem, LeaderboardUser,
  Nation, Transaction, Task, ShopItem, ClanWar, ClanMemberData, TournamentFull, ClanBattle,
} from '@/types';

// ── AUTH ──────────────────────────────────────────────
export const authApi = {
  // Login should NOT retry/reload on 401 — it would cause infinite reload loop
  login: (initData: string, referrer?: string) =>
    apiFetch<{ accessToken: string; refreshToken: string; user: User }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ initData, referrer }) },
      false // disable 401 retry
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
  getGames: (limit = 20, offset = 0) =>
    api.get<{ games: GameSession[] }>(
      `/profile/games?limit=${limit}&offset=${offset}`
    ),
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
  saveTheme: (theme: string) =>
    api.post<{ success: boolean; theme: string }>('/profile/theme', { theme }),
};

export const tonApi = {
  connectWallet: (walletAddress: string) =>
    api.post<{ success: boolean; walletAddress: string }>('/profile/ton-wallet', { walletAddress }),
  disconnectWallet: () =>
    api.delete<{ success: boolean }>('/profile/ton-wallet'),
  rate: () =>
    api.get<{ tonUsdt: number; coinsPerTon: number; coinsPerUsdt: number; feePercent: number }>('/profile/ton/rate'),
  buy: (amountTon: number) =>
    api.post<{ success: boolean; coinsReceived: number; fee: number }>('/profile/ton/buy', { amountTon }),
  sell: (amountCoins: string) =>
    api.post<{ success: boolean; tonAmount: number; fee: number }>('/profile/ton/sell', { amountCoins }),
  withdraw: (amountCoins: string) =>
    api.post<{ success: boolean; netTon: number }>('/profile/ton/withdraw', { amountCoins }),
  // Верификация платежа: walletAddress + boc из TonConnect
  verifyWallet: (walletAddress: string, boc: string) =>
    api.post<{ success: boolean; walletAddress: string }>('/profile/ton-wallet/verify', { walletAddress, boc }),
  history: (limit = 10) =>
    api.get<{ transactions: Array<Record<string,unknown>>; total: number }>(`/profile/transactions?limit=${limit}&type=TON`),
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
  getMy: () => api.get<{ clan: Record<string,unknown>; membership: Record<string,unknown> | null; activeWar: ClanWar | null }>('/nations/my'),
  getMembers: () => api.get<{ members: ClanMemberData[] }>('/nations/members'),
  getWars: () => api.get<{ wars: ClanWar[] }>('/nations/wars'),
  getChallenges: () => api.get<{ challenges: Record<string,unknown>[] }>('/nations/war-challenges'),
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
    api.post<{ success: boolean; war: Record<string,unknown> }>('/nations/war/challenge', { defenderClanId, duration }),
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
  // Этап 4: Шахматные задачи
  getPuzzle: (difficulty: 'easy' | 'medium' | 'hard' = 'medium') =>
    api.get<{ puzzle: PuzzleItem }>(`/tasks/puzzles?difficulty=${difficulty}`),
  getDailyPuzzle: () =>
    api.get<{ puzzle: PuzzleItem; alreadySolved: boolean }>('/tasks/puzzles/daily'),
  completePuzzle: (puzzleId: string, moves: string[]) =>
    api.post<{ success: boolean; correct: boolean; reward?: string; hint?: string }>(
      `/tasks/puzzles/${puzzleId}/complete`,
      { moves }
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
  unequip: (itemId: string) =>
    api.post<{ success: boolean }>('/shop/unequip', { itemId }),
  buyAttempts: (count = 1) =>
    api.post<{ attempts: number; balance: string }>('/attempts/purchase', { count }),
};

// ── TOURNAMENTS ───────────────────────────────────────
export const tournamentsApi = {
  list: () => api.get<{ tournaments: TournamentFull[] }>('/tournaments'),
  get: (id: string) => api.get<{ tournament: Record<string,unknown> }>(`/tournaments/${id}`),
  join: (id: string) => api.post<{ ok: boolean }>(`/tournaments/${id}/join`),
  leave: (id: string) => api.post<{ ok: boolean }>(`/tournaments/${id}/leave`),
  donate: (id: string, amount: string) =>
    api.post<{ ok: boolean }>(`/tournaments/${id}/donate`, { amount }),
  // T6: активные матчи пользователя
  myMatches: () => api.get<{ matches: ActiveMatch[] }>('/tournaments/my-matches'),
};

// ── WARS ──────────────────────────────────────────────
export const warsApi = {
  countries: (sort?: 'wins' | 'alpha') =>
    api.get<{ countries: Country[] }>(`/wars/countries${sort ? `?sort=${sort}` : ''}`),
  country: (id: string) =>
    api.get<{ country: Country; members: Record<string,unknown>[]; isCommander: boolean }>(`/wars/countries/${id}`),
  myCountry: () =>
    api.get<{ country: Country | null; membership: Record<string,unknown> | null; isCommander: boolean; activeWar: Record<string,unknown> | null }>('/wars/my-country'),
  join: (countryId: string) =>
    api.post<{ success: boolean; membership: Record<string,unknown> }>(`/wars/countries/${countryId}/join`),
  leave: () =>
    api.post<{ success: boolean }>('/wars/leave'),
  introSeen: () =>
    api.post<{ success: boolean }>('/wars/intro-seen'),
  active: () =>
    api.get<{ wars: Record<string,unknown>[] }>('/wars/active'),
  history: (limit = 20, offset = 0) =>
    api.get<{ wars: Record<string,unknown>[] }>(`/wars/history?limit=${limit}&offset=${offset}`),
  warDetail: (warId: string) =>
    api.get<{ war: Record<string,unknown> }>(`/wars/${warId}`),
  declare: (defenderCountryId: string, duration: number) =>
    api.post<{ success: boolean; war: Record<string,unknown> }>('/wars/declare', { defenderCountryId, duration }),
  challenge: (warId: string, opponentUserId: string) =>
    api.post<{ success: boolean; sessionId: string }>(`/wars/${warId}/challenge`, { opponentUserId }),
  saveGame: (sessionId: string) =>
    api.post<{ success: boolean }>(`/wars/games/${sessionId}/save`),
  unsaveGame: (sessionId: string) =>
    api.delete<{ success: boolean }>(`/wars/games/${sessionId}/save`),
  savedGames: () =>
    api.get<{ savedGames: Record<string,unknown>[] }>('/wars/my-saved-games'),
  donate: (countryId: string, amount: number) =>
    api.post<{ success: boolean; treasury: string }>(`/wars/countries/${countryId}/donate`, { amount }),
  members: (countryId: string) =>
    api.get<{ members: Record<string,unknown>[] }>(`/wars/countries/${countryId}/members`),
};

export const puzzlesApi = {
  daily: () =>
    api.get<{ puzzle: PuzzleItem }>('/puzzles/daily'),
  random: (difficulty: 'easy' | 'medium' | 'hard' = 'medium') =>
    api.get<{ puzzle: PuzzleItem }>(`/puzzles/random?difficulty=${difficulty}`),
  get: (id: string) =>
    api.get<{ puzzle: PuzzleItem }>(`/puzzles/${id}`),
  complete: (id: string, moves: string[], testMode = false) =>
    api.post<{ ok: boolean; correct: boolean; reward: string; alreadySolved?: boolean }>(`/puzzles/${id}/complete`, { moves, testMode }),
};

export interface PuzzleItem {
  id: string;
  fen: string;
  moves: string[];      // UCI ходы решения (первый — ход противника)
  rating: number;
  themes: string[];
  reward: string;       // bigint строка
  isDaily: boolean;
  completed: boolean;
  earnedReward?: string | null;
}

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


// ── EXCHANGE (P2P биржа v7.0.1) ───────────────────────────────
// E15: BUY-ордера возвращают дополнительные поля покупателя
export interface BuyP2POrder extends P2POrder {
  buyerId:     string;
  buyerName:   string;
  buyerElo:    number;
  buyerWallet: string;
}

export interface P2POrder {
  id:           string;
  sellerId:     string;
  sellerName:   string;
  sellerElo:    number;
  amountCoins:  string;   // BigInt как строка
  priceTon:     number;   // TON за 1 000 000 ᚙ
  totalTon:     number;
  sellerWallet: string;
  status:       'OPEN' | 'EXECUTED' | 'CANCELLED';
  createdAt:    string;
  isOwn:        boolean;
}

export interface PriceCandle {
  time:   string;
  open:   number;
  close:  number;
  high:   number;
  low:    number;
  volume: number;
}

export const exchangeApi = {
  // Стакан ордеров
  getOrders: (mine = false) =>
    api.get<{ orders: P2POrder[] }>(`/exchange/orders${mine ? '?mine=true' : ''}`),

  // История цены
  getPriceHistory: (hours: 24 | 168 | 720 = 24) =>
    api.get<{ currentPrice: number; change24h: number; candles: PriceCandle[]; volume24h: number }>(`/exchange/price-history?hours=${hours}`),

  // Создать ордер (продажа ᚙ)
  createOrder: (amountCoins: string, priceTon: number) =>
    api.post<{ order: P2POrder }>('/exchange/orders', { amountCoins, priceTon }),

  // Отменить свой ордер
  cancelOrder: (orderId: string) =>
    api.delete<{ success: boolean }>(`/exchange/orders/${orderId}`),

  // Статистика биржи
  getStats: () =>
    api.get<{ openOrdersCount: number; openOrdersCoins: string; volume24hTon: number; trades24h: number; lastPrice: number; allTimeTrades: number }>('/exchange/stats'),

  // P2: Лидерборд трейдеров
  getLeaderboard: (period: '24h' | '7d' | '30d' = '30d') =>
    api.get<{ period: string; leaderboard: Array<{ rank: number; userId: string; name: string; elo: number; trades: number; volumeTon: number; volumeCoins: string }> }>(`/exchange/leaderboard?period=${period}`),

  // BUY ордера (E15)
  getBuyOrders: () =>
    api.get<{ orders: P2POrder[] }>('/exchange/buy-orders'),
  createBuyOrder: (amountCoins: string, priceTon: number) =>
    api.post<{ order: P2POrder }>('/exchange/buy-orders', { amountCoins, priceTon }),
  cancelBuyOrder: (orderId: string) =>
    api.delete<{ success: boolean }>(`/exchange/buy-orders/${orderId}`),
  // Продавец принимает BUY-ордер: txHash+boc из TonConnect
  fillBuyOrder: (orderId: string, txHash: string, boc?: string) =>
    api.post<{ success: boolean; amountCoins: string; totalTon: number }>(
      `/exchange/buy-orders/${orderId}/fill`,
      { txHash, boc }
    ),

  // Исполнить ордер (покупка ᚙ) — после TON-транзакции на фронте
  // E12: partialCoins — купить только часть ордера
  executeOrder: (orderId: string, txHash: string, boc?: string, partialCoins?: string) =>
    api.post<{ success: boolean; amountCoins: string; totalTon: number; feeTon: number; isPartial: boolean }>(
      `/exchange/orders/${orderId}/execute`,
      { txHash, boc, ...(partialCoins ? { partialCoins } : {}) }
    ),
};
