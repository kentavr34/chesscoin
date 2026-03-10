import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '@/api/socket';
import { authApi } from '@/api';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';

export const useSocket = () => {
  const { upsertSession, removeSession, setSessions, setBattles, setDrawOffered } =
    useGameStore();
  const { updateBalance, setUser } = useUserStore();
  const navigate = useNavigate();
  const initialized = useRef(false);

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
          // Понятное сообщение об ошибке вместо тихого провала
          const msg: Record<string, string> = {
            NO_ATTEMPTS:           'Нет попыток для входа в игру. Подожди восстановления или купи.',
            CANNOT_JOIN_OWN_SESSION: 'Нельзя присоединиться к своей игре.',
            SESSION_NOT_FOUND:     'Игра не найдена или уже завершена.',
            SESSION_NOT_WAITING:   'Игра уже началась или завершена.',
            INSUFFICIENT_BALANCE:  'Недостаточно монет для ставки.',
          };
          const text = msg[res.error ?? ''] ?? (res.error ?? 'Не удалось войти в игру');
          // Показываем через кастомный event — компоненты могут подписаться
          window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type: 'error' } }));
        }
      });
    }

    // Подписываемся на лобби
    socket.emit('battles:subscribe');

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
      socket.off('battles:list');
      socket.off('game:draw_offered');
      socket.off('game:draw_declined');
      socket.emit('battles:unsubscribe');
    };
  }, []);
};
