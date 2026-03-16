import React from 'react';

// Символы фигур для отображения
const PIECE_SYMBOLS: Record<string, string> = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
};

// Цены фигур для подсчёта суммы
const PIECE_VALUE: Record<string, number> = {
  p: 100, n: 300, b: 300, r: 500, q: 900, k: 1000,
};

interface CapturedPiecesProps {
  pieces: string[];   // массив символов: 'p', 'n', 'q' и т.д.
  label?: string;
  showCoins?: boolean;
}

export const CapturedPieces: React.FC<CapturedPiecesProps> = ({
  pieces,
  label,
  showCoins = false,
}) => {
  if (!pieces.length) return null;

  const total = pieces.reduce((sum, p) => sum + (PIECE_VALUE[p.toLowerCase()] ?? 0), 0);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      flexWrap: 'wrap',
    }}>
      {label && (
        <span style={{ fontSize: 9, color: '#6B7494', fontWeight: 700,
          letterSpacing: '.06em', textTransform: 'uppercase', marginRight: 2 }}>
          {label}
        </span>
      )}
      <div style={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {pieces.map((p, i) => (
          <span key={i} style={{ fontSize: 14, lineHeight: 1, opacity: 0.9 }}>
            {PIECE_SYMBOLS[p.toLowerCase()] ?? p}
          </span>
        ))}
      </div>
      {showCoins && total > 0 && (
        <span style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 10, fontWeight: 700, color: '#F5C842',
          letterSpacing: '-.01em',
        }}>
          +{total >= 1000 ? (total / 1000).toFixed(0) + 'K' : total} ᚙ
        </span>
      )}
    </div>
  );
};
