import React, { useEffect } from 'react';
import { fmtBalance } from '@/utils/format';
import { useT } from '@/i18n/useT';

export interface JarvisLevel {
  level: number;
  name: string;
  reward: number;
  errorRate: number; // процент ошибок 0-20
  depth: number;     // глубина minimax 1-10
}

// 20 уровней J.A.R.V.I.S — от новичка до мистика
// ВАЖНО: названия уровней идут из translations, используй getJarvisLevels() для получения локализованных имён
const JARVIS_BASE = [
  { level: 1,  reward: 1000,  errorRate: 20, depth: 1  },
  { level: 2,  reward: 2000,  errorRate: 18, depth: 1  },
  { level: 3,  reward: 3000,  errorRate: 16, depth: 2  },
  { level: 4,  reward: 4000,  errorRate: 14, depth: 2  },
  { level: 5,  reward: 5000,  errorRate: 12, depth: 2  },
  { level: 6,  reward: 7000,  errorRate: 10, depth: 3  },
  { level: 7,  reward: 9000,  errorRate: 8,  depth: 3  },
  { level: 8,  reward: 11000, errorRate: 7,  depth: 4  },
  { level: 9,  reward: 13000, errorRate: 6,  depth: 4  },
  { level: 10, reward: 15000, errorRate: 5,  depth: 5  },
  { level: 11, reward: 18000, errorRate: 4,  depth: 5  },
  { level: 12, reward: 21000, errorRate: 3,  depth: 6  },
  { level: 13, reward: 25000, errorRate: 2,  depth: 7  },
  { level: 14, reward: 30000, errorRate: 2,  depth: 7  },
  { level: 15, reward: 35000, errorRate: 1,  depth: 8  },
  { level: 16, reward: 40000, errorRate: 1,  depth: 9  },
  { level: 17, reward: 45000, errorRate: 0,  depth: 9  },
  { level: 18, reward: 50000, errorRate: 0,  depth: 10 },
  { level: 19, reward: 60000, errorRate: 0,  depth: 10 },
  { level: 20, reward: 75000, errorRate: 0,  depth: 10 },
];

// Вспомогательная функция для получения локализованных уровней Jarvis
function getJarvisLevels(t: ReturnType<typeof useT>): JarvisLevel[] {
  return JARVIS_BASE.map((base, idx) => ({
    ...base,
    name: t.jarvis.levels[idx].name,
  }));
}

// Для совместимости — возвращает уровни с fallback именами
// ВАЖНО: используй getJarvisLevels(t) для получения локализованных имён
export const JARVIS_LEVELS: JarvisLevel[] = JARVIS_BASE.map((base, idx) => ({
  ...base,
  name: `Level ${base.level}`,
}));

// Экспортируем функцию для использования в компонентах
export { getJarvisLevels };

interface JarvisModalProps {
  currentJarvisLevel: number; // текущий разблокированный уровень игрока (1-10)
  onSelect: (level: JarvisLevel) => void;
  onClose: () => void;
}

