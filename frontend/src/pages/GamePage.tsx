// frontend/src/pages/GamePage.tsx
// АРХИТЕКТУРА: useSocket.ts (App уровень) слушает 'game' события → store.
// GamePage читает из store, NOT делает собственные socket-обработчики.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { getSocket } from '@/api/socket';
import { useGameStore } from '@/store/useGameStore';
import { ChessBoard } from '@/components/game/ChessBoard';

// ── Константы ──────────────────────────────────────────────────────────────────
const PIECE_SYMBOLS: Record<string, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };
const PIECE_VAL:     Record<string, number>  = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_START:   Record<string, number>  = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const SORT_ORDER:    Record<string, number>  = { q: 0, r: 1, b: 2, n: 3, p: 4 };

const HEADER_H = 46;
const PANEL_H  = 58;

// ── Хелперы ────────────────────────────────────────────────────────────────────
function capturedFromFen(fen: string): { white: string[]; black: string[] } {
  const pos = fen.split(' ')[0];
  const cnt: Record<string, number> = {};
  for (const ch of pos) if (/[a-zA-Z]/.test(ch)) cnt[ch] = (cnt[ch] ?? 0) + 1;
  const white: string[] = [], black: string[] = [];
  for (const [lc, start] of Object.entries(PIECE_START)) {
    const capW = Math.max(0, start - (cnt[lc] ?? 0));
    for (let i = 0; i < capW; i++) white.push(lc);
    const capB = Math.max(0, start - (cnt[lc.toUpperCase()] ?? 0));
    for (let i = 0; i < capB; i++) black.push(lc);
  }
  return { white, black };
}

function sortCaptured(pieces: string[]): string[] {
  return [...pieces].sort((a, b) => (SORT_ORDER[a] ?? 5) - (SORT_ORDER[b] ?? 5));
}

function calcMaterial(pieces: string[]): number {
  return pieces.reduce((s, p) => s + (PIECE_VAL[p] ?? 0), 0);
}

function fmtTime(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function calcBoardSize(): number {
  const reserved = HEADER_H + PANEL_H * 2 + 8;
  return Math.floor(Math.min(window.innerWidth, window.innerHeight - reserved));
}

function lastMoveFromPgn(pgn: string): { from: string; to: string } | null {
  if (!pgn) return null;
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const history = chess.history({ verbose: true });
    const last = history[history.length - 1];
    return last ? { from: last.from, to: last.to } : null;
  } catch { return null; }
}

// ── J.A.R.V.I.S аватар ────────────────────────────────────────────────────────
const JarvisAva: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
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

// ── Конфетти (только победа) ──────────────────────────────────────────────────
const CONFETTI_COLORS = ['#F4C430', '#4DDA8A', '#82CFFF', '#C084FC', '#FF9F43', '#F472B6'];

const Confetti: React.FC = () => {
  const pieces = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: 3 + (i / 17) * 94 + Math.sin(i * 1.8) * 5,
      delay: (i * 0.065) % 1.0,
      dur: 1.1 + (i % 6) * 0.13,
      size: 5 + (i % 5),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    })), []);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 205 }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', top: -8, left: `${p.x}%`,
          width: p.size, height: p.size * 0.55,
          background: p.color, borderRadius: 1,
          animation: `cf-fall ${p.dur}s ${p.delay}s ease-in both`,
        }} />
      ))}
    </div>
  );
};

// ── Панель игрока ──────────────────────────────────────────────────────────────
interface PanelProps {
  name: string;
  elo?: number;
  avatar?: string | null;
  isBot?: boolean;
  isWhite: boolean;
  captured: string[];
  advantage: number;
  timeDisplay: string;
  timeSecs: number;
  isActive: boolean;
}

