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
import Modal from './Modal';

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

  const dialog = (
    <Modal isOpen={!!opts} onClose={() => handle(false)}>
      <Modal.Header>{opts?.title}</Modal.Header>
      {opts?.message && (
        <Modal.Body center>{opts.message}</Modal.Body>
      )}
      <Modal.Footer>
        <button
          aria-label={opts?.cancelLabel ?? 'Cancel'}
          onClick={() => handle(false)}
          style={{
            flex: 1,
            padding: '13px',
            borderRadius: 14,
            background: 'var(--color-bg-card, #1C2030)',
            border: '1px solid var(--confirm-cancel-btn-border, rgba(255,255,255,0.1))',
            color: 'var(--color-text-secondary, #8B92A8)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {opts?.cancelLabel ?? 'Cancel'}
        </button>
        <button
          aria-label={opts?.okLabel ?? 'Confirm'}
          onClick={() => handle(true)}
          style={{
            flex: 1,
            padding: '13px',
            borderRadius: 14,
            background: opts?.danger
              ? 'var(--confirm-danger-btn-bg, rgba(255,77,106,0.15))'
              : 'var(--color-accent, #F5C842)',
            border: opts?.danger
              ? '1px solid var(--confirm-danger-btn-border, rgba(255,77,106,0.4))'
              : 'none',
            color: opts?.danger
              ? 'var(--color-red, #FF4D6A)'
              : 'var(--color-bg-dark, #0B0D11)',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {opts?.okLabel ?? 'Confirm'}
        </button>
      </Modal.Footer>
    </Modal>
  );

  return [confirm, dialog];
};
