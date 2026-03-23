import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PromotionModal } from '@/components/ui/PromotionModal'; // V1
import { haptic } from '@/lib/haptic';
import { useEquippedBoardColors, useEquippedPieceFilter, useEquippedMoveAnimation, useEquippedPieceSet, EMOJI_PIECES } from '@/lib/equippedItems';
import { sound } from '@/lib/sound';
import { Chessboard } from 'react-chessboard';
import { Chess, Square, PieceSymbol } from 'chess.js';
import type { Piece as RCBPiece } from 'react-chessboard/dist/chessboard/types';

// ── Имена файлов SVG для каждого кода фигуры ─────────────────────────────────
const PIECE_FILE: Record<string, string> = {
  wP: 'white-pawn',   wN: 'white-knight', wB: 'white-bishop',
  wR: 'white-rook',   wQ: 'white-queen',  wK: 'white-king',
  bP: 'black-pawn',   bN: 'black-knight', bB: 'black-bishop',
  bR: 'black-rook',   bQ: 'black-queen',  bK: 'black-king',
};

// ── Хелпер: динамический URL к SVG ───────────────────────────────────────────
function makePieceUrl(setPath: string, fileName: string): string {
  try {
    return new URL(`../../assets/${setPath}/${fileName}.svg`, import.meta.url).href;
  } catch {
    // fallback на дефолтные фигуры
    return new URL(`../../assets/pieces/${fileName}.svg`, import.meta.url).href;
  }
}

// ── Цвета подсветки ───────────────────────────────────────────────────────────
const SELECTED_BG  = 'rgba(123,97,255,0.45)';
const MOVE_BG      = 'radial-gradient(circle, rgba(123,97,255,0.55) 22%, transparent 22%)';
const CAPTURE_BG   = 'radial-gradient(circle, rgba(255,77,106,0.5) 100%, transparent 100%)';
const LAST_MOVE_BG = 'rgba(245,200,66,0.18)';

