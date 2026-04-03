// frontend/src/pages/GamePage.tsx
// АРХИТЕКТУРА: useSocket.ts (App уровень) слушает 'game' события → store.
// GamePage читает из store, NOT делает собственные socket-обработчики.
// Для хода: socket.emit('game:move', ...) с callback.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { getSocket } from '@/api/socket';
import { useGameStore } from '@/store/useGameStore';
import { ChessBoard } from '@/components/game/ChessBoard';

// ── SVG J.A.R.V.I.S аватар ───────────────────────────────────────────────────
const IcoJarvis = ({ size }: { size: number }) => (
  <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="10" r="6.5" stroke="#4A9EFF" strokeWidth="1.4"/>
    <circle cx="11.5" cy="9.5" r="1.5" fill="#4A9EFF" opacity=".9"/>
    <circle cx="16.5" cy="9.5" r="1.5" fill="#4A9EFF" opacity=".9"/>
    <line x1="11.5" y1="13" x2="16.5" y2="13" stroke="#4A9EFF" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M7.5 16.5C7.5 14.015 10.462 12 14 12s6.5 2.015 6.5 4.5" stroke="#4A9EFF" strokeWidth="1.3" strokeLinecap="round"/>
    <rect x="4" y="17" width="4" height="6" rx="1.5" fill="none" stroke="#4A9EFF" strokeWidth="1.2"/>
    <rect x="20" y="17" width="4" height="6" rx="1.5" fill="none" stroke="#4A9EFF" strokeWidth="1.2"/>
    <rect x="8" y="16" width="12" height="9" rx="2" fill="none" stroke="#4A9EFF" strokeWidth="1.3"/>
    <circle cx="14" cy="20.5" r="1.2" fill="#4A9EFF" opacity=".7"/>
    <path d="M11 20.5h1.6M14.4 20.5H16" stroke="#4A9EFF" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

// ── Хелперы ────────────────────────────────────────────────────────────────────
const PIECE_SYMBOLS: Record<string, string> = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛',
};
const PIECE_COINS: Record<string, number> = {
  p: 100, n: 300, b: 300, r: 500, q: 900,
};
const PIECE_START: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };

// Взятые фигуры из FEN (diff от начального расположения)
function capturedFromFen(fen: string): { white: string[]; black: string[] } {
  const pos = fen.split(' ')[0];
  const cnt: Record<string, number> = {};
  for (const ch of pos) {
    if (/[a-zA-Z]/.test(ch)) cnt[ch] = (cnt[ch] ?? 0) + 1;
  }
  const white: string[] = []; // захвачено белыми (чёрные фигуры)
  const black: string[] = []; // захвачено чёрными (белые фигуры)
  for (const [lc, start] of Object.entries(PIECE_START)) {
    const capB = Math.max(0, start - (cnt[lc] ?? 0));
    for (let i = 0; i < capB; i++) white.push(lc);
    const capW = Math.max(0, start - (cnt[lc.toUpperCase()] ?? 0));
    for (let i = 0; i < capW; i++) black.push(lc);
  }
  return { white, black };
}

function fmtCoins(pieces: string[]): number {
  return pieces.reduce((s, p) => s + (PIECE_COINS[p] ?? 0), 0);
}

function fmtTime(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function calcBoardSize(): number {
  return Math.floor(Math.min(window.innerWidth, window.innerHeight - 218));
}

// Достаём последний ход из PGN
function lastMoveFromPgn(pgn: string): { from: string; to: string } | null {
  if (!pgn) return null;
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const history = chess.history({ verbose: true });
    const last = history[history.length - 1];
    if (!last) return null;
    return { from: last.from, to: last.to };
  } catch {
    return null;
  }
}

// ── Панель игрока ──────────────────────────────────────────────────────────────
interface PanelProps {
  name: string;
  avatar?: string | null;
  isBot?: boolean;
  isWhite: boolean;
  captured: string[];
  timeDisplay: string;
  isActive: boolean;
}

