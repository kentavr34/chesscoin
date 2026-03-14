import React, { useState, useEffect } from 'react';
import { haptic } from '@/lib/haptic';
import { sound } from '@/lib/sound';
import { Chessboard } from 'react-chessboard';
import { Chess, Square, PieceSymbol } from 'chess.js';
import type { Piece as RCBPiece } from 'react-chessboard/dist/chessboard/types';

// ── Кастомные SVG фигуры из v1 ───────────────────────────────────────────────
const pieceUrl = (name: string) =>
  new URL(`../../assets/pieces/${name}.svg`, import.meta.url).href;

const CUSTOM_PIECES: Record<string, React.FC<{ squareWidth: number }>> = {};
const PIECE_MAP: Record<string, string> = {
  wP: 'white-pawn',   wN: 'white-knight', wB: 'white-bishop',
  wR: 'white-rook',   wQ: 'white-queen',  wK: 'white-king',
  bP: 'black-pawn',   bN: 'black-knight', bB: 'black-bishop',
  bR: 'black-rook',   bQ: 'black-queen',  bK: 'black-king',
};

Object.entries(PIECE_MAP).forEach(([code, name]) => {
  CUSTOM_PIECES[code] = ({ squareWidth }) => (
    <div style={{
      width: squareWidth, height: squareWidth,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: squareWidth * 0.06,
    }}>
      <img
        src={pieceUrl(name)}
        alt={code}
        style={{
          width: '100%', height: '100%',
          objectFit: 'contain',
          // Эффект объёма: тень + highlight
          filter: `
            drop-shadow(0 2px 4px rgba(0,0,0,0.55))
            drop-shadow(0 1px 2px rgba(0,0,0,0.4))
          `,
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        draggable={false}
      />
    </div>
  );
});

// ── Цвета подсветки ───────────────────────────────────────────────────────────
const SELECTED_BG  = 'rgba(123,97,255,0.45)';   // фиолетовый — выбранная фигура
const MOVE_BG      = 'radial-gradient(circle, rgba(123,97,255,0.55) 22%, transparent 22%)';  // точка хода
const CAPTURE_BG   = 'radial-gradient(circle, rgba(255,77,106,0.5) 100%, transparent 100%)'; // захват
const LAST_MOVE_BG = 'rgba(245,200,66,0.18)';   // золотой — последний ход

// ── Props ─────────────────────────────────────────────────────────────────────
interface ChessBoardProps {
  fen: string;
  orientation: 'white' | 'black';
  isMyTurn: boolean;
  isGameOver: boolean;
  onMove: (from: Square, to: Square, promotion?: string) => void;
  onCapture?: (piece: PieceSymbol) => void;
  lastMove?: { from: string; to: string } | null;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  fen,
  orientation,
  isMyTurn,
  isGameOver,
  onMove,
  onCapture,
  lastMove,
}) => {
  const [selected, setSelected]  = useState<Square | null>(null);
  const [optionSqs, setOptionSqs] = useState<Record<string, React.CSSProperties>>({});
  const [localFen, setLocalFen]   = useState(fen);

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
  const handleSquareClick = (sq: Square, piece?: RCBPiece) => {
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
        const move = chess.move({ from: selected, to: sq, promotion: 'q' });
        setSelected(null);
        setOptionSqs({});
        setLocalFen(chess.fen());
        if (move.flags.includes('k') || move.flags.includes('q')) {
          // Castling
          haptic.move();
          sound.castle();
        } else if (move.flags.includes('p')) {
          // Promotion
          haptic.impact('medium');
          sound.promote();
        } else if (move.captured) {
          haptic.capture();
          sound.capture();
          onCapture?.(move.captured as PieceSymbol);
        } else {
          haptic.move();
          sound.move();
        }
        // Check — extra feedback
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
  };

  // ── Drag & drop (дополнительно к тапам) ─────────────────────────────────────
  const handlePieceDrop = (from: string, to: string): boolean => {
    if (!isMyTurn || isGameOver) return false;
    const chess = new Chess(localFen);
    try {
      const move = chess.move({ from, to, promotion: 'q' });
      setSelected(null);
      setOptionSqs({});
      setLocalFen(chess.fen());
      if (move.flags.includes('k') || move.flags.includes('q')) {
        haptic.move();
        sound.castle();
      } else if (move.flags.includes('p')) {
        haptic.impact('medium');
        sound.promote();
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
  };

  const handleDragBegin = (_: RCBPiece, sq: Square) => {
    if (!isMyTurn || isGameOver) return;
    const chess = new Chess(localFen);
    setSelected(sq);
    showOptions(sq, chess);
  };

  return (
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
        customBoardStyle={{ borderRadius: 12 }}
        customLightSquareStyle={{ backgroundColor: '#E8EDF9' }}
        customDarkSquareStyle={{ backgroundColor: '#B7C0D8' }}
        customSquareStyles={mergedSqs}
        animationDuration={150}
      />
    </div>
  );
};
