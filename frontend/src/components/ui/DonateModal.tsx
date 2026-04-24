import React, { useState } from 'react';
import { CoinIcon } from './CoinIcon';
import { fmtBalance } from '@/utils/format';
import { useUserStore } from '@/store/useUserStore';

/**
 * Модал доната — по стилю CreateBattleModal.
 * Пресеты 10k / 50k / 100k / 500k, минимум 100, ползунок.
 * Вся касса (минус 10% комиссии) уходит победителю — подсказка под суммой.
 */
export const DonateModal: React.FC<{
  onClose: () => void;
  onSubmit: (amount: number) => void;
  currentPool?: string | null;
}> = ({ onClose, onSubmit, currentPool }) => {
  const { user } = useUserStore();
  const userBalance = Number(BigInt(user?.balance ?? '0'));
  const MIN_DONATE = 100;
  const maxDonate = Math.max(MIN_DONATE, Math.min(userBalance, 5_000_000));

  const [amount, setAmount] = useState(Math.min(10_000, maxDonate));
  const QUICK = [10_000, 50_000, 100_000, 500_000];
  const canDonate = userBalance >= MIN_DONATE;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(4,3,8,.82)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        paddingTop: 16,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'linear-gradient(170deg,#100C18,#0A080E)',
        border: '.5px solid rgba(212,168,67,.2)',
        borderRadius: '24px 24px 0 0',
        padding: '0 0 14px',
        boxShadow: '0 -16px 48px rgba(0,0,0,.6), 0 -1px 0 rgba(212,168,67,.1)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(212,168,67,.2)' }} />
        </div>

        {/* Заголовок */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CoinIcon size={22} />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '.95rem', fontWeight: 900, color: '#F0E8CC' }}>
              Задонатить
            </span>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(255,255,255,.05)', border: '.5px solid rgba(255,255,255,.09)',
            color: '#6A7090', fontSize: '.8rem', cursor: 'pointer', fontFamily: 'inherit',
          }}>✕</button>
        </div>

        {/* Сумма + слайдер */}
        <div style={{ margin: '0 14px 10px' }}>
          <div style={{ fontSize: '.52rem', fontWeight: 700, color: '#6A5A30', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 6 }}>
            Сумма доната
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'linear-gradient(135deg,rgba(212,168,67,.08),rgba(212,168,67,.04))',
            border: '.5px solid rgba(212,168,67,.25)', borderRadius: 14, padding: '10px 14px',
          }}>
            <CoinIcon size={28} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.55rem', fontWeight: 900, color: '#F0C85A', lineHeight: 1 }}>
                {fmtBalance(amount)}
              </div>
              {canDonate && (
                <input
                  type="range" min={MIN_DONATE} max={maxDonate} step={100} value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  style={{ width: '100%', marginTop: 6, accentColor: '#D4A843', height: 3 }}
                />
              )}
            </div>
          </div>

          {/* Пресеты */}
          {canDonate && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5, marginTop: 7 }}>
              {QUICK.map((v) => {
                const capped = Math.min(v, maxDonate);
                const active = amount === v && v <= maxDonate;
                const unavail = v > maxDonate;
                return (
                  <button key={v} onClick={() => !unavail && setAmount(capped)} style={{
                    padding: '6px 4px', borderRadius: 9,
                    fontFamily: 'Inter, sans-serif', fontSize: '.68rem', fontWeight: 700,
                    cursor: unavail ? 'default' : 'pointer',
                    background: active ? 'rgba(212,168,67,.15)' : 'rgba(255,255,255,.04)',
                    color: unavail ? '#2E2820' : active ? '#F0C85A' : '#7A7875',
                    border: active ? '.5px solid rgba(212,168,67,.35)' : '.5px solid rgba(255,255,255,.07)',
                  }}>{fmtBalance(v)}</button>
                );
              })}
            </div>
          )}

          {/* Подсказка куда уйдут деньги */}
          <div style={{ fontSize: '.6rem', color: '#5A5248', marginTop: 10, lineHeight: 1.4 }}>
            🏆 90% от всей кассы получит победитель партии. 10% — комиссия платформы.
            {currentPool && BigInt(currentPool) > 0n && (
              <> Текущая касса: <span style={{ color: '#D4A843', fontWeight: 700 }}>{fmtBalance(currentPool)} ᚙ</span></>
            )}
          </div>
        </div>

        {/* CTA */}
        <div style={{ margin: '0 14px' }}>
          <button
            disabled={!canDonate}
            onClick={() => { if (canDonate) { onSubmit(amount); onClose(); } }}
            style={{
              width: '100%', padding: '13px', borderRadius: 14,
              background: canDonate ? 'linear-gradient(135deg,#D4A843,#F0C85A)' : 'rgba(255,255,255,.04)',
              border: '.5px solid rgba(212,168,67,.5)',
              color: canDonate ? '#120E04' : '#3A3028',
              fontFamily: 'Inter, sans-serif', fontSize: '.95rem', fontWeight: 900,
              cursor: canDonate ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <CoinIcon size={18} />
            Задонатить {fmtBalance(amount)} ᚙ
          </button>
          {!canDonate && (
            <div style={{ fontSize: '.62rem', color: '#7A5248', textAlign: 'center', marginTop: 6 }}>
              Минимум {MIN_DONATE} монет на балансе
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