const PlayerPanel: React.FC<PanelProps> = ({
  name, avatar, isBot, isWhite, captured, timeDisplay, isActive,
}) => {
  const coins = fmtCoins(captured);
  const sz = 46;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 14px', flexShrink: 0,
      background: isActive ? 'rgba(61,186,122,.07)' : 'transparent',
      transition: 'background .4s',
    }}>
      {/* Аватар */}
      <div style={{
        width: sz, height: sz, borderRadius: '50%', flexShrink: 0,
        background: isBot ? 'rgba(74,158,255,.12)' : 'rgba(212,168,67,.08)',
        border: `.5px solid ${isBot ? 'rgba(74,158,255,.28)' : 'rgba(212,168,67,.22)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: isActive
          ? `0 0 14px ${isBot ? 'rgba(74,158,255,.3)' : 'rgba(61,186,122,.3)'}`
          : 'none',
        transition: 'box-shadow .4s',
      }}>
        {avatar
          ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : isBot
            ? <IcoJarvis size={sz} />
            : <span style={{ fontSize: sz * 0.38, fontWeight: 800, color: '#D4A843' }}>
                {name[0]?.toUpperCase() ?? '?'}
              </span>
        }
      </div>

      {/* Имя + взятые фигуры */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
          <div style={{
            width: 8, height: 8, borderRadius: 2, flexShrink: 0,
            background: isWhite ? '#E0D8C0' : '#181410',
            border: '.5px solid rgba(212,168,67,.35)',
          }} />
          <span style={{
            fontSize: '.84rem', fontWeight: 700, color: '#C8C0A0',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {name.length > 16 ? name.slice(0, 16) + '…' : name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {captured.length > 0 ? (
            <>
              <div style={{ display: 'flex', gap: 1 }}>
                {captured.slice(0, 9).map((p, i) => (
                  <span key={i} style={{ fontSize: 12, lineHeight: 1, opacity: .82 }}>
                    {PIECE_SYMBOLS[p] ?? ''}
                  </span>
                ))}
                {captured.length > 9 && (
                  <span style={{ fontSize: '.52rem', color: '#4A4840', fontWeight: 700 }}>
                    +{captured.length - 9}
                  </span>
                )}
              </div>
              {coins > 0 && (
                <span style={{
                  fontSize: '.6rem', fontWeight: 800, color: '#C89030', marginLeft: 3,
                }}>
                  +{coins >= 1000 ? (coins / 1000).toFixed(coins >= 10000 ? 0 : 1) + 'K' : coins}🪙
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: '.54rem', color: '#282624' }}>—</span>
          )}
        </div>
      </div>

      {/* Таймер */}
      <div style={{
        background: isActive ? 'rgba(212,168,67,.12)' : 'rgba(255,255,255,.03)',
        border: `.5px solid ${isActive ? 'rgba(212,168,67,.32)' : 'rgba(255,255,255,.05)'}`,
        borderRadius: 9, padding: '6px 12px', flexShrink: 0,
        minWidth: 58, textAlign: 'center',
        boxShadow: isActive ? '0 0 10px rgba(212,168,67,.18)' : 'none',
        transition: 'all .4s',
      }}>
        <span style={{
          fontSize: '.82rem', fontWeight: 900, letterSpacing: '-.01em',
          color: isActive ? '#F0C85A' : '#282624',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {timeDisplay}
        </span>
      </div>
    </div>
  );
};

// ── Основной компонент ─────────────────────────────────────────────────────────
export function GamePage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();

  // ── Читаем сессию из Zustand store (обновляется через useSocket.ts → 'game' события) ──
  const { sessions } = useGameStore();
  const session = sessions.find(s => s.id === sessionId) ?? null;

  // ── Локальный игровой стейт ────────────────────────────────────────────────
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [myTimeDisplay,  setMyTimeDisplay]  = useState('—');
  const [oppTimeDisplay, setOppTimeDisplay] = useState('—');

  // Таймерные refs — обновляются при каждом server-ответе (новый fen)
  const mySecsRef   = useRef(0);
  const oppSecsRef  = useRef(0);
  const isMyTurnRef = useRef(false);
  const gameOverRef = useRef(false);

  // Синхронизация isMyTurn ref
  const isMyTurn = !!(session?.isMyTurn);
  const gameOver = !!session && session.status !== 'IN_PROGRESS' && session.status !== 'WAITING_FOR_OPPONENT';

  useEffect(() => { isMyTurnRef.current = isMyTurn; }, [isMyTurn]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);

  // ── Синхронизируем таймеры из store при каждом изменении FEN ──────────────
  const prevFenRef = useRef('');
  useEffect(() => {
    if (!session) return;
    if (session.fen === prevFenRef.current) return;
    prevFenRef.current = session.fen;

    const mySide  = session.sides.find(s => s.id === session.mySideId);
    const oppSide = session.sides.find(s => s.id !== session.mySideId);

    if (mySide !== undefined) {
      mySecsRef.current = mySide.timeLeft ?? 0;
      setMyTimeDisplay(fmtTime(mySecsRef.current));
    }
    if (oppSide !== undefined) {
      oppSecsRef.current = oppSide.timeLeft ?? 0;
      setOppTimeDisplay(fmtTime(oppSecsRef.current));
    }

    // Обновляем lastMove из PGN
    const lm = lastMoveFromPgn(session.pgn ?? '');
    if (lm) setLastMove(lm);
  }, [session?.fen]);

  // ── Единый тикающий интервал ───────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (gameOverRef.current) return;
      if (isMyTurnRef.current) {
        mySecsRef.current  = Math.max(0, mySecsRef.current - 1);
        setMyTimeDisplay(fmtTime(mySecsRef.current));
      } else {
        oppSecsRef.current = Math.max(0, oppSecsRef.current - 1);
        setOppTimeDisplay(fmtTime(oppSecsRef.current));
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Размер доски ───────────────────────────────────────────────────────────
  const [boardSize, setBoardSize] = useState(calcBoardSize);
  useEffect(() => {
    const onResize = () => setBoardSize(calcBoardSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Данные из сессии ───────────────────────────────────────────────────────
  const mySide  = session?.sides.find(s => s.id === session?.mySideId);
  const oppSide = session?.sides.find(s => s.id !== session?.mySideId);

  const myColor: 'white' | 'black' = mySide?.isWhite ? 'white' : 'black';
  const myName    = mySide?.player?.firstName ?? 'Вы';
  const myAvatar  = mySide?.player?.avatar;

  const oppIsBot  = !!oppSide?.isBot;
  const oppName   = oppIsBot ? 'J.A.R.V.I.S' : (oppSide?.player?.firstName ?? '...');
  const oppAvatar = oppSide?.player?.avatar;
  const oppIsWhite = !!oppSide?.isWhite;

  // Взятые фигуры из FEN
  const fen = session?.fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const { white: whiteCap, black: blackCap } = capturedFromFen(fen);
  const myCaptured  = myColor === 'white' ? whiteCap : blackCap;
  const oppCaptured = myColor === 'white' ? blackCap : whiteCap;

  // Результат игры
  let resultText = '';
  if (gameOver) {
    const wId = session?.winnerSideId;
    const myId = session?.mySideId;
    if (!wId || session?.status === 'DRAW') resultText = '🤝 Ничья';
    else if (wId === myId)                   resultText = '🏆 Победа!';
    else                                      resultText = '❌ Поражение';
  }

  // ── Ход игрока ─────────────────────────────────────────────────────────────
  // Нужна мутабельная ссылка на текущий fen для отката при ошибке
  const currentFenRef = useRef(fen);
  useEffect(() => { currentFenRef.current = fen; }, [fen]);

  const handleMove = useCallback((from: Square, to: Square, promotion?: string) => {
    const prevFen = currentFenRef.current;
    setLastMove({ from, to });

    getSocket().emit(
      'game:move',
      { sessionId, from, to, promotion: promotion ?? 'q' },
      (res: Record<string, unknown>) => {
        if (!res?.ok) {
          // Откат: принудительно возвращаем store к предыдущей сессии
          // (уведомляем ChessBoard через изменение fen)
          // useGameStore не нужно менять — сервер сам отправит правильный 'game' event
          // Временно: устанавливаем lastMove в null чтобы ChessBoard откатил
          setLastMove(null);
          currentFenRef.current = prevFen;
        }
      }
    );
  }, [sessionId]);

  // ── Рендер ─────────────────────────────────────────────────────────────────

  // Загрузка — ждём пока сессия появится в store
  if (!session) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0B0D11',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '2.5px solid rgba(74,158,255,.2)',
            borderTopColor: '#4A9EFF',
            animation: 'gp-spin 1s linear infinite',
            margin: '0 auto 12px',
          }} />
          <style>{`@keyframes gp-spin { to { transform: rotate(360deg) } }`}</style>
          <div style={{ fontSize: '.72rem', color: '#3A4050', fontWeight: 700 }}>
            Загрузка партии...
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              marginTop: 20, padding: '7px 18px', borderRadius: 10,
              background: 'rgba(255,255,255,.06)', border: '.5px solid rgba(255,255,255,.1)',
              color: '#4A5060', fontSize: '.7rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >← Назад</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0B0D11',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, sans-serif',
    }}>
      <style>{`
        @keyframes gp-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.72)} }
        @keyframes gp-result { from{opacity:0;transform:scale(.88)} to{opacity:1;transform:scale(1)} }
      `}</style>

      {/* ── Заголовок ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        paddingTop: 'max(10px, env(safe-area-inset-top, 10px))',
        borderBottom: '.5px solid rgba(255,255,255,.05)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(255,255,255,.06)', border: '.5px solid rgba(255,255,255,.1)',
            borderRadius: 9, padding: '5px 11px',
            color: '#5A6070', fontSize: '.7rem', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >← Назад</button>

        {/* Статус */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: !gameOver && isMyTurn ? 'rgba(61,186,122,.1)' : 'rgba(255,255,255,.03)',
          border: `.5px solid ${!gameOver && isMyTurn ? 'rgba(61,186,122,.3)' : 'rgba(255,255,255,.07)'}`,
          borderRadius: 8, padding: '4px 10px', transition: 'all .3s',
        }}>
          {!gameOver && (
            <div style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: isMyTurn ? '#3DBA7A' : '#2A3040',
              boxShadow: isMyTurn ? '0 0 6px #3DBA7A' : 'none',
              animation: isMyTurn ? 'gp-pulse 1.5s infinite' : 'none',
            }} />
          )}
          <span style={{
            fontSize: '.68rem', fontWeight: 800,
            color: gameOver ? '#D4A843' : isMyTurn ? '#6FEDB0' : '#3A4050',
          }}>
            {gameOver
              ? (resultText || 'Конец')
              : isMyTurn
                ? 'Ваш ход'
                : 'Ожидание...'}
          </span>
        </div>

        <span style={{
          fontSize: '.58rem', fontWeight: 700, color: '#222428',
          fontVariantNumeric: 'tabular-nums',
        }}>
          #{sessionId?.slice(-4).toUpperCase() ?? '----'}
        </span>
      </div>

      {/* ── Соперник (сверху) ─────────────────────────────────────────────────── */}
      <div style={{ borderBottom: '.5px solid rgba(255,255,255,.04)', flexShrink: 0 }}>
        <PlayerPanel
          name={oppName}
          avatar={oppAvatar}
          isBot={oppIsBot}
          isWhite={oppIsWhite}
          captured={oppCaptured}
          timeDisplay={oppTimeDisplay}
          isActive={!isMyTurn && !gameOver}
        />
      </div>

      {/* ── Доска ────────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', padding: '3px 0',
      }}>
        <div style={{ width: boardSize, flexShrink: 0 }}>
          <ChessBoard
            fen={fen}
            orientation={myColor}
            isMyTurn={isMyTurn && !gameOver}
            isGameOver={gameOver}
            onMove={handleMove}
            lastMove={lastMove}
            sessionId={sessionId}
          />
        </div>
      </div>

      {/* ── Игрок (снизу) ────────────────────────────────────────────────────── */}
      <div style={{ borderTop: '.5px solid rgba(255,255,255,.04)', flexShrink: 0 }}>
        <PlayerPanel
          name={myName}
          avatar={myAvatar}
          isBot={false}
          isWhite={myColor === 'white'}
          captured={myCaptured}
          timeDisplay={myTimeDisplay}
          isActive={isMyTurn && !gameOver}
        />
      </div>

      {/* Нижний safe-area */}
      <div style={{ height: 'env(safe-area-inset-bottom, 0px)', flexShrink: 0 }} />

      {/* ── Конец игры (overlay) ──────────────────────────────────────────────── */}
      {gameOver && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(4,3,8,.9)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '1.6rem', zIndex: 200,
          animation: 'gp-result .4s cubic-bezier(.25,.8,.25,1) both',
        }}>
          <div style={{
            fontSize: '2.6rem', fontWeight: 900, letterSpacing: '.01em',
            background: resultText.includes('Победа')
              ? 'linear-gradient(135deg,#F0C85A,#D4A843)'
              : resultText.includes('Поражение')
                ? 'linear-gradient(135deg,#6A7080,#4A5060)'
                : 'linear-gradient(135deg,#82CFFF,#4A9EFF)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {resultText || 'Конец игры'}
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '13px 44px', borderRadius: 14,
              background: 'linear-gradient(135deg,#3A2A08,#5A4010)',
              border: '.5px solid rgba(212,168,67,.45)',
              color: '#F0C85A', fontSize: '.92rem', fontWeight: 900,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 6px 28px rgba(212,168,67,.22)',
            }}
          >На главную</button>
        </div>
      )}
    </div>
  );
}
