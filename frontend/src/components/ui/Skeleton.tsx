/**
 * Skeleton — shimmer-плейсхолдер для загрузки.
 *   <Skeleton height={60} />                 — одиночный блок
 *   <Skeleton.List count={3} height={80} />  — список карточек
 */
import React from 'react';

interface Props {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: React.CSSProperties;
}

const Base: React.FC<Props> = ({ width = '100%', height = 16, radius = 10, style }) => (
  <div style={{
    width, height, borderRadius: radius,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)',
    backgroundSize: '200% 100%',
    animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
    ...style,
  }} />
);

const List: React.FC<{ count?: number; height?: number | string; gap?: number; style?: React.CSSProperties }> = ({
  count = 3, height = 72, gap = 10, style,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
    {Array.from({ length: count }).map((_, i) => <Base key={i} height={height} />)}
  </div>
);

export const Skeleton = Object.assign(Base, { List });
