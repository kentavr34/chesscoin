/**
 * chessOpenings.ts — V3: Opening detection and special moves by PGN/FEN
 *
 * Analyzes position and returns opening name or special move.
 * Used for MoveAnnouncer announcements.
 */

import { Chess } from 'chess.js';

export interface MoveAnnouncement {
  text: string;        // "Ruy Lopez"
  subtext?: string;    // "Lopez Opening"
  type: 'opening' | 'special' | 'tactical';
}

// ── Openings by first moves (ECO-like database) ───────────────────────────────

const OPENINGS: Array<{ moves: string; name: string; sub?: string }> = [
  // e4 openings
  { moves: '1. e4 e5 2. Nf3 Nc6 3. Bb5', name: 'Ruy Lopez', sub: 'Lopez Opening' },
  { moves: '1. e4 e5 2. Nf3 Nc6 3. Bc4', name: 'Italian Game', sub: 'Classic Opening' },
  { moves: '1. e4 e5 2. Nf3 Nc6 3. d4',  name: 'Scotch Game', sub: 'Open Game' },
  { moves: '1. e4 e5 2. Nf3 Nf6',        name: 'Petrov\'s Defense', sub: 'Petrov\'s Defense' },
  { moves: '1. e4 e5 2. Nc3',            name: 'Vienna Game' },
  { moves: '1. e4 e5 2. f4',             name: 'King\'s Gambit', sub: '♔ Aggressive Attack' },
  { moves: '1. e4 c5',                   name: 'Sicilian Defense', sub: 'Main Opening' },
  { moves: '1. e4 e6',                   name: 'French Defense' },
  { moves: '1. e4 c6',                   name: 'Caro-Kann Defense' },
  { moves: '1. e4 d5 2. exd5 Qxd5',     name: 'Scandinavian Defense' },
  { moves: '1. e4 d5 2. exd5 Nf6',      name: 'Modern Scandinavian' },
  { moves: '1. e4 Nf6',                  name: 'Alekhine\'s Defense' },
  { moves: '1. e4 g6',                   name: 'Modern Defense' },
  { moves: '1. e4 d6',                   name: 'Pirc Defense' },
  // d4 openings
  { moves: '1. d4 d5 2. c4',            name: 'Queen\'s Gambit', sub: 'Classic Plan' },
  { moves: '1. d4 Nf6 2. c4 g6',        name: 'Gr\u00FCnfeld Defense' },
  { moves: '1. d4 Nf6 2. c4 e6',        name: 'Nimzo-Indian Defense' },
  { moves: '1. d4 Nf6 2. c4 c5',        name: 'Benoni Defense' },
  { moves: '1. d4 f5',                  name: 'Dutch Defense' },
  { moves: '1. d4 d5 2. Nf3 Nf6 3. e3', name: 'Queen\'s Gambit Declined' },
  // Flank openings
  { moves: '1. c4',                     name: 'English Opening' },
  { moves: '1. Nf3',                    name: 'R\u00E9ti Opening' },
  { moves: '1. b3',                     name: 'Nimzo-Larsen Attack' },
  { moves: '1. g3',                     name: 'Bird\'s Opening' },
  // Mate
  { moves: '1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7', name: 'Scholar\'s Mate', sub: 'Classic' },
];

// ── Special moves ──────────────────────────────────────────────────────────

export function detectSpecialMove(pgn: string, lastSan: string, lastFen: string): MoveAnnouncement | null {
  if (!lastSan) return null;

  // Checkmate
  if (lastSan.endsWith('#')) {
    return { text: 'CHECKMATE', subtext: '♔ Game over', type: 'special' };
  }

  // Check
  if (lastSan.endsWith('+')) {
    const checks = (pgn.match(/\+/g) ?? []).length;
    if (checks >= 3) return { text: 'Triple check', subtext: '⚡', type: 'tactical' };
    return null; // single check — no announcement (frequent)
  }

  // Castling
  if (lastSan === 'O-O') {
    return { text: 'Castling!', subtext: '♜ Kingside', type: 'special' };
  }
  if (lastSan === 'O-O-O') {
    return { text: 'Long castling', subtext: '♜ Queenside', type: 'special' };
  }

  // En passant
  if (lastSan.includes('e.p.') || (lastSan.includes('x') && lastSan.length <= 4 && pgn.includes('e.p.'))) {
    return { text: 'En passant', subtext: 'En passant', type: 'tactical' };
  }

  // Fork (N captures with check — attacks multiple pieces)
  if (lastSan.startsWith('N') && lastSan.endsWith('+')) {
    return { text: 'Fork!', subtext: '♞ Double attack', type: 'tactical' };
  }

  // Queen captures (aggressive move)
  if (lastSan.startsWith('Q') && lastSan.includes('x') && lastSan.endsWith('+')) {
    return { text: 'Queen sacrifice!', subtext: '♛ Attacking blow', type: 'tactical' };
  }

  return null;
}

