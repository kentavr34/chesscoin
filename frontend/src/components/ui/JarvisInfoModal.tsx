import React from 'react';
import { useT } from '@/i18n/useT';

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 600,
  background: 'var(--jarvis-info-overlay-bg, rgba(0,0,0,0.7))', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
};

const boxStyle: React.CSSProperties = {
  background: 'var(--jarvis-info-box-gradient, linear-gradient(145deg, rgba(30,34,52,0.95), rgba(20,24,35,0.95)))',
  border: '1px solid var(--jarvis-info-box-border, rgba(123,97,255,0.3))',
  borderRadius: 24, padding: '24px 20px', width: '100%', maxWidth: 360,
  position: 'relative', boxShadow: 'var(--jarvis-info-box-shadow, 0 16px 40px rgba(0,0,0,0.5))',
  maxHeight: '85vh', overflowY: 'auto'
};

const closeStyle: React.CSSProperties = {
  position: 'absolute', top: 10, right: 10,
  background: 'var(--jarvis-info-close-bg, rgba(255,255,255,0.05))', border: 'none', borderRadius: '50%',
  width: 44, height: 44, color: 'var(--color-text-secondary, #8B92A8)',
  fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
};

export const JarvisInfoModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const t: any = useT();

  return (
    <div style={overlayStyle}>
      <div style={boxStyle}>
        <button onClick={onClose} style={closeStyle}>✕</button>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🧠</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-purple, #9B85FF)', fontFamily: "'Unbounded', sans-serif" }}>
            J.A.R.V.I.S AI
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary, #8B92A8)', marginTop: 4, lineHeight: 1.4 }}>
            {t.home.jarvisInfo?.subtitle ?? 'Intelligent Chess Engine'}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-primary, #F0F2F8)', lineHeight: 1.6 }}>
            {t.home.jarvisInfo?.desc ?? 'Defeat AI levels to earn coins and unique badges. Each level gets progressively harder, ending with the ultimate Mystic Grandmaster challenge.'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <LevelTier
            range="Lv. 1 - 5"
            title={t.home.jarvisInfo?.tier1 ?? "Novice"}
            elo="800 - 1600"
            desc={t.home.jarvisInfo?.desc1 ?? "Basic knowledge, frequent mistakes."}
            color="var(--jarvis-tier1-color, #00D68F)" />
          <LevelTier
            range="Lv. 6 - 10"
            title={t.home.jarvisInfo?.tier2 ?? "Intermediate"}
            elo="1700 - 2200"
            desc={t.home.jarvisInfo?.desc2 ?? "Good tactical vision, solid openings."}
            color="var(--jarvis-tier2-color, #3498db)" />
          <LevelTier
            range="Lv. 11 - 15"
            title={t.home.jarvisInfo?.tier3 ?? "Advanced"}
            elo="2300 - 2700"
            desc={t.home.jarvisInfo?.desc3 ?? "Master level play, very few errors."}
            color="var(--jarvis-tier3-color, #e67e22)" />
          <LevelTier
            range="Lv. 16 - 19"
            title={t.home.jarvisInfo?.tier4 ?? "Grandmaster"}
            elo="2800 - 3100"
            desc={t.home.jarvisInfo?.desc4 ?? "Flawless engine calculation."}
            color="var(--jarvis-tier4-color, #FF4D6A)" />
          <div style={{
            background: 'var(--jarvis-info-mystic-gradient, linear-gradient(90deg, rgba(245,200,66,0.15), rgba(245,200,66,0.05)))',
            border: '1px solid var(--jarvis-info-mystic-border, rgba(245,200,66,0.3))', borderRadius: 12, padding: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-accent, #F5C842)' }}>Mystic (Lv. 20)</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-accent, #F5C842)', background: 'var(--jarvis-info-mystic-badge-bg, rgba(245,200,66,0.2))', padding: '2px 6px', borderRadius: 4 }}>ELO 3200+</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #8B92A8)' }}>
              {t.home.jarvisInfo?.desc5 ?? "The ultimate challenge. Unrestricted engine depth. Play against a World Champion."}
            </div>
          </div>
        </div>

        <button onClick={onClose} style={{
          width: '100%', padding: '14px', background: 'var(--color-accent, #F5C842)',
          color: 'var(--color-bg-dark, #0B0D11)', border: 'none', borderRadius: 14,
          fontSize: 14, fontWeight: 700, marginTop: 24, cursor: 'pointer'
        }}>
          {t.common.ok ?? 'Got it!'}
        </button>
      </div>
    </div>
  );
};

const LevelTier: React.FC<{ range: string; title: string; elo: string; desc: string; color: string }> = ({ range, title, elo, desc, color }) => (
  <div style={{ background: 'var(--jarvis-info-tier-dark-bg, rgba(0,0,0,0.2))', border: '1px solid var(--jarvis-info-tier-border, rgba(255,255,255,0.05))', borderRadius: 12, padding: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary, #F0F2F8)' }}>
        <span style={{ color: color, marginRight: 6 }}>{range}</span> {title}
      </span>
      <span style={{ fontSize: 10, color: 'var(--color-text-muted, #4A5270)' }}>ELO {elo}</span>
    </div>
    <div style={{ fontSize: 11, color: 'var(--color-text-secondary, #8B92A8)' }}>{desc}</div>
  </div>
);
