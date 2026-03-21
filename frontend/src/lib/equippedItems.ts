import type { User } from '@/types'; // R1
/**
 * equippedItems.ts
 * Утилиты для получения экипированных предметов из store пользователя.
 * Используется в ChessBoard, Avatar, и других компонентах.
 */

import { useUserStore } from "@/store/useUserStore";

// Карты настроек досок для BOARD_SKIN
// Расширенный тип для досок — поддержка CSS градиентов и эффектов
export interface BoardSkin {
  light: string;   // CSS background (цвет или gradient)
  dark: string;    // CSS background (цвет или gradient)
  border?: string; // граница между клетками
}

export const BOARD_SKIN_COLORS: Record<string, BoardSkin> = {
  // ── Оригинальная ChessCoin (default) ──────────────────────────────────────
  "ChessCoin":       { light: "radial-gradient(circle at 45% 35%, #EDF1FB, #E8EDF9)", dark: "radial-gradient(circle at 45% 35%, #96A8DC, #8B9DD4)" },

  // ── Классические деревянные ────────────────────────────────────────────────
  "Классика":        { light: "#F0D9B5", dark: "#B58863" },
  "Classic":         { light: "#F0D9B5", dark: "#B58863" },
  "Classic Wood":    { light: "#F0D9B5", dark: "#B58863" },
  "Dark Walnut":     { light: "#C8A96E", dark: "#5C3A1E" },
  "Дерево тёмное":   { light: "#C8A96E", dark: "#5C3A1E" },
  "Dark Wood":       { light: "#C8A96E", dark: "#5C3A1E" },

  // ── Камень/минерал ─────────────────────────────────────────────────────────
  "Мрамор":          { light: "#E8E0D8", dark: "#8C7B6B" },
  "Marble":          { light: "#E8E0D8", dark: "#8C7B6B" },
  "Blue Marble":     { light: "#DEE7F0", dark: "#7FA7C4" },
  "Малахит":         { light: "#A8D5A2", dark: "#3A7A34" },
  "Malachite":       { light: "#A8D5A2", dark: "#3A7A34" },
  "Black Marble":    { light: "linear-gradient(135deg, #E0E0E0, #D0D0D0)", dark: "linear-gradient(135deg, #424242, #333333)" },

  // ── Природные ──────────────────────────────────────────────────────────────
  "Золото":          { light: "#F5E6A0", dark: "#C8960A" },
  "Gold":            { light: "#F5E6A0", dark: "#C8960A" },
  "Лёд":             { light: "linear-gradient(135deg, #E8F4FD, #D8EEF8)", dark: "linear-gradient(135deg, #4FC3F7, #6090B8)" },
  "Ice":             { light: "linear-gradient(135deg, #E8F4FD, #D8EEF8)", dark: "linear-gradient(135deg, #4FC3F7, #6090B8)" },
  "Crystal Ice":     { light: "linear-gradient(135deg, #E8F4FD, #D8EEF8)", dark: "linear-gradient(135deg, #4FC3F7, #6090B8)" },
  "Пустыня":         { light: "#EDD5A3", dark: "#B8860B" },
  "Desert":          { light: "#EDD5A3", dark: "#B8860B" },
  "Emerald":         { light: "#C8E6C9", dark: "#2E7D32" },
  "Rose Gold":       { light: "#F8E0E6", dark: "#C2185B" },

  // ── Тёмные ────────────────────────────────────────────────────────────────
  "Ночь":            { light: "#1C1C2E", dark: "#0D0D1A" },
  "Night":           { light: "#1C1C2E", dark: "#0D0D1A" },
  "Dark Obsidian":   { light: "#2A2A3E", dark: "#1A1A2A" },

  // ── Текстурные/спецэффекты ─────────────────────────────────────────────────
  "Неон":            { light: "#0D1F2D", dark: "#071520" },
  "Neon":            { light: "#0D1F2D", dark: "#071520" },
  "Neon Grid":       {
    light: "#0A0A1A",
    dark: "#050510",
    border: "1px solid rgba(123,97,255,0.35)"
  },
  "Galaxy":          {
    light: "radial-gradient(circle at 30% 30%, #1E1E4A, #0D0D20)",
    dark: "radial-gradient(circle at 70% 70%, #12122E, #050510)"
  },
  "Кибер":           { light: "#141428", dark: "#0A0A1E" },
  "Cyber":           { light: "#141428", dark: "#0A0A1E" },
};

