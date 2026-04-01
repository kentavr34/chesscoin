import React, { useEffect, useState, useRef } from 'react';

export interface PromptModalProps {
  icon: string;
  title: string;
  message?: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  icon, title, message, placeholder, confirmLabel, cancelLabel = 'Cancel',
  onConfirm, onCancel,
}) => {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }, 20);
    return () => clearTimeout(t);
  }, []);

  const close = (cb: () => void) => { setVisible(false); setTimeout(cb, 200); };

  return (
    <div
      onClick={() => close(onCancel)}
      style={{
        position: 'fixed', inset: 0, zIndex: "var(--z-modal, 300)",
        background: 'var(--prompt-overlay-bg, rgba(0,0,0,0.72))',
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
          background: 'linear-gradient(160deg, var(--color-bg-light, #12101a) 0%, var(--color-bg-dark, #0B0D11) 60%)',
          border: '1px solid var(--prompt-modal-border, rgba(155,133,255,0.25))',
          borderRadius: 24,
          padding: '28px 24px 22px',
          boxShadow: `0 0 60px var(--prompt-modal-glow-shadow, rgba(155,133,255,0.2)), 0 20px 60px var(--prompt-modal-shadow, rgba(0,0,0,0.5))`,
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
            background: 'var(--prompt-close-btn-bg, rgba(255,255,255,0.07))',
            border: '1px solid var(--prompt-close-btn-border, rgba(255,255,255,0.1))',
            color: 'var(--color-text-secondary, #A8B0C8)', fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'inherit',
          }}
        >✕</button>

        <div style={{ textAlign: 'center', fontSize: 52, lineHeight: 1, marginBottom: 12 }}>{icon}</div>

        <div style={{
          textAlign: 'center',
          fontFamily: "'Unbounded',sans-serif",
          fontSize: 20, fontWeight: 800,
          color: 'var(--color-purple, #9B85FF)',
          letterSpacing: '-.02em',
          marginBottom: message ? 10 : 18,
          textShadow: '0 0 20px var(--prompt-title-text-shadow, rgba(155,133,255,0.3))',
        }}>{title}</div>

        {message && (
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary, #C0C5D8)', lineHeight: 1.5, marginBottom: 18 }}>{message}</div>
        )}

        <input
          ref={inputRef}
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder ?? ''}
          onKeyDown={e => { if (e.key === 'Enter' && Number(value) > 0) close(() => onConfirm(value)); }}
          style={{
            width: '100%', padding: '12px 14px',
            background: 'var(--prompt-input-bg, rgba(255,255,255,0.05))',
            border: '1px solid var(--prompt-input-border, rgba(155,133,255,0.3))',
            borderRadius: 12, color: 'var(--color-text-primary, #F0F2F8)',
            fontSize: 15, fontFamily: "'JetBrains Mono',monospace",
            outline: 'none', boxSizing: 'border-box',
            marginBottom: 14,
          }}
        />

        <button
          onClick={() => { if (Number(value) > 0) close(() => onConfirm(value)); }}
          disabled={!value || Number(value) <= 0}
          style={{
            width: '100%', padding: '13px',
            background: (!value || Number(value) <= 0) ? 'var(--prompt-btn-disabled-bg, rgba(155,133,255,0.05))' : 'var(--prompt-btn-active-bg, rgba(155,133,255,0.15))',
            border: '1px solid var(--prompt-btn-border, rgba(155,133,255,0.35))',
            borderRadius: 14, color: (!value || Number(value) <= 0) ? 'var(--color-text-muted, #6B7494)' : 'var(--color-purple, #9B85FF)',
            fontSize: 14, fontWeight: 700,
            cursor: (!value || Number(value) <= 0) ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', marginBottom: 8,
            transition: 'all .15s',
          }}
        >{confirmLabel}</button>

        <button
          onClick={() => close(onCancel)}
          style={{
            width: '100%', padding: '13px',
            background: 'var(--color-bg-card, #1C2030)',
            border: '1px solid var(--prompt-cancel-btn-border, rgba(255,255,255,0.08))',
            borderRadius: 14, color: 'var(--color-text-secondary, #C0C5D8)',
            fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >{cancelLabel}</button>
      </div>
    </div>
  );
};
