import { useT } from '@/i18n/useT';
import { JarvisLevel } from '@/components/ui/JarvisModal';

const JARVIS_BASE = [
  { level: 1,  reward: 1000,  errorRate: 20, depth: 1  },
  { level: 2,  reward: 2000,  errorRate: 18, depth: 1  },
  { level: 3,  reward: 3000,  errorRate: 16, depth: 2  },
  { level: 4,  reward: 4000,  errorRate: 14, depth: 2  },
  { level: 5,  reward: 5000,  errorRate: 12, depth: 2  },
  { level: 6,  reward: 7000,  errorRate: 10, depth: 3  },
  { level: 7,  reward: 9000,  errorRate: 8,  depth: 3  },
  { level: 8,  reward: 11000, errorRate: 7,  depth: 4  },
  { level: 9,  reward: 13000, errorRate: 6,  depth: 4  },
  { level: 10, reward: 15000, errorRate: 5,  depth: 5  },
  { level: 11, reward: 18000, errorRate: 4,  depth: 5  },
  { level: 12, reward: 21000, errorRate: 3,  depth: 6  },
  { level: 13, reward: 25000, errorRate: 2,  depth: 7  },
  { level: 14, reward: 30000, errorRate: 2,  depth: 7  },
  { level: 15, reward: 35000, errorRate: 1,  depth: 8  },
  { level: 16, reward: 40000, errorRate: 1,  depth: 9  },
  { level: 17, reward: 45000, errorRate: 0,  depth: 9  },
  { level: 18, reward: 50000, errorRate: 0,  depth: 10 },
  { level: 19, reward: 60000, errorRate: 0,  depth: 10 },
  { level: 20, reward: 75000, errorRate: 0,  depth: 10 },
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
