import React, { useEffect, useState } from 'react';

export interface ConfirmModalProps {
  icon: string;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT = {
  danger:  { color: '#FF4D6A', glow: 'rgba(255,77,106,0.2)',  bg: 'linear-gradient(160deg,#1a0b0d 0%,#0B0D11 60%)', border: 'rgba(255,77,106,0.25)',  btnBg: 'rgba(255,77,106,0.12)', btnBorder: 'rgba(255,77,106,0.3)' },
  warning: { color: '#F5C842', glow: 'rgba(245,200,66,0.2)',  bg: 'linear-gradient(160deg,#1a1c0f 0%,#0B0D11 60%)', border: 'rgba(245,200,66,0.25)',   btnBg: 'rgba(245,200,66,0.1)',  btnBorder: 'rgba(245,200,66,0.35)' },
  default: { color: '#9B85FF', glow: 'rgba(123,97,255,0.2)',  bg: 'linear-gradient(160deg,#12101a 0%,#0B0D11 60%)', border: 'rgba(123,97,255,0.25)',   btnBg: 'rgba(123,97,255,0.1)',  btnBorder: 'rgba(123,97,255,0.35)' },
};

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  icon, title, message, confirmLabel, cancelLabel = 'Отмена',
  variant = 'default', onConfirm, onCancel,
}) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 20); return () => clearTimeout(t); }, []);

  const cfg = VARIANT[variant];

  const close = (cb: () => void) => {
    setVisible(false);
    setTimeout(cb, 200);
  };

  return (
    <div
      onClick={() => close(onCancel)}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 320,
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          borderRadius: 24,
          padding: '28px 24px 22px',
          boxShadow: `0 0 60px ${cfg.glow}, 0 20px 60px rgba(0,0,0,0.5)`,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.96)',
          opacity: visible ? 1 : 0,
          transition: 'transform .25s cubic-bezier(.34,1.56,.64,1), opacity .22s',
          position: 'relative',
        }}
      >
        <button
          onClick={() => close(onCancel)}
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#8B92A8', fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'inherit',
          }}
        >✕</button>

        <div style={{ textAlign: 'center', fontSize: 52, lineHeight: 1, marginBottom: 12 }}>{icon}</div>

        <div style={{
          textAlign: 'center',
          fontFamily: "'Unbounded',sans-serif",
          fontSize: 20, fontWeight: 800,
          color: cfg.color,
          letterSpacing: '-.02em',
          marginBottom: message ? 10 : 22,
          textShadow: `0 0 20px ${cfg.glow}`,
        }}>{title}</div>

        {message && (
          <div style={{
            textAlign: 'center', fontSize: 13, color: '#C0C5D8',
            lineHeight: 1.5, marginBottom: 22,
          }}>{message}</div>
        )}

        <button
          onClick={() => close(onConfirm)}
          style={{
            width: '100%', padding: '13px',
            background: cfg.btnBg,
            border: `1px solid ${cfg.btnBorder}`,
            borderRadius: 14, color: cfg.color,
            fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            marginBottom: 8,
          }}
        >{confirmLabel}</button>

        <button
          onClick={() => close(onCancel)}
          style={{
            width: '100%', padding: '13px',
            background: '#1C2030',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, color: '#C0C5D8',
            fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >{cancelLabel}</button>
      </div>
    </div>
  );
};
