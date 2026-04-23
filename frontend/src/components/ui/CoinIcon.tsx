/**
 * CoinIcon — единая иконка монеты ChessCoin (золотой конь).
 * Ранее дублировалась инлайном в GamePage/BattlesPage/BattleHistoryPage.
 */
import React from 'react';

export const CoinIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="15" fill="url(#coinBg)" stroke="url(#coinBorder)" strokeWidth="1.2"/>
    <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(180,130,20,.4)" strokeWidth=".6"/>
    <path d="M11 24c0-1 .5-2 1.5-2.5L14 21c-1-1-1.5-2.5-1-4 .3-1 1-2 2-2.5-.5-.8-.5-1.5 0-2 .8-.5 2-.3 2.5.5.5.8.3 2-.5 2.5.5.5 1 1.5.8 2.5l2 1c1 .5 1.7 1.5 1.7 2.5v.5H11z" fill="url(#coinKnight)"/>
    <path d="M16.5 12c.5-1 1.5-2 2-3 .3-.5 0-1-.3-1.2-.5-.3-1 0-1.2.5L16 10l-1-.5c-.3-1.5.5-3 2-3.5 1.5-.5 3 .2 3.5 1.5.3.8 0 1.8-.5 2.5l-1 1.5" fill="url(#coinKnight)" opacity=".9"/>
    <defs>
      <radialGradient id="coinBg" cx="38%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#F0C85A"/>
        <stop offset="55%" stopColor="#D4A843"/>
        <stop offset="100%" stopColor="#8A6020"/>
      </radialGradient>
      <linearGradient id="coinBorder" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F0C85A"/>
        <stop offset="50%" stopColor="#A07830"/>
        <stop offset="100%" stopColor="#F0C85A"/>
      </linearGradient>
      <linearGradient id="coinKnight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#120E04"/>
        <stop offset="100%" stopColor="#1E1608"/>
      </linearGradient>
    </defs>
  </svg>
);