// Цветовые фильтры для PIECE_SKIN
export const PIECE_SKIN_FILTER: Record<string, string> = {
  "Стандарт":            "none",
  "Standard":            "none",
  "Золотые фигуры":      "sepia(1) saturate(4) hue-rotate(5deg) brightness(1.1)",
  "Gold Pieces":         "sepia(1) saturate(4) hue-rotate(5deg) brightness(1.1)",
  "Кристальные фигуры":  "brightness(1.3) saturate(0.3) hue-rotate(180deg)",
  "Crystal Pieces":      "brightness(1.3) saturate(0.3) hue-rotate(180deg)",
  "Серебряные фигуры":   "grayscale(1) brightness(1.4) contrast(1.1)",
  "Silver Pieces":       "grayscale(1) brightness(1.4) contrast(1.1)",
  "Бронзовые фигуры":    "sepia(0.8) saturate(2) brightness(0.9)",
  "Bronze Pieces":       "sepia(0.8) saturate(2) brightness(0.9)",
  "Теневые фигуры":      "invert(0.85) brightness(0.6)",
  "Shadow Pieces":       "invert(0.85) brightness(0.6)",
  "Неоновые фигуры":     "brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(80deg)",
  "Neon Pieces":         "brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(80deg)",
  "Пиксельные фигуры":   "none",
  "Pixel Pieces":        "none",
  "Аниме фигуры":        "saturate(1.5) brightness(1.1)",
  "Anime Pieces":        "saturate(1.5) brightness(1.1)",
};

// Цвета рамок аватара для AVATAR_FRAME
export const AVATAR_FRAME_STYLE: Record<string, {
  border: string; boxShadow: string;
}> = {
  "Золотая рамка":        { border: "2px solid #F5C842", boxShadow: "0 0 0 2px rgba(245,200,66,0.4), 0 0 16px rgba(245,200,66,0.3)" },
  "Gold Frame":           { border: "2px solid #F5C842", boxShadow: "0 0 0 2px rgba(245,200,66,0.4), 0 0 16px rgba(245,200,66,0.3)" },
  "Алмазная рамка":       { border: "2px solid #00D4FF", boxShadow: "0 0 0 2px rgba(0,212,255,0.5), 0 0 20px rgba(0,212,255,0.4)" },
  "Diamond Frame":        { border: "2px solid #00D4FF", boxShadow: "0 0 0 2px rgba(0,212,255,0.5), 0 0 20px rgba(0,212,255,0.4)" },
  "Огненная рамка":       { border: "2px solid #FF6B35", boxShadow: "0 0 0 2px rgba(255,107,53,0.5), 0 0 20px rgba(255,107,53,0.4)" },
  "Fire Frame":           { border: "2px solid #FF6B35", boxShadow: "0 0 0 2px rgba(255,107,53,0.5), 0 0 20px rgba(255,107,53,0.4)" },
  "Легендарная рамка ♟":  { border: "2px solid #E040FB", boxShadow: "0 0 0 3px rgba(224,64,251,0.5), 0 0 30px rgba(224,64,251,0.5)" },
  "Legendary Frame ♟":   { border: "2px solid #E040FB", boxShadow: "0 0 0 3px rgba(224,64,251,0.5), 0 0 30px rgba(224,64,251,0.5)" },
  "Серебряная рамка":     { border: "2px solid #C0C0C0", boxShadow: "0 0 0 2px rgba(192,192,192,0.4), 0 0 12px rgba(192,192,192,0.3)" },
  "Silver Frame":         { border: "2px solid #C0C0C0", boxShadow: "0 0 0 2px rgba(192,192,192,0.4), 0 0 12px rgba(192,192,192,0.3)" },
  "Платиновая рамка":     { border: "2px solid #E5E4E2", boxShadow: "0 0 0 2px rgba(229,228,226,0.5), 0 0 18px rgba(229,228,226,0.4)" },
  "Platinum Frame":       { border: "2px solid #E5E4E2", boxShadow: "0 0 0 2px rgba(229,228,226,0.5), 0 0 18px rgba(229,228,226,0.4)" },
  "Неоновая рамка":       { border: "2px solid #00FF9D", boxShadow: "0 0 0 2px rgba(0,255,157,0.5), 0 0 20px rgba(0,255,157,0.4)" },
  "Neon Frame":           { border: "2px solid #00FF9D", boxShadow: "0 0 0 2px rgba(0,255,157,0.5), 0 0 20px rgba(0,255,157,0.4)" },
  "Хрустальная рамка":    { border: "2px solid #64C8FF", boxShadow: "0 0 0 2px rgba(100,200,255,0.5), 0 0 20px rgba(100,200,255,0.35)" },
  "Crystal Frame":        { border: "2px solid #64C8FF", boxShadow: "0 0 0 2px rgba(100,200,255,0.5), 0 0 20px rgba(100,200,255,0.35)" },
  "Командирская рамка":   { border: "2px solid #FF4D6A", boxShadow: "0 0 0 2px rgba(255,77,106,0.5), 0 0 20px rgba(255,77,106,0.4)" },
  "Commander Frame":      { border: "2px solid #FF4D6A", boxShadow: "0 0 0 2px rgba(255,77,106,0.5), 0 0 20px rgba(255,77,106,0.4)" },
  "Чемпионская рамка":    { border: "3px solid #FFD700", boxShadow: "0 0 0 3px rgba(255,215,0,0.6), 0 0 30px rgba(255,215,0,0.5), 0 0 60px rgba(255,215,0,0.2)" },
  "Champion Frame":       { border: "3px solid #FFD700", boxShadow: "0 0 0 3px rgba(255,215,0,0.6), 0 0 30px rgba(255,215,0,0.5), 0 0 60px rgba(255,215,0,0.2)" },
};

