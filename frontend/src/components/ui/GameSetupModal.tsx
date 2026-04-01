import React, { useState, useEffect } from 'react';
import type { JarvisLevel } from './JarvisModal';
import { useT } from '@/i18n/useT';
import { InfoPopup, useInfoPopup } from '@/components/layout/PageLayout';

const TIME_OPTIONS = [1, 3, 5, 15, 30, 60];
type ColorChoice = 'random' | 'white' | 'black';

interface GameSetupModalProps {
  selectedLevel: JarvisLevel;
  onStart: (color: 'white' | 'black', timeMinutes: number) => void;
  onClose: () => void;  // J1: переименован из onBack
}

// J4: слайды информационного попапа о Джарвисе
const JARVIS_INFO_SLIDES = [
  {
    icon: '🤖',
    title: 'J.A.R.V.I.S — AI Opponent',
    desc: 'Play against artificial intelligence. Win to unlock the next level and earn coins. Each level is harder than the last.',
  },
  {
    icon: '🏅',
    title: '20 Mastery Levels',
    desc: 'From Beginner to Mystic. Winning each level grants a unique badge for your profile — other players will see your rank.',
  },
  {
    icon: '💰',
    title: 'Coins for Victory',
    desc: 'The higher the level, the bigger the reward. At Mystic level you earn up to 75,000 ᚙ per win! Losing does not deduct coins.',
  },
];

