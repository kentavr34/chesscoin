// frontend/src/pages/GamePage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { getSocket } from '@/api/socket';
import { useGameStore } from '@/store/useGameStore';

export function GamePage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { sessions } = useGameStore();
  const [game, setGame] = useState(new Chess());
  const [boardWidth, setBoardWidth] = useState(Math.min(440, window.innerWidth - 32));
  const [status, setStatus] = useState<string>('');
  const [myColor, setMyColor] = useState<'white' | 'black'>('white');
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const initialized = useRef(false);

  // Обновляем ширину доски при ресайзе
  useEffect(() => {
    const onResize = () => setBoardWidth(Math.min(440, window.innerWidth - 32));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Инициализация сессии
  useEffect(() => {
    if (!sessionId || initialized.current) return;
    initialized.current = true;

    const socket = getSocket();

    // Получаем текущее состояние игры
    socket.emit('game:state', { sessionId }, (res: Record<string, unknown>) => {
      if (!res?.ok || !res?.session) return;
      const session = res.session as Record<string, unknown>;
      const fen = session.fen as string;
      if (fen) {
        try { setGame(new Chess(fen)); } catch {}
      }
      // Определяем цвет игрока
      const sides = session.sides as Array<Record<string, unknown>> | undefined;
      const mySide = sides?.find(s => s.isMe);
      if (mySide?.isWhite === false) setMyColor('black');
      setIsMyTurn(!!(session.isMyTurn));
      if (session.status === 'FINISHED') {
        setGameOver(true);
        setStatus('Игра завершена');
      }
    });

    // Слушаем ходы
    socket.on('game:move', (data: Record<string, unknown>) => {
      if (data.sessionId !== sessionId) return;
      if (data.fen) {
        try { setGame(new Chess(data.fen as string)); } catch {}
      }
      setIsMyTurn(!!(data.isMyTurn));
    });

    // Конец игры
    socket.on('game:end', (data: Record<string, unknown>) => {
      if (data.sessionId !== sessionId) return;
      setGameOver(true);
      const result = data.result as string;
      setStatus(result === 'WIN' ? '🏆 Победа!' : result === 'LOSE' ? '❌ Поражение' : '🤝 Ничья');
    });

    return () => {
      socket.off('game:move');
      socket.off('game:end');
    };
  }, [sessionId]);

  function onDrop(sourceSquare: string, targetSquare: string) {
    if (!isMyTurn || gameOver) return false;
    try {
      const gameCopy = new Chess(game.fen());
      const move = gameCopy.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      if (!move) return false;

      setGame(gameCopy);
      setIsMyTurn(false);

      // Отправляем ход на сервер
      const socket = getSocket();
      socket.emit('game:move', { sessionId, from: sourceSquare, to: targetSquare, promotion: 'q' },
        (res: Record<string, unknown>) => {
          if (!res?.ok) {
            // Откат хода если сервер не принял
            setGame(new Chess(game.fen()));
            setIsMyTurn(true);
          }
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0B0D11',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-start',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Шапка */}
      <div style={{
        width: '100%', maxWidth: 480,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        paddingTop: 'max(12px, env(safe-area-inset-top, 12px))',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(255,255,255,.07)', border: '.5px solid rgba(255,255,255,.12)',
            borderRadius: 10, padding: '6px 14px',
            color: '#8A909A', fontSize: '.78rem', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >← Главная</button>

        <div style={{ fontSize: '.72rem', fontWeight: 700, color: isMyTurn ? '#3DBA7A' : '#5A6070' }}>
          {gameOver ? status : isMyTurn ? '● Ваш ход' : '○ Ожидание'}
        </div>

        <div style={{
          background: myColor === 'white' ? 'rgba(240,200,120,.12)' : 'rgba(74,158,255,.1)',
          border: `.5px solid ${myColor === 'white' ? 'rgba(212,168,67,.3)' : 'rgba(74,158,255,.25)'}`,
          borderRadius: 8, padding: '4px 10px',
          fontSize: '.68rem', fontWeight: 700,
          color: myColor === 'white' ? '#D4A843' : '#82CFFF',
        }}>
          {myColor === 'white' ? '♔ Белые' : '♛ Чёрные'}
        </div>
      </div>

      {/* Доска */}
      <div style={{ padding: '0 16px' }}>
        <Chessboard
          position={game.fen()}
          onPieceDrop={onDrop}
          boardWidth={boardWidth}
          boardOrientation={myColor}
          customDarkSquareStyle={{ backgroundColor: '#4A3728' }}
          customLightSquareStyle={{ backgroundColor: '#C8A87A' }}
          arePiecesDraggable={isMyTurn && !gameOver}
        />
      </div>

      {/* Конец игры — кнопка */}
      {gameOver && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#F0C85A', marginBottom: 16 }}>{status}</div>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '12px 32px', borderRadius: 14,
              background: 'linear-gradient(135deg,#3A2A08,#5A4010)',
              border: '.5px solid rgba(212,168,67,.5)',
              color: '#F0C85A', fontSize: '.9rem', fontWeight: 900,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >На главную</button>
        </div>
      )}
    </div>
  );
}
