/**
 * ConfirmModal.tsx
 * N9: Кастомный модал подтверждения — заменяет серый window.confirm()
 * Используется в магазине (покупки), войнах (выход из страны), профиле
 *
 * Использование:
 *   const [confirm, ConfirmDialog] = useConfirm();
 *   // в JSX: {ConfirmDialog}
 *   // вызов: const ok = await confirm({ title: '...', message: '...', okLabel: '...' });
 */

import React, { useState, useCallback } from 'react';

interface ConfirmOptions {
  title: string;
  message?: string;
  okLabel?: string;
  cancelLabel?: string;
  danger?: boolean; // красная кнопка подтверждения
}

type Resolve = (value: boolean) => void;

export const useConfirm = (): [
  (opts: ConfirmOptions) => Promise<boolean>,
  React.ReactNode
] => {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [resolve, setResolve] = useState<Resolve | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((res) => {
      setOpts(options);
      setResolve(() => res);
    });
  }, []);

  const handle = (result: boolean) => {
    resolve?.(result);
    setOpts(null);
    setResolve(null);
  };

  const dialog = opts ? (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: "var(--z-modal, 300)",
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => e.target === e.currentTarget && handle(false)}
    >
      <div style={{
        width: '100%', maxWidth: 340,
        background: '#161927',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24,
        padding: '28px 24px 22px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          fontSize: 18, fontWeight: 800,
          color: 'var(--text-primary, #F0F2F8)',
          fontFamily: "'Unbounded',sans-serif",
          marginBottom: opts.message ? 10 : 24,
          lineHeight: 1.3,
          textAlign: 'center',
        }}>
          {opts.title}
        </div>

        {opts.message && (
          <div style={{
            fontSize: 13, color: 'var(--text-secondary, #8B92A8)',
            lineHeight: 1.6, marginBottom: 24, textAlign: 'center',
          }}>
            {opts.message}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            onClick={() => handle(false)}
            style={{
              padding: '13px', borderRadius: 14,
              background: 'var(--bg-card, #1C2030)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-secondary, #8B92A8)',
              fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {opts.cancelLabel ?? 'Cancel'}
          </button>
          <button
            onClick={() => handle(true)}
            style={{
              padding: '13px', borderRadius: 14,
              background: opts.danger
                ? 'rgba(255,77,106,0.15)'
                : 'var(--accent, #F5C842)',
              border: opts.danger
                ? '1px solid rgba(255,77,106,0.4)'
                : 'none',
              color: opts.danger
                ? 'var(--red, #FF4D6A)'
                : 'var(--bg, #0B0D11)',
              fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {opts.okLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return [confirm, dialog];
};
