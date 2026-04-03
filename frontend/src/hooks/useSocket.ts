import type { SocketGameEvent } from '@/types'; // R1
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '@/api/socket';
import { authApi } from '@/api';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { useWarChallengeStore } from '@/store/useWarChallengeStore';
import { sound } from '@/lib/sound';
import { useSettingsStore } from '@/store/useSettingsStore';
import { translations } from '@/i18n/translations';

// Вспомогательная функция для показа тоста с кнопкой перехода
const showActionToast = (text: string, actionLabel: string, onAction: () => void) => {
  window.dispatchEvent(new CustomEvent('chesscoin:toast', {
    detail: { text, type: 'info', actionLabel, onAction },
  }));
};

export const useSocket = () => {
  const { upsertSession, removeSession, setSessions, setBattles, setDrawOffered } =
    useGameStore();
  const battlesRef = useRef<import('@/types').BattleLobbyItem[]>([]);
  
  useEffect(() => {
    battlesRef.current = useGameStore.getState().battles;
  }, [useGameStore.getState().battles]);
  const { setWarChallenge } = useWarChallengeStore();
  const { updateBalance, setUser } = useUserStore();
  const navigate = useNavigate();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const socket = getSocket();

    // Получаем текущие сессии при подключении (без авто-редиректа — пользователь сам выбирает)
    socket.emit('game:current', (res) => {
      if (res.ok && res.sessions) {
        setSessions(res.sessions);
      }
    });

    // Deep link: присоединиться к игре по коду
    const pendingCode = (window as unknown as Record<string,unknown>).__pendingGameCode as string | undefined;
    if (pendingCode) {
      delete (window as unknown as Record<string,unknown>).__pendingGameCode;
      socket.emit('game:join', { code: pendingCode }, (res: { ok?: boolean; session?: import('@/types').GameSession; error?: string }) => {
        if (res.ok && res.session) {
          upsertSession(res.session);
          navigate('/game/' + res.session.id);
        } else {
          const currentLang = useSettingsStore.getState().lang;
          const errT = translations[currentLang].errors as Record<string, string>;
          const fallback = currentLang === 'ru' ? 'Не удалось войти в игру' : 'Failed to join game';
          const text = errT[res.error ?? ''] ?? (res.error ?? fallback);
          window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type: 'error' } }));
        }
      });
    }

    socket.emit('battles:subscribe');

    // U2: При переподключении — обновляем список сессий
    // Это решает проблему устаревшего состояния доски после разрыва соединения
    socket.on('connect', () => {
      socket.emit('game:current', (res: Record<string,unknown>) => {
        if (res?.ok && res?.sessions) {
          setSessions(res.sessions as import('@/types').GameSession[]);
        }
      });
      socket.emit('battles:subscribe');
    });

    // ── Игра началась ──
    socket.on('game:started', () => {
      sound.gameStart();
    });

    // ── Обновление сессии ──
    socket.on('game', (session) => {
      upsertSession(session);
      const mySide = session.sides.find((s) => s.id === session.mySideId);
      if (mySide?.winningAmount) {
        updateBalance(mySide.winningAmount);
      }
    });

    // ── Конец игры ──
    socket.on('game:over', (_data) => {
      authApi.me().then(setUser).catch(() => {});
    });

    // ── Лобби ──
    socket.on('battles:list', (battles) => {
      setBattles(battles);
    });
    socket.on('battles:added', (newBattle) => {
      setBattles([...battlesRef.current, newBattle]);
    });
    socket.on('battles:removed', (sessionId) => {
      setBattles(battlesRef.current.filter((b) => b.id !== sessionId));
    });

    // ── Ничья ──
    socket.on('game:draw_offered', ({ by }) => {
      setDrawOffered(by);
    });
    socket.on('game:draw_declined', () => {
      setDrawOffered(null);
    });

    // ── Персональные уведомления (войны, турниры, вызовы) ──
    // Backend шлёт через: io.emit(`user:${userId}`, { type, ... })
    const userId = useUserStore.getState().user?.id;
    if (userId) {
      const handlePersonal = (data: SocketGameEvent) => {
        const currentLang = useSettingsStore.getState().lang;
        const t = translations[currentLang];

        if (data.type === 'war:challenge') {
          // W1: показываем красивый попап вместо toast
          setWarChallenge({
            sessionId: data.sessionId ?? '',
            sessionCode: data.sessionCode ?? '',
            warId: data.warId ?? '',
            challengerUserId: data.challengerUserId ?? '',
            challengerName: data.challengerName,
            challengerCountry: data.challengerCountry,
            challengerFlag: data.challengerFlag,
          });
          try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning'); } catch {}
        }

        if (data.type === 'tournament:match') {
          // T2: Турнирный матч — красивый toast с кнопкой перехода в игру
          const opponentName = data.opponentName ?? '';
          const text = `🏆 Tournament match! Round ${data.round ?? 1} · vs ${opponentName}`;
          showActionToast(text, '⚔️ Play', () => navigate('/battles'));
          // Уведомляем TournamentsPage о новом матче
          window.dispatchEvent(new CustomEvent('chesscoin:tournament:match', { detail: data }));
          try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success'); } catch {}
        }

        if (data.type === 'tournament:finished') {
          // T7: Турнир завершён — через глобальный event (TournamentsPage подхватит)
          window.dispatchEvent(new CustomEvent('chesscoin:tournament:finished', { detail: data }));
          try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success'); } catch {}
        }

        if (data.type === 'battle:challenge') {
          // Вызов на клановое сражение (clan battle из NationsPage)
          const currentLang2 = useSettingsStore.getState().lang;
          const t2 = translations[currentLang2];
          showActionToast(
            t2.notifications.warChallenge(''),
            t2.notifications.goToBattles,
            () => navigate('/battles')
          );
        }

        if (data.type === 'exchange:executed') {
          // E13: Сделка на бирже исполнена — диспатчим событие (ExchangeTab подхватит)
          window.dispatchEvent(new CustomEvent('chesscoin:exchange:executed', { detail: data }));
          const role = data.role ?? '';
          const coins = Number(BigInt(data.amountCoins ?? '0')).toLocaleString();
          const ton   = data.totalTon?.toFixed(4) ?? '0';
          const msg   = role === 'seller'
            ? `💱 Order executed! Sold ${coins} ᚙ for ${ton} TON`
            : `🛒 Bought ${coins} ᚙ for ${ton} TON — credited to balance`;
          showActionToast(msg, '💱 Exchange', () => navigate('/shop'));
          try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success'); } catch {}
        }
      };

      // Socket.io не поддерживает динамические имена событий нативно,
      // поэтому слушаем через onAny
      socket.onAny((eventName: string, ...args: unknown[]) => {
        if (eventName === `user:${userId}`) {
          handlePersonal(args[0] as SocketGameEvent);
        }
      });
    }

    return () => {
      socket.off('game');
      socket.off('game:over');
      socket.off('game:started');
      socket.off('battles:list');
      socket.off('battles:added');
      socket.off('battles:removed');
      socket.off('game:draw_offered');
      socket.off('game:draw_declined');
      socket.offAny();
      socket.emit('battles:unsubscribe');
    };
  }, []);
};
