import React, { useState } from 'react';
import type { JarvisLevel } from './JarvisModal';

const TIME_OPTIONS = [1, 3, 5, 10, 15, 30, 60];
type ColorChoice = 'random' | 'white' | 'black';

interface GameSetupModalProps {
  selectedLevel: JarvisLevel;
  onStart: (color: 'white' | 'black', timeMinutes: number) => void;
  onBack: () => void;
}

export const GameSetupModal: React.FC<GameSetupModalProps> = ({ selectedLevel, onStart, onBack }) => {
  const [color, setColor] = useState<ColorChoice>('random');
  const [time, setTime] = useState(10);

  const handleStart = () => {
    const resolvedColor: 'white' | 'black' = color === 'random'
      ? (Math.random() < 0.5 ? 'white' : 'black')
      : color;
    onStart(resolvedColor, time);
  };

  return (
    <div style={overlayStyle}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <button onClick={onBack} style={backBtnStyle}>←</button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#F0F2F8' }}>
              🤖 {selectedLevel.name}
            </div>
            <div style={{ fontSize: 11, color: '#F5C842', marginTop: 2 }}>
              Уровень {selectedLevel.level} · +{selectedLevel.reward.toLocaleString()} ᚙ за победу
            </div>
          </div>
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

        {/* Time selection */}
        <div style={sectionLbl}>Время партии</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {TIME_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setTime(t)}
              style={timeBtnStyle(time === t)}
            >
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
  textTransform: 'uppercase', color: '#4A5270',
  marginBottom: 10,
};
const colorBtnStyle = (active: boolean, c: ColorChoice): React.CSSProperties => ({
  padding: '12px 8px', borderRadius: 14, cursor: 'pointer',
  background: active ? 'rgba(245,200,66,0.1)' : '#1C2030',
  border: `1px solid ${active ? 'rgba(245,200,66,0.4)' : 'rgba(255,255,255,0.07)'}`,
  color: active ? '#F5C842' : '#8B92A8',
  textAlign: 'center', transition: 'all .15s', fontFamily: 'inherit',
});
const timeBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
  background: active ? 'rgba(123,97,255,0.15)' : '#1C2030',
  border: `1px solid ${active ? 'rgba(123,97,255,0.4)' : 'rgba(255,255,255,0.07)'}`,
  color: active ? '#9B85FF' : '#8B92A8',
  fontSize: 12, fontWeight: 700, transition: 'all .15s', fontFamily: 'inherit',
});
const startBtnStyle: React.CSSProperties = {
  width: '100%', padding: '14px',
  background: 'linear-gradient(135deg,#F5C842,#FFD966)',
  border: 'none', borderRadius: 14,
  color: '#0B0D11', fontSize: 15, fontWeight: 800,
  cursor: 'pointer', fontFamily: 'inherit',
  boxShadow: '0 4px 20px rgba(245,200,66,0.3)',
};
