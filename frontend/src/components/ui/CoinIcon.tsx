// CoinIcon — единая иконка монеты ChessCoin (золотой конь-монета).
// Используется везде, где визуально должен быть знак монеты.
// Для inline-текста (toasts, console) используется текстовая руна ᚙ,
// поэтому этот компонент — только для JSX/рендера.
import React from 'react';

interface CoinIconProps {
  size?: number;
  style?: React.CSSProperties;
  className?: string;
  title?: string;
}

export const CoinIcon: React.FC<CoinIconProps> = ({ size = 16, style, className, title }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    width={size}
    height={size}
    role="img"
    aria-label={title || 'ChessCoin'}
    className={className}
    style={{ display: 'inline-block', verticalAlign: '-0.15em', flexShrink: 0, ...style }}
  >
    <defs>
      <radialGradient id="ccFace" cx="35%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#F9D976" />
        <stop offset="45%" stopColor="#F0C85A" />
        <stop offset="80%" stopColor="#D4A843" />
        <stop offset="100%" stopColor="#A07830" />
      </radialGradient>
      <linearGradient id="ccRim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FCE49A" />
        <stop offset="50%" stopColor="#D4A843" />
        <stop offset="100%" stopColor="#7A5820" />
      </linearGradient>
      <radialGradient id="ccInset" cx="50%" cy="50%" r="50%">
        <stop offset="70%" stopColor="#A07830" stopOpacity="0" />
        <stop offset="100%" stopColor="#5C4318" stopOpacity=".6" />
      </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="31" fill="url(#ccRim)" />
    <circle cx="32" cy="32" r="27" fill="url(#ccFace)" />
    <circle cx="32" cy="32" r="27" fill="url(#ccInset)" />
    <circle cx="32" cy="32" r="26" fill="none" stroke="#7A5820" strokeWidth=".6" opacity=".5" />
    <circle cx="32" cy="32" r="25.2" fill="none" stroke="#FCE49A" strokeWidth=".4" opacity=".55" />
    <g transform="translate(32 34)" fill="#5C4318">
      <path d="M -10 10 C -10 8 -9 7 -7.5 6.5 L -8 3 C -8.5 1.5 -8 -0.5 -6.5 -1.5 L -8 -3 C -9 -4.5 -8.5 -6.5 -7 -7.5 L -2 -12 C -0.5 -13 1.5 -13.5 3 -13 L 3 -14.5 C 3 -15.2 3.5 -15.5 4 -15.3 L 5.2 -14.8 C 5.7 -14.6 5.9 -14 5.7 -13.5 L 5 -12 C 7 -11 8.5 -8.5 9 -6 L 10 -1 C 10.3 1.5 10 3.8 9.3 5.5 L 9 7 L 9.8 10 Z" />
      <circle cx="1" cy="-7" r="1" fill="#F0C85A" />
    </g>
    <ellipse cx="22" cy="18" rx="8" ry="3.5" fill="#FFF3C4" opacity=".35" />
  </svg>
);

export default CoinIcon;
