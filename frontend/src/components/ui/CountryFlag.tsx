/**
 * CountryFlag — текстовый код страны в стилизованном кружке.
 *
 * Заменяет regional-indicator emoji (🇷🇺 🇺🇸 🇦🇿 …), которые Telegram WebApp
 * на mobile не умеет рендерить — отображаются как иероглифы.
 *
 * Используется везде где раньше показывали `{user.countryMember?.country?.flag}`.
 */
import React from 'react';

interface Props {
  /** ISO-2 код страны: 'RU', 'US', 'AZ', … */
  code?: string | null;
  /** Размер кружка в px. По умолчанию 18. */
  size?: number;
}

const PALETTE: Record<string, { bg: string; fg: string }> = {
  // Краткая палитра для популярных стран; всё остальное — нейтральный золотой
  RU: { bg: 'rgba(74,158,255,.18)', fg: '#82CFFF' },
  US: { bg: 'rgba(74,158,255,.18)', fg: '#82CFFF' },
  GB: { bg: 'rgba(204,80,80,.18)',  fg: '#FF8080' },
  AZ: { bg: 'rgba(0,180,140,.18)',  fg: '#3DBA7A' },
  TR: { bg: 'rgba(204,80,80,.18)',  fg: '#FF8080' },
  DE: { bg: 'rgba(255,160,0,.16)',  fg: '#F0C85A' },
  FR: { bg: 'rgba(74,158,255,.18)', fg: '#82CFFF' },
  UA: { bg: 'rgba(255,200,80,.18)', fg: '#F0C85A' },
  BY: { bg: 'rgba(180,80,80,.18)',  fg: '#FF8080' },
  KZ: { bg: 'rgba(0,180,200,.18)',  fg: '#82CFFF' },
};

const DEFAULT_PALETTE = { bg: 'rgba(212,168,67,.14)', fg: '#F0C85A' };

export const CountryFlag: React.FC<Props> = ({ code, size = 18 }) => {
  if (!code || code.length !== 2) return null;
  const upper = code.toUpperCase();
  const p = PALETTE[upper] ?? DEFAULT_PALETTE;
  return (
    <span
      title={upper}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: size / 4,
        background: p.bg,
        color: p.fg,
        border: `.5px solid ${p.fg}33`,
        fontSize: size * 0.5,
        fontWeight: 800,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '.02em',
        lineHeight: 1,
        verticalAlign: 'middle',
      }}
    >
      {upper}
    </span>
  );
};
