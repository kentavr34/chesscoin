import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { getSocket } from '@/api/socket';
import { PageLayout } from '@/components/layout/PageLayout';
import { JarvisPlayModal } from '@/components/ui/JarvisPlayModal';
import { AttemptsModal } from '@/components/ui/AttemptsModal';
import { ActiveSessionsModal } from '@/components/ui/ActiveSessionsModal';
import { type JarvisLevel } from '@/components/ui/JarvisModal';
import { useT } from '@/i18n/useT';

// ── SVG иконки ────────────────────────────────────────────────────────────────

const IcoJarvis = ({ size = 28 }: { size?: number }) => (
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

const IcoBattle = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <path d="M5 5l5 2-2 5" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 5l13 13" stroke="#D4A843" strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M15.5 17.5l2 1.5 1.5-1.5" stroke="#D4A843" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="19.5" cy="19.5" r="3" stroke="#D4A843" strokeWidth="1.3"/>
    <path d="M23 5l-5 2 2 5" stroke="#F0C85A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M23 5L10 18" stroke="#F0C85A" strokeWidth="1.6" strokeLinecap="round"/>
    <circle cx="8.5" cy="19.5" r="3" stroke="#F0C85A" strokeWidth="1.3"/>
    <path d="M5 24l4-4M19 24l4-4" stroke="#D4A843" strokeWidth="1.1" strokeLinecap="round" opacity=".5"/>
  </svg>
);

const IcoTrophy = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <path d="M9 4h10v8a5 5 0 01-10 0V4z" stroke="#9B6DFF" strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M9 7H5.5a2 2 0 000 4H9" stroke="#9B6DFF" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M19 7h3.5a2 2 0 010 4H19" stroke="#9B6DFF" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M14 17v4M10 24h8" stroke="#9B6DFF" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M11 21h6" stroke="#9B6DFF" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M11.5 8.5l1.5 1.5 3-3.5" stroke="#C4A8FF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IcoWars = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="9.5" stroke="#3DBA7A" strokeWidth="1.4"/>
    <ellipse cx="14" cy="14" rx="4" ry="9.5" stroke="#3DBA7A" strokeWidth="1.2"/>
    <path d="M4.5 14h19M14 4.5c-3 3-3 6 0 9s3 6 0 9.5" stroke="#3DBA7A" strokeWidth="1.2" strokeLinecap="round"/>
    <circle cx="14" cy="14" r="2" fill="#3DBA7A" opacity=".5"/>
    <path d="M8 7.5l1.5 2M20 7.5l-1.5 2M8 20.5l1.5-2M20 20.5l-1.5-2" stroke="#6FEDB0" strokeWidth="1" strokeLinecap="round" opacity=".6"/>
  </svg>
);

const IcoCoin = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="9" fill="url(#coinGrad)" stroke="#A07830" strokeWidth=".8"/>
    <circle cx="10" cy="10" r="6.5" stroke="rgba(255,255,255,.15)" strokeWidth=".5"/>
    <text x="10" y="14" textAnchor="middle" fontSize="9" fontWeight="800" fontFamily="serif" fill="#120E04">₿</text>
    <defs>
      <radialGradient id="coinGrad" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#F0C85A"/>
        <stop offset="60%" stopColor="#D4A843"/>
        <stop offset="100%" stopColor="#8A6020"/>
      </radialGradient>
    </defs>
  </svg>
);

