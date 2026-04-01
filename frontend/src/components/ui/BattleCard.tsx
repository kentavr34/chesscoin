import { useT } from '@/i18n/useT';
/**
 * BattleCard.tsx
 * W4/W6: Единая карточка партии — используется везде:
 *   - WarDetailModal (войны)
 *   - ProfilePage (история партий)
 *   - TournamentsPage (матчи)
 *
 * Дизайн: игрок 1 ← [статус ⚔️] → игрок 2
 * Клик на аватар → профиль игрока
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';

interface BattleCardPlayer {
  id?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  avatar?: string | null;
  avatarGradient?: string;
  countryFlag?: string;
  elo?: number;
  league?: import('@/types').League;
}

interface BattleCardProps {
  player1?: BattleCardPlayer | null;
  player2?: BattleCardPlayer | null;
  status: 'IN_PROGRESS' | 'FINISHED' | 'WAITING' | string;
  winner?: 'player1' | 'player2' | 'draw' | null;
  spectatorCount?: number;       // W3: счётчик зрителей
  sessionId?: string;
  onSpectate?: () => void;
  onSave?: () => void;
  saving?: boolean;
  label?: string;                 // дополнительная метка (раунд, тип)
  compact?: boolean;              // компактный режим
}

const STATUS_CONFIG = {
  IN_PROGRESS: { textKey: 'inProgress', color: 'var(--color-accent, #F5C842)' },
  WAITING:     { textKey: 'waiting', color: 'var(--color-text-muted, #4A5270)' },
  FINISHED:    { textKey: 'finished', color: 'var(--color-text-secondary, #8B92A8)' },
};

export const BattleCard: React.FC<BattleCardProps> = React.memo(({
  player1, player2, status, winner, spectatorCount,
  sessionId, onSpectate, onSave, saving, label, compact,
}) => {
  const t = useT();
  const navigate = useNavigate();

  const goProfile = (player?: BattleCardPlayer | null) => {
    if (player?.id) navigate(`/profile/${player.id}`);
  };

  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
    ?? { text: status, color: 'var(--color-text-secondary, #8B92A8)' };

  // Определяем цвет имён по результату
  const p1Color = winner === 'player1' ? 'var(--color-green, #00D68F)'
    : winner === 'player2' ? 'var(--color-red, #FF4D6A)'
    : 'var(--color-text-primary, #F0F2F8)';
  const p2Color = winner === 'player2' ? 'var(--color-green, #00D68F)'
    : winner === 'player1' ? 'var(--color-red, #FF4D6A)'
    : 'var(--color-text-primary, #F0F2F8)';

  return (
    <div style={{
      padding: compact ? '8px 0' : '12px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      {label && (
        <div style={{ fontSize: 9, color: 'var(--color-text-muted, #4A5270)', letterSpacing: '.06em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
          {label}
        </div>
      )}

      {/* W4: Два игрока лицом к лицу (L2: Responsive sizing) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: window.innerWidth < 480 ? 4 : 8 }}>

        {/* Игрок 1 */}
        <div
          onClick={() => goProfile(player1)}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: player1?.id ? 'pointer' : 'default', width: window.innerWidth < 480 ? 40 : 52, flexShrink: 0 }}
        >
          <Avatar user={player1 as unknown as import('@/types').UserPublic} size="s" />
          {player1?.countryFlag && <span style={{ fontSize: window.innerWidth < 480 ? 10 : 12 }}>{player1.countryFlag}</span>}
          <div style={{ fontSize: window.innerWidth < 480 ? 8 : 9, color: p1Color, fontWeight: 700, textAlign: 'center', maxWidth: window.innerWidth < 480 ? 40 : 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {player1?.firstName ?? '?'}
          </div>
        </div>

        {/* Центр: статус + VS + кнопки (L2: Responsive) */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: window.innerWidth < 480 ? 14 : 18, marginBottom: 2 }}>⚔️</div>
          <div style={{ fontSize: window.innerWidth < 480 ? 9 : 10, color: cfg.color, fontWeight: 700 }}>
            {winner === 'draw' ? t.battleCard.draw : t.battleCard[cfg.textKey as keyof typeof t.battleCard] ?? cfg.textKey}
          </div>

          {/* W3: Счётчик зрителей */}
          {spectatorCount !== undefined && spectatorCount > 0 && (
            <div style={{ fontSize: 8, color: 'var(--text-muted, #4A5270)', marginTop: 2 }}>
              👁 {spectatorCount}
            </div>
          )}

          {/* Кнопки действий (L2: Stack on mobile if needed) */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: window.innerWidth < 480 ? 2 : 4, marginTop: 6, flexWrap: 'wrap' }}>
            {status === 'IN_PROGRESS' && onSpectate && sessionId && (
              <button
                onClick={onSpectate}
                style={{ padding: window.innerWidth < 480 ? '2px 6px' : '4px 8px', background: 'rgba(245,200,66,0.1)', color: 'var(--accent, #F5C842)', border: '1px solid rgba(245,200,66,0.25)', borderRadius: 7, fontSize: window.innerWidth < 480 ? 9 : 10, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                👁 {t.game?.watch ?? 'Watch'}
              </button>
            )}
            {status === 'FINISHED' && onSave && (
              <button
                onClick={onSave}
                disabled={saving}
                style={{ padding: window.innerWidth < 480 ? '2px 6px' : '4px 8px', background: 'rgba(123,97,255,0.12)', color: '#9B85FF', border: '1px solid rgba(123,97,255,0.25)', borderRadius: 7, fontSize: window.innerWidth < 480 ? 9 : 10, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? '...' : t.battleCard.save}
              </button>
            )}
          </div>
        </div>

        {/* Игрок 2 */}
        <div
          onClick={() => goProfile(player2)}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: player2?.id ? 'pointer' : 'default', width: window.innerWidth < 480 ? 40 : 52, flexShrink: 0 }}
        >
          <Avatar user={player2 as unknown as import('@/types').UserPublic} size="s" />
          {player2?.countryFlag && <span style={{ fontSize: window.innerWidth < 480 ? 10 : 12 }}>{player2.countryFlag}</span>}
          <div style={{ fontSize: window.innerWidth < 480 ? 8 : 9, color: p2Color, fontWeight: 700, textAlign: 'center', maxWidth: window.innerWidth < 480 ? 40 : 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {player2?.firstName ?? '?'}
          </div>
        </div>
      </div>
    </div>
  );
});
