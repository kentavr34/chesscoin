import React, { useState, useEffect } from 'react';

interface ToastItem { id: number; text: string; type: 'error' | 'success' | 'info'; }

let _id = 0;

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { text, type = 'info' } = (e as CustomEvent).detail;
      const id = ++_id;
      setToasts((prev) => [...prev, { id, text, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
    };
    window.addEventListener('chesscoin:toast', handler);
    return () => window.removeEventListener('chesscoin:toast', handler);
  }, []);

  if (!toasts.length) return null;

  const colors: Record<string, { bg: string; border: string; color: string }> = {
    error:   { bg: 'rgba(255,77,106,0.12)',  border: 'rgba(255,77,106,0.3)',   color: '#FF4D6A' },
    success: { bg: 'rgba(0,214,143,0.12)',   border: 'rgba(0,214,143,0.3)',    color: '#00D68F' },
    info:    { bg: 'rgba(123,97,255,0.12)',  border: 'rgba(123,97,255,0.3)',   color: '#9B85FF' },
  };

  return (
    <div style={{ position: 'fixed', top: 56, left: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
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
          }}>
            {t.text}
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
};
