// frontend/src/pages/GamePage.tsx
// АРХТЕКТУРА: useSocket.ts (App уровень) слушает 'game' события → store.
// GamePage читает из store. Для ходов/сдачи/ничьи: socket.emit(...).

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { getSocket } from '@/api/socket';
import { api } from '@/api/client';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { BottomNav } from '@/components/layout/BottomNav';
import type { GameSession } from '@/types';
import { ChessBoard } from '@/components/game/ChessBoard';
import { sound } from '@/lib/sound';
import { fmtBalance } from '@/utils/format';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { PgnReplayModal } from '@/components/profile/PgnReplayModal';

// ── Константы ──────────────────────────────────────────────────────────────────
// 2026-05-16: chess unicode не рендерится в Telegram WebView Android/iOS
// (нет глифов в системном шрифте). Используем SVG-фигуры из assets/pieces/
// через PIECE_SVG-маппинг ниже.
const PIECE_SYMBOLS: Record<string, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };
const PIECE_SVG: Record<string, string> = {
  p: new URL('../assets/pieces/black-pawn.svg',   import.meta.url).href,
  n: new URL('../assets/pieces/black-knight.svg', import.meta.url).href,
  b: new URL('../assets/pieces/black-bishop.svg', import.meta.url).href,
  r: new URL('../assets/pieces/black-rook.svg',   import.meta.url).href,
  q: new URL('../assets/pieces/black-queen.svg',  import.meta.url).href,
};
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

function calcBoardSize(isSpectator = false, hasMeta = false): number {
  // Панели + статус-полоски + action bar + spacer-ы (8px сверху/снизу).
  // PR-3 hotfix Кенан 2026-05-18: для зрителя добавляем 82px на BottomNav.
  // Если есть meta-полоска (касса) — +28px (1 строка + margins).
  const navSpace = isSpectator ? 82 : 0;
  const metaSpace = hasMeta ? 28 : 0;
  const reserved = PANEL_H * 2 + STATUS_GAP * 2 + ACTBAR_H + 16 + navSpace + metaSpace;
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

// ── Браво-фейерверк ───────────────────────────────────────────────────────────
const BravoAnimation: React.FC<{ name: string }> = ({ name }) => (
  <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 220 }}>
    <Confetti />
    <div style={{
      position: 'absolute', top: '28%', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(6,4,14,.88)', borderRadius: 20, padding: '14px 28px',
      border: '1px solid rgba(212,168,67,.45)',
      boxShadow: '0 0 40px rgba(212,168,67,.2)',
      textAlign: 'center',
      animation: 'result-pop .35s cubic-bezier(.2,.9,.3,1.05) both',
    }}>
      <div style={{ fontSize: '1rem', fontWeight: 900, color: '#F0C85A', letterSpacing: '.02em' }}>{name}</div>
      <div style={{ fontSize: '.7rem', color: '#9A9490', marginTop: 4, fontWeight: 700, letterSpacing: '.08em' }}>БРАВО!</div>
    </div>
  </div>
);

// ── конка цвета фигур прямо на доске ────────────────────────────────────────
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

// Флаг страны: больше НЕ возвращаем regional-indicator emoji (Telegram WebApp
// их не рендерит на mobile). Используем компонент <CountryFlag code="RU" />
// напрямую где нужно. Эта функция оставлена для обратной совместимости —
// возвращает просто uppercase код, чтобы старые места не падали.
const flagEmoji = (code?: string | null): string | null => {
  if (!code || code.length !== 2) return null;
  return code.toUpperCase();
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
  onAvatarClick?: () => void; // клик по аватару → профиль соперника
}

