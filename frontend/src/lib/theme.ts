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
    bg: '#0B0D11', bgCard: '#13161E', bgInput: '#1C2030',
    border: 'rgba(255,255,255,0.08)',
    accent: '#F5C842', accent2: '#7B61FF',
    textPrimary: '#F0F2F8', textSecondary: '#8B92A8', textMuted: '#4A5270',
    green: '#00D68F', red: '#FF4D6A', gold: '#F5C842',
  },
  binance: {
    bg: '#0B0E11', bgCard: '#1E2026', bgInput: '#2B2F36',
    border: 'rgba(255,255,255,0.08)',
    accent: '#F0B90B', accent2: '#C99400',
    textPrimary: '#EAECEF', textSecondary: '#848E9C', textMuted: '#474D57',
    green: '#03A66D', red: '#CF304A', gold: '#F0B90B',
  },
  chess_classic: {
    bg: '#1A2318', bgCard: '#243020', bgInput: '#2D3B29',
    border: 'rgba(120,180,60,0.15)',
    accent: '#7BC143', accent2: '#EDEED1',
    textPrimary: '#EDEED1', textSecondary: '#9DB88A', textMuted: '#5A7050',
    green: '#7BC143', red: '#E05B5B', gold: '#F5C842',
  },
  neon_cyber: {
    bg: '#06070F', bgCard: '#0D0F1E', bgInput: '#141628',
    border: 'rgba(0,212,255,0.12)',
    accent: '#00D4FF', accent2: '#B026FF',
    textPrimary: '#E0F0FF', textSecondary: '#7090B0', textMuted: '#304060',
    green: '#00FF9D', red: '#FF2666', gold: '#FFD700',
  },
  royal_gold: {
    bg: '#07091A', bgCard: '#0F1230', bgInput: '#181C3E',
    border: 'rgba(180,140,40,0.2)',
    accent: '#D4AF37', accent2: '#1A3A8C',
    textPrimary: '#F0E8C8', textSecondary: '#9080A0', textMuted: '#504060',
    green: '#4CAF50', red: '#E53935', gold: '#D4AF37',
  },
  matrix_dark: {
    bg: '#000000', bgCard: '#041404', bgInput: '#081808',
    border: 'rgba(0,255,0,0.1)',
    accent: '#00FF41', accent2: '#008F11',
    textPrimary: '#00FF41', textSecondary: '#008F11', textMuted: '#004A0A',
    green: '#00FF41', red: '#FF0000', gold: '#FFD700',
  },
  crystal_ice: {
    bg: '#060C18', bgCard: '#0A1428', bgInput: '#101E3A',
    border: 'rgba(100,200,255,0.15)',
    accent: '#64C8FF', accent2: '#0080FF',
    textPrimary: '#D0EEFF', textSecondary: '#6090B0', textMuted: '#304860',
    green: '#00CCAA', red: '#FF4466', gold: '#FFD580',
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
