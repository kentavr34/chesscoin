import React from 'react';
import type { UserPublic } from '@/types';
import { initials } from '@/utils/format';
import { AVATAR_FRAME_STYLE } from '@/lib/equippedItems';

interface AvatarProps {
  user?: UserPublic | null;
  size?: 's' | 'm' | 'l' | 'xl';
  gold?: boolean;
  className?: string;
  onClick?: () => void; // для перехода в магазин с чужого профиля
}

const SIZES = {
  s: { w: 36, h: 36, fs: 16 },
  m: { w: 44, h: 44, fs: 20 },
  l: { w: 56, h: 56, fs: 24 },
  xl: { w: 80, h: 80, fs: 36 },
};

const GRADIENTS = [
  'var(--avatar-gradient-1, linear-gradient(135deg,#3A2A8A,#5A3ABB))',
  'var(--avatar-gradient-2, linear-gradient(135deg,#1A3A5A,#2A6A9A))',
  'var(--avatar-gradient-3, linear-gradient(135deg,#4A1A2A,#8A2A4A))',
  'var(--avatar-gradient-4, linear-gradient(135deg,#1A4A2A,#2A8A4A))',
];

const getGradient = (userId?: string, avatarGradient?: string | null): string => {
  if (avatarGradient) return avatarGradient;
  if (!userId) return GRADIENTS[0];
  const idx = userId.charCodeAt(userId.length - 1) % GRADIENTS.length;
  return GRADIENTS[idx];
};

export const Avatar: React.FC<AvatarProps> = React.memo(({ user, size = 'm', gold, className = '', onClick }) => {
  const frameStyle = user?.equippedItems?.AVATAR_FRAME
    ? AVATAR_FRAME_STYLE[(user as import("@/types").User).equippedItems?.AVATAR_FRAME?.name ?? ''] ?? null
    : null;
  const { w, h, fs } = SIZES[size];
  const bg = getGradient(user?.id, user?.avatarGradient);

  // Премиум-аватар из магазина — берём imageUrl из equippedItems
  const premiumAvatarUrl = user?.equippedItems?.PREMIUM_AVATAR?.imageUrl ?? null;
  // Показываем: 1) премиум-аватар из магазина, 2) обычное фото (Telegram / загруженное), 3) градиент
  const displayAvatar = premiumAvatarUrl ?? (user?.avatar || null);

  const style: React.CSSProperties = {
    width: w,
    height: h,
    fontSize: fs,
    flexShrink: 0,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: displayAvatar ? undefined : bg,
    border: frameStyle ? frameStyle.border
      : gold ? `var(--avatar-gold-border-width) solid var(--color-accent, #F5C842)`
      : '2px solid var(--avatar-border-light, rgba(255,255,255,0.18))',
    boxShadow: frameStyle ? frameStyle.boxShadow
      : gold ? `0 0 0 var(--avatar-gold-glow-blur) var(--color-accent-light, rgba(245,200,66,0.3)), 0 0 var(--avatar-gold-glow-size) var(--color-accent-shadow, rgba(245,200,66,0.2))`
      : undefined,
    overflow: 'hidden',
    color: 'var(--color-text-primary, #F0F2F8)',
    fontWeight: 600,
    cursor: onClick ? 'pointer' : undefined,
  };

  return (
    <div style={style} className={className} onClick={onClick}>
      {displayAvatar
        ? <img src={displayAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        : <span style={{ fontSize: fs * 0.55 }}>{initials(user?.firstName ?? '?', user?.lastName)}</span>
      }
    </div>
  );
});
