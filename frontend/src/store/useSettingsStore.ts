import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Lang } from '@/i18n/translations';

interface SettingsStore {
  lang: Lang;
  soundEnabled: boolean;
  setLang: (lang: Lang) => void;
  setSoundEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      lang: 'ru',
      soundEnabled: true,
      setLang: (lang) => set({ lang }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
    }),
    { name: 'chesscoin-settings' }
  )
);