const PlayerPanel: React.FC<PanelProps> = ({
  name, elo, avatar, isBot, isWhite, captured, advantage: adv,
  timeDisplay, timeSecs, isActive,
}) => {
  const sorted = useMemo(() => sortCaptured(captured), [captured]);
  const isCritical = isActive && timeSecs > 0 && timeSecs < 15;
  const AV = 38;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9,
      height: PANEL_H, padding: '0 14px', flexShrink: 0,
      background: isActive ? 'rgba(255,255,255,.038)' : 'transparent',
      borderLeft: `3px solid ${
        isCritical ? 'rgba(220,50,47,.8)'
        : isActive  ? '#3DBA7A'
        : 'transparent'
      }`,
      transition: 'background .3s, border-color .3s',
    }}>

      {/* Аватар */}
      <div style={{
        width: AV, height: AV, borderRadius: '50%', flexShrink: 0,
        background: isBot ? 'rgba(74,158,255,.1)' : 'rgba(212,168,67,.07)',
        border: `.5px solid ${
          isActive
            ? isBot ? 'rgba(74,158,255,.5)' : 'rgba(61,186,122,.42)'
            : isBot ? 'rgba(74,158,255,.15)' : 'rgba(212,168,67,.15)'
        }`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: isActive
          ? `0 0 14px ${isBot ? 'rgba(74,158,255,.22)' : 'rgba(61,186,122,.2)'}`
          : 'none',
        transition: 'box-shadow .3s, border-color .3s',
      }}>
        {avatar
          ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : isBot
            ? <JarvisAva size={AV * 0.66} />
            : <span style={{ fontSize: AV * 0.38, fontWeight: 800, color: '#D4A843' }}>
                {name[0]?.toUpperCase() ?? '?'}
              </span>
        }
      </div>

      {/* Имя + взятые фигуры */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Строка 1: маркер цвета + имя + ELO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
          <div style={{
            width: 7, height: 7, borderRadius: 2, flexShrink: 0,
            background: isWhite ? '#E8E0C8' : '#28221C',
            border: '.5px solid rgba(212,168,67,.28)',
          }} />
          <span style={{
            fontSize: '.82rem', fontWeight: 700,
            color: isActive ? '#EAE2CC' : '#6A6458',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: 115, transition: 'color .3s',
          }}>
            {name.length > 15 ? name.slice(0, 15) + '…' : name}
          </span>
          {elo !== undefined && (
            <span style={{ fontSize: '.58rem', color: '#3A3830', fontWeight: 600, flexShrink: 0 }}>
              {elo}
            </span>
          )}
        </div>

        {/* Строка 2: взятые фигуры + преимущество */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {sorted.length > 0 ? (
            <>
              <div style={{ display: 'flex' }}>
                {sorted.slice(0, 9).map((p, i) => (
                  <span key={i} style={{
                    fontSize: 11, lineHeight: 1, opacity: .75,
                    marginLeft: i > 0 ? -1 : 0,
                  }}>
                    {PIECE_SYMBOLS[p] ?? ''}
                  </span>
                ))}
                {sorted.length > 9 && (
                  <span style={{ fontSize: '.48rem', color: '#3A3830', fontWeight: 700, marginLeft: 1 }}>
                    +{sorted.length - 9}
                  </span>
                )}
              </div>
              {adv > 0 && (
                <span style={{ fontSize: '.6rem', fontWeight: 800, color: '#3DBA7A', marginLeft: 3 }}>
                  +{adv}
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: '.5rem', color: '#1E1C18' }}>—</span>
          )}
        </div>
      </div>

      {/* Таймер: 3 состояния */}
      <div style={{
        background: isCritical
          ? 'rgba(220,50,47,.2)'
          : isActive
            ? 'rgba(61,186,122,.13)'
            : 'rgba(255,255,255,.03)',
        border: `.5px solid ${
          isCritical ? 'rgba(220,50,47,.5)'
          : isActive  ? 'rgba(61,186,122,.32)'
          : 'rgba(255,255,255,.05)'
        }`,
        borderRadius: 9, padding: '5px 11px', flexShrink: 0,
        minWidth: 60, textAlign: 'center',
        transition: 'all .3s',
        animation: isCritical ? 'timer-crit .75s infinite' : 'none',
      }}>
        <span style={{
          fontSize: '.84rem', fontWeight: 900,
          color: isCritical ? '#FF6868' : isActive ? '#5DEDA0' : '#282420',
          fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em',
          transition: 'color .3s',
        }}>
          {timeDisplay}
        </span>
      </div>
    </div>
  );
};

// ── Результирующий bottom sheet ────────────────────────────────────────────────
type ResultType = 'win' | 'lose' | 'draw';

const RESULT_CFG: Record<ResultType, { bg: string; accent: string; emoji: string; title: string }> = {
  win:  { bg: 'linear-gradient(150deg,#082B14,#145228)',   accent: '#5DEDA0', emoji: '🏆', title: 'Победа!' },
  lose: { bg: 'linear-gradient(150deg,#111111,#1C1C1C)',   accent: '#888',    emoji: '💀', title: 'Поражение' },
  draw: { bg: 'linear-gradient(150deg,#080E2E,#101E46)',   accent: '#82CFFF', emoji: '🤝', title: 'Ничья' },
};

