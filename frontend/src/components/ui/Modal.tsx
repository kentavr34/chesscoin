/**
 * Modal.tsx
 * Base modal component — standardizes position, z-index, padding, backdrop across all modals
 *
 * Usage:
 *   <Modal isOpen={isOpen} onClose={onClose}>
 *     <Modal.Header>Title</Modal.Header>
 *     <Modal.Body>Content</Modal.Body>
 *     <Modal.Footer>
 *       <button onClick={onClose}>Cancel</button>
 *       <button onClick={onConfirm}>OK</button>
 *     </Modal.Footer>
 *   </Modal>
 */

import React, { ReactNode } from 'react';

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
        zIndex: 'var(--z-modal, 300)',
        background: 'rgba(0,0,0,0.75)',
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
          background: 'var(--bg-modal, #161927)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
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
      padding: '28px 24px 10px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      fontSize: 18,
      fontWeight: 800,
      color: 'var(--text-primary, #F0F2F8)',
      fontFamily: "'Unbounded', sans-serif",
      lineHeight: 1.3,
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
      padding: '16px 24px',
      overflow: 'auto',
      fontSize: 13,
      color: 'var(--text-secondary, #8B92A8)',
      lineHeight: 1.6,
      textAlign: center ? 'center' : 'left',
    }}
  >
    {children}
  </div>
);

Modal.Footer = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      padding: '16px 24px 22px',
      borderTop: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      gap: 10,
      justifyContent: 'flex-end',
    }}
  >
    {children}
  </div>
);

export default Modal;
