// Фирменные иконки типов турниров. Все 18×18, currentColor.
// Используются в карточках турниров и в заголовках секций по типу.

import React from 'react';

type Props = { size?: number };

// Чемпион Мира — глобус
export const IcoWorld: React.FC<Props> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3"/>
    <ellipse cx="9" cy="9" rx="3" ry="7" stroke="currentColor" strokeWidth="1.1"/>
    <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.1"/>
    <line x1="9" y1="2" x2="9" y2="16" stroke="currentColor" strokeWidth=".7" opacity=".5"/>
  </svg>
);

// Чемпион Страны — щит
export const IcoCountry: React.FC<Props> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <path d="M9 1.5l6 1.8v5c0 3.7-2.5 6.5-6 7.2-3.5-.7-6-3.5-6-7.2v-5L9 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M6.5 8.5l1.8 1.8L11.8 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Чемпион Сезона — лавровая ветвь (вместо цветочка)
export const IcoSeasonal: React.FC<Props> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <path d="M9 16V6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M9 7c-2-.5-3.5-2-3.5-4M9 9c-2.3-.5-4-2.2-4-4.5M9 11c-2.5-.5-4.5-2.5-4.5-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M9 7c2-.5 3.5-2 3.5-4M9 9c2.3-.5 4-2.2 4-4.5M9 11c2.5-.5 4.5-2.5 4.5-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <circle cx="9" cy="5.5" r="1" fill="currentColor"/>
  </svg>
);

// Чемпион Месяца — луна
export const IcoMonthly: React.FC<Props> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <path d="M13 9a6 6 0 1 1-6.5-6 5 5 0 0 0 6.5 6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);

// Чемпион Недели — звезда
export const IcoWeekly: React.FC<Props> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <path
      d="M9 1.5l2.2 4.6 5 .7-3.6 3.6.9 5.1L9 13l-4.5 2.5.9-5.1L1.8 6.8l5-.7L9 1.5z"
      stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"
    />
  </svg>
);

// Trophy — общий значок турнира
export const IcoTrophy: React.FC<Props> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <path d="M5 3h8v3.5a4 4 0 0 1-8 0V3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M5 5H3.5C3 5 2.5 5.5 2.5 6.2c0 1.6 1.2 3 3 3.3M13 5h1.5c.5 0 1 .5 1 1.2 0 1.6-1.2 3-3 3.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M9 11.5V14M6 14.5h6M6.5 16h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

// Лидерборд (список с медалями)
export const IcoLeaderboard: React.FC<Props> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <rect x="2.5" y="9" width="3.5" height="6" rx=".7" stroke="currentColor" strokeWidth="1.2"/>
    <rect x="7.2" y="5.5" width="3.5" height="9.5" rx=".7" stroke="currentColor" strokeWidth="1.2"/>
    <rect x="11.9" y="11" width="3.5" height="4" rx=".7" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);

// Донат / монета с плюсом
export const IcoDonate: React.FC<Props> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M9 6v6M6 9h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

// Замок — регистрация закрыта
export const IcoLock: React.FC<Props> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <rect x="3.5" y="8" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M6 8V5.5a3 3 0 0 1 6 0V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

// Чек — участник / завершено
export const IcoCheck: React.FC<Props> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <path d="M3.5 9l3.5 3.5L14.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Скрещенные мечи — играть/принять матч
export const IcoSwords: React.FC<Props> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <path d="M2.5 2.5l8 8M14 4.5L11 7.5M3.5 14.5l3-3M14.5 14.5l-8-8M3 4.5L6 7.5M14.5 2.5l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <circle cx="3.5" cy="3.5" r=".8" fill="currentColor"/>
    <circle cx="14.5" cy="3.5" r=".8" fill="currentColor"/>
  </svg>
);

// Финиш-флаг
export const IcoFlag: React.FC<Props> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <line x1="4" y1="2" x2="4" y2="16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M4 3h9l-2 3 2 3H4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);

// Маппинг тип турнира → иконка
export const TOURNAMENT_TYPE_ICON: Record<string, React.FC<Props>> = {
  WORLD: IcoWorld,
  COUNTRY: IcoCountry,
  SEASONAL: IcoSeasonal,
  MONTHLY: IcoMonthly,
  WEEKLY: IcoWeekly,
  YEARLY: IcoTrophy,
  TEAM: IcoTrophy,
};
