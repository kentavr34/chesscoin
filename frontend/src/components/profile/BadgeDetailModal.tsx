import React from 'react';
import { useT } from '@/i18n/useT';
import { useJarvisLevels } from '@/hooks/useJarvisLevels';

export const BadgeDetailModal: React.FC<{
  badgeName: string;
  date?: string;
  onClose: () => void;
}> = ({ badgeName, date, onClose }) => {
  const t = useT();
  const localizedLevels = useJarvisLevels();
  const lvlData = localizedLevels.find(l => l.name === badgeName);
  const colors: Record<string, string> = {
    Beginner: 'var(--text-secondary, #8B92A8)', Player: '#00B4D8', Fighter: 'var(--green, #00D68F)',
    Warrior: '#4CAF50', Expert: '#9B85FF', Master: 'var(--accent, #F5C842)',
    Professional: '#FF9F43', Epic: '#FF6B6B', Legendary: '#E040FB', Mystic: 'var(--accent, #F5C842)',
  };
  const color = colors[badgeName] ?? '#9B85FF';
  const formattedDate = date ? new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: "var(--z-modal, 300)", background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 320, background: 'linear-gradient(160deg,#13161F,#0B0D11)', border: `1px solid ${color}40`, borderRadius: 24, padding: '32px 24px 24px', textAlign: 'center', boxShadow: `0 0 60px ${color}20` }}>
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 16 }}>🤖</div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-muted, #4A5270)', marginBottom: 8 }}>{t.gameResult.jarvisCert}</div>
        <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 22, fontWeight: 800, color, marginBottom: 8 }}>{badgeName}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary, #8B92A8)', marginBottom: 20 }}>
          {t.profile.level} {lvlData?.level ?? '?'} · +{(lvlData?.reward ?? 0).toLocaleString()} ᚙ
        </div>
        {formattedDate && (
          <div style={{ fontSize: 14, color: 'var(--text-secondary, #8B92A8)', marginBottom: 8 }}>📅 {formattedDate}</div>
        )}
        <div style={{ fontSize: 12, color: 'var(--green, #00D68F)', marginBottom: 24 }}>{t.gameResult.confirmedBy}</div>
        <button onClick={onClose} style={{ width: '100%', padding: 12, background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, color: 'var(--text-primary, #F0F2F8)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {t.gameResult.close}
        </button>
      </div>
    </div>
  );
};

type Tab = 'info' | 'games' | 'saves' | 'ach' | 'settings';

