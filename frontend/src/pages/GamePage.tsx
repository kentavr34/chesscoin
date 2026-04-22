// frontend/src/pages/GamePage.tsx
// АРХИТЕКТУРА: useSocket.ts (App уровень) слушает 'game' события → store.
// GamePage читает из store. Для ходов/сдачи/ничьи: socket.emit(...).

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { getSocket } from '@/api/socket';
import { api } from '@/api/client';
import { useGameStore } from '@/store/useGameStore';
import { ChessBoard } from '@/components/game/ChessBoard';
import { sound } from '@/lib/sound';
import { fmtBalance } from '@/utils/format';

// ── Константы ──────────────────────────────────────────────────────────────────
const PIECE_SYMBOLS: Record<string, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };
const PIECE_VAL:     Record<string, number>  = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_START:   Record<string, number>  = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const SORT_ORDER:    Record<string, number>  = { q: 0, r: 1, b: 2, n: 3, p: 4 };

const PANEL_H   = 72;  // высота панели игрока
const ACTBAR_H  = 64;  // нижняя панель кнопок
const STATUS_GAP = 28; // полоска между панелью и доской — «Ваш ход» / «Думает...»

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
  // Панели + статус-полоски + action bar + минимальные spacer-ы (8px сверху/снизу)
  const reserved = PANEL_H * 2 + STATUS_GAP * 2 + ACTBAR_H + 16;
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

