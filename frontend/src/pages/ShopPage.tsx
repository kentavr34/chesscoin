import React, { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { shopApi, authApi, tonApi, profileApi } from '@/api';
import { useUserStore } from '@/store/useUserStore';
import { fmtBalance } from '@/utils/format';
import type { ShopItem, ItemType } from '@/types';
import { setActiveTheme, getActiveTheme, THEMES } from '@/lib/theme';
import type { ThemeKey } from '@/lib/theme';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

type Tab = 'frames' | 'boards' | 'pieces' | 'anims' | 'themes' | 'ton';

const TAB_TYPE: Partial<Record<Tab, ItemType>> = {
  frames: 'AVATAR_FRAME',
  boards: 'BOARD_SKIN',
  pieces: 'PIECE_SKIN',
  anims: 'MOVE_ANIMATION',
  themes: 'THEME',
};

const TAB_LABELS: Record<Tab, string> = {
  frames: 'Рамки',
  boards: 'Доски',
  pieces: 'Фигуры',
  anims: 'Аним.',
  themes: 'Темы',
  ton: '💎 TON',
};

// Map item name to ThemeKey
const THEME_NAME_TO_KEY: Record<string, ThemeKey> = {
  'Binance Pro':   'binance',
  'Chess Classic': 'chess_classic',
  'Neon Cyber':    'neon_cyber',
  'Royal Gold':    'royal_gold',
  'Matrix Dark':   'matrix_dark',
  'Crystal Ice':   'crystal_ice',
};

const RARITY_COLOR: Record<string, string> = {
  COMMON: '#A8B0C8',
  RARE: '#7B61FF',
  EPIC: '#F5C842',
  LEGENDARY: '#FF6B35',
};

const RARITY_LABEL: Record<string, string> = {
  COMMON: 'Обычный',
  RARE: 'Редкий',
  EPIC: 'Эпический',
  LEGENDARY: 'Легендарный',
};

const DEFAULT_TON_TO_COINS = 1_000_000;
const DEFAULT_USDT_TO_COINS = 200_000;
const FEE_PERCENT = 0.5;

// Кошелёк-казначейство для получения платы за разблокировку (1 TON)
const TREASURY_ADDRESS = 'UQDZNHJrTBJ9asNgL15bf-8Ud4Rleku-oP6TSlbg6EWXfq7y';

// ── Модал подключения TON кошелька ────────────────────────────
const ConnectWalletModal: React.FC<{
  onClose: () => void;
  onConfirm: (addr: string) => Promise<void>;
}> = ({ onClose, onConfirm }) => {
  const [step, setStep] = useState<'info' | 'pay' | 'confirm'>('info');
  const [addr, setAddr] = useState('');
  const [processing, setProcessing] = useState(false);
  const [addrError, setAddrError] = useState('');

  const handleOpenTon = () => {
    const tg = (window as any).Telegram?.WebApp;
    const tonUrl = `ton://transfer/${TREASURY_ADDRESS}?amount=1000000000&text=ChessCoin%20TON%20Unlock`;
    if (tg?.openLink) {
      tg.openLink(tonUrl, { try_instant_view: false });
    } else {
      window.open(tonUrl, '_blank');
    }
    setStep('confirm');
  };

  const handleConfirm = async () => {
    const trimmed = addr.trim();
    if (!trimmed.match(/^(UQ|EQ)[A-Za-z0-9_-]{46}$/)) {
      setAddrError('Неверный формат. Адрес должен начинаться с UQ или EQ (48 символов)');
      return;
    }
    setAddrError('');
    setProcessing(true);
    try {
      await onConfirm(trimmed);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#13161E', borderRadius: '24px 24px 0 0', padding: '20px 20px 36px', width: '100%', maxWidth: 480, border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ width: 36, height: 4, background: '#2A2F48', borderRadius: 2, margin: '0 auto 20px' }} />

        {step === 'info' && (<>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💎</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#F0F2F8', marginBottom: 8 }}>Подключить TON кошелёк</div>
            <div style={{ fontSize: 12, color: '#A8B0C8', lineHeight: 1.6 }}>
              Одноразовая оплата <b style={{ color: '#0098EA' }}>1 TON</b> открывает доступ к покупке монет за крипту и выводу заработанного
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {[
              { ico: '🪙', text: 'Купи монеты за TON или USDT', sub: '1 TON = 1 000 000 ᚙ' },
              { ico: '💸', text: 'Выводи монеты в TON', sub: 'Комиссия 0.5% на все операции' },
              { ico: '🔒', text: 'Разовая оплата — навсегда', sub: '1 TON отправляется на кошелёк проекта' },
            ].map(r => (
              <div key={r.ico} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                <span style={{ fontSize: 18 }}>{r.ico}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F2F8' }}>{r.text}</div>
                  <div style={{ fontSize: 10, color: '#A8B0C8', marginTop: 2 }}>{r.sub}</div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setStep('pay')}
            style={{ width: '100%', padding: 14, background: 'linear-gradient(90deg,#0098EA,#007AC2)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Продолжить →
          </button>
          <button onClick={onClose} style={{ width: '100%', marginTop: 10, padding: 12, background: 'none', border: 'none', color: '#6B7494', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Отмена
          </button>
        </>)}

        {step === 'pay' && (<>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📤</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#F0F2F8', marginBottom: 8 }}>Отправить 1 TON</div>
            <div style={{ fontSize: 12, color: '#A8B0C8', lineHeight: 1.6, marginBottom: 16 }}>
              Нажми кнопку ниже чтобы открыть кошелёк и отправить <b style={{ color: '#0098EA' }}>1 TON</b> на адрес проекта
            </div>
            <div style={{ padding: '10px 14px', background: '#1C2030', borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 9, color: '#6B7494', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Адрес получателя</div>
              <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: '#0098EA', wordBreak: 'break-all' }}>{TREASURY_ADDRESS}</div>
            </div>
            <div style={{ fontSize: 11, color: '#F5C842', background: 'rgba(245,200,66,0.08)', padding: '8px 12px', borderRadius: 10, marginBottom: 16 }}>
              ⚠️ Сумма: ровно 1 TON. В комментарии: «ChessCoin TON Unlock»
            </div>
          </div>
          <button onClick={handleOpenTon}
            style={{ width: '100%', padding: 14, background: 'linear-gradient(90deg,#0098EA,#007AC2)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>
            💎 Открыть TON кошелёк
          </button>
          <button onClick={() => setStep('confirm')}
            style={{ width: '100%', padding: 12, background: '#1C2030', border: '1px solid rgba(255,255,255,0.1)', color: '#A8B0C8', borderRadius: 14, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Уже отправил →
          </button>
        </>)}

        {step === 'confirm' && (<>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#F0F2F8', marginBottom: 8 }}>Подтвердить оплату</div>
            <div style={{ fontSize: 12, color: '#A8B0C8', lineHeight: 1.6 }}>
              Введи адрес своего TON кошелька, с которого была отправлена оплата
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <input
              value={addr}
              onChange={e => { setAddr(e.target.value); setAddrError(''); }}
              placeholder="UQ... или EQ..."
              style={{ width: '100%', padding: '12px 14px', background: '#1C2030', border: `1px solid ${addrError ? '#FF4D6A' : 'rgba(255,255,255,0.1)'}`, borderRadius: 12, color: '#F0F2F8', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            {addrError && <div style={{ fontSize: 11, color: '#FF4D6A', marginTop: 6 }}>{addrError}</div>}
          </div>
          <div style={{ fontSize: 11, color: '#6B7494', marginBottom: 16, lineHeight: 1.5 }}>
            Убедись, что отправил ровно 1 TON на адрес проекта. Оплата проверяется вручную в течение 24 часов.
          </div>
          <button onClick={handleConfirm} disabled={processing || !addr}
            style={{ width: '100%', padding: 14, background: processing || !addr ? '#2A2F48' : 'linear-gradient(90deg,#00D68F,#00B87A)', color: processing || !addr ? '#6B7494' : '#0B0D11', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: processing || !addr ? 'default' : 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>
            {processing ? 'Подключение...' : '✅ Подтвердить'}
          </button>
          <button onClick={() => setStep('pay')}
            style={{ width: '100%', padding: 12, background: 'none', border: 'none', color: '#6B7494', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Назад
          </button>
        </>)}
      </div>
    </div>
  );
};

// ── TON Tab ─────────────────────────────────────────────────
interface TonTabProps {
  user: any;
  showToast: (msg: string) => void;
  onUserRefresh: () => void;
}

const TonTab: React.FC<TonTabProps> = ({ user, showToast, onUserRefresh }) => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [activeAction, setActiveAction] = useState<'buy' | 'sell' | 'withdraw' | null>(null);
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [tonToCoins, setTonToCoins] = useState(DEFAULT_TON_TO_COINS);
  const [usdtToCoins, setUsdtToCoins] = useState(DEFAULT_USDT_TO_COINS);
  const [tonUsdt, setTonUsdt] = useState(5.5);
  const [showConnectModal, setShowConnectModal] = useState(false);

  // Check if user already unlocked TON features (tonWalletAddress set)
  useEffect(() => {
    if (user?.tonWalletAddress) {
      setWalletConnected(true);
      setWalletAddress(user.tonWalletAddress);
    }
  }, [user]);

  // Load live rate
  useEffect(() => {
    tonApi.rate().then(r => {
      setTonToCoins(r.coinsPerTon);
      setUsdtToCoins(r.coinsPerUsdt);
      setTonUsdt(r.tonUsdt);
    }).catch(() => {});
  }, []);

  const handleConnectWallet = async () => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) {
      showToast('Откройте в Telegram для подключения кошелька');
      return;
    }
    setShowConnectModal(true);
  };

  const handleConfirmConnection = async (addr: string) => {
    try {
      await tonApi.connectWallet(addr);
      setWalletAddress(addr);
      setWalletConnected(true);
      setShowConnectModal(false);
      showToast('✅ TON кошелёк подключён!');
      onUserRefresh();
    } catch (e: any) {
      showToast(e.message || 'Ошибка подключения');
      throw e;
    }
  };

  const calcCoins = (tonOrUsdt: string, isTon: boolean) => {
    const n = parseFloat(tonOrUsdt) || 0;
    const rate = isTon ? tonToCoins : usdtToCoins;
    const gross = n * rate;
    const fee = gross * (FEE_PERCENT / 100);
    return { gross, fee, net: gross - fee };
  };

  const calcWithdraw = (coins: string) => {
    const n = BigInt(coins.replace(/\D/g, '') || '0');
    const ton = Number(n) / tonToCoins;
    const fee = ton * (FEE_PERCENT / 100);
    return { ton, fee, net: ton - fee };
  };

  if (!walletConnected) {
    return (
      <div style={{ padding: '0 18px 24px' }}>
        <div style={{ ...heroCard, gap: 0 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💎</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#F0F2F8', marginBottom: 6 }}>TON / USDT</div>
          <div style={{ fontSize: 12, color: '#A8B0C8', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
            Подключи TON кошелёк и получи доступ к покупке монет за реальные криптовалюты и выводу заработанного
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {[
              { ico: '🪙', text: 'Купи монеты за TON или USDT', sub: '1 TON = 1 000 000 ᚙ' },
              { ico: '💸', text: 'Выводи монеты в TON', sub: 'Комиссия 0.5% на все операции' },
              { ico: '🔒', text: 'Одноразовая оплата разблокировки', sub: '1 TON — навсегда' },
            ].map(r => (
              <div key={r.ico} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18 }}>{r.ico}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F2F8' }}>{r.text}</div>
                  <div style={{ fontSize: 10, color: '#A8B0C8', marginTop: 2 }}>{r.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleConnectWallet}
            style={{ width: '100%', padding: '14px', background: 'linear-gradient(90deg,#0098EA,#007AC2)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            💎 Подключить TON кошелёк
          </button>
          <div style={{ fontSize: 10, color: '#6B7494', marginTop: 8, textAlign: 'center' }}>
            Оплата 1 TON для разблокировки
          </div>
        </div>
        {showConnectModal && (
          <ConnectWalletModal
            onClose={() => setShowConnectModal(false)}
            onConfirm={handleConfirmConnection}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Wallet Info */}
      <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg, rgba(0,152,234,0.15), rgba(0,122,194,0.08))', border: '1px solid rgba(0,152,234,0.3)', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 22 }}>💎</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#0098EA', fontWeight: 700, marginBottom: 2 }}>TON кошелёк подключён</div>
          <div style={{ fontSize: 10, color: '#A8B0C8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{walletAddress}</div>
        </div>
        <div style={{ fontSize: 10, color: '#00D68F', fontWeight: 700 }}>✓ Активен</div>
      </div>

      {/* Balance row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, padding: '12px', background: '#1C2030', borderRadius: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#6B7494', marginBottom: 4 }}>БАЛАНС ᚙ</div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 14, fontWeight: 700, color: '#F5C842' }}>{fmtBalance(user?.balance ?? '0')}</div>
        </div>
        <div style={{ flex: 1, padding: '12px', background: '#1C2030', borderRadius: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#6B7494', marginBottom: 4 }}>КУРС</div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, fontWeight: 700, color: '#0098EA' }}>1 TON = {(tonToCoins / 1000).toFixed(0)}K ᚙ</div>
          <div style={{ fontSize: 9, color: '#6B7494', marginTop: 2 }}>≈ ${tonUsdt.toFixed(2)}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['buy', 'sell', 'withdraw'] as const).map(a => (
          <button key={a} onClick={() => setActiveAction(activeAction === a ? null : a)} style={{
            flex: 1, padding: '10px 4px', border: 'none', borderRadius: 12, fontFamily: 'inherit',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: activeAction === a ? (a === 'buy' ? '#0098EA' : a === 'sell' ? '#7B61FF' : '#00D68F') : '#1C2030',
            color: activeAction === a ? '#fff' : '#A8B0C8',
          }}>
            {a === 'buy' ? '📥 Купить' : a === 'sell' ? '📤 Продать' : '🏦 Вывод'}
          </button>
        ))}
      </div>

      {/* Buy panel */}
      {activeAction === 'buy' && (
        <div style={{ padding: '16px', background: '#13161E', border: '1px solid rgba(0,152,234,0.2)', borderRadius: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F2F8', marginBottom: 12 }}>Купить монеты</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {[{ label: '0.5 TON', val: '0.5', ton: true }, { label: '1 TON', val: '1', ton: true }, { label: '10 USDT', val: '10', ton: false }].map(opt => {
              const c = calcCoins(opt.val, opt.ton);
              return (
                <button key={opt.label} onClick={() => setAmount(opt.val)} style={{ flex: 1, padding: '8px 4px', border: `1px solid ${amount === opt.val ? '#0098EA' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, background: amount === opt.val ? 'rgba(0,152,234,0.12)' : '#1C2030', color: '#F0F2F8', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <div>{opt.label}</div>
                  <div style={{ color: '#F5C842', marginTop: 2 }}>+{fmtBalance(String(Math.round(c.net)))} ᚙ</div>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              placeholder="Сумма TON"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ flex: 1, padding: '10px 12px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#F0F2F8', fontSize: 13, fontFamily: 'inherit' }}
            />
            <button
              disabled={processing || !amount}
              style={{ padding: '10px 16px', background: processing ? '#555' : '#0098EA', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: processing ? 'default' : 'pointer', fontFamily: 'inherit' }}
              onClick={async () => {
                if (!amount || parseFloat(amount) < 0.1) { showToast('Минимум 0.1 TON'); return; }
                setProcessing(true);
                try {
                  const r = await tonApi.buy(parseFloat(amount));
                  showToast(`✅ Начислено ${fmtBalance(String(r.coinsReceived))} ᚙ`);
                  setAmount('');
                  onUserRefresh();
                } catch (e: any) { showToast(e.message || 'Ошибка'); }
                finally { setProcessing(false); }
              }}
            >
              {processing ? '...' : 'Купить'}
            </button>
          </div>
          {amount && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#A8B0C8', lineHeight: 1.8 }}>
              {(() => { const c = calcCoins(amount, true); return <>
                <div>Получишь: <b style={{ color: '#F5C842' }}>{fmtBalance(String(Math.round(c.net)))} ᚙ</b></div>
                <div>Комиссия {FEE_PERCENT}%: {fmtBalance(String(Math.round(c.fee)))} ᚙ</div>
              </>; })()}
            </div>
          )}
        </div>
      )}

      {/* Sell panel */}
      {activeAction === 'sell' && (
        <div style={{ padding: '16px', background: '#13161E', border: '1px solid rgba(123,97,255,0.2)', borderRadius: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F2F8', marginBottom: 12 }}>Продать монеты за TON</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              placeholder="Кол-во ᚙ"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ flex: 1, padding: '10px 12px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#F0F2F8', fontSize: 13, fontFamily: 'inherit' }}
            />
            <button
              disabled={processing || !amount}
              style={{ padding: '10px 16px', background: processing ? '#555' : '#7B61FF', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: processing ? 'default' : 'pointer', fontFamily: 'inherit' }}
              onClick={async () => {
                if (!amount || BigInt(amount.replace(/\D/g,'') || '0') < 1_000_000n) { showToast('Минимум 1,000,000 ᚙ'); return; }
                setProcessing(true);
                try {
                  const r = await tonApi.sell(amount.replace(/\D/g,''));
                  showToast(`✅ Заявка создана: ${r.tonAmount.toFixed(4)} TON`);
                  setAmount('');
                  onUserRefresh();
                } catch (e: any) { showToast(e.message || 'Ошибка'); }
                finally { setProcessing(false); }
              }}
            >
              {processing ? '...' : 'Продать'}
            </button>
          </div>
          {amount && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#A8B0C8', lineHeight: 1.8 }}>
              {(() => { const c = calcWithdraw(amount); return <>
                <div>Получишь: <b style={{ color: '#0098EA' }}>{c.net.toFixed(4)} TON</b></div>
                <div>Комиссия {FEE_PERCENT}%: {c.fee.toFixed(4)} TON</div>
              </>; })()}
            </div>
          )}
        </div>
      )}

      {/* Withdraw panel */}
      {activeAction === 'withdraw' && (
        <div style={{ padding: '16px', background: '#13161E', border: '1px solid rgba(0,214,143,0.2)', borderRadius: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F2F8', marginBottom: 4 }}>Вывод в TON</div>
          <div style={{ fontSize: 11, color: '#A8B0C8', marginBottom: 12 }}>На кошелёк: {walletAddress?.slice(0, 12)}...{walletAddress?.slice(-6)}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              placeholder="Кол-во ᚙ"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ flex: 1, padding: '10px 12px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#F0F2F8', fontSize: 13, fontFamily: 'inherit' }}
            />
            <button
              disabled={processing || !amount}
              style={{ padding: '10px 16px', background: processing ? '#555' : '#00D68F', color: '#0B0D11', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: processing ? 'default' : 'pointer', fontFamily: 'inherit' }}
              onClick={async () => {
                if (!amount || BigInt(amount.replace(/\D/g,'') || '0') < 1_000_000n) { showToast('Минимум 1,000,000 ᚙ'); return; }
                setProcessing(true);
                try {
                  const r = await tonApi.withdraw(amount.replace(/\D/g,''));
                  showToast(`✅ Заявка создана: ${(r as any).netTon?.toFixed(4)} TON`);
                  setAmount('');
                  onUserRefresh();
                } catch (e: any) { showToast(e.message || 'Ошибка'); }
                finally { setProcessing(false); }
              }}
            >
              {processing ? '...' : 'Вывести'}
            </button>
          </div>
          {amount && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#A8B0C8', lineHeight: 1.8 }}>
              {(() => { const c = calcWithdraw(amount); return <>
                <div>Получишь: <b style={{ color: '#00D68F' }}>{c.net.toFixed(4)} TON</b></div>
                <div>Комиссия {FEE_PERCENT}%: {c.fee.toFixed(4)} TON</div>
                <div style={{ color: '#6B7494' }}>≈ {(c.net * 5.5).toFixed(2)} USDT</div>
              </>; })()}
            </div>
          )}
        </div>
      )}

      {/* Transaction history placeholder */}
      <div style={{ padding: '14px', background: '#1C2030', borderRadius: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7494', marginBottom: 8 }}>ИСТОРИЯ ОПЕРАЦИЙ</div>
        <div style={{ fontSize: 12, color: '#6B7494', textAlign: 'center', padding: '12px 0' }}>
          Нет TON операций
        </div>
      </div>
    </div>
  );
};

// ── Main Shop ────────────────────────────────────────────────
export const ShopPage: React.FC = () => {
  const { user, setUser } = useUserStore();
  const [tab, setTab] = useState<Tab>('frames');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [shopFilter, setShopFilter] = useState('ALL');
  const [buyConfirm, setBuyConfirm] = useState<{ title: string; msg: string; fn: () => Promise<void> } | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const refreshUser = useCallback(async () => {
    try { const u = await authApi.me(); setUser(u); } catch {}
  }, [setUser]);

  const loadItems = useCallback(async () => {
    if (tab === 'ton') return;
    setLoading(true);
    try {
      const data = await shopApi.getItems(TAB_TYPE[tab]!);
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  const handleThemePurchase = (item: ShopItem) => {
    setBuyConfirm({
      title: 'Купить тему?',
      msg: `«${item.name}» за ${fmtBalance(item.priceCoins)} ᚙ`,
      fn: async () => {
        setActionId(item.id);
        try {
          await shopApi.purchase(item.id);
          await refreshUser();
          await loadItems();
          // Применяем тему сразу после покупки
          const key = THEME_NAME_TO_KEY[item.name] ?? 'default';
          setActiveTheme(key);
          profileApi.saveTheme(key).catch(() => {});
          showToast(`✅ Тема «${item.name}» куплена и применена!`);
        } catch (e: any) {
          showToast(e.message);
        } finally {
          setActionId(null);
        }
      },
    });
  };

  const handleThemeApply = (item: ShopItem) => {
    const key = THEME_NAME_TO_KEY[item.name] ?? 'default';
    setActiveTheme(key);
    profileApi.saveTheme(key).catch(() => {});
    showToast(`Тема «${item.name}» применена`);
  };

  useEffect(() => { loadItems(); setShopFilter('ALL'); }, [loadItems]);

  const handlePurchase = (item: ShopItem) => {
    setBuyConfirm({
      title: 'Купить предмет?',
      msg: `«${item.name}» за ${fmtBalance(item.priceCoins)} ᚙ`,
      fn: async () => {
        setActionId(item.id);
        try {
          const res = await shopApi.purchase(item.id);
          await refreshUser();
          await loadItems();
          showToast(res.message);
        } catch (e: any) {
          showToast(e.message);
        } finally {
          setActionId(null);
        }
      },
    });
  };

  const handleEquip = async (item: ShopItem) => {
    setActionId(item.id);
    try {
      const res = await shopApi.equip(item.id);
      await loadItems();
      showToast(res.message);
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setActionId(null);
    }
  };

  return (
    <PageLayout title="Магазин" backTo="/">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: '#232840', border: '1px solid #F5C842', borderRadius: 12,
          padding: '10px 20px', fontSize: 13, color: '#F5C842',
          zIndex: 9999, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      {/* Balance */}
      {user && (
        <div style={{ margin: '4px 18px 8px', padding: '10px 14px', background: '#1C2030', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#A8B0C8' }}>Баланс</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#F5C842', fontFamily: 'JetBrains Mono, monospace' }}>
            {fmtBalance(user.balance)} ᚙ
          </span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', margin: '0 18px 16px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 3, gap: 2 }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8,
            fontFamily: 'inherit', fontSize: 10, fontWeight: 600,
            color: tab === t ? (t === 'ton' ? '#0098EA' : '#F0F2F8') : '#A8B0C8',
            background: tab === t ? '#232840' : 'transparent', cursor: 'pointer',
          }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* TON Tab */}
      {tab === 'ton' && (
        <TonTab user={user} showToast={showToast} onUserRefresh={refreshUser} />
      )}

      {/* Items grid */}
      {tab !== 'ton' && (
        loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6B7494', fontSize: 13 }}>Загрузка...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6B7494', fontSize: 13 }}>Нет предметов</div>
        ) : (
          <>
            {/* Rarity filter */}
            {tab !== 'themes' && (
              <div style={{ display: 'flex', gap: 6, padding: '0 18px 10px', flexWrap: 'wrap' }}>
                {['ALL', 'COMMON', 'RARE', 'EPIC', 'LEGENDARY'].map(r => {
                  const active = (shopFilter === r);
                  return (
                    <button key={r} onClick={() => setShopFilter(r)} style={{
                      padding: '4px 10px', border: `1px solid ${active ? (RARITY_COLOR[r] ?? '#F5C842') : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 20, background: active ? `${RARITY_COLOR[r] ?? '#F5C842'}18` : 'transparent',
                      color: active ? (RARITY_COLOR[r] ?? '#F5C842') : '#A8B0C8', fontSize: 10, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {r === 'ALL' ? 'Все' : RARITY_LABEL[r]}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 18px 24px' }}>
              {items.filter(item => shopFilter === 'ALL' || item.rarity === shopFilter).map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  loading={actionId === item.id}
                  onPurchase={() => tab === 'themes' ? handleThemePurchase(item) : handlePurchase(item)}
                  onEquip={() => tab === 'themes' ? handleThemeApply(item) : handleEquip(item)}
                />
              ))}
            </div>
          </>
        )
      )}

      {/* Подтверждение покупки */}
      {buyConfirm && (
        <ConfirmModal
          icon="🛒"
          title={buyConfirm.title}
          message={buyConfirm.msg}
          confirmLabel="Купить"
          variant="default"
          onConfirm={() => { const fn = buyConfirm.fn; setBuyConfirm(null); fn(); }}
          onCancel={() => setBuyConfirm(null)}
        />
      )}
    </PageLayout>
  );
};

interface ItemCardProps {
  item: ShopItem;
  loading: boolean;
  onPurchase: () => void;
  onEquip: () => void;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, loading, onPurchase, onEquip }) => {
  const rarityColor = RARITY_COLOR[item.rarity] || '#A8B0C8';
  const isEquipped = item.equipped;
  const isOwned = item.owned;

  return (
    <div style={{
      background: '#1C2030',
      border: `${isEquipped ? '2px' : '1px'} solid ${isEquipped ? '#F5C842' : `${rarityColor}33`}`,
      borderRadius: 18, padding: 12, display: 'flex', flexDirection: 'column',
      gap: 8, position: 'relative', overflow: 'hidden',
    }}>
      {/* Rarity glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${rarityColor}, transparent)`,
        opacity: 0.6,
      }} />

      {/* Preview image */}
      <div style={{
        width: '100%', aspectRatio: '1',
        borderRadius: 12, overflow: 'hidden',
        background: '#13161E', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        ) : (
          <span style={{ fontSize: 32, opacity: 0.4 }}>🎮</span>
        )}
      </div>

      {/* Name + rarity */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F2F8', lineHeight: 1.3 }}>{item.name}</div>
        <div style={{ fontSize: 10, color: rarityColor, marginTop: 2, fontWeight: 600 }}>
          {RARITY_LABEL[item.rarity] || item.rarity}
        </div>
      </div>

      {/* Action button */}
      {isEquipped ? (
        <div style={{ fontSize: 11, color: '#00D68F', fontWeight: 700, textAlign: 'center', padding: '4px 0' }}>
          ✓ Надето
        </div>
      ) : isOwned ? (
        <button
          onClick={onEquip}
          disabled={loading}
          style={{ ...btnStyle, background: '#7B61FF', color: '#fff' }}
        >
          {loading ? '...' : 'Надеть'}
        </button>
      ) : (
        <button
          onClick={onPurchase}
          disabled={loading}
          style={{ ...btnStyle, background: '#F5C842', color: '#0B0D11' }}
        >
          {loading ? '...' : `${fmtBalance(item.priceCoins)} ᚙ`}
        </button>
      )}
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '7px 10px', border: 'none', borderRadius: 10,
  fontSize: 11, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit', width: '100%',
};

const heroCard: React.CSSProperties = {
  padding: '24px 20px',
  background: 'linear-gradient(135deg, #0D1B2A, #0A1628)',
  border: '1px solid rgba(0,152,234,0.25)',
  borderRadius: 20,
  display: 'flex', flexDirection: 'column', alignItems: 'center',
};
