import React, { useState, useEffect } from 'react';
import type { JarvisLevel } from './JarvisModal';
import { useT } from '@/i18n/useT';
import { InfoPopup, useInfoPopup } from '@/components/layout/PageLayout';

const TIME_OPTIONS = [1, 3, 5, 15, 30, 60];
type ColorChoice = 'random' | 'white' | 'black';

// ── Иконки (эталон JarvisPlayModal) ──────────────────────────────────────────
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

interface GameSetupModalProps {
  selectedLevel: JarvisLevel;
  onStart: (color: 'white' | 'black', timeMinutes: number) => void;
  onClose: () => void;  // J1: переименован из onBack
}

// J4: слайды информационного попапа о Джарвисе
const getJarvisInfoSlides = (t: any) => [
  {
    icon: '🤖',
    title: 'J.A.R.V.I.S — Искусственный противник',
    desc: 'Играй против ИИ. Выигрывай, чтобы открыть следующий уровень и заработать ᚙ. Каждый уровень сложнее предыдущего.',
  },
  {
    icon: '🏅',
    title: '20 уровней мастерства',
    desc: 'От новичка до мистика. Каждый уровень дарует уникальный значок на профиль — так другие видят твой ранг.',
  },
  {
    icon: '💰',
    title: 'ᚙ за победу',
    desc: 'Чем выше уровень — тем больше награда. На уровне мистика получаешь до 75 000 ᚙ за победу! Проигрыш ᚙ не тратит.',
  },
];

