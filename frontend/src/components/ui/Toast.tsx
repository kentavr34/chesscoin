import React, { useState, useEffect } from 'react';

interface ToastItem {
  id: number;
  text: string;
  type: 'error' | 'success' | 'info';
  actionLabel?: string;
  onAction?: () => void;
}

let _id = 0;

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { text, type = 'info', actionLabel, onAction } = (e as CustomEvent).detail;
      const id = ++_id;
      setToasts((prev) => [...prev, { id, text, type, actionLabel, onAction }]);
      // Тосты с кнопкой действия висят дольше — 7 секунд
      const duration = actionLabel ? 7000 : 3500;
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
    };
    window.addEventListener('chesscoin:toast', handler);
    return () => window.removeEventListener('chesscoin:toast', handler);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (!toasts.length) return null;

  const colors: Record<string, { bg: string; border: string; color: string }> = {
    error:   { bg: 'var(--color-red-bg, rgba(255,77,106,0.12))',  border: 'var(--color-red-border, rgba(255,77,106,0.3))',   color: 'var(--color-red, #FF4D6A)' },
    success: { bg: 'var(--color-green-bg, rgba(0,214,143,0.12))',   border: 'var(--color-green-border, rgba(0,214,143,0.3))',    color: 'var(--color-green, #00D68F)' },
    info:    { bg: 'var(--color-purple-bg, rgba(123,97,255,0.12))',  border: 'var(--color-purple-border, rgba(123,97,255,0.3))',   color: 'var(--color-purple, #9B85FF)' },
  };

  return (
    <div style={{ position: 'fixed', top: 56, left: 16, right: 16, zIndex: "var(--z-toast, 400)", display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map((t) => {
        const c = colors[t.type];
        return (
          <div key={t.id} style={{
            padding: '11px 16px',
            background: c.bg,
            border: `1px solid ${c.border}`,
            borderRadius: 14,
            color: c.color,
            fontSize: 13, fontWeight: 600,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            animation: 'toastIn .25s ease',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ flex: 1 }}>{t.text}</span>
            {t.actionLabel && t.onAction && (
              <button
                onClick={() => { t.onAction!(); dismiss(t.id); }}
                style={{
                  padding: '5px 10px',
                  background: c.color,
                  color: 'var(--color-bg-dark, #0B0D11)',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {t.actionLabel}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              style={{ background: 'none', border: 'none', color: c.color, fontSize: 14, cursor: 'pointer', padding: '0 0 0 4px', opacity: 0.6, flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        );
      })}
      <style>{`@keyframes toastIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
};

// Хелпер: вызвать toast из любого места
export const toast = {
  error:   (text: string) => window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type: 'error' } })),
  success: (text: string) => window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type: 'success' } })),
  info:    (text: string) => window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type: 'info' } })),
  action:  (text: string, actionLabel: string, onAction: () => void) =>
    window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type: 'info', actionLabel, onAction } })),
};
