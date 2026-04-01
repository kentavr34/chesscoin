import React from 'react';

export const CircStat: React.FC<{ value: number; pct: number; color: string; label: string }> = ({ value, pct, color, label }) => {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const svgSize = window.innerWidth < 480 ? 56 : 72;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={svgSize} height={svgSize} viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="#2A2F48" strokeWidth="7" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      </svg>
      <div style={{
        fontFamily: 'Inter,sans-serif',
        fontSize: window.innerWidth < 480 ? 14 : 16,
        fontWeight: 800,
        color: 'var(--text-primary, #F0F2F8)',
      }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color }}>{pct}%</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
    </div>
  );
};

export const StatCard: React.FC<{ val: number; lbl: string; color?: string }> = ({ val, lbl, color }) => (
  <div style={{ background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
    <div style={{
      fontFamily: 'Inter,sans-serif',
      fontSize: window.innerWidth < 480 ? 16 : 20,
      fontWeight: 800,
      color: color ?? 'var(--text-primary, #F0F2F8)',
    }}>{val}</div>
    <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', marginTop: 3, fontWeight: 500 }}>{lbl}</div>
  </div>
);

// Styles
const secStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--text-muted, #4A5270)', padding: '16px 18px 8px' };
