/**
 * UiIcons.tsx — SVG-иконки замены эмодзи в UI.
 *
 * Правило SAFETY_POLICY: НИКАКИХ ЭМОДЗИ. Только SVG.
 * Всё что было 🏆 👑 🤖 👥 🛒 🛍 💸 💼 🎁 — здесь.
 *
 * Для денег → <CoinIcon /> из @/components/ui/CoinIcon.
 * Для флагов → <CountryFlag code="RU" /> из @/components/ui/CountryFlag.
 */
import React from 'react';

type Props = { size?: number; color?: string };

const baseSvg = (size: number, viewBox: string, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox={viewBox} fill="none" style={{ verticalAlign: 'middle' }}>
    {children}
  </svg>
);

// Корона (👑 / 👑)
export const IcoCrown: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <path d="M3 6l3 3 3-5 3 5 3-3v7H3V6z" fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round"/>
    <line x1="3" y1="14" x2="15" y2="14" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
  </>
));

// Робот (🤖) — Jarvis
export const IcoRobot: React.FC<Props> = ({ size = 16, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <rect x="3" y="5.5" width="12" height="9" rx="2" stroke={color} strokeWidth="1.3"/>
    <circle cx="6.5" cy="9" r="1" fill={color}/>
    <circle cx="11.5" cy="9" r="1" fill={color}/>
    <line x1="7" y1="12" x2="11" y2="12" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="9" y1="3" x2="9" y2="5.5" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="9" cy="2.5" r=".9" fill={color}/>
  </>
));

// Группа людей (👥) — рефералы, бойцы
export const IcoUsers: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <circle cx="6.5" cy="6" r="2.2" stroke={color} strokeWidth="1.2"/>
    <path d="M2.5 14.5c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    <circle cx="13" cy="7" r="1.8" stroke={color} strokeWidth="1.2"/>
    <path d="M11 14.5c0-1.8 1.3-3 3-3 1.2 0 2.2.7 2.6 1.6" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
  </>
));

// Магазин (🛍 / 🛒)
export const IcoShop: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <path d="M4 6h10l-1 9H5L4 6z" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M6.5 6V4.5a2.5 2.5 0 015 0V6" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
  </>
));

// Корзина (🛒) — для биржи buy
export const IcoCart: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <path d="M2 3.5h2l2 9h8l1.5-7H5" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
    <circle cx="7" cy="15" r="1.2" fill={color}/>
    <circle cx="13" cy="15" r="1.2" fill={color}/>
  </>
));

// Замок (🔒) уже есть в TournamentIcons, добавим открытый замок (🔓)
export const IcoUnlock: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <rect x="3.5" y="8" width="11" height="8" rx="1.5" stroke={color} strokeWidth="1.3"/>
    <path d="M6 8V5.5a3 3 0 0 1 5.5-1.7" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
  </>
));

// Поиск (🔍)
export const IcoSearch: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <circle cx="8" cy="8" r="5" stroke={color} strokeWidth="1.4"/>
    <line x1="12" y1="12" x2="15.5" y2="15.5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </>
));

// Стрелка вверх / вниз для arrow-стилизованных эмодзи 📈 📉
export const IcoArrowUp: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <path d="M9 3v12M4 8l5-5 5 5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
));

export const IcoArrowDown: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <path d="M9 15V3M4 10l5 5 5-5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
));

// Стрелка вверх-влево из коробки (📤 send/upload)
export const IcoUpload: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <path d="M3 11v3a1 1 0 001 1h10a1 1 0 001-1v-3" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M9 12V3M5 7l4-4 4 4" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </>
));

// Глобус (🌍 🌐) — мир/планета, для COUNTRY_WAR_WIN, world tournaments
export const IcoGlobe: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <circle cx="9" cy="9" r="6.5" stroke={color} strokeWidth="1.3"/>
    <ellipse cx="9" cy="9" rx="2.5" ry="6.5" stroke={color} strokeWidth="1.1"/>
    <line x1="2.5" y1="9" x2="15.5" y2="9" stroke={color} strokeWidth="1.1"/>
  </>
));

// Чек-марк / награда (✓)
export const IcoCheck2: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <path d="M3.5 9l3.5 3.5L14.5 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
));

// Медаль / награда (🏅 🥇 🥈 🥉)
export const IcoMedal: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <circle cx="9" cy="11" r="4.5" stroke={color} strokeWidth="1.3" fill={color} fillOpacity=".15"/>
    <path d="M6 6.5L4.5 2h3L9 6M12 6.5L13.5 2h-3L9 6" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
    <text x="9" y="13" textAnchor="middle" fontSize="5" fontWeight="900" fill={color}>1</text>
  </>
));

