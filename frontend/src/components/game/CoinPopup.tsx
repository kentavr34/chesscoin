import React, { useState, useCallback } from 'react';

interface CoinPopup {
  id: number;
  amount: number;
  x: number;
  y: number;
}

interface CoinPopupLayerProps {
  // Вызывается из родителя при съедении фигуры
  triggerRef: React.MutableRefObject<((amount: number) => void) | null>;
}

// Цены фигур
export const PIECE_COIN_VALUE: Record<string, number> = {
  p: 100, n: 300, b: 300, r: 500, q: 900, k: 1000,
};

let _popupId = 0;

export const CoinPopupLayer: React.FC<CoinPopupLayerProps> = ({ triggerRef }) => {
  const [popups, setPopups] = useState<CoinPopup[]>([]);

  // Регистрируем функцию-триггер
  triggerRef.current = useCallback((amount: number) => {
    const id = ++_popupId;
    const x = 35 + Math.random() * 30; // % от ширины
    const y = 40 + Math.random() * 20; // % от высоты доски

    setPopups((prev) => [...prev, { id, amount, x, y }]);

    // Убираем через 1.2 сек
    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id));
    }, 1200);
  }, []);

  return (
    <>
      <style>{`
        @keyframes coinFloat {
          0%   { opacity: 0; transform: translateY(0) scale(0.6); }
          20%  { opacity: 1; transform: translateY(-4px) scale(1.1); }
          70%  { opacity: 1; transform: translateY(-18px) scale(1); }
          100% { opacity: 0; transform: translateY(-28px) scale(0.9); }
        }
      `}</style>
      {popups.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: "var(--z-header, 50)",
            animation: 'coinFloat 1.1s ease-out forwards',
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 13,
            fontWeight: 800,
            color: 'var(--color-accent, #F5C842)',
            textShadow: '0 0 8px var(--color-accent-shadow, rgba(245,200,66,0.7)), 0 1px 3px rgba(0,0,0,0.8)',
            whiteSpace: 'nowrap',
          }}
        >
          +{p.amount} ᚙ
        </div>
      ))}
    </>
  );
};