export const GameSetupModal: React.FC<GameSetupModalProps> = ({ selectedLevel, onStart, onClose }) => {
  const t = useT();
  const [color, setColor] = useState<ColorChoice>('random');
  const [time, setTime] = useState(5);
  const [launching, setLaunching] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [resolvedColor, setResolvedColor] = useState<'white' | 'black'>('white');

  const getTimeLabel = (minutes: number): string => {
    const timeMap: Record<number, string> = {
      1: t.gameSetup.duration1m,
      3: t.gameSetup.duration3m,
      5: t.gameSetup.duration5m,
      15: t.gameSetup.duration15m,
      30: t.gameSetup.duration30m,
      60: t.gameSetup.duration60m,
    };
    return timeMap[minutes] || `${minutes} мин`;
  };

  // J4: показываем попап один раз при первом открытии
  const jarvisInfo = useInfoPopup('jarvis', getJarvisInfoSlides(t));

  useEffect(() => {
    if (!launching) return;
    setCountdown(3);
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(iv);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    const timer = setTimeout(() => {
      onStart(resolvedColor, time);
    }, 3000);
    return () => { clearInterval(iv); clearTimeout(timer); };
  }, [launching]);

  const handleStart = () => {
    const rc: 'white' | 'black' = color === 'random'
      ? (Math.random() < 0.5 ? 'white' : 'black')
      : color;
    setResolvedColor(rc);
    setLaunching(true);
  };

  if (launching) {
    return (
      <div style={overlayStyle}>
        <div style={launchSheetStyle}>
          {/* Glow ring */}
          <div style={{ position: 'relative', width: 100, height: 100, margin: `0 auto var(--gap-xl)` }}>
            <div style={glowRingStyle} />
            <div style={innerCircleStyle}>
              <span style={{ fontSize: 'var(--icon-size-2xl)' }}>🤖</span>
            </div>
          </div>

          <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-accent, #F5C842)', textAlign: 'center', marginBottom: 'var(--gap-xs)' }}>
            {t.gameSetup.launching}
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary, #8B92A8)', textAlign: 'center', marginBottom: 'var(--gap-2xl)' }}>
            J.A.R.V.I.S {selectedLevel.name} · {getTimeLabel(time)}
          </div>

          {/* VS banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--gap-lg)', marginBottom: 'var(--gap-2xl)' }}>
            <div style={playerChipStyle}>
              {resolvedColor === 'white' ? '♔' : '♚'} {t.gameSetup.you}
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-muted, #4A5270)' }}>{t.gameSetup.vs}</span>
            <div style={{ ...playerChipStyle, background: 'var(--modal-jarvis-chip-bg, rgba(155,133,255,0.12))', borderColor: 'var(--modal-jarvis-chip-border, rgba(155,133,255,0.3))', color: 'var(--modal-jarvis-chip-color, #9B85FF)' }}>
              {resolvedColor === 'white' ? '♚' : '♔'} {t.gameSetup.jarvis}
            </div>
          </div>

          {/* Countdown */}
          <div style={{ textAlign: 'center' }}>
            <div style={countdownCircleStyle}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-accent, #F5C842)' }}>
                {countdown}
              </span>
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted, #4A5270)', marginTop: 'var(--gap-sm)', letterSpacing: '.06em' }}>
              {t.gameSetup.countdownLabel}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle}>
      {/* J4: Информационный попап — первый раз автоматически, потом по кнопке ℹ️ */}
      {jarvisInfo.show && (
        <InfoPopup infoKey="jarvis" slides={getJarvisInfoSlides(t)} onClose={jarvisInfo.close} />
      )}
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        {/* ── HEADER (fixed) ────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)', flexShrink: 0, paddingBottom: 'var(--gap-xs)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={onClose} style={backBtnStyle}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-primary, #F0F2F8)' }}>
              🤖 {selectedLevel.name}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent, #F5C842)', marginTop: 2 }}>
              Level {selectedLevel.level} / 20
            </div>
          </div>
          <button
            onClick={jarvisInfo.open}
            style={{ ...backBtnStyle, fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary, #8B92A8)' }}
            title="About J.A.R.V.I.S"
          >
            ℹ️
          </button>
          <button onClick={onClose} style={backBtnStyle}>✕</button>
        </div>

        {/* ── CONTENT (scrollable) ───────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: 2, display: 'flex', flexDirection: 'column', gap: 'var(--gap-md)' }}>
          {/* Color selection — эталон JarvisPlayModal */}
          <div>
            <div style={{ fontSize: '.52rem', fontWeight: 700, color: '#4A6080', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 8 }}>{t.gameSetup.color}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {([
                { key: 'random' as ColorChoice, label: t.gameSetup.random.replace('🎲 ',''), Icon: IcoDice,      bg: 'rgba(212,168,67,.1)', border: 'rgba(212,168,67,.3)', color: '#F0C85A', activeBg: 'rgba(212,168,67,.18)', activeBorder: '#D4A843' },
                { key: 'white'  as ColorChoice, label: t.gameSetup.white.replace('☀️ ',''),  Icon: IcoKingWhite, bg: 'rgba(240,240,240,.08)', border: 'rgba(240,240,240,.18)', color: '#E8E0D0', activeBg: 'rgba(240,240,240,.16)', activeBorder: '#D0C8B8' },
                { key: 'black'  as ColorChoice, label: t.gameSetup.black.replace('🌙 ',''),  Icon: IcoKingBlack, bg: 'rgba(74,158,255,.08)', border: 'rgba(74,158,255,.2)', color: '#82CFFF', activeBg: 'rgba(74,158,255,.16)', activeBorder: '#4A9EFF' },
              ]).map(opt => {
                const active = color === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setColor(opt.key)}
                    style={{
                      background: active ? opt.activeBg : opt.bg,
                      border: `.5px solid ${active ? opt.activeBorder : opt.border}`,
                      borderRadius: 12, padding: '14px 8px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all .15s',
                      boxShadow: active ? `0 0 12px ${opt.activeBorder}40` : 'none',
                    }}
                  >
                    <span style={{ color: opt.color, opacity: active ? 1 : 0.35, filter: active ? 'none' : 'grayscale(0.7)', transition: 'opacity .15s, filter .15s' }}><opt.Icon /></span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.96rem', fontWeight: 800, color: active ? opt.color : 'rgba(255,255,255,.5)', letterSpacing: '.03em' }}>{opt.label}</span>
                    {active && <div style={{ width: 18, height: 2, borderRadius: 1, background: opt.activeBorder }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time selection — эталон JarvisPlayModal */}
          <div>
            <div style={{ fontSize: '.52rem', fontWeight: 700, color: '#4A6080', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 8 }}>{t.gameSetup.duration}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
              {TIME_OPTIONS.map((opt) => {
                const active = time === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => setTime(opt)}
                    style={{
                      background: active ? 'rgba(212,168,67,.16)' : 'rgba(255,255,255,.05)',
                      border: `.5px solid ${active ? 'rgba(212,168,67,.6)' : 'rgba(255,255,255,.1)'}`,
                      borderRadius: 10, padding: '14px 6px',
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all .15s',
                      boxShadow: active ? '0 0 10px rgba(212,168,67,.25)' : 'none',
                    }}
                  >
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.44rem', fontWeight: 900, color: active ? '#F0C85A' : 'rgba(255,255,255,.45)', letterSpacing: '-.01em', lineHeight: 1 }}>
                      {opt < 60 ? opt : '60'}
                    </div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '.76rem', fontWeight: 700, color: active ? 'rgba(240,200,90,.65)' : 'rgba(255,255,255,.22)', letterSpacing: '.06em', marginTop: 4 }}>
                      МИН
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── FOOTER (fixed) ────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 'var(--gap-sm)' }}>
          <div style={{ padding: 'var(--card-padding-md)', background: 'rgba(123,97,255,0.08)', border: '1px solid rgba(123,97,255,0.15)', borderRadius: 'var(--radius-m)', fontSize: 'var(--font-size-sm)', color: '#8B92A8', lineHeight: 'var(--line-height-normal)' }}>
            {t.gameSetup.infoWin}
          </div>
          <button onClick={handleStart} style={startBtnStyle}>
            {t.gameSetup.startBtn}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: "var(--z-modal, 300)",
  background: 'var(--modal-overlay-bg, rgba(0,0,0,0.7))',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  overflowY: 'auto',
  paddingBottom: 'max(82px, env(safe-area-inset-bottom, 82px))',
};
const sheetStyle: React.CSSProperties = {
  width: '100%', maxWidth: 'clamp(280px, 90vw, var(--modal-width-lg))',
  background: 'var(--color-bg-card, #13161F)',
  border: '1px solid var(--gamesetup-sheet-border, rgba(255,255,255,0.1))',
  borderBottom: 'none',
  borderRadius: 'var(--radius-xl)',
  padding: 'var(--card-padding-lg)',
  maxHeight: '80vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--gap-md)',
};
const launchSheetStyle: React.CSSProperties = {
  width: '100%', maxWidth: 'clamp(260px, 90vw, var(--modal-width-md))',
  background: 'var(--color-bg-card, #13161F)',
  border: 'var(--modal-launch-border, 1px solid rgba(245,200,66,0.2))',
  borderRadius: 'calc(var(--radius-xl) + 4px)',
  padding: 'var(--card-padding-xl) var(--card-padding-lg)',
  margin: 'auto',
  boxShadow: 'var(--modal-launch-shadow, 0 0 80px rgba(245,200,66,0.12), 0 30px 60px rgba(0,0,0,0.5))',
  position: 'relative',
  alignSelf: 'center',
};
const glowRingStyle: React.CSSProperties = {
  position: 'absolute', inset: -6,
  borderRadius: '50%',
  background: 'var(--modal-glow-gradient, conic-gradient(from 0deg, #F5C842, #9B85FF, #F5C842))',
  animation: 'spin 2s linear infinite',
  opacity: 0.6,
};
const innerCircleStyle: React.CSSProperties = {
  position: 'absolute', inset: 4,
  borderRadius: '50%',
  background: 'var(--color-bg-card, #13161F)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const playerChipStyle: React.CSSProperties = {
  padding: `var(--input-padding-y) var(--button-padding-x-md)`,
  background: 'var(--modal-player-chip-bg, rgba(245,200,66,0.1))',
  border: '1px solid var(--modal-player-chip-border, rgba(245,200,66,0.25))',
  borderRadius: 'var(--radius-m)',
  fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)',
  color: 'var(--color-accent, #F5C842)',
};
const countdownCircleStyle: React.CSSProperties = {
  width: 80, height: 80,
  borderRadius: '50%',
  background: 'var(--modal-countdown-bg, rgba(245,200,66,0.08))',
  border: '3px solid var(--modal-countdown-border, rgba(245,200,66,0.4))',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  margin: '0 auto',
  boxShadow: 'var(--modal-countdown-shadow, 0 0 30px rgba(245,200,66,0.2))',
  fontSize: 'var(--font-size-2xl)',
};
const backBtnStyle: React.CSSProperties = {
  width: 44, height: 44, borderRadius: '50%',
  background: 'var(--color-border, rgba(255,255,255,0.07))',
  border: '1px solid var(--gamesetup-back-btn-border, rgba(255,255,255,0.1))',
  color: 'var(--color-text-primary, #F0F2F8)', fontSize: 'var(--font-size-base)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'inherit', flexShrink: 0,
};
const sectionLbl: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-bold)',
  letterSpacing: '.09em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted, #4A5270)',
  marginBottom: 'var(--gap-xs)',
};
const colorBtnStyle = (active: boolean, c: ColorChoice): React.CSSProperties => ({
  padding: `var(--card-padding-md) var(--gap-xs)`, borderRadius: 'var(--radius-m)', cursor: 'pointer',
  minHeight: 58,
  background: active ? 'var(--modal-color-active-bg, rgba(245,200,66,0.1))' : 'var(--color-bg-card, #1C2030)',
  border: `2px solid ${active ? 'var(--color-accent, #F5C842)' : 'var(--color-border, rgba(255,255,255,0.07))'}`,
  color: active ? 'var(--color-accent, #F5C842)' : 'var(--color-text-secondary, #8B92A8)',
  textAlign: 'center',
  transition: `all var(--transition-fast)`,
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-semibold)',
  transform: active ? 'scale(1.03)' : 'scale(1)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--gap-xs)',
});
const timeBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: `var(--card-padding-md) var(--gap-xs)`,
  borderRadius: 'var(--radius-m)',
  cursor: 'pointer',
  minHeight: 50,
  background: active ? 'var(--modal-time-active-bg, rgba(123,97,255,0.15))' : 'var(--color-bg-card, #1C2030)',
  border: `1px solid ${active ? 'var(--modal-time-active-border, rgba(123,97,255,0.4))' : 'var(--color-border, rgba(255,255,255,0.07))'}`,
  color: active ? 'var(--modal-time-active-color, #9B85FF)' : 'var(--color-text-secondary, #8B92A8)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-semibold)',
  transition: `all var(--transition-fast)`,
  fontFamily: 'inherit',
  textAlign: 'center' as const,
  transform: active ? 'scale(1.03)' : 'scale(1)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--gap-xs)',
});
const startBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: `var(--input-padding-y) var(--button-padding-x-md)`,
  minHeight: 'var(--button-height-md)',
  background: 'var(--color-accent, #F5C842)',
  border: 'none',
  borderRadius: 'var(--radius-m)',
  color: 'var(--color-bg-dark, #0B0D11)',
  fontSize: 'var(--font-size-base)',
  fontWeight: 'var(--font-weight-extrabold)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: `all var(--transition-normal)`,
  boxShadow: 'var(--modal-start-btn-shadow, 0 4px 20px rgba(245,200,66,0.2))',
};
