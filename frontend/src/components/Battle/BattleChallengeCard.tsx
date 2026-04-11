import React from 'react';
import { Avatar, Text } from '@/components/ui';
import { PublicUser } from '@/types/api';

interface BattleChallengeCardProps {
  challenger: PublicUser;
  onClick: () => void;
}

export const BattleChallengeCard: React.FC<BattleChallengeCardProps> = ({ challenger, onClick }) => {
  return (
    <div
      style={{
        background: '#1A1A23',
        borderRadius: 16,
        padding: '16px',
        marginBottom: 12,
        border: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <Avatar size={64} src={challenger.avatar} gradient={challenger.avatarGradient} />
        <div style={{ textAlign: 'center', width: '100%' }}>
          <Text variant="label" size="sm" color="primary" style={{ fontWeight: 600 }}>
            {challenger.firstName} {challenger.lastName}
          </Text>
          <Text variant="caption" size="xs" color="muted">
            Уровень {challenger.elo}
          </Text>
        </div>
      </div>
    </div>
  );
};
