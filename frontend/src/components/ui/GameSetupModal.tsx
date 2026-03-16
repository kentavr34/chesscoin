import React, { useState, useEffect } from 'react';
import type { JarvisLevel } from './JarvisModal';

const TIME_OPTIONS = [1, 3, 5, 15, 30, 60];
type ColorChoice = 'random' | 'white' | 'black';

interface GameSetupModalProps {
  selectedLevel: JarvisLevel;
  onStart: (color: 'white' | 'black', timeMinutes: number) => void;
  onBack: () => void;
}

export const GameSetupModal: React.FC<GameSetupModalProps> = ({ selectedLevel, onStart, onBack }) => {
  const [color, setColor] = useState<ColorChoice>('random');
  const [time, setTime] = useState(5);
  const [launching, setLaunching] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [resolvedColor, setResolvedColor] = useState<'white' | 'black'>('white');

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
    const t = setTimeout(() => {
      onStart(resolvedColor, time);
    }, 3000);
    return () => { clearInterval(iv); clearTimeout(t); };
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

          <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 22, fontWeight: 800, color: '#F5C842', textAlign: 'center', marginBottom: 6 }}>
            Запускаем бой!
          </div>
          <div style={{ fontSize: 13, color: '#A8B0C8', textAlign: 'center', marginBottom: 28 }}>
            J.A.R.V.I.S {selectedLevel.name} · {time < 60 ? `${time} мин` : '1 час'}
          </div>

          {/* VS banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 28 }}>
            <div style={playerChipStyle}>
              {resolvedColor === 'white' ? '♔' : '♚'} Вы
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#6B7494' }}>VS</span>
            <div style={{ ...playerChipStyle, background: 'rgba(155,133,255,0.12)', borderColor: 'rgba(155,133,255,0.3)', color: '#9B85FF' }}>
              {resolvedColor === 'white' ? '♚' : '♔'} JARVIS
            </div>
          </div>

          {/* Countdown */}
          <div style={{ textAlign: 'center' }}>
            <div style={countdownCircleStyle}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 32, fontWeight: 800, color: '#F5C842' }}>
                {countdown}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#6B7494', marginTop: 10, letterSpacing: '.06em' }}>
              СЕКУНДЫ ДО СТАРТА
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <button onClick={onBack} style={backBtnStyle}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#F0F2F8' }}>
              🤖 {selectedLevel.name}
            </div>
            <div style={{ fontSize: 11, color: '#F5C842', marginTop: 2 }}>
              Уровень {selectedLevel.level} · +{selectedLevel.reward.toLocaleString()} ᚙ за победу
            </div>
          </div>
          <button onClick={onBack} style={backBtnStyle}>✕</button>
        </div>

        {/* Color selection */}
        <div style={sectionLbl}>Выбор цвета</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
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
                {c === 'random' ? 'Случайно' : c === 'white' ? 'Белые' : 'Чёрные'}
              </span>
            </button>
          ))}
        </div>

        {/* Time selection — 6 опций в сетке 3×2 */}
        <div style={sectionLbl}>Время партии</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
          {TIME_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setTime(t)}
              style={timeBtnStyle(time === t)}
            >
              <span style={{ fontSize: 16, display: 'block', marginBottom: 2 }}>
                {t === 1 ? '⚡' : t === 3 ? '🔥' : t === 5 ? '♟' : t === 15 ? '🎯' : t === 30 ? '🏆' : '👑'}
              </span>
              {t < 60 ? `${t} мин` : '1 час'}
            </button>
          ))}
        </div>

        {/* Start button */}
        <button onClick={handleStart} style={startBtnStyle}>
          ♟ Начать партию
        </button>
      </div>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 300,
  background: 'rgba(0,0,0,0.7)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
};
const sheetStyle: React.CSSProperties = {
  width: '100%', maxWidth: 480,
  background: '#13161F',
  border: '1px solid rgba(255,255,255,0.1)',
  borderBottom: 'none',
  borderRadius: '24px 24px 0 0',
  padding: '20px 18px',
  paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
};
const launchSheetStyle: React.CSSProperties = {
  width: '100%', maxWidth: 360,
  background: '#13161F',
  border: '1px solid rgba(245,200,66,0.2)',
  borderRadius: 28,
  padding: '40px 28px 36px',
  margin: 'auto',
  boxShadow: '0 0 80px rgba(245,200,66,0.12), 0 30px 60px rgba(0,0,0,0.5)',
  position: 'relative',
  alignSelf: 'center',
};
const glowRingStyle: React.CSSProperties = {
  position: 'absolute', inset: -6,
  borderRadius: '50%',
  background: 'conic-gradient(from 0deg, #F5C842, #9B85FF, #F5C842)',
  animation: 'spin 2s linear infinite',
  opacity: 0.6,
};
const innerCircleStyle: React.CSSProperties = {
  position: 'absolute', inset: 4,
  borderRadius: '50%',
  background: '#13161F',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const playerChipStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'rgba(245,200,66,0.1)',
  border: '1px solid rgba(245,200,66,0.25)',
  borderRadius: 12,
  fontSize: 14, fontWeight: 700,
  color: '#F5C842',
};
const countdownCircleStyle: React.CSSProperties = {
  width: 80, height: 80,
  borderRadius: '50%',
  background: 'rgba(245,200,66,0.08)',
  border: '3px solid rgba(245,200,66,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  margin: '0 auto',
  boxShadow: '0 0 30px rgba(245,200,66,0.2)',
};
const backBtnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: '50%',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#F0F2F8', fontSize: 16, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'inherit', flexShrink: 0,
};
const sectionLbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
  textTransform: 'uppercase', color: '#6B7494',
  marginBottom: 10,
};
const colorBtnStyle = (active: boolean, c: ColorChoice): React.CSSProperties => ({
  padding: '20px 8px', borderRadius: 14, cursor: 'pointer',
  minHeight: 80,
  background: active ? 'rgba(245,200,66,0.1)' : '#1C2030',
  border: `2px solid ${active ? '#F5C842' : 'rgba(255,255,255,0.07)'}`,
  color: active ? '#F5C842' : '#A8B0C8',
  textAlign: 'center', transition: 'all .15s', fontFamily: 'inherit',
  transform: active ? 'scale(1.05)' : 'scale(1)',
});
const timeBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '14px 8px', borderRadius: 12, cursor: 'pointer',
  minHeight: 68,
  background: active ? 'rgba(123,97,255,0.15)' : '#1C2030',
  border: `1px solid ${active ? 'rgba(123,97,255,0.4)' : 'rgba(255,255,255,0.07)'}`,
  color: active ? '#9B85FF' : '#A8B0C8',
  fontSize: 13, fontWeight: 700, transition: 'all .15s', fontFamily: 'inherit',
  textAlign: 'center' as const,
});
const startBtnStyle: React.CSSProperties = {
  width: '100%', padding: '19px 14px',
  minHeight: 56,
  background: '#F5C842',
  border: 'none', borderRadius: 14,
  color: '#0B0D11', fontSize: 17, fontWeight: 800,
  cursor: 'pointer', fontFamily: 'inherit',
  boxShadow: '0 4px 20px rgba(245,200,66,0.3)',
};
