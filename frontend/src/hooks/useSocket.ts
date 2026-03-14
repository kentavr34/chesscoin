import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '@/api/socket';
import { authApi } from '@/api';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { sound } from '@/lib/sound';
import { useSettingsStore } from '@/store/useSettingsStore';
import { translations } from '@/i18n/translations';

export const useSocket = () => {
  const { upsertSession, removeSession, setSessions, setBattles, setDrawOffered } =
    useGameStore();
  const { updateBalance, setUser } = useUserStore();
  const navigate = useNavigate();
  const initialized = useRef(false);
  const lang = useSettingsStore.getState().lang;

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const socket = getSocket();

    // Получаем текущие сессии при подключении
    socket.emit('game:current', (res) => {
      if (res.ok && res.sessions) {
        setSessions(res.sessions);
        // Авто-редирект ТОЛЬКО с главной или батлов — не ломать навигацию
        const loc = window.location.pathname;
        const onLobby = loc === '/' || loc === '/battles';
        if (res.sessions.length > 0 && onLobby) {
          navigate('/game/' + res.sessions[0].id, { replace: true });
        }
      }
    });

    // Deep link: присоединиться к игре по коду
    const pendingCode = (window as any).__pendingGameCode;
    if (pendingCode) {
      delete (window as any).__pendingGameCode;
      socket.emit('game:join', { code: pendingCode }, (res) => {
        if (res.ok && res.session) {
          upsertSession(res.session);
          navigate('/game/' + res.session.id);
        } else {
          // Локализованные сообщения об ошибках
          const currentLang = useSettingsStore.getState().lang;
          const errT = translations[currentLang].errors as Record<string, string>;
          const fallback = currentLang === 'ru' ? 'Не удалось войти в игру' : 'Failed to join game';
          const text = errT[res.error ?? ''] ?? (res.error ?? fallback);
          // Показываем через кастомный event — компоненты могут подписаться
          window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type: 'error' } }));
        }
      });
    }

    // Подписываемся на лобби
    socket.emit('battles:subscribe');

    // ── Игра началась ──
    socket.on('game:started', () => {
      sound.gameStart();
    });

    // ── Обновление сессии ──
    socket.on('game', (session) => {
      upsertSession(session);
      // Обновляем баланс если есть winningAmount
      const mySide = session.sides.find((s) => s.id === session.mySideId);
      if (mySide?.winningAmount) {
        updateBalance(mySide.winningAmount);
      }
    });

    // ── Конец игры — синхронизировать реальный баланс ──
    socket.on('game:over', (_data) => {
      // Синхронизируем баланс через /auth/me чтобы не показывать сумму до комиссии
      authApi.me().then(setUser).catch(() => {});
    });

    // ── Лобби ──
    socket.on('battles:list', (battles) => {
      setBattles(battles);
    });

    // ── Оффер ничьи ──
    socket.on('game:draw_offered', ({ by }) => {
      setDrawOffered(by);
    });

    socket.on('game:draw_declined', () => {
      setDrawOffered(null);
    });

    return () => {
      socket.off('game');
      socket.off('game:over');
      socket.off('game:started');
      socket.off('battles:list');
      socket.off('game:draw_offered');
      socket.off('game:draw_declined');
      socket.emit('battles:unsubscribe');
    };
  }, []);
};
