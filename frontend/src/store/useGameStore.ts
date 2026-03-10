import { create } from 'zustand';
import type { GameSession, BattleLobbyItem } from '@/types';

interface GameStore {
  // Активные сессии пользователя
  sessions: GameSession[];
  // Текущая открытая сессия (на доске)
  activeSession: GameSession | null;
  // Лобби батлов
  battles: BattleLobbyItem[];
  // Оффер ничьи
  drawOfferedBy: string | null;

  setSessions: (sessions: GameSession[]) => void;
  upsertSession: (session: GameSession) => void;
  removeSession: (sessionId: string) => void;
  setActiveSession: (session: GameSession | null) => void;
  setBattles: (battles: BattleLobbyItem[]) => void;
  setDrawOffered: (by: string | null) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  sessions: [],
  activeSession: null,
  battles: [],
  drawOfferedBy: null,

  setSessions: (sessions) => set({ sessions }),

  upsertSession: (session) => {
    const existing = get().sessions.find((s) => s.id === session.id);
    if (existing) {
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === session.id ? session : s)),
        activeSession:
          state.activeSession?.id === session.id ? session : state.activeSession,
      }));
    } else {
      set((state) => ({ sessions: [...state.sessions, session] }));
    }
  },

  removeSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      activeSession:
        state.activeSession?.id === sessionId ? null : state.activeSession,
    })),

  setActiveSession: (session) => set({ activeSession: session }),

  setBattles: (battles) => set({ battles }),

  setDrawOffered: (drawOfferedBy) => set({ drawOfferedBy }),
}));
