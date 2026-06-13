// Единый шаблон карточки завершённой партии — тот же стандарт что
// BattleChallengeCard / BattleLiveCard: два кликабельных аватара по краям,
// в центре — бейдж результата вместо таймера, дата проведения и ставка.
// Клик в центр карточки открывает PGN-просмотр.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { fmtBalance, fmtDate } from '@/utils/format';
import type { UserPublic } from '@/types';

export interface BattleHistoryItem {
  sessionId: string;
  type: string;
  result: 'win' | 'lose' | 'draw' | string;
  isWhite: boolean;
  winningAmount?: string | null;
  bet?: string | null;
  botLevel?: number | null;
  pgn?: string | null;
  finishedAt?: string | null;
  opponent?: UserPublic | null;
  hasBot?: boolean;
}

const RESULT_CFG = {
  win:  { label: 'ПОБЕДА',     color: '#3DBA7A', bg: 'rgba(61,186,122,.07)',  border: 'rgba(61,186,122,.32)', glow: 'rgba(61,186,122,.10)' },
  draw: { label: 'НИЧЬЯ',      color: '#82CFFF', bg: 'rgba(130,207,255,.05)', border: 'rgba(130,207,255,.25)', glow: 'rgba(130,207,255,.08)' },
  lose: { label: 'ПОРАЖЕНИЕ',  color: '#CC6060', bg: 'rgba(204,96,96,.05)',   border: 'rgba(204,96,96,.25)',  glow: 'rgba(204,96,96,.06)' },
} as const;

