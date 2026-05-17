/**
 * Modal.tsx
 * Base modal component — standardizes position, z-index, padding, backdrop across all modals
 *
 * PR-3 hotfix 2026-05-18 (Кенан, скрин «Вступить в Чемпион Мира?»):
 * Все цвета — ХАРДКОД тёмные. НИКАКИХ CSS-vars зависимых от темы. Корень
 * прошлого бага: @media (prefers-color-scheme: light) в index.css
 * переписывал --color-bg-modal в #FAFAFA даже при data-theme="dark" на
 * <html>, потому что media query на телефоне юзера срабатывал автоматически
 * (его iOS Settings в light-режиме). Получался белый модал с белым текстом.
 *
 * Также не доверяем Telegram WebApp themeParams (secondary_bg_color) —
 * Telegram передаёт системную тему. Приложение всегда тёмное.
 *
 * Палитра модала (фикс на все темы):
 *   bg:         #161927  (тёмный навёрстный)
 *   border:     rgba(255,255,255,0.10)
 *   text-pri:   #F0F2F8  (заголовки)
 *   text-sec:   #B8C0D0  (body)
 *   overlay:    rgba(0,0,0,0.75) + blur
 */

import React, { ReactNode } from 'react';

// PR-3 hotfix: хардкодные цвета модала. Любая страница может оверрайдить.
const MODAL_BG          = '#161927';
const MODAL_BORDER      = 'rgba(255,255,255,0.10)';
const MODAL_TEXT_PRI    = '#F0F2F8';
const MODAL_TEXT_SEC    = '#B8C0D0';
const MODAL_OVERLAY     = 'rgba(0,0,0,0.75)';
const MODAL_DIVIDER     = 'rgba(255,255,255,0.06)';
const MODAL_SHADOW      = '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number | string; // pixels (default 340) or CSS value
}

interface ModalSectionProps {
  children: ReactNode;
  center?: boolean;
}

const Modal: React.FC<ModalProps> & {
  Header: React.FC<ModalSectionProps>;
  Body: React.FC<ModalSectionProps>;
  Footer: React.FC<{ children: ReactNode }>;
} = ({ isOpen, onClose, children, maxWidth = 'clamp(280px, 90vw, 340px)' }) => {
  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: MODAL_OVERLAY,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(16px, 5vw, 24px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: '100%',
          maxWidth: typeof maxWidth === 'string' ? maxWidth : `${maxWidth}px`,
          // PR-3 hotfix: ХАРДКОД тёмного фона — иначе light-media-query
          // переписывал --color-bg-modal в #FAFAFA даже в dark-теме app.
          background: MODAL_BG,
          border: `1px solid ${MODAL_BORDER}`,
          borderRadius: 18,
          boxShadow: MODAL_SHADOW,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          // Защита от наследования системного color-scheme из Telegram WebView.
          colorScheme: 'dark',
        }}
      >
        {children}
      </div>
    </div>
  );
};

Modal.Header = ({ children, center = true }: ModalSectionProps) => (
  <div
    style={{
      padding: '22px 20px 12px',
      borderBottom: `1px solid ${MODAL_DIVIDER}`,
      fontSize: 17,
      fontWeight: 800,
      color: MODAL_TEXT_PRI,
      fontFamily: "'Unbounded', sans-serif",
      lineHeight: 1.25,
      textAlign: center ? 'center' : 'left',
    }}
  >
    {children}
  </div>
);

Modal.Body = ({ children, center = false }: ModalSectionProps) => (
  <div
    style={{
      flex: 1,
      padding: '14px 20px',
      overflow: 'auto',
      fontSize: 14,
      color: MODAL_TEXT_SEC,
      lineHeight: 1.5,
      textAlign: center ? 'center' : 'left',
    }}
  >
    {children}
  </div>
);

Modal.Footer = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      padding: '16px 20px 18px',
      borderTop: `1px solid ${MODAL_DIVIDER}`,
      display: 'flex',
      gap: 8,
      justifyContent: 'flex-end',
    }}
  >
    {children}
  </div>
);

export default Modal;
