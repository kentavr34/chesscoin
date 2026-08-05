/**
 * Знак различия воинского звания — SVG вместо эмодзи.
 *
 * Кенан 05.08.2026: граф знаний нашёл 207 эмодзи в живом интерфейсе вопреки
 * правилу «в интерфейсе только SVG-иконки». Звания были собраны из эмодзи:
 * 🌟🌟🌟 у генерал-полковника, ⭐⭐ у подполковника, 🔵🔵🔵🔵 у капитана.
 *
 * Смысл там был настоящий — счёт знаков означает старшинство, — поэтому
 * знак не выброшен, а перерисован: те же три звезды, но нарисованные, а не
 * шрифтовые. Заодно они перестали зависеть от того, как телефон рисует
 * эмодзи: на части Android звёзды приходили разного размера и цвета.
 */
import React from 'react';

type Shape = 'crown' | 'medal' | 'star' | 'bar' | 'dot' | 'diamond' | 'helmet' | 'none';

/** Звание → форма знака и сколько их. Порядок повторяет старшинство. */
const INSIGNIA: Record<string, { shape: Shape; count: number; color: string }> = {
  EMPEROR:       { shape: 'crown',   count: 1, color: '#F5C842' },
  MARSHAL:       { shape: 'medal',   count: 1, color: '#F0C85A' },
  COL_GENERAL:   { shape: 'star',    count: 3, color: '#F5C842' },
  LT_GENERAL:    { shape: 'star',    count: 2, color: '#F5C842' },
  MAJ_GENERAL:   { shape: 'star',    count: 1, color: '#F5C842' },
  BRIGADIER:     { shape: 'medal',   count: 1, color: '#D4A843' },
  COLONEL:       { shape: 'star',    count: 3, color: '#C0C0C0' },
  LT_COLONEL:    { shape: 'star',    count: 2, color: '#C0C0C0' },
  MAJOR:         { shape: 'star',    count: 1, color: '#C0C0C0' },
  CAPTAIN:       { shape: 'bar',     count: 4, color: '#82CFFF' },
  SR_LIEUTENANT: { shape: 'bar',     count: 3, color: '#82CFFF' },
  LIEUTENANT:    { shape: 'bar',     count: 2, color: '#82CFFF' },
  JR_LIEUTENANT: { shape: 'bar',     count: 1, color: '#82CFFF' },
  WARRANT:       { shape: 'diamond', count: 1, color: '#E8A33D' },
  SERGEANT:      { shape: 'diamond', count: 1, color: '#6BA3D6' },
  CORPORAL:      { shape: 'dot',     count: 1, color: '#6BA3D6' },
  PRIVATE:       { shape: 'helmet',  count: 1, color: '#8A9AA8' },
  RECRUIT:       { shape: 'none',    count: 0, color: '#5A5248' },
};

const Star: React.FC<{ s: number; c: string }> = ({ s, c }) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <path d="M10 2.2l2.3 5.1 5.5.6-4.1 3.7 1.1 5.4L10 14.3 5.2 17l1.1-5.4L2.2 7.9l5.5-.6L10 2.2z"
          fill={c} stroke={c} strokeWidth="1" strokeLinejoin="round" />
  </svg>
);

const Bar: React.FC<{ s: number; c: string }> = ({ s, c }) => (
  <svg width={s * 0.42} height={s} viewBox="0 0 8 20" fill="none">
    <rect x="1.6" y="3" width="4.8" height="14" rx="1.4" fill={c} opacity=".9" />
  </svg>
);

const Dot: React.FC<{ s: number; c: string }> = ({ s, c }) => (
  <svg width={s * 0.6} height={s} viewBox="0 0 12 20" fill="none">
    <circle cx="6" cy="10" r="3.4" fill={c} />
  </svg>
);

const Diamond: React.FC<{ s: number; c: string }> = ({ s, c }) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <path d="M10 3.5l5 6.5-5 6.5-5-6.5 5-6.5z" fill={c} opacity=".9" />
  </svg>
);

const Crown: React.FC<{ s: number; c: string }> = ({ s, c }) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <path d="M3 6.6l3.4 3.2L10 3.8l3.6 6 3.4-3.2V15H3V6.6z" fill={c} stroke={c} strokeWidth="1" strokeLinejoin="round" />
    <rect x="3" y="15.6" width="14" height="1.6" rx=".8" fill={c} />
  </svg>
);

const Medal: React.FC<{ s: number; c: string }> = ({ s, c }) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <path d="M7 2.4l1.8 4M13 2.4l-1.8 4" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="12.4" r="5" fill={c} opacity=".85" stroke={c} strokeWidth="1" />
  </svg>
);

const Helmet: React.FC<{ s: number; c: string }> = ({ s, c }) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <path d="M3.4 12.4a6.6 6.6 0 0113.2 0v1.2H3.4v-1.2z" fill={c} opacity=".85" />
    <rect x="2.6" y="13.8" width="14.8" height="2.2" rx="1.1" fill={c} />
  </svg>
);

export const RankInsignia: React.FC<{
  rank?: string | null;
  size?: number;
  title?: string;
}> = ({ rank, size = 16, title }) => {
  const cfg = (rank && INSIGNIA[rank]) || INSIGNIA.RECRUIT!;
  if (cfg.shape === 'none' || cfg.count === 0) {
    return <span style={{ color: cfg.color, fontSize: size * 0.8, lineHeight: 1 }} title={title}>·</span>;
  }
  const One = { star: Star, bar: Bar, dot: Dot, diamond: Diamond,
                crown: Crown, medal: Medal, helmet: Helmet }[cfg.shape]!;
  return (
    <span
      title={title}
      style={{ display: 'inline-flex', alignItems: 'center', gap: cfg.shape === 'bar' ? 1 : 2, lineHeight: 1 }}
    >
      {Array.from({ length: cfg.count }, (_, i) => <One key={i} s={size} c={cfg.color} />)}
    </span>
  );
};
