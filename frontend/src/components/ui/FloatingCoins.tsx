/**
 * FloatingCoins — анимация +X ᚙ при получении монет
 * Использование в HomePage:
 *   <FloatingCoins amount={earned} onDone={() => setEarned(null)} />
 */
import React, { useEffect, useState } from 'react';
import { fmtBalance } from '@/utils/format';

interface Props {
  amount: string;  // bigint строка
  onDone: () => void;
}

export const FloatingCoins: React.FC<Props> = ({ amount, onDone }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDone, 300); }, 1400);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '35%',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 999,
      pointerEvents: 'none',
      animation: 'floatCoin 1.4s ease-out forwards',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: 'rgba(245,200,66,0.15)',
      border: '1px solid rgba(245,200,66,0.4)',
      borderRadius: 20,
      padding: '8px 16px',
      backdropFilter: 'blur(8px)',
    }}>
      <span style={{ fontSize: 20 }}>🪙</span>
      <span style={{
        fontFamily: "'Unbounded',sans-serif",
        fontSize: 18,
        fontWeight: 800,
        color: '#F5C842',
        whiteSpace: 'nowrap',
      }}>
        +{fmtBalance(amount)} ᚙ
      </span>
    </div>
  );
};
