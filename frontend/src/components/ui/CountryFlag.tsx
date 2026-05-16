/**
 * CountryFlag — настоящий флаг страны (PNG из flagcdn.com).
 *
 * 2026-05-16 Кенан: «флаг» — должен быть реальный флаг страны.
 * Раньше показывали текст-код «AT» в плашке; теперь — флаг через CDN
 * https://flagcdn.com (свободный SVG/PNG dataset ISO-3166-1 alpha-2).
 *
 * При ошибке загрузки (CDN недоступен, неверный код) — fallback
 * на стилизованную текстовую плашку с кодом страны, чтобы UI не ломался.
 */
import React, { useState } from 'react';

interface Props {
  /** ISO-2 код страны: 'RU', 'US', 'AZ', … */
  code?: string | null;
  /** Размер кружка в px. По умолчанию 18. */
  size?: number;
}

export const CountryFlag: React.FC<Props> = ({ code, size = 18 }) => {
  const [failed, setFailed] = useState(false);
  if (!code || code.length !== 2) return null;
  const upper = code.toUpperCase();
  const lower = upper.toLowerCase();
  // Ширина w<size> у flagcdn возвращает PNG; для retina берём ×2
  const w = Math.max(40, Math.round(size * 2));
  const url = `https://flagcdn.com/w${w}/${lower}.png`;

  if (!failed) {
    return (
      <span
        title={upper}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          borderRadius: size / 6,
          overflow: 'hidden',
          background: 'rgba(255,255,255,.04)',
          border: '.5px solid rgba(255,255,255,.12)',
          flexShrink: 0,
        }}
      >
        <img
          src={url}
          alt={upper}
          width={size}
          height={size}
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </span>
    );
  }

  // Fallback — текстовая плашка
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
        background: 'rgba(212,168,67,.14)',
        color: '#F0C85A',
        border: '.5px solid rgba(240,200,90,.22)',
        fontSize: size * 0.45,
        fontWeight: 800,
        fontFamily: "'JetBrains Mono', monospace",
        lineHeight: 1,
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    >
      {upper}
    </span>
  );
};
