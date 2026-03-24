/**
 * Shared UI constants for consistent design across all pages.
 * Import and use these instead of hardcoding values.
 */

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  page: 18,
} as const;

export const FONT = {
  xs: 10,
  sm: 11,
  md: 13,
  lg: 15,
  xl: 17,
  xxl: 20,
  hero: 26,
  mono: "'JetBrains Mono', monospace",
  heading: "'Unbounded', sans-serif",
  body: "'Inter', sans-serif",
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 100,
  card: 18,
  modal: 24,
} as const;

export const COLOR = {
  accent: 'var(--accent, #F5C842)',
  green: 'var(--green, #00D68F)',
  red: 'var(--red, #FF4D6A)',
  purple: '#9B85FF',
  bg: 'var(--bg, #0B0D11)',
  bgCard: 'var(--bg-card, #1C2030)',
  bgInput: 'var(--bg-input, #232840)',
  textPrimary: 'var(--text-primary, #F0F2F8)',
  textSecondary: 'var(--text-secondary, #8B92A8)',
  textMuted: 'var(--text-muted, #4A5270)',
  border: 'var(--border, rgba(255,255,255,0.07))',
} as const;

export const BUTTON = {
  primary: {
    background: COLOR.accent,
    color: COLOR.bg,
    border: 'none',
    borderRadius: RADIUS.md,
    fontSize: FONT.md,
    fontWeight: 700,
    padding: '12px 16px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  secondary: {
    background: COLOR.bgCard,
    color: COLOR.textSecondary,
    border: `1px solid ${COLOR.border}`,
    borderRadius: RADIUS.md,
    fontSize: FONT.sm,
    fontWeight: 600,
    padding: '10px 14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  danger: {
    background: 'rgba(255,77,106,0.12)',
    color: COLOR.red,
    border: `1px solid rgba(255,77,106,0.25)`,
    borderRadius: RADIUS.md,
    fontSize: FONT.md,
    fontWeight: 700,
    padding: '12px 16px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
} as const;

export const SECTION_LABEL: React.CSSProperties = {
  fontSize: FONT.xs,
  fontWeight: 700,
  letterSpacing: '.09em',
  textTransform: 'uppercase',
  color: COLOR.textMuted,
  padding: `${SPACING.lg}px ${SPACING.page}px ${SPACING.sm}px`,
};

export const CARD: React.CSSProperties = {
  margin: `0 ${SPACING.page}px ${SPACING.sm}px`,
  background: COLOR.bgCard,
  border: `1px solid ${COLOR.border}`,
  borderRadius: RADIUS.card,
  padding: `${SPACING.md}px ${SPACING.lg}px`,
};

import type React from 'react';
