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

const colorMap: Record<StatColor, { bg: string; border: string; text: string }> = {
  red: { bg: 'rgba(255, 107, 107, 0.08)', border: '1px solid rgba(255, 107, 107, 0.2)', text: '#FF6B6B' },
  gold: { bg: 'rgba(255, 193, 7, 0.08)', border: '1px solid rgba(255, 193, 7, 0.2)', text: '#FFC107' },
  blue: { bg: 'rgba(100, 200, 255, 0.08)', border: '1px solid rgba(100, 200, 255, 0.2)', text: '#64C8FF' },
  green: { bg: 'rgba(100, 255, 150, 0.08)', border: '1px solid rgba(100, 255, 150, 0.2)', text: '#64FF96' },
  purple: { bg: 'rgba(245, 200, 66, 0.08)', border: '1px solid rgba(245, 200, 66, 0.2)', text: '#F5C842' },
  cyan: { bg: 'rgba(150, 150, 255, 0.08)', border: '1px solid rgba(150, 150, 255, 0.2)', text: '#9696FF' },
  orange: { bg: 'rgba(255, 159, 67, 0.08)', border: '1px solid rgba(255, 159, 67, 0.2)', text: '#FF9F43' },
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

  const containerStyle: CSSProperties = {
    padding: size === 'sm' ? 'var(--card-padding-md)' : 'var(--card-padding-lg)',
    background: colors.bg,
    border: colors.border,
    borderRadius: 'var(--radius-m)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--gap-xs)',
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
    <div style={containerStyle}>
      <Text as="div" size="xs" color="secondary" style={labelStyle}>
        {label}
      </Text>
      <div style={valueStyle}>{value}</div>
      {children && <div style={{ fontSize: 'var(--font-size-xs)' }}>{children}</div>}
    </div>
  );
};

StatBox.displayName = 'StatBox';
