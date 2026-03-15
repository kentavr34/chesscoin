import React, { useState, useEffect } from 'react';

export interface JarvisLevel {
  level: number;
  name: string;
  reward: number;
  errorRate: number;
  depth: number;
}

export const JARVIS_LEVELS: JarvisLevel[] = [
  { level: 1,  name: 'Beginner',     reward: 1000,  errorRate: 25, depth: 1  },
  { level: 2,  name: 'Player',       reward: 3000,  errorRate: 18, depth: 2  },
  { level: 3,  name: 'Fighter',      reward: 5000,  errorRate: 14, depth: 3  },
  { level: 4,  name: 'Warrior',      reward: 7000,  errorRate: 10, depth: 4  },
  { level: 5,  name: 'Expert',       reward: 9000,  errorRate: 7,  depth: 5  },
  { level: 6,  name: 'Master',       reward: 12000, errorRate: 4,  depth: 6  },
  { level: 7,  name: 'Professional', reward: 15000, errorRate: 2,  depth: 7  },
  { level: 8,  name: 'Epic',         reward: 20000, errorRate: 1,  depth: 9  },
  { level: 9,  name: 'Legendary',    reward: 30000, errorRate: 0,  depth: 12 },
  { level: 10, name: 'Mystic',       reward: 50000, errorRate: 0,  depth: 20 },
];

type ColorChoice = 'random' | 'white' | 'black';
const TIME_OPTIONS = [1, 3, 5, 15, 30, 60];

interface JarvisModalProps {
  currentJarvisLevel: number;
  onStart: (color: 'white' | 'black', timeMinutes: number) => void;
  onClose: () => void;
}

