import { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { translations } from './translations';
import type { Lang, Translations } from './translations';
import { useI18nStore } from './useI18nStore';

/**
 * Тексты интерфейса.
 *
 * Источников два, и порядок важен:
 *   1. таблица `ui_texts` в базе — то, что можно править без выкладки кода
 *      и куда добавляются новые языки (Кенан 31.07.2026);
 *   2. встроенный словарь `translations.ts` — запасной, чтобы интерфейс
 *      работал, даже если база недоступна.
 *
 * Обращение прежнее — `t.home.balance`, поэтому переписывать компоненты не
 * нужно: под капотом сначала смотрим в загруженный словарь по ключу
 * `home.balance`, и только потом во встроенный.
 */
function withOverrides<T extends object>(base: T, dict: Record<string, string>, path = ''): T {
  return new Proxy(base, {
    get(target, prop) {
      if (typeof prop !== 'string') return Reflect.get(target, prop);
      const key = path ? `${path}.${prop}` : prop;
      const value = Reflect.get(target, prop);

      if (typeof value === 'string') return dict[key] ?? value;
      // Функции-шаблоны оставляем как есть: подстановка у них внутри кода.
      if (typeof value === 'function') return value;
      if (value && typeof value === 'object') return withOverrides(value as object, dict, key);

      // Ключа нет во встроенном словаре, но он может быть в базе —
      // так новые строки появляются без правки translations.ts.
      return dict[key] ?? value;
    },
  }) as T;
}

export const useT = () => {
  const lang = useSettingsStore((s) => s.lang) as Lang;
  const dict = useI18nStore((s) => s.dict);
  const load = useI18nStore((s) => s.load);

  useEffect(() => { void load(lang); }, [lang, load]);

  // Встроенных словарей два — ru и en; az и tr живут только в базе, поэтому
  // для них здесь берётся русский как запасной. Приведение нужно, чтобы
  // TypeScript продолжал проверять ключи: без него `translations[lang]`
  // выводился как any, и опечатка в `t.…` молча давала пустое место на экране.
  const dicts = translations as unknown as Record<Lang, Translations>;
  const base = dicts[lang] ?? dicts.ru;
  return withOverrides(base, dict);
};

/**
 * Строка из таблицы текстов по прямому ключу.
 *
 * Нужна там, где ключ собирается на лету — например `lessons.item.3.title`
 * для урока номер 3. Через `t.lessons.item[3].title` это не достать: во
 * встроенном словаре такой ветки нет, и цепочка обрывается на первом же
 * несуществующем звене (поймано на живом уроке 01.08.2026).
 */
export const useText = (key: string, fallback = ''): string => {
  const dict = useI18nStore((s) => s.dict);
  return dict[key] ?? fallback;
};
