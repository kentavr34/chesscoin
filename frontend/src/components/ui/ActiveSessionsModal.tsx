import { useT } from '@/i18n/useT';
/**
 * ActiveSessionsModal.tsx
 * N1: Показывает список активных сессий (до 3) при клике на блок t.activeSessions.title
 * Игрок видит все свои незавершённые партии и выбирает в какую войти.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameSession } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { fmtBalance } from '@/utils/format';

interface ActiveSessionsModalProps {
  sessions: GameSession[];
  onClose: () => void;
}

export const ActiveSessionsModal: React.FC<ActiveSessionsModalProps> = ({
  sessions, onClose }) => {
  const t = useT();
  const navigate = useNavigate();

  const TYPE_LABEL: Record<string, string> = {
    BOT:      t.activeSessions.typeBot,
    BATTLE:   t.activeSessions.typeBattle,
    FRIENDLY: t.activeSessions.typeFriendly,
  };

  const STATUS_LABEL: Record<string, { text: string; color: string }> = {
    IN_PROGRESS:          { text: t.activeSessions.statusInProgress, color: 'var(--green, #00D68F)' },
    WAITING_FOR_OPPONENT: { text: t.activeSessions.statusWaiting,    color: 'var(--accent, #F5C842)' },
  };

  const handleSelect = (session: GameSession) => {
    onClose();
    navigate('/game/' + session.id);
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'var(--bg-card, #13161F)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderBottom: 'none',
        borderRadius: '24px 24px 0 0',
        padding: '20px 18px',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
      }}>
        {/* Ручка */}
        <div style={{ width: 36, height: 4, background: '#2A2F48', borderRadius: 2, margin: '0 auto 20px' }} />

        {/* Заголовок */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary, #F0F2F8)' }}>
            ⚔️ {t.activeSessions.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)' }}>
            {sessions.length} / 3
          </div>
        </div>

        {/* Список сессий */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.map((session) => {
            const opponent = session.sides?.find(s => !s.isMe && !s.isBot);
            const botSide = session.sides?.find(s => s.isBot);
            const myTurn = session.isMyTurn;
            const statusInfo = STATUS_LABEL[session.status] ?? { text: session.status, color: '#8B92A8' };

            return (
              <div
                key={session.id}
                onClick={() => handleSelect(session)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px',
                  background: myTurn
                    ? 'linear-gradient(135deg, rgba(0,214,143,0.08), rgba(0,214,143,0.03))'
                    : 'var(--bg-card, #1C2030)',
                  border: `1px solid ${myTurn ? 'rgba(0,214,143,0.25)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 16,
                  cursor: 'pointer',
                  transition: 'all .15s',
                }}
              >
                {/* Аватар оппонента или бота */}
                {session.type === 'BOT' ? (
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'rgba(155,133,255,0.15)',
                    border: '2px solid rgba(155,133,255,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, flexShrink: 0,
                  }}>🤖</div>
                ) : (
                  <Avatar user={opponent?.player} size="m" />
                )}

                {/* Информация о партии */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', marginBottom: 3 }}>
                    {TYPE_LABEL[session.type] ?? session.type}
                    {session.type === 'BOT' && session.botLevel && (
                      <span style={{ fontSize: 11, color: '#9B85FF', marginLeft: 6 }}>
                        Lv.{session.botLevel}
                      </span>
                    )}
                    {session.type === 'BATTLE' && opponent?.player && (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary, #8B92A8)', marginLeft: 6, fontWeight: 400 }}>
                        vs {opponent.player.firstName}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 11, color: statusInfo.color, fontWeight: 600 }}>
                      {myTurn ? `● ${t.activeSessions.myTurn}` : statusInfo.text}
                    </div>
                    {/* MINOR-04 fix: явная проверка != null перед BigInt */}
                    {session.type === 'BATTLE' && session.bet != null && BigInt(session.bet) > 0n && (
                      <div style={{ fontSize: 10, color: 'var(--accent, #F5C842)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {fmtBalance(session.bet)} ᚙ
                      </div>
                    )}
                  </div>
                </div>

                {/* Стрелка */}
                <div style={{
                  fontSize: 18, color: myTurn ? 'var(--green, #00D68F)' : 'var(--text-secondary, #8B92A8)',
                  flexShrink: 0,
                }}>→</div>
              </div>
            );
          })}
        </div>

        {/* Кнопка закрыть */}
        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: 16, padding: '13px',
            background: 'var(--bg-card, #1C2030)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 14, color: 'var(--text-secondary, #8B92A8)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {t.common.close}
        </button>
      </div>
    </div>
  );
};