const IcoAvatar = ({ src, initial }: { src?: string; initial?: string }) => (
  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {src
      ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
      : (
        <svg viewBox="0 0 48 48" fill="none" style={{ width: '60%', height: '60%' }}>
          {/* шахматный король-силуэт */}
          <path d="M24 6v4M22 8h4" stroke="#D4A843" strokeWidth="1.8" strokeLinecap="round"/>
          <rect x="20" y="11" width="8" height="3" rx="1" fill="#D4A843" opacity=".8"/>
          <path d="M17 14h14l-2 10H19L17 14z" fill="#D4A843" opacity=".7"/>
          <path d="M14 24h20l-2 8H16l-2-8z" fill="#D4A843" opacity=".55"/>
          <ellipse cx="24" cy="36" rx="10" ry="3" fill="#D4A843" opacity=".3"/>
          {initial && (
            <text x="24" y="38" textAnchor="middle" fontSize="10" fontWeight="800" fontFamily="'Cinzel',serif" fill="#F0C85A">
              {initial}
            </text>
          )}
        </svg>
      )
    }
  </div>
);

// ── Компонент ──────────────────────────────────────────────────────────────────
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { upsertSession, sessions } = useGameStore();
  const t = useT();

  const activeSessions = sessions.filter(s =>
    s.status === 'IN_PROGRESS' ||
    (s.status === 'WAITING_FOR_OPPONENT' && s.type !== 'BATTLE')
  );

  const [showJarvisModal, setShowJarvisModal] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [showAttemptsModal, setShowAttemptsModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [pressedBlk, setPressedBlk] = useState<string | null>(null);
  const [targetAt, setTargetAt] = useState<number | null>(null);

  // Конвертируем статичное поле сервера в абсолютный timestamp один раз при изменении user
  useEffect(() => {
    if (user?.nextAttemptAt) {
      setTargetAt(new Date(user.nextAttemptAt).getTime());
    } else if (user?.nextRestoreSeconds && user.nextRestoreSeconds > 0) {
      setTargetAt(Date.now() + user.nextRestoreSeconds * 1000);
    } else {
      setTargetAt(null);
    }
  }, [user?.nextAttemptAt, user?.nextRestoreSeconds]);

  // Тикаем каждую секунду от абсолютного timestamp
  useEffect(() => {
    if (!targetAt) { setTimeLeft(''); return; }
    const update = () => {
      const secs = Math.max(0, Math.floor((targetAt - Date.now()) / 1000));
      if (secs <= 0) { setTimeLeft(''); return; }
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      setTimeLeft(h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetAt]);

  const handleGameStart = (color: 'white' | 'black', timeMinutes: number, level: JarvisLevel) => {
    const socket = getSocket();

    // Таймаут на случай если сокет не отвечает (нет бэкенда в dev)
    const timeout = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('chesscoin:toast', {
        detail: { text: 'Нет соединения с сервером. Запусти бэкенд.', type: 'error' }
      }));
    }, 5000);

    socket.emit('game:create:bot',
      { color, botLevel: level.level, timeSeconds: timeMinutes * 60 },
      (res: Record<string, unknown>) => {
        clearTimeout(timeout);
        if (res?.ok && res?.session) {
          const session = res.session as import('@/types').GameSession;
          upsertSession(session);
          navigate(`/game/${session.id}`);
        } else {
          window.dispatchEvent(new CustomEvent('chesscoin:toast', {
            detail: { text: res?.error as string || 'Ошибка создания игры', type: 'error' }
          }));
        }
      }
    );
  };

  const handleBlockClick = (key: string, action: () => void) => {
    setPressedBlk(key);
    setTimeout(() => setPressedBlk(null), 200);
    action();
  };

  if (!user) return <PageLayout><div style={{ padding: 24, color: '#fff' }}>Загрузка...</div></PageLayout>;

  const jarvisLevel = user.jarvisLevel || 1;
  const jarvisName = t.jarvis.levels[Math.min(jarvisLevel - 1, 19)].name;
  const rankLabel = user.militaryRank?.label || 'Новобранец';

  // 1) Имя — максимум 14 символов
  const displayName = (user.firstName || 'Player').slice(0, 14);

  // 2) Баланс — 3 цифры + буква (К / М)
  const formatBalance = (n: number): string => {
    if (n >= 1_000_000) {
      const m = n / 1_000_000;
      if (m >= 100) return `${Math.round(m)}М`;
      if (m >= 10)  return `${parseFloat(m.toFixed(1))}М`;
      return `${parseFloat(m.toFixed(2))}М`;
    }
    const k = n / 1000;
    if (k >= 100) return `${Math.round(k)}К`;
    if (k >= 10)  return `${parseFloat(k.toFixed(1))}К`;
    return `${parseFloat(k.toFixed(2))}К`;
  };
  const formattedBalance = formatBalance(Math.max(parseInt(user.balance || '0'), 0));

  const attempts = user.attempts ?? 3;
  const maxAttempts = user.maxAttempts ?? 3;
  const initial = user.firstName?.[0]?.toUpperCase();
  const countryFlag = user.countryMember?.country?.flag;

  const blkScale = (key: string) => pressedBlk === key ? 'scale(.94)' : 'scale(1)';

  return (
    <PageLayout noHeader>
      {/* Плавающая кнопка — переход на превью нового дизайна (v2) */}
      <div
        onClick={() => navigate('/design-v2')}
        style={{
          position: 'fixed', right: 12, top: 'calc(env(safe-area-inset-top,0px) + 68px)',
          zIndex: 9999, padding: '8px 12px', borderRadius: 999,
          background: 'linear-gradient(180deg,#F0C85A,#D4A843)',
          color: '#0D0D12', fontSize: 12, fontWeight: 800,
          letterSpacing: '.02em', cursor: 'pointer',
          boxShadow: '0 6px 20px rgba(212,168,67,.4)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >🎨 Новый дизайн</div>
      <style>{`
        @keyframes cc-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.7)}}
        @keyframes cc-fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes cc-popIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}

        .hp-shell{animation:cc-fadein .32s ease both}

        .hp-hbal-cell::before{
          content:'';position:absolute;top:0;left:10%;right:10%;height:.5px;
          background:linear-gradient(90deg,transparent,rgba(212,168,67,.22),transparent);
        }

        .hp-blk{
          transition:transform .15s cubic-bezier(.34,1.56,.64,1), box-shadow .15s;
          will-change:transform;
        }
        .hp-blk:active{transform:scale(.93) !important;box-shadow:none !important}

        .hp-blk::before{
          content:'';position:absolute;top:-20px;right:-20px;
          width:80px;height:80px;border-radius:50%;pointer-events:none;
        }
        .hp-blk.jarvis::before{background:radial-gradient(circle,rgba(74,158,255,.11) 0%,transparent 70%)}
        .hp-blk.batly::before {background:radial-gradient(circle,rgba(212,168,67,.10) 0%,transparent 70%)}
        .hp-blk.cups::before  {background:radial-gradient(circle,rgba(155,109,255,.11) 0%,transparent 70%)}
        .hp-blk.wars::before  {background:radial-gradient(circle,rgba(61,186,122,.10) 0%,transparent 70%)}

        .hp-blk-btn{transition:background .15s, transform .1s}
        .hp-blk-btn:active{transform:scale(.92);filter:brightness(1.15)}

        .hp-quests::before{
          content:'';position:absolute;top:0;left:0;right:0;height:1.5px;
          background:linear-gradient(90deg,transparent,rgba(155,109,255,.35),rgba(212,168,67,.2),rgba(155,109,255,.35),transparent);
        }

        .hp-hbal-plus{transition:transform .12s, background .12s}
        .hp-hbal-plus:active{transform:scale(.85);background:rgba(212,168,67,.22) !important}

        .hp-hero{animation:cc-popIn .28s ease both}
        .hp-blocks{animation:cc-fadein .35s .08s ease both;opacity:0;animation-fill-mode:forwards}
        .hp-quests-wrap{animation:cc-fadein .35s .15s ease both;opacity:0;animation-fill-mode:forwards}
      `}</style>

      {showJarvisModal && (
        <JarvisPlayModal
          currentJarvisLevel={jarvisLevel}
          userAttempts={user.attempts ?? 0}
          maxAttempts={user.maxAttempts ?? 3}
          nextRestoreSeconds={user.nextRestoreSeconds}
          onStart={handleGameStart}
          onClose={() => setShowJarvisModal(false)}
          onBuyAttempts={() => setShowAttemptsModal(true)}
        />
      )}
      {showAttemptsModal && (
        <AttemptsModal user={user} onClose={() => setShowAttemptsModal(false)} />
      )}
      {showSessionsModal && activeSessions.length > 0 && (
        <ActiveSessionsModal sessions={activeSessions} onClose={() => setShowSessionsModal(false)} />
      )}

      <div className="hp-shell" style={{ background: '#0D0D12', paddingTop: 'env(safe-area-inset-top, 0px)' }}>

        {/* ══ ПАСПОРТНАЯ КАРТОЧКА ══ */}
        <div className="hp-hero" style={{
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(175deg,#120E04 0%,#0E0E14 100%)',
          margin: '1.1rem .85rem 0',
          borderRadius: 20,
          border: '.5px solid rgba(212,168,67,.28)',
          boxShadow: '0 6px 36px rgba(0,0,0,.55),inset 0 0 0 .5px rgba(212,168,67,.06)',
        }}>
          {/* шахматная доска фон */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 20,
            backgroundImage: `
              linear-gradient(45deg,rgba(212,168,67,.02) 25%,transparent 25%),
              linear-gradient(-45deg,rgba(212,168,67,.02) 25%,transparent 25%),
              linear-gradient(45deg,transparent 75%,rgba(212,168,67,.02) 75%),
              linear-gradient(-45deg,transparent 75%,rgba(212,168,67,.02) 75%)`,
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0,0 12px,12px -12px,-12px 0',
            pointerEvents: 'none',
          }} />
          {/* золотое сияние */}
          <div style={{
            position: 'absolute', top: -30, left: -10, width: 180, height: 180,
            background: 'radial-gradient(ellipse,rgba(212,168,67,.12) 0%,transparent 68%)',
            pointerEvents: 'none',
          }} />

          {/* top row убран — ⋯ и "В сети" удалены */}

          {/* паспорт: аватар | имя+ело | бейджи */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '.8rem',
            padding: '.9rem .9rem 1.15rem', position: 'relative', zIndex: 2,
          }}>
            {/* аватар с золотым кольцом (+20% → 80px) */}
            <div style={{ flexShrink: 0 }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'conic-gradient(from 0deg,#A07830,#D4A843,#F0C85A,#D4A843,#A07830,#D4A843,#F0C85A,#A07830)',
                padding: 2.5,
                boxShadow: '0 0 20px rgba(212,168,67,.35),0 0 48px rgba(212,168,67,.1)',
              }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  background: 'linear-gradient(145deg,#221908,#2E2210)',
                  overflow: 'hidden',
                }}>
                  <IcoAvatar src={user.avatar ?? undefined} initial={initial} />
                </div>
              </div>
            </div>

            {/* имя + флаг + elo */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {/* имя + флаг страны */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                <div style={{
                  fontSize: '1.08rem', fontWeight: 700,
                  color: '#F4F0E8', letterSpacing: '.04em', lineHeight: 1.1,
                  textShadow: '0 2px 12px rgba(212,168,67,.2)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {displayName}
                </div>
                {countryFlag && (
                  <span style={{ fontSize: '.9rem', lineHeight: 1, flexShrink: 0 }}>{countryFlag}</span>
                )}
              </div>
              {/* ELO — жёлтый, +3 единицы */}
              <div style={{ fontSize: '.78rem', fontWeight: 700, letterSpacing: '.04em', marginTop: '.22rem' }}>
                <span style={{ color: '#928E88' }}>ELO </span>
                <span style={{ color: '#F0C85A', fontWeight: 900 }}>{(user.elo || 1000).toLocaleString()}</span>
              </div>
            </div>

            {/* бейджи: лейбл над строкой icon+box, icon одинаковой ширины → текст выровнен */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '.55rem' }}>
              {/* Звание */}
              <div>
                {/* лейбл: отступ = icon(20px) + gap(4px) + boxPad(8px) = 32px → точно над текстом */}
                <div style={{ fontSize: '.37rem', fontWeight: 700, color: '#807C7A', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: '.22rem', paddingLeft: 32 }}>Звание</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 20, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', lineHeight: 1 }}>{user.militaryRank?.emoji || '🙂'}</span>
                  <div style={{ borderRadius: 8, padding: '4px 8px', minWidth: 98, background: 'linear-gradient(135deg,rgba(212,168,67,.14),rgba(212,168,67,.06))', border: '.5px solid rgba(212,168,67,.32)' }}>
                    <span style={{ fontSize: '.76rem', fontWeight: 700, color: '#D4A843', whiteSpace: 'nowrap' }}>{rankLabel}</span>
                  </div>
                </div>
              </div>
              {/* Jarvis */}
              <div>
                <div style={{ fontSize: '.37rem', fontWeight: 700, color: '#807C7A', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: '.22rem', paddingLeft: 32 }}>Уровень</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 20, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="8" height="13" viewBox="0 0 8 14" fill="none"><path d="M5.5 1L1 8h3.5L3 13 8 6H4.5L5.5 1z" fill="#4A9EFF" opacity=".85"/></svg>
                  </span>
                  <div style={{ borderRadius: 8, padding: '4px 8px', minWidth: 98, background: 'rgba(74,158,255,.09)', border: '.5px solid rgba(74,158,255,.25)' }}>
                    <span style={{ fontSize: '.76rem', fontWeight: 700, color: '#82CFFF', whiteSpace: 'nowrap' }}>{jarvisName}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* разделитель */}
          <div style={{
            height: .5, position: 'relative', zIndex: 2, margin: '0 .5rem',
            background: 'linear-gradient(90deg,transparent,rgba(212,168,67,.18),rgba(212,168,67,.35),rgba(212,168,67,.18),transparent)',
          }} />

          {/* 3 ячейки */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', position: 'relative', zIndex: 2 }}>
            {/* баланс */}
            <div className="hp-hbal-cell" style={{ padding: '.78rem .4rem .85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', borderRight: '.5px solid rgba(255,255,255,.05)', position: 'relative' }}>
              <div style={{ fontSize: '.43rem', fontWeight: 700, color: '#807C7A', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '.32rem' }}>Баланс</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.18rem' }}>
                <span style={{ fontSize: '1.08rem', fontWeight: 900, color: '#D4A843', letterSpacing: '-.01em', lineHeight: 1, textShadow: '0 0 12px rgba(212,168,67,.4)' }}>{formattedBalance}</span>
                <IcoCoin size={16} />
                <div className="hp-hbal-plus" style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(212,168,67,.18)', border: '.5px solid rgba(212,168,67,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.8rem', fontWeight: 900, color: '#F0C85A', cursor: 'pointer', marginLeft: '.22rem', boxShadow: '0 0 8px rgba(212,168,67,.25)' }} onClick={() => navigate('/shop')}>+</div>
              </div>
            </div>

            {/* попытки */}
            <div className="hp-hbal-cell" style={{ padding: '.78rem .4rem .85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', borderRight: '.5px solid rgba(255,255,255,.05)', position: 'relative' }}>
              <div style={{ fontSize: '.43rem', fontWeight: 700, color: '#807C7A', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '.32rem' }}>Попытки</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.22rem' }}>
                <div style={{ display: 'flex', gap: '.04rem' }}>
                  {Array.from({ length: maxAttempts }, (_, i) => (
                    <svg key={i} width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ opacity: i < attempts ? 1 : 0.18 }}>
                      <path d="M7 1l1.55 3.63L12.5 5.1l-2.9 2.73.78 3.9L7 9.8l-3.38 1.93.78-3.9L1.5 5.1l3.95-.47z" fill="#D4A843" stroke="#A07830" strokeWidth=".5"/>
                    </svg>
                  ))}
                </div>
                <div className="hp-hbal-plus" onClick={() => setShowAttemptsModal(true)} style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(212,168,67,.18)', border: '.5px solid rgba(212,168,67,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.8rem', fontWeight: 900, color: '#F0C85A', cursor: 'pointer', marginLeft: '.22rem', boxShadow: '0 0 8px rgba(212,168,67,.25)' }}>+</div>
              </div>
            </div>

            {/* таймер */}
            <div className="hp-hbal-cell" style={{ padding: '.78rem .4rem .85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
              <div style={{ fontSize: '.43rem', fontWeight: 700, color: '#807C7A', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '.32rem' }}>Следующая</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.2rem' }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="#5E5A54" strokeWidth="1.2"/>
                  <path d="M6 3.5V6l1.5 1.5" stroke="#5E5A54" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize: '.9rem', fontWeight: 900, color: '#9A9590', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{timeLeft || '08:00'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══ АКТИВНЫЕ СЕССИИ (только если есть) ══ */}
        {activeSessions.length > 0 && (
          <>
            <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#7A7875', textTransform: 'uppercase', letterSpacing: '.14em', padding: '.75rem .85rem .3rem' }}>
              Активные партии
            </div>
            <div style={{
              margin: '0 .85rem .15rem',
              background: 'linear-gradient(135deg,#0E1208,#121A0E)',
              border: '.5px solid rgba(212,168,67,.22)',
              borderRadius: 16, overflow: 'hidden', position: 'relative',
              cursor: 'pointer',
            }}
              onClick={() => setShowSessionsModal(true)}
            >
              {/* верхняя линия как у квестов */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, background: 'linear-gradient(90deg,transparent,rgba(212,168,67,.35),rgba(61,186,122,.2),rgba(212,168,67,.35),transparent)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', padding: '.6rem .85rem .65rem' }}>
                {/* иконка */}
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'rgba(212,168,67,.1)', border: '.5px solid rgba(212,168,67,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <rect x="2" y="2" width="7" height="7" rx="1" fill="rgba(212,168,67,.15)" stroke="#D4A843" strokeWidth="1.2"/>
                    <rect x="11" y="2" width="7" height="7" rx="1" fill="#0E1208" stroke="#D4A843" strokeWidth="1.2"/>
                    <rect x="2" y="11" width="7" height="7" rx="1" fill="#0E1208" stroke="#D4A843" strokeWidth="1.2"/>
                    <rect x="11" y="11" width="7" height="7" rx="1" fill="rgba(212,168,67,.15)" stroke="#D4A843" strokeWidth="1.2"/>
                    <circle cx="10" cy="10" r="2.5" fill="#D4A843" opacity=".8"/>
                  </svg>
                </div>
                {/* список сессий */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.72rem', fontWeight: 800, color: '#E8D8A0', letterSpacing: '.02em', marginBottom: '.18rem' }}>
                    {activeSessions.length === 1 ? 'Незавершённая партия' : `${activeSessions.length} незавершённых партии`}
                  </div>
                  <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap' }}>
                    {activeSessions.slice(0, 3).map(s => {
                      const opponent = s.sides?.find(side => !side.isMe);
                      const isMyTurn = s.isMyTurn;
                      const typeLabel = s.type === 'BOT' ? 'vs JARVIS' : s.type === 'BATTLE' ? 'Батл' : 'Дружеский';
                      const opponentName = opponent?.isBot ? 'JARVIS' : (opponent?.player?.firstName || '???');
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '.22rem' }}>
                          <div style={{
                            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                            background: isMyTurn ? '#D4A843' : 'rgba(212,168,67,.4)',
                            boxShadow: isMyTurn ? '0 0 5px #D4A843' : 'none',
                            animation: isMyTurn ? 'cc-pulse 1.5s infinite' : 'none',
                          }} />
                          <span style={{ fontSize: '.58rem', fontWeight: 600, whiteSpace: 'nowrap', color: isMyTurn ? '#E8C870' : '#9A9080' }}>
                            {typeLabel} · {opponentName}{isMyTurn ? ' · Твой ход' : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ fontSize: '.8rem', color: 'rgba(212,168,67,.5)', flexShrink: 0 }}>›</div>
              </div>
            </div>
          </>
        )}

        {/* ── LABEL ── */}
        <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#7A7875', textTransform: 'uppercase', letterSpacing: '.14em', padding: '1rem .85rem .45rem' }}>
          Режимы игры
        </div>

        {/* ══ 4 БЛОКА ══ */}
        <div className="hp-blocks" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.7rem', margin: '0 .85rem .7rem' }}>

          {/* JARVIS */}
          <div
            className="hp-blk jarvis"
            style={{
              borderRadius: 16, padding: '.72rem .65rem .78rem',
              cursor: 'pointer',
              position: 'relative', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              background: 'linear-gradient(150deg,#0B1422,#0F1A30)',
              border: '.5px solid rgba(74,158,255,.25)',
              transform: blkScale('jarvis'),
            }}
            onPointerDown={() => setPressedBlk('jarvis')}
            onPointerUp={() => { setPressedBlk(null); setShowJarvisModal(true); }}
            onPointerLeave={() => setPressedBlk(null)}
          >
            <div style={{ position: 'relative', marginBottom: '.55rem' }}>
              <IcoJarvis size={52} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: '50%', background: '#4A9EFF', boxShadow: '0 0 6px #4A9EFF', animation: 'cc-pulse 1.5s infinite' }} />
            </div>
            <div style={{ fontSize: '.86rem', fontWeight: 900, letterSpacing: '.01em', marginBottom: '.12rem', color: '#C8E8FF' }}>J.A.R.V.I.S</div>
            <div style={{ fontSize: '.58rem', lineHeight: 1.35, color: 'rgba(74,158,255,.82)' }}>Уровень {jarvisLevel} · {jarvisName}</div>
          </div>

          {/* БАТЛЫ */}
          <div
            className="hp-blk batly"
            style={{
              borderRadius: 16, padding: '.72rem .65rem .78rem',
              cursor: 'pointer',
              position: 'relative', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              background: 'linear-gradient(150deg,#191208,#211808)',
              border: '.5px solid rgba(212,168,67,.25)',
              transform: blkScale('batly'),
            }}
            onPointerDown={() => setPressedBlk('batly')}
            onPointerUp={() => { setPressedBlk(null); navigate('/battles'); }}
            onPointerLeave={() => setPressedBlk(null)}
          >
            <div style={{ marginBottom: '.55rem' }}>
              <IcoBattle size={52} />
            </div>
            <div style={{ fontSize: '.86rem', fontWeight: 900, letterSpacing: '.01em', marginBottom: '.12rem', color: '#F0C85A' }}>Батлы</div>
            <div style={{ fontSize: '.58rem', lineHeight: 1.35, color: 'rgba(212,168,67,.82)' }}>1 на 1 · до 10 🪙</div>
          </div>

          {/* КУБКИ */}
          <div
            className="hp-blk cups"
            style={{
              borderRadius: 16, padding: '.72rem .65rem .78rem',
              cursor: 'pointer',
              position: 'relative', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              background: 'linear-gradient(150deg,#120E1E,#181228)',
              border: '.5px solid rgba(155,109,255,.25)',
              transform: blkScale('cups'),
            }}
            onPointerDown={() => setPressedBlk('cups')}
            onPointerUp={() => { setPressedBlk(null); navigate('/tournaments'); }}
            onPointerLeave={() => setPressedBlk(null)}
          >
            <div style={{ marginBottom: '.55rem' }}>
              <IcoTrophy size={52} />
            </div>
            <div style={{ fontSize: '.86rem', fontWeight: 900, letterSpacing: '.01em', marginBottom: '.12rem', color: '#D4C0FF' }}>Кубки</div>
            <div style={{ fontSize: '.58rem', lineHeight: 1.35, color: 'rgba(155,109,255,.82)' }}>Турниры · Скоро</div>
          </div>

          {/* ВОЙНЫ */}
          <div
            className="hp-blk wars"
            style={{
              borderRadius: 16, padding: '.72rem .65rem .78rem',
              cursor: 'pointer',
              position: 'relative', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              background: 'linear-gradient(150deg,#091510,#0D1C14)',
              border: '.5px solid rgba(61,186,122,.25)',
              transform: blkScale('wars'),
            }}
            onPointerDown={() => setPressedBlk('wars')}
            onPointerUp={() => { setPressedBlk(null); navigate('/wars'); }}
            onPointerLeave={() => setPressedBlk(null)}
          >
            <div style={{ position: 'relative', marginBottom: '.55rem' }}>
              <IcoWars size={52} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: '50%', background: '#3DBA7A', boxShadow: '0 0 6px #3DBA7A', animation: 'cc-pulse 1.5s infinite' }} />
            </div>
            <div style={{ fontSize: '.86rem', fontWeight: 900, letterSpacing: '.01em', marginBottom: '.12rem', color: '#8FEBB8' }}>Войны</div>
            <div style={{ fontSize: '.58rem', lineHeight: 1.35, color: 'rgba(61,186,122,.82)' }}>Страны · Сезон</div>
          </div>

        </div>

        {/* ── LABEL ── */}
        <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#7A7875', textTransform: 'uppercase', letterSpacing: '.14em', padding: '.9rem .85rem .45rem' }}>
          Текущие задания
        </div>

        {/* ══ КВЕСТЫ ══ */}
        <div
          className="hp-quests hp-quests-wrap"
          onClick={() => navigate('/tasks')}
          style={{
            margin: '0 .85rem 0',
            background: 'linear-gradient(135deg,#141018,#0F0E18)',
            border: '.5px solid rgba(155,109,255,.22)',
            borderRadius: 16, overflow: 'hidden', position: 'relative',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', padding: '.6rem .85rem .65rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'rgba(155,109,255,.12)', border: '.5px solid rgba(155,109,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="4" width="14" height="12" rx="2" stroke="#9B6DFF" strokeWidth="1.3"/>
                <path d="M6 8h8M6 11h5" stroke="#9B6DFF" strokeWidth="1.2" strokeLinecap="round"/>
                <circle cx="15" cy="15" r="4" fill="#141018" stroke="#9B6DFF" strokeWidth="1"/>
                <path d="M13.5 15l1 1 2-1.5" stroke="#9B6DFF" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '.82rem', fontWeight: 800, color: '#C8C0E0', letterSpacing: '.02em', marginBottom: '.22rem' }}>
                Ежедневные задания
              </div>
              <div style={{ display: 'flex', gap: '.55rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'Сыграй 3 партии', active: true },
                  { label: 'Победи в батле', active: false },
                  { label: 'Реши задачу', active: false },
                ].map(q => (
                  <div key={q.label} style={{ display: 'flex', alignItems: 'center', gap: '.28rem' }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: q.active ? '#9B6DFF' : 'rgba(155,109,255,.5)',
                      boxShadow: q.active ? '0 0 5px #9B6DFF' : 'none',
                    }} />
                    <span style={{ fontSize: '.7rem', fontWeight: 600, whiteSpace: 'nowrap', color: q.active ? '#A890D0' : '#9A90B8' }}>
                      {q.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ fontSize: '1.1rem', color: 'rgba(155,109,255,.7)', flexShrink: 0 }}>›</div>
          </div>
        </div>

      </div>
    </PageLayout>
  );
};