// ── Иконка цвета фигур прямо на доске ────────────────────────────────────────
const BoardKingIcon: React.FC<{ isWhite: boolean; size?: number }> = ({ isWhite, size = 22 }) => (
  <div style={{
    width: size, height: size, borderRadius: 5, flexShrink: 0,
    background: isWhite ? 'rgba(240,200,90,.18)' : 'rgba(74,158,255,.15)',
    border: `.5px solid ${isWhite ? 'rgba(240,200,90,.5)' : 'rgba(74,158,255,.4)'}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <svg width={size * 0.68} height={size * 0.68} viewBox="0 0 18 18" fill="none">
      <path d="M9 2v3M7.5 3.5h3" stroke={isWhite ? '#F0C85A' : '#82CFFF'} strokeWidth="1.3" strokeLinecap="round"/>
      <rect x="7" y="5" width="4" height="2" rx=".5" fill={isWhite ? '#F0C85A' : '#82CFFF'} opacity=".8"/>
      <path d="M5.5 7h7l-1 8H6.5L5.5 7z" fill={isWhite ? '#F0C85A' : '#82CFFF'} opacity={isWhite ? '.7' : '.9'}/>
      <path d="M4 15h10" stroke={isWhite ? '#F0C85A' : '#82CFFF'} strokeWidth="1.3" strokeLinecap="round"/>
      {!isWhite && <rect x="5" y="6.5" width="8" height="9" rx="1" fill="#82CFFF" opacity=".15"/>}
    </svg>
  </div>
);

// Флаг страны: 'RU' → '🇷🇺', иначе null
const flagEmoji = (code?: string | null): string | null => {
  if (!code || code.length !== 2) return null;
  const a = code.toUpperCase().charCodeAt(0) + 0x1F1A5;
  const b = code.toUpperCase().charCodeAt(1) + 0x1F1A5;
  return String.fromCodePoint(a, b);
};

// ── Панель игрока (по референсу) ──────────────────────────────────────────────
interface PanelProps {
  name: string;
  elo?: number;
  avatar?: string | null;
  isBot?: boolean;
  isWhite: boolean;
  country?: string | null;
  captured: string[];
  advantage: number;
  coins: number;      // монеты за взятые фигуры
  timeDisplay: string;
  timeSecs: number;
  isActive: boolean;
  isGameOver: boolean;
}

const PlayerPanel: React.FC<PanelProps> = ({
  name, elo, avatar, isBot, isWhite, country, captured, advantage: adv,
  coins, timeDisplay, timeSecs, isActive, isGameOver,
}) => {
  const sorted = useMemo(() => sortCaptured(captured), [captured]);
  const isCritical = isActive && timeSecs > 0 && timeSecs < 15;
  const AV = 52;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      height: PANEL_H, padding: '0 10px 0 22px', flexShrink: 0,
      background: isActive ? 'rgba(74,158,255,.03)' : 'transparent',
      borderLeft: `3px solid ${
        isCritical ? 'rgba(220,50,47,.85)'
        : isActive  ? '#4A9EFF'
        : 'transparent'
      }`,
      transition: 'background .3s, border-color .3s',
    }}>

      {/* ── Аватар ─────────────────────────────────────────────────────────── */}
      <div style={{
        width: AV, height: AV, borderRadius: '50%', flexShrink: 0,
        background: isBot ? 'rgba(74,158,255,.1)' : 'rgba(212,168,67,.07)',
        border: `1.5px solid ${
          isActive
            ? isBot ? '#4A9EFF' : 'rgba(61,186,122,.5)'
            : isBot ? 'rgba(74,158,255,.15)' : 'rgba(212,168,67,.15)'
        }`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: isActive
          ? `0 0 14px ${isBot ? 'rgba(74,158,255,.3)' : 'rgba(61,186,122,.25)'}`
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

      {/* ── Колонка: имя + флаг/глобус + ELO ───────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            fontSize: '1rem', fontWeight: 700, lineHeight: 1,
            color: isActive ? '#EAE2CC' : '#9A9490',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: 80, transition: 'color .3s',
          }}>
            {name.length > 10 ? name.slice(0, 10) + '…' : name}
          </span>
          {/* Флаг страны или глобус */}
          <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
            {flagEmoji(country) ?? '🌐'}
          </span>
        </div>
        <span style={{ fontSize: '.68rem', color: '#5A5248', fontWeight: 600, lineHeight: 1 }}>
          {elo !== undefined ? `ELO ${elo}` : (isBot ? 'J.A.R.V.I.S' : '')}
        </span>
      </div>

      {/* ── Центр: монеты (строка 1) + взятые фигуры (строка 2) ─────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, minWidth: 0 }}>
        {/* Строка 1: монеты */}
        {coins > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <CoinIcon size={13} />
            <span style={{ fontSize: '.76rem', fontWeight: 800, color: '#D4A843' }}>
              +{coins >= 1000 ? `${(coins/1000).toFixed(1)}K` : coins}
            </span>
          </div>
        ) : (
          <div style={{ height: 16 }} />
        )}
        {/* Строка 2: взятые фигуры + преимущество */}
        {sorted.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {sorted.slice(0, 8).map((p, i) => (
              <span key={i} style={{ fontSize: 12, lineHeight: 1, opacity: .82 }}>
                {PIECE_SYMBOLS[p] ?? ''}
              </span>
            ))}
            {sorted.length > 8 && (
              <span style={{ fontSize: '.5rem', color: '#6A5A40', fontWeight: 700 }}>+{sorted.length - 8}</span>
            )}
            {adv > 0 && (
              <span style={{ fontSize: '.65rem', fontWeight: 800, color: '#3DBA7A', marginLeft: 3 }}>+{adv}</span>
            )}
          </div>
        ) : (
          <div style={{ height: 14 }} />
        )}
      </div>

      {/* ── Таймер ────────────────────────────────────────────────────────── */}
      <div style={{
        background: isCritical
          ? 'rgba(220,50,47,.22)'
          : isActive ? 'rgba(212,168,67,.14)' : 'rgba(255,255,255,.06)',
        border: `1px solid ${
          isCritical ? 'rgba(220,50,47,.65)'
          : isActive  ? 'rgba(212,168,67,.5)' : 'rgba(255,255,255,.14)'
        }`,
        borderRadius: 6, padding: '7px 15px', flexShrink: 0,
        minWidth: 72, textAlign: 'center', marginRight: 2,
        transition: 'all .3s',
        animation: isCritical ? 'timer-crit .75s infinite' : 'none',
        boxShadow: isActive && !isCritical ? '0 0 8px rgba(212,168,67,.18)' : 'none',
      }}>
        <div style={{
          fontSize: '1.42rem', fontWeight: 900,
          color: isCritical ? '#FF6868' : isActive ? '#D4A843' : '#6A6258',
          fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em',
          fontFamily: "'JetBrains Mono', monospace",
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

const IcoStarBtn = ({ filled }: { filled: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      fill={filled ? '#F5C842' : 'none'}
      stroke={filled ? '#F5C842' : 'currentColor'}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
);

// ── Результирующий bottom sheet ────────────────────────────────────────────────
type ResultType = 'win' | 'lose' | 'draw';

const RESULT_CFG: Record<ResultType, { accent: string; title: string }> = {
  win:  { accent: '#5DEDA0', title: 'Победа!' },
  lose: { accent: '#CC6060', title: 'Поражение' },
  draw: { accent: '#82CFFF', title: 'Ничья' },
};

interface SheetProps {
  type: ResultType;
  winAmount?: string | null;
  pieceCoins?: string | null;
  onRematch: () => void;
  onHome: () => void;
}

const IcoTrophy = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <path d="M14 8h20v16a10 10 0 01-20 0V8z" stroke="#5DEDA0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 14H8a4 4 0 004 4h2M34 14h6a4 4 0 01-4 4h-2" stroke="#5DEDA0" strokeWidth="2" strokeLinecap="round"/>
    <path d="M24 34v6M16 40h16" stroke="#5DEDA0" strokeWidth="2" strokeLinecap="round"/>
    <path d="M19 40h10" stroke="#3DBA7A" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

const IcoSkull = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <path d="M24 8C15.163 8 8 15.163 8 24c0 5.2 2.5 9.8 6.3 12.7V40h19.4v-3.3C37.5 33.8 40 29.2 40 24c0-8.837-7.163-16-16-16z" stroke="#CC6060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="18" cy="23" r="3" fill="#CC6060" opacity=".8"/>
    <circle cx="30" cy="23" r="3" fill="#CC6060" opacity=".8"/>
    <path d="M20 34v-4M24 34v-4M28 34v-4" stroke="#CC6060" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

const IcoDraw = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <path d="M10 28c3 4 8 6 14 6s11-2 14-6" stroke="#82CFFF" strokeWidth="2" strokeLinecap="round"/>
    <path d="M10 20c3-4 8-6 14-6s11 2 14 6" stroke="#82CFFF" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="24" cy="24" r="3" fill="#82CFFF" opacity=".8"/>
    <path d="M8 24h10M30 24h10" stroke="#82CFFF" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const ResultSheet: React.FC<SheetProps> = ({ type, winAmount, pieceCoins, onRematch, onHome }) => {
  const cfg = RESULT_CFG[type];
  const isWin  = type === 'win';
  const isDraw = type === 'draw';
  const coinsDisplay = isWin ? (winAmount ?? pieceCoins) : null;

  const overlayBg  = isWin
    ? 'linear-gradient(160deg,rgba(5,26,12,.97),rgba(8,40,20,.97))'
    : isDraw
    ? 'linear-gradient(160deg,rgba(6,12,30,.97),rgba(8,16,42,.97))'
    : 'linear-gradient(160deg,rgba(14,6,6,.97),rgba(22,8,8,.97))';

  const borderCol  = isWin
    ? 'rgba(93,237,160,.22)'
    : isDraw
    ? 'rgba(130,207,255,.22)'
    : 'rgba(204,96,96,.18)';

  const glowCol    = isWin
    ? 'rgba(93,237,160,.18)'
    : isDraw
    ? 'rgba(130,207,255,.14)'
    : 'rgba(204,96,96,.12)';

  const circleBg   = isWin
    ? 'rgba(93,237,160,.1)'
    : isDraw
    ? 'rgba(130,207,255,.1)'
    : 'rgba(204,96,96,.08)';

  return (
    <>
      {isWin && <Confetti />}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,.75)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 20px',
      }}>
        <div style={{
          width: '100%', maxWidth: 340,
          background: overlayBg,
          border: `1px solid ${borderCol}`,
          borderRadius: 28,
          padding: '40px 24px 28px',
          boxShadow: `0 0 80px ${glowCol}, 0 24px 60px rgba(0,0,0,.7)`,
          animation: 'result-pop .42s cubic-bezier(.2,.9,.3,1.05) both',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center',
        }}>
          {/* Иконка */}
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            background: circleBg,
            border: `1.5px solid ${borderCol}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
            boxShadow: `0 0 40px ${glowCol}`,
          }}>
            {isWin ? <IcoTrophy /> : isDraw ? <IcoDraw /> : <IcoSkull />}
          </div>

          {/* Заголовок */}
          <div style={{
            fontSize: '2rem', fontWeight: 900,
            color: cfg.accent,
            letterSpacing: '-.02em',
            marginBottom: 10,
            lineHeight: 1,
          }}>
            {cfg.title}
          </div>

          {/* Монеты */}
          {coinsDisplay && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 28 }}>
              <CoinIcon size={20} />
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F4C430' }}>
                +{coinsDisplay}
              </span>
            </div>
          )}
          {!coinsDisplay && type === 'lose' && (
            <div style={{ fontSize: '.78rem', color: '#5A3A3A', marginBottom: 28 }}>
              Не сдавайся — следующая будет лучше
            </div>
          )}
          {isDraw && (
            <div style={{ fontSize: '.78rem', color: '#3A5070', marginBottom: 28 }}>
              Соперники оказались равны
            </div>
          )}
          {isWin && !coinsDisplay && (
            <div style={{ height: 28 }} />
          )}

          {/* Кнопки */}
          <div style={{ display: 'flex', gap: 10, width: '100%', marginBottom: 10 }}>
            <button onClick={onRematch} style={{
              flex: 1, padding: '14px 0', borderRadius: 14,
              background: isWin ? 'rgba(93,237,160,.12)' : 'rgba(255,255,255,.05)',
              border: `.5px solid ${isWin ? 'rgba(93,237,160,.3)' : 'rgba(255,255,255,.1)'}`,
              color: isWin ? '#5DEDA0' : '#6A7080',
              fontSize: '.82rem', fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20.5 9A9 9 0 005.3 5.3L1 10M23 14l-4.2 4.7A9 9 0 013.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Реванш
            </button>
            <button disabled style={{
              flex: 1, padding: '14px 0', borderRadius: 14,
              background: 'rgba(255,255,255,.03)', border: '.5px solid rgba(255,255,255,.06)',
              color: '#303440', fontSize: '.82rem', fontWeight: 800,
              cursor: 'default', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.5,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Анализ
            </button>
          </div>
          <button onClick={onHome} style={{
            width: '100%', padding: '16px 0', borderRadius: 14,
            background: 'linear-gradient(135deg,#2A1E08,#4A3810)',
            border: '.5px solid rgba(212,168,67,.42)',
            color: '#F0C85A',
            fontSize: '.9rem', fontWeight: 900,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 22px rgba(212,168,67,.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 9.5L12 3l9 6.5V21a1 1 0 01-1 1H15v-6h-6v6H4a1 1 0 01-1-1V9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            На главную
          </button>
        </div>
      </div>
    </>
  );
};

// ── Универсальный диалог (ничья, сдача, подтверждения) ─────────────────────────
interface DialogProps {
  iconNode: React.ReactNode;
  iconBg: string;
  iconBorder: string;
  title: string;
  subtitle?: string;
  primaryLabel: string;
  primaryDanger?: boolean;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
}

const GameDialog: React.FC<DialogProps> = ({
  iconNode, iconBg, iconBorder, title, subtitle,
  primaryLabel, primaryDanger, secondaryLabel,
  onPrimary, onSecondary,
}) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 210,
    background: 'rgba(0,0,0,.82)',
    backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px 20px',
  }}>
    <div style={{
      width: '100%', maxWidth: 320,
      background: 'linear-gradient(160deg,#12151E,#0E111A)',
      border: '1px solid rgba(255,255,255,.09)',
      borderRadius: 28,
      padding: '36px 24px 24px',
      boxShadow: '0 24px 60px rgba(0,0,0,.75)',
      animation: 'result-pop .35s cubic-bezier(.2,.9,.3,1.05) both',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: iconBg, border: `1.5px solid ${iconBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        {iconNode}
      </div>
      <div style={{
        fontSize: '1.28rem', fontWeight: 900,
        color: '#EAE2CC', letterSpacing: '-.02em',
        marginBottom: subtitle ? 8 : 28, lineHeight: 1.15,
      }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: '.77rem', color: '#484855', lineHeight: 1.5, marginBottom: 28 }}>
          {subtitle}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, width: '100%' }}>
        {secondaryLabel && (
          <button onClick={onSecondary} style={{
            flex: 1, padding: '14px 0', borderRadius: 14,
            background: 'rgba(255,255,255,.05)', border: '.5px solid rgba(255,255,255,.09)',
            color: '#6A6A78', fontSize: '.82rem', fontWeight: 800,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{secondaryLabel}</button>
        )}
        <button onClick={onPrimary} style={{
          flex: 1, padding: '14px 0', borderRadius: 14,
          background: primaryDanger ? 'rgba(204,96,96,.14)' : 'rgba(130,207,255,.11)',
          border: `.5px solid ${primaryDanger ? 'rgba(204,96,96,.38)' : 'rgba(130,207,255,.32)'}`,
          color: primaryDanger ? '#CC6060' : '#82CFFF',
          fontSize: '.82rem', fontWeight: 800,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>{primaryLabel}</button>
      </div>
    </div>
  </div>
);

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
  const [isSaved,           setIsSaved]           = useState(false);
  const [isSaving,          setIsSaving]          = useState(false);
  const [showResignDialog,  setShowResignDialog]  = useState(false);
  const [donatePool,        setDonatePool]        = useState<string | null>(null);
  const [spectatorCount,    setSpectatorCount]    = useState(session?.spectatorCount ?? 0);
  const [selectedDonateAmt, setSelectedDonateAmt] = useState(1000);

  const mySecsRef   = useRef(0);
  const oppSecsRef  = useRef(0);
  const isMyTurnRef = useRef(false);
  const gameOverRef = useRef(false);

  const isMyTurn = !!(session?.isMyTurn);
  const gameOver = !!session
    && session.status !== 'IN_PROGRESS'
    && session.status !== 'WAITING_FOR_OPPONENT';

  const isBattle        = session?.type === 'BATTLE';
  const isSpectator     = isBattle && !session?.mySideId;
  const hasBet          = isBattle && session?.bet && BigInt(session.bet) > 0n;
  const isPrivateBattle = isBattle && !!session?.isPrivate;
  const isPublicBattle  = isBattle && !session?.isPrivate;

  // ── Касса: ставки обоих игроков + донаты зрителей ─────────────────────────
  // СИНХРОНИЗАЦИЯ С backend/src/services/game/finish.ts:
  //   • комиссия 10% берётся ТОЛЬКО со ставок (totalPot = bet*2)
  //   • донаты зрителей целиком уходят победителю (без комиссии)
  //   • ничья: каждому возвращается его ставка, донаты распределяются по правилам бэка
  const betBig         = session?.bet ? BigInt(session.bet) : 0n;
  const totalBetPot    = betBig * 2n;
  const donationsBig   = donatePool ? BigInt(donatePool) : 0n;
  const bank           = totalBetPot + donationsBig;        // вся касса (для отображения)
  const BANK_COMMISSION_PCT = 10n;                          // комиссия стола
  const bankCommission = (totalBetPot * BANK_COMMISSION_PCT) / 100n; // 10% со ставок
  const winnerTake     = totalBetPot - bankCommission + donationsBig; // ставки-10% + донаты 100%
  // viewCount — накопительный счётчик просмотров (backend: sessions.viewCount, опционально)
  const viewCount      = session?.viewCount ?? 0;

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

  // battle:donated listener + spectate emit
  useEffect(() => {
    if (!isBattle) return;
    const sock = getSocket();

    const onDonated = (data: { totalPool: string; amount: string }) => {
      setDonatePool(data.totalPool);
      window.dispatchEvent(new CustomEvent('chesscoin:toast', {
        detail: { text: `🎁 +${fmtBalance(data.amount)} ᚙ доната`, type: 'info' }
      }));
    };
    sock.on('battle:donated', onDonated);

    if (isSpectator) {
      sock.emit('spectate', { sessionId });
    }

    return () => {
      sock.off('battle:donated', onDonated);
      if (isSpectator) {
        sock.emit('unspectate', { sessionId });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBattle, isSpectator, sessionId]);

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
  const myName    = mySide?.player?.firstName ?? 'Вы';
  const myAvatar  = mySide?.player?.avatar;
  const myElo     = mySide?.player?.elo;
  const myCountry = mySide?.player?.country;

  const oppIsBot    = !!oppSide?.isBot;
  const oppName     = oppIsBot ? 'J.A.R.V.I.S' : (oppSide?.player?.firstName ?? '...');
  const oppAvatar   = oppSide?.player?.avatar;
  const oppIsWhite  = !!oppSide?.isWhite;
  const oppElo      = oppSide?.player?.elo;
  const oppCountry  = oppSide?.player?.country;

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
    setShowResignDialog(true);
  }, [gameOver]);

  const handleResignConfirm = useCallback(() => {
    setShowResignDialog(false);
    getSocket().emit('game:surrender', { sessionId }, () => {});
  }, [sessionId]);

  const handleDrawOffer = useCallback(() => {
    if (gameOver || drawOfferedByMe) return;
    if (drawOfferedByOpp) {
      getSocket().emit('game:accept_draw', { sessionId }, () => {});
    } else {
      getSocket().emit('game:offer_draw', { sessionId });
      window.dispatchEvent(new CustomEvent('chesscoin:toast', {
        detail: { text: 'Предложение ничьи отправлено', type: 'info' }
      }));
    }
  }, [sessionId, gameOver, drawOfferedByMe, drawOfferedByOpp]);

  // Тост когда соперник отклонил ничью
  const prevDrawOffMeRef = useRef(false);
  useEffect(() => {
    if (prevDrawOffMeRef.current && !drawOfferedByMe && !gameOver) {
      window.dispatchEvent(new CustomEvent('chesscoin:toast', {
        detail: { text: 'Соперник отклонил предложение ничьи', type: 'info' }
      }));
    }
    prevDrawOffMeRef.current = drawOfferedByMe;
  }, [drawOfferedByMe, gameOver]);

  const handleDeclineDraw = useCallback(() => {
    getSocket().emit('game:decline_draw', { sessionId });
  }, [sessionId]);

  // Сохранить / убрать партию
  useEffect(() => {
    if (!sessionId) return;
    api.get<{ saved: boolean }>(`/games/${sessionId}/saved`)
      .then(res => setIsSaved(res.saved))
      .catch(() => {});
  }, [sessionId]);

  const handleToggleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (isSaved) {
        await api.delete(`/games/${sessionId}/save`);
        setIsSaved(false);
      } else {
        await api.post(`/games/${sessionId}/save`, {});
        setIsSaved(true);
      }
    } catch { /* ignore */ } finally {
      setIsSaving(false);
    }
  }, [sessionId, isSaved, isSaving]);

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

  const opLabel = opSide?.isBot ? 'J.A.R.V.I.S' : (opSide?.player.firstName ?? '?');

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0B0D11', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <style>{`
        @keyframes gp-spin   { to { transform: rotate(360deg) } }
        @keyframes gp-pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.7)} }
        @keyframes timer-crit{ 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes sheet-up  { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes cf-fall   { 0%{transform:translateY(0) rotate(0deg);opacity:1} 80%{opacity:.9} 100%{transform:translateY(320px) rotate(600deg);opacity:0} }
        @keyframes draw-in   { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes result-pop{ from{opacity:0;transform:scale(.88)} to{opacity:1;transform:scale(1)} }
      `}</style>

      {/* ── Диалог предложения ничьи (только когда соперник предлагает) ──── */}
      {drawOfferedByOpp && !drawOfferedByMe && !gameOver && (
        <GameDialog
          iconNode={
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path d="M9 12c0 1.66 1.34 3 3 3s3-1.34 3-3V7H9v5z" stroke="#82CFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 9H6a1.5 1.5 0 000 3h3M15 9h3a1.5 1.5 0 010 3h-3" stroke="#82CFFF" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M12 15v3M10 20h4" stroke="#82CFFF" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          }
          iconBg="rgba(130,207,255,.09)"
          iconBorder="rgba(130,207,255,.25)"
          title="Предложение ничьи"
          subtitle="Соперник предлагает сыграть вничью"
          primaryLabel="Принять"
          secondaryLabel="Отклонить"
          onPrimary={handleDrawOffer}
          onSecondary={handleDeclineDraw}
        />
      )}

      {/* ── Верхний spacer — пустое пространство выравнивается между краем экрана и блоком ── */}
      <div style={{ flex: 1, minHeight: 6 }} />

      {/* ── Соперник (сверху, вплотную к доске) ───────────────────────────── */}
      <div style={{ borderBottom: '.5px solid rgba(255,255,255,.05)', flexShrink: 0 }}>
        <PlayerPanel
          name={oppName} elo={oppElo} avatar={oppAvatar} isBot={oppIsBot}
          isWhite={oppIsWhite} country={oppCountry} captured={oppCaptured} advantage={oppAdv} coins={oppCoins}
          timeDisplay={oppTimeDisplay} timeSecs={oppTimeSecs}
          isActive={!isMyTurn && !gameOver} isGameOver={gameOver}
        />
      </div>

      {/* ── Статус-полоска верх: «Думает...» когда ход бота ──────────────── */}
      <div style={{ height: STATUS_GAP, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 4, flexShrink: 0 }}>
        {!isMyTurn && !gameOver && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4DDA8A', animation: 'gp-pulse 1.4s infinite', boxShadow: '0 0 6px #4DDA8A' }} />
            <span style={{ fontSize: '.72rem', fontWeight: 800, color: '#4DDA8A', letterSpacing: '.02em' }}>Думает...</span>
          </div>
        )}
      </div>

      {/* ── Доска — точный размер, НЕ flex-центрирование ─────────────────── */}
      <div style={{ height: boardSize, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'visible' }}>
        <div style={{ width: boardSize, position: 'relative' }}>
          <ChessBoard
            fen={fen}
            orientation={myColor}
            isMyTurn={isMyTurn && !gameOver}
            isGameOver={gameOver}
            onMove={handleMove}
            lastMove={lastMove}
            sessionId={sessionId}
          />

          {/* ── Публичный батл: наблюдатели лайв + всего просмотров (топ-правый угол доски) ── */}
          {isPublicBattle && (
            <div style={{
              position: 'absolute', top: 6, right: 6,
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(0,0,0,.6)',
              border: '.5px solid rgba(255,255,255,.12)',
              borderRadius: 20,
              padding: '4px 10px',
              pointerEvents: 'none',
              zIndex: 10,
            }}>
              {/* Лайв-зрители (пульс-индикатор, если > 0) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {spectatorCount > 0 && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#E7484F',
                    animation: 'gp-pulse 1.4s infinite',
                    boxShadow: '0 0 5px #E7484F',
                  }} />
                )}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M1 12S5 5 12 5s11 7 11 7-4 7-11 7S1 12 1 12z" stroke="rgba(154,148,144,.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="3" stroke="rgba(154,148,144,.8)" strokeWidth="1.8"/>
                </svg>
                <span style={{ fontSize: '.62rem', color: '#9A9490', fontWeight: 700, letterSpacing: '.01em' }}>
                  {spectatorCount}
                </span>
              </div>
              {/* Разделитель */}
              <span style={{ width: 1, height: 10, background: 'rgba(255,255,255,.15)' }} />
              {/* Всего просмотров */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M12 4.5C7 4.5 3 8.5 3 12s4 7.5 9 7.5 9-4 9-7.5-4-7.5-9-7.5z" stroke="rgba(154,148,144,.8)" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M12 8v4l2 2" stroke="rgba(154,148,144,.8)" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize: '.62rem', color: '#9A9490', fontWeight: 600, letterSpacing: '.01em' }}>
                  {viewCount >= 1000 ? `${(viewCount / 1000).toFixed(1)}K` : viewCount}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Статус-полоска низ: «Ваш ход» зелёным ───────────────────────── */}
      <div style={{ height: STATUS_GAP, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4, flexShrink: 0 }}>
        {isMyTurn && !gameOver && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4DDA8A', animation: 'gp-pulse 1.4s infinite', boxShadow: '0 0 8px #4DDA8A' }} />
            <span style={{ fontSize: '.78rem', fontWeight: 800, color: '#4DDA8A', letterSpacing: '.03em' }}>Ваш ход</span>
          </div>
        )}
      </div>

      {/* ── Касса батла (между статус-полоской и панелью игрока) ─────────
          Private — компактная: банк + «победителю после 10%».
          Public — с разбивкой: ставки + донаты → итого → победителю. */}
      {isBattle && hasBet && (
        isPrivateBattle ? (
          /* Приватный: только касса, без зрителей/доната */
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            background: 'rgba(212,168,67,.08)',
            border: '.5px solid rgba(212,168,67,.22)',
            borderRadius: 10,
            padding: '6px 12px',
            margin: '0 10px',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CoinIcon size={14} />
              <span style={{ fontSize: '.62rem', color: '#9A9490', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                Касса
              </span>
              <span style={{ fontSize: '.78rem', color: '#F0C85A', fontWeight: 800 }}>
                {fmtBalance(bank.toString())} ᚙ
              </span>
            </div>
            <div style={{ fontSize: '.58rem', color: '#6E6A66', fontWeight: 600, letterSpacing: '.02em' }}>
              победителю <span style={{ color: '#4DDA8A', fontWeight: 800 }}>{fmtBalance(winnerTake.toString())} ᚙ</span>
              <span style={{ color: '#4A4440' }}> · комиссия 10%</span>
            </div>
          </div>
        ) : (
          /* Публичный: касса + разбивка (ставки / донаты) + к выплате */
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4,
            background: 'linear-gradient(135deg, rgba(212,168,67,.10), rgba(212,168,67,.04))',
            border: '.5px solid rgba(212,168,67,.28)',
            borderRadius: 12,
            padding: '7px 12px',
            margin: '0 10px',
            flexShrink: 0,
          }}>
            {/* Строка 1: Касса + общая сумма */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CoinIcon size={14} />
                <span style={{ fontSize: '.62rem', color: '#D4A843', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  Касса
                </span>
              </div>
              <span style={{ fontSize: '.86rem', color: '#F0C85A', fontWeight: 800, letterSpacing: '.01em' }}>
                {fmtBalance(bank.toString())} ᚙ
              </span>
            </div>
            {/* Строка 2: разбивка ставки + донаты */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: '.56rem', color: '#7A7470', fontWeight: 600 }}>
              <span>ставки: <span style={{ color: '#A8A29C' }}>{fmtBalance(totalBetPot.toString())}</span></span>
              <span>донаты: <span style={{ color: donationsBig > 0n ? '#E78F4F' : '#5A5550' }}>{fmtBalance(donationsBig.toString())}</span></span>
              <span>
                победителю: <span style={{ color: '#4DDA8A', fontWeight: 800 }}>{fmtBalance(winnerTake.toString())}</span>
                <span style={{ color: '#4A4440' }}> · стол 10%</span>
              </span>
            </div>
          </div>
        )
      )}

      {/* ── Игрок (снизу, вплотную к доске) ──────────────────────────────── */}
      <div style={{ borderTop: '.5px solid rgba(255,255,255,.05)', flexShrink: 0 }}>
        <PlayerPanel
          name={myName} elo={myElo} avatar={myAvatar} isBot={false}
          isWhite={myColor === 'white'} country={myCountry} captured={myCaptured} advantage={myAdv} coins={myCoins}
          timeDisplay={myTimeDisplay} timeSecs={myTimeSecs}
          isActive={isMyTurn && !gameOver} isGameOver={gameOver}
        />
      </div>

      {/* ── Нижний spacer ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 6 }} />

      {/* ── Панель действий ──────────────────────────────────────────────── */}
      {isSpectator ? (
        /* ── Панель зрителя: Выйти | [Донат — только public] | Зрители ── */
        <div style={{
          display: 'grid', gridTemplateColumns: isPublicBattle ? '1fr 2fr 1fr' : '1fr 1fr',
          height: ACTBAR_H,
          paddingBottom: 'max(0px, env(safe-area-inset-bottom, 0px))',
          borderTop: '.5px solid rgba(255,255,255,.09)',
          flexShrink: 0, background: 'rgba(10,12,18,.6)',
          gap: 1, alignItems: 'stretch',
        }}>
          {/* Выйти */}
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, background: 'rgba(255,255,255,.05)', border: 'none',
              color: '#7A7875', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '.72rem', fontWeight: 700,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Выйти
          </button>

          {/* Донат с выбором суммы — только для публичных батлов */}
          {isPublicBattle && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {/* Быстрые суммы */}
            <div style={{ display: 'flex', gap: 4 }}>
              {[1000, 5000, 10000, 50000].map(amt => (
                <button
                  key={amt}
                  onClick={() => setSelectedDonateAmt(amt)}
                  style={{
                    padding: '2px 6px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: '.58rem', fontWeight: 700,
                    background: selectedDonateAmt === amt ? 'rgba(212,168,67,.25)' : 'rgba(255,255,255,.06)',
                    color: selectedDonateAmt === amt ? '#F0C85A' : '#5A5248',
                    transition: 'background .15s, color .15s',
                  }}
                >
                  {amt >= 1000 ? `${amt / 1000}K` : amt}
                </button>
              ))}
            </div>
            {/* Кнопка доната */}
            <button
              disabled={gameOver}
              onClick={() => {
                if (gameOver) return;
                getSocket().emit('battle:donate', { sessionId, amount: String(selectedDonateAmt) });
              }}
              style={{
                padding: '5px 18px', borderRadius: 10,
                background: gameOver ? 'rgba(255,255,255,.04)' : 'linear-gradient(135deg,#2A1E08,#4A3810)',
                border: `.5px solid ${gameOver ? 'rgba(255,255,255,.08)' : 'rgba(212,168,67,.42)'}`,
                color: gameOver ? '#3A3028' : '#F0C85A',
                fontSize: '.72rem', fontWeight: 800,
                cursor: gameOver ? 'default' : 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <CoinIcon size={12} />
              Задонатить {fmtBalance(String(selectedDonateAmt))} ᚙ
            </button>
          </div>
          )}

          {/* Зрители (только публичные: лайв + всего) */}
          {isPublicBattle && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 3,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M1 12S5 5 12 5s11 7 11 7-4 7-11 7S1 12 1 12z" stroke="#9A9490" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="3" stroke="#9A9490" strokeWidth="1.6"/>
            </svg>
            <span style={{ fontSize: '.62rem', color: '#9A9490', fontWeight: 600 }}>
              {spectatorCount} лайв
            </span>
            <span style={{ fontSize: '.54rem', color: '#6A6460', fontWeight: 600 }}>
              {viewCount >= 1000 ? `${(viewCount / 1000).toFixed(1)}K` : viewCount} всего
            </span>
          </div>
          )}

          {/* Зрители приватного батла (компактно, без доната) */}
          {isPrivateBattle && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 3,
          }}>
            <span style={{ fontSize: '.62rem', color: '#6A6460', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              🔒 Приватный
            </span>
          </div>
          )}
        </div>
      ) : (
        /* ── Обычная панель: 4 кнопки ──────────────────────────────────── */
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
          height: ACTBAR_H,
          paddingBottom: 'max(0px, env(safe-area-inset-bottom, 0px))',
          borderTop: '.5px solid rgba(255,255,255,.09)',
          flexShrink: 0, background: 'rgba(10,12,18,.6)',
          gap: 1,
        }}>
          {/* Главная */}
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 5, background: 'rgba(255,255,255,.03)', border: 'none',
              color: '#7A8898', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background .15s, color .15s',
            }}
          >
            <IcoHome />
            <span style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.04em' }}>Главная</span>
          </button>

          {/* Сохранить */}
          <button
            onClick={handleToggleSave}
            disabled={isSaving}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 5,
              background: isSaved ? 'rgba(245,200,66,.07)' : 'rgba(255,255,255,.03)',
              border: 'none',
              color: isSaved ? '#F5C842' : '#7A8898',
              cursor: isSaving ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background .15s, color .15s',
            }}
          >
            <IcoStarBtn filled={isSaved} />
            <span style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.04em' }}>
              {isSaved ? 'Сохранено' : 'Сохранить'}
            </span>
          </button>

          {/* Ничья */}
          <button
            onClick={handleDrawOffer}
            disabled={gameOver || drawOfferedByMe}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 5,
              background: drawOfferedByOpp ? 'rgba(130,207,255,.1)' : 'rgba(255,255,255,.03)',
              border: 'none',
              color: drawOfferedByOpp ? '#82CFFF' : drawOfferedByMe ? '#2A2A30' : '#7A8898',
              cursor: gameOver || drawOfferedByMe ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: drawOfferedByMe ? 0.4 : 1,
              transition: 'background .15s, color .15s',
            }}
          >
            <IcoHandshake />
            <span style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.04em' }}>
              {drawOfferedByOpp ? 'Принять' : drawOfferedByMe ? 'Ждём...' : 'Ничья'}
            </span>
          </button>

          {/* Сдаться */}
          <button
            onClick={handleSurrender}
            disabled={gameOver}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 5,
              background: gameOver ? 'rgba(255,255,255,.02)' : 'rgba(220,50,47,.06)',
              border: 'none',
              color: gameOver ? '#2A2420' : '#BB5555',
              cursor: gameOver ? 'default' : 'pointer',
              fontFamily: 'inherit', transition: 'background .15s, color .15s',
            }}
          >
            <IcoFlag />
            <span style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.04em' }}>Сдаться</span>
          </button>
        </div>
      )}

      {/* ── Диалог подтверждения сдачи ──────────────────────────────────── */}
      {showResignDialog && (
        <GameDialog
          iconNode={
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path d="M5 21V4" stroke="#CC6060" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M5 4h10l-2 5h3l-3 6H5" stroke="#CC6060" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          iconBg="rgba(204,96,96,.09)"
          iconBorder="rgba(204,96,96,.28)"
          title="Сдаться?"
          subtitle="Партия будет засчитана как поражение"
          primaryLabel="Сдаться"
          primaryDanger
          secondaryLabel="Отмена"
          onPrimary={handleResignConfirm}
          onSecondary={() => setShowResignDialog(false)}
        />
      )}

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

      {/* Метка хода */}
      <div style={{ textAlign: 'center', padding: '4px 0 2px', flexShrink: 0 }}>
        {!isGameOver && (
          <span style={isMyTurn
            ? tagStyle('var(--green, #00D68F)', 'rgba(0,214,143,0.10)')
            : tagStyle('var(--text-secondary, #8B92A8)', 'var(--bg-input, #232840)')}>
            {isMyTurn ? t.game.yourTurn : t.game.opponentTurn}
          </span>
        )}
      </div>

      {/* Я */}
      <div style={{ padding: '4px 12px', flexShrink: 0 }}>
        <PlayerRow player={mySide?.player ?? user as import("@/types").User & { telegramId: string }}
          timeLeft={mySide?.timeLeft ?? 0}
          isActive={isMyTurn && !isGameOver} label={t.game.you} isMe />
      </div>

      {/* Кнопки */}
      {!isGameOver ? (
        <div style={{ display: 'flex', gap: 6, padding: '6px 12px', flexShrink: 0 }}>
          <button onClick={() => navigate('/')} style={actionBtn()}>{t.common.back}</button>
          <button onClick={() => getSocket().emit('game:offer_draw', { sessionId: session.id })}
            style={actionBtn()}>{t.game.offerDraw}</button>
          <button onClick={() => setConfirmSurrender(true)}
            style={actionBtn('var(--red, #FF4D6A)', 'rgba(255,77,106,0.08)')}>{t.game.surrender}</button>
        </div>
      ) : !showResult ? (
        <div style={{ padding: '6px 12px', flexShrink: 0 }}>
          <button onClick={handleResultClose} style={{ ...actionBtn(), width: '100%' }}>{t.gameResult.backToMenu}</button>
        </div>
      ) : null}

      {/* История ходов */}
      <div style={{
        margin: '4px 12px 8px', padding: '8px 12px',
        background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, flexShrink: 0,
      }}>
        <div style={labelStyle}>{t.game.moveHistory}</div>
        <MoveHistory pgn={session.pgn} />
      </div>

      <div style={{ height: 82, flexShrink: 0 }} />

      {/* Оффер ничьи */}
      {drawOfferedBy && drawOfferedBy !== user?.id && (
        <Overlay>
          <ModalBox>
            <div style={modalTitle}>{t.game.drawOffered}</div>
            <div style={modalSub}>{t.game.drawOffered}. {t.game.acceptDraw}?</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => {
                getSocket().emit('game:accept_draw', { sessionId: session.id }, () => {});
                setDrawOffered(null);
              }} style={btnGold}>{t.game.acceptDraw}</button>
              <button onClick={() => {
                setDrawOffered(null);
                getSocket().emit('game:decline_draw', { sessionId: session.id });
              }} style={btnSecondary}>{t.game.declineDraw}</button>
            </div>
          </ModalBox>
        </Overlay>
      )}

      {/* Подтверждение сдачи */}
      {confirmSurrender && (
        <Overlay>
          <ModalBox>
            <div style={modalTitle}>{t.game.confirmSurrender}</div>
            <div style={modalSub}>
              {session.bet ? t.game.surrenderLoss(fmtBalance(session.bet)) : t.game.surrenderDefault}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={handleSurrender} style={btnDanger}>{t.game.confirmSurrenderYes}</button>
              <button onClick={() => setConfirmSurrender(false)} style={btnGold}>{t.common.cancel}</button>
            </div>
          </ModalBox>
        </Overlay>
      )}

      {/* V3: Победный экран */}
      {showVictory && resultData && (
        <VictoryScreen
          result={resultData.result}
          opponentName={opSide?.player?.firstName}
          earned={resultData.earned}
          onDone={() => setShowVictory(false)}
        />
      )}

      {/* Модал результата */}
      {showResult && resultData && (
        <GameResultModal
          result={resultData.result}
          earned={resultData.earned}
          commission={resultData.commission}
          pieceCoins={resultData.pieceCoins}
          botLevelName={isBotGame && session?.botLevel ? JARVIS_LEVELS[Math.max(0, Math.min(JARVIS_LEVELS.length - 1, (session.botLevel ?? 1) - 1))]?.name : undefined}
          userTelegramId={(user as import("@/types").User & { telegramId: string })?.telegramId}
          sessionId={session?.id}
          onClose={handleResultClose}
          onRematch={isBotGame ? handleRematch : undefined}
        />
      )}
    </div>
  );
};

// ── MoveHistory — ходы парами ────────────────────────────────────────────────
const parsePgnMoves = (pgn: string) => {
  const cleaned = pgn.replace(/\[.*?\]\s*/g, '').trim();
  if (!cleaned) return [];
  const moves: Array<{ num: number; white: string; black: string }> = [];
  const regex = /(\d+)\.\s+(\S+)(?:\s+(\S+))?/g;
  let match;
  while ((match = regex.exec(cleaned)) !== null) {
    moves.push({ num: parseInt(match[1]), white: match[2], black: match[3] ?? '' });
  }
  return moves;
};

const MoveHistory: React.FC<{ pgn: string }> = ({ pgn }) => {
  const moves = parsePgnMoves(pgn);
  const last8 = moves.slice(-8);
  if (last8.length === 0) {
    return <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text-muted, #4A5270)', marginTop: 4 }}>— ♟ —</div>;
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', marginTop: 4 }}>
      {last8.map((m) => (
        <span key={m.num} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#C8CDE0', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--text-muted, #4A5270)' }}>{m.num}.</span> {m.white}{m.black ? ` ${m.black}` : ''}
        </span>
      ))}
    </div>
  );
};

// ── PlayerRow — с тикающим таймером (мемоизирован) ───────────────────────────
const PlayerRow: React.FC<{
  player?: import("@/types").UserPublic; timeLeft: number; isActive: boolean; label?: string; isMe?: boolean;
}> = React.memo(({ player, timeLeft, isActive, label, isMe }) => {
  const [localTime, setLocalTime] = React.useState(timeLeft);
  const [pulseOn, setPulseOn] = React.useState(false);

  // Синхронизируем с сервером при изменении timeLeft
  React.useEffect(() => { setLocalTime(timeLeft); }, [timeLeft]);

  // Тикаем локально пока isActive
  React.useEffect(() => {
    if (!isActive) return;
    const t = setInterval(() => setLocalTime((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [isActive]);

  const danger = localTime < 10 && isActive;

  // Пульсация при критическом времени
  React.useEffect(() => {
    if (!danger) { setPulseOn(false); return; }
    const t = setInterval(() => setPulseOn(p => !p), 500);
    return () => clearInterval(t);
  }, [danger]);

  // Haptic каждые 3 секунды при критическом времени
  React.useEffect(() => {
    if (!danger || !isActive) return;
    if (localTime > 0 && localTime % 3 === 0) {
      try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium'); } catch {}
    }
  }, [localTime, danger, isActive]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 12px', background: 'var(--bg-card, #1C2030)',
      border: `1px solid ${isActive ? 'var(--accent, #F5C842)' : 'var(--border, rgba(255,255,255,0.07))'}`,
      boxShadow: isActive ? '0 0 0 1px rgba(245,200,66,0.1)' : undefined,
      borderRadius: 14, transition: 'border-color .2s',
    }}>
      <Avatar user={player} size="s" gold={isMe && isActive} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>
          {label ?? player?.firstName ?? '?'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>
          ELO {player?.elo ?? '—'}{isActive ? ' · Move' : ''}
        </div>
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono',monospace", fontSize: 19, fontWeight: 700,
        color: danger ? 'var(--red, #FF4D6A)' : isActive ? 'var(--accent, #F5C842)' : 'var(--text-muted, #4A5270)',
        transition: 'color .25s', minWidth: 42, textAlign: 'right',
        opacity: danger ? (pulseOn ? 1 : 0.4) : 1,
      }}>
        {fmtTime(localTime)}
      </div>
    </div>
  );
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    position: 'absolute', inset: 0, zIndex: 100,
    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  }}>{children}</div>
);
const ModalBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    background: 'var(--bg-card, #161927)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 20, padding: 20, width: '100%',
  }}>{children}</div>
);

const rootStyle: React.CSSProperties = {
  position: 'absolute', inset: 0,
  display: 'flex', flexDirection: 'column',
  background: 'var(--bg, #0B0D11)', overflow: 'hidden',
};
const tagStyle = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-flex', padding: '3px 9px', background: bg, color,
  borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
});
const actionBtn = (color = 'var(--text-secondary, #8B92A8)', bg = 'transparent'): React.CSSProperties => ({
  flex: 1, padding: '9px 10px', background: bg, color,
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 11,
  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
});
const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
  textTransform: 'uppercase', color: 'var(--text-muted, #4A5270)',
};
const modalTitle: React.CSSProperties = { fontSize: 17, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', marginBottom: 6 };
const modalSub: React.CSSProperties = { fontSize: 13, color: 'var(--text-secondary, #8B92A8)' };
const btnGold: React.CSSProperties = {
  flex: 1, padding: 11, background: 'var(--accent, #F5C842)', color: 'var(--bg, #0B0D11)',
  border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const btnSecondary: React.CSSProperties = {
  ...btnGold, background: 'var(--bg-input, #232840)', color: 'var(--text-primary, #F0F2F8)', border: '1px solid rgba(255,255,255,0.1)',
};
const btnDanger: React.CSSProperties = {
  ...btnGold, background: 'rgba(255,77,106,0.12)', color: 'var(--red, #FF4D6A)', border: '1px solid rgba(255,77,106,0.2)',
};