const PlayerPanel: React.FC<PanelProps> = ({
  name, elo, avatar, isBot, isWhite, country, captured, advantage: adv,
  coins, timeDisplay, timeSecs, isActive, isGameOver, onAvatarClick,
}) => {
  const sorted = useMemo(() => sortCaptured(captured), [captured]);
  const isCritical = isActive && timeSecs > 0 && timeSecs < 15;
  const AV = 52;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      height: PANEL_H, padding: '0 10px 0 14px', flexShrink: 0,
      background: isActive
        ? isCritical ? 'rgba(220,50,47,.06)' : 'rgba(212,168,67,.06)'
        : 'rgba(255,255,255,.015)',
      borderLeft: `3px solid ${
        isCritical ? 'rgba(220,50,47,.85)'
        : isActive  ? '#D4A843'
        : 'rgba(255,255,255,.06)'
      }`,
      boxShadow: isActive && !isCritical
        ? 'inset 0 0 0 .5px rgba(212,168,67,.18), 0 0 16px rgba(212,168,67,.08)'
        : isActive && isCritical
        ? 'inset 0 0 0 .5px rgba(220,50,47,.25)'
        : 'none',
      transition: 'background .3s, border-color .3s, box-shadow .3s',
    }}>

      {/* ── Аватар (кликабельный → профиль игрока) ───────────────────────── */}
      <div
        onClick={onAvatarClick}
        style={{
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
          cursor: onAvatarClick ? 'pointer' : 'default',
        }}
      >
        {avatar
          ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : isBot
            ? <JarvisAva size={AV * 0.65} />
            : <span style={{ fontSize: AV * 0.4, fontWeight: 800, color: '#D4A843' }}>
                {name[0]?.toUpperCase() ?? '?'}
              </span>
        }
      </div>

      {/* ── ЗОНА 1: герой (имя + флаг + ELO) ───────────────────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 4, width: 96, flexShrink: 0, overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            fontSize: '.95rem', fontWeight: 700, lineHeight: 1,
            color: isActive ? '#F0E8CC' : '#B0A898',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: 74, transition: 'color .3s',
          }}>
            {name.length > 10 ? name.slice(0, 10) + '…' : name}
          </span>
          {country && country.length === 2 && (
            <CountryFlag code={country} size={14} />
          )}
        </div>
        <span style={{ fontSize: '.66rem', color: isActive ? '#8A8478' : '#6A6258', fontWeight: 600, lineHeight: 1 }}>
          {elo !== undefined ? `ELO ${elo}` : (isBot ? 'J.A.R.V.I.S' : '')}
        </span>
      </div>

      {/* Разделитель ────────────────────────────────────────────────────── */}
      <span style={{ width: 1, height: 38, background: 'rgba(255,255,255,.06)', flexShrink: 0 }} />

      {/* ── ЗОНА 2: монеты (стр. 1) + фигуры с переносом (стр. 2-3) ─────── */}
      <div style={{
        flex: 1, minWidth: 0, maxHeight: PANEL_H - 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 3,
        overflow: 'hidden',
      }}>
        {/* Строка 1: монеты */}
        {coins > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <CoinIcon size={13} />
            <span style={{ fontSize: '.74rem', fontWeight: 800, color: '#D4A843' }}>
              +{coins >= 1000 ? `${(coins/1000).toFixed(1)}K` : coins}
            </span>
          </div>
        ) : (
          <div style={{ height: 14 }} />
        )}
        {/* Строки 2-3: фигуры с переносом, не выходят за зону */}
        {sorted.length > 0 ? (
          <div style={{
            display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
            alignItems: 'center', gap: 1, maxWidth: '100%',
            maxHeight: 32, overflow: 'hidden',
          }}>
            {sorted.map((p, i) => (
              PIECE_SVG[p] ? (
                <img key={i} src={PIECE_SVG[p]} alt={p} width={12} height={12}
                     draggable={false}
                     style={{ opacity: .82, display: 'inline-block' }} />
              ) : null
            ))}
            {adv > 0 && (
              <span style={{ fontSize: '.62rem', fontWeight: 800, color: '#3DBA7A', marginLeft: 3 }}>+{adv}</span>
            )}
          </div>
        ) : (
          <div style={{ height: 12 }} />
        )}
      </div>

      {/* Разделитель ────────────────────────────────────────────────────── */}
      <span style={{ width: 1, height: 38, background: 'rgba(255,255,255,.06)', flexShrink: 0 }} />

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

