import { useState, useEffect } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/**
 * useBreakpoint — Hook для определения текущего responsive breakpoint
 * Используется для компонентов, требующих динамической логики на разных экранах
 *
 * Usage:
 *   const breakpoint = useBreakpoint();
 *   const isSmall = breakpoint === 'mobile';
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('mobile');

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 480) {
        setBreakpoint('mobile');
      } else if (width < 768) {
        setBreakpoint('tablet');
      } else {
        setBreakpoint('desktop');
      }
    };

    // Set initial breakpoint
    updateBreakpoint();

    // Listen to window resize events
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return breakpoint;
}