// Подарок (🎁) — bonus/welcome
export const IcoGift: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <rect x="2.5" y="7" width="13" height="8" rx="1" stroke={color} strokeWidth="1.3"/>
    <line x1="9" y1="7" x2="9" y2="15" stroke={color} strokeWidth="1.3"/>
    <rect x="2" y="5" width="14" height="2.5" rx=".5" stroke={color} strokeWidth="1.3"/>
    <path d="M9 5C9 5 6 2 5 4s3 1 4 1zM9 5C9 5 12 2 13 4s-3 1-4 1z" stroke={color} strokeWidth="1.2"/>
  </>
));

// Сетевой кошелёк / монета TON (💎)
export const IcoTon: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <circle cx="9" cy="9" r="7" stroke={color} strokeWidth="1.3"/>
    <path d="M5 6.5h8l-4 6.5-4-6.5z" fill={color} fillOpacity=".3" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
    <line x1="9" y1="6.5" x2="9" y2="13" stroke={color} strokeWidth="1.1"/>
  </>
));

// Биржа / обмен валют (💱)
export const IcoExchange: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <path d="M3 5h10l-2.5-2.5M15 13H5l2.5 2.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </>
));

// Портфель / комиссия (💼)
export const IcoBriefcase: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <rect x="2.5" y="6" width="13" height="9" rx="1.2" stroke={color} strokeWidth="1.3"/>
    <path d="M6.5 6V4.2a1 1 0 011-1h3a1 1 0 011 1V6" stroke={color} strokeWidth="1.3"/>
  </>
));

// Деньги-летят (💸) — комиссия/расход
export const IcoMoneyFly: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <rect x="4" y="6" width="10" height="6" rx="1" stroke={color} strokeWidth="1.3"/>
    <circle cx="9" cy="9" r="1.4" stroke={color} strokeWidth="1.2"/>
    <path d="M2 13l3-1M16 13l-3-1" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
  </>
));

// Кошелёк (👛)
export const IcoWallet: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <rect x="2.5" y="5" width="13" height="9" rx="1.5" stroke={color} strokeWidth="1.3"/>
    <path d="M2.5 8h13" stroke={color} strokeWidth="1.2"/>
    <circle cx="12" cy="10.5" r=".9" fill={color}/>
  </>
));

// Фото-камера (📷)
export const IcoCamera: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <rect x="2" y="6" width="14" height="9" rx="1.5" stroke={color} strokeWidth="1.3"/>
    <circle cx="9" cy="10.5" r="2.5" stroke={color} strokeWidth="1.3"/>
    <path d="M6.5 6L7.5 4h3L11.5 6" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
  </>
));

// Замок-закрыт ещё раз (🔒) для использования в этом файле
export const IcoLock: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <rect x="3.5" y="8" width="11" height="8" rx="1.5" stroke={color} strokeWidth="1.3"/>
    <path d="M6 8V5.5a3 3 0 0 1 6 0V8" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
  </>
));

// Лист бумаги / результат (📊 📋)
export const IcoStats: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <rect x="2" y="14" width="3" height="2.5" rx=".4" fill={color}/>
    <rect x="7" y="10" width="3" height="6.5" rx=".4" fill={color}/>
    <rect x="12" y="6" width="3" height="10.5" rx=".4" fill={color}/>
  </>
));

// Паззл (🧩) — для lesson/puzzle
export const IcoPuzzle: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <path d="M3 7h3V5a1.5 1.5 0 013 0v2h2V5a1.5 1.5 0 013 0v2h1v3h-2a1.5 1.5 0 000 3h2v3H3v-2a1.5 1.5 0 100-3H3V7z" stroke={color} strokeWidth="1.3" fill="none" strokeLinejoin="round"/>
));

// Рукопожатие (🤝) — friendly
export const IcoHandshake: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <path d="M2 9l3-3 2 1 2-1 2 1 2-1 3 3-3 3-2-1-2 1-2-1-2 1-3-3z" stroke={color} strokeWidth="1.3" fill="none" strokeLinejoin="round"/>
));

// Геймпад (🎮)
export const IcoGamepad: React.FC<Props> = ({ size = 14, color = 'currentColor' }) => baseSvg(size, '0 0 18 18', (
  <>
    <rect x="1.5" y="5.5" width="15" height="8" rx="3" stroke={color} strokeWidth="1.3"/>
    <circle cx="12.5" cy="9.5" r=".9" fill={color}/>
    <circle cx="14" cy="8" r=".9" fill={color}/>
    <path d="M4.5 8.5h2M5.5 7.5v2" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
  </>
));
