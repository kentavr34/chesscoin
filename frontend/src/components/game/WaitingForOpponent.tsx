import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '@/api/socket';
import type { GameSession } from '@/types';
import { fmtBalance } from '@/utils/format';
import { haptic } from '@/lib/haptic';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/components/ui/Avatar';

interface Props {
  session: GameSession;
}

const BOT_USERNAME = 'chessgamecoin_bot';

export const WaitingForOpponent: React.FC<Props> = ({ session }) => {
  const t = useT();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const inviteLink = `https://t.me/${BOT_USERNAME}?start=game_${session.code}`;

  // Определяем стороны
  const mySide = session.sides.find((s) => s.id === session.mySideId);
  const myPlayer = mySide?.player ?? null;
  const myIsWhite = mySide?.isWhite ?? true;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      haptic.impact('light');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
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

  const handleBack = () => {
    haptic.impact('light');
    navigate('/battles');
  };

  const goToProfile = (userId?: string) => {
    if (userId) navigate('/profile/' + userId);
  };

  return (
    <div style={rootStyle}>
      <div style={cardStyle}>

        {/* Кнопка "← Назад" */}
        <button onClick={handleBack} style={backBtnStyle}>
          {t.game.backToBattles}
        </button>

        {/* ── Панель игроков ── */}
        <div style={playersRowStyle}>

          {/* Левый игрок — я */}
          <div style={playerColStyle}>
            <div
              onClick={() => { const id = mySide?.player?.id; if (id) navigate('/profile/' + id); }}
              style={{ cursor: mySide?.player?.id ? 'pointer' : 'default' }}
            >
              <Avatar user={myPlayer} size="l" />
            </div>
            <span style={playerNameStyle}>{myPlayer?.firstName ?? '?'}</span>
            {myPlayer?.elo != null && (
              <span style={{ fontSize: 10, fontWeight: 600, textAlign: 'center' as const }}>
                <span style={{ color: '#7A7470' }}>ELO </span>
                <span style={{ color: '#F0C85A' }}>{myPlayer.elo}</span>
              </span>
            )}
          </div>

          {/* Центр: VS + LIVE + ставка */}
          <div style={centerColStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF4D6A', animation: 'pulse-ring 1.4s ease-out infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 9, fontWeight: 800, color: '#FF4D6A', letterSpacing: '.1em' }}>LIVE</span>
            </div>
            <span style={vsStyle}>VS</span>
            {session.bet && BigInt(session.bet) > 0n && (
              <span style={betStyle}>{fmtBalance(session.bet)} ᚙ</span>
            )}
          </div>

          {/* Правый игрок — соперник (ожидание) */}
          <div style={playerColStyle}>
            <div style={opponentAvatarStyle}>
              <span style={{ fontSize: 22, opacity: 0.4 }}>?</span>
            </div>
            <span style={playerNameStyle}>{t.game.waitingForOpponent ?? '...'}</span>
          </div>

        </div>

        {/* Знаки цвета фигур — под панелью, по краям */}
        <div style={colorSignsRowStyle}>
          <span style={colorSignStyle(myIsWhite)}>{myIsWhite ? '♔' : '♚'}</span>
          <span style={colorSignStyle(!myIsWhite)}>{myIsWhite ? '♚' : '♔'}</span>
        </div>

        {/* Код партии */}
        <div style={codeBlock}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted, #4A5270)', letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 6 }}>
            {t.game.waitingCode}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 800, color: 'var(--color-accent, #F5C842)', letterSpacing: '.12em' }}>
            {session.code}
          </div>
        </div>

        {/* Ссылка */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted, #4A5270)', letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 8 }}>
            {t.game.inviteLink}
          </div>
          <div style={linkBox}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'var(--color-purple, #9B85FF)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {inviteLink}
              </div>
            </div>
            <button onClick={handleCopy} style={iconBtn(copied ? 'var(--color-green, #00D68F)' : 'var(--color-accent, #F5C842)')}>
              {copied ? '✓' : '⎘'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted, #4A5270)', marginTop: 6, textAlign: 'center' }}>
            {t.game.friendAutoJoin}
          </div>
        </div>

        {/* Кнопки шаринга */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={handleShare} style={shareBtn('var(--color-purple-dark, #7B61FF)', 'rgba(123,97,255,0.12)')}>
            ✈ Telegram
          </button>
          <button onClick={handleShareWhatsApp} style={shareBtn('var(--whatsapp-color, #25D366)', 'var(--whatsapp-bg, rgba(37,211,102,0.1))')}>
            WhatsApp
          </button>
        </div>

        {/* Отменить */}
        <button onClick={handleCancel} style={cancelBtn}>
          {t.game.cancelBattle}
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

// ── Константа отступа — одинакова для панели и знаков цвета ──────────────────
const SIDE_PAD = 18;

// ── Styles ────────────────────────────────────────────────────────────────────
const rootStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, background: 'var(--color-bg-dark, #0B0D11)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '24px 20px',
};

const cardStyle: React.CSSProperties = {
  width: '100%', maxWidth: 340,
  background: 'var(--color-bg-card, #161927)',
  border: '1px solid var(--waiting-card-border, rgba(255,255,255,0.1))',
  borderRadius: 24, padding: 24,
};

// Панель игроков
// paddingLeft/Right = SIDE_PAD + 10 → аватары сдвинуты к центру на 10px
const playersRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${SIDE_PAD}px ${SIDE_PAD + 10}px`,
  background: 'rgba(255,255,255,0.055)',
  borderRadius: 16,
  border: '1.5px solid rgba(155,133,255,0.28)',
  boxShadow: '0 0 14px rgba(155,133,255,0.10), inset 0 0 12px rgba(155,133,255,0.04)',
  marginBottom: 0,
};
const playerColStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
};
const centerColStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
};
const vsStyle: React.CSSProperties = {
  fontFamily: "'Unbounded', sans-serif",
  fontSize: 18, fontWeight: 800,
  color: 'rgba(255,255,255,0.25)', letterSpacing: '.08em',
};
const betStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700,
  color: 'var(--color-accent, #F5C842)',
  fontFamily: "'JetBrains Mono', monospace",
};
const playerNameStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600,
  color: 'var(--color-text-secondary, #8B92A8)',
  maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis',
  whiteSpace: 'nowrap', textAlign: 'center',
};
const opponentAvatarStyle: React.CSSProperties = {
  width: 56, height: 56, borderRadius: '50%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px dashed rgba(255,255,255,0.15)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

// Знаки цвета: строка под панелью, знаки прижаты к краям на том же отступе SIDE_PAD
// marginBottom = 10px — отступ от знаков до блока с кодом (таймером)
const colorSignsRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  paddingLeft: SIDE_PAD,
  paddingRight: SIDE_PAD,
  marginTop: 8,
  marginBottom: 10,
};
// fontSize = 36 (= 28 × 1.3, базовый размер кода таймера +30%)
const colorSignStyle = (isWhite: boolean): React.CSSProperties => ({
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 36, lineHeight: 1,
  color: isWhite ? '#F0F2F8' : '#8B92A8',
  opacity: 0.85,
});
const codeBlock: React.CSSProperties = {
  background: 'var(--waiting-code-block-bg, rgba(245, 200, 66, 0.06))',
  border: '1px solid var(--waiting-code-block-border, rgba(245, 200, 66, 0.15))',
  borderRadius: 16, padding: '14px 16px',
  textAlign: 'center', marginBottom: 14,
};

const linkBox: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'var(--waiting-link-box-bg, rgba(155, 133, 255, 0.08))',
  border: '1px solid var(--waiting-link-box-border, rgba(155, 133, 255, 0.15))',
  borderRadius: 12, padding: '10px 12px',
};

const iconBtn = (color: string): React.CSSProperties => {
  const isGreen = color.includes('00D68F') || color.includes('green');
  const bg = isGreen ? 'var(--waiting-icon-btn-green-bg, rgba(0, 214, 143, 0.12))' : 'var(--waiting-icon-btn-accent-bg, rgba(245, 200, 66, 0.12))';
  return {
    flexShrink: 0, width: 32, height: 32, borderRadius: 8,
    background: bg,
    border: `1px solid ${color}30`,
    color, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all .2s',
  };
};

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
  border: '1px solid var(--waiting-cancel-btn-border, rgba(255,77,106,0.2))',
  borderRadius: 12, color: 'var(--color-red, #FF4D6A)',
  fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};

const backBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  background: 'transparent', border: 'none',
  color: 'var(--color-text-secondary, #8B92A8)', fontSize: 13, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit',
  padding: '0 0 16px 0',
  transition: 'color .15s',
};
