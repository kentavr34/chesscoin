import React from 'react';
import { CoinIcon } from '@/components/ui/CoinIcon';

// 2026-05-16 Кенан: chess unicode ♚♛♜♝♞♟ и руна в Telegram WebView
// рендерятся как иероглифы (нет глифов в системном шрифте Android/iOS).
// Переходим на SVG-фигуры из assets/pieces/ и <CoinIcon /> для валюты.

const PIECE_FILE: Record<string, string> = {
  p: 'black-pawn',   n: 'black-knight', b: 'black-bishop',
  r: 'black-rook',   q: 'black-queen',  k: 'black-king',
  P: 'white-pawn',   N: 'white-knight', B: 'white-bishop',
  R: 'white-rook',   Q: 'white-queen',  K: 'white-king',
};

function pieceUrl(code: string): string {
  const name = PIECE_FILE[code] ?? PIECE_FILE[code.toLowerCase()] ?? 'black-pawn';
  return new URL(`../../assets/pieces/${name}.svg`, import.meta.url).href;
}

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
        <span style={{ fontSize: 9, color: 'var(--color-text-muted, #4A5270)', fontWeight: 700,
          letterSpacing: '.06em', textTransform: 'uppercase', marginRight: 2 }}>
          {label}
        </span>
      )}
      <div style={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {pieces.map((p, i) => (
          <img
            key={i}
            src={pieceUrl(p)}
            alt={p}
            width={14}
            height={14}
            draggable={false}
            style={{ opacity: 0.9, display: 'inline-block', verticalAlign: 'middle' }}
          />
        ))}
      </div>
      {showCoins && total > 0 && (
        <span style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 10, fontWeight: 700, color: 'var(--color-accent, #F5C842)',
          letterSpacing: '-.01em',
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          +{total >= 1000 ? (total / 1000).toFixed(0) + 'K' : total}
          <CoinIcon size={10} />
        </span>
      )}
    </div>
  );
};
