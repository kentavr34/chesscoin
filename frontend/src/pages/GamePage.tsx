// frontend/src/pages/GamePage.tsx
// АРХИТЕКТУРА: useSocket.ts (App уровень) слушает 'game' события → store.
// GamePage читает из store. Для ходов/сдачи/ничьи: socket.emit(...).

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { getSocket } from '@/api/socket';
import { useGameStore } from '@/store/useGameStore';
import { ChessBoard } from '@/components/game/ChessBoard';
import { sound } from '@/lib/sound';

// ── Константы ──────────────────────────────────────────────────────────────────
const PIECE_SYMBOLS: Record<string, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };
const PIECE_VAL:     Record<string, number>  = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_START:   Record<string, number>  = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const SORT_ORDER:    Record<string, number>  = { q: 0, r: 1, b: 2, n: 3, p: 4 };

const TOPBAR_H      = 0;   // убираем отдельный топбар — статус встроен в панели
const PANEL_H       = 72;  // высота панели игрока
const ACTBAR_H      = 64;  // нижняя панель кнопок
// Отступы: аватар ДОЛЖЕН быть на середине между краем экрана и верхом доски
// Верх: paddingTop=4 → avatar center = 4+36 = 40px = (4+72)/2 = 38... корректно
// Низ:  paddingBottom=12 → поднимаем панель выше от кнопок
const PANEL_GAP_TOP = 4;   // отступ сверху (точное центрирование аватара оппонента)
const PANEL_GAP_BOT = 12;  // отступ снизу  (поднимает панель игрока выше от кнопок)

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
  const reserved = PANEL_H * 2 + ACTBAR_H + PANEL_GAP_TOP + PANEL_GAP_BOT + 4;
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

// ── ChessCoin иконка монеты (золотой конь) ────────────────────────────────────
const CoinIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="15" fill="url(#coinBg)" stroke="url(#coinBorder)" strokeWidth="1.2"/>
    {/* Орнаментальное кольцо */}
    <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(180,130,20,.4)" strokeWidth=".6"/>
    {/* Конь (шахматный конь) */}
    <path d="M11 24c0-1 .5-2 1.5-2.5L14 21c-1-1-1.5-2.5-1-4 .3-1 1-2 2-2.5-.5-.8-.5-1.5 0-2 .8-.5 2-.3 2.5.5.5.8.3 2-.5 2.5.5.5 1 1.5.8 2.5l2 1c1 .5 1.7 1.5 1.7 2.5v.5H11z" fill="url(#coinKnight)"/>
    {/* Грива */}
    <path d="M16.5 12c.5-1 1.5-2 2-3 .3-.5 0-1-.3-1.2-.5-.3-1 0-1.2.5L16 10l-1-.5c-.3-1.5.5-3 2-3.5 1.5-.5 3 .2 3.5 1.5.3.8 0 1.8-.5 2.5l-1 1.5" fill="url(#coinKnight)" opacity=".9"/>
    <defs>
      <radialGradient id="coinBg" cx="38%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#F0C85A"/>
        <stop offset="55%" stopColor="#D4A843"/>
        <stop offset="100%" stopColor="#8A6020"/>
      </radialGradient>
      <linearGradient id="coinBorder" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F0C85A"/>
        <stop offset="50%" stopColor="#A07830"/>
        <stop offset="100%" stopColor="#F0C85A"/>
      </linearGradient>
      <linearGradient id="coinKnight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#120E04"/>
        <stop offset="100%" stopColor="#1E1608"/>
      </linearGradient>
    </defs>
  </svg>
);

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

// ── Конфетти (победа) ──────────────────────────────────────────────────────────
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

// ── Панель игрока (по референсу) ──────────────────────────────────────────────
interface PanelProps {
  name: string;
  elo?: number;
  avatar?: string | null;
  isBot?: boolean;
  isWhite: boolean;
  captured: string[];
  advantage: number;
  coins: number;      // монеты за взятые фигуры
  timeDisplay: string;
  timeSecs: number;
  isActive: boolean;
  isGameOver: boolean;
}

