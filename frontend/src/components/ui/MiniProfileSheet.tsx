/**
 * MiniProfileSheet — быстрый профиль пользователя в bottom-sheet
 * Использование:
 *   <MiniProfileSheet userId="xxx" onClose={() => setOpen(false)} />
 * Открывается вместо перехода на полный ProfilePage
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { profileApi } from '@/api';
import { fmtBalance } from '@/utils/format';
import { useT } from '@/i18n/useT';

interface Props {
  userId: string;
  onClose: () => void;
}

export const MiniProfileSheet: React.FC<Props> = ({ userId, onClose }) => {
  const t = useT();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    profileApi.getUser(userId)
      .then(r => setUser(r))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [userId]);

  // Свайп вниз для закрытия
  const [startY, setStartY] = useState(0);
  const onTouchStart = (e: React.TouchEvent) => setStartY(e.touches[0].clientY);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches[0].clientY - startY > 60) onClose();
  };

  const leagueEmoji: Record<string, string> = {
    BRONZE: '🥉', SILVER: '🥈', GOLD: '🥇',
    PLATINUM: '💎', DIAMOND: '💠', MASTER: '👑',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: "var(--z-modal, 300)", background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      />

      {/* Sheet */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401,
          background: 'var(--bg-card, #1C2030)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '24px 24px 0 0',
          padding: '12px 20px 32px',
          paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))',
          animation: 'slide-up 0.25s ease-out',
          maxWidth: 480, margin: '0 auto',
        }}
      >
        {/* Ручка */}
        <div style={{ width: 36, height: 4, background: '#2A2F48', borderRadius: 2, margin: '0 auto 16px' }} />

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <div style={{ width: 32, height: 32, border: '3px solid rgba(123,97,255,0.3)', borderTopColor: '#7B61FF', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          </div>
        ) : !user ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: 24, fontSize: 13 }}>
            Profile unavailable
          </div>
        ) : (
          <>
            {/* Аватар + базовая инфо */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <Avatar user={user} size="l" />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>
                    {user.firstName} {user.lastName ?? ''}
                  </span>
                  {user.isMonthlyChampion && <span title="Monthly Champion">👑</span>}
                  {user.countryMember?.country?.flag && (
                    <span style={{ fontSize: 16 }}>{user.countryMember.country.flag}</span>
                  )}
                </div>
                {user.username && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>
                    @{user.username}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={tagStyle('#F5C842')}>
                    {leagueEmoji[user.league] ?? '🎖'} {user.league}
                  </span>
                  <span style={tagStyle('#9B85FF')}>ELO {user.elo}</span>
                  <span style={tagStyle('#00D68F')}>{fmtBalance(user.balance)} ᚙ</span>
                </div>
              </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Wins', val: user.wins ?? 0, color: '#00D68F' },
                { label: 'Losses', val: user.losses ?? 0, color: '#FF4D6A' },
                { label: 'Draws', val: user.draws ?? 0, color: '#8B92A8' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: 'center', background: 'var(--bg, #0B0D11)', borderRadius: 12, padding: '10px 8px' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "'JetBrains Mono',monospace" }}>{val}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Кнопки */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  onClose();
                  navigate('/battles', { state: { challengeUserId: userId } });
                }}
                style={btnGold}
              >
                ⚔️ Challenge
              </button>
              <button
                onClick={() => {
                  onClose();
                  navigate('/profile', { state: { userId } });
                }}
                style={btnGhost}
              >
                Profile →
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

const tagStyle = (color: string): React.CSSProperties => ({
  padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700,
  background: `${color}18`, color,
  border: `1px solid ${color}30`,
});
const btnGold: React.CSSProperties = {
  flex: 1, padding: '12px 0', background: 'var(--accent, #F5C842)',
  border: 'none', borderRadius: 14, color: '#0B0D11',
  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
};
const btnGhost: React.CSSProperties = {
  flex: 1, padding: '12px 0', background: 'transparent',
  border: '1px solid rgba(255,255,255,0.13)', borderRadius: 14,
  color: 'var(--text-secondary, #8B92A8)',
  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
