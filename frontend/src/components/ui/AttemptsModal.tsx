import React, { useState } from 'react';
import { shopApi } from '@/api';
import { useUserStore } from '@/store/useUserStore';
import type { User } from '@/types';

interface Props {
  user: User;
  onClose: () => void;
}

export const AttemptsModal: React.FC<Props> = ({ user, onClose }) => {
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const { setUser } = useUserStore();

  const COST_PER = 1000;

  const handleBuy = async () => {
    setLoading(true);
    try {
      await shopApi.buyAttempts(count);
      const { authApi } = await import('@/api');
      const updated = await authApi.me();
      setUser(updated);
      onClose();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text: err.message ?? 'Ошибка', type: 'error' } }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={overlayStyle}>
      <div style={modalStyle}>
        <div style={handleStyle} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 17, fontWeight: 700, color: '#F0F2F8' }}>
            Купить попытки
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '12px 0 8px' }}>
          {Array.from({ length: user.maxAttempts }).map((_, i) => (
            <span key={i} style={{
              fontSize: 32,
              color: i < user.attempts ? '#F5C842' : '#2A2F48',
              filter: i < user.attempts ? 'drop-shadow(0 0 8px rgba(245,200,66,0.8))' : undefined,
            }}>★</span>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#8B92A8', marginBottom: 4 }}>
          Попытки: {user.attempts} из {user.maxAttempts}
        </p>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#4A5270', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          Количество
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '12px 0' }}>
          <button onClick={() => setCount(Math.max(1, count - 1))} style={stepBtn('#232840', '#8B92A8')}>−</button>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 700, color: '#F0F2F8', minWidth: 32, textAlign: 'center' }}>{count}</span>
          <button onClick={() => setCount(Math.min(3 - user.attempts, count + 1))} style={stepBtn('#F5C842', '#0B0D11')}>+</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: '#8B92A8' }}>Стоимость</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: '#F5C842' }}>
            {(count * COST_PER).toLocaleString()} ᚙ
          </span>
        </div>
        <button
          onClick={handleBuy}
          disabled={loading}
          style={{ ...buyBtn, opacity: loading ? .6 : 1 }}
        >
          {loading ? '...' : `Купить ${count} попытк${count === 1 ? 'у' : 'и'}`}
        </button>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
  backdropFilter: 'blur(6px)', zIndex: 200,
  display: 'flex', alignItems: 'flex-end',
};
const modalStyle: React.CSSProperties = {
  width: '100%', background: '#161927',
  borderRadius: '24px 24px 0 0', padding: 20,
  borderTop: '1px solid rgba(255,255,255,0.13)',
};
const handleStyle: React.CSSProperties = {
  width: 36, height: 4, background: '#2A2F48',
  borderRadius: 2, margin: '0 auto 16px',
};
const stepBtn = (bg: string, color: string): React.CSSProperties => ({
  width: 40, height: 40, borderRadius: '50%', border: 'none',
  background: bg, color, fontSize: 20, fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
});
const buyBtn: React.CSSProperties = {
  width: '100%', padding: '12px 18px', background: '#F5C842', color: '#0B0D11',
  border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};
const closeBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#8B92A8', fontSize: 14, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'inherit', flexShrink: 0,
};
