import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getJarvisLevels, JARVIS_LEVELS, type JarvisLevel } from './JarvisModal';
import { useT } from '@/i18n/useT';

// ── Типы ──────────────────────────────────────────────────────────────────────
type ColorChoice = 'random' | 'white' | 'black';
type Phase = 'setup' | 'countdown' | 'noattempts';

interface JarvisPlayModalProps {
  currentJarvisLevel: number;
  userAttempts: number;
  maxAttempts: number;
  nextRestoreSeconds?: number;
  onStart: (color: 'white' | 'black', timeMinutes: number, level: JarvisLevel) => void;
  onClose: () => void;
  onBuyAttempts?: () => void;
}

const TIME_OPTIONS = [1, 3, 5, 15, 30, 60];
const JARVIS_NAMES = ['Beginner','Rookie','Player','Challenger','Fighter','Warrior','Expert','Master','Legend','God','Prodigy','Tactician','Strategist','Grandmaster','Elite','Champion','Legend II','Titan','Oracle','Mystic'];

// ── Иконки ────────────────────────────────────────────────────────────────────
const IcoDice = () => (
  <svg width="33" height="33" viewBox="0 0 18 18" fill="none">
    <rect x="1.5" y="1.5" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="5.5" cy="5.5" r="1.2" fill="currentColor"/>
    <circle cx="12.5" cy="5.5" r="1.2" fill="currentColor"/>
    <circle cx="9" cy="9" r="1.2" fill="currentColor"/>
    <circle cx="5.5" cy="12.5" r="1.2" fill="currentColor"/>
    <circle cx="12.5" cy="12.5" r="1.2" fill="currentColor"/>
  </svg>
);

const IcoKingWhite = () => (
  <svg width="33" height="33" viewBox="0 0 18 18" fill="none">
    <path d="M9 2v3M7.5 3.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <rect x="7" y="5" width="4" height="2" rx=".5" fill="currentColor" opacity=".8"/>
    <path d="M5.5 7h7l-1 8H6.5L5.5 7z" fill="currentColor" opacity=".7"/>
    <path d="M4 15h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const IcoKingBlack = () => (
  <svg width="33" height="33" viewBox="0 0 18 18" fill="none">
    <path d="M9 2v3M7.5 3.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <rect x="7" y="5" width="4" height="2" rx=".5" fill="currentColor" opacity=".9"/>
    <path d="M5.5 7h7l-1 8H6.5L5.5 7z" fill="currentColor" opacity=".9"/>
    <path d="M4 15h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <rect x="5" y="6.5" width="8" height="9" rx="1" fill="currentColor" opacity=".15"/>
  </svg>
);

const IcoStar = ({ filled }: { filled: boolean }) => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path
      d="M14 3l2.6 6.2 6.6.6-5 4.7 1.5 6.5L14 17.8l-5.7 3.2 1.5-6.5-5-4.7 6.6-.6z"
      fill={filled ? '#D4A843' : 'rgba(212,168,67,.1)'}
      stroke={filled ? '#A07830' : 'rgba(212,168,67,.18)'}
      strokeWidth=".8"
      style={{ filter: filled ? 'drop-shadow(0 0 5px rgba(212,168,67,.6))' : 'none' }}
    />
  </svg>
);