// Маленькая иконка цвета фигуры (повторяет SmallColorIcon из BattlesPage)
const ColorIcon: React.FC<{ isWhite: boolean }> = ({ isWhite }) => (
  <div style={{
    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
    background: isWhite ? 'rgba(240,200,90,.10)' : 'rgba(74,158,255,.08)',
    border: `.5px solid ${isWhite ? 'rgba(240,200,90,.28)' : 'rgba(74,158,255,.22)'}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <path d="M9 2v3M7.5 3.5h3" stroke={isWhite ? '#F0C85A' : '#82CFFF'} strokeWidth="1.3" strokeLinecap="round"/>
      <rect x="7" y="5" width="4" height="2" rx=".5" fill={isWhite ? '#F0C85A' : '#82CFFF'} opacity=".8"/>
      <path d="M5.5 7h7l-1 8H6.5L5.5 7z" fill={isWhite ? '#F0C85A' : '#82CFFF'} opacity={isWhite ? '.7' : '.9'}/>
      <path d="M4 15h10" stroke={isWhite ? '#F0C85A' : '#82CFFF'} strokeWidth="1.3" strokeLinecap="round"/>
      {!isWhite && <rect x="5" y="6.5" width="8" height="9" rx="1" fill="#82CFFF" opacity=".15"/>}
    </svg>
  </div>
);

// CoinIcon (золотой конь) — использует тот же дизайн что в BattlesPage/Live
const CoinIcon: React.FC<{ size?: number }> = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="15" fill="url(#bhc_bg)" stroke="url(#bhc_brd)" strokeWidth="1.2"/>
    <path d="M11 24c0-1 .5-2 1.5-2.5L14 21c-1-1-1.5-2.5-1-4 .3-1 1-2 2-2.5-.5-.8-.5-1.5 0-2 .8-.5 2-.3 2.5.5.5.8.3 2-.5 2.5.5.5 1 1.5.8 2.5l2 1c1 .5 1.7 1.5 1.7 2.5v.5H11z" fill="url(#bhc_kn)"/>
    <defs>
      <radialGradient id="bhc_bg" cx="38%" cy="30%" r="75%"><stop offset="0%" stopColor="#F0C85A"/><stop offset="55%" stopColor="#D4A843"/><stop offset="100%" stopColor="#8A6020"/></radialGradient>
      <linearGradient id="bhc_brd" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F0C85A"/><stop offset="50%" stopColor="#A07830"/><stop offset="100%" stopColor="#F0C85A"/></linearGradient>
      <linearGradient id="bhc_kn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#120E04"/><stop offset="100%" stopColor="#1E1608"/></linearGradient>
    </defs>
  </svg>
);

interface PlayerColProps {
  user: UserPublic | null | undefined;
  fallbackName?: string;
  isWhite: boolean;
  isWinner?: boolean;
  onProfile?: (id: string) => void;
}

const PlayerCol: React.FC<PlayerColProps> = ({ user, fallbackName, isWhite, isWinner, onProfile }) => {
  const pid = user?.id;
  const name = user?.firstName ?? fallbackName ?? '?';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 5, flexShrink: 0, width: 72,
    }}>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={pid && onProfile ? (e) => { e.stopPropagation(); e.preventDefault(); onProfile(pid); } : undefined}
          style={{
            padding: 0, border: 'none', background: 'none',
            borderRadius: '50%', overflow: 'hidden',
            width: 56, height: 56,
            cursor: pid ? 'pointer' : 'default',
          }}
        >
          <Avatar user={user as any} size="l" />
        </button>
        {/* Корона победителя поверх аватара */}
        {isWinner && (
          <div style={{
            position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg,#F0C85A,#D4A843)',
            color: '#0D0D12', borderRadius: 6,
            padding: '2px 5px',
            fontSize: 9, fontWeight: 900, letterSpacing: '.05em',
            boxShadow: '0 2px 8px rgba(212,168,67,.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
            border: '.5px solid rgba(120,80,20,.4)',
          }}>
            <svg width="10" height="10" viewBox="0 0 18 18" fill="none">
              <path d="M3 6l3 3 3-5 3 5 3-3v7H3V6z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
              <line x1="3" y1="14" x2="15" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
        )}
      </div>

      <ColorIcon isWhite={isWhite} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', maxWidth: 72 }}>
        <span style={{
          fontSize: '.72rem', fontWeight: 700, color: '#D4C8B0',
          overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', maxWidth: 72, textAlign: 'center',
        }}>
          {name}
        </span>
        {(user?.elo != null) && (
          <span style={{ fontSize: '.6rem', fontWeight: 600 }}>
            <span style={{ color: '#7A7470' }}>ELO </span>
            <span style={{ color: '#F0C85A' }}>{user.elo}</span>
          </span>
        )}
      </div>
    </div>
  );
};

interface BattleHistoryCardProps {
  game: BattleHistoryItem;
  me: UserPublic | null;
  onView: (game: BattleHistoryItem) => void;
}

export const BattleHistoryCard: React.FC<BattleHistoryCardProps> = ({ game, me, onView }) => {
  const navigate = useNavigate();
  const result = (game.result === 'win' ? 'win' : game.result === 'draw' ? 'draw' : 'lose') as keyof typeof RESULT_CFG;
  const cfg = RESULT_CFG[result];

  // Раскладка по цветам: я и оппонент
  const myUser: UserPublic | null = me ? {
    id: me.id, firstName: me.firstName, avatar: me.avatar,
    avatarGradient: me.avatarGradient, elo: me.elo, league: me.league as any,
  } : null;

  // Бот — отображаем как opponent с заглушкой
  const opponentUser: UserPublic | null = game.opponent ?? null;

  // Кто белый — кто чёрный
  const whiteUser = game.isWhite ? myUser : opponentUser;
  const blackUser = game.isWhite ? opponentUser : myUser;
  const whiteFallback = !whiteUser && game.hasBot ? (game.botLevel != null ? `JARVIS Lv.${game.botLevel}` : 'JARVIS') : undefined;
  const blackFallback = !blackUser && game.hasBot ? (game.botLevel != null ? `JARVIS Lv.${game.botLevel}` : 'JARVIS') : undefined;

  // Победитель: я если win и т.д.
  const meIsWinner = result === 'win';
  const oppIsWinner = result === 'lose';
  const whiteIsWinner = (game.isWhite && meIsWinner) || (!game.isWhite && oppIsWinner);
  const blackIsWinner = (!game.isWhite && meIsWinner) || (game.isWhite && oppIsWinner);

  const onProfile = (id: string) => navigate('/profile/' + id);

  const dateStr = game.finishedAt ? fmtDate(game.finishedAt) : '';
  const betBig = BigInt(game.bet ?? '0');

  return (
    <div
      onClick={() => game.pgn && onView(game)}
      style={{
        margin: '0 .85rem 8px',
        background: 'linear-gradient(135deg,#141018,#0F0E18)',
        border: `.5px solid ${cfg.border}`,
        borderRadius: 16, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: game.pgn ? 'pointer' : 'default',
        boxShadow: `0 2px 16px ${cfg.glow}`,
      }}
    >
      {/* Белый игрок */}
      <PlayerCol
        user={whiteUser}
        fallbackName={whiteFallback}
        isWhite={true}
        isWinner={whiteIsWinner}
        onProfile={onProfile}
      />

      {/* Центр: РЕЗУЛЬТАТ + дата + ставка [+ просмотр PGN] */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 4,
      }}>
        {/* Бейдж результата */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 7,
          background: cfg.bg, border: `.5px solid ${cfg.border}`,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
          <span style={{
            fontSize: '.55rem', fontWeight: 900,
            color: cfg.color, letterSpacing: '.16em',
          }}>
            {cfg.label}
          </span>
        </div>

        {/* Дата */}
        <span style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: '.78rem', fontWeight: 700,
          color: '#9A9490', letterSpacing: '.02em',
        }}>
          {dateStr}
        </span>

        {/* Ставка */}
        {betBig > 0n && (
          <span style={{
            fontSize: '.7rem', fontWeight: 800, color: '#D4A843',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <CoinIcon size={11} />
            {fmtBalance(game.bet ?? '0')}
          </span>
        )}

        {/* Выигрыш */}
        {game.winningAmount && result === 'win' && (
          <span style={{
            fontSize: '.65rem', fontWeight: 700, color: '#3DBA7A',
            fontFamily: "'JetBrains Mono', monospace",
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            +{fmtBalance(game.winningAmount)} <CoinIcon size={10} />
          </span>
        )}

        {/* Метка PGN — мини-кнопка как «СМОТРЕТЬ» в Live */}
        {game.pgn && (
          <button
            onClick={(e) => { e.stopPropagation(); onView(game); }}
            style={{
              marginTop: 1, padding: '4px 10px',
              background: 'rgba(155,109,255,.10)',
              border: '.5px solid rgba(155,109,255,.28)',
              borderRadius: 8, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '.55rem', fontWeight: 800,
              color: '#9B85FF', letterSpacing: '.08em',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <svg width="9" height="9" viewBox="0 0 18 18" fill="none">
              <path d="M5 3.5v11l9-5.5L5 3.5z" fill="currentColor"/>
            </svg>
            ПРОСМОТР
          </button>
        )}
      </div>

      {/* Чёрный игрок */}
      <PlayerCol
        user={blackUser}
        fallbackName={blackFallback}
        isWhite={false}
        isWinner={blackIsWinner}
        onProfile={onProfile}
      />
    </div>
  );
};
