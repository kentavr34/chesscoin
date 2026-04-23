import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '@/api/client';
import type { GameSession, BattleLobbyItem } from '@/types';

// ── Typed events ──
interface ServerToClient {
  'game': (session: GameSession) => void;
  'game:current': (sessions: GameSession[]) => void;
  'game:started': (data: { sessionId: string }) => void;
  'game:over': (data: { status: string; surrender?: boolean }) => void;
  'game:draw_offered': (data: { by: string }) => void;
  'game:draw_declined': (data: { by: string }) => void;
  'battles:list': (battles: BattleLobbyItem[]) => void;
  'battles:added': (battle: BattleLobbyItem) => void;
  'battles:removed': (sessionId: string) => void;
  'battles:live:list': (battles: GameSession[]) => void;
  'battles:live:added': (battle: GameSession) => void;
  'battles:live:removed': (sessionId: string) => void;
  'battle:donated': (data: { donorId: string; amount: string; totalPool: string }) => void;
  'pong': () => void;
}

interface ClientToServer {
  'game:current': (cb: SocketCallback<{ sessions: GameSession[] }>) => void;
  'game:create:bot': (data: { color: 'white' | 'black'; botLevel: number; timeSeconds?: number }, cb: SocketCallback<{ session: GameSession }>) => void;
  'game:create:battle': (data: { color: 'white' | 'black'; duration: number; bet: string; isPrivate?: boolean }, cb: SocketCallback<{ session: GameSession }>) => void;
  'game:join': (data: { code: string }, cb: SocketCallback<{ session: GameSession }>) => void;
  'game:move': (data: { sessionId: string; from: string; to: string; promotion?: string }, cb: SocketCallback<{ session: GameSession }>) => void;
  'game:surrender': (data: { sessionId: string }, cb: SocketCallback<Record<string, never>>) => void;
  'game:cancel': (data: { sessionId: string }, cb: SocketCallback<Record<string, never>>) => void;
  'game:offer_draw': (data: { sessionId: string }) => void;
  'game:accept_draw': (data: { sessionId: string }, cb: SocketCallback<Record<string, never>>) => void;
  'game:decline_draw': (data: { sessionId: string }) => void;
  'spectate': (data: { sessionId: string }) => void;
  'unspectate': (data: { sessionId: string }) => void;
  'battles:subscribe': () => void;
  'battles:unsubscribe': () => void;
  'battle:donate': (data: { sessionId: string; amount: string }, cb?: SocketCallback<{ donationPool: string }>) => void;
  'ping': () => void;
}

type SocketCallback<T> = (res: { ok: boolean; error?: string } & Partial<T>) => void;

let socket: Socket<ServerToClient, ClientToServer> | null = null;

export const getSocket = (): Socket<ServerToClient, ClientToServer> => {
  if (!socket) {
    socket = io('/', {
      auth: { token: getAccessToken() },
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => console.log('[Socket] connected', socket?.id));
    socket.on('disconnect', (reason) => console.warn('[Socket] disconnected', reason));
    socket.on('connect_error', (err) => console.error('[Socket] error', err.message));
  }
  return socket;
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
};

// Обновляем токен после рефреша
export const updateSocketAuth = (token: string) => {
  if (socket) {
    socket.auth = { token };
    socket.disconnect().connect();
  }
};
