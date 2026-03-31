/**
 * MoveAnnouncer.tsx — V3: Плавающий текст без фона для дебютов и спецходов
 *
 * Появляется по центру экрана — просто текст, никакого модала.
 * Стиль меняется в зависимости от купленной анимации SPECIAL_MOVE.
 * Автоматически исчезает через 2.5 секунды.
 */

import React, { useEffect, useState } from 'react';
import type { MoveAnnouncement, SpecialMoveStyle } from '@/lib/chessOpenings';
import { SPECIAL_MOVE_STYLES, DEFAULT_STYLE } from '@/lib/chessOpenings';
import { useUserStore } from '@/store/useUserStore';

interface MoveAnnouncerProps {
  announcement: MoveAnnouncement | null;
  onDone: () => void;
}

export const MoveAnnouncer: React.FC<MoveAnnouncerProps> = ({ announcement, onDone }) => {
  const [visible, setVisible] = useState(false);
  const user = useUserStore((s) => s.user);

  const specialMoveName = user?.equippedItems?.SPECIAL_MOVE?.name;
  const style: SpecialMoveStyle = specialMoveName
    ? (SPECIAL_MOVE_STYLES[specialMoveName] ?? DEFAULT_STYLE)
    : DEFAULT_STYLE;

  useEffect(() => {
    if (!announcement) return;
    setVisible(true);
    const t1 = setTimeout(() => setVisible(false), 2200);
    const t2 = setTimeout(() => onDone(), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [announcement]);

  if (!announcement) return null;

  const isRainbow = style.animation === 'rainbowShift';

  return (
    <div style={container}>
      <div
        style={{
          ...textWrapper,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.95)',
        }}
      >
        {/* Основной текст */}
        <div
          style={{
            ...mainText,
            color: isRainbow ? 'transparent' : style.color,
            textShadow: style.shadow,
            backgroundImage: isRainbow
              ? 'linear-gradient(90deg, #FF4D6A, #FF9F43, #F5C842, #00D68F, #64C8FF, #9B85FF, #FF4D6A)'
              : undefined,
            WebkitBackgroundClip: isRainbow ? 'text' : undefined,
            backgroundClip: isRainbow ? 'text' : undefined,
            backgroundSize: isRainbow ? '200% auto' : undefined,
            animation: isRainbow ? 'rainbowShift 2s linear infinite' : undefined,
          }}
        >
          {announcement.text}
        </div>

        {/* Подтекст */}
        {announcement.subtext && (
          <div style={subText}>
            {announcement.subtext}
          </div>
        )}

        {/* Тип-индикатор */}
        <div style={{
          ...typeTag,
          background: announcement.type === 'opening'
            ? 'rgba(155,133,255,0.15)'
            : announcement.type === 'special'
            ? 'rgba(245,200,66,0.15)'
            : 'rgba(255,77,106,0.15)',
          color: announcement.type === 'opening'
            ? '#9B85FF'
            : announcement.type === 'special'
            ? '#F5C842'
            : '#FF4D6A',
        }}>
          {announcement.type === 'opening' ? '📖 Opening' : announcement.type === 'special' ? '⭐ Special' : '⚡ Tactics'}
        </div>
      </div>
    </div>
  );
};

// ── Стили ─────────────────────────────────────────────────────────────────────

const container: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  zIndex: "var(--z-header, 50)",
};

const textWrapper: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  transition: 'opacity 0.4s ease, transform 0.4s ease',
};

const mainText: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontFamily: 'inherit',
  textAlign: 'center',
  // Без фона — только текст с тенью для читаемости
  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.9))',
  lineHeight: 1.2,
};

const subText: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.7)',
  fontFamily: 'inherit',
  textAlign: 'center',
  filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.9))',
  letterSpacing: '0.04em',
};

const typeTag: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: '3px 10px',
  borderRadius: 20,
  letterSpacing: '0.08em',
  fontFamily: 'inherit',
  marginTop: 2,
};