interface SheetProps {
  type: ResultType;
  winAmount?: string | null;
  pieceCoins?: string | null;
  onRematch: () => void;
  onHome: () => void;
}

const ResultSheet: React.FC<SheetProps> = ({ type, winAmount, pieceCoins, onRematch, onHome }) => {
  const cfg = RESULT_CFG[type];
  const isWin = type === 'win';
  const coinsDisplay = isWin ? (winAmount ?? pieceCoins) : null;

  return (
    <>
      {isWin && <Confetti />}

      {/* Затемнение фона */}
      <div
        style={{
          position: 'absolute', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,.62)',
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        }}
        onClick={onHome}
      />

      {/* Sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: '#0E1015',
        borderRadius: '22px 22px 0 0',
        overflow: 'hidden',
        animation: 'sheet-up .38s cubic-bezier(.2,.85,.3,1.05) both',
        boxShadow: '0 -8px 40px rgba(0,0,0,.6)',
      }}>
        {/* Pull handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,.12)',
          margin: '10px auto 0',
        }} />

        {/* Цветной заголовок */}
        <div style={{
          background: cfg.bg,
          padding: '16px 20px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
          marginTop: 8,
        }}>
          <span style={{ fontSize: 34, lineHeight: 1, flexShrink: 0 }}>{cfg.emoji}</span>
          <div>
            <div style={{
              fontSize: '1.35rem', fontWeight: 900, color: cfg.accent,
              letterSpacing: '-.01em',
            }}>
              {cfg.title}
            </div>
            {coinsDisplay && (
              <div style={{
                fontSize: '.8rem', fontWeight: 700,
                color: '#F4C430', marginTop: 3,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span>🪙</span>
                <span>+{coinsDisplay} зачислено на баланс</span>
              </div>
            )}
            {!coinsDisplay && type === 'lose' && (
              <div style={{ fontSize: '.72rem', color: '#4A4840', marginTop: 3 }}>
                Попробуй ещё раз
              </div>
            )}
          </div>
        </div>

        {/* Кнопки */}
        <div style={{ padding: '14px 16px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Реванш + Анализ */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onRematch} style={{
              flex: 1, padding: '13px 0', borderRadius: 14,
              background: isWin ? 'rgba(61,186,122,.14)' : 'rgba(255,255,255,.06)',
              border: `.5px solid ${isWin ? 'rgba(61,186,122,.32)' : 'rgba(255,255,255,.1)'}`,
              color: isWin ? '#5DEDA0' : '#8A8270',
              fontSize: '.8rem', fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              🔄 <span>Реванш</span>
            </button>

            <button style={{
              flex: 1, padding: '13px 0', borderRadius: 14,
              background: 'rgba(255,255,255,.04)',
              border: '.5px solid rgba(255,255,255,.07)',
              color: '#404040',
              fontSize: '.8rem', fontWeight: 800,
              cursor: 'default', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              opacity: 0.55,
            }} disabled>
              📋 <span>Анализ</span>
            </button>
          </div>

          {/* На главную */}
          <button onClick={onHome} style={{
            width: '100%', padding: '15px 0', borderRadius: 14,
            background: 'linear-gradient(135deg,#2A1E08,#4A3810)',
            border: '.5px solid rgba(212,168,67,.42)',
            color: '#F0C85A',
            fontSize: '.9rem', fontWeight: 900,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 22px rgba(212,168,67,.15)',
          }}>
            ← На главную
          </button>
        </div>
      </div>
    </>
  );
};

// ── Основной компонент ─────────────────────────────────────────────────────────
export function GamePage() {
  const navigate = useNavigate();
  const { sessionId = '' } = useParams<{ sessionId: string }>();

  const { sessions } = useGameStore();
  const session = sessions.find(s => s.id === sessionId) ?? null;

  const [lastMove, setLastMove]         = useState<{ from: string; to: string } | null>(null);
  const [myTimeDisplay,  setMyTimeDisplay]  = useState('—');
  const [oppTimeDisplay, setOppTimeDisplay] = useState('—');
  const [myTimeSecs,  setMyTimeSecs]  = useState(0);
  const [oppTimeSecs, setOppTimeSecs] = useState(0);

  const mySecsRef   = useRef(0);
  const oppSecsRef  = useRef(0);
  const isMyTurnRef = useRef(false);
  const gameOverRef = useRef(false);

  const isMyTurn = !!(session?.isMyTurn);
  const gameOver = !!session
    && session.status !== 'IN_PROGRESS'
    && session.status !== 'WAITING_FOR_OPPONENT';

  useEffect(() => { isMyTurnRef.current = isMyTurn; }, [isMyTurn]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);

  // Синхронизируем таймеры при каждом новом FEN (= новый ход с сервера)
  const prevFenRef = useRef('');
  useEffect(() => {
    if (!session) return;
    if (session.fen === prevFenRef.current) return;
    prevFenRef.current = session.fen;

    const mySide  = session.sides.find(s => s.id === session.mySideId);
    const oppSide = session.sides.find(s => s.id !== session.mySideId);

    if (mySide) {
      mySecsRef.current = mySide.timeLeft ?? 0;
      setMyTimeDisplay(fmtTime(mySecsRef.current));
      setMyTimeSecs(mySecsRef.current);
    }
    if (oppSide) {
      oppSecsRef.current = oppSide.timeLeft ?? 0;
      setOppTimeDisplay(fmtTime(oppSecsRef.current));
      setOppTimeSecs(oppSecsRef.current);
    }

    const lm = lastMoveFromPgn(session.pgn ?? '');
    if (lm) setLastMove(lm);
  }, [session?.fen]);

  // Единый тикающий интервал
  useEffect(() => {
    const id = setInterval(() => {
      if (gameOverRef.current) return;
      if (isMyTurnRef.current) {
        mySecsRef.current = Math.max(0, mySecsRef.current - 1);
        setMyTimeDisplay(fmtTime(mySecsRef.current));
        setMyTimeSecs(mySecsRef.current);
      } else {
        oppSecsRef.current = Math.max(0, oppSecsRef.current - 1);
        setOppTimeDisplay(fmtTime(oppSecsRef.current));
        setOppTimeSecs(oppSecsRef.current);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Размер доски
  const [boardSize, setBoardSize] = useState(calcBoardSize);
  useEffect(() => {
    const onResize = () => setBoardSize(calcBoardSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Данные из сессии
  const mySide  = session?.sides.find(s => s.id === session?.mySideId);
  const oppSide = session?.sides.find(s => s.id !== session?.mySideId);

  const myColor: 'white' | 'black' = mySide?.isWhite ? 'white' : 'black';
  const myName   = mySide?.player?.firstName ?? 'Вы';
  const myAvatar = mySide?.player?.avatar;
  const myElo    = mySide?.player?.elo;

  const oppIsBot  = !!oppSide?.isBot;
  const oppName   = oppIsBot ? 'J.A.R.V.I.S' : (oppSide?.player?.firstName ?? '...');
  const oppAvatar = oppSide?.player?.avatar;
  const oppIsWhite = !!oppSide?.isWhite;
  const oppElo    = oppSide?.player?.elo;

  const fen = session?.fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const { white: whiteCap, black: blackCap } = capturedFromFen(fen);

  // Материальный перевес
  const wMat = calcMaterial(whiteCap);
  const bMat = calcMaterial(blackCap);
  const myCaptured  = myColor === 'white' ? whiteCap : blackCap;
  const oppCaptured = myColor === 'white' ? blackCap : whiteCap;
  const myAdv  = myColor === 'white' ? Math.max(0, wMat - bMat) : Math.max(0, bMat - wMat);
  const oppAdv = myColor === 'white' ? Math.max(0, bMat - wMat) : Math.max(0, wMat - bMat);

  // Результат
  const resultType: ResultType | null = !gameOver ? null
    : !session?.winnerSideId || session.status === 'DRAW' ? 'draw'
    : session.winnerSideId === session.mySideId ? 'win'
    : 'lose';

  // Ход игрока
  const currentFenRef = useRef(fen);
  useEffect(() => { currentFenRef.current = fen; }, [fen]);

  const handleMove = useCallback((from: Square, to: Square, promotion?: string) => {
    const prevFen = currentFenRef.current;
    setLastMove({ from, to });
    getSocket().emit(
      'game:move',
      { sessionId, from, to, promotion: promotion ?? 'q' },
      (res: Record<string, unknown>) => {
        if (!res?.ok) { setLastMove(null); currentFenRef.current = prevFen; }
      }
    );
  }, [sessionId]);

  // ── Загрузка ────────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0B0D11',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
      }}>
        <style>{`@keyframes gp-spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '2.5px solid rgba(74,158,255,.18)', borderTopColor: '#4A9EFF',
            animation: 'gp-spin 1s linear infinite', margin: '0 auto 14px',
          }} />
          <div style={{ fontSize: '.72rem', color: '#3A4050', fontWeight: 700 }}>
            Загрузка партии...
          </div>
          <button onClick={() => navigate('/')} style={{
            marginTop: 20, padding: '7px 18px', borderRadius: 10,
            background: 'rgba(255,255,255,.06)', border: '.5px solid rgba(255,255,255,.1)',
            color: '#4A5060', fontSize: '.7rem', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>← Назад</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0B0D11',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, sans-serif', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes gp-spin  { to { transform: rotate(360deg) } }
        @keyframes gp-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.7)} }
        @keyframes timer-crit { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes sheet-up { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes cf-fall  { 0%{transform:translateY(0) rotate(0deg);opacity:1} 80%{opacity:.9} 100%{transform:translateY(320px) rotate(600deg);opacity:0} }
      `}</style>

      {/* ── Заголовок ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px',
        paddingTop: 'max(8px, env(safe-area-inset-top, 8px))',
        height: HEADER_H,
        borderBottom: '.5px solid rgba(255,255,255,.05)',
        flexShrink: 0,
      }}>
        <button onClick={() => navigate('/')} style={{
          background: 'rgba(255,255,255,.06)', border: '.5px solid rgba(255,255,255,.09)',
          borderRadius: 9, padding: '5px 11px',
          color: '#5A6070', fontSize: '.68rem', fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>← Назад</button>

        {/* Статус хода */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: !gameOver && isMyTurn ? 'rgba(61,186,122,.08)' : 'rgba(255,255,255,.03)',
          border: `.5px solid ${!gameOver && isMyTurn ? 'rgba(61,186,122,.28)' : 'rgba(255,255,255,.06)'}`,
          borderRadius: 9, padding: '4px 11px', transition: 'all .3s',
        }}>
          {!gameOver && (
            <div style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: isMyTurn ? '#3DBA7A' : '#252830',
              boxShadow: isMyTurn ? '0 0 7px #3DBA7A' : 'none',
              animation: isMyTurn ? 'gp-pulse 1.5s infinite' : 'none',
            }} />
          )}
          <span style={{
            fontSize: '.67rem', fontWeight: 800,
            color: gameOver ? '#D4A843' : isMyTurn ? '#6FEDB0' : '#353840',
          }}>
            {gameOver ? 'Конец игры' : isMyTurn ? 'Ваш ход' : 'Ожидание...'}
          </span>
        </div>

        <span style={{
          fontSize: '.56rem', fontWeight: 700, color: '#1E2028',
          fontVariantNumeric: 'tabular-nums',
        }}>
          #{sessionId.slice(-4).toUpperCase() || '----'}
        </span>
      </div>

      {/* ── Соперник (сверху) ──────────────────────────────────────────────── */}
      <div style={{ borderBottom: '.5px solid rgba(255,255,255,.04)', flexShrink: 0 }}>
        <PlayerPanel
          name={oppName} elo={oppElo} avatar={oppAvatar} isBot={oppIsBot}
          isWhite={oppIsWhite} captured={oppCaptured} advantage={oppAdv}
          timeDisplay={oppTimeDisplay} timeSecs={oppTimeSecs}
          isActive={!isMyTurn && !gameOver}
        />
      </div>

      {/* ── Доска ─────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
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

      {/* ── Игрок (снизу) ─────────────────────────────────────────────────── */}
      <div style={{ borderTop: '.5px solid rgba(255,255,255,.04)', flexShrink: 0 }}>
        <PlayerPanel
          name={myName} elo={myElo} avatar={myAvatar} isBot={false}
          isWhite={myColor === 'white'} captured={myCaptured} advantage={myAdv}
          timeDisplay={myTimeDisplay} timeSecs={myTimeSecs}
          isActive={isMyTurn && !gameOver}
        />
      </div>

      {/* Нижняя safe-area */}
      <div style={{ height: 'env(safe-area-inset-bottom, 0px)', flexShrink: 0 }} />

      {/* ── Bottom sheet результата ────────────────────────────────────────── */}
      {resultType && (
        <ResultSheet
          type={resultType}
          winAmount={mySide?.winningAmount}
          pieceCoins={session.pieceCoins}
          onRematch={() => navigate('/')}
          onHome={() => navigate('/')}
        />
      )}
    </div>
  );
}
