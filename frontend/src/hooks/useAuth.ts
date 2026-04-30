declare global { interface Window { __pendingGameCode?: string; __pendingSessionId?: string; } }

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

    // Получаем referrer и game deep link из startParam.
    // Поддерживаем три формата:
    //   ref_<userId>       — реферальная ссылка
    //   game_<code>        — войти в батл по короткому коду (ожидание соперника)
    //   match_<sessionId>  — открыть окно конкретной партии сразу после логина
    //   refmatch_<uid>_<sid> — реферал + сразу окно партии (в одной ссылке)
    const startParam = tg.initDataUnsafe?.start_param ?? '';
    let referrer: string | undefined;
    let gameCode: string | undefined;
    let sessionId: string | undefined;
    if (startParam.startsWith('ref_')) {
      referrer = startParam.slice(4);
    } else if (startParam.startsWith('game_')) {
      gameCode = startParam.slice(5);
    } else if (startParam.startsWith('match_')) {
      sessionId = startParam.slice(6);
    } else if (startParam.startsWith('refmatch_')) {
      const rest = startParam.slice(9);
      const sep = rest.indexOf('_');
      if (sep > 0) {
        referrer = rest.slice(0, sep);
        sessionId = rest.slice(sep + 1);
      }
    }

    if (gameCode)  sessionStorage.setItem('pendingGameCode', gameCode);
    if (sessionId) sessionStorage.setItem('pendingSessionId', sessionId);

    await loginWithInitData(tg.initData, referrer);
  };

  const loginWithInitData = async (initData: string, referrer?: string) => {
    try {
      console.log('[Auth] Sending initData, length:', initData.length, 'first 100:', initData.substring(0, 100));
      const result = await authApi.login(initData, referrer);
      setTokens(result.accessToken, result.refreshToken);
      setUser(result.user);
      if (result.user.activeTheme) setActiveTheme(result.user.activeTheme as ThemeKey);

      // Deep link в конкретную игру (по коду)
      const pendingCode = sessionStorage.getItem('pendingGameCode');
      if (pendingCode) {
        sessionStorage.removeItem('pendingGameCode');
        window.__pendingGameCode = pendingCode;
      }
      // Deep link по sessionId — сразу в окно партии (через переход по роутеру)
      const pendingSid = sessionStorage.getItem('pendingSessionId');
      if (pendingSid) {
        sessionStorage.removeItem('pendingSessionId');
        window.__pendingSessionId = pendingSid;
        // Приложение подхватит и сделает navigate('/game/' + sid) в App.tsx / Router
      }
    } catch (err) {
      console.error('[Auth] Login failed:', err);
      setLoading(false);
      logout();
    }
  };
};