export const JarvisModal: React.FC<JarvisModalProps> = ({ currentJarvisLevel, onSelect, onClose }) => {
  const t = useT();
  const localizedLevels = getJarvisLevels(t);

  // Авто-скролл к текущему уровню при открытии
  useEffect(() => {
    const timer = setTimeout(() => {
      const el = document.getElementById(`jarvis-level-${currentJarvisLevel}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header — fixed at top (L2: Responsive) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: window.innerWidth < 480 ? 14 : 20, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: window.innerWidth < 480 ? 16 : 20, fontWeight: 800, color: 'var(--color-text-primary, #F0F2F8)', letterSpacing: '-.02em' }}>
              🤖 J.A.R.V.I.S
            </div>
            <div style={{ fontSize: window.innerWidth < 480 ? 11 : 12, color: 'var(--color-text-secondary, #8B92A8)', marginTop: 3 }}>
              Choose difficulty level
            </div>
          </div>
          <button onClick={onClose} style={{ ...closeBtnStyle, width: window.innerWidth < 480 ? 28 : 32, height: window.innerWidth < 480 ? 28 : 32, fontSize: window.innerWidth < 480 ? 12 : 14 }}>✕</button>
        </div>

        {/* Scrollable levels container */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {[...localizedLevels].reverse().map((lvl) => {
            const unlocked = lvl.level <= currentJarvisLevel;
            const completed = lvl.level < currentJarvisLevel;
            const isActive = lvl.level === currentJarvisLevel;

            return (
              <div
                key={lvl.level}
                id={`jarvis-level-${lvl.level}`}
                onClick={() => unlocked && !completed && onSelect(lvl)}
                style={levelCardStyle(unlocked, completed, isActive)}
              >
                {/* Left — number + name (L2: Responsive) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: window.innerWidth < 480 ? 8 : 12 }}>
                  <div style={{ ...levelNumStyle(isActive, completed), width: window.innerWidth < 480 ? 32 : 36, height: window.innerWidth < 480 ? 32 : 36 }}>
                    {completed ? '✓' : lvl.level}
                  </div>
                  <div>
                    <div style={{ fontSize: window.innerWidth < 480 ? 12 : 14, fontWeight: 700, color: completed ? 'var(--color-text-muted, #4A5270)' : 'var(--color-text-primary, #F0F2F8)' }}>
                      {lvl.name}
                    </div>
                    <div style={{ fontSize: window.innerWidth < 480 ? 10 : 11, color: 'var(--color-text-muted, #4A5270)', marginTop: 2 }}>
                      {lvl.errorRate === 0 ? 'No errors' : `${lvl.errorRate}%`}
                    </div>
                  </div>
                </div>

                {/* Right — reward or lock (L2: Responsive) */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {completed ? (
                    <span style={{ fontSize: window.innerWidth < 480 ? 10 : 11, color: 'var(--color-green, #00D68F)', fontWeight: 700 }}>{t.profile.passed}</span>
                  ) : !unlocked ? (
                    <span style={{ fontSize: window.innerWidth < 480 ? 16 : 20 }}>{t.jarvis.locked ? '🔒' : ''}</span>
                  ) : (
                    <div>
                      <div style={{ fontSize: window.innerWidth < 480 ? 11 : 13, fontWeight: 800, color: 'var(--color-accent, #F5C842)', fontFamily: "'JetBrains Mono',monospace" }}>
                        +{fmtBalance(lvl.reward.toString())} ᚙ
                      </div>
                      <div style={{ fontSize: window.innerWidth < 480 ? 9 : 10, color: 'var(--color-text-secondary, #8B92A8)', marginTop: 2 }}>{t.jarvis.reward('')}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer hint — fixed at bottom (L2: Responsive) */}
        <div style={{ padding: window.innerWidth < 480 ? '12px' : '16px', background: 'var(--jarvis-modal-footer-hint-bg, rgba(123,97,255,0.08))', border: '1px solid var(--jarvis-modal-footer-hint-border, rgba(123,97,255,0.15))', borderRadius: 14, flexShrink: 0 }}>
          <div style={{ fontSize: window.innerWidth < 480 ? 13 : 15, color: 'var(--color-text-secondary, #8B92A8)', lineHeight: 1.6 }}>
            🏆 Beat levels in order. For each completed level you earn a J.A.R.V.I.S badge on your profile.
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: "var(--z-modal, 300)",
  background: 'var(--jarvis-modal-overlay-bg, rgba(0,0,0,0.7))',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  overflowY: 'auto',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
};
const sheetStyle: React.CSSProperties = {
  width: '100%', maxWidth: window.innerWidth < 480 ? 'calc(100% - 20px)' : 480,
  background: 'var(--color-bg-card, #13161F)',
  border: '1px solid var(--jarvis-modal-sheet-border, rgba(255,255,255,0.1))',
  borderBottom: 'none',
  borderRadius: '24px 24px 0 0',
  padding: window.innerWidth < 480 ? '16px 14px' : '20px 18px',
  paddingBottom: window.innerWidth < 480 ? '16px' : '20px',
  maxHeight: 'calc(100vh - 150px)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  margin: window.innerWidth < 480 ? '0 10px' : '0',
};
const closeBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%',
  background: 'var(--color-border, rgba(255,255,255,0.07))',
  border: '1px solid var(--jarvis-modal-sheet-border, rgba(255,255,255,0.1))',
  color: 'var(--color-text-secondary, #8B92A8)', fontSize: 14, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'inherit',
};
const levelCardStyle = (unlocked: boolean, completed: boolean, isActive: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: window.innerWidth < 480 ? '10px 10px' : '12px 14px',
  background: isActive ? 'var(--jarvis-modal-card-active-bg, rgba(245,200,66,0.07))' : completed ? 'var(--jarvis-modal-card-completed-bg, rgba(0,214,143,0.04))' : 'var(--color-bg-card, #1C2030)',
  border: `1px solid ${isActive ? 'var(--jarvis-modal-card-active-border, rgba(245,200,66,0.3))' : completed ? 'var(--jarvis-modal-card-completed-border, rgba(0,214,143,0.15))' : 'var(--jarvis-modal-card-default-border, var(--color-border, rgba(255,255,255,0.07)))'}`,
  borderRadius: 14,
  cursor: unlocked && !completed ? 'pointer' : 'default',
  opacity: !unlocked ? 0.5 : 1,
  transition: 'all .15s',
});
const levelNumStyle = (isActive: boolean, completed: boolean): React.CSSProperties => ({
  width: 36, height: 36, borderRadius: '50%',
  background: completed ? 'var(--jarvis-modal-num-completed-bg, rgba(0,214,143,0.15))' : isActive ? 'var(--jarvis-modal-num-active-bg, rgba(245,200,66,0.15))' : 'var(--color-bg-input, #232840)',
  border: `2px solid ${completed ? 'var(--color-green, #00D68F)' : isActive ? 'var(--color-accent, #F5C842)' : 'var(--jarvis-modal-num-default-border, rgba(255,255,255,0.1))'}`,
  color: completed ? 'var(--color-green, #00D68F)' : isActive ? 'var(--color-accent, #F5C842)' : 'var(--color-text-secondary, #8B92A8)',
  fontSize: completed ? 16 : 14, fontWeight: 800,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
});