const PlayerPanel: React.FC<PanelProps> = ({
  name, elo, avatar, isBot, isWhite, captured, advantage: adv,
  coins, timeDisplay, timeSecs, isActive, isGameOver,
}) => {
  const sorted = useMemo(() => sortCaptured(captured), [captured]);
  const isCritical = isActive && timeSecs > 0 && timeSecs < 15;
  const AV = 52;

  // Статус — показывается рядом с именем
  const statusLabel = isGameOver ? null : isActive ? 'Ваш ход' : null;
  const statusColor = '#4A9EFF';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      height: PANEL_H, padding: '0 12px', flexShrink: 0,
      background: isActive ? 'rgba(74,158,255,.04)' : 'transparent',
      borderLeft: `3px solid ${
        isCritical ? 'rgba(220,50,47,.85)'
        : isActive  ? '#4A9EFF'
        : 'transparent'
      }`,
      transition: 'background .3s, border-color .3s',
    }}>

      {/* Аватар */}
      <div style={{
        width: AV, height: AV, borderRadius: '50%', flexShrink: 0,
        background: isBot ? 'rgba(74,158,255,.1)' : 'rgba(212,168,67,.07)',
        border: `1.5px solid ${
          isActive
            ? isBot ? '#4A9EFF' : 'rgba(61,186,122,.5)'
            : isBot ? 'rgba(74,158,255,.15)' : 'rgba(212,168,67,.15)'
        }`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', position: 'relative',
        boxShadow: isActive
          ? `0 0 16px ${isBot ? 'rgba(74,158,255,.35)' : 'rgba(61,186,122,.28)'}`
          : 'none',
        transition: 'box-shadow .3s, border-color .3s',
      }}>
        {avatar
          ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : isBot
            ? <JarvisAva size={AV * 0.65} />
            : <span style={{ fontSize: AV * 0.4, fontWeight: 800, color: '#D4A843' }}>
                {name[0]?.toUpperCase() ?? '?'}
              </span>
        }
      </div>

      {/* Центр: имя + ELO + взятые фигуры */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>

        {/* Строка 1: цвет-маркер + имя + статус-точка + [монеты справа] */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 8, height: 8, borderRadius: 2.5, flexShrink: 0,
            background: isWhite ? '#E8E0C8' : '#2A2218',
            border: '.5px solid rgba(212,168,67,.25)',
          }} />
          <span style={{
            fontSize: '1.02rem', fontWeight: 700,
            color: isActive ? '#EAE2CC' : '#5A5248',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: 90, transition: 'color .3s',
          }}>
            {name.length > 11 ? name.slice(0, 11) + '…' : name}
          </span>
          {statusLabel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: statusColor, boxShadow: `0 0 5px ${statusColor}`,
                animation: 'gp-pulse 1.4s infinite',
              }} />
              <span style={{ fontSize: '.62rem', fontWeight: 700, color: statusColor }}>
                {statusLabel}
              </span>
            </div>
          )}
          {/* Монеты — прижаты вправо, в одной строке с именем */}
          {coins > 0 && (
            <div style={{
              marginLeft: 'auto', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 3,
              background: 'rgba(200,154,48,.1)', border: '.5px solid rgba(200,154,48,.25)',
              borderRadius: 8, padding: '2px 6px',
            }}>
              <CoinIcon size={12} />
              <span style={{ fontSize: '.72rem', fontWeight: 800, color: '#D4A843' }}>
                +{coins >= 1000 ? `${(coins/1000).toFixed(1)}K` : coins}
              </span>
            </div>
          )}
        </div>

        {/* Строка 2: ELO */}
        <div style={{ fontSize: '.68rem', color: '#5A5248', fontWeight: 600 }}>
          {elo !== undefined ? `ELO ${elo}` : (isBot ? 'J.A.R.V.I.S' : '')}
        </div>

        {/* Строка 3: взятые фигуры + преимущество */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, minHeight: 14 }}>
          {sorted.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                {sorted.slice(0, 10).map((p, i) => (
                  <span key={i} style={{ fontSize: 12, lineHeight: 1, opacity: .82, marginLeft: i > 0 ? -1 : 0 }}>
                    {PIECE_SYMBOLS[p] ?? ''}
                  </span>
                ))}
                {sorted.length > 10 && (
                  <span style={{ fontSize: '.5rem', color: '#6A5A40', fontWeight: 700, marginLeft: 1 }}>
                    +{sorted.length - 10}
                  </span>
                )}
              </div>
              {adv > 0 && (
                <span style={{ fontSize: '.65rem', fontWeight: 800, color: '#3DBA7A', marginLeft: 2 }}>
                  +{adv}
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: '.52rem', color: '#242018' }}>—</span>
          )}
        </div>
      </div>

      {/* Таймер — крупнее, с отступом от правого края */}
      <div style={{
        background: isCritical
          ? 'rgba(220,50,47,.22)'
          : isActive
            ? 'rgba(74,158,255,.14)'
            : 'rgba(255,255,255,.04)',
        border: `.5px solid ${
          isCritical ? 'rgba(220,50,47,.55)'
          : isActive  ? 'rgba(74,158,255,.38)'
          : 'rgba(255,255,255,.06)'
        }`,
        borderRadius: 12, padding: '7px 16px', flexShrink: 0,
        minWidth: 70, textAlign: 'center', marginRight: 4,
        transition: 'all .3s',
        animation: isCritical ? 'timer-crit .75s infinite' : 'none',
      }}>
        <div style={{
          fontSize: '1.18rem', fontWeight: 900,
          color: isCritical ? '#FF6868' : isActive ? '#82CFFF' : '#282420',
          fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em',
          transition: 'color .3s',
        }}>
          {timeDisplay}
        </div>
      </div>
    </div>
  );
};

