import { create } from 'zustand';
import type { Lang } from './translations';

/**
 * Словарь текстов из таблицы `ui_texts`.
 *
 * Кенан 31.07.2026: все видимые строки живут в базе с указанием, где они
 * показываются; новый язык добавляется колонкой, без правок кода. Фронт
 * забирает словарь на старте и накладывает его поверх встроенного.
 *
 * Если база недоступна — молчим и работаем на встроенном словаре: интерфейс
 * никогда не должен остаться без текста.
 */
interface I18nState {
  lang: Lang | null;
  dict: Record<string, string>;
  loading: boolean;
  load: (lang: Lang) => Promise<void>;
}

const API = import.meta.env.VITE_API_URL ?? '/api/v1';

export const useI18nStore = create<I18nState>((set, get) => ({
  lang: null,
  dict: {},
  loading: false,

  load: async (lang: Lang) => {
    if (get().lang === lang || get().loading) return;
    set({ loading: true });
    try {
      const r = await fetch(`${API}/i18n/${lang}`);
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json() as { dict?: Record<string, string> };
      set({ lang, dict: data.dict ?? {}, loading: false });
    } catch {
      // Тишина намеренная: словарь необязателен, встроенный уже работает.
      set({ lang, dict: {}, loading: false });
    }
  },
}));
