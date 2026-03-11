declare global { interface Window { __pendingGameCode?: string; } }

import { useEffect } from 'react';
import { authApi } from '@/api';
import { setTokens, clearTokens, getAccessToken } from '@/api/client';
import { useUserStore } from '@/store/useUserStore';

export const useAuth = () => {
  const { setUser, setLoading, logout } = useUserStore();

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);

    // Уже есть токен — пробуем получить профиль
    if (getAccessToken()) {
      try {
        const user = await authApi.me();
        setUser(user);
        return;
      } catch {
        clearTokens();
      }
    }

    // Telegram WebApp
    const tg = (window as any).Telegram?.WebApp;
    if (!tg || !tg.initData) {
      // Dev режим без Telegram — используем mock
      if (import.meta.env.DEV) {
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