// ── Форматирование обратного отсчёта ──────────────────────────────────────────
function fmtCountdown(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ── Компонент ──────────────────────────────────────────────────────────────────
export const JarvisPlayModal: React.FC<JarvisPlayModalProps> = ({
  currentJarvisLevel, userAttempts, maxAttempts,
  nextRestoreSeconds, onStart, onClose, onBuyAttempts,
}) => {
  const t = useT();
  const localizedLevels = getJarvisLevels(t);

  const [selectedLvl, setSelectedLvl] = useState(
    Math.max(1, Math.min(currentJarvisLevel, localizedLevels.length))
  );
  const [color, setColor] = useState<ColorChoice>('random');
  const [time, setTime] = useState(5);
  const [phase, setPhase] = useState<Phase>('setup');
  const [count, setCount] = useState(3);
  const [resolvedColor, setResolvedColor] = useState<'white' | 'black'>('white');

  // Обратный отсчёт до следующей попытки
  const [restoreSecs, setRestoreSecs] = useState(nextRestoreSeconds ?? 0);
  useEffect(() => {
    if (!nextRestoreSeconds || userAttempts >= maxAttempts) return;
    setRestoreSecs(nextRestoreSeconds);
    const id = setInterval(() => setRestoreSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [nextRestoreSeconds, userAttempts, maxAttempts]);

  const level = localizedLevels[selectedLvl - 1];
  const levelName = level?.name || JARVIS_NAMES[selectedLvl - 1] || `Уровень ${selectedLvl}`;

  const levelStatus = selectedLvl < currentJarvisLevel ? 'completed'
    : selectedLvl === currentJarvisLevel ? 'current'
    : 'locked';
  const canPlay = levelStatus === 'current';

  // Countdown логика
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count <= 0) {
      onStart(resolvedColor, time, level);
      return;
    }
    const id = setTimeout(() => setCount(c => c - 1), 900);
    return () => clearTimeout(id);
  }, [phase, count]);

  const handlePlay = useCallback(() => {
    if (!canPlay) return;
    // ⭐ Проверка попыток — ГЛАВНЫЙ guard
    if (userAttempts <= 0) {
      setPhase('noattempts');
      return;
    }
    const rc = color === 'random' ? (Math.random() > 0.5 ? 'white' : 'black') : color;
    setResolvedColor(rc);
    setCount(3);
    setPhase('countdown');
  }, [color, canPlay, userAttempts]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && phase === 'setup' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  // ── Фаза: нет попыток ─────────────────────────────────────────────────────
  if (phase === 'noattempts') {
    return (
      <div
        onClick={(e) => e.target === e.currentTarget && onClose()}
        style={{
          position: 'fixed', inset: 0, zIndex: 400,
          background: 'rgba(4,3,8,.88)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          paddingBottom: 'calc(82px + env(safe-area-inset-bottom, 0px))',
          paddingTop: '16px',
        }}
      >
        <style>{`@keyframes na-slide { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }`}</style>

        <div style={{
          width: '100%', maxWidth: 420,
          background: 'linear-gradient(170deg,#120E04,#100C18)',
          border: '.5px solid rgba(212,168,67,.28)',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -14px 44px rgba(0,0,0,.65)',
          padding: '0 0 12px',
          animation: 'na-slide .28s cubic-bezier(.25,.8,.25,1) both',
        }}>
          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.1)' }} />
          </div>

          {/* Заголовок */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 18px 0' }}>
            <span style={{ fontSize: '1rem', fontWeight: 900, color: '#F0C85A' }}>Попытки закончились</span>
            <button onClick={onClose} style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(255,255,255,.06)', border: '.5px solid rgba(255,255,255,.1)',
              color: '#6A7090', fontSize: '.8rem', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>

          {/* Звёзды */}
          <div style={{
            margin: '16px 14px',
            background: 'rgba(212,168,67,.06)',
            border: '.5px solid rgba(212,168,67,.18)',
            borderRadius: 16, padding: '18px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {Array.from({ length: maxAttempts }, (_, i) => (
                <IcoStar key={i} filled={i < userAttempts} />
              ))}
            </div>
            <div style={{
              fontSize: '.72rem', fontWeight: 700,
              color: '#7A6830', letterSpacing: '.06em',
            }}>
              {userAttempts}/{maxAttempts} попыток использовано
            </div>
          </div>

          {/* Информация */}
          <div style={{ margin: '0 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* Следующая попытка */}
            {restoreSecs > 0 && userAttempts < maxAttempts && (
              <div style={{
                background: 'rgba(74,158,255,.07)',
                border: '.5px solid rgba(74,158,255,.18)',
                borderRadius: 12, padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 20 }}>🕐</span>
                <div>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#82CFFF', marginBottom: 2 }}>
                    Следующая попытка через
                  </div>
                  <div style={{
                    fontSize: '1.1rem', fontWeight: 900, color: '#4A9EFF',
                    fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em',
                  }}>
                    {fmtCountdown(restoreSecs)}
                  </div>
                </div>
              </div>
            )}

            {/* Правила восстановления */}
            <div style={{
              background: 'rgba(255,255,255,.03)',
              border: '.5px solid rgba(255,255,255,.07)',
              borderRadius: 12, padding: '12px 14px',
            }}>
              <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#6A6458', lineHeight: 1.6 }}>
                <div>⭐ Система выдаёт <span style={{ color: '#D4A843' }}>1 попытку</span> каждые <span style={{ color: '#D4A843' }}>8 часов</span></div>
                <div>🎮 Максимум <span style={{ color: '#D4A843' }}>{maxAttempts} бесплатных</span> попытки в день</div>
                <div>🪙 Дополнительные попытки — за монеты</div>
              </div>
            </div>
          </div>

          {/* Кнопки */}
          <div style={{ margin: '0 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {onBuyAttempts && (
              <button
                onClick={() => { onClose(); setTimeout(onBuyAttempts, 100); }}
                style={{
                  width: '100%', padding: '14px',
                  background: 'linear-gradient(135deg,#3A2A08,#5A4010)',
                  border: '.5px solid rgba(212,168,67,.5)',
                  borderRadius: 14, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: '.9rem', fontWeight: 900,
                  letterSpacing: '.04em', color: '#F0C85A',
                  boxShadow: '0 4px 20px rgba(212,168,67,.18)',
                }}
              >
                🛒 Купить попытки — 1 000 🪙 / шт
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                width: '100%', padding: '12px',
                background: 'rgba(255,255,255,.05)',
                border: '.5px solid rgba(255,255,255,.08)',
                borderRadius: 14, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '.82rem', fontWeight: 700,
                color: '#5A5850',
              }}
            >
              Подождать
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Фаза countdown ────────────────────────────────────────────────────────
  if (phase === 'countdown') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(6,5,10,.96)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '1.2rem',
      }}>
        <style>{`
          @keyframes jcd-pop {
            0%   { opacity: 0; transform: scale(1.8); }
            30%  { opacity: 1; transform: scale(1); }
            80%  { opacity: 1; transform: scale(1); }
            100% { opacity: 0; transform: scale(.6); }
          }
          @keyframes jcd-ring {
            0%   { opacity: 0; transform: scale(.5); }
            40%  { opacity: .25; }
            100% { opacity: 0; transform: scale(2.2); }
          }
        `}</style>

        <div key={`ring-${count}`} style={{
          position: 'absolute',
          width: 160, height: 160, borderRadius: '50%',
          border: '1.5px solid rgba(74,158,255,.35)',
          animation: 'jcd-ring .9s ease-out both',
        }} />

        {count > 0 ? (
          <div key={`num-${count}`} style={{
            fontSize: '7rem', fontWeight: 900, letterSpacing: '-.04em',
            fontFamily: 'Inter, sans-serif',
            background: 'linear-gradient(160deg,#82CFFF,#4A9EFF)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            animation: 'jcd-pop .9s ease-out both',
          }}>{count}</div>
        ) : (
          <div key="go" style={{
            fontSize: '3.6rem', fontWeight: 900, letterSpacing: '.04em',
            fontFamily: 'Inter, sans-serif',
            background: 'linear-gradient(160deg,#6FEDB0,#3DBA7A)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            animation: 'jcd-pop .6s ease-out both',
          }}>GO!</div>
        )}

        <div style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.35)', letterSpacing: '.1em', fontWeight: 700 }}>
          {resolvedColor === 'white' ? '♔ Белые · Ваш ход' : '♛ Чёрные · Ожидание'}
        </div>
      </div>
    );
  }

  // ── Фаза setup ────────────────────────────────────────────────────────────
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 350,
        background: 'rgba(4,3,8,.82)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        paddingBottom: 'calc(82px + env(safe-area-inset-bottom, 0px))',
        paddingTop: '16px',
      }}
    >
      <style>{`
        @keyframes jpm-slide { from{opacity:0;transform:translateY(32px)} to{opacity:1;transform:translateY(0)} }
        .jpm-sheet { animation: jpm-slide .25s cubic-bezier(.25,.8,.25,1) both; }
        .jpm-col:active { opacity:.7; transform: scale(.94) !important; }
        .jpm-time:active { transform: scale(.92) !important; }
      `}</style>

      <div className="jpm-sheet" style={{
        width: '100%', maxWidth: 420,
        background: 'linear-gradient(170deg,#0D0F18,#0A0C14)',
        border: '.5px solid rgba(74,158,255,.2)',
        borderRadius: '24px 24px 0 0',
        padding: '0 0 10px',
        boxShadow: '0 -16px 48px rgba(0,0,0,.6), 0 -1px 0 rgba(74,158,255,.1)',
      }}>

        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.1)' }} />
        </div>

        {/* Заголовок + закрыть */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 18px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem' }}>
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="10" r="6.5" stroke="#4A9EFF" strokeWidth="1.4"/>
              <circle cx="11.5" cy="9.5" r="1.5" fill="#4A9EFF" opacity=".9"/>
              <circle cx="16.5" cy="9.5" r="1.5" fill="#4A9EFF" opacity=".9"/>
              <line x1="11.5" y1="13" x2="16.5" y2="13" stroke="#4A9EFF" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M7.5 16.5C7.5 14.015 10.462 12 14 12s6.5 2.015 6.5 4.5" stroke="#4A9EFF" strokeWidth="1.3" strokeLinecap="round"/>
              <rect x="4" y="17" width="4" height="6" rx="1.5" fill="none" stroke="#4A9EFF" strokeWidth="1.2"/>
              <rect x="20" y="17" width="4" height="6" rx="1.5" fill="none" stroke="#4A9EFF" strokeWidth="1.2"/>
              <rect x="8" y="16" width="12" height="9" rx="2" fill="none" stroke="#4A9EFF" strokeWidth="1.3"/>
            </svg>
            <span style={{ fontSize: '1rem', fontWeight: 900, color: '#C8E8FF', letterSpacing: '.01em' }}>J.A.R.V.I.S</span>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(255,255,255,.06)', border: '.5px solid rgba(255,255,255,.1)',
            color: '#6A7090', fontSize: '.8rem', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* ── Блок уровня ── */}
        <div style={{ margin: '0 14px 14px', position: 'relative' }}>
          <div style={{ fontSize: '.52rem', fontWeight: 700, color: '#4A6080', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 6 }}>Активный уровень</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '.6rem',
            background: 'linear-gradient(135deg,#0B1422,#0F1A30)',
            border: `.5px solid ${levelStatus === 'current' ? 'rgba(74,158,255,.4)' : levelStatus === 'completed' ? 'rgba(61,186,122,.25)' : 'rgba(255,255,255,.08)'}`,
            borderRadius: 14, padding: '15px 14px',
          }}>
            <button
              onClick={() => setSelectedLvl(l => Math.max(1, l - 1))}
              disabled={selectedLvl <= 1}
              style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: selectedLvl > 1 ? 'rgba(74,158,255,.1)' : 'rgba(255,255,255,.03)',
                border: `.5px solid ${selectedLvl > 1 ? 'rgba(74,158,255,.25)' : 'rgba(255,255,255,.06)'}`,
                color: selectedLvl > 1 ? '#4A9EFF' : '#3A3F52',
                fontSize: '.9rem', cursor: selectedLvl > 1 ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
              }}
            >‹</button>

            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '.84rem', fontWeight: 700, color: '#4A7090', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 3 }}>
                Уровень {selectedLvl} / {localizedLevels.length}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.35rem', marginBottom: 3 }}>
                {levelStatus === 'completed' && <span style={{ fontSize: '1.1rem', color: '#3DBA7A' }}>✓</span>}
                {levelStatus === 'locked' && <span style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,.3)' }}>🔒</span>}
                <div style={{
                  fontSize: '1.08rem', fontWeight: 900, letterSpacing: '.02em',
                  color: levelStatus === 'completed' ? 'rgba(130,207,255,.4)'
                    : levelStatus === 'locked' ? 'rgba(255,255,255,.25)'
                    : '#82CFFF',
                }}>{levelName}</div>
              </div>
              <div style={{ fontSize: '.87rem', color: levelStatus === 'current' ? 'rgba(74,158,255,.6)' : 'rgba(74,158,255,.25)' }}>
                {levelStatus === 'completed' ? 'Пройдено' : levelStatus === 'locked' ? 'Закрыто' : `Победа: +${(level?.reward || 0).toLocaleString()} 🪙`}
              </div>
            </div>

            <button
              onClick={() => setSelectedLvl(l => Math.min(localizedLevels.length, l + 1))}
              disabled={selectedLvl >= localizedLevels.length}
              style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: selectedLvl < localizedLevels.length ? 'rgba(74,158,255,.1)' : 'rgba(255,255,255,.03)',
                border: `.5px solid ${selectedLvl < localizedLevels.length ? 'rgba(74,158,255,.25)' : 'rgba(255,255,255,.06)'}`,
                color: selectedLvl < localizedLevels.length ? '#4A9EFF' : '#3A3F52',
                fontSize: '.9rem', cursor: selectedLvl < localizedLevels.length ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
              }}
            >›</button>
          </div>
        </div>

        {/* ── Попытки ── */}
        <div style={{ margin: '0 14px 14px' }}>
          <div style={{ fontSize: '.52rem', fontWeight: 700, color: '#4A6080', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 6 }}>
            Попытки
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: userAttempts > 0 ? 'rgba(212,168,67,.06)' : 'rgba(220,50,47,.06)',
            border: `.5px solid ${userAttempts > 0 ? 'rgba(212,168,67,.2)' : 'rgba(220,50,47,.22)'}`,
            borderRadius: 12, padding: '8px 12px',
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {Array.from({ length: maxAttempts }, (_, i) => (
                <IcoStar key={i} filled={i < userAttempts} />
              ))}
            </div>
            <span style={{
              fontSize: '.72rem', fontWeight: 700,
              color: userAttempts > 0 ? '#9A8840' : '#EF4444',
            }}>
              {userAttempts > 0 ? `${userAttempts}/${maxAttempts}` : 'Нет попыток'}
            </span>
          </div>
        </div>

        {/* ── Выбор цвета ── */}
        <div style={{ margin: '0 14px 14px', opacity: canPlay ? 1 : 0.35, pointerEvents: canPlay ? 'auto' : 'none' }}>
          <div style={{ fontSize: '.52rem', fontWeight: 700, color: '#4A6080', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 8 }}>Цвет фигур</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {([
              { key: 'random', label: 'Рандом', Icon: IcoDice, bg: 'rgba(212,168,67,.1)', border: 'rgba(212,168,67,.3)', color: '#F0C85A', activeBg: 'rgba(212,168,67,.18)', activeBorder: '#D4A843' },
              { key: 'white',  label: 'Белые',  Icon: IcoKingWhite, bg: 'rgba(240,240,240,.08)', border: 'rgba(240,240,240,.18)', color: '#E8E0D0', activeBg: 'rgba(240,240,240,.16)', activeBorder: '#D0C8B8' },
              { key: 'black',  label: 'Чёрные', Icon: IcoKingBlack, bg: 'rgba(74,158,255,.08)', border: 'rgba(74,158,255,.2)', color: '#82CFFF', activeBg: 'rgba(74,158,255,.16)', activeBorder: '#4A9EFF' },
            ] as const).map(opt => {
              const active = color === opt.key;
              return (
                <button
                  key={opt.key}
                  className="jpm-col"
                  onClick={() => setColor(opt.key)}
                  style={{
                    background: active ? opt.activeBg : opt.bg,
                    border: `.5px solid ${active ? opt.activeBorder : opt.border}`,
                    borderRadius: 12, padding: '14px 8px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all .15s', transform: 'scale(1)',
                    boxShadow: active ? `0 0 12px ${opt.activeBorder}40` : 'none',
                  }}
                >
                  <span style={{ color: opt.color }}><opt.Icon /></span>
                  <span style={{ fontSize: '1.08rem', fontWeight: 800, color: active ? opt.color : 'rgba(255,255,255,.5)', letterSpacing: '.03em' }}>{opt.label}</span>
                  {active && <div style={{ width: 18, height: 2, borderRadius: 1, background: opt.activeBorder }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Выбор времени ── */}
        <div style={{ margin: '0 14px 18px', opacity: canPlay ? 1 : 0.35, pointerEvents: canPlay ? 'auto' : 'none' }}>
          <div style={{ fontSize: '.52rem', fontWeight: 700, color: '#4A6080', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 8 }}>Время партии</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
            {TIME_OPTIONS.map(t => {
              const active = time === t;
              return (
                <button
                  key={t}
                  className="jpm-time"
                  onClick={() => setTime(t)}
                  style={{
                    background: active ? 'rgba(212,168,67,.16)' : 'rgba(255,255,255,.05)',
                    border: `.5px solid ${active ? 'rgba(212,168,67,.6)' : 'rgba(255,255,255,.1)'}`,
                    borderRadius: 10, padding: '14px 6px',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all .15s', transform: 'scale(1)',
                    boxShadow: active ? '0 0 10px rgba(212,168,67,.25)' : 'none',
                  }}
                >
                  <div style={{ fontSize: '1.58rem', fontWeight: 900, color: active ? '#F0C85A' : 'rgba(255,255,255,.45)', letterSpacing: '-.01em', lineHeight: 1 }}>
                    {t < 60 ? t : '60'}
                  </div>
                  <div style={{ fontSize: '.87rem', fontWeight: 700, color: active ? 'rgba(240,200,90,.65)' : 'rgba(255,255,255,.22)', letterSpacing: '.06em', marginTop: 4 }}>
                    МИН
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Кнопка ИГРАТЬ ── */}
        <div style={{ margin: '0 14px' }}>
          <button
            onClick={handlePlay}
            disabled={!canPlay}
            style={{
              width: '100%', padding: '14px',
              background: canPlay
                ? userAttempts > 0
                  ? 'linear-gradient(135deg,#3A2A08,#5A4010)'
                  : 'linear-gradient(135deg,#3A0808,#5A1010)'
                : 'rgba(255,255,255,.04)',
              border: `.5px solid ${canPlay
                ? userAttempts > 0 ? 'rgba(212,168,67,.5)' : 'rgba(220,50,47,.4)'
                : 'rgba(255,255,255,.08)'}`,
              borderRadius: 14, cursor: canPlay ? 'pointer' : 'default',
              fontFamily: 'inherit', fontSize: '.9rem',
              fontWeight: 900, letterSpacing: '.06em',
              color: canPlay ? (userAttempts > 0 ? '#F0C85A' : '#FF8080') : '#3A4052',
              boxShadow: canPlay ? (userAttempts > 0 ? '0 4px 20px rgba(212,168,67,.18)' : '0 4px 20px rgba(220,50,47,.15)') : 'none',
              transition: 'all .15s', position: 'relative', overflow: 'hidden',
            }}
          >
            {canPlay && userAttempts > 0 && (
              <div style={{
                position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%',
                background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)',
                animation: 'jpm-shine 2.5s ease-in-out infinite',
              }} />
            )}
            <style>{`@keyframes jpm-shine{0%{left:-100%}100%{left:200%}}`}</style>
            {levelStatus === 'completed' ? '✓ ПРОЙДЕНО'
              : levelStatus === 'locked' ? '🔒 ЗАКРЫТ'
              : userAttempts <= 0 ? '⭐ НЕТ ПОПЫТОК'
              : 'ИГРАТЬ'}
          </button>
        </div>

      </div>
    </div>
  );
};
