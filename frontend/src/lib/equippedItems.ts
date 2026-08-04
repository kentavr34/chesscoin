import type { User } from '@/types'; // R1
/**
 * equippedItems.ts
 * Utilities for getting equipped items from user store.
 * Used in ChessBoard, Avatar, and other components.
 */

import { useUserStore } from "@/store/useUserStore";

// Board settings map for BOARD_SKIN
// Extended type for boards — supports CSS gradients and effects
export interface BoardSkin {
  light: string;   // CSS background (color or gradient)
  dark: string;    // CSS background (color or gradient)
  border?: string; // border between cells
}

export const BOARD_SKIN_COLORS: Record<string, BoardSkin> = {
  // ── Premium Oak (default) — дубовый паркетный стиль для Premium Dark ──
  "Premium Oak":     { light: "#DEB887", dark: "#8B4513" },

  // ── Original ChessCoin ──────────────────────────────────────────────────
  "ChessCoin":       { light: "radial-gradient(circle at 45% 35%, #EDF1FB, #E8EDF9)", dark: "radial-gradient(circle at 45% 35%, #96A8DC, #8B9DD4)" },

  // ── Classic wooden ────────────────────────────────────────────────
  "Classic":         { light: "#F0D9B5", dark: "#B58863" },
  "Classic Wood":    { light: "#F0D9B5", dark: "#B58863" },
  "Dark Walnut":     { light: "#C8A96E", dark: "#5C3A1E" },
  "Dark Wood":       { light: "#C8A96E", dark: "#5C3A1E" },

  // ── Stone/mineral ─────────────────────────────────────────────────────────
  "Marble":          { light: "#E8E0D8", dark: "#8C7B6B" },
  "Blue Marble":     { light: "#DEE7F0", dark: "#7FA7C4" },
  "Malachite":       { light: "#A8D5A2", dark: "#3A7A34" },
  "Black Marble":    { light: "linear-gradient(135deg, #E0E0E0, #D0D0D0)", dark: "linear-gradient(135deg, #424242, #333333)" },

  // ── Natural ──────────────────────────────────────────────────────────────
  "Gold":            { light: "#F5E6A0", dark: "#C8960A" },
  "Ice":             { light: "linear-gradient(135deg, #E8F4FD, #D8EEF8)", dark: "linear-gradient(135deg, #4FC3F7, #6090B8)" },
  "Crystal Ice":     { light: "linear-gradient(135deg, #E8F4FD, #D8EEF8)", dark: "linear-gradient(135deg, #4FC3F7, #6090B8)" },
  "Desert":          { light: "#EDD5A3", dark: "#B8860B" },
  "Emerald":         { light: "#C8E6C9", dark: "#2E7D32" },
  "Rose Gold":       { light: "#F8E0E6", dark: "#C2185B" },

  // ── Dark ────────────────────────────────────────────────────────────────
  "Night":           { light: "#1C1C2E", dark: "#0D0D1A" },
  "Dark Obsidian":   { light: "#2A2A3E", dark: "#1A1A2A" },

  // ── Textured/special effects ─────────────────────────────────────────────────
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
  "Cyber":           { light: "#141428", dark: "#0A0A1E" },
};

// Color filters for PIECE_SKIN
export const PIECE_SKIN_FILTER: Record<string, string> = {
  "Standard":            "none",
  "Gold Pieces":         "sepia(1) saturate(4) hue-rotate(5deg) brightness(1.1)",
  // В магазине этот стиль называется «Golden pieces», а не «Gold Pieces» —
  // одним регистром тут не обойтись, слово другое.
  "Golden Pieces":       "sepia(1) saturate(4) hue-rotate(5deg) brightness(1.1)",
  "Legend Gold":         "sepia(1) saturate(5) hue-rotate(2deg) brightness(1.15) contrast(1.05)",
  "Crystal Pieces":      "brightness(1.3) saturate(0.3) hue-rotate(180deg)",
  "Silver Pieces":       "grayscale(1) brightness(1.4) contrast(1.1)",
  "Bronze Pieces":       "sepia(0.8) saturate(2) brightness(0.9)",
  "Shadow Pieces":       "invert(0.85) brightness(0.6)",
  "Neon Pieces":         "brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(80deg)",
  "Pixel Pieces":        "none",
  "Anime Pieces":        "saturate(1.5) brightness(1.1)",
};

