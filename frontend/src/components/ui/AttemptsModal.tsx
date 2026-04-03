import React, { useState } from 'react';
import { shopApi } from '@/api';
import { useUserStore } from '@/store/useUserStore';
import type { User } from '@/types';
import { useT } from '@/i18n/useT';

interface Props {
  user: User;
  onClose: () => void;
}

const COST_PER = 1000;

// ── Иконка звезды ──────────────────────────────────────────────────────────────
const IcoStar = ({ filled, size = 30 }: { filled: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <path
      d="M14 3l2.6 6.2 6.6.6-5 4.7 1.5 6.5L14 17.8l-5.7 3.2 1.5-6.5-5-4.7 6.6-.6z"
      fill={filled ? '#D4A843' : 'rgba(212,168,67,.12)'}
      stroke={filled ? '#A07830' : 'rgba(212,168,67,.2)'}
      strokeWidth=".8"
      style={{ filter: filled ? 'drop-shadow(0 0 6px rgba(212,168,67,.7))' : 'none' }}
    />
  </svg>
);

const IcoCoin = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="9" fill="url(#buyAttCoinGrad)" stroke="#A07830" strokeWidth=".8"/>
    <text x="10" y="14" textAnchor="middle" fontSize="9" fontWeight="800" fontFamily="serif" fill="#120E04">₿</text>
    <defs>
      <radialGradient id="buyAttCoinGrad" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#F0C85A"/>
        <stop offset="60%" stopColor="#D4A843"/>
        <stop offset="100%" stopColor="#8A6020"/>
      </radialGradient>
    </defs>
  </svg>
);

