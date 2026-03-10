import { create } from 'zustand';
import type { User } from '@/types';

interface UserStore {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  updateBalance: (balance: string) => void;
  setLoading: (v: boolean) => void;
  logout: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: true, isLoading: false }),

  updateBalance: (balance) =>
    set((state) => ({
      user: state.user ? { ...state.user, balance } : null,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  logout: () =>
    set({ user: null, isAuthenticated: false, isLoading: false }),
}));
