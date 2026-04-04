import { create } from 'zustand';
import type { GameSession, BattleLobbyItem } from '@/types';

interface GameStore {
  // Активные сессии пользователя
  sessions: GameSession[];
  // Текущая открытая сессия (на доске)
  activeSession: GameSession | null;
  // Лобби батлов (WAITING_FOR_OPPONENT)
  battles: BattleLobbyItem[];
  // Живые публичные батлы (IN_PROGRESS) — видны всем как наблюдатели
  liveBattles: GameSession[];
  // Оффер ничьи
  drawOfferedBy: string | null;

  setSessions: (sessions: GameSession[]) => void;
  upsertSession: (session: GameSession) => void;
  removeSession: (sessionId: string) => void;
  setActiveSession: (session: GameSession | null) => void;
  setBattles: (battles: BattleLobbyItem[]) => void;
  setLiveBattles: (battles: GameSession[]) => void;
  addLiveBattle: (battle: GameSession) => void;
  removeLiveBattle: (sessionId: string) => void;
  setDrawOffered: (by: string | null) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  sessions: [],
  activeSession: null,
  battles: [],
  liveBattles: [],
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

  setLiveBattles: (battles) => set({ liveBattles: battles }),

  addLiveBattle: (battle) =>
    set((state) => ({
      liveBattles: state.liveBattles.some((b) => b.id === battle.id)
        ? state.liveBattles
        : [battle, ...state.liveBattles],
    })),

  removeLiveBattle: (sessionId) =>
    set((state) => ({
      liveBattles: state.liveBattles.filter((b) => b.id !== sessionId),
    })),

  setDrawOffered: (drawOfferedBy) => set({ drawOfferedBy }),
}));
