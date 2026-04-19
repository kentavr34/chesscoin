import React from 'react';
import { CoinIcon } from '@/components/ui/CoinIcon';

// ── Переиспользуемый «информационный» модал: звёзды кончились ─────────────────
// Единый алгоритм для всех режимов: Jarvis / Battles / другие.
// Нажатие «Купить попытки» — вызывает onBuyAttempts (родитель должен закрыть
// текущий родительский модал при желании и открыть AttemptsModal).

interface Props {
  userAttempts: number;
  maxAttempts: number;
  nextRestoreSeconds?: number;
  onBuyAttempts: () => void;
  onClose: () => void;
}

const fmtCountdown = (secs: number): string => {
  if (secs <= 0) return '00:00:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

const IcoStar = ({ filled }: { filled: boolean }) => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path
      d="M14 3l2.6 6.2 6.6.6-5 4.7 1.5 6.5L14 17.8l-5.7 3.2 1.5-6.5-5-4.7 6.6-.6z"
      fill={filled ? '#D4A843' : 'rgba(212,168,67,.1)'}
      stroke={filled ? '#A07830' : 'rgba(212,168,67,.18)'}
      strokeWidth=".8"
      style={{ filter: filled ? 'drop-shadow(0 0 6px rgba(212,168,67,.7))' : 'none' }}
    />
  </svg>
);

// Иконка часов (без эмодзи)
const IcoClock = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="#82CFFF" strokeWidth="1.6"/>
    <path d="M12 7v5l3 2" stroke="#82CFFF" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

export const NoAttemptsInfoModal: React.FC<Props> = ({
  userAttempts, maxAttempts, nextRestoreSeconds, onBuyAttempts, onClose,
}) => {
  const [restoreSecs, setRestoreSecs] = React.useState(nextRestoreSeconds ?? 0);

  React.useEffect(() => {
    setRestoreSecs(nextRestoreSeconds ?? 0);
  }, [nextRestoreSeconds]);

  React.useEffect(() => {
    if (restoreSecs <= 0) return;
    const t = setInterval(() => setRestoreSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [restoreSecs > 0]);

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(4,3,8,.88)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        paddingBottom: 'calc(82px + env(safe-area-inset-bottom, 0px))',
        paddingTop: '16px',
      }}
    >
      <style>{`@keyframes na-slide { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }`}</style>
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'linear-gradient(170deg,#120E04,#100C18)',
        border: '.5px solid rgba(212,168,67,.28)',
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -14px 44px rgba(0,0,0,.65)',
        padding: '0 0 12px',
        animation: 'na-slide .28s cubic-bezier(.25,.8,.25,1) both',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.1)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 18px 0' }}>
          <span style={{ fontSize: '1rem', fontWeight: 900, color: '#F0C85A' }}>Попытки закончились</span>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(255,255,255,.06)', border: '.5px solid rgba(255,255,255,.1)',
            color: '#6A7090', fontSize: '.8rem', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        <div style={{
          margin: '16px 14px',
          background: 'rgba(212,168,67,.06)',
          border: '.5px solid rgba(212,168,67,.18)',
          borderRadius: 16, padding: '18px 20px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {Array.from({ length: maxAttempts }, (_, i) => (
              <IcoStar key={i} filled={i < userAttempts} />
            ))}
          </div>
          <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#7A6830', letterSpacing: '.06em' }}>
            {userAttempts}/{maxAttempts} попыток использовано
          </div>
        </div>

        <div style={{ margin: '0 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {restoreSecs > 0 && userAttempts < maxAttempts && (
            <div style={{
              background: 'rgba(74,158,255,.07)',
              border: '.5px solid rgba(74,158,255,.18)',
              borderRadius: 12, padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <IcoClock size={22} />
              <div>
                <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#82CFFF', marginBottom: 2 }}>
                  Следующая попытка через
                </div>
                <div style={{
                  fontSize: '1.1rem', fontWeight: 900, color: '#4A9EFF',
                  fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em',
                }}>
                  {fmtCountdown(restoreSecs)}
                </div>
              </div>
            </div>
          )}
          <div style={{
            background: 'rgba(255,255,255,.03)',
            border: '.5px solid rgba(255,255,255,.07)',
            borderRadius: 12, padding: '12px 14px',
          }}>
            <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#6A6458', lineHeight: 1.7 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IcoStar filled={true} />
                <span>Система выдаёт <span style={{ color: '#D4A843' }}>1 попытку</span> каждые <span style={{ color: '#D4A843' }}>8 часов</span></span>
              </div>
              <div>Максимум <span style={{ color: '#D4A843' }}>{maxAttempts} бесплатных</span> попытки в день</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <CoinIcon size={14} /> Дополнительные попытки — за монеты
              </div>
            </div>
          </div>
        </div>

        <div style={{ margin: '0 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={onBuyAttempts}
            style={{
              width: '100%', padding: '14px',
              background: 'linear-gradient(135deg,#3A2A08,#5A4010)',
              border: '.5px solid rgba(212,168,67,.5)',
              borderRadius: 14, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '.9rem', fontWeight: 900,
              letterSpacing: '.04em', color: '#F0C85A',
              boxShadow: '0 4px 20px rgba(212,168,67,.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            Купить попытки — 1 000 <CoinIcon size={14} /> / шт
          </button>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '12px',
              background: 'rgba(255,255,255,.05)',
              border: '.5px solid rgba(255,255,255,.08)',
              borderRadius: 14, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '.82rem', fontWeight: 700,
              color: '#5A5850',
            }}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