// ── конки кнопок панели действий ────────────────────────────────────────────
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
          {/* конка */}
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
  const [leaveConfirm, LeaveConfirmDialog] = useConfirm();
  const gameOverRefForLeave = useRef(false);

  // Confirm перед выходом из активной партии (A.4 MASTER_PLAN).
  // Если игра ещё идёт — спрашиваем, иначе сразу navigate(to).
  const handleLeavePage = useCallback(async (to: string = '/') => {
    if (gameOverRefForLeave.current) { navigate(to); return; }
    const ok = await leaveConfirm({
      title: 'Покинуть партию?',
      message: 'Партия ещё идёт. Если уйдёте — будет засчитано поражение и ставка сгорит.',
      okLabel: 'Покинуть',
      cancelLabel: 'Остаться',
      danger: true,
    });
    if (ok) navigate(to);
  }, [leaveConfirm, navigate]);
  const { sessionId = '' } = useParams<{ sessionId: string }>();

  const { sessions, drawOfferedBy, upsertSession } = useGameStore();
  const { user } = useUserStore();
  const session = sessions.find(s => s.id === sessionId) ?? null;

  // PR-3 hotfix Кенан 2026-05-18: если зашли как зритель публичной партии
  // (нажали «СМОТРЕТЬ» в публичных батлах) — session НЕ в нашем store
  // (мы не участник, /auth/me её не подгрузил). Раньше из-за этого был
  // бесконечный лоадер. Подгружаем по REST публичным endpoint /games/spectate/:id
  // и кладём в store. Авторизация не требуется.
  useEffect(() => {
    if (!sessionId || session) return;
    let cancelled = false;
    import('@/api/client').then(({ api }) => {
      api.get<{ session: GameSession }>(`/games/spectate/${sessionId}`)
        .then((r) => { if (!cancelled && r.session) upsertSession(r.session); })
        .catch((e) => {
          // 403 SESSION_PRIVATE / 404 SESSION_NOT_FOUND → оставляем как есть
          // (лоадер заменим на ошибку через таймаут ниже).
          console.warn('[GamePage] spectate fetch failed:', e?.message ?? e);
        });
    });
    return () => { cancelled = true; };
  }, [sessionId, session, upsertSession]);

  // PR-3 hotfix Кенан 2026-05-18: безопасная навигация на чужой профиль.
  // Возвращает onClick если id валидный И не равен своему. Иначе undefined
  // (PlayerPanel не сделает курсор pointer + не сработает navigate).
  // Корень бага: если бэк прислал session с player.id=undefined, старый код
  // делал navigate('/profile/undefined') → ProfilePage фильтровал строку
  // 'undefined' → isOwnProfile=true → показывал свой профиль. Теперь явная
  // проверка ДО navigate.
  const openProfileSafe = (id: string | undefined | null) => {
    if (!id || typeof id !== 'string' || id === 'undefined' || id === 'null') return undefined;
    if (user?.id && id === user.id) return undefined; // свой профиль — не открываем
    return () => navigate(`/profile/${id}`);
  };

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
  const [savesCount,        setSavesCount]        = useState(0);
  const [selectedDonateAmt, setSelectedDonateAmt] = useState(1000);
  const [showDonateMenu,    setShowDonateMenu]    = useState(false);
  const [bravoQueue,  setBravoQueue]  = useState<string[]>([]);
  const [bravoName,   setBravoName]   = useState<string | null>(null);

  const mySecsRef   = useRef(0);
  const oppSecsRef  = useRef(0);
  const isMyTurnRef = useRef(false);
  const gameOverRef = useRef(false);

  const isMyTurn = !!(session?.isMyTurn);
  const gameOver = !!session
    && session.status !== 'IN_PROGRESS'
    && session.status !== 'WAITING_FOR_OPPONENT';
  // Зрителю confirm не нужен — он не теряет ставку и не «бросает партию».
  useEffect(() => {
    gameOverRefForLeave.current = gameOver || !session?.mySideId;
  }, [gameOver, session?.mySideId]);

  const isBattle        = session?.type === 'BATTLE';
  const isSpectator     = isBattle && !session?.mySideId;
  const hasBet          = isBattle && session?.bet && BigInt(session.bet) > 0n;
  const isPrivateBattle = isBattle && !!session?.isPrivate;
  const isPublicBattle  = isBattle && !session?.isPrivate;

  // ── Касса: ставки обоих игроков + донаты зрителей ─────────────────────────
  // РЎРРќРҐР РћРќРР—РђР¦РРЇ С backend/src/services/game/finish.ts:
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
        detail: { text: ` +${fmtBalance(data.amount)} доната`, type: 'info' }
      }));
    };
    sock.on('battle:donated', onDonated);

    const onBravo = (data: { name: string }) => {
      setBravoQueue(q => [...q, data.name]);
    };
    sock.on('battle:bravo', onBravo);

    // Live-обновление счётчика сохранений (шапка зрителя)
    const onSavesCount = (data: { sessionId: string; count: number }) => {
      if (data.sessionId === sessionId) setSavesCount(data.count);
    };
    sock.on('game:saves-count', onSavesCount);
    // Стартовое значение через REST
    if (sessionId) {
      import('@/api/client').then(({ api }) => {
        api.get<{ count: number }>(`/games/${sessionId}/saves/count`)
          .then(r => setSavesCount(r.count))
          .catch(() => {});
      });
    }

    if (isSpectator) {
      sock.emit('spectate', { sessionId });
    }

    return () => {
      sock.off('battle:donated', onDonated);
      sock.off('battle:bravo', onBravo);
      sock.off('game:saves-count', onSavesCount);
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

  // Размер доски — PR-3 hotfix Кенан 2026-05-18: учитываем bottom-nav и meta-полоску.
  // Объявление `hasMeta` ниже зависит от isBattle/hasBet — те объявлены до этого блока.
  const [boardSize, setBoardSize] = useState(() => calcBoardSize());
  useEffect(() => {
    const recalc = () => setBoardSize(calcBoardSize(isSpectator, isBattle && hasBet));
    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [isSpectator, isBattle, hasBet]);

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

  // Spectator: показываем обоих реальных игроков (не "Вы")
  const specWhiteSide = isSpectator ? session.sides.find(s => s.isWhite) ?? session.sides[0] : null;
  const specBlackSide = isSpectator ? session.sides.find(s => !s.isWhite) ?? (session.sides[1] ?? session.sides[0]) : null;
  // Spectator: чей ход определяем по currentSideId, а не по isMyTurn (у зрителей isMyTurn всегда false)
  const isWhiteTurnNow = isSpectator
    ? session.currentSideId === specWhiteSide?.id
    : isMyTurn && (myColor === 'white');

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

  // Braво-фейерверк: показываем имена по очереди с интервалом 5с
  useEffect(() => {
    if (bravoName || bravoQueue.length === 0) return;
    const [next, ...rest] = bravoQueue;
    setBravoName(next);
    setBravoQueue(rest);
    const t = setTimeout(() => setBravoName(null), 5000);
    return () => clearTimeout(t);
  }, [bravoQueue, bravoName]);

  // Сохранить / убрать партию
  useEffect(() => {
    if (!sessionId) return;
    api.get<{ saved: boolean }>(`/games/${sessionId}/saved`)
      .then(res => setIsSaved(res.saved))
      .catch(() => {});
  }, [sessionId]);

  const handleBravo = useCallback(() => {
    const sock = getSocket();
    const spectatorName = user?.firstName ?? 'Зритель';
    sock.emit('battle:bravo', { sessionId, name: spectatorName });
    // Локальная анимация (сервер отдаст обратно всем через battle:bravo broadcast)
    setBravoQueue(q => [...q, spectatorName]);
  }, [sessionId, user?.firstName]);

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
          <button onClick={() => handleLeavePage('/')} style={{ marginTop: 20, padding: '7px 18px', borderRadius: 10, background: 'rgba(255,255,255,.06)', border: '.5px solid rgba(255,255,255,.1)', color: '#4A5060', fontSize: '.7rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Назад</button>
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


      {/* ── Соперник / верхний игрок (spectator: чёрный игрок) ───────────── */}
      <div style={{ borderBottom: '.5px solid rgba(255,255,255,.05)', flexShrink: 0 }}>
        {isSpectator && specBlackSide ? (
          <PlayerPanel
            // PR-3 hotfix Кенан 2026-05-19: явные fallback'и если backend не
            // отдал player.firstName/elo (например session с одной стороной
            // или старый формат). Раньше показывалось «...» + 0:00.
            name={specBlackSide.player?.firstName ?? (specBlackSide.isBot ? 'J.A.R.V.I.S' : 'Соперник')}
            elo={specBlackSide.player?.elo}
            avatar={specBlackSide.player?.avatar}
            isBot={!!specBlackSide.isBot}
            isWhite={false}
            country={specBlackSide.player?.country}
            captured={blackCap} advantage={Math.max(0, bMat - wMat)} coins={0}
            timeDisplay={oppTimeDisplay} timeSecs={oppTimeSecs}
            isActive={!isWhiteTurnNow && !gameOver} isGameOver={gameOver}
            onAvatarClick={openProfileSafe(specBlackSide.player?.id)}
          />
        ) : (
          <PlayerPanel
            name={oppName} elo={oppElo} avatar={oppAvatar} isBot={oppIsBot}
            isWhite={oppIsWhite} country={oppCountry} captured={oppCaptured} advantage={oppAdv} coins={oppCoins}
            timeDisplay={oppTimeDisplay} timeSecs={oppTimeSecs}
            isActive={!isMyTurn && !gameOver} isGameOver={gameOver}
            onAvatarClick={oppIsBot ? undefined : openProfileSafe(oppSide?.player?.id)}
          />
        )}
      </div>

      {/* PR-3 hotfix (Кенан 2026-05-19): info-panel в 3 секции —
          LEFT (live/views/saves иконки + цифры), CENTER (статус игры),
          RIGHT (КАССА). Без «→ выплата» — это для финал-модала.
          Тёмный фон под игроцкие панели, отступ сверху/снизу. */}
      {isBattle && hasBet && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center', gap: 8,
          padding: '8px 12px',
          margin: '8px 10px 6px',
          background: '#1F2233',
          border: '.5px solid rgba(255,255,255,.08)',
          borderRadius: 10,
          fontFamily: 'Inter, sans-serif',
          flexShrink: 0,
        }}>
          {/* LEFT: live / просмотры / сохранения (иконки крупные ~14pt) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 700, justifySelf: 'start' }}>
            {isPublicBattle ? (
              <>
                {/* Live (eye+pulse) */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: spectatorCount > 0 ? '#4DDA8A' : '#5A6066' }}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <path d="M1 10S4 4 10 4s9 6 9 6-3 6-9 6-9-6-9-6z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="10" cy="10" r="2.5" fill="currentColor"/>
                  </svg>
                  {spectatorCount}
                </span>
                {/* Просмотры (users) */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#82CFFF' }}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.6"/>
                    <path d="M3 17c1-3 3.5-5 7-5s6 2 7 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                  {viewCount >= 1000 ? `${(viewCount / 1000).toFixed(1)}K` : viewCount}
                </span>
                {/* Сохранения (bookmark) */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#9B85FF' }}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <path d="M5 4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v13l-5-3-5 3V4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                  </svg>
                  {savesCount}
                </span>
              </>
            ) : null}
          </div>

          {/* CENTER: состояние игры. Резервируем место даже если пусто. */}
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' as const,
            color: gameOver ? '#9A9490' : (isWhiteTurnNow ? '#E8E4DC' : '#A8A29C'),
            minWidth: 90, textAlign: 'center',
          }}>
            {gameOver
              ? 'Партия завершена'
              : isSpectator
                ? (isWhiteTurnNow ? 'Ход белых' : 'Ход чёрных')
                : (isMyTurn ? 'Ваш ход' : 'Думает...')}
          </div>

          {/* RIGHT: КАССА (без «→ выплата») */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 800, justifySelf: 'end' }}>
            <CoinIcon size={14} />
            <span style={{ color: '#D4A843', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '.05em' }}>касса</span>
            <span style={{ color: '#F0C85A' }}>{fmtBalance(bank.toString())}</span>
          </div>
        </div>
      )}

      {/* ── Статус-полоска верх (между панелью соперника и доской): только
          «Думает...» для НЕ-публичных партий. */}
      <div style={{ height: STATUS_GAP, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4, flexShrink: 0 }}>
        {!isPublicBattle && !isMyTurn && !gameOver && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4DDA8A', animation: 'gp-pulse 1.4s infinite', boxShadow: '0 0 7px #4DDA8A' }} />
            <span style={{ fontSize: '.79rem', fontWeight: 800, color: '#4DDA8A', letterSpacing: '.02em' }}>Думает...</span>
          </div>
        )}
      </div>

      {/* ── Доска — точный размер, НЕ flex-центрирование ─────────────────── */}
      <div style={{ height: boardSize, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'visible', padding: '0 6px' }}>
        <div style={{ width: boardSize - 12, position: 'relative' }}>
          <ChessBoard
            fen={fen}
            orientation={myColor}
            isMyTurn={isMyTurn && !gameOver}
            isGameOver={gameOver}
            onMove={handleMove}
            lastMove={lastMove}
            sessionId={sessionId}
          />

          {/* Бейдж зрителей в углу доски удалён 2026-05-16: переехал в
              верхнюю статус-полоску. */}
        </div>
      </div>

      {/* ── Статус-полоска низ: «Ваш ход» зелёным.
          Кенан 2026-05-16: «зона активности должна быть чуть ближе к
          доске, не слипаться с полосой героя». Прибиваем к верху
          (flex-start + paddingTop). */}
      <div style={{ height: STATUS_GAP, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 4, flexShrink: 0 }}>
        {isMyTurn && !gameOver && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4DDA8A', animation: 'gp-pulse 1.4s infinite', boxShadow: '0 0 9px #4DDA8A' }} />
            <span style={{ fontSize: '.85rem', fontWeight: 800, color: '#4DDA8A', letterSpacing: '.03em' }}>Ваш ход</span>
          </div>
        )}
      </div>

      {/* PR-3 hotfix: блок кассы был здесь, теперь вынесен НАД панелью
          соперника (см. выше). Под доской только «Ваш ход» + моя панель + кнопки. */}

      {/* ── грок / нижний игрок (spectator: белый игрок) ─────────────────── */}
      <div style={{ borderTop: '.5px solid rgba(255,255,255,.05)', flexShrink: 0 }}>
        {isSpectator && specWhiteSide ? (
          <PlayerPanel
            // PR-3 hotfix Кенан 2026-05-19: fallback'и как для верхней панели.
            name={specWhiteSide.player?.firstName ?? (specWhiteSide.isBot ? 'J.A.R.V.I.S' : 'Игрок')}
            elo={specWhiteSide.player?.elo}
            avatar={specWhiteSide.player?.avatar}
            isBot={!!specWhiteSide.isBot}
            isWhite={true}
            country={specWhiteSide.player?.country}
            captured={whiteCap} advantage={Math.max(0, wMat - bMat)} coins={0}
            timeDisplay={myTimeDisplay} timeSecs={myTimeSecs}
            isActive={isWhiteTurnNow && !gameOver} isGameOver={gameOver}
            onAvatarClick={openProfileSafe(specWhiteSide.player?.id)}
          />
        ) : (
          <PlayerPanel
            name={myName} elo={myElo} avatar={myAvatar} isBot={false}
            isWhite={myColor === 'white'} country={myCountry} captured={myCaptured} advantage={myAdv} coins={myCoins}
            timeDisplay={myTimeDisplay} timeSecs={myTimeSecs}
            isActive={isMyTurn && !gameOver} isGameOver={gameOver}
            // PR-3 hotfix Кенан 2026-05-18: клик на СВОЙ аватар во время игры
            // не делает navigate — раньше открывал /profile/<my-id>, что юзер
            // считал багом «открылся свой профиль» при попытке посмотреть оппонента.
            onAvatarClick={undefined}
          />
        )}
      </div>

      {/* ── Нижний spacer ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 6 }} />

      {/* ── Панель действий — ЕДИНЫЙ layout: 4 слота, меняются только 3-й и 4-й ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
        height: ACTBAR_H,
        paddingBottom: 'max(0px, env(safe-area-inset-bottom, 0px))',
        borderTop: '.5px solid rgba(255,255,255,.09)',
        flexShrink: 0, background: 'rgba(10,12,18,.6)',
        gap: 1, position: 'relative',
      }}>
        {/* Слот 1: Главная (всегда) — с confirm если партия активна */}
        <button
          onClick={() => handleLeavePage('/')}
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

        {/* Слот 2: Сохранить (всегда) */}
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

        {/* Слот 3: игрок=Ничья | зритель=Донат */}
        {isSpectator ? (
          isPublicBattle ? (
            <button
              disabled={gameOver}
              onClick={() => !gameOver && setShowDonateMenu(v => !v)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 5,
                background: showDonateMenu ? 'rgba(212,168,67,.12)' : gameOver ? 'rgba(255,255,255,.02)' : 'rgba(212,168,67,.05)',
                border: 'none',
                color: gameOver ? '#2A2420' : '#D4A843',
                cursor: gameOver ? 'default' : 'pointer',
                fontFamily: 'inherit', transition: 'background .15s, color .15s',
              }}
            >
              <CoinIcon size={20} />
              <span style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.04em' }}>Донаты</span>
            </button>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: '#3A3830', gap: 5,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: '.62rem', fontWeight: 700 }}>Закрыто</span>
            </div>
          )
        ) : (
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
        )}

        {/* Слот 4: игрок=Сдаться | зритель=Поделиться (Telegram share) */}
        {isSpectator ? (
          <button
            onClick={() => {
              // PR-3 hotfix Кенан 2026-05-18: используем PR-2 shareToken (универсальная
              // /share/:token ссылка работает на 3 стадиях — waiting/live/archive).
              // Fallback на legacy watch_<code> для очень старых сессий без токена.
              const shareToken = (session as any)?.shareToken as string | undefined;
              const inviteUrl = shareToken
                ? `https://t.me/ChessCoinBot/app?startapp=share_${shareToken}`
                : `https://t.me/chessgamecoin_bot?start=watch_${session?.code ?? sessionId}`;
              const text = `Смотри партию ChessCoin в прямом эфире`;
              try {
                const tg = (window as any).Telegram?.WebApp;
                if (tg?.openTelegramLink) {
                  tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(text)}`);
                  return;
                }
              } catch {}
              try {
                if ((navigator as any).share) { (navigator as any).share({ title: 'ChessCoin', text, url: inviteUrl }); return; }
              } catch {}
              try { navigator.clipboard.writeText(inviteUrl); } catch {}
            }}
            title="Поделиться партией"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 5,
              background: 'rgba(74,158,255,.06)', border: 'none',
              color: '#82CFFF', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background .15s, color .15s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M11 3h6v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 11l8-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M16 11v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.04em' }}>Поделиться</span>
          </button>
        ) : (
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
        )}

        {/* Donate-меню — выбор суммы (всплывает над 3-й кнопкой) */}
        {showDonateMenu && isSpectator && isPublicBattle && (
          <>
            <div
              onClick={() => setShowDonateMenu(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 60,
                background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)',
              }}
            />
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
              zIndex: 61, width: 280,
              background: 'linear-gradient(160deg,#141018,#0F0E18)',
              border: '.5px solid rgba(212,168,67,.35)',
              borderRadius: 14, padding: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,.6)',
            }}>
              <div style={{ fontSize: '.62rem', color: '#9A9490', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
                Поддержать партию
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                {[100, 1000, 10000, 100000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setSelectedDonateAmt(amt)}
                    style={{
                      padding: '8px 0', borderRadius: 9, cursor: 'pointer',
                      border: selectedDonateAmt === amt ? '.5px solid rgba(212,168,67,.5)' : '.5px solid rgba(255,255,255,.08)',
                      background: selectedDonateAmt === amt ? 'rgba(212,168,67,.12)' : 'rgba(255,255,255,.03)',
                      color: selectedDonateAmt === amt ? '#F0C85A' : '#9A9490',
                      fontFamily: "'JetBrains Mono',monospace", fontSize: '.78rem', fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}
                  >
                    {fmtBalance(String(amt))} <CoinIcon size={11} />
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  getSocket().emit('battle:donate', { sessionId, amount: String(selectedDonateAmt) });
                  setShowDonateMenu(false);
                }}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 10,
                  background: 'linear-gradient(135deg,#2A1E08,#4A3810)',
                  border: '.5px solid rgba(212,168,67,.45)',
                  color: '#F0C85A', fontSize: '.82rem', fontWeight: 800,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                Отправить {fmtBalance(String(selectedDonateAmt))} <CoinIcon size={13} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* PR-3 hotfix Кенан 2026-05-18: spacer под action-bar для зрителя,
          чтобы fixed BottomNav (~82px высота) не перекрывал action-кнопки. */}
      {isSpectator && (
        <div style={{ height: 82, flexShrink: 0 }} />
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

      {/* ── Браво-фейерверк ──────────────────────────────────────────────── */}
      {bravoName && <BravoAnimation name={bravoName} />}

      {/* Confirm выхода (A.4 MASTER_PLAN) */}
      {LeaveConfirmDialog}

      {/* PGN-replay для завершённой партии при заходе по deep-link / зрителем.
          Если игрок участвовал — ему показывается ResultSheet (выше), модал
          replay-а ему не нужен. Зритель или прохожий по watch-ссылке
          получает PGN-просмотр (Кенан 2026-05-16). */}
      {gameOver && session?.pgn && isSpectator && session.pgn.length > 0 && (
        <PgnReplayModal
          pgn={session.pgn}
          title={`${specWhiteSide?.player?.firstName ?? 'White'} vs ${specBlackSide?.player?.firstName ?? 'Black'}`}
          sessionId={session.id}
          whitePlayer={specWhiteSide?.player as any}
          blackPlayer={specBlackSide?.player as any}
          onClose={() => navigate('/')}
        />
      )}

      {/* PR-3 hotfix Кенан 2026-05-18: в режиме зрителя — bottom-nav виден
          (юзер не играет, ему нужна навигация на другие вкладки). Action-bar
          выше остаётся (Главная/Сохранить/Донаты/Поделиться) — это локальные
          действия с этой партией. В playing-режиме nav скрыт чтобы освободить
          место для action-buttons (Ничья/Сдаться). */}
      {isSpectator && <BottomNav />}
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
    return <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#5A5248', marginTop: 4 }}>— ♟ —</div>;
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', marginTop: 4 }}>
      {last8.map((m) => (
        <span key={m.num} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#C8CDE0', whiteSpace: 'nowrap' }}>
          <span style={{ color: '#5A5248' }}>{m.num}.</span> {m.white}{m.black ? ` ${m.black}` : ''}
        </span>
      ))}
    </div>
  );
};

