/**
 * chessOpenings.ts — V3: Определение дебютов и спецходов по PGN/FEN
 *
 * Анализирует позицию и возвращает название дебюта или спецхода.
 * Используется для объявлений MoveAnnouncer.
 */

import { Chess } from 'chess.js';

export interface MoveAnnouncement {
  text: string;        // "Испанская партия"
  subtext?: string;    // "Начало дебюта"
  type: 'opening' | 'special' | 'tactical';
}

// ── Дебюты по первым ходам (ECO-подобная база) ───────────────────────────────

const OPENINGS: Array<{ moves: string; name: string; sub?: string }> = [
  // e4 дебюты
  { moves: '1. e4 e5 2. Nf3 Nc6 3. Bb5', name: 'Испанская партия', sub: 'Дебют Рюи Лопеса' },
  { moves: '1. e4 e5 2. Nf3 Nc6 3. Bc4', name: 'Итальянская партия', sub: 'Классический дебют' },
  { moves: '1. e4 e5 2. Nf3 Nc6 3. d4',  name: 'Шотландская партия', sub: 'Открытая игра' },
  { moves: '1. e4 e5 2. Nf3 Nf6',        name: 'Русская защита', sub: 'Защита Петрова' },
  { moves: '1. e4 e5 2. Nc3',            name: 'Венская партия' },
  { moves: '1. e4 e5 2. f4',             name: 'Королевский гамбит', sub: '♔ Агрессивная атака' },
  { moves: '1. e4 c5',                   name: 'Сицилианская защита', sub: 'Главный дебют' },
  { moves: '1. e4 e6',                   name: 'Французская защита' },
  { moves: '1. e4 c6',                   name: 'Защита Каро-Канн' },
  { moves: '1. e4 d5 2. exd5 Qxd5',     name: 'Скандинавская защита' },
  { moves: '1. e4 d5 2. exd5 Nf6',      name: 'Современная скандинавская' },
  { moves: '1. e4 Nf6',                  name: 'Защита Алёхина' },
  { moves: '1. e4 g6',                   name: 'Современная защита' },
  { moves: '1. e4 d6',                   name: 'Защита Пирца' },
  // d4 дебюты
  { moves: '1. d4 d5 2. c4',            name: 'Ферзевый гамбит', sub: 'Классический план' },
  { moves: '1. d4 Nf6 2. c4 g6',        name: 'Защита Грюнфельда' },
  { moves: '1. d4 Nf6 2. c4 e6',        name: 'Защита Нимцовича' },
  { moves: '1. d4 Nf6 2. c4 c5',        name: 'Защита Бенони' },
  { moves: '1. d4 f5',                  name: 'Нидерландская защита' },
  { moves: '1. d4 d5 2. Nf3 Nf6 3. e3', name: 'Ферзевый гамбит отказанный' },
  // Фланговые дебюты
  { moves: '1. c4',                     name: 'Английское начало' },
  { moves: '1. Nf3',                    name: 'Начало Рети' },
  { moves: '1. b3',                     name: 'Дебют Нимцовича-Ларсена' },
  { moves: '1. g3',                     name: 'Дебют Бёрда' },
  // Мат
  { moves: '1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7', name: 'Детский мат', sub: '😈 Классика' },
];

// ── Специальные ходы ──────────────────────────────────────────────────────────

export function detectSpecialMove(pgn: string, lastSan: string, lastFen: string): MoveAnnouncement | null {
  if (!lastSan) return null;

  // Шах и мат
  if (lastSan.endsWith('#')) {
    return { text: 'ШАХ И МАТ', subtext: '♔ Партия завершена', type: 'special' };
  }

  // Шах
  if (lastSan.endsWith('+')) {
    const checks = (pgn.match(/\+/g) ?? []).length;
    if (checks >= 3) return { text: 'Тройной шах', subtext: '⚡', type: 'tactical' };
    return null; // одиночный шах — без объявления (частый)
  }

  // Рокировка
  if (lastSan === 'O-O') {
    return { text: 'Рокировка!', subtext: '♜ Короткая', type: 'special' };
  }
  if (lastSan === 'O-O-O') {
    return { text: 'Длинная рокировка', subtext: '♜ Ферзевый фланг', type: 'special' };
  }

  // Взятие на проходе
  if (lastSan.includes('e.p.') || (lastSan.includes('x') && lastSan.length <= 4 && pgn.includes('e.p.'))) {
    return { text: 'Взятие на проходе', subtext: 'En passant', type: 'tactical' };
  }

  // Вилка (N берёт с шахом — атакует несколько фигур)
  if (lastSan.startsWith('N') && lastSan.endsWith('+')) {
    return { text: 'Вилка!', subtext: '♞ Два удара', type: 'tactical' };
  }

  // Ферзь берёт (агрессивный ход)
  if (lastSan.startsWith('Q') && lastSan.includes('x') && lastSan.endsWith('+')) {
    return { text: 'Жертва ферзя!', subtext: '♛ Атакующий удар', type: 'tactical' };
  }

  return null;
}