export const AttemptsModal: React.FC<Props> = ({ user, onClose }) => {
  const t = useT();
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const { setUser } = useUserStore();

  const maxBuy = Math.max(0, (user.maxAttempts ?? 3) - (user.attempts ?? 0));
  const balance = Math.max(parseInt(user.balance || '0'), 0);
  const totalCost = count * COST_PER;
  const canAfford = balance >= totalCost;

  const decrement = () => setCount(c => Math.max(1, c - 1));
  const increment = () => setCount(c => Math.min(maxBuy, c + 1));

  const handleBuy = async () => {
    if (!canAfford || loading || maxBuy === 0) return;
    setLoading(true);
    try {
      await shopApi.buyAttempts(count);
      const { authApi } = await import('@/api');
      const updated = await authApi.me();
      setUser(updated);
      onClose();
    } catch (err: unknown) {
      window.dispatchEvent(new CustomEvent('chesscoin:toast', {
        detail: { text: (err instanceof Error ? err.message : String(err)) ?? t.common.error, type: 'error' }
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 350,
        background: 'rgba(4,3,8,.82)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        paddingBottom: 'calc(82px + env(safe-area-inset-bottom, 0px))',
        paddingTop: '16px',
      }}
    >
      <style>{`
        @keyframes bam-slide { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        .bam-sheet { animation: bam-slide .22s cubic-bezier(.25,.8,.25,1) both; }
        .bam-stepper:active { transform: scale(.88) !important; }
      `}</style>

      <div className="bam-sheet" style={{
        width: '100%', maxWidth: 420,
        background: 'linear-gradient(170deg,#120E04,#0E0C10)',
        border: '.5px solid rgba(212,168,67,.25)',
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -12px 40px rgba(0,0,0,.6), 0 -1px 0 rgba(212,168,67,.12)',
        padding: '0 0 10px',
      }}>

        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.1)' }} />
        </div>

        {/* Заголовок */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 18px 14px' }}>
          <span style={{ fontSize: '1rem', fontWeight: 900, color: '#F0C85A', letterSpacing: '.01em' }}>Купить попытки</span>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(255,255,255,.06)', border: '.5px solid rgba(255,255,255,.1)',
            color: '#6A7090', fontSize: '.8rem', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* ── Звёзды + баланс ── */}
        <div style={{
          margin: '0 14px 20px',
          background: 'linear-gradient(135deg,rgba(212,168,67,.08),rgba(212,168,67,.04))',
          border: '.5px solid rgba(212,168,67,.2)', borderRadius: 14,
          padding: '14px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: '.5rem', fontWeight: 700, color: '#7A6830', textTransform: 'uppercase', letterSpacing: '.1em' }}>Попытки</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {Array.from({ length: user.maxAttempts ?? 3 }, (_, i) => (
                <IcoStar key={i} filled={i < (user.attempts ?? 0)} size={30} />
              ))}
              <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#9A8840', marginLeft: 4 }}>
                {user.attempts ?? 0}/{user.maxAttempts ?? 3}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ fontSize: '.5rem', fontWeight: 700, color: '#7A6830', textTransform: 'uppercase', letterSpacing: '.1em' }}>Баланс</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#D4A843', letterSpacing: '-.01em' }}>
                {balance.toLocaleString()}
              </span>
              <IcoCoin size={17} />
            </div>
          </div>
        </div>

        {maxBuy > 0 ? (
          <>
            {/* ── Счётчик − / N / + ── */}
            <div style={{ margin: '0 14px 20px' }}>
              <div style={{ fontSize: '.52rem', fontWeight: 700, color: '#7A6830', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 14, textAlign: 'center' }}>
                Количество попыток
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>

                {/* Минус */}
                <button
                  className="bam-stepper"
                  onClick={decrement}
                  disabled={count <= 1}
                  style={{
                    width: 52, height: 52, borderRadius: 16,
                    background: count > 1 ? 'rgba(212,168,67,.12)' : 'rgba(255,255,255,.04)',
                    border: `.5px solid ${count > 1 ? 'rgba(212,168,67,.4)' : 'rgba(255,255,255,.08)'}`,
                    color: count > 1 ? '#D4A843' : '#3A3A40',
                    fontSize: '1.6rem', fontWeight: 900,
                    cursor: count > 1 ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .15s', transform: 'scale(1)',
                    boxShadow: count > 1 ? '0 0 10px rgba(212,168,67,.12)' : 'none',
                  }}
                >−</button>

                {/* Количество + цена */}
                <div style={{ textAlign: 'center', minWidth: 90 }}>
                  <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#F0C85A', lineHeight: 1, letterSpacing: '-.02em' }}>
                    {count}
                  </div>
                  <div style={{
                    fontSize: '.65rem', fontWeight: 700, marginTop: 5,
                    color: canAfford ? 'rgba(212,168,67,.65)' : '#EF4444',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}>
                    {totalCost.toLocaleString()} <IcoCoin size={13} />
                  </div>
                </div>

                {/* Плюс */}
                <button
                  className="bam-stepper"
                  onClick={increment}
                  disabled={count >= maxBuy}
                  style={{
                    width: 52, height: 52, borderRadius: 16,
                    background: count < maxBuy ? 'rgba(212,168,67,.12)' : 'rgba(255,255,255,.04)',
                    border: `.5px solid ${count < maxBuy ? 'rgba(212,168,67,.4)' : 'rgba(255,255,255,.08)'}`,
                    color: count < maxBuy ? '#D4A843' : '#3A3A40',
                    fontSize: '1.6rem', fontWeight: 900,
                    cursor: count < maxBuy ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .15s', transform: 'scale(1)',
                    boxShadow: count < maxBuy ? '0 0 10px rgba(212,168,67,.12)' : 'none',
                  }}
                >+</button>
              </div>
            </div>

            {/* ── Кнопка купить ── */}
            <div style={{ margin: '0 14px' }}>
              {!canAfford && (
                <div style={{ fontSize: '.62rem', fontWeight: 700, color: '#EF4444', textAlign: 'center', marginBottom: 8, letterSpacing: '.04em' }}>
                  Недостаточно монет
                </div>
              )}
              <button
                onClick={handleBuy}
                disabled={loading || !canAfford}
                style={{
                  width: '100%', padding: '14px',
                  background: canAfford
                    ? 'linear-gradient(135deg,#3A2A08,#5A4010)'
                    : 'rgba(255,255,255,.04)',
                  border: `.5px solid ${canAfford ? 'rgba(212,168,67,.5)' : 'rgba(255,255,255,.1)'}`,
                  borderRadius: 14, cursor: canAfford ? 'pointer' : 'default',
                  fontFamily: 'inherit', fontSize: '.9rem',
                  fontWeight: 900, letterSpacing: '.04em',
                  color: canAfford ? '#F0C85A' : '#4A4640',
                  opacity: loading ? .6 : 1,
                  transition: 'all .15s',
                }}
              >
                {loading ? 'Покупаем...' : `КУПИТЬ ${count} ${count === 1 ? 'ПОПЫТКУ' : count < 5 ? 'ПОПЫТКИ' : 'ПОПЫТОК'}`}
              </button>
            </div>
          </>
        ) : (
          <div style={{ margin: '0 14px 20px', textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: '.82rem', color: 'rgba(212,168,67,.5)', fontWeight: 700 }}>У тебя уже максимум попыток</div>
          </div>
        )}

      </div>
    </div>
  );
};
