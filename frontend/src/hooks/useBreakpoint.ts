import { useState, useEffect } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

// Границы те же, что в CSS — единственный источник правды о размерах экрана.
// Читать window.innerWidth запрещено правилом проекта: в Telegram WebView оно
// врёт при открытой клавиатуре и при смене ориентации приходит с задержкой.
const QUERIES: [Breakpoint, string][] = [
  ['desktop', '(min-width: 768px)'],
  ['tablet',  '(min-width: 480px)'],
];

function current(): Breakpoint {
  for (const [name, query] of QUERIES) {
    if (window.matchMedia(query).matches) return name;
  }
  return 'mobile';
}

/**
 * useBreakpoint — текущий responsive breakpoint через CSS media queries.
 *
 * Usage:
 *   const breakpoint = useBreakpoint();
 *   const isSmall = breakpoint === 'mobile';
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(current);

  useEffect(() => {
    const update = () => setBreakpoint(current());
    const lists = QUERIES.map(([, query]) => window.matchMedia(query));
    lists.forEach(l => l.addEventListener('change', update));
    update();
    return () => lists.forEach(l => l.removeEventListener('change', update));
  }, []);

  return breakpoint;
}
