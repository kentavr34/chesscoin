import React, { CSSProperties } from 'react';
import { Text } from './Text';

type StatColor = 'red' | 'gold' | 'blue' | 'green' | 'purple' | 'cyan' | 'orange';

interface StatBoxProps {
  label: string;
  value: string | number;
  color?: StatColor;
  size?: 'sm' | 'md';
  children?: React.ReactNode;
}

const colorMap: Record<StatColor, { bg: string; bgHover: string; border: string; borderHover: string; text: string; glow: string }> = {
  red: {
    bg: 'linear-gradient(135deg, rgba(255, 77, 106, 0.08) 0%, rgba(255, 77, 106, 0.04) 100%)',
    bgHover: 'linear-gradient(135deg, rgba(255, 77, 106, 0.12) 0%, rgba(255, 77, 106, 0.06) 100%)',
    border: 'rgba(255, 77, 106, 0.2)',
    borderHover: 'rgba(255, 77, 106, 0.4)',
    text: '#FF4D6A',
    glow: 'rgba(255, 77, 106, 0.2)',
  },
  gold: {
    bg: 'linear-gradient(135deg, rgba(245, 200, 66, 0.08) 0%, rgba(245, 200, 66, 0.04) 100%)',
    bgHover: 'linear-gradient(135deg, rgba(245, 200, 66, 0.12) 0%, rgba(245, 200, 66, 0.06) 100%)',
    border: 'rgba(245, 200, 66, 0.2)',
    borderHover: 'rgba(245, 200, 66, 0.4)',
    text: '#F5C842',
    glow: 'rgba(245, 200, 66, 0.2)',
  },
  blue: {
    bg: 'linear-gradient(135deg, rgba(100, 200, 255, 0.08) 0%, rgba(100, 200, 255, 0.04) 100%)',
    bgHover: 'linear-gradient(135deg, rgba(100, 200, 255, 0.12) 0%, rgba(100, 200, 255, 0.06) 100%)',
    border: 'rgba(100, 200, 255, 0.2)',
    borderHover: 'rgba(100, 200, 255, 0.4)',
    text: '#64C8FF',
    glow: 'rgba(100, 200, 255, 0.2)',
  },
  green: {
    bg: 'linear-gradient(135deg, rgba(0, 214, 143, 0.08) 0%, rgba(0, 214, 143, 0.04) 100%)',
    bgHover: 'linear-gradient(135deg, rgba(0, 214, 143, 0.12) 0%, rgba(0, 214, 143, 0.06) 100%)',
    border: 'rgba(0, 214, 143, 0.2)',
    borderHover: 'rgba(0, 214, 143, 0.4)',
    text: '#00D68F',
    glow: 'rgba(0, 214, 143, 0.2)',
  },
  purple: {
    bg: 'linear-gradient(135deg, rgba(155, 133, 255, 0.08) 0%, rgba(155, 133, 255, 0.04) 100%)',
    bgHover: 'linear-gradient(135deg, rgba(155, 133, 255, 0.12) 0%, rgba(155, 133, 255, 0.06) 100%)',
    border: 'rgba(155, 133, 255, 0.2)',
    borderHover: 'rgba(155, 133, 255, 0.4)',
    text: '#9B85FF',
    glow: 'rgba(155, 133, 255, 0.2)',
  },
  cyan: {
    bg: 'linear-gradient(135deg, rgba(150, 150, 255, 0.08) 0%, rgba(150, 150, 255, 0.04) 100%)',
    bgHover: 'linear-gradient(135deg, rgba(150, 150, 255, 0.12) 0%, rgba(150, 150, 255, 0.06) 100%)',
    border: 'rgba(150, 150, 255, 0.2)',
    borderHover: 'rgba(150, 150, 255, 0.4)',
    text: '#9696FF',
    glow: 'rgba(150, 150, 255, 0.2)',
  },
  orange: {
    bg: 'linear-gradient(135deg, rgba(255, 159, 67, 0.08) 0%, rgba(255, 159, 67, 0.04) 100%)',
    bgHover: 'linear-gradient(135deg, rgba(255, 159, 67, 0.12) 0%, rgba(255, 159, 67, 0.06) 100%)',
    border: 'rgba(255, 159, 67, 0.2)',
    borderHover: 'rgba(255, 159, 67, 0.4)',
    text: '#FF9F43',
    glow: 'rgba(255, 159, 67, 0.2)',
  },
};

/**
 * StatBox — Компонент для отображения статистики
 * Используется для: рейтинг, лига, баланс, попытки, рефералы и т.д.
 */
export const StatBox: React.FC<StatBoxProps> = ({
  label,
  value,
  color = 'blue',
  size = 'md',
  children,
}) => {
  const colors = colorMap[color];
  const [hovered, setHovered] = React.useState(false);

  const containerStyle: CSSProperties = {
    padding: size === 'sm' ? 'var(--card-padding-md)' : 'var(--card-padding-lg)',
    // DARK GLASSMORPHISM: градиент с приглушённым цветом
    background: hovered ? colors.bgHover : colors.bg,
    // Glassmorphism blur
    backdropFilter: 'blur(12px)',
    // Light-catching border
    border: `1px solid ${hovered ? colors.borderHover : colors.border}`,
    borderRadius: 'var(--radius-m)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--gap-xs)',
    // Deep shadows
    boxShadow: hovered
      ? `0 8px 32px 0 rgba(0, 0, 0, 0.36), 0 0 20px ${colors.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.15)`
      : '0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    transition: 'all var(--transition-normal) var(--ease-in-out)',
    cursor: 'default',
    transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
  };

  const labelStyle: CSSProperties = {
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-regular)',
  };

  const valueStyle: CSSProperties = {
    fontSize: size === 'sm' ? 'var(--font-size-md)' : 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-bold)',
    color: colors.text,
  };

  return (
    <div
      style={containerStyle as CSSProperties}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Text as="div" size="xs" color="secondary" style={labelStyle}>
        {label}
      </Text>
      <div style={valueStyle}>{value}</div>
      {children && <div style={{ fontSize: 'var(--font-size-xs)' }}>{children}</div>}
    </div>
  );
};

StatBox.displayName = 'StatBox';
