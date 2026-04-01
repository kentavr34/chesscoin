import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Lang } from '@/i18n/translations';

export type Theme = 'dark' | 'light';

interface SettingsStore {
  lang: Lang;
  soundEnabled: boolean;
  theme: Theme;
  setLang: (lang: Lang) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setTheme: (theme: Theme) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      lang: 'ru',
      soundEnabled: true,
      theme: 'dark',
      setLang: (lang) => set({ lang }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'chesscoin-settings' }
  )
);
