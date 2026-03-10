import React from 'react';
import type { UserPublic } from '@/types';
import { initials } from '@/utils/format';

interface AvatarProps {
  user?: UserPublic | null;
  size?: 's' | 'm' | 'l' | 'xl';
  gold?: boolean;
  className?: string;
}

const SIZES = {
  s: { w: 36, h: 36, fs: 16 },
  m: { w: 44, h: 44, fs: 20 },
  l: { w: 56, h: 56, fs: 24 },
  xl: { w: 80, h: 80, fs: 36 },
};

const GRADIENTS = [
  'linear-gradient(135deg,#3A2A8A,#5A3ABB)',
  'linear-gradient(135deg,#1A3A5A,#2A6A9A)',
  'linear-gradient(135deg,#4A1A2A,#8A2A4A)',
  'linear-gradient(135deg,#1A4A2A,#2A8A4A)',
];

const getGradient = (userId?: string, avatarGradient?: string | null): string => {
  if (avatarGradient) return avatarGradient;
  if (!userId) return GRADIENTS[0];
  const idx = userId.charCodeAt(userId.length - 1) % GRADIENTS.length;
  return GRADIENTS[idx];
};

export const Avatar: React.FC<AvatarProps> = ({ user, size = 'm', gold, className = '' }) => {
  const { w, h, fs } = SIZES[size];
  const bg = getGradient(user?.id, user?.avatarGradient);

  const style: React.CSSProperties = {
    width: w,
    height: h,
    fontSize: fs,
    flexShrink: 0,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: user?.avatar ? undefined : bg,
    border: gold
      ? '2px solid #F5C842'
      : '2px solid rgba(255,255,255,0.18)',
    boxShadow: gold
      ? '0 0 0 1px rgba(245,200,66,0.3), 0 0 16px rgba(245,200,66,0.2)'
      : undefined,
    overflow: 'hidden',
    color: '#F0F2F8',
    fontWeight: 600,
  };

  return (
    <div style={style} className={className}>
      {user?.avatar
        ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: fs * 0.55 }}>{initials(user?.firstName ?? '?', user?.lastName)}</span>
      }
    </div>
  );
};
