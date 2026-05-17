/**
 * CountryFlag — флаг страны (PNG из Twemoji CDN).
 *
 * 2026-05-17 Кенан: flagcdn.com грузился ненадёжно в Telegram WebView и
 * показывал текстовый fallback «AZ». Перешли на Twemoji через cdnjs —
 * универсальный CDN, который сборка Cloudflare уже использует для других
 * ассетов, отдаёт PNG по codepoint regional-indicator.
 *
 * Алгоритм: ISO-2 «AZ» → regional indicator codepoints 1F1E6-1F1FF →
 * https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f1e6-1f1ff.png
 *
 * Fallback: при ошибке загрузки PNG — нативный emoji через
 * String.fromCodePoint (на Android/iOS системный шрифт рендерит флаг).
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
  // Regional indicator codepoints: A=0x41 → 0x1F1E6 (127462).
  const codepoints = [...upper]
    .map((c) => (c.charCodeAt(0) - 65 + 0x1f1e6).toString(16))
    .join('-');
  const url = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/${codepoints}.png`;

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
          flexShrink: 0,
        }}
      >
        <img
          src={url}
          alt={upper}
          width={size}
          height={size}
          draggable={false}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </span>
    );
  }

  // Fallback — нативный emoji
  const emoji = String.fromCodePoint(
    ...[...upper].map((c) => c.charCodeAt(0) - 65 + 0x1f1e6),
  );
  return (
    <span
      title={upper}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        fontSize: size * 0.95,
        lineHeight: 1,
        fontFamily:
          "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif",
        flexShrink: 0,
      }}
    >
      {emoji}
    </span>
  );
};