export const JarvisModal: React.FC<JarvisModalProps> = ({ currentJarvisLevel, onStart, onClose }) => {
  const [color, setColor] = useState<ColorChoice>('random');
  const [time, setTime] = useState(5);
  const [launching, setLaunching] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [resolvedColor, setResolvedColor] = useState<'white' | 'black'>('white');
  const [showInfo, setShowInfo] = useState(() => !localStorage.getItem('jarvis_info_seen'));

  const lvlIdx = Math.max(0, Math.min(9, currentJarvisLevel - 1));
  const currentLevel = JARVIS_LEVELS[lvlIdx];
  const prevLevel   = currentJarvisLevel > 1  ? JARVIS_LEVELS[lvlIdx - 1] : null;
  const nextLevel   = currentJarvisLevel < 10 ? JARVIS_LEVELS[lvlIdx + 1] : null;

  useEffect(() => {
    if (!launching) return;
    setCountdown(3);
    const iv = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(iv); return 0; } return c - 1; });
    }, 1000);
    const t = setTimeout(() => { onStart(resolvedColor, time); }, 3000);
    return () => { clearInterval(iv); clearTimeout(t); };
  }, [launching]);

  const handleStart = () => {
    const rc: 'white' | 'black' = color === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : color;
    setResolvedColor(rc);
    setLaunching(true);
  };

  const handleInfoClose = () => {
    localStorage.setItem('jarvis_info_seen', '1');
    setShowInfo(false);
  };

  // ── Info popup ─────────────────────────────────────────────────────────────
  if (showInfo) {
    return (
      <div style={overlayStyle} onClick={handleInfoClose}>
        <div style={{ ...sheetStyle, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexShrink: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#9B85FF' }}>🤖 J.A.R.V.I.S</div>
            <button onClick={handleInfoClose} style={closeBtnStyle}>✕</button>
          </div>
          <div style={{ fontSize: 12, color: '#C8CDDF', lineHeight: 1.7, marginBottom: 14, flexShrink: 0 }}>
            Искусственный интеллект J.A.R.V.I.S играет сильнее на каждом уровне.
            По мере прохождения открывается следующий уровень и вы получаете сертификат в профиле.
            Ваш уровень виден всем — развивайте свой шахматный статус!
          </div>
          <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 4 }}>
            {[...JARVIS_LEVELS].reverse().map(lvl => {
              const done = lvl.level < currentJarvisLevel;
              const active = lvl.level === currentJarvisLevel;
              return (
                <div key={lvl.level} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', marginBottom: 5, background: active ? 'rgba(245,200,66,0.07)' : '#1C2030', border: `1px solid ${active ? 'rgba(245,200,66,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: done ? 'rgba(0,214,143,0.15)' : active ? 'rgba(245,200,66,0.15)' : '#232840', border: `1.5px solid ${done ? '#00D68F' : active ? '#F5C842' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: done ? '#00D68F' : active ? '#F5C842' : '#8B92A8', flexShrink: 0 }}>
                      {done ? '✓' : lvl.level}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: lvl.level > currentJarvisLevel ? '#4A5270' : '#F0F2F8' }}>{lvl.name}</div>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: '#F5C842', fontWeight: 700 }}>+{lvl.reward.toLocaleString()} ᚙ</div>
                </div>
              );
            })}
          </div>
          <button onClick={handleInfoClose} style={{ marginTop: 12, width: '100%', padding: '14px 0', background: '#9B85FF', border: 'none', borderRadius: 14, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            Понятно, начнём! →
          </button>
        </div>
      </div>
    );
  }

  // ── Launch countdown ───────────────────────────────────────────────────────
  if (launching) {
    return (
      <div style={overlayStyle}>
        <div style={launchSheetStyle}>
          <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 22px' }}>
            <div style={glowRingStyle} />
            <div style={innerCircleStyle}><span style={{ fontSize: 38 }}>🤖</span></div>
          </div>
          <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 20, fontWeight: 800, color: '#F5C842', textAlign: 'center', marginBottom: 6 }}>Запускаем бой!</div>
          <div style={{ fontSize: 12, color: '#8B92A8', textAlign: 'center', marginBottom: 22 }}>J.A.R.V.I.S {currentLevel.name} · {time < 60 ? `${time} мин` : '1 час'}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 24 }}>
            <div style={chipStyle('#F5C842', 'rgba(245,200,66,0.1)', 'rgba(245,200,66,0.25)')}>
              {resolvedColor === 'white' ? '♔' : '♚'} Вы
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#4A5270' }}>VS</span>
            <div style={chipStyle('#9B85FF', 'rgba(155,133,255,0.12)', 'rgba(155,133,255,0.3)')}>
              {resolvedColor === 'white' ? '♚' : '♔'} JARVIS
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={cdCircleStyle}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 30, fontWeight: 800, color: '#F5C842' }}>{countdown}</span>
            </div>
            <div style={{ fontSize: 10, color: '#4A5270', marginTop: 8, letterSpacing: '.06em' }}>СЕКУНДЫ ДО СТАРТА</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main modal ─────────────────────────────────────────────────────────────
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#F0F2F8' }}>🤖 J.A.R.V.I.S</div>
            <div style={{ fontSize: 11, color: '#F5C842', marginTop: 2 }}>
              {currentLevel.name} · Уровень {currentJarvisLevel} · +{currentLevel.reward.toLocaleString()} ᚙ за победу
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); setShowInfo(true); }}
            title="Информация об уровнях"
            style={{ ...closeBtnStyle, marginRight: 8, background: 'rgba(155,133,255,0.12)', borderColor: 'rgba(155,133,255,0.25)', color: '#9B85FF', fontSize: 15 }}
          >ℹ</button>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Level progression: prev → current → next */}
        <div style={{ display: 'grid', gridTemplateColumns: prevLevel && nextLevel ? '1fr 1.25fr 1fr' : nextLevel ? '1.25fr 1fr' : prevLevel ? '1fr 1.25fr' : '1fr', gap: 8, marginBottom: 18 }}>
          {prevLevel && (
            <div style={{ padding: '10px 8px', background: 'rgba(0,214,143,0.05)', border: '1px solid rgba(0,214,143,0.2)', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#00D68F', letterSpacing: '.06em', marginBottom: 4 }}>✓ ПРОЙДЕН</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#4A5270' }}>{prevLevel.name}</div>
              <div style={{ fontSize: 9, color: '#4A5270', marginTop: 2 }}>Lv.{prevLevel.level}</div>
            </div>
          )}
          <div style={{ padding: '12px 8px', background: 'rgba(245,200,66,0.08)', border: '2px solid rgba(245,200,66,0.45)', borderRadius: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#F5C842', letterSpacing: '.06em', marginBottom: 4 }}>⚡ ИГРАЮ СЕЙЧАС</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#F5C842' }}>{currentLevel.name}</div>
            <div style={{ fontSize: 9, color: 'rgba(245,200,66,0.6)', marginTop: 2 }}>Lv.{currentJarvisLevel}</div>
          </div>
          {nextLevel && (
            <div style={{ padding: '10px 8px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, textAlign: 'center', opacity: 0.55 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#4A5270', letterSpacing: '.06em', marginBottom: 4 }}>🔒 СЛЕДУЮЩИЙ</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#4A5270' }}>{nextLevel.name}</div>
              <div style={{ fontSize: 9, color: '#4A5270', marginTop: 2 }}>Lv.{nextLevel.level}</div>
            </div>
          )}
        </div>

        {/* Color selection */}
        <div style={sectionLbl}>Выбор цвета</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {(['random', 'white', 'black'] as ColorChoice[]).map(c => (
            <button key={c} onClick={() => setColor(c)} style={colorBtnStyle(color === c)}>
              <span style={{ fontSize: 22, display: 'block', marginBottom: 4 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
          {TIME_OPTIONS.map(t => (
            <button key={t} onClick={() => setTime(t)} style={timeBtnStyle(time === t)}>
              <span style={{ fontSize: 14, display: 'block', marginBottom: 2 }}>
                {t === 1 ? '⚡' : t === 3 ? '🔥' : t === 5 ? '♟' : t === 15 ? '🎯' : t === 30 ? '🏆' : '👑'}
              </span>
              {t < 60 ? `${t} мин` : '1 час'}
            </button>
          ))}
        </div>

        {/* Start button */}
        <button onClick={handleStart} style={startBtnStyle}>♟ Начать партию</button>
      </div>
    </div>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 300,
  background: 'rgba(0,0,0,0.72)',
  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
};
const sheetStyle: React.CSSProperties = {
  width: '100%', maxWidth: 480,
  background: '#13161F',
  border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none',
  borderRadius: '24px 24px 0 0',
  padding: '20px 18px',
  paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
};
const launchSheetStyle: React.CSSProperties = {
  width: '100%', maxWidth: 340,
  background: '#13161F',
  border: '1px solid rgba(245,200,66,0.2)', borderRadius: 28,
  padding: '38px 26px 34px', margin: 'auto',
  boxShadow: '0 0 80px rgba(245,200,66,0.12), 0 30px 60px rgba(0,0,0,0.5)',
  alignSelf: 'center',
};
const closeBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%',
  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#8B92A8', fontSize: 14, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
};
const glowRingStyle: React.CSSProperties = {
  position: 'absolute', inset: -5, borderRadius: '50%',
  background: 'conic-gradient(from 0deg, #F5C842, #9B85FF, #F5C842)',
  animation: 'spin 2s linear infinite', opacity: 0.6,
};
const innerCircleStyle: React.CSSProperties = {
  position: 'absolute', inset: 4, borderRadius: '50%', background: '#13161F',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const chipStyle = (color: string, bg: string, border: string): React.CSSProperties => ({
  padding: '7px 14px', background: bg, border: `1px solid ${border}`,
  borderRadius: 12, fontSize: 13, fontWeight: 700, color,
});
const cdCircleStyle: React.CSSProperties = {
  width: 76, height: 76, borderRadius: '50%',
  background: 'rgba(245,200,66,0.08)', border: '3px solid rgba(245,200,66,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  margin: '0 auto', boxShadow: '0 0 28px rgba(245,200,66,0.2)',
};
const sectionLbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
  textTransform: 'uppercase', color: '#4A5270', marginBottom: 10,
};
const colorBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '18px 8px', borderRadius: 14, cursor: 'pointer', minHeight: 76,
  background: active ? 'rgba(245,200,66,0.1)' : '#1C2030',
  border: `2px solid ${active ? '#F5C842' : 'rgba(255,255,255,0.07)'}`,
  color: active ? '#F5C842' : '#8B92A8',
  textAlign: 'center', transition: 'all .15s', fontFamily: 'inherit',
  transform: active ? 'scale(1.04)' : 'scale(1)',
});
const timeBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '12px 8px', borderRadius: 12, cursor: 'pointer', minHeight: 62,
  background: active ? 'rgba(123,97,255,0.15)' : '#1C2030',
  border: `1px solid ${active ? 'rgba(123,97,255,0.4)' : 'rgba(255,255,255,0.07)'}`,
  color: active ? '#9B85FF' : '#8B92A8',
  fontSize: 12, fontWeight: 700, transition: 'all .15s', fontFamily: 'inherit', textAlign: 'center',
});
const startBtnStyle: React.CSSProperties = {
  width: '100%', padding: '18px 14px', minHeight: 54,
  background: '#F5C842', border: 'none', borderRadius: 14,
  color: '#0B0D11', fontSize: 16, fontWeight: 800,
  cursor: 'pointer', fontFamily: 'inherit',
  boxShadow: '0 4px 20px rgba(245,200,66,0.3)',
};
