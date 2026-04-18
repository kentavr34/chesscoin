// @ts-nocheck
/**
 * DesignV2Page — демо-прототип нового дизайна от Claude Design.
 * Mock-данные, не подключён к реальным stores/socket.
 * Роут: /design-v2
 *
 * Источник: C:\Users\SAM\Desktop\Clode Desing\*.jsx (2026-04-19)
 * 5 экранов: Главная / Партия / Батлы / Войны / Профиль
 * + переключатель вариантов Главной: classic / card / minimal
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════════════════
//  ASSETS (в /public/design-v2/)
// ═══════════════════════════════════════════════════════════════════════════
const COIN_SRC = '/design-v2/coin.svg';
const PIECE_SRC = (color: string, piece: string) => `/design-v2/pieces/${color}-${piece}.svg`;

// ═══════════════════════════════════════════════════════════════════════════
//  ICONS (lucide-style inline)
// ═══════════════════════════════════════════════════════════════════════════
const I = (d: any) => (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 22} height={props.size || 22}
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={props.stroke || 1.75} strokeLinecap="round" strokeLinejoin="round"
       style={props.style}>{d}</svg>
);
const HomeIcon = I(<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>);
const GameIcon = I(<g><path d="M10 2v3m4-3v3M7 7h10l-1 4a5 5 0 0 1-8 0zM9 15v3M15 15v3M7 22h10"/></g>);
const BattlesIcon = I(<g><path d="M6 9h12M6 13h12M9 3v4m6-4v4M5 19l2-2h10l2 2M8 19v2m8-2v2"/></g>);
const WarsIcon = I(<g><path d="m13 4 3 3-9 9H4v-3zM14 7l3 3M17 4l3 3-2 2-3-3z"/></g>);
const ProfileIcon = I(<g><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></g>);
const SearchIcon = I(<g><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></g>);
const BellIcon = I(<g><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></g>);
const PlusIcon = I(<g><path d="M12 5v14M5 12h14"/></g>);
const ArrowUpIcon = I(<g><path d="M12 19V5M5 12l7-7 7 7"/></g>);
const ArrowDownIcon = I(<g><path d="M12 5v14M19 12l-7 7-7-7"/></g>);
const ClockIcon = I(<g><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></g>);
const CheckIcon = I(<g><path d="m5 12 5 5L20 7"/></g>);
const ChevRight = I(<g><path d="m9 6 6 6-6 6"/></g>);
const FlagIcon = I(<g><path d="M4 22V4M4 16h13l-2-4 2-4H4"/></g>);
const DotsIcon = I(<g><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></g>);

// ═══════════════════════════════════════════════════════════════════════════
//  PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════
const Coin = ({ size = 14, style }: any) => (
  <img src={COIN_SRC} width={size} height={size}
       style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }} alt="" />
);

const Chip = ({ children, tone = 'gold', dot, onClick }: any) => {
  const tones: any = {
    gold:   { bg: 'rgba(212,168,67,.12)',  bd: 'rgba(212,168,67,.3)',  fg: '#F0C85A' },
    purple: { bg: 'rgba(155,109,255,.1)',  bd: 'rgba(155,109,255,.3)', fg: '#C4A8FF' },
    green:  { bg: 'rgba(61,186,122,.1)',   bd: 'rgba(61,186,122,.3)',  fg: '#6FEDB0' },
    blue:   { bg: 'rgba(74,158,255,.1)',   bd: 'rgba(74,158,255,.3)',  fg: '#82CFFF' },
    neutral:{ bg: 'rgba(255,255,255,.04)', bd: 'rgba(255,255,255,.08)',fg: '#C8C0E0' },
  };
  const t = tones[tone] || tones.gold;
  return (
    <span onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: t.bg, border: `1px solid ${t.bd}`, color: t.fg,
      padding: '4px 10px', borderRadius: 9999,
      fontSize: '.7rem', fontWeight: 700, letterSpacing: '.04em',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.fg, boxShadow: `0 0 6px ${t.fg}` }} />}
      {children}
    </span>
  );
};

const Avatar = ({ initials, tone = 'gold', size = 38, online }: any) => {
  const bgs: any = {
    gold:   'linear-gradient(135deg,#F0C85A,#A07830)',
    purple: 'linear-gradient(135deg,#9B6DFF,#4A9EFF)',
    green:  'linear-gradient(135deg,#3DBA7A,#1f6d47)',
    neutral:'linear-gradient(135deg,#2a2530,#1a1520)',
  };
  const ring = tone === 'gold' ? '0 0 0 2px rgba(212,168,67,.4)' : '0 0 0 1px rgba(255,255,255,.08)';
  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: bgs[tone], boxShadow: ring,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 800,
        color: tone === 'gold' ? '#0D0D12' : '#F4F0E8',
      }}>{initials}</div>
      {online && (
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 10, height: 10, borderRadius: '50%',
          background: '#3DBA7A', border: '2px solid #0D0D12',
          boxShadow: '0 0 6px #3DBA7A',
        }} />
      )}
    </div>
  );
};

const PassportAvatar = ({ size = 72, initials }: any) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    padding: 3,
    background: 'conic-gradient(from 220deg,#F0C85A,#A07830,#F0C85A,#D4A843,#FCE49A,#F0C85A)',
    flexShrink: 0, boxShadow: '0 0 18px rgba(212,168,67,.25)',
  }}>
    <div style={{
      width: '100%', height: '100%', borderRadius: '50%',
      background: '#141018',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 800,
      color: '#F0C85A', letterSpacing: '.02em',
    }}>{initials}</div>
  </div>
);

const ListRow = ({ avatar, name, sub, right, onClick, last }: any) => {
  const [pressed, setPressed] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px',
        background: pressed ? 'rgba(255,255,255,.03)' : '#141018',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: 16, cursor: onClick ? 'pointer' : 'default',
        marginBottom: last ? 0 : 8,
        transition: 'background .12s',
      }}>
      {avatar}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '.88rem', fontWeight: 700, color: '#F4F0E8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        {sub && <div style={{ fontSize: '.7rem', color: '#7A7875', marginTop: 1, display: 'flex', gap: 6, alignItems: 'center' }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
};

const PressButton = ({ children, primary, style, onClick }: any) => {
  const [pressed, setPressed] = React.useState(false);
  const base: any = {
    fontFamily: 'inherit', fontWeight: 800, cursor: 'pointer', border: 'none',
    padding: '10px 14px', borderRadius: 10, fontSize: '.82rem',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    transition: 'transform .15s cubic-bezier(.34,1.56,.64,1),opacity .15s,box-shadow .15s',
    transform: pressed ? 'scale(.96)' : 'scale(1)',
    opacity: pressed ? .9 : 1,
    ...style,
  };
  const tone: any = primary ? {
    background: 'linear-gradient(180deg,#F0C85A,#D4A843)',
    color: '#0D0D12',
    boxShadow: pressed ? '0 0 8px rgba(212,168,67,.15)' : '0 0 20px rgba(212,168,67,.35),0 0 48px rgba(212,168,67,.1)',
  } : {
    background: 'rgba(255,255,255,.06)',
    color: '#F4F0E8',
    border: '1px solid rgba(255,255,255,.1)',
  };
  return (
    <button onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
            onMouseLeave={() => setPressed(false)}
            onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
            onClick={onClick}
            style={{ ...base, ...tone }}>
      {children}
    </button>
  );
};

const SectionLabel = ({ children, right }: any) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 2px 6px',
  }}>
    <span style={{ fontSize: '.58rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875' }}>
      {children}
    </span>
    {right}
  </div>
);

const FadeIn = ({ children, delay = 0 }: any) => {
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div style={{
      opacity: shown ? 1 : 0,
      transform: shown ? 'translateY(0)' : 'translateY(6px)',
      transition: 'opacity .36s ease,transform .36s cubic-bezier(.34,1.56,.64,1)',
    }}>{children}</div>
  );
};

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.replace('#',''), 16);
  return `${(n>>16)&255},${(n>>8)&255},${n&255}`;
};

const formatK = (n: number) => {
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString('en-US');
};

// ═══════════════════════════════════════════════════════════════════════════
//  CHESS BOARD
// ═══════════════════════════════════════════════════════════════════════════
const FILES = ['a','b','c','d','e','f','g','h'];
const PIECE_FILE: any = { K:'king', Q:'queen', R:'rook', B:'bishop', N:'knight', P:'pawn' };

const DEFAULT_POSITION: any = (() => {
  const p: any = {};
  const back = ['R','N','B','Q','K','B','N','R'];
  FILES.forEach((f, i) => {
    p[`${f}1`] = { piece: back[i], color: 'white' };
    p[`${f}2`] = { piece: 'P',     color: 'white' };
    p[`${f}7`] = { piece: 'P',     color: 'black' };
    p[`${f}8`] = { piece: back[i], color: 'black' };
  });
  return p;
})();

const SAMPLE_POSITION: any = (() => {
  const p: any = { ...DEFAULT_POSITION };
  delete p.e2; p.e4 = { piece: 'P', color: 'white' };
  delete p.e7; p.e5 = { piece: 'P', color: 'black' };
  delete p.g1; p.f3 = { piece: 'N', color: 'white' };
  delete p.b8; p.c6 = { piece: 'N', color: 'black' };
  delete p.f1; p.b5 = { piece: 'B', color: 'white' };
  return p;
})();

const CHECK_POSITION: any = (() => {
  const p: any = { ...SAMPLE_POSITION };
  // Queen attacks e1 — check!
  delete p.d8; p.h4 = { piece: 'Q', color: 'black' };
  delete p.f2; // open path
  return p;
})();

const ChessBoardV2 = ({ position = DEFAULT_POSITION, size = 320, lastMove, dots = [], captures = [], checkSq, flipped }: any) => {
  const sq = size / 8;
  const ranks = flipped ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1];
  const files = flipped ? [...FILES].reverse() : FILES;
  return (
    <div style={{
      width: size, height: size,
      borderRadius: 6, overflow: 'hidden',
      boxShadow: '0 10px 30px rgba(0,0,0,.55),0 0 0 1px rgba(212,168,67,.2),inset 0 0 0 3px #4a2e0e',
      position: 'relative',
    }}>
      {ranks.map((rank, ri) => (
        <div key={rank} style={{ display: 'flex', height: sq }}>
          {files.map((f, fi) => {
            const isLight = (ri + fi) % 2 === 0;
            const id = `${f}${rank}`;
            const p = position[id];
            const isLast = lastMove && (lastMove.from === id || lastMove.to === id);
            const isDot = dots.includes(id);
            const isCapture = captures.includes(id);
            const isCheck = checkSq === id;
            return (
              <div key={id} style={{
                width: sq, height: sq,
                background: isLight ? '#DEB887' : '#8B4513',
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isLast && (<div style={{ position: 'absolute', inset: 0, background: 'rgba(212,168,67,.28)' }} />)}
                {isCheck && (<div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle,rgba(239,68,68,.55),rgba(239,68,68,.15) 70%,transparent)' }} />)}
                {isCapture && (<div style={{ position: 'absolute', inset: 3, border: '3px solid rgba(212,168,67,.8)', borderRadius: '50%', boxSizing: 'border-box' }} />)}
                {fi === 0 && (
                  <span style={{ position: 'absolute', left: 2, top: 1, fontSize: Math.max(8, sq * 0.14), fontWeight: 700, color: isLight ? '#8B4513' : '#DEB887', opacity: .6 }}>{rank}</span>
                )}
                {ri === 7 && (
                  <span style={{ position: 'absolute', right: 3, bottom: 0, fontSize: Math.max(8, sq * 0.14), fontWeight: 700, color: isLight ? '#8B4513' : '#DEB887', opacity: .6 }}>{f}</span>
                )}
                {p && (
                  <img src={PIECE_SRC(p.color, PIECE_FILE[p.piece])}
                       width={sq * 0.92} height={sq * 0.92}
                       draggable={false}
                       style={{ pointerEvents: 'none', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.35))', position: 'relative' }} alt="" />
                )}
                {isDot && !p && (
                  <div style={{ width: sq * 0.28, height: sq * 0.28, borderRadius: '50%', background: 'rgba(212,168,67,.6)' }} />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  PASSPORT CARDS (3 варианта)
// ═══════════════════════════════════════════════════════════════════════════
const PassportClassic = ({ user, onTopup }: any) => {
  const { name, elo, rank, jarvisRank, balance } = user;
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: 20, padding: '18px 18px 16px',
      background: 'radial-gradient(120% 100% at 0% 0%,rgba(212,168,67,.18),rgba(212,168,67,0) 55%),linear-gradient(180deg,#120E04 0%,#0E0E14 100%)',
      border: '1px solid rgba(212,168,67,.28)',
      boxShadow: '0 6px 36px rgba(0,0,0,.55),inset 0 0 0 .5px rgba(212,168,67,.06)',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(45deg,#fff 25%,transparent 25%),linear-gradient(-45deg,#fff 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#fff 75%),linear-gradient(-45deg,transparent 75%,#fff 75%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
        opacity: .02, pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <PassportAvatar size={72} initials={user.initials} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1.08rem', fontWeight: 700, color: '#F4F0E8', letterSpacing: '.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span style={{ fontSize: '.66rem', color: '#7A7875', letterSpacing: '.1em', fontWeight: 700, textTransform: 'uppercase' }}>ELO</span>
            <span style={{ fontSize: '.95rem', fontWeight: 900, color: '#D4A843', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 10px rgba(212,168,67,.35)' }}>{elo}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <Chip tone="gold">Звание · {rank}</Chip>
            <Chip tone="blue">J.A.R.V.I.S · {jarvisRank}</Chip>
          </div>
        </div>
      </div>
      <div style={{
        position: 'relative', marginTop: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px',
        background: 'rgba(0,0,0,.35)',
        border: '1px solid rgba(212,168,67,.15)',
        borderRadius: 12,
      }}>
        <div>
          <div style={{ fontSize: '.52rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875' }}>Баланс</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Coin size={20} />
            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#F0C85A', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 14px rgba(212,168,67,.35)' }}>
              {formatK(balance)}
            </span>
          </div>
        </div>
        <div onClick={onTopup} style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'linear-gradient(180deg,#F0C85A,#D4A843)',
          color: '#0D0D12', fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(212,168,67,.35)', cursor: 'pointer',
        }}><PlusIcon size={18} stroke={2.5} /></div>
      </div>
    </div>
  );
};

const PassportCompact = ({ user, onTopup }: any) => (
  <div style={{
    borderRadius: 18, padding: 14,
    background: '#141018', border: '1px solid rgba(212,168,67,.22)',
    display: 'flex', gap: 12, alignItems: 'center',
  }}>
    <PassportAvatar size={58} initials={user.initials} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F4F0E8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <span style={{ fontSize: '.78rem', fontWeight: 900, color: '#D4A843', fontVariantNumeric: 'tabular-nums' }}>ELO {user.elo}</span>
        <span style={{ color: 'rgba(255,255,255,.1)' }}>·</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '.82rem', fontWeight: 900, color: '#F0C85A', fontVariantNumeric: 'tabular-nums' }}>
          <Coin size={14} />{formatK(user.balance)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 7 }}>
        <Chip tone="gold">{user.rank}</Chip>
        <Chip tone="blue">{user.jarvisRank}</Chip>
      </div>
    </div>
    <div onClick={onTopup} style={{
      width: 36, height: 36, borderRadius: 10,
      background: 'linear-gradient(180deg,#F0C85A,#D4A843)',
      color: '#0D0D12', display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 0 14px rgba(212,168,67,.3)', cursor: 'pointer', flexShrink: 0,
    }}><PlusIcon size={17} stroke={2.5} /></div>
  </div>
);

const PassportMinimal = ({ user, onTopup }: any) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 2px' }}>
    <PassportAvatar size={48} initials={user.initials} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '.95rem', fontWeight: 700, color: '#F4F0E8' }}>{user.name}</div>
      <div style={{ fontSize: '.62rem', color: '#7A7875', letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>
        {user.rank} · ELO {user.elo}
      </div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <Coin size={18} />
        <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#F0C85A', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 12px rgba(212,168,67,.3)' }}>
          {formatK(user.balance)}
        </span>
      </div>
      <div onClick={onTopup} style={{
        fontSize: '.6rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
        color: '#D4A843', cursor: 'pointer', marginTop: 2,
      }}>+ Пополнить</div>
    </div>
  </div>
);

const PassportCard = ({ variant = 'classic', user, onTopup }: any) => {
  if (variant === 'minimal') return <PassportMinimal user={user} onTopup={onTopup} />;
  if (variant === 'card')    return <PassportCompact user={user} onTopup={onTopup} />;
  return <PassportClassic user={user} onTopup={onTopup} />;
};

// ═══════════════════════════════════════════════════════════════════════════
//  MODE TILES
// ═══════════════════════════════════════════════════════════════════════════
const MODES = [
  {
    id: 'jarvis', label: 'J.A.R.V.I.S', sub: 'Игра с AI',
    tone: 'blue', cta: 'Открыть',
    accent: '#4A9EFF', accent2: '#82CFFF',
    progressLabel: 'Гроссмейстер', progress: 0.68,
    Icon: (p: any) => (
      <svg width={p.size} height={p.size} viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="22" cy="22" r="18"/>
        <circle cx="22" cy="22" r="9"/>
        <circle cx="22" cy="22" r="3" fill="currentColor"/>
        <path d="M22 4v6M22 34v6M4 22h6M34 22h6"/>
      </svg>
    ),
  },
  {
    id: 'battles', label: 'Батлы', sub: 'Ставки 1 на 1',
    tone: 'gold', cta: 'В бой',
    accent: '#D4A843', accent2: '#F0C85A',
    progressLabel: '7 побед подряд', progress: 0.82,
    Icon: (p: any) => (
      <svg width={p.size} height={p.size} viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m14 6 18 18-4 4-18-18zM6 30l8 8M30 14l8-8M30 14l4 4M10 34l4 4"/>
        <path d="m30 28 8 8-4 4-8-8z"/>
      </svg>
    ),
  },
  {
    id: 'cups', label: 'Кубки', sub: 'Турниры',
    tone: 'purple', cta: 'Участвовать',
    accent: '#9B6DFF', accent2: '#C4A8FF',
    progressLabel: '3 активных', progress: 0.45,
    Icon: (p: any) => (
      <svg width={p.size} height={p.size} viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 8h16v8a8 8 0 0 1-16 0zM10 8H6v4a4 4 0 0 0 4 4M34 8h4v4a4 4 0 0 1-4 4M17 32h10M22 24v8M15 40h14"/>
      </svg>
    ),
  },
  {
    id: 'wars', label: 'Войны', sub: 'Страны',
    tone: 'green', cta: 'За Россию',
    accent: '#3DBA7A', accent2: '#6FEDB0',
    progressLabel: 'Россия · 2 место', progress: 0.64,
    Icon: (p: any) => (
      <svg width={p.size} height={p.size} viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 40V6M8 8h20l-3 5 3 5H8"/>
        <circle cx="36" cy="20" r="2" fill="currentColor"/>
      </svg>
    ),
  },
];

const ModeTileClassic = ({ mode, onPick }: any) => {
  const [pressed, setPressed] = React.useState(false);
  const m = mode;
  return (
    <div
      onClick={() => onPick && onPick(m.id)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
      style={{
        position: 'relative', overflow: 'hidden',
        background: `linear-gradient(155deg,rgba(${hexToRgb(m.accent)},.12),rgba(${hexToRgb(m.accent)},0) 60%),#141018`,
        border: `1px solid rgba(${hexToRgb(m.accent)},.28)`,
        borderRadius: 18, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 10,
        minHeight: 150, cursor: 'pointer',
        transform: pressed ? 'scale(.97)' : 'scale(1)',
        transition: 'transform .15s cubic-bezier(.34,1.56,.64,1)',
      }}>
      <div style={{
        color: m.accent2,
        filter: `drop-shadow(0 0 12px rgba(${hexToRgb(m.accent)},.5))`,
        alignSelf: 'center', marginTop: 2,
      }}>
        <m.Icon size={44} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '.85rem', fontWeight: 800, color: '#F4F0E8', letterSpacing: '.01em' }}>{m.label}</div>
        <div style={{ fontSize: '.62rem', color: '#7A7875', marginTop: 2 }}>{m.sub}</div>
      </div>
      <div>
        <div style={{ height: 2.5, borderRadius: 2, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
          <div style={{
            width: `${m.progress * 100}%`, height: '100%',
            background: `linear-gradient(90deg,${m.accent},${m.accent2})`,
            boxShadow: `0 0 8px ${m.accent}`,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <span style={{ fontSize: '.55rem', color: '#7A7875', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>{m.progressLabel}</span>
          <span style={{ fontSize: '.58rem', fontWeight: 800, color: m.accent2, letterSpacing: '.1em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            {m.cta} <ChevRight size={10} />
          </span>
        </div>
      </div>
    </div>
  );
};

const ModeTileCard = ({ mode, onPick }: any) => {
  const m = mode;
  const [pressed, setPressed] = React.useState(false);
  return (
    <div
      onClick={() => onPick && onPick(m.id)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        background: '#141018',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: 16, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 6,
        cursor: 'pointer',
        transform: pressed ? 'scale(.97)' : 'scale(1)',
        transition: 'transform .15s cubic-bezier(.34,1.56,.64,1)',
      }}>
      <div style={{
        color: m.accent2,
        filter: `drop-shadow(0 0 10px rgba(${hexToRgb(m.accent)},.4))`,
      }}>
        <m.Icon size={34} />
      </div>
      <div style={{ fontSize: '.82rem', fontWeight: 800, color: '#F4F0E8', marginTop: 4 }}>{m.label}</div>
      <div style={{ fontSize: '.62rem', color: '#7A7875' }}>{m.progressLabel}</div>
    </div>
  );
};

const ModeList = ({ onPick }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    {MODES.map((m) => (
      <div key={m.id} onClick={() => onPick && onPick(m.id)} style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 2px',
        borderBottom: '1px solid rgba(255,255,255,.05)',
        cursor: 'pointer',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `rgba(${hexToRgb(m.accent)},.1)`,
          border: `1px solid rgba(${hexToRgb(m.accent)},.25)`,
          color: m.accent2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <m.Icon size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '.88rem', fontWeight: 700, color: '#F4F0E8' }}>{m.label}</div>
          <div style={{ fontSize: '.66rem', color: '#7A7875', marginTop: 1 }}>{m.progressLabel}</div>
        </div>
        <ChevRight size={14} style={{ color: '#7A7875' }} />
      </div>
    ))}
  </div>
);

const ModeTiles = ({ variant = 'classic', onPick }: any) => {
  if (variant === 'minimal') return <ModeList onPick={onPick} />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {MODES.map((m) => (
        variant === 'card'
          ? <ModeTileCard key={m.id} mode={m} onPick={onPick} />
          : <ModeTileClassic key={m.id} mode={m} onPick={onPick} />
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  HOME SCREEN
// ═══════════════════════════════════════════════════════════════════════════
const ActiveMatches = ({ variant }: any) => {
  const matches = [
    { initials: 'М',  name: 'Magnus_27',   sub: 'ELO 2340 · твой ход', time: '04:32', tone: 'purple', active: true  },
    { initials: 'АК', name: 'AlexKing_42', sub: 'ELO 1820 · ход соперника', time: '00:47', tone: 'gold',    active: false },
    { initials: 'Н',  name: 'Nina_blitz',  sub: 'ELO 1510 · твой ход', time: '09:11', tone: 'green',   active: true  },
  ];
  if (variant === 'minimal') {
    return (
      <div>
        {matches.map((m, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 2px',
            borderBottom: i === matches.length - 1 ? 'none' : '1px solid rgba(255,255,255,.05)',
            cursor: 'pointer',
          }}>
            <Avatar initials={m.initials} tone={m.tone} size={32} online={m.active} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '.85rem', fontWeight: 700, color: '#F4F0E8' }}>{m.name}</div>
              <div style={{ fontSize: '.66rem', color: '#7A7875', marginTop: 1 }}>{m.sub}</div>
            </div>
            <div style={{ fontSize: '.78rem', fontWeight: 900, color: m.active ? '#F0C85A' : '#7A7875', fontVariantNumeric: 'tabular-nums' }}>{m.time}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {matches.map((m, i) => (
        <ListRow key={i}
          avatar={<Avatar initials={m.initials} tone={m.tone} size={36} online={m.active} />}
          name={m.name}
          sub={<span>{m.sub}</span>}
          right={
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 9999,
              background: m.active ? 'rgba(212,168,67,.12)' : 'rgba(255,255,255,.04)',
              border: `1px solid ${m.active ? 'rgba(212,168,67,.3)' : 'rgba(255,255,255,.08)'}`,
              color: m.active ? '#F0C85A' : '#7A7875',
              fontSize: '.72rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
            }}>
              <ClockIcon size={12} stroke={2} /> {m.time}
            </div>
          }
          last={i === matches.length - 1}
        />
      ))}
    </div>
  );
};

const DailyQuests = () => {
  const quests = [
    { label: 'Выиграть 3 партии',     done: 2, total: 3, reward: 150, complete: false },
    { label: 'Сделать 10 шахов',      done: 10, total: 10, reward: 80, complete: true },
    { label: 'Партия vs J.A.R.V.I.S', done: 0, total: 1, reward: 100, complete: false, tone: 'blue' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {quests.map((q: any, i) => {
        const p = q.done / q.total;
        const tone = q.complete ? '#6FEDB0' : (q.tone === 'blue' ? '#82CFFF' : '#D4A843');
        const bg = q.complete ? '#3DBA7A' : (q.tone === 'blue' ? '#4A9EFF' : '#D4A843');
        return (
          <div key={i} style={{
            padding: '12px 14px',
            background: '#141018',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 14,
            opacity: q.complete ? .68 : 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{
                fontSize: '.82rem', fontWeight: 600, color: '#F4F0E8',
                textDecoration: q.complete ? 'line-through' : 'none',
                textDecorationColor: 'rgba(255,255,255,.3)',
              }}>{q.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                {q.complete ? <CheckIcon size={14} stroke={2.5} style={{ color: '#6FEDB0' }} /> : null}
                <Coin size={13} />
                <span style={{ fontSize: '.78rem', fontWeight: 900, color: tone, fontVariantNumeric: 'tabular-nums' }}>+{q.reward}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1, height: 2.5, borderRadius: 2, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                <div style={{ width: `${p * 100}%`, height: '100%', background: bg, boxShadow: `0 0 6px ${bg}` }} />
              </div>
              <div style={{ fontSize: '.64rem', color: '#7A7875', fontVariantNumeric: 'tabular-nums', minWidth: 32, textAlign: 'right', fontWeight: 700 }}>
                {q.done}/{q.total}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const HomeScreen = ({ variant = 'classic', user, onPlay, onTopup }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
    <FadeIn delay={0}><PassportCard variant={variant} user={user} onTopup={onTopup} /></FadeIn>
    <FadeIn delay={80}>
      <SectionLabel>Режимы игры</SectionLabel>
      <ModeTiles variant={variant} onPick={onPlay} />
    </FadeIn>
    <FadeIn delay={160}>
      <SectionLabel right={<span style={{ color: '#D4A843', fontSize: '.58rem', fontWeight: 800, letterSpacing: '.14em' }}>ВСЕ · 4</span>}>
        Активные партии
      </SectionLabel>
      <ActiveMatches variant={variant} />
    </FadeIn>
    <FadeIn delay={240}>
      <SectionLabel right={<span style={{ color: '#6FEDB0', fontSize: '.58rem', fontWeight: 800, letterSpacing: '.14em' }}>1/3</span>}>
        Ежедневные задания
      </SectionLabel>
      <DailyQuests />
    </FadeIn>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
//  GAME SCREEN V2 (7 состояний)
// ═══════════════════════════════════════════════════════════════════════════
const IconSlot = ({ children, badge, onClick }: any) => (
  <div onClick={onClick} style={{
    width: 34, height: 34, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(255,255,255,.08)',
    color: '#C8C0E0', cursor: 'pointer', position: 'relative',
  }}>
    {children}
    {badge && <div style={{ position: 'absolute', top: 7, right: 7, width: 6, height: 6, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 6px #EF4444' }} />}
  </div>
);

const ThinkingDots = () => (
  <span style={{ display: 'inline-flex', gap: 3, marginLeft: 2 }}>
    {[0,1,2].map(i => (
      <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#C4A8FF', animation: `ccDot 1.1s ease-in-out ${i * 0.15}s infinite` }} />
    ))}
  </span>
);

const GameTopBar = ({ balance, bet, oppElo, onBack }: any) => (
  <div style={{
    flexShrink: 0, padding: '10px .85rem 10px',
    borderBottom: '1px solid rgba(255,255,255,.05)',
    background: 'linear-gradient(180deg,#0D0D12,#0B0B10)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <IconSlot onClick={onBack}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7"/></svg></IconSlot>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 14px', borderRadius: 9999,
        background: 'radial-gradient(120% 200% at 0% 0%,rgba(212,168,67,.22),rgba(212,168,67,0) 60%),#141018',
        border: '1px solid rgba(212,168,67,.3)',
      }}>
        <span style={{ fontSize: '.52rem', fontWeight: 800, letterSpacing: '.14em', color: '#7A7875', textTransform: 'uppercase' }}>Ставка</span>
        <Coin size={14} />
        <span style={{ fontSize: '.85rem', fontWeight: 900, color: '#F0C85A', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 10px rgba(212,168,67,.4)' }}>{bet}</span>
      </div>
      <IconSlot><DotsIcon size={18} /></IconSlot>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '.56rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875' }}>
      <span>ELO соперника · <span style={{ color: '#C4A8FF' }}>{oppElo}</span></span>
      <span>Баланс · <span style={{ color: '#F0C85A' }}><Coin size={10} /> {formatK(balance)}</span></span>
    </div>
  </div>
);

const StateSwitcher = ({ state, onChange }: any) => {
  const opts = [
    { id: 'idle',        label: 'Твой ход' },
    { id: 'thinking',    label: 'Думает' },
    { id: 'check',       label: 'Шах' },
    { id: 'promotion',   label: 'Превращ.' },
    { id: 'draw-offer',  label: 'Ничья' },
    { id: 'result-win',  label: 'Победа' },
    { id: 'result-lose', label: 'Пораж.' },
  ];
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 3,
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.06)',
      borderRadius: 10, overflowX: 'auto',
    }}>
      {opts.map((o) => (
        <div key={o.id} onClick={() => onChange(o.id)} style={{
          flexShrink: 0, padding: '5px 9px', borderRadius: 8, cursor: 'pointer',
          fontSize: '.58rem', fontWeight: 800, letterSpacing: '.06em',
          background: state === o.id ? 'linear-gradient(180deg,#F0C85A,#D4A843)' : 'transparent',
          color: state === o.id ? '#0D0D12' : '#7A7875',
        }}>{o.label}</div>
      ))}
    </div>
  );
};

const GamePlayerCard = ({ side, name, elo, initials, tone, time, captured, active, thinking, yourTurn, inCheck }: any) => {
  const accent = inCheck ? '#EF4444' : (active ? '#3DBA7A' : 'rgba(255,255,255,.08)');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: '#141018',
      border: `1px solid ${accent === 'rgba(255,255,255,.08)' ? accent : 'transparent'}`,
      boxShadow: active || inCheck ? `inset 0 0 0 1.5px ${accent},0 0 16px ${accent}30` : 'none',
      borderRadius: 14,
      animation: active && !thinking ? 'ccTurnPulse 1.8s ease-in-out infinite' : 'none',
      position: 'relative',
    }}>
      <Avatar initials={initials} tone={tone} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '.88rem', fontWeight: 700, color: '#F4F0E8' }}>{name}</span>
          <span style={{ fontSize: '.66rem', color: '#7A7875', fontWeight: 700 }}>ELO {elo}</span>
        </div>
        <div style={{ fontSize: '.72rem', color: '#7A7875', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, minHeight: 14 }}>
          {thinking ? (
            <><span style={{ color: '#C4A8FF', fontWeight: 600 }}>думает</span><ThinkingDots /></>
          ) : yourTurn && side === 'you' ? (
            <>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6FEDB0', boxShadow: '0 0 6px #3DBA7A', animation: 'ccTurnPulse 1.1s ease-in-out infinite' }} />
              <span style={{ color: '#6FEDB0', fontWeight: 700 }}>{inCheck ? 'шах королю' : 'твой ход'}</span>
            </>
          ) : (
            <span style={{ letterSpacing: '.04em', fontFamily: 'ui-monospace,SF Mono,monospace', color: '#7A7875' }}>{captured}</span>
          )}
        </div>
      </div>
      <div style={{
        padding: '10px 14px', borderRadius: 12, minWidth: 96, textAlign: 'center',
        background: active ? 'linear-gradient(180deg,#F0C85A,#D4A843)' : 'rgba(255,255,255,.04)',
        border: active ? 'none' : '1px solid rgba(255,255,255,.06)',
        color: active ? '#0D0D12' : '#F4F0E8',
        fontSize: '1.3rem', fontWeight: 900,
        fontFamily: 'ui-monospace,SF Mono,monospace',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-.02em',
        boxShadow: active ? '0 0 22px rgba(212,168,67,.4)' : 'none',
      }}>{time}</div>
    </div>
  );
};

const ActBtn = ({ children, tone, icon, onClick }: any) => {
  const [pressed, setPressed] = React.useState(false);
  const bg = tone === 'danger' ? 'rgba(239,68,68,.12)' : 'rgba(255,255,255,.05)';
  const bd = tone === 'danger' ? 'rgba(239,68,68,.3)'  : 'rgba(255,255,255,.08)';
  const fg = tone === 'danger' ? '#EF4444' : '#F4F0E8';
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        fontFamily: 'inherit', fontWeight: 700, fontSize: '.74rem',
        background: bg, color: fg, border: `1px solid ${bd}`,
        padding: icon ? 0 : '10px 0', borderRadius: 10, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        transform: pressed ? 'scale(.96)' : 'scale(1)',
        transition: 'transform .15s cubic-bezier(.34,1.56,.64,1)',
      }}>{children}</button>
  );
};

const ActionBar = ({ onSurrender, onDraw, onHistory }: any) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 44px 1.1fr', gap: 6, marginTop: 2 }}>
    <ActBtn tone="danger" onClick={onSurrender}>
      <FlagIcon size={14} stroke={2.2} /> Сдаться
    </ActBtn>
    <ActBtn onClick={onDraw}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 12h8M5 7l-3 5 3 5M19 7l3 5-3 5"/></svg>
      Ничья
    </ActBtn>
    <ActBtn icon>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
    </ActBtn>
    <ActBtn onClick={onHistory}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/></svg>
      История
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
    </ActBtn>
  </div>
);

const Backdrop = ({ children, align, onClose, dim }: any) => (
  <div onClick={onClose} style={{
    position: 'absolute', inset: 0, zIndex: 50,
    background: dim ? 'rgba(0,0,0,.6)' : 'rgba(0,0,0,.45)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: align === 'bottom' ? 'flex-end' : 'center',
    justifyContent: 'center',
    padding: align === 'bottom' ? 0 : 20,
  }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
      {children}
    </div>
  </div>
);

const PromotePick = ({ piece, label, onPick }: any) => {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onClick={onPick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onTouchStart={() => setHover(true)} onTouchEnd={() => setHover(false)}
      style={{
        aspectRatio: '1', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 2,
        background: hover ? 'linear-gradient(180deg,#F0C85A,#D4A843)' : '#DEB887',
        borderRadius: 10, cursor: 'pointer',
        boxShadow: hover ? '0 0 18px rgba(212,168,67,.5)' : '0 2px 8px rgba(0,0,0,.3)',
        transform: hover ? 'scale(1.04)' : 'scale(1)',
        transition: 'all .18s cubic-bezier(.34,1.56,.64,1)',
      }}>
      <img src={PIECE_SRC('white', PIECE_FILE[piece])} width="50" height="50" draggable={false} alt="" />
      <span style={{ fontSize: '.5rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#5C4318' }}>{label}</span>
    </div>
  );
};

const PromotionDialog = ({ onPick }: any) => {
  const pieces = [
    { piece: 'Q', label: 'Ферзь'  },
    { piece: 'R', label: 'Ладья'  },
    { piece: 'B', label: 'Слон'   },
    { piece: 'N', label: 'Конь'   },
  ];
  return (
    <Backdrop>
      <div style={{
        background: 'radial-gradient(120% 100% at 0% 0%,rgba(212,168,67,.14),rgba(212,168,67,0) 55%),#141018',
        border: '1px solid rgba(212,168,67,.3)',
        borderRadius: 20, padding: 18,
        boxShadow: '0 12px 40px rgba(0,0,0,.6)',
        maxWidth: 320, width: '100%',
        animation: 'ccPop .3s cubic-bezier(.34,1.56,.64,1)',
      }}>
        <div style={{ fontSize: '.58rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875', textAlign: 'center' }}>Превращение пешки</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#EAE2CC', textAlign: 'center', marginTop: 6, letterSpacing: '-.02em' }}>Выбери фигуру</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 14 }}>
          {pieces.map((p) => (<PromotePick key={p.piece} {...p} onPick={onPick} />))}
        </div>
      </div>
    </Backdrop>
  );
};

const DrawSheet = ({ onClose }: any) => (
  <Backdrop align="bottom" onClose={onClose}>
    <div style={{
      background: '#141018',
      border: '1px solid rgba(255,255,255,.08)',
      borderTop: '2px solid rgba(212,168,67,.3)',
      borderRadius: '20px 20px 0 0',
      padding: 18,
      animation: 'ccSlideUp .3s cubic-bezier(.4,0,.2,1)',
    }}>
      <div style={{ width: 38, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.1)', margin: '0 auto 12px' }} />
      <div style={{ fontSize: '.58rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#C4A8FF', textAlign: 'center' }}>Предложение ничьей</div>
      <div style={{ fontSize: '.95rem', color: '#F4F0E8', textAlign: 'center', marginTop: 8, lineHeight: 1.4 }}>
        Magnus_27 предлагает ничью.<br/><span style={{ color: '#7A7875', fontSize: '.82rem' }}>Ставки делятся поровну: <Coin size={12} /> <b style={{ color: '#F0C85A', fontWeight: 900 }}>+250</b></span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
        <PressButton onClick={onClose}>Отклонить</PressButton>
        <PressButton primary onClick={onClose}>Принять</PressButton>
      </div>
    </div>
  </Backdrop>
);

const HistorySheet = ({ onClose }: any) => {
  const moves = [
    ['1.', 'e4',    'e5'],
    ['2.', 'Nf3',   'Nc6'],
    ['3.', 'Bb5',   'a6'],
    ['4.', 'Ba4',   'Nf6'],
    ['5.', 'O-O',   'Be7'],
    ['6.', 'Re1',   'b5'],
    ['7.', 'Bb3',   'd6'],
    ['8.', 'c3',    'O-O'],
    ['9.', 'h3',    'Nb8'],
    ['10.','d4',    'Nbd7'],
  ];
  return (
    <Backdrop align="bottom" onClose={onClose}>
      <div style={{
        background: '#141018',
        border: '1px solid rgba(255,255,255,.08)',
        borderTop: '2px solid rgba(212,168,67,.3)',
        borderRadius: '20px 20px 0 0',
        padding: 18, maxHeight: '75%',
        animation: 'ccSlideUp .3s cubic-bezier(.4,0,.2,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ width: 38, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.1)', margin: '0 auto 12px', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#EAE2CC', letterSpacing: '-.02em' }}>История ходов</div>
          <span style={{ fontSize: '.58rem', color: '#7A7875', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' }}>Испанка</span>
        </div>
        <div style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: '32px 1fr 1fr', rowGap: 2, fontFamily: 'ui-monospace,SF Mono,monospace' }}>
          {moves.map(([n, w, b], i) => (
            <React.Fragment key={n}>
              <div style={{ fontSize: '.74rem', color: '#7A7875', padding: '6px 0' }}>{n}</div>
              <div style={{ fontSize: '.82rem', color: '#F4F0E8', padding: '6px 8px', background: i % 2 ? 'rgba(255,255,255,.02)' : 'transparent', borderRadius: 4 }}>{w}</div>
              <div style={{ fontSize: '.82rem', color: '#C8C0E0', padding: '6px 8px', background: i % 2 ? 'rgba(255,255,255,.02)' : 'transparent', borderRadius: 4 }}>{b}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </Backdrop>
  );
};

const ResultOverlay = ({ win, onClose }: any) => (
  <Backdrop onClose={onClose} dim>
    <div style={{
      textAlign: 'center', padding: '30px 24px',
      background: win
        ? 'radial-gradient(120% 80% at 50% 0%,rgba(212,168,67,.24),rgba(212,168,67,0) 60%),#141018'
        : 'radial-gradient(120% 80% at 50% 0%,rgba(239,68,68,.2),rgba(239,68,68,0) 60%),#141018',
      border: win ? '1px solid rgba(212,168,67,.35)' : '1px solid rgba(239,68,68,.3)',
      borderRadius: 20,
      boxShadow: win ? '0 0 60px rgba(212,168,67,.25)' : '0 0 40px rgba(239,68,68,.15)',
      maxWidth: 320, width: '100%',
      animation: 'ccPop .4s cubic-bezier(.34,1.56,.64,1)',
    }}>
      <div style={{ fontSize: '.6rem', fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', color: win ? '#F0C85A' : '#EF4444' }}>
        {win ? 'Победа' : 'Поражение'}
      </div>
      <div style={{ marginTop: 10, fontSize: '2rem', fontWeight: 900, letterSpacing: '-.03em', color: '#EAE2CC', lineHeight: 1.1 }}>
        {win ? 'Шах и мат!' : 'Мат'}
      </div>
      {win && (
        <div style={{ margin: '20px auto 0', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Coin size={36} />
          <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#F0C85A', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.03em', textShadow: '0 0 20px rgba(212,168,67,.5)' }}>+1,000</span>
        </div>
      )}
      <div style={{
        margin: '18px auto 0', display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '6px 14px', borderRadius: 9999,
        background: win ? 'rgba(61,186,122,.1)' : 'rgba(239,68,68,.1)',
        border: `1px solid ${win ? 'rgba(61,186,122,.25)' : 'rgba(239,68,68,.25)'}`,
        color: win ? '#6FEDB0' : '#EF4444', fontWeight: 800, fontSize: '.82rem',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {win ? <ArrowUpIcon size={13} stroke={2.4} /> : <ArrowDownIcon size={13} stroke={2.4} />}
        ELO {win ? '+12' : '−8'} → <span style={{ color: '#EAE2CC' }}>{win ? '1832' : '1812'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 22 }}>
        <PressButton onClick={onClose}>Разбор</PressButton>
        <PressButton primary onClick={onClose}>Реванш</PressButton>
      </div>
    </div>
  </Backdrop>
);

const GameScreenV2 = ({ onBack }: any) => {
  const [state, setState] = React.useState('idle');
  const [historyOpen, setHistoryOpen] = React.useState(false);

  const position = state === 'check' ? CHECK_POSITION : SAMPLE_POSITION;
  const lastMove = state === 'check' ? { from: 'd8', to: 'h4' } : { from: 'f1', to: 'b5' };
  const dots = state === 'idle' ? ['a4', 'c4', 'a6'] : [];
  const captures = state === 'idle' ? ['c6'] : [];
  const checkSq = state === 'check' ? 'e1' : null;

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <GameTopBar balance={12500} bet={500} oppElo={2340} onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px .85rem 80px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <StateSwitcher state={state} onChange={setState} />
        <GamePlayerCard side="opponent" name="Magnus_27" elo={2340} initials="М" tone="purple"
          time="08:42" captured="♟♟♞"
          thinking={state === 'thinking'} active={state === 'thinking'} />
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
          <ChessBoardV2 position={position} size={330}
            lastMove={lastMove} dots={dots} captures={captures} checkSq={checkSq} />
        </div>
        <GamePlayerCard side="you" name="AlexKing_42" elo={1820} initials="АК" tone="gold"
          time="03:14" captured="♙♙"
          yourTurn={state === 'idle' || state === 'check'}
          active={state === 'idle'} inCheck={state === 'check'} />
        <ActionBar
          onSurrender={() => setState('result-lose')}
          onDraw={() => setState('draw-offer')}
          onHistory={() => setHistoryOpen(true)} />
      </div>
      {state === 'promotion' && <PromotionDialog onPick={() => setState('idle')} />}
      {state === 'draw-offer' && <DrawSheet onClose={() => setState('idle')} />}
      {(state === 'result-win' || state === 'result-lose') && (
        <ResultOverlay win={state === 'result-win'} onClose={() => setState('idle')} />
      )}
      {historyOpen && <HistorySheet onClose={() => setHistoryOpen(false)} />}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  BATTLES SCREEN
// ═══════════════════════════════════════════════════════════════════════════
const BattlesScreen = () => {
  const tournaments = [
    { name: 'Weekend Cup · 5+0', players: 128, prize: 12500, starts: '15:00', tone: 'purple' },
    { name: 'Blitz Fever · 3+0', players: 64,  prize: 4800,  starts: 'идёт', tone: 'purple', live: true },
    { name: 'Classic Masters',   players: 32,  prize: 25000, starts: 'Зв 18:30', tone: 'gold' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionLabel right={<Chip tone="purple" dot>3 активных</Chip>}>Турниры</SectionLabel>
      {tournaments.map((t: any, i) => (
        <div key={i} style={{
          padding: '14px', borderRadius: 16,
          background: `linear-gradient(155deg,rgba(${hexToRgb(t.tone === 'purple' ? '#9B6DFF' : '#D4A843')},.12),rgba(${hexToRgb(t.tone === 'purple' ? '#9B6DFF' : '#D4A843')},0) 55%),#141018`,
          border: `1px solid rgba(${hexToRgb(t.tone === 'purple' ? '#9B6DFF' : '#D4A843')},.25)`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '.94rem', fontWeight: 800, color: '#F4F0E8' }}>{t.name}</div>
              <div style={{ fontSize: '.68rem', color: '#7A7875', marginTop: 3 }}>{t.players} игроков</div>
            </div>
            {t.live ? <Chip tone="green" dot>LIVE</Chip> : <span style={{ fontSize: '.72rem', color: '#C8C0E0' }}>{t.starts}</span>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
            <div>
              <div style={{ fontSize: '.52rem', fontWeight: 800, letterSpacing: '.14em', color: '#7A7875', textTransform: 'uppercase' }}>Призовой</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <Coin size={18} />
                <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#F0C85A', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 12px rgba(212,168,67,.3)' }}>{t.prize.toLocaleString('en-US')}</span>
              </div>
            </div>
            <PressButton primary>{t.live ? 'Смотреть' : 'Записаться'}</PressButton>
          </div>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  WARS SCREEN
// ═══════════════════════════════════════════════════════════════════════════
const WarsScreen = () => {
  const teams = [
    { flag: '🇷🇺', name: 'Россия',  players: 4820, win: 68, rank: 2 },
    { flag: '🇺🇦', name: 'Украина', players: 2140, win: 71, rank: 1 },
    { flag: '🇰🇿', name: 'Казахстан', players: 980,  win: 62, rank: 3 },
    { flag: '🇧🇾', name: 'Беларусь',  players: 640,  win: 58, rank: 4 },
    { flag: '🇲🇩', name: 'Молдова',   players: 280,  win: 54, rank: 5 },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        padding: 14, borderRadius: 18,
        background: 'linear-gradient(155deg,rgba(61,186,122,.14),rgba(61,186,122,0) 60%),#141018',
        border: '1px solid rgba(61,186,122,.28)',
      }}>
        <div style={{ fontSize: '.58rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#6FEDB0' }}>Твоя команда</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#F4F0E8', marginTop: 4, letterSpacing: '-.02em' }}>Россия · 2 место</div>
        <div style={{ height: 2.5, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden', marginTop: 10 }}>
          <div style={{ width: '68%', height: '100%', background: 'linear-gradient(90deg,#3DBA7A,#6FEDB0)', boxShadow: '0 0 8px #3DBA7A' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '.64rem', color: '#7A7875', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
          <span>Очки: 18,240</span>
          <span>до 1-го: 3,180</span>
        </div>
      </div>
      <SectionLabel>Рейтинг стран</SectionLabel>
      <div>
        {teams.map((t, i) => (
          <div key={t.name} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 2px',
            borderBottom: i === teams.length - 1 ? 'none' : '1px solid rgba(255,255,255,.05)',
          }}>
            <div style={{ fontSize: '.82rem', fontWeight: 900, color: t.rank <= 3 ? '#F0C85A' : '#7A7875', width: 20, fontVariantNumeric: 'tabular-nums' }}>
              {t.rank}
            </div>
            <div style={{ fontSize: 22 }}>{t.flag}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '.88rem', fontWeight: 700, color: '#F4F0E8' }}>{t.name}</div>
              <div style={{ fontSize: '.66rem', color: '#7A7875' }}>{t.players.toLocaleString('en-US')} игроков</div>
            </div>
            <div style={{ fontSize: '.78rem', fontWeight: 900, color: '#6FEDB0', fontVariantNumeric: 'tabular-nums' }}>{t.win}%</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  PROFILE SCREEN
// ═══════════════════════════════════════════════════════════════════════════
const ProfileScreen = ({ user }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 0 4px' }}>
      <PassportAvatar size={96} initials={user.initials} />
      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#F4F0E8', marginTop: 4 }}>{user.name}</div>
      <div style={{ display: 'flex', gap: 5 }}>
        <Chip tone="gold">{user.rank}</Chip>
        <Chip tone="blue">J.A.R.V.I.S · {user.jarvisRank}</Chip>
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
      {[
        { label: 'ELO',  value: user.elo, tone: '#D4A843' },
        { label: 'Побед', value: 142, tone: '#6FEDB0' },
        { label: 'Рейтинг', value: '#48', tone: '#C4A8FF' },
      ].map((s) => (
        <div key={s.label} style={{
          padding: '12px 8px', textAlign: 'center',
          background: '#141018', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14,
        }}>
          <div style={{ fontSize: '.5rem', fontWeight: 800, letterSpacing: '.14em', color: '#7A7875', textTransform: 'uppercase' }}>{s.label}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: s.tone, fontVariantNumeric: 'tabular-nums', marginTop: 3, letterSpacing: '-.02em' }}>{s.value}</div>
        </div>
      ))}
    </div>
    <SectionLabel>Кошелёк</SectionLabel>
    <div style={{
      padding: 14, borderRadius: 16,
      background: 'radial-gradient(120% 100% at 0% 0%,rgba(212,168,67,.14),rgba(212,168,67,0) 55%),#120E04',
      border: '1px solid rgba(212,168,67,.22)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '.52rem', fontWeight: 800, letterSpacing: '.14em', color: '#7A7875', textTransform: 'uppercase' }}>Баланс</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <Coin size={22} />
            <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#F0C85A', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em', textShadow: '0 0 14px rgba(212,168,67,.35)' }}>{formatK(user.balance)}</span>
          </div>
          <div style={{ fontSize: '.68rem', color: '#7A7875', marginTop: 3 }}>≈ 0.214 TON</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <PressButton style={{ padding: '8px 10px' }}><ArrowDownIcon size={14} stroke={2.2}/></PressButton>
          <PressButton primary style={{ padding: '8px 10px' }}><ArrowUpIcon size={14} stroke={2.2}/></PressButton>
        </div>
      </div>
    </div>
    <SectionLabel>Настройки</SectionLabel>
    <div>
      {[
        { label: 'Доска', value: 'Premium Oak' },
        { label: 'Стиль фигур', value: 'Classic' },
        { label: 'Звук', value: 'Вкл.' },
        { label: 'J.A.R.V.I.S уровень', value: 'Гроссмейстер' },
      ].map((s, i, a) => (
        <div key={s.label} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '13px 2px',
          borderBottom: i === a.length - 1 ? 'none' : '1px solid rgba(255,255,255,.05)',
        }}>
          <span style={{ fontSize: '.86rem', color: '#F4F0E8' }}>{s.label}</span>
          <span style={{ fontSize: '.82rem', color: '#7A7875', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {s.value} <ChevRight size={12} />
          </span>
        </div>
      ))}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
//  BOTTOM NAV
// ═══════════════════════════════════════════════════════════════════════════
const BottomNavV2 = ({ active, onChange }: any) => {
  const items = [
    { id: 'home',     label: 'Главная', Icon: HomeIcon },
    { id: 'game',     label: 'Игра',    Icon: GameIcon },
    { id: 'battles',  label: 'Батлы',   Icon: BattlesIcon },
    { id: 'wars',     label: 'Войны',   Icon: WarsIcon },
    { id: 'profile',  label: 'Профиль', Icon: ProfileIcon },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
      background: 'linear-gradient(180deg,#141018 0%,#0F0C14 100%)',
      borderTop: '1px solid rgba(255,255,255,.05)',
      borderRadius: '20px 20px 0 0',
      padding: '10px 6px 14px',
      boxShadow: '0 -8px 24px rgba(0,0,0,.4)',
      paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
      zIndex: 10,
    }}>
      {items.map(({ id, label, Icon }) => {
        const isActive = id === active;
        return (
          <div key={id} onClick={() => onChange(id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '4px 0', color: isActive ? '#D4A843' : '#7A7875',
            position: 'relative', cursor: 'pointer',
            transition: 'color .2s',
          }}>
            {isActive && (
              <div style={{
                position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                width: 24, height: 3, borderRadius: 3,
                background: '#D4A843', boxShadow: '0 0 10px rgba(212,168,67,.6)',
              }} />
            )}
            <Icon size={22} />
            <span style={{ fontSize: '.54rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  SHELL (App)
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_USER = {
  name: 'AlexKing_42',
  initials: 'АК',
  elo: 1450,
  rank: 'Сержант',
  jarvisRank: 'Гроссмейстер',
  balance: 12500,
};

const VariantSwitch = ({ value, onChange }: any) => {
  const opts = [
    { id: 'classic', label: 'Кл.' },
    { id: 'card',    label: 'Крт.' },
    { id: 'minimal', label: 'Мин.' },
  ];
  return (
    <div style={{
      display: 'inline-flex', padding: 2,
      background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(255,255,255,.08)',
      borderRadius: 9999, fontSize: '.58rem', fontWeight: 800,
      letterSpacing: '.06em',
    }}>
      {opts.map((o) => (
        <div key={o.id} onClick={() => onChange(o.id)} style={{
          padding: '5px 9px', borderRadius: 9999, cursor: 'pointer',
          background: value === o.id ? 'linear-gradient(180deg,#F0C85A,#D4A843)' : 'transparent',
          color: value === o.id ? '#0D0D12' : '#7A7875',
          boxShadow: value === o.id ? '0 0 10px rgba(212,168,67,.3)' : 'none',
          transition: 'color .15s,background .15s',
        }}>{o.label}</div>
      ))}
    </div>
  );
};

const Flash = ({ children }: any) => (
  <div style={{
    position: 'absolute', bottom: 100, left: 0, right: 0,
    display: 'flex', justifyContent: 'center', pointerEvents: 'none',
    zIndex: 20,
  }}>
    <div style={{
      padding: '10px 16px', borderRadius: 12,
      background: 'rgba(20,16,24,.92)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(212,168,67,.3)',
      color: '#F4F0E8', fontSize: '.76rem', fontWeight: 600,
      boxShadow: '0 8px 24px rgba(0,0,0,.5)',
      animation: 'ccPop .3s cubic-bezier(.34,1.56,.64,1)',
    }}>{children}</div>
  </div>
);

export const DesignV2Page: React.FC = () => {
  const navigate = useNavigate();
  const [screen, setScreen] = React.useState<string>(() => localStorage.getItem('cc-v2-screen') || 'home');
  const [variant, setVariant] = React.useState<string>(() => localStorage.getItem('cc-v2-variant') || 'classic');
  const [flash, setFlash] = React.useState<string | null>(null);
  const user = DEFAULT_USER;

  React.useEffect(() => { localStorage.setItem('cc-v2-screen', screen); }, [screen]);
  React.useEffect(() => { localStorage.setItem('cc-v2-variant', variant); }, [variant]);

  const handlePlay = (id: string) => {
    if (id === 'battles' || id === 'cups')  { setScreen('battles'); return; }
    if (id === 'wars')    { setScreen('wars'); return; }
    if (id === 'jarvis')  { setFlash('J.A.R.V.I.S запускается…'); setTimeout(() => setFlash(null), 1400); setScreen('game'); return; }
    setScreen('game');
  };
  const handleTopup = () => { setFlash('Пополнение открыто'); setTimeout(() => setFlash(null), 1400); };

  const titles: any = { home: 'Главная', game: 'Партия', battles: 'Батлы', wars: 'Войны', profile: 'Профиль' };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0D0D12', color: '#F4F0E8',
      fontFamily: 'Inter,sans-serif', display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes ccPop { 0% { opacity: 0; transform: translateY(8px) scale(.96); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes ccSlideUp { 0% { transform: translateY(100%); } 100% { transform: translateY(0); } }
        @keyframes ccTurnPulse { 0%, 100% { box-shadow: 0 0 16px rgba(61,186,122,.2); } 50% { box-shadow: 0 0 26px rgba(61,186,122,.45); } }
        @keyframes ccDot { 0%, 80%, 100% { opacity: .3; transform: scale(.8); } 40% { opacity: 1; transform: scale(1.2); } }
        .cc-v2-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Top bar — уходить назад в основное приложение */}
      <div style={{
        height: 'calc(18px + env(safe-area-inset-top, 0px))',
        background: 'linear-gradient(180deg,#0B0B10,#0D0D12)',
        borderBottom: '1px solid rgba(255,255,255,.04)',
        flexShrink: 0,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 12px 2px',
      }}>
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: 'none', color: '#7A7875',
          fontSize: '.58rem', letterSpacing: '.14em', textTransform: 'uppercase',
          fontWeight: 700, cursor: 'pointer', padding: 0,
        }}>← Выйти</button>
        <span style={{ fontSize: '.58rem', letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875', fontWeight: 700 }}>
          V2 · {titles[screen]}
        </span>
        <span style={{ width: 50 }} />
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: screen === 'game' ? 0 : '8px .85rem 94px',
        scrollbarWidth: 'none',
      }} className="cc-v2-scroll">
        {screen === 'home' && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 2px 12px',
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#EAE2CC', letterSpacing: '-.02em', lineHeight: 1.15 }}>Главная</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <VariantSwitch value={variant} onChange={setVariant} />
                <IconSlot><SearchIcon size={18} /></IconSlot>
                <IconSlot badge><BellIcon size={18} /></IconSlot>
              </div>
            </div>
            <HomeScreen variant={variant} user={user} onPlay={handlePlay} onTopup={handleTopup} />
          </>
        )}

        {screen !== 'home' && screen !== 'game' && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 2px 14px',
          }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#EAE2CC', letterSpacing: '-.02em' }}>{titles[screen]}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <IconSlot><SearchIcon size={18} /></IconSlot>
              <IconSlot><BellIcon size={18} /></IconSlot>
            </div>
          </div>
        )}

        {screen === 'game'    && <GameScreenV2 onBack={() => setScreen('home')} />}
        {screen === 'battles' && <BattlesScreen />}
        {screen === 'wars'    && <WarsScreen />}
        {screen === 'profile' && <ProfileScreen user={user} />}
      </div>

      <BottomNavV2 active={screen} onChange={setScreen} />
      {flash && <Flash>{flash}</Flash>}
    </div>
  );
};

export default DesignV2Page;