// Avatar frame colors for AVATAR_FRAME
/**
 * Поиск настройки по названию предмета.
 *
 * Названия в магазине заводились людьми и не совпадают с ключами по регистру:
 * в базе «Silver pieces», в таблице «Silver Pieces». Точное сравнение молча
 * не находило совпадения, и купленный стиль фигур просто ничего не менял —
 * девять из десяти (проверено 03.08.2026). Поэтому сначала точное совпадение,
 * потом без учёта регистра.
 */
/** Код из названия по тому же правилу, что и в базе: миграция 20260805_item_codes. */
const slug = (x: string) =>
  x.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

function pick<T>(table: Record<string, T>, name?: string | null, code?: string | null): T | undefined {
  // КОД — основной путь: он неизменен, не переводится и не зависит от регистра.
  // Ключи таблиц — человеческие названия, поэтому сводим их к коду тем же
  // правилом, что и база. Раньше искали только по названию, и расхождение в
  // одну заглавную букву («Silver pieces» против «Silver Pieces») молча
  // отключало купленный стиль: девять из десяти не работали (Кенан 05.08.2026).
  if (code) {
    const direct = table[code];
    if (direct !== undefined) return direct;
    const wantedCode = slug(code);
    for (const key of Object.keys(table)) {
      if (slug(key) === wantedCode) return table[key];
    }
  }
  // Название — запасной путь для записей, у которых кода ещё нет.
  if (!name) return undefined;
  const exact = table[name];
  if (exact !== undefined) return exact;
  const wanted = name.trim().toLowerCase();
  for (const key of Object.keys(table)) {
    if (key.trim().toLowerCase() === wanted) return table[key];
  }
  return undefined;
}

/**
 * Рамки аватара — свечение, а не обводка.
 *
 * Кенан 30.07.2026: «рамка вокруг аватара практически не видна, поэтому
 * покупать её незачем. Нужна не тонкая линия, а свечение градиентом ~3 мм:
 * свет рассеивается наружу». Поэтому каждая рамка — три слоя тени: плотное
 * кольцо у края, мягкое свечение и широкий ореол вторым цветом. Два цвета
 * дают ощущение градиента, а не однотонной подсветки.
 */
const glow = (ring: string, mid: string, halo: string) => ({
  border: `2px solid ${ring}`,
  boxShadow: `0 0 0 3px ${mid}, 0 0 12px 4px ${mid}, 0 0 26px 11px ${halo}`,
});

export const AVATAR_FRAME_STYLE: Record<string, {
  border: string; boxShadow: string;
}> = {
  "Gold Frame":         glow("#F5C842", "rgba(245,200,66,.45)", "rgba(255,170,20,.28)"),
  "Golden Frame":       glow("#F5C842", "rgba(245,200,66,.45)", "rgba(255,170,20,.28)"),
  "Diamond Frame":      glow("#00D4FF", "rgba(0,212,255,.45)", "rgba(120,240,255,.3)"),
  "Fire Frame":         glow("#FF6B35", "rgba(255,107,53,.5)", "rgba(255,40,0,.3)"),
  "Legendary Frame ♟":  glow("#E040FB", "rgba(224,64,251,.5)", "rgba(120,60,255,.34)"),
  "Silver Frame":       glow("#C0C0C0", "rgba(192,192,192,.4)", "rgba(230,230,255,.24)"),
  "Platinum Frame":     glow("#E5E4E2", "rgba(229,228,226,.45)", "rgba(180,210,230,.26)"),
  "Neon Frame":         glow("#00FF9D", "rgba(0,255,157,.45)", "rgba(0,200,255,.3)"),
  "Crystal Frame":      glow("#64C8FF", "rgba(100,200,255,.45)", "rgba(180,140,255,.28)"),
  "Commander Frame":    glow("#FF4D6A", "rgba(255,77,106,.5)", "rgba(255,20,80,.3)"),
  "Champion Frame":     glow("#FFD700", "rgba(255,215,0,.55)", "rgba(255,120,0,.34)"),
};