// ── Props ─────────────────────────────────────────────────────────────────────
interface ChessBoardProps {
  fen: string;
  orientation: 'white' | 'black';
  isMyTurn: boolean;
  isGameOver: boolean;
  onMove: (from: Square, to: Square, promotion?: string) => void;
  onCapture?: (piece: PieceSymbol) => void;
  lastMove?: { from: string; to: string } | null;
  // S3: скины из сессии (создатель батла — видны обоим)
  sessionBoardSkinUrl?: string | null;
  sessionPieceSkinUrl?: string | null;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  fen,
  orientation,
  isMyTurn,
  isGameOver,
  onMove,
  onCapture,
  lastMove,
  sessionBoardSkinUrl,
  sessionPieceSkinUrl,
}) => {
  const boardColors  = useEquippedBoardColors();
  const pieceFilter  = useEquippedPieceFilter();
  // S3: скины сессии перекрывают личные скины (матчим по BOARD_KNOWN из ShopItemCards)
  const effectiveBoardColors = (() => {
    if (!sessionBoardSkinUrl) return boardColors;
    // Если URL содержит название скина — матчим по ключевым словам
    const url = sessionBoardSkinUrl.toLowerCase();
    if (url.includes('classic')   || url.includes('классика')) return { light: '#F0D9B5', dark: '#B58863' };
    if (url.includes('marble')    || url.includes('мрамор'))   return { light: '#E8E0D8', dark: '#8C7B6B' };
    if (url.includes('gold')      || url.includes('золото'))   return { light: '#F5E6A0', dark: '#C8960A' };
    if (url.includes('night')     || url.includes('ночь'))     return { light: '#1C1C2E', dark: '#0D0D1A' };
    if (url.includes('malachit')  || url.includes('малахит'))  return { light: '#A8D5A2', dark: '#3A7A34' };
    if (url.includes('neon')      || url.includes('неон'))     return { light: '#0D1F2D', dark: '#071520' };
    if (url.includes('ice')       || url.includes('лёд'))      return { light: '#D8EEF8', dark: '#6090B8' };
    if (url.includes('cyber')     || url.includes('кибер'))    return { light: '#0A0A1A', dark: '#050510' };
    // Fallback: личный скин игрока
    return boardColors;
  })();
  const effectivePieceFilter = sessionPieceSkinUrl
    ? (() => {
        const url = sessionPieceSkinUrl.toLowerCase();
        if (url.includes('gold')   || url.includes('золот')) return 'sepia(1) saturate(4) hue-rotate(5deg) brightness(1.1)';
        if (url.includes('silver') || url.includes('серебр')) return 'grayscale(1) brightness(1.4)';
        if (url.includes('neon')   || url.includes('неон'))   return 'brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(80deg)';
        if (url.includes('crystal')|| url.includes('кристал')) return 'brightness(1.3) saturate(0.3) hue-rotate(180deg)';
        return pieceFilter;
      })()
    : pieceFilter;
  const moveAnim     = useEquippedMoveAnimation();
  const pieceSet     = useEquippedPieceSet();

  // Динамические фигуры — меняются при смене набора
  const CUSTOM_PIECES = useMemo(() => {
    const pieces: Record<string, React.FC<{ squareWidth: number }>> = {};
    Object.entries(PIECE_FILE).forEach(([code, fileName]) => {
      if (pieceSet.isEmoji) {
        // Emoji режим — Unicode символы
        const emoji = EMOJI_PIECES[code] ?? '?';
        pieces[code] = ({ squareWidth }) => (
          <div style={{
            width: squareWidth, height: squareWidth,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: squareWidth * 0.72,
              lineHeight: 1,
              textShadow: '0 1px 3px rgba(0,0,0,0.4)',
              userSelect: 'none',
            }}>{emoji}</span>
          </div>
        );
      } else {
        // SVG режим — динамический путь
        const url = makePieceUrl(pieceSet.path, fileName);
        pieces[code] = ({ squareWidth }) => (
          <div style={{
            width: squareWidth, height: squareWidth,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: squareWidth * 0.055,
          }}>
            <img
              src={url}
              alt={code}
              style={{
                width: '100%', height: '100%',
                objectFit: 'contain',
                filter: 'var(--piece-filter, drop-shadow(0 1px 3px rgba(0,0,0,0.3)))',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
              draggable={false}
            />
          </div>
        );
      }
    });
    return pieces;
  }, [pieceSet.path, pieceSet.isEmoji]);
  const [selected, setSelected]  = useState<Square | null>(null);
  const [optionSqs, setOptionSqs] = useState<Record<string, React.CSSProperties>>({});
  const [localFen, setLocalFen]   = useState(fen);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);

  // Применяем filter фигур через CSS переменную
  useEffect(() => {
    document.documentElement.style.setProperty('--piece-filter', effectivePieceFilter);
  }, [pieceFilter]);

  // Применяем класс анимации фигур через CSS переменную
  useEffect(() => {
    document.documentElement.style.setProperty('--piece-anim-class', moveAnim.className || 'piece-slide');
  }, [moveAnim.className]);

  // Синхронизируем FEN с сервером
  useEffect(() => { setLocalFen(fen); }, [fen]);

  // Подсветка возможных ходов
  const showOptions = (sq: Square, chess: Chess) => {
    const moves = chess.moves({ square: sq, verbose: true });
    if (!moves.length) { setOptionSqs({}); return; }

    const sqs: Record<string, React.CSSProperties> = {};
    sqs[sq] = { background: SELECTED_BG };
    moves.forEach((m) => {
      const isCapture = !!chess.get(m.to) &&
        chess.get(m.to)!.color !== chess.get(sq)!.color;
      sqs[m.to] = { background: isCapture ? CAPTURE_BG : MOVE_BG };
    });
    setOptionSqs(sqs);
  };

  // Подсветка последнего хода
  const lastMoveSqs: Record<string, React.CSSProperties> = {};
  if (lastMove) {
    lastMoveSqs[lastMove.from] = { background: LAST_MOVE_BG };
    lastMoveSqs[lastMove.to]   = { background: LAST_MOVE_BG };
  }

  const mergedSqs = { ...lastMoveSqs, ...optionSqs };

  // ── Обработчик клика по клетке (основное управление — тап) ──────────────────
  const handleSquareClick = useCallback((sq: Square, piece?: RCBPiece) => {
    if (!isMyTurn || isGameOver) return;

    const chess = new Chess(localFen);
    const myColor = orientation[0]; // 'w' или 'b'

    // Уже выбрана фигура — пытаемся сделать ход
    if (selected) {
      if (selected === sq) {
        // Повторный тап — снимаем выбор
        setSelected(null);
        setOptionSqs({});
        return;
      }

      // Пробуем сходить
      try {
        // V1: Проверяем промоцию ДО хода — если пешка идёт на последнюю горизонталь
        const testMove = chess.move({ from: selected, to: sq, promotion: 'q' });
        const isPromotion = testMove.flags.includes('p');
        chess.undo(); // откатываем тестовый ход

        if (isPromotion) {
          // Показываем диалог выбора фигуры
          setSelected(null);
          setOptionSqs({});
          setPendingPromotion({ from: selected, to: sq });
          return;
        }

        // Обычный ход
        const move = chess.move({ from: selected, to: sq, promotion: 'q' });
        setSelected(null);
        setOptionSqs({});
        setLocalFen(chess.fen());
        if (move.flags.includes('k') || move.flags.includes('q')) {
          haptic.move();
          sound.castle();
        } else if (move.captured) {
          haptic.capture();
          sound.capture();
          onCapture?.(move.captured as PieceSymbol);
        } else {
          haptic.move();
          sound.move();
        }
        if (chess.inCheck()) {
          haptic.check();
          sound.check();
        }
        onMove(selected, sq, move.promotion ?? undefined);
        return;
      } catch {
        // Ход невалидный — может быть выбирают другую свою фигуру
      }
    }

    // Выбираем свою фигуру
    if (piece && piece[0] === myColor) {
      haptic.selection();
      setSelected(sq);
      showOptions(sq, chess);
    } else {
      setSelected(null);
      setOptionSqs({});
    }
  }, [isMyTurn, isGameOver, localFen, orientation, onMove, onCapture, selected]);

  // ── Drag & drop (дополнительно к тапам) ─────────────────────────────────────
  const handlePieceDrop = useCallback((from: string, to: string): boolean => {
    if (!isMyTurn || isGameOver) return false;
    const chess = new Chess(localFen);
    try {
      // V1: проверяем промоцию при drag
      const testMove = chess.move({ from, to, promotion: 'q' });
      const isPromotion = testMove.flags.includes('p');
      chess.undo();

      if (isPromotion) {
        setPendingPromotion({ from: from as Square, to: to as Square });
        setSelected(null);
        setOptionSqs({});
        return true; // принимаем drop, покажем диалог
      }

      const move = chess.move({ from, to, promotion: 'q' });
      setSelected(null);
      setOptionSqs({});
      setLocalFen(chess.fen());
      if (move.flags.includes('k') || move.flags.includes('q')) {
        haptic.move();
        sound.castle();
      } else if (move.captured) {
        haptic.capture();
        sound.capture();
        onCapture?.(move.captured as PieceSymbol);
      } else {
        haptic.move();
        sound.move();
      }
      if (chess.inCheck()) {
        haptic.check();
        sound.check();
      }
      onMove(from as Square, to as Square, move.promotion ?? undefined);
      return true;
    } catch {
      return false;
    }
  }, [isMyTurn, isGameOver, localFen, onMove, onCapture]);

  const handleDragBegin = useCallback((_: RCBPiece, sq: Square) => {
    if (!isMyTurn || isGameOver) return;
    const chess = new Chess(localFen);
    setSelected(sq);
    showOptions(sq, chess);
  }, [isMyTurn, isGameOver, localFen]);

  // V1: Обработчик выбора фигуры промоции
  const handlePromotionSelect = useCallback((piece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    const chess = new Chess(localFen);
    try {
      const move = chess.move({ from, to, promotion: piece });
      setLocalFen(chess.fen());
      haptic.impact('medium');
      sound.promote();
      if (chess.inCheck()) {
        haptic.check();
        sound.check();
      }
      onMove(from, to, piece);
    } catch {
      // невалидный ход (маловероятно)
    }
    setPendingPromotion(null);
  }, [pendingPromotion, localFen, onMove]);

  return (
    <>
      <div style={{
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}>
        <Chessboard
          position={localFen}
          boardOrientation={orientation}
          onSquareClick={handleSquareClick}
          onPieceDrop={handlePieceDrop}
          onPieceDragBegin={handleDragBegin}
          onPieceDragEnd={() => { setSelected(null); setOptionSqs({}); }}
          arePiecesDraggable={isMyTurn && !isGameOver}
          arePremovesAllowed={false}
          customPieces={CUSTOM_PIECES}
          customBoardStyle={{ borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
          showBoardNotation={true}
          customLightSquareStyle={{
            background: effectiveBoardColors.light,
            ...(effectiveBoardColors.border ? { outline: effectiveBoardColors.border, outlineOffset: '-1px' } : {}),
          }}
          customDarkSquareStyle={{
            background: effectiveBoardColors.dark,
            ...(effectiveBoardColors.border ? { outline: effectiveBoardColors.border, outlineOffset: '-1px' } : {}),
          }}
          customSquareStyles={mergedSqs}
          animationDuration={moveAnim.duration}
        />
      </div>
      {/* V1: Диалог промоции */}
      {pendingPromotion && (
        <PromotionModal
          color={orientation}
          onSelect={handlePromotionSelect}
        />
      )}
    </>
  );
};