/** Хук: получить стиль доски из экипированного BOARD_SKIN */
export function useEquippedBoardColors(): BoardSkin {
  const user = useUserStore((s) => s.user);
  const skin = user?.equippedItems?.BOARD_SKIN;
  // Default — фирменная доска ChessCoin
  if (!skin) return BOARD_SKIN_COLORS["ChessCoin"]!;
  return BOARD_SKIN_COLORS[skin.name] ?? BOARD_SKIN_COLORS["ChessCoin"]!;
}

/** Хук: получить CSS filter для фигур из экипированного PIECE_SKIN */
export function useEquippedPieceFilter(): string {
  const user = useUserStore((s) => s.user);
  const skin = user?.equippedItems?.PIECE_SKIN;
  if (!skin) return "drop-shadow(0 1px 3px rgba(0,0,0,0.3))";
  const customFilter = PIECE_SKIN_FILTER[skin.name];
  if (!customFilter || customFilter === "none") {
    return "drop-shadow(0 1px 3px rgba(0,0,0,0.3))";
  }
  return customFilter + " drop-shadow(0 1px 2px rgba(0,0,0,0.2))";
}

/** Хук: получить стиль рамки аватара из AVATAR_FRAME */
export function useEquippedAvatarFrame(): { border: string; boxShadow: string } | null {
  const user = useUserStore((s) => s.user);
  const frame = user?.equippedItems?.AVATAR_FRAME;
  if (!frame) return null;
  return AVATAR_FRAME_STYLE[frame.name] ?? null;
}

// ── Анимации ходов ────────────────────────────────────────────────────────────
export const MOVE_ANIMATION_CONFIG: Record<string, { duration: number; className: string }> = {
  // MOVE_ANIMATION items
  'Молния':  { duration: 80,  className: '' },
  'Lightning': { duration: 80, className: '' },
  'Звёзды':  { duration: 150, className: 'piece-slide' },
  'Stars':   { duration: 150, className: 'piece-slide' },
  'Огонь':   { duration: 220, className: 'piece-bounce' },
  'Fire':    { duration: 220, className: 'piece-bounce' },
  'Лёд':     { duration: 180, className: 'piece-slide' },
  'Ice':     { duration: 180, className: 'piece-slide' },
  'Взрыв':   { duration: 250, className: 'piece-bounce' },
  'Explosion': { duration: 250, className: 'piece-bounce' },
  'Дым':     { duration: 200, className: 'piece-fade' },
  'Smoke':   { duration: 200, className: 'piece-fade' },
  'Радуга':  { duration: 200, className: 'piece-slide' },
  'Rainbow': { duration: 200, className: 'piece-slide' },
  'Матрица': { duration: 150, className: 'piece-fade' },
  'Matrix':  { duration: 150, className: 'piece-fade' },
  'Портал':  { duration: 350, className: 'piece-teleport' },
  'Portal':  { duration: 350, className: 'piece-teleport' },
  'Гром':    { duration: 100, className: 'piece-bounce' },
  'Thunder': { duration: 100, className: 'piece-bounce' },
};