/** Стиль рамки по названию — с тем же поиском, что и остальная косметика. */
export function frameStyleFor(name?: string | null, code?: string | null) {
  return pick(AVATAR_FRAME_STYLE, name, code) ?? null;
}



/** Hook: get board style from equipped BOARD_SKIN */
export function useEquippedBoardColors(): BoardSkin {
  const user = useUserStore((s) => s.user);
  const skin = user?.equippedItems?.BOARD_SKIN;
  // Default — Premium Oak (дубовый паркет для Premium Dark темы)
  if (!skin) return BOARD_SKIN_COLORS["Premium Oak"]!;
  return pick(BOARD_SKIN_COLORS, skin.name, skin.code) ?? BOARD_SKIN_COLORS["Premium Oak"]!;
}

/** Hook: get CSS filter for pieces from equipped PIECE_SKIN */
export function useEquippedPieceFilter(): string {
  const user = useUserStore((s) => s.user);
  const skin = user?.equippedItems?.PIECE_SKIN;
  if (!skin) return "drop-shadow(0 1px 3px rgba(0,0,0,0.3))";
  const customFilter = pick(PIECE_SKIN_FILTER, skin.name, skin.code);
  if (!customFilter || customFilter === "none") {
    return "drop-shadow(0 1px 3px rgba(0,0,0,0.3))";
  }
  return customFilter + " drop-shadow(0 1px 2px rgba(0,0,0,0.2))";
}

/** Hook: get avatar frame style from AVATAR_FRAME */
export function useEquippedAvatarFrame(): { border: string; boxShadow: string } | null {
  const user = useUserStore((s) => s.user);
  const frame = user?.equippedItems?.AVATAR_FRAME;
  if (!frame) return null;
  return pick(AVATAR_FRAME_STYLE, frame.name) ?? null;
}


/**
 * Формы клеток (B9, Кенан 30.07.2026: «формы ячеек как отдельное покупаемое
 * измерение»). Цвета доски, цвета фигур и формы фигур уже продавались, форм
 * клеток не было вовсе.
 *
 * Форма задаётся стилем самой клетки, поэтому работает с любым цветом доски:
 * купил ромбы — они станут ромбами и на мраморе, и на неоне.
 */
export const CELL_SHAPE_STYLE: Record<string, Record<string, string>> = {
  'Square Cells':     {},
  'Rounded Cells':    { borderRadius: '18%' },
  'Circle Cells':     { borderRadius: '50%', transform: 'scale(.92)' },
  'Diamond Cells':    { clipPath: 'polygon(50% 4%, 96% 50%, 50% 96%, 4% 50%)' },
  'Cut Corner Cells': { clipPath: 'polygon(22% 0, 100% 0, 100% 78%, 78% 100%, 0 100%, 0 22%)' },
};

/** Стиль формы клетки по названию надетого предмета. */
export function useEquippedCellShape(): Record<string, string> {
  const user = useUserStore((s) => s.user);
  const shape = user?.equippedItems?.CELL_SHAPE;
  if (!shape) return {};
  return pick(CELL_SHAPE_STYLE, shape.name, shape.code) ?? {};
}

