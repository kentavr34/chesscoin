declare global { interface Window { __pendingGameCode?: string; __pendingSessionId?: string; } }

/**
 * Перенести разобранные из ссылки намерения в window, чтобы их подхватил
 * useSocket и открыл нужный экран.
 *
 * Раньше это делалось только внутри ветки «логинимся впервые»: у всех, кто уже
 * открывал приложение, токен есть, функция выходила раньше — и ссылка на
 * партию не срабатывала вообще (Кенан 01.08.2026: «попадает на главную
 * страницу игры, а не сразу на ту игровую доску»).
 */
const applyPendingDeepLink = () => {
  const move = (key: string, prop: string) => {
    const v = sessionStorage.getItem(key);
    if (!v) return;
    sessionStorage.removeItem(key);
    (window as unknown as Record<string, unknown>)[prop] = v;
  };
  move('pendingGameCode', '__pendingGameCode');
  move('pendingSessionId', '__pendingSessionId');
  move('pendingWatchCode', '__pendingWatchCode');
  move('pendingShareToken', '__pendingShareToken');
};

/**
 * Разобрать параметр ссылки Telegram. Вызывается ДО любых ветвлений по токену:
 * намерение игрока не зависит от того, авторизован он уже или нет.
 * Возвращает реферала, если он был в ссылке.
 */
const parseStartParam = (startParam: string): string | undefined => {
  if (!startParam) return undefined;
  if (startParam.startsWith('ref_')) return startParam.slice(4);
  if (startParam.startsWith('game_')) {
    sessionStorage.setItem('pendingGameCode', startParam.slice(5));
    return undefined;
  }
  if (startParam.startsWith('match_')) {
    sessionStorage.setItem('pendingSessionId', startParam.slice(6));
    return undefined;
  }
  if (startParam.startsWith('refmatch_')) {
    // Режем по ПОСЛЕДНЕМУ подчёркиванию: в идентификаторе партии их не
    // бывает, а вот в коде пригласившего — запросто. По первому рвалось
    // ровно посередине, и на доску уходил обрубок (поймано проверкой
    // двумя аккаунтами 01.08.2026).
    const rest = startParam.slice(9);
    const sep = rest.lastIndexOf('_');
    if (sep > 0) {
      sessionStorage.setItem('pendingSessionId', rest.slice(sep + 1));
      return rest.slice(0, sep);
    }
    return undefined;
  }
  if (startParam.startsWith('watch_')) {
    sessionStorage.setItem('pendingWatchCode', startParam.slice(6));
    return undefined;
  }
  if (startParam.startsWith('share_')) {
    sessionStorage.setItem('pendingShareToken', startParam.slice(6));
  }
  return undefined;
};


import { useEffect } from 'react';
import { authApi } from '@/api';
import { setTokens, clearTokens, getAccessToken } from '@/api/client';
import { useUserStore } from '@/store/useUserStore';
import { setActiveTheme } from '@/lib/theme';
import type { ThemeKey } from '@/lib/theme';

export const useAuth = () => {
  const { setUser, setLoading, logout } = useUserStore();

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);

    // Telegram WebApp — получаем initData сразу, чтобы проверить смену аккаунта
    const tg = window.Telegram?.WebApp;

    // ── Фикс мобильного «жёлтого экрана» ─────────────────────────────────────
    // На телефоне Telegram отдаёт initData с задержкой 100–300мс после монтирования.
    // Без tg.ready() некоторые клиенты вообще не инжектят initData.
    // Поэтому: (1) сразу дёргаем ready/expand, (2) ждём до 2сек появления initData.
    if (tg) {
      try { tg.ready(); } catch {}
      try { tg.expand(); } catch {}
      if (!tg.initData) {
        for (let i = 0; i < 20 && !tg.initData; i++) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Фикс 0.1: Кэш профиля при смене аккаунта ────────────────────────────
    // Получаем telegramId из нового initData и сравниваем с сохранённым.
    // Если не совпадает — полностью сбрасываем хранилище и переавторизуемся.
    if (tg?.initDataUnsafe?.user?.id) {
      const newTelegramId = String(tg.initDataUnsafe.user.id);
      const savedTelegramId = localStorage.getItem('chesscoin_telegram_id');

      if (savedTelegramId && savedTelegramId !== newTelegramId) {
        console.warn('[Auth] Account changed! Clearing storage and re-auth.');
        // Полная очистка — старые токены невалидны для нового аккаунта
        localStorage.clear();
        sessionStorage.clear();
        clearTokens();
      }

      // Запоминаем текущий аккаунт
      localStorage.setItem('chesscoin_telegram_id', newTelegramId);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Намерение из ссылки разбираем ДО всего остального: оно не зависит от
    // того, авторизован игрок или нет.
    const linkReferrer = parseStartParam(tg?.initDataUnsafe?.start_param ?? '');

    // Уже есть токен — пробуем получить профиль
    if (getAccessToken()) {
      try {
        const user = await authApi.me();
        setUser(user);
        if (user.activeTheme) setActiveTheme(user.activeTheme as ThemeKey);
        applyPendingDeepLink();
        return;
      } catch {
        clearTokens();
      }
    }

    // Telegram WebApp
    if (!tg || !tg.initData) {
      // Dev режим без Telegram — используем mock user
      if (import.meta.env.DEV) {
        console.warn('[Auth] No Telegram WebApp, using dev mock user');
        const mockUser: import('@/types').User = {
          id: 'dev_user_1',
          firstName: 'Test',
          lastName: 'Player',
          telegramId: '123456',
          balance: '10000',
          totalEarned: '10000',
          totalSpent: '0',
          attempts: 3,
          maxAttempts: 3,
          attemptSlots: [],
          isBanned: false,
          activeSessions: [],
          createdAt: new Date().toISOString(),
          elo: 1500,
          league: 'BRONZE',
          wins: 5,
          losses: 2,
          jarvisLevel: 3,
          activeTheme: 'dark',
          equippedItems: {},
        } as any;
        setUser(mockUser);
        return;
      } else {
        setLoading(false);
        logout();
      }
      return;
    }

    await loginWithInitData(tg.initData, linkReferrer);
  };

  const loginWithInitData = async (initData: string, referrer?: string) => {
    try {
      console.log('[Auth] Sending initData, length:', initData.length, 'first 100:', initData.substring(0, 100));
      const result = await authApi.login(initData, referrer);
      setTokens(result.accessToken, result.refreshToken);
      setUser(result.user);
      if (result.user.activeTheme) setActiveTheme(result.user.activeTheme as ThemeKey);

      // Намерение из ссылки — одним местом на оба пути входа.
      applyPendingDeepLink();
    } catch (err) {
      console.error('[Auth] Login failed:', err);
      setLoading(false);
      logout();
    }
  };
};
