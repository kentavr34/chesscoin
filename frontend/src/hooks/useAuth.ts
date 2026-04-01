declare global { interface Window { __pendingGameCode?: string; } }

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

    // Уже есть токен — пробуем получить профиль
    if (getAccessToken()) {
      try {
        const user = await authApi.me();
        setUser(user);
        if (user.activeTheme) setActiveTheme(user.activeTheme as ThemeKey);
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
        const mockUser: typeof import('@/types').User = {
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

    tg.ready();
    tg.expand();

    // Получаем referrer и game deep link из startParam
    const startParam = tg.initDataUnsafe?.start_param ?? '';
    const referrer = startParam.startsWith('ref_') ? startParam.slice(4) : undefined;
    const gameCode = startParam.startsWith('game_') ? startParam.slice(5) : undefined;

    // Сохраняем gameCode для редиректа после логина
    if (gameCode) sessionStorage.setItem('pendingGameCode', gameCode);

    await loginWithInitData(tg.initData, referrer);
  };

  const loginWithInitData = async (initData: string, referrer?: string) => {
    try {
      console.log('[Auth] Sending initData, length:', initData.length, 'first 100:', initData.substring(0, 100));
      const result = await authApi.login(initData, referrer);
      setTokens(result.accessToken, result.refreshToken);
      setUser(result.user);
      if (result.user.activeTheme) setActiveTheme(result.user.activeTheme as ThemeKey);

      // Deep link в конкретную игру
      const pendingCode = sessionStorage.getItem('pendingGameCode');
      if (pendingCode) {
        sessionStorage.removeItem('pendingGameCode');
        // Присоединяемся через socket после монтирования
        window.__pendingGameCode = pendingCode;
      }
    } catch (err) {
      console.error('[Auth] Login failed:', err);
      setLoading(false);
      logout();
    }
  };
};
