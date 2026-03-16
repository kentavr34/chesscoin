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

    // Telegram WebApp — получаем текущего пользователя ДО проверки токена
    const tg = (window as any).Telegram?.WebApp;

    // Dev режим без Telegram
    if (!tg || !tg.initData) {
      if (import.meta.env.DEV) {
        // В dev режиме просто проверяем токен без смены пользователя
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
        console.warn('[Auth] No Telegram WebApp, using dev mock');
        await loginWithInitData('dev_mock');
      } else {
        setLoading(false);
        logout();
      }
      return;
    }

    tg.ready();
    tg.expand();

    // Получаем telegramId текущего пользователя из initData
    const currentTelegramId = tg.initDataUnsafe?.user?.id?.toString();

    // Уже есть токен — проверяем что он принадлежит ТЕКУЩЕМУ пользователю
    if (getAccessToken()) {
      try {
        const user = await authApi.me();
        // Если telegramId совпадает — всё ок
        if (!currentTelegramId || user.telegramId?.toString() === currentTelegramId) {
          setUser(user);
          if (user.activeTheme) setActiveTheme(user.activeTheme as ThemeKey);
          return;
        }
        // Другой пользователь — очищаем кэш и логинимся заново
        console.warn('[Auth] Different Telegram user detected, clearing cache');
        clearTokens();
      } catch {
        clearTokens();
      }
    }

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
