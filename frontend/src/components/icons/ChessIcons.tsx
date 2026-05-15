// Общие иконки для модалок выбора партии (Jarvis + Battle)
// Один стандарт: 33×33, viewBox 18×18 — утверждённый шаблон TPL-002
// (.claude/archive/templates/v1_current/TPL-002_2026-04-03_JarvisPlayModal.tsx)

export const IcoDice = () => (
  <svg width="33" height="33" viewBox="0 0 18 18" fill="none">
    <rect x="1.5" y="1.5" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="5.5" cy="5.5" r="1.2" fill="currentColor"/>
    <circle cx="12.5" cy="5.5" r="1.2" fill="currentColor"/>
    <circle cx="9" cy="9" r="1.2" fill="currentColor"/>
    <circle cx="5.5" cy="12.5" r="1.2" fill="currentColor"/>
    <circle cx="12.5" cy="12.5" r="1.2" fill="currentColor"/>
  </svg>
);

export const IcoKingWhite = () => (
  <svg width="33" height="33" viewBox="0 0 18 18" fill="none">
    <path d="M9 2v3M7.5 3.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <rect x="7" y="5" width="4" height="2" rx=".5" fill="currentColor" opacity=".8"/>
    <path d="M5.5 7h7l-1 8H6.5L5.5 7z" fill="currentColor" opacity=".7"/>
    <path d="M4 15h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

export const IcoKingBlack = () => (
  <svg width="33" height="33" viewBox="0 0 18 18" fill="none">
    <path d="M9 2v3M7.5 3.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <rect x="7" y="5" width="4" height="2" rx=".5" fill="currentColor" opacity=".9"/>
    <path d="M5.5 7h7l-1 8H6.5L5.5 7z" fill="currentColor" opacity=".9"/>
    <path d="M4 15h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <rect x="5" y="6.5" width="8" height="9" rx="1" fill="currentColor" opacity=".15"/>
  </svg>
);

// Полосатая чёрно-белая королева — иконка случайного выбора цвета.
// Левая половина — чёрная, правая — белая (или наоборот). Запрошено Кенаном
// 2026-05-16: сменить рандом-кубик на полосатую королеву (CLAUDE.md §9).
export const IcoStripedQueen = () => (
  <svg width="33" height="33" viewBox="0 0 18 18" fill="none">
    {/* Корона: 3 зубца с шариками */}
    <path d="M9 2v2.5" stroke="currentColor" strokeWidth=".8" strokeLinecap="round"/>
    <circle cx="9" cy="1.8" r=".7" fill="currentColor"/>
    <circle cx="4.6" cy="3.2" r=".55" fill="currentColor"/>
    <circle cx="13.4" cy="3.2" r=".55" fill="currentColor"/>
    <path d="M3 6.5 L4.6 3.6 L6.8 5.5 L9 3 L11.2 5.5 L13.4 3.6 L15 6.5 Z"
          fill="currentColor" stroke="currentColor" strokeWidth=".4" strokeLinejoin="round"/>
    {/* Воротник */}
    <rect x="3" y="6.3" width="12" height="1.6" rx=".4" fill="currentColor"/>
    {/* Тело с вертикальными полосками */}
    <defs>
      <clipPath id="iq-body">
        <path d="M3.5 7.9 L14.5 7.9 L13 14.5 L5 14.5 Z" />
      </clipPath>
    </defs>
    <g clipPath="url(#iq-body)">
      <rect x="3" y="7.9" width="11" height="7" fill="currentColor"/>
      <rect x="5.7" y="7.9" width="1.5" height="7" fill="#0D0D14"/>
      <rect x="8.6" y="7.9" width="1.5" height="7" fill="#0D0D14"/>
      <rect x="11.5" y="7.9" width="1.5" height="7" fill="#0D0D14"/>
    </g>
    {/* Основание */}
    <path d="M3.5 14.5 L14.5 14.5 L13.5 16 L4.5 16 Z" fill="currentColor"/>
    <path d="M3 16h12" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);
