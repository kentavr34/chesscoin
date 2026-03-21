import { useSettingsStore } from '@/store/useSettingsStore';
import { translations } from './translations';

export const useT = () => {
  const lang = useSettingsStore((s) => s.lang);
  return translations[lang];
};