// ── Move animations ────────────────────────────────────────────────────────────
export const MOVE_ANIMATION_CONFIG: Record<string, { duration: number; className: string }> = {
  // MOVE_ANIMATION items
  'Lightning': { duration: 80, className: '' },
  'Stars':   { duration: 150, className: 'piece-slide' },
  'Fire':    { duration: 220, className: 'piece-bounce' },
  'Ice':     { duration: 180, className: 'piece-slide' },
  'Explosion': { duration: 250, className: 'piece-bounce' },
  'Smoke':   { duration: 200, className: 'piece-fade' },
  'Rainbow': { duration: 200, className: 'piece-slide' },
  'Matrix':  { duration: 150, className: 'piece-fade' },
  'Portal':  { duration: 350, className: 'piece-teleport' },
  'Thunder': { duration: 100, className: 'piece-bounce' },
};

/** Paths to SVG piece sets */
export const PIECE_SET_PATH: Record<string, string> = {
  "ChessCoin Original": "pieces",
  "Classic (Lichess)":  "pieces/cburnett",
  "Flat Minimal":       "pieces/flat",
  "Glossy 3D":          "pieces/glossy",
  "Neon Glow":          "pieces/neon",
  "Crystal Glass":      "pieces/crystal",
  "Emoji Fun":          "emoji",   // special mode
};

/** Emoji for Emoji Fun set */
export const EMOJI_PIECES: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

/** Hook: get piece set path */
export function useEquippedPieceSet(): { path: string; isEmoji: boolean } {
  const user = useUserStore((s) => s.user);
  const set = user?.equippedItems?.PIECE_SET;
  if (!set) return { path: "pieces", isEmoji: false };
  const path = pick(PIECE_SET_PATH, set.name, set.code) ?? "pieces";
  return { path, isEmoji: path === "emoji" };
}


export function useEquippedMoveAnimation(): { duration: number; className: string } {
  const user = useUserStore((s) => s.user);
  const anim = user?.equippedItems?.MOVE_ANIMATION;
  if (!anim) return { duration: 150, className: 'piece-slide' };
  return pick(MOVE_ANIMATION_CONFIG, anim.name, anim.code) ?? { duration: 150, className: 'piece-slide' };
}

// ── Win animations (WIN_ANIMATION) ──────────────────────────────────────────
export const WIN_ANIMATION_CONFIG: Record<string, { label: string; emoji: string; duration: number }> = {
  'Confetti':  { label: 'confetti',   emoji: '🎊', duration: 3000 },
  'Fireworks': { label: 'fireworks',  emoji: '🎆', duration: 3500 },
  'Explosion': { label: 'explosion',  emoji: '💥', duration: 2500 },
  'Lightning': { label: 'lightning',  emoji: '⚡', duration: 2000 },
  'Dragon':    { label: 'dragon',     emoji: '🐉', duration: 4000 },
};

// ── Capture effects (CAPTURE_EFFECT) ──────────────────────────────────────────
export const CAPTURE_EFFECT_CONFIG: Record<string, { label: string; emoji: string }> = {
  'Capture: Fire':    { label: 'fire',    emoji: '🔥' },
  'Capture: Ice':     { label: 'ice',     emoji: '❄️' },
  'Capture: Ghost':   { label: 'ghost',   emoji: '👻' },
  'Capture: Thunder': { label: 'thunder', emoji: '⚡' },
};

/** Hook: get WIN_ANIMATION setting */
export function useEquippedWinAnimation(): { label: string; emoji: string; duration: number } | null {
  const user = useUserStore((s) => s.user);
  const anim = user?.equippedItems?.WIN_ANIMATION;
  if (!anim) return null;
  return WIN_ANIMATION_CONFIG[anim.name] ?? null;
}

/** Hook: get CAPTURE_EFFECT setting */
export function useEquippedCaptureEffect(): { label: string; emoji: string } | null {
  const user = useUserStore((s) => s.user);
  const effect = user?.equippedItems?.CAPTURE_EFFECT;
  if (!effect) return null;
  return CAPTURE_EFFECT_CONFIG[effect.name] ?? null;
}
