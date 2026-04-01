import { useT } from '@/i18n/useT';
/**
 * WarChallengePopup.tsx
 * W1: Попап принятия/отклонения вызова на военную дуэль
 * Показывается когда соперник вызывает через war:challenge socket
 */

import React, { useEffect } from 'react';

interface WarChallengeData {
  sessionId: string;
  sessionCode: string;
  warId: string;
  challengerUserId: string;
  challengerName?: string;
  challengerCountry?: string;
  challengerFlag?: string;
  message?: string;
}

interface Props {
  data: WarChallengeData;
  onAccept: () => void;
  onDecline: () => void;
}

export const WarChallengePopup: React.FC<Props> = ({ data, onAccept, onDecline }) => {
  const t = useT();

  // Автоотклонение через 30 секунд
  useEffect(() => {
    const timer = setTimeout(onDecline, 30_000);
    return () => clearTimeout(timer);
  }, [onDecline]);

  // Haptic
  useEffect(() => {
    try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning'); } catch {}
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: "var(--z-modal, 300)",
      background: 'var(--war-challenge-overlay-bg, rgba(0,0,0,0.80))',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 'clamp(260px, 90vw, 340px)',
        background: 'linear-gradient(135deg, var(--color-bg-modal, #161927), var(--color-bg-card, #1C2030))',
        border: '1px solid var(--war-challenge-modal-border, rgba(255, 77, 106, 0.3))',
        borderRadius: 28,
        padding: 'clamp(20px, 5vw, 32px) clamp(16px, 4vw, 24px)',
        boxShadow: '0 0 60px var(--war-challenge-modal-glow-shadow, rgba(255, 77, 106, 0.15)), 0 20px 60px var(--war-challenge-modal-shadow, rgba(0,0,0,0.5))',
        textAlign: 'center',
      }}>
        {/* Иконка вызова */}
        <div style={{
          fontSize: 52, marginBottom: 16, lineHeight: 1,
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>
          ⚔️
        </div>

        {/* Страна-вызывающий */}
        {data.challengerFlag && (
          <div style={{ fontSize: 32, marginBottom: 8 }}>{data.challengerFlag}</div>
        )}

        {/* Заголовок */}
        <div style={{
          fontFamily: "'Unbounded',sans-serif",
          fontSize: 16, fontWeight: 800,
          color: 'var(--color-red, #FF4D6A)',
          marginBottom: 8, lineHeight: 1.3,
        }}>
          {t.warChallenge.title}
        </div>

        {/* Имя и страна */}
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary, #8B92A8)', marginBottom: 6 }}>
          {data.challengerName ?? 'Enemy fighter'}
          {data.challengerCountry && (
            <span style={{ color: 'var(--color-text-muted, #4A5270)' }}> · {data.challengerCountry}</span>
          )}
        </div>

        <div style={{
          fontSize: 12, color: 'var(--color-text-muted, #4A5270)',
          marginBottom: 28,
        }}>
          {t.warChallenge.subtitle} · {t.warChallenge.autoDecline} 30 {t.warChallenge.seconds}
        </div>

        {/* Кнопки */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: window.innerWidth < 360 ? '1fr' : '1fr 1fr',
          gap: 10,
        }}>
          <button
            onClick={onDecline}
            style={{
              padding: '13px', borderRadius: 14,
              background: 'var(--war-challenge-decline-btn-bg, rgba(255,255,255,0.05))',
              border: '1px solid var(--war-challenge-decline-btn-border, rgba(255,255,255,0.1))',
              color: 'var(--color-text-secondary, #8B92A8)',
              fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {t.warChallenge.decline}
          </button>
          <button
            onClick={onAccept}
            style={{
              padding: '13px', borderRadius: 14,
              background: `linear-gradient(135deg, var(--color-red, #FF4D6A), var(--color-red-dark, #E0334A))`,
              border: 'none',
              color: '#fff',
              fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 20px var(--color-red-glow, rgba(255, 77, 106, 0.4))',
            }}
          >
            {t.warChallenge.accept}
          </button>
        </div>
      </div>
    </div>
  );
};
