import React from 'react';
import { fmtBalance } from '@/utils/format';

export interface JarvisLevel {
  level: number;
  name: string;
  reward: number;
  errorRate: number; // процент ошибок 0-20
  depth: number;     // глубина minimax 1-10
}

export const JARVIS_LEVELS: JarvisLevel[] = [
  { level: 1,  name: 'Beginner',     reward: 1000,  errorRate: 20, depth: 1 },
  { level: 2,  name: 'Player',       reward: 3000,  errorRate: 17, depth: 2 },
  { level: 3,  name: 'Fighter',      reward: 5000,  errorRate: 14, depth: 2 },
  { level: 4,  name: 'Warrior',      reward: 7000,  errorRate: 11, depth: 3 },
  { level: 5,  name: 'Expert',       reward: 10000, errorRate: 9,  depth: 3 },
  { level: 6,  name: 'Master',       reward: 13000, errorRate: 7,  depth: 4 },
  { level: 7,  name: 'Professional', reward: 17000, errorRate: 5,  depth: 5 },
  { level: 8,  name: 'Epic',         reward: 21000, errorRate: 3,  depth: 6 },
  { level: 9,  name: 'Legendary',    reward: 26000, errorRate: 1,  depth: 8 },
  { level: 10, name: 'Mystic',       reward: 30000, errorRate: 0,  depth: 10 },
];

interface JarvisModalProps {
  currentJarvisLevel: number; // текущий разблокированный уровень игрока (1-10)
  onSelect: (level: JarvisLevel) => void;
  onClose: () => void;
}

export const JarvisModal: React.FC<JarvisModalProps> = ({ currentJarvisLevel, onSelect, onClose }) => {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#F0F2F8', letterSpacing: '-.02em' }}>
              🤖 J.A.R.V.I.S
            </div>
            <div style={{ fontSize: 12, color: '#8B92A8', marginTop: 3 }}>
              Выберите уровень сложности
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Levels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '65vh', overflowY: 'auto', paddingBottom: 8 }}>
          {[...JARVIS_LEVELS].reverse().map((lvl) => {
            const unlocked = lvl.level <= currentJarvisLevel;
            const completed = lvl.level < currentJarvisLevel;
            const isActive = lvl.level === currentJarvisLevel;

            return (
              <div
                key={lvl.level}
                onClick={() => unlocked && !completed && onSelect(lvl)}
                style={levelCardStyle(unlocked, completed, isActive)}
              >
                {/* Left — number + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={levelNumStyle(isActive, completed)}>
                    {completed ? '✓' : lvl.level}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: completed ? '#4A5270' : '#F0F2F8' }}>
                      {lvl.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#4A5270', marginTop: 2 }}>
                      {lvl.errorRate === 0 ? 'Без ошибок' : `Ошибки ИИ: ${lvl.errorRate}%`}
                    </div>
                  </div>
                </div>

                {/* Right — reward or lock */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {completed ? (
                    <span style={{ fontSize: 11, color: '#00D68F', fontWeight: 700 }}>Пройден</span>
                  ) : !unlocked ? (
                    <span style={{ fontSize: 20 }}>🔒</span>
                  ) : (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#F5C842', fontFamily: "'JetBrains Mono',monospace" }}>
                        +{fmtBalance(lvl.reward.toString())} ᚙ
                      </div>
                      <div style={{ fontSize: 10, color: '#8B92A8', marginTop: 2 }}>за победу</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(123,97,255,0.08)', border: '1px solid rgba(123,97,255,0.15)', borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: '#8B92A8', lineHeight: 1.5 }}>
            🏆 Побеждайте уровни по очереди. За каждый пройденный уровень вы получаете бейдж J.A.R.V.I.S в профиле.
          </div>
        </div>
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
const closeBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#8B92A8', fontSize: 14, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'inherit',
};
const levelCardStyle = (unlocked: boolean, completed: boolean, isActive: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 14px',
  background: isActive ? 'rgba(245,200,66,0.07)' : completed ? 'rgba(0,214,143,0.04)' : '#1C2030',
  border: `1px solid ${isActive ? 'rgba(245,200,66,0.3)' : completed ? 'rgba(0,214,143,0.15)' : 'rgba(255,255,255,0.07)'}`,
  borderRadius: 14,
  cursor: unlocked && !completed ? 'pointer' : 'default',
  opacity: !unlocked ? 0.5 : 1,
  transition: 'all .15s',
});
const levelNumStyle = (isActive: boolean, completed: boolean): React.CSSProperties => ({
  width: 36, height: 36, borderRadius: '50%',
  background: completed ? 'rgba(0,214,143,0.15)' : isActive ? 'rgba(245,200,66,0.15)' : '#232840',
  border: `2px solid ${completed ? '#00D68F' : isActive ? '#F5C842' : 'rgba(255,255,255,0.1)'}`,
  color: completed ? '#00D68F' : isActive ? '#F5C842' : '#8B92A8',
  fontSize: completed ? 16 : 14, fontWeight: 800,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
});