// ── Определение дебюта по позиции ─────────────────────────────────────────────

export function detectOpening(pgn: string): MoveAnnouncement | null {
  if (!pgn || pgn.split(' ').length > 25) return null; // только первые ~8 ходов

  // Нормализуем PGN — убираем номера ходов
  const normalize = (s: string) => s.replace(/\d+\.\s*/g, '').replace(/\s+/g, ' ').trim();
  const normalPgn = normalize(pgn);

  for (const opening of OPENINGS) {
    const normalMoves = normalize(opening.moves);
    if (normalPgn.startsWith(normalMoves)) {
      // Показываем только при точном совпадении (не показываем повторно)
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

// ── Стили для разных анимаций спецходов ───────────────────────────────────────

export interface SpecialMoveStyle {
  color: string;
  shadow: string;
  animation: string;
}

export const SPECIAL_MOVE_STYLES: Record<string, SpecialMoveStyle> = {
  'Классик':   { color: '#F5C842',  shadow: '0 0 20px rgba(245,200,66,0.6)',  animation: 'fadeSlideUp' },
  'Classic':   { color: '#F5C842',  shadow: '0 0 20px rgba(245,200,66,0.6)',  animation: 'fadeSlideUp' },
  'Неон':      { color: '#00FF9D',  shadow: '0 0 30px rgba(0,255,157,0.8), 0 0 60px rgba(0,255,157,0.4)', animation: 'neonFlicker' },
  'Neon':      { color: '#00FF9D',  shadow: '0 0 30px rgba(0,255,157,0.8)',   animation: 'neonFlicker' },
  'Огонь':     { color: '#FF6B35',  shadow: '0 0 25px rgba(255,107,53,0.8)',  animation: 'fireShake' },
  'Fire':      { color: '#FF6B35',  shadow: '0 0 25px rgba(255,107,53,0.8)',  animation: 'fireShake' },
  'Лёд':       { color: '#64C8FF',  shadow: '0 0 25px rgba(100,200,255,0.8)', animation: 'iceFreeze' },
  'Ice':       { color: '#64C8FF',  shadow: '0 0 25px rgba(100,200,255,0.8)', animation: 'iceFreeze' },
  'Золото':    { color: '#FFD700',  shadow: '0 0 30px rgba(255,215,0,0.9)',   animation: 'goldShine' },
  'Gold':      { color: '#FFD700',  shadow: '0 0 30px rgba(255,215,0,0.9)',   animation: 'goldShine' },
  'Матрица':   { color: '#00FF00',  shadow: '0 0 20px rgba(0,255,0,0.7)',     animation: 'matrixGlitch' },
  'Matrix':    { color: '#00FF00',  shadow: '0 0 20px rgba(0,255,0,0.7)',     animation: 'matrixGlitch' },
  'Кровь':     { color: '#FF1744',  shadow: '0 0 25px rgba(255,23,68,0.8)',   animation: 'bloodDrip' },
  'Blood':     { color: '#FF1744',  shadow: '0 0 25px rgba(255,23,68,0.8)',   animation: 'bloodDrip' },
  'Галактика': { color: '#9B85FF',  shadow: '0 0 30px rgba(155,133,255,0.8)', animation: 'galaxySpin' },
  'Galaxy':    { color: '#9B85FF',  shadow: '0 0 30px rgba(155,133,255,0.8)', animation: 'galaxySpin' },
  'Радуга':    { color: 'transparent', shadow: '0 0 20px rgba(255,255,255,0.4)', animation: 'rainbowShift' },
  'Rainbow':   { color: 'transparent', shadow: '0 0 20px rgba(255,255,255,0.4)', animation: 'rainbowShift' },
  'Призрак':   { color: 'rgba(200,200,255,0.9)', shadow: '0 0 40px rgba(200,200,255,0.5)', animation: 'ghostFade' },
  'Ghost':     { color: 'rgba(200,200,255,0.9)', shadow: '0 0 40px rgba(200,200,255,0.5)', animation: 'ghostFade' },
  'Молния':    { color: '#FFEB3B',  shadow: '0 0 40px rgba(255,235,59,0.9), 0 0 80px rgba(255,235,59,0.5)', animation: 'lightningStrike' },
  'Thunder':   { color: '#FFEB3B',  shadow: '0 0 40px rgba(255,235,59,0.9)', animation: 'lightningStrike' },
  'Дракон':    { color: '#FF6B00',  shadow: '0 0 40px rgba(255,107,0,0.9), 0 0 80px rgba(255,0,0,0.4)', animation: 'dragonBurn' },
  'Dragon':    { color: '#FF6B00',  shadow: '0 0 40px rgba(255,107,0,0.9)',  animation: 'dragonBurn' },
};

export const DEFAULT_STYLE: SpecialMoveStyle = {
  color: 'rgba(255,255,255,0.85)',
  shadow: '0 2px 20px rgba(0,0,0,0.8)',
  animation: 'fadeSlideUp',
};
