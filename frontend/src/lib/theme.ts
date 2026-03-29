// Доступные визуальные темы (синхронизировать с seed.ts)
export type ThemeKey = 'default' | 'binance' | 'chess_classic' | 'neon_cyber' | 'royal_gold' | 'matrix_dark' | 'crystal_ice';

export interface ThemeTokens {
  bg:       string;  // основной фон
  bgCard:   string;  // фон карточек
  bgInput:  string;  // фон инпутов
  border:   string;  // цвет бордеров
  accent:   string;  // основной акцент
  accent2:  string;  // вторичный акцент
  textPrimary:   string;
  textSecondary: string;
  textMuted:     string;
  green:  string;
  red:    string;
  gold:   string;
}

export const THEMES: Record<ThemeKey, ThemeTokens> = {
  default: {
    bg: '#0A0C10', bgCard: '#13151A', bgInput: '#1A1D24',
    border: 'rgba(255,255,255,0.06)',
    accent: '#E5B83B', accent2: '#6850E5',
    textPrimary: '#F1F3F5', textSecondary: '#8B92A8', textMuted: '#515B70',
    green: '#00C888', red: '#FA4B6B', gold: '#E5B83B',
  },
  binance: {
    bg: '#0B0E11', bgCard: '#181A20', bgInput: '#2B3139',
    border: 'rgba(255,255,255,0.08)',
    accent: '#FCD535', accent2: '#D09E00',
    textPrimary: '#EAECEF', textSecondary: '#848E9C', textMuted: '#474D57',
    green: '#0ECB81', red: '#F6465D', gold: '#FCD535',
  },
  chess_classic: {
    bg: '#161915', bgCard: '#1E231D', bgInput: '#262D24',
    border: 'rgba(255,255,255,0.08)',
    accent: '#659C35', accent2: '#D9DABF',
    textPrimary: '#D9DABF', textSecondary: '#88997E', textMuted: '#5A6653',
    green: '#659C35', red: '#D14848', gold: '#D1B442',
  },
  neon_cyber: {
    bg: '#05060A', bgCard: '#0A0C14', bgInput: '#10121F',
    border: 'rgba(0,180,255,0.1)',
    accent: '#00B4FF', accent2: '#8A1CD9',
    textPrimary: '#D0E4FF', textSecondary: '#607999', textMuted: '#2D3A4F',
    green: '#00E58F', red: '#F01D56', gold: '#FFC800',
  },
  royal_gold: {
    bg: '#07080D', bgCard: '#0E101A', bgInput: '#141829',
    border: 'rgba(180,140,40,0.15)',
    accent: '#C59A2F', accent2: '#162C6B',
    textPrimary: '#EFE5C6', textSecondary: '#857890', textMuted: '#4C4258',
    green: '#43A047', red: '#D32F2F', gold: '#C59A2F',
  },
  matrix_dark: {
    bg: '#000000', bgCard: '#030A03', bgInput: '#061206',
    border: 'rgba(0,255,0,0.1)',
    accent: '#00D135', accent2: '#00750E',
    textPrimary: '#00D135', textSecondary: '#00750E', textMuted: '#003D08',
    green: '#00D135', red: '#D70000', gold: '#D4AF37',
  },
  crystal_ice: {
    bg: '#050A14', bgCard: '#08101E', bgInput: '#0D182B',
    border: 'rgba(100,200,255,0.1)',
    accent: '#4CABDF', accent2: '#0066CC',
    textPrimary: '#CDE5F7', textSecondary: '#547B99', textMuted: '#2B425A',
    green: '#00B395', red: '#E63959', gold: '#E5BC6E',
  },
};

const STORAGE_KEY = 'chesscoin_theme';

export function getActiveTheme(): ThemeKey {
  try {
    return (localStorage.getItem(STORAGE_KEY) as ThemeKey) ?? 'default';
  } catch {
    return 'default';
  }
}

export function setActiveTheme(key: ThemeKey) {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {}
  applyThemeToCss(THEMES[key]);
}

export function applyThemeToCss(t: ThemeTokens) {
  const root = document.documentElement;
  root.style.setProperty('--bg',            t.bg);
  root.style.setProperty('--bg-card',       t.bgCard);
  root.style.setProperty('--bg-input',      t.bgInput);
  root.style.setProperty('--border',        t.border);
  root.style.setProperty('--accent',        t.accent);
  root.style.setProperty('--accent2',       t.accent2);
  root.style.setProperty('--text-primary',  t.textPrimary);
  root.style.setProperty('--text-secondary',t.textSecondary);
  root.style.setProperty('--text-muted',    t.textMuted);
  root.style.setProperty('--green',         t.green);
  root.style.setProperty('--red',           t.red);
  root.style.setProperty('--gold',          t.gold);
}

export function getCurrentTokens(): ThemeTokens {
  return THEMES[getActiveTheme()];
}