// ── Opening detection by position ─────────────────────────────────────────────

export function detectOpening(pgn: string): MoveAnnouncement | null {
  if (!pgn || pgn.split(' ').length > 25) return null; // only first ~8 moves

  // Normalize PGN — remove move numbers
  const normalize = (s: string) => s.replace(/\d+\.\s*/g, '').replace(/\s+/g, ' ').trim();
  const normalPgn = normalize(pgn);

  for (const opening of OPENINGS) {
    const normalMoves = normalize(opening.moves);
    if (normalPgn.startsWith(normalMoves)) {
      // Show only on exact match (don't show repeatedly)
      const pgnMoveCount = normalPgn.split(' ').length;
      const openingMoveCount = normalMoves.split(' ').length;
      if (pgnMoveCount === openingMoveCount) {
        return {
          text: opening.name,
          subtext: opening.sub,
          type: 'opening',
        };
      }
    }
  }

  return null;
}

// ── Styles for special move animations ───────────────────────────────────────

export interface SpecialMoveStyle {
  color: string;
  shadow: string;
  animation: string;
}

export const SPECIAL_MOVE_STYLES: Record<string, SpecialMoveStyle> = {
  'Classic':   { color: '#F5C842',  shadow: '0 0 20px rgba(245,200,66,0.6)',  animation: 'fadeSlideUp' },
  'Neon':      { color: '#00FF9D',  shadow: '0 0 30px rgba(0,255,157,0.8), 0 0 60px rgba(0,255,157,0.4)', animation: 'neonFlicker' },
  'Fire':      { color: '#FF6B35',  shadow: '0 0 25px rgba(255,107,53,0.8)',  animation: 'fireShake' },
  'Ice':       { color: '#64C8FF',  shadow: '0 0 25px rgba(100,200,255,0.8)', animation: 'iceFreeze' },
  'Gold':      { color: '#FFD700',  shadow: '0 0 30px rgba(255,215,0,0.9)',   animation: 'goldShine' },
  'Matrix':    { color: '#00FF00',  shadow: '0 0 20px rgba(0,255,0,0.7)',     animation: 'matrixGlitch' },
  'Blood':     { color: '#FF1744',  shadow: '0 0 25px rgba(255,23,68,0.8)',   animation: 'bloodDrip' },
  'Galaxy':    { color: '#9B85FF',  shadow: '0 0 30px rgba(155,133,255,0.8)', animation: 'galaxySpin' },
  'Rainbow':   { color: 'transparent', shadow: '0 0 20px rgba(255,255,255,0.4)', animation: 'rainbowShift' },
  'Ghost':     { color: 'rgba(200,200,255,0.9)', shadow: '0 0 40px rgba(200,200,255,0.5)', animation: 'ghostFade' },
  'Lightning': { color: '#FFEB3B',  shadow: '0 0 40px rgba(255,235,59,0.9), 0 0 80px rgba(255,235,59,0.5)', animation: 'lightningStrike' },
  'Thunder':   { color: '#FFEB3B',  shadow: '0 0 40px rgba(255,235,59,0.9)', animation: 'lightningStrike' },
  'Dragon':    { color: '#FF6B00',  shadow: '0 0 40px rgba(255,107,0,0.9), 0 0 80px rgba(255,0,0,0.4)', animation: 'dragonBurn' },
};

export const DEFAULT_STYLE: SpecialMoveStyle = {
  color: 'rgba(255,255,255,0.85)',
  shadow: '0 2px 20px rgba(0,0,0,0.8)',
  animation: 'fadeSlideUp',
};
