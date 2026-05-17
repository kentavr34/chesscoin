import { useT } from '@/i18n/useT';
import { JarvisLevel } from '@/components/ui/JarvisModal';

// C.3 MASTER_PLAN: значения наград синхронизированы с backend/src/config.ts:85-104
// Любое изменение reward — править одновременно здесь и в config.ts.
const JARVIS_BASE = [
  { level: 1,  reward: 1000,    errorRate: 20, depth: 1  },
  { level: 2,  reward: 2000,    errorRate: 18, depth: 1  },
  { level: 3,  reward: 3000,    errorRate: 16, depth: 2  },
  { level: 4,  reward: 5000,    errorRate: 14, depth: 2  },
  { level: 5,  reward: 7000,    errorRate: 12, depth: 2  },
  { level: 6,  reward: 10000,   errorRate: 10, depth: 3  },
  { level: 7,  reward: 15000,   errorRate: 8,  depth: 3  },
  { level: 8,  reward: 20000,   errorRate: 7,  depth: 4  },
  { level: 9,  reward: 30000,   errorRate: 6,  depth: 4  },
  { level: 10, reward: 40000,   errorRate: 5,  depth: 5  },
  { level: 11, reward: 55000,   errorRate: 4,  depth: 5  },
  { level: 12, reward: 75000,   errorRate: 3,  depth: 6  },
  { level: 13, reward: 100000,  errorRate: 2,  depth: 7  },
  { level: 14, reward: 130000,  errorRate: 2,  depth: 7  },
  { level: 15, reward: 170000,  errorRate: 1,  depth: 8  },
  { level: 16, reward: 220000,  errorRate: 1,  depth: 9  },
  { level: 17, reward: 300000,  errorRate: 0,  depth: 9  },
  { level: 18, reward: 400000,  errorRate: 0,  depth: 10 },
  { level: 19, reward: 600000,  errorRate: 0,  depth: 10 },
  { level: 20, reward: 1000000, errorRate: 0,  depth: 10 },
];

/**
 * Hook to get localized Jarvis levels with current language
 * Usage: const levels = useJarvisLevels();
 */
export function useJarvisLevels(): JarvisLevel[] {
  const t = useT();
  return JARVIS_BASE.map((base, idx) => ({
    ...base,
    name: t.jarvis.levels[idx].name,
  }));
}

/**
 * Get localized name for a Jarvis level by its number (1-20)
 */
export function getJarvisLevelName(t: ReturnType<typeof useT>, levelNum: number): string {
  const idx = Math.max(0, Math.min(19, levelNum - 1));
  return t.jarvis.levels[idx].name;
}

/**
 * Find Jarvis level data by localized name (search across all languages)
 * This is useful for looking up badges stored with translated names
 */
export function findJarvisLevelByName(t: ReturnType<typeof useT>, name: string): JarvisLevel | undefined {
  const levels = JARVIS_BASE.map((base, idx) => ({
    ...base,
    name: t.jarvis.levels[idx].name,
  }));
  return levels.find(l => l.name === name);
}