// ── Иконки кнопок панели действий ────────────────────────────────────────────
const IcoHome = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M3 9.5L12 3l9 6.5V21a1 1 0 01-1 1H15v-6h-6v6H4a1 1 0 01-1-1V9.5z"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IcoHandshake = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M7 11l3-3 2 2 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 16l4-4 2 2 4-4 2 2 2-2 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".5"/>
    <path d="M6 17c1.5 1.5 4 2 6 1l4-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M18 17c-1.5 1.5-4 2-6 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".7"/>
  </svg>
);

const IcoFlag = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M5 21V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M5 4h10l-2 5h3l-3 6H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ── Результирующий bottom sheet ────────────────────────────────────────────────
type ResultType = 'win' | 'lose' | 'draw';

const RESULT_CFG: Record<ResultType, { bg: string; accent: string; emoji: string; title: string }> = {
  win:  { bg: 'linear-gradient(150deg,#082B14,#145228)',  accent: '#5DEDA0', emoji: '🏆', title: 'Победа!' },
  lose: { bg: 'linear-gradient(150deg,#111111,#1C1C1C)',  accent: '#888',    emoji: '💀', title: 'Поражение' },
  draw: { bg: 'linear-gradient(150deg,#080E2E,#101E46)',  accent: '#82CFFF', emoji: '🤝', title: 'Ничья' },
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
      <div
        style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.62)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        onClick={onHome}
      />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: '#0E1015', borderRadius: '22px 22px 0 0', overflow: 'hidden',
        animation: 'sheet-up .38s cubic-bezier(.2,.85,.3,1.05) both',
        boxShadow: '0 -8px 40px rgba(0,0,0,.6)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.12)', margin: '10px auto 0' }} />

        <div style={{ background: cfg.bg, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
          <span style={{ fontSize: 34, lineHeight: 1, flexShrink: 0 }}>{cfg.emoji}</span>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: cfg.accent, letterSpacing: '-.01em' }}>{cfg.title}</div>
            {coinsDisplay && (
              <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#F4C430', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                <CoinIcon size={14} />
                <span>+{coinsDisplay} зачислено на баланс</span>
              </div>
            )}
            {!coinsDisplay && type === 'lose' && (
              <div style={{ fontSize: '.72rem', color: '#4A4840', marginTop: 3 }}>Попробуй ещё раз</div>
            )}
          </div>
        </div>

        <div style={{ padding: '14px 16px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onRematch} style={{
              flex: 1, padding: '13px 0', borderRadius: 14,
              background: isWin ? 'rgba(61,186,122,.14)' : 'rgba(255,255,255,.06)',
              border: `.5px solid ${isWin ? 'rgba(61,186,122,.32)' : 'rgba(255,255,255,.1)'}`,
              color: isWin ? '#5DEDA0' : '#8A8270', fontSize: '.8rem', fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>🔄 <span>Реванш</span></button>
            <button disabled style={{
              flex: 1, padding: '13px 0', borderRadius: 14,
              background: 'rgba(255,255,255,.04)', border: '.5px solid rgba(255,255,255,.07)',
              color: '#404040', fontSize: '.8rem', fontWeight: 800,
              cursor: 'default', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: 0.5,
            }}>📋 <span>Анализ</span></button>
          </div>
          <button onClick={onHome} style={{
            width: '100%', padding: '15px 0', borderRadius: 14,
            background: 'linear-gradient(135deg,#2A1E08,#4A3810)',
            border: '.5px solid rgba(212,168,67,.42)', color: '#F0C85A',
            fontSize: '.9rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 22px rgba(212,168,67,.15)',
          }}>← На главную</button>
        </div>
      </div>
    </>
  );
};

