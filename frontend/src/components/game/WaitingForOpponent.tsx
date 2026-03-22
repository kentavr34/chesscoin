import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '@/api/socket';
import type { GameSession } from '@/types';
import { fmtBalance } from '@/utils/format';
import { haptic } from '@/lib/haptic';
import { useT } from '@/i18n/useT';

interface Props {
  session: GameSession;
}

const BOT_USERNAME = 'chessgamecoin_bot';

export const WaitingForOpponent: React.FC<Props> = ({ session }) => {
  const t = useT();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const inviteLink = `https://t.me/${BOT_USERNAME}?start=game_${session.code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      haptic.impact('light');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleShare = () => {
    haptic.impact('light');
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent('♟ Play ChessCoin? Click to accept my challenge!')}`);
    } else {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}`, '_blank');
    }
  };

  const handleShareWhatsApp = () => {
    haptic.impact('light');
    window.open(`https://wa.me/?text=${encodeURIComponent('♟ Play ChessCoin? ' + inviteLink)}`, '_blank');
  };

  const handleCancel = () => {
    haptic.impact('medium');
    getSocket().emit('game:cancel', { sessionId: session.id }, () => {
      navigate('/', { replace: true });
    });
  };

  // Фикс 0.4: уйти назад в батлы БЕЗ отмены игры
  const handleBack = () => {
    haptic.impact('light');
    navigate('/battles');
  };

  return (
    <div style={rootStyle}>
      <div style={cardStyle}>

        {/* Кнопка "← Назад" — не отменяет батл, только уходит */}
        <button onClick={handleBack} style={backBtnStyle}>
          ← Back to battles
        </button>

        {/* Пульсирующий индикатор */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={pulseWrap}>
            <div style={pulseDot} />
            <span style={{ fontSize: 32 }}>⏳</span>
          </div>
          <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 18, fontWeight: 800, color: 'var(--text-primary, #F0F2F8)', marginTop: 12 }}>
            Waiting for opponent
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B92A8)', marginTop: 6 }}>
            Bet:{' '}
            <span style={{ color: 'var(--accent, #F5C842)', fontWeight: 700 }}>
              {fmtBalance(session.bet ?? '0')} ᚙ
            </span>
          </div>
        </div>

        {/* Код партии */}
        <div style={codeBlock}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted, #4A5270)', letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 6 }}>
            Game code
          </div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 800, color: 'var(--accent, #F5C842)', letterSpacing: '.12em' }}>
            {session.code}
          </div>
        </div>

        {/* Ссылка */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted, #4A5270)', letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 8 }}>
            Invite link
          </div>
          <div style={linkBox}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#9B85FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {inviteLink}
              </div>
            </div>
            <button onClick={handleCopy} style={iconBtn(copied ? 'var(--green, #00D68F)' : 'var(--accent, #F5C842)')}>
              {copied ? '✓' : '⎘'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted, #4A5270)', marginTop: 6, textAlign: 'center' }}>
            Friend will automatically join the game
          </div>
        </div>

        {/* Кнопки шаринга */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={handleShare} style={shareBtn('#7B61FF', 'rgba(123,97,255,0.12)')}>
            ✈ Telegram
          </button>
          <button onClick={handleShareWhatsApp} style={shareBtn('#25D366', 'rgba(37,211,102,0.1)')}>
            WhatsApp
          </button>
        </div>

        {/* Отменить */}
        <button onClick={handleCancel} style={cancelBtn}>
          Cancel battle
        </button>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

// Styles
const rootStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, background: 'var(--bg, #0B0D11)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '24px 20px',
};
const cardStyle: React.CSSProperties = {
  width: '100%', maxWidth: 340,
  background: 'var(--bg-card, #161927)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 24, padding: 24,
};
const pulseWrap: React.CSSProperties = {
  position: 'relative', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center',
  width: 70, height: 70,
};
const pulseDot: React.CSSProperties = {
  position: 'absolute', inset: 0, borderRadius: '50%',
  border: '2px solid rgba(123,97,255,0.5)',
  animation: 'pulse-ring 1.4s ease-out infinite',
};
const codeBlock: React.CSSProperties = {
  background: 'rgba(245,200,66,0.06)',
  border: '1px solid rgba(245,200,66,0.15)',
  borderRadius: 16, padding: '14px 16px',
  textAlign: 'center', marginBottom: 14,
};
const linkBox: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'rgba(123,97,255,0.08)',
  border: '1px solid rgba(123,97,255,0.15)',
  borderRadius: 12, padding: '10px 12px',
};
const iconBtn = (color: string): React.CSSProperties => ({
  flexShrink: 0, width: 32, height: 32, borderRadius: 8,
  background: `rgba(${color === 'var(--green, #00D68F)' ? '0,214,143' : '245,200,66'},0.12)`,
  border: `1px solid ${color}30`,
  color, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all .2s',
});
const shareBtn = (color: string, bg: string): React.CSSProperties => ({
  flex: 1, padding: '11px 8px',
  background: bg, color,
  border: `1px solid ${color}30`,
  borderRadius: 12, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
  transition: 'all .15s',
});
const cancelBtn: React.CSSProperties = {
  width: '100%', padding: 11,
  background: 'transparent',
  border: '1px solid rgba(255,77,106,0.2)',
  borderRadius: 12, color: 'var(--red, #FF4D6A)',
  fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};
const backBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  background: 'transparent', border: 'none',
  color: 'var(--text-secondary, #8B92A8)', fontSize: 13, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit',
  padding: '0 0 16px 0',
  transition: 'color .15s',
};