/** Пути к наборам SVG фигур */
export const PIECE_SET_PATH: Record<string, string> = {
  "ChessCoin Original": "pieces",
  "Classic (Lichess)":  "pieces/cburnett",
  "Flat Minimal":       "pieces/flat",
  "Glossy 3D":          "pieces/glossy",
  "Neon Glow":          "pieces/neon",
  "Crystal Glass":      "pieces/crystal",
  "Emoji Fun":          "emoji",   // специальный режим
};

/** Emoji для набора Emoji Fun */
export const EMOJI_PIECES: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

/** Хук: получить путь к набору фигур */
export function useEquippedPieceSet(): { path: string; isEmoji: boolean } {
  const user = useUserStore((s) => s.user);
  const set = user?.equippedItems?.PIECE_SET;
  if (!set) return { path: "pieces", isEmoji: false };
  const path = PIECE_SET_PATH[set.name] ?? "pieces";
  return { path, isEmoji: path === "emoji" };
}


export function useEquippedMoveAnimation(): { duration: number; className: string } {
  const user = useUserStore((s) => s.user);
  const anim = user?.equippedItems?.MOVE_ANIMATION;
  if (!anim) return { duration: 150, className: 'piece-slide' };
  return MOVE_ANIMATION_CONFIG[anim.name] ?? { duration: 150, className: 'piece-slide' };
}

// ── Анимации победы (WIN_ANIMATION) ──────────────────────────────────────────
export const WIN_ANIMATION_CONFIG: Record<string, { label: string; emoji: string; duration: number }> = {
  'Конфетти':  { label: 'confetti',   emoji: '🎊', duration: 3000 },
  'Confetti':  { label: 'confetti',   emoji: '🎊', duration: 3000 },
  'Салют':     { label: 'fireworks',  emoji: '🎆', duration: 3500 },
  'Fireworks': { label: 'fireworks',  emoji: '🎆', duration: 3500 },
  'Взрыв':     { label: 'explosion',  emoji: '💥', duration: 2500 },
  'Explosion': { label: 'explosion',  emoji: '💥', duration: 2500 },
  'Молния':    { label: 'lightning',  emoji: '⚡', duration: 2000 },
  'Lightning': { label: 'lightning',  emoji: '⚡', duration: 2000 },
  'Дракон':    { label: 'dragon',     emoji: '🐉', duration: 4000 },
  'Dragon':    { label: 'dragon',     emoji: '🐉', duration: 4000 },
};

// ── Эффекты взятия (CAPTURE_EFFECT) ──────────────────────────────────────────
export const CAPTURE_EFFECT_CONFIG: Record<string, { label: string; emoji: string }> = {
  'Взятие: Огонь':    { label: 'fire',    emoji: '🔥' },
  'Capture: Fire':    { label: 'fire',    emoji: '🔥' },
  'Взятие: Лёд':     { label: 'ice',     emoji: '❄️' },
  'Capture: Ice':     { label: 'ice',     emoji: '❄️' },
  'Взятие: Призрак':  { label: 'ghost',   emoji: '👻' },
  'Capture: Ghost':   { label: 'ghost',   emoji: '👻' },
  'Взятие: Молния':   { label: 'thunder', emoji: '⚡' },
  'Capture: Thunder': { label: 'thunder', emoji: '⚡' },
};

/** Хук: получить настройку WIN_ANIMATION */
export function useEquippedWinAnimation(): { label: string; emoji: string; duration: number } | null {
  const user = useUserStore((s) => s.user);
  const anim = user?.equippedItems?.WIN_ANIMATION;
  if (!anim) return null;
  return WIN_ANIMATION_CONFIG[anim.name] ?? null;
}

/** Хук: получить настройку CAPTURE_EFFECT */
export function useEquippedCaptureEffect(): { label: string; emoji: string } | null {
  const user = useUserStore((s) => s.user);
  const effect = user?.equippedItems?.CAPTURE_EFFECT;
  if (!effect) return null;
  return CAPTURE_EFFECT_CONFIG[effect.name] ?? null;
}