// ── Основной компонент ─────────────────────────────────────────────────────────
export function GamePage() {
  const navigate = useNavigate();
  const { sessionId = '' } = useParams<{ sessionId: string }>();

  const { sessions, drawOfferedBy } = useGameStore();
  const session = sessions.find(s => s.id === sessionId) ?? null;

  const [lastMove,       setLastMove]       = useState<{ from: string; to: string } | null>(null);
  const [myTimeDisplay,  setMyTimeDisplay]  = useState('—');
  const [oppTimeDisplay, setOppTimeDisplay] = useState('—');
  const [myTimeSecs,     setMyTimeSecs]     = useState(0);
  const [oppTimeSecs,    setOppTimeSecs]    = useState(0);
  const [soundPlayed,    setSoundPlayed]    = useState(false);

  const mySecsRef   = useRef(0);
  const oppSecsRef  = useRef(0);
  const isMyTurnRef = useRef(false);
  const gameOverRef = useRef(false);

  const isMyTurn = !!(session?.isMyTurn);
  const gameOver = !!session
    && session.status !== 'IN_PROGRESS'
    && session.status !== 'WAITING_FOR_OPPONENT';

  useEffect(() => { isMyTurnRef.current = isMyTurn; },  [isMyTurn]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);

  // Звук конца игры
  useEffect(() => {
    if (!gameOver || soundPlayed || !session) return;
    setSoundPlayed(true);
    const isWin = session.winnerSideId === session.mySideId;
    const isDraw = !session.winnerSideId || session.status === 'DRAW';
    if (!isDraw) setTimeout(() => isWin ? sound.win() : sound.lose(), 200);
  }, [gameOver, soundPlayed, session]);

  // Синхронизируем таймеры при новом FEN
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

  // Тик таймера
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

  // Данные сессии
  const mySide   = session?.sides.find(s => s.id === session?.mySideId);
  const oppSide  = session?.sides.find(s => s.id !== session?.mySideId);

  const myColor: 'white' | 'black' = mySide?.isWhite ? 'white' : 'black';
  const myName   = mySide?.player?.firstName ?? 'Вы';
  const myAvatar = mySide?.player?.avatar;
  const myElo    = mySide?.player?.elo;

  const oppIsBot   = !!oppSide?.isBot;
  const oppName    = oppIsBot ? 'J.A.R.V.I.S' : (oppSide?.player?.firstName ?? '...');
  const oppAvatar  = oppSide?.player?.avatar;
  const oppIsWhite = !!oppSide?.isWhite;
  const oppElo     = oppSide?.player?.elo;

  const fen = session?.fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const { white: whiteCap, black: blackCap } = capturedFromFen(fen);

  const wMat = calcMaterial(whiteCap);
  const bMat = calcMaterial(blackCap);
  const myCaptured  = myColor === 'white' ? whiteCap : blackCap;
  const oppCaptured = myColor === 'white' ? blackCap : whiteCap;
  const myAdv  = myColor === 'white' ? Math.max(0, wMat - bMat) : Math.max(0, bMat - wMat);
  const oppAdv = myColor === 'white' ? Math.max(0, bMat - wMat) : Math.max(0, wMat - bMat);

  // Монеты за взятые фигуры
  const PIECE_COINS: Record<string, number> = { p: 100, n: 300, b: 300, r: 500, q: 900 };
  const myCoins  = myCaptured.reduce((s, p) => s + (PIECE_COINS[p] ?? 0), 0);
  const oppCoins = oppCaptured.reduce((s, p) => s + (PIECE_COINS[p] ?? 0), 0);

  // Результат
  const resultType: ResultType | null = !gameOver ? null
    : !session?.winnerSideId || session.status === 'DRAW' ? 'draw'
    : session.winnerSideId === session.mySideId ? 'win'
    : 'lose';

  // Ничья от соперника
  const drawOfferedByOpp = drawOfferedBy && drawOfferedBy !== session?.mySideId;
  const drawOfferedByMe  = drawOfferedBy === session?.mySideId;

  // Ход игрока
  const currentFenRef = useRef(fen);
  useEffect(() => { currentFenRef.current = fen; }, [fen]);

  const handleMove = useCallback((from: Square, to: Square, promotion?: string) => {
    const prevFen = currentFenRef.current;
    setLastMove({ from, to });
    getSocket().emit('game:move', { sessionId, from, to, promotion: promotion ?? 'q' },
      (res: Record<string, unknown>) => {
        if (!res?.ok) { setLastMove(null); currentFenRef.current = prevFen; }
      }
    );
  }, [sessionId]);

  const handleSurrender = useCallback(() => {
    if (gameOver) return;
    if (!window.confirm('Сдаться и завершить игру?')) return;
    getSocket().emit('game:surrender', { sessionId }, () => {});
  }, [sessionId, gameOver]);

  const handleDrawOffer = useCallback(() => {
    if (gameOver || drawOfferedByMe) return;
    if (drawOfferedByOpp) {
      getSocket().emit('game:accept_draw', { sessionId }, () => {});
    } else {
      getSocket().emit('game:offer_draw', { sessionId });
    }
  }, [sessionId, gameOver, drawOfferedByMe, drawOfferedByOpp]);

  const handleDeclineDraw = useCallback(() => {
    getSocket().emit('game:decline_draw', { sessionId });
  }, [sessionId]);

  // ── Загрузка ────────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0B0D11', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
        <style>{`@keyframes gp-spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2.5px solid rgba(74,158,255,.18)', borderTopColor: '#4A9EFF', animation: 'gp-spin 1s linear infinite', margin: '0 auto 14px' }} />
          <div style={{ fontSize: '.72rem', color: '#3A4050', fontWeight: 700 }}>Загрузка партии...</div>
          <button onClick={() => navigate('/')} style={{ marginTop: 20, padding: '7px 18px', borderRadius: 10, background: 'rgba(255,255,255,.06)', border: '.5px solid rgba(255,255,255,.1)', color: '#4A5060', fontSize: '.7rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Назад</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0B0D11', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <style>{`
        @keyframes gp-spin   { to { transform: rotate(360deg) } }
        @keyframes gp-pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.7)} }
        @keyframes timer-crit{ 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes sheet-up  { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes cf-fall   { 0%{transform:translateY(0) rotate(0deg);opacity:1} 80%{opacity:.9} 100%{transform:translateY(320px) rotate(600deg);opacity:0} }
        @keyframes draw-in   { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ── Предложение ничьи от соперника ─────────────────────────────────── */}
      {drawOfferedByOpp && !gameOver && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 12px',
          background: 'rgba(130,207,255,.08)',
          borderBottom: '.5px solid rgba(130,207,255,.2)',
          animation: 'draw-in .3s ease both',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '.7rem', fontWeight: 700, color: '#82CFFF' }}>🤝 Соперник предлагает ничью</span>
          <div style={{ display: 'flex', gap: 7 }}>
            <button onClick={handleDrawOffer} style={{ padding: '4px 11px', borderRadius: 8, background: 'rgba(130,207,255,.15)', border: '.5px solid rgba(130,207,255,.4)', color: '#82CFFF', fontSize: '.66rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Принять</button>
            <button onClick={handleDeclineDraw} style={{ padding: '4px 11px', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '.5px solid rgba(255,255,255,.1)', color: '#5A5850', fontSize: '.66rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Отказать</button>
          </div>
        </div>
      )}

      {/* ── Соперник (сверху) ──────────────────────────────────────────────── */}
      <div style={{ borderBottom: '.5px solid rgba(255,255,255,.05)', flexShrink: 0, paddingTop: PANEL_GAP_TOP }}>
        <PlayerPanel
          name={oppName} elo={oppElo} avatar={oppAvatar} isBot={oppIsBot}
          isWhite={oppIsWhite} captured={oppCaptured} advantage={oppAdv} coins={oppCoins}
          timeDisplay={oppTimeDisplay} timeSecs={oppTimeSecs}
          isActive={!isMyTurn && !gameOver} isGameOver={gameOver}
        />
      </div>

      {/* ── Доска ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
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
      <div style={{ borderTop: '.5px solid rgba(255,255,255,.05)', flexShrink: 0, paddingBottom: PANEL_GAP_BOT }}>
        <PlayerPanel
          name={myName} elo={myElo} avatar={myAvatar} isBot={false}
          isWhite={myColor === 'white'} captured={myCaptured} advantage={myAdv} coins={myCoins}
          timeDisplay={myTimeDisplay} timeSecs={myTimeSecs}
          isActive={isMyTurn && !gameOver} isGameOver={gameOver}
        />
      </div>

      {/* ── Панель действий: 3 большие кнопки ─────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        height: ACTBAR_H,
        paddingBottom: 'max(0px, env(safe-area-inset-bottom, 0px))',
        borderTop: '.5px solid rgba(255,255,255,.06)',
        flexShrink: 0, background: 'rgba(0,0,0,.2)',
        gap: 1,
      }}>
        {/* Главная */}
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4, background: 'rgba(255,255,255,.04)', border: 'none',
            color: '#5A6070', cursor: 'pointer', fontFamily: 'inherit',
            transition: 'background .15s',
          }}
        >
          <IcoHome />
          <span style={{ fontSize: '.6rem', fontWeight: 700, letterSpacing: '.04em' }}>Главная</span>
        </button>

        {/* Ничья */}
        <button
          onClick={handleDrawOffer}
          disabled={gameOver || drawOfferedByMe}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4,
            background: drawOfferedByOpp ? 'rgba(130,207,255,.1)' : 'rgba(255,255,255,.04)',
            border: 'none',
            color: drawOfferedByOpp ? '#82CFFF' : drawOfferedByMe ? '#2A2A30' : '#5A6070',
            cursor: gameOver || drawOfferedByMe ? 'default' : 'pointer',
            fontFamily: 'inherit',
            opacity: drawOfferedByMe ? 0.4 : 1,
            transition: 'background .15s',
          }}
        >
          <IcoHandshake />
          <span style={{ fontSize: '.6rem', fontWeight: 700, letterSpacing: '.04em' }}>
            {drawOfferedByOpp ? 'Принять =' : drawOfferedByMe ? 'Ждём...' : 'Ничья'}
          </span>
        </button>

        {/* Сдаться */}
        <button
          onClick={handleSurrender}
          disabled={gameOver}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4,
            background: gameOver ? 'rgba(255,255,255,.03)' : 'rgba(220,50,47,.07)',
            border: 'none',
            color: gameOver ? '#2A2420' : '#CC5555',
            cursor: gameOver ? 'default' : 'pointer',
            fontFamily: 'inherit', transition: 'background .15s',
          }}
        >
          <IcoFlag />
          <span style={{ fontSize: '.6rem', fontWeight: 700, letterSpacing: '.04em' }}>Сдаться</span>
        </button>
      </div>

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