export const GameSetupModal: React.FC<GameSetupModalProps> = ({ selectedLevel, onStart, onClose }) => {
  const t = useT();
  const [color, setColor] = useState<ColorChoice>('random');
  const [time, setTime] = useState(5);
  const [launching, setLaunching] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [resolvedColor, setResolvedColor] = useState<'white' | 'black'>('white');

  // J4: показываем попап один раз при первом открытии
  const jarvisInfo = useInfoPopup('jarvis', JARVIS_INFO_SLIDES);

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
          <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 24px' }}>
            <div style={glowRingStyle} />
            <div style={innerCircleStyle}>
              <span style={{ fontSize: 42 }}>🤖</span>
            </div>
          </div>

          <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--color-accent, #F5C842)', textAlign: 'center', marginBottom: 6 }}>
            Launching battle!
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary, #8B92A8)', textAlign: 'center', marginBottom: 28 }}>
            J.A.R.V.I.S {selectedLevel.name} · {time < 60 ? `${time} min` : '1 hr'}
          </div>

          {/* VS banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 28 }}>
            <div style={playerChipStyle}>
              {resolvedColor === 'white' ? '♔' : '♚'} You
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-muted, #4A5270)' }}>VS</span>
            <div style={{ ...playerChipStyle, background: 'var(--modal-jarvis-chip-bg, rgba(155,133,255,0.12))', borderColor: 'var(--modal-jarvis-chip-border, rgba(155,133,255,0.3))', color: 'var(--modal-jarvis-chip-color, #9B85FF)' }}>
              {resolvedColor === 'white' ? '♚' : '♔'} JARVIS
            </div>
          </div>

          {/* Countdown */}
          <div style={{ textAlign: 'center' }}>
            <div style={countdownCircleStyle}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 32, fontWeight: 800, color: 'var(--color-accent, #F5C842)' }}>
                {countdown}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted, #4A5270)', marginTop: 10, letterSpacing: '.06em' }}>
              SECONDS TO START
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
        <InfoPopup infoKey="jarvis" slides={JARVIS_INFO_SLIDES} onClose={jarvisInfo.close} />
      )}
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header — fixed at top */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, flexShrink: 0 }}>
          <button onClick={onClose} style={backBtnStyle}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary, #F0F2F8)' }}>
              🤖 {selectedLevel.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-accent, #F5C842)', marginTop: 2 }}>
              Level {selectedLevel.level} / 20 · +{selectedLevel.reward.toLocaleString()} ᚙ per win
            </div>
          </div>
          {/* J4: кнопка открыть инфо вручную */}
          <button
            onClick={jarvisInfo.open}
            style={{ ...backBtnStyle, fontSize: 16, color: 'var(--color-text-secondary, #8B92A8)' }}
            title="About J.A.R.V.I.S"
          >
            ℹ️
          </button>
          <button onClick={onClose} style={backBtnStyle}>✕</button>
        </div>

        {/* Scrollable content area */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
          {/* Color selection */}
          <div style={sectionLbl}>{t.gameSetup.color}</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: window.innerWidth < 480 ? '1fr 1fr' : '1fr 1fr 1fr',
            gap: 8,
            marginBottom: 20,
          }}>
            {(['random', 'white', 'black'] as ColorChoice[]).map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={colorBtnStyle(color === c, c)}
              >
                <span style={{ fontSize: 24, display: 'block', marginBottom: 6 }}>
                  {c === 'random' ? '🎲' : c === 'white' ? '♔' : '♚'}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>
                  {c === 'random' ? t.gameSetup.random.replace('🎲 ','') : c === 'white' ? t.gameSetup.white.replace('☀️ ','') : t.gameSetup.black.replace('🌙 ','')}
                </span>
              </button>
            ))}
          </div>

          {/* Time selection — 6 опций в сетке 3×2 или 2×3 на мобильных */}
          <div style={sectionLbl}>{t.gameSetup.duration}</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: window.innerWidth < 480 ? '1fr 1fr' : '1fr 1fr 1fr',
            gap: 8,
            marginBottom: 24,
          }}>
            {TIME_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setTime(opt)}
                style={timeBtnStyle(time === opt)}
              >
                <span style={{ fontSize: 16, display: 'block', marginBottom: 2 }}>
                  {opt === 1 ? '⚡' : opt === 3 ? '🔥' : opt === 5 ? '♟' : opt === 15 ? '🎯' : opt === 30 ? '🏆' : '👑'}
                </span>
                {opt < 60 ? `${opt} min` : '1 hr'}
              </button>
            ))}
          </div>
        </div>

        {/* Start button — fixed at bottom */}
        <button onClick={handleStart} style={startBtnStyle}>
          ♟ Start game
        </button>
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
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
};
const sheetStyle: React.CSSProperties = {
  width: '100%', maxWidth: 'clamp(280px, 90vw, 480px)',
  background: 'var(--color-bg-card, #13161F)',
  border: '1px solid var(--gamesetup-sheet-border, rgba(255,255,255,0.1))',
  borderBottom: 'none',
  borderRadius: '24px 24px 0 0',
  padding: '20px 18px',
  paddingBottom: '20px',
  maxHeight: 'calc(100vh - 60px)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};
const launchSheetStyle: React.CSSProperties = {
  width: '100%', maxWidth: 'clamp(260px, 90vw, 360px)',
  background: 'var(--color-bg-card, #13161F)',
  border: 'var(--modal-launch-border, 1px solid rgba(245,200,66,0.2))',
  borderRadius: 28,
  padding: '40px 28px 36px',
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
  padding: '8px 16px',
  background: 'var(--modal-player-chip-bg, rgba(245,200,66,0.1))',
  border: '1px solid var(--modal-player-chip-border, rgba(245,200,66,0.25))',
  borderRadius: 12,
  fontSize: 14, fontWeight: 700,
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
};
const backBtnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: '50%',
  background: 'var(--color-border, rgba(255,255,255,0.07))',
  border: '1px solid var(--gamesetup-back-btn-border, rgba(255,255,255,0.1))',
  color: 'var(--color-text-primary, #F0F2F8)', fontSize: 16, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'inherit', flexShrink: 0,
};
const sectionLbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
  textTransform: 'uppercase', color: 'var(--color-text-muted, #4A5270)',
  marginBottom: 10,
};
const colorBtnStyle = (active: boolean, c: ColorChoice): React.CSSProperties => ({
  padding: '20px 8px', borderRadius: 14, cursor: 'pointer',
  minHeight: 80,
  background: active ? 'var(--modal-color-active-bg, rgba(245,200,66,0.1))' : 'var(--color-bg-card, #1C2030)',
  border: `2px solid ${active ? 'var(--color-accent, #F5C842)' : 'var(--color-border, rgba(255,255,255,0.07))'}`,
  color: active ? 'var(--color-accent, #F5C842)' : 'var(--color-text-secondary, #8B92A8)',
  textAlign: 'center', transition: 'all .15s', fontFamily: 'inherit',
  transform: active ? 'scale(1.05)' : 'scale(1)',
});
const timeBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '14px 8px', borderRadius: 12, cursor: 'pointer',
  minHeight: 68,
  background: active ? 'var(--modal-time-active-bg, rgba(123,97,255,0.15))' : 'var(--color-bg-card, #1C2030)',
  border: `1px solid ${active ? 'var(--modal-time-active-border, rgba(123,97,255,0.4))' : 'var(--color-border, rgba(255,255,255,0.07))'}`,
  color: active ? 'var(--modal-time-active-color, #9B85FF)' : 'var(--color-text-secondary, #8B92A8)',
  fontSize: 13, fontWeight: 700, transition: 'all .15s', fontFamily: 'inherit',
  textAlign: 'center' as const,
});
const startBtnStyle: React.CSSProperties = {
  width: '100%', padding: '19px 14px',
  minHeight: 56,
  background: 'var(--color-accent, #F5C842)',
  border: 'none', borderRadius: 14,
  color: 'var(--color-bg-dark, #0B0D11)', fontSize: 17, fontWeight: 800,
  cursor: 'pointer', fontFamily: 'inherit',
  boxShadow: 'var(--modal-start-btn-shadow, 0 4px 20px rgba(245,200,66,0.3))',
};
