import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { PageLayout, useInfoPopup, InfoPopup } from '@/components/layout/PageLayout';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { shopApi, authApi, tonApi, profileApi } from '@/api';
import { connectWallet, sendVerificationPayment, getWalletAddress } from '@/lib/tonconnect';
import { useUserStore } from '@/store/useUserStore';
import { fmtBalance } from '@/utils/format';
import type { ShopItem, ItemType } from '@/types';
import { setActiveTheme, getActiveTheme, THEMES } from '@/lib/theme';
import type { ThemeKey } from '@/lib/theme';
import { useT } from '@/i18n/useT';
import { ExchangeTab } from './ExchangeTab';
import { ItemCard, AvatarItemCard, RARITY_COLOR } from '@/components/shop/ShopItemCards';

// N6: 6 вкладок покупок (объединены Фигуры = pieces+pieceSets+anims) + TON отдельно сверху
// S1: 6 вкладок в 2 ряда по 3: [Аватары|Рамки|Визуал] / [Темы|Эффекты|Биржа]
type Tab = 'avatars' | 'frames' | 'visual' | 'themes' | 'effects' | 'exchange';

// S1: маппинг вкладок → типы товаров
// 'visual' = Доски + Фигуры (subtabs внутри), 'exchange' = биржа (нет товаров)
const TAB_TYPE: Partial<Record<Tab, ItemType | ItemType[]>> = {
  avatars:  'PREMIUM_AVATAR',
  frames:   'AVATAR_FRAME',
  visual:   'BOARD_SKIN',   // default subtab; внутри ещё subtab Фигуры
  effects:  ['WIN_ANIMATION', 'CAPTURE_EFFECT', 'SPECIAL_MOVE'],
  themes:   'THEME',
  // exchange — не загружает товары, рендерит ExchangeTab
};


// TAB_LABELS moved to t.shop.tabs

// Map item name to ThemeKey
const THEME_NAME_TO_KEY: Record<string, ThemeKey> = {
  'Binance Pro':   'binance',
  'Chess Classic': 'chess_classic',
  'Neon Cyber':    'neon_cyber',
  'Royal Gold':    'royal_gold',
  'Matrix Dark':   'matrix_dark',
  'Crystal Ice':   'crystal_ice',
};

// RARITY_COLOR imported from @/components/shop/ShopItemCards

// RARITY_LABEL moved to t.shop.rarity

const DEFAULT_TON_TO_COINS = 1_000_000;
const DEFAULT_USDT_TO_COINS = 200_000;
const FEE_PERCENT = 0.5;

// ── TON Tab ─────────────────────────────────────────────────
interface TonTabProps {
  user: import("@/types").User | null;
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
  const [tonHistory, setTonHistory] = useState<Array<Record<string,unknown>>>([]);
  const [connectStep, setConnectStep] = useState<'idle' | 'connecting' | 'paying' | 'verifying'>('idle');

  // Check if user already unlocked TON features (tonWalletAddress set)
  useEffect(() => {
    if (user?.tonWalletAddress) {
      setWalletConnected(true);
      setWalletAddress(user.tonWalletAddress);
      // Загружаем историю TON транзакций
      tonApi.history(10).then(r => setTonHistory(r.transactions ?? [])).catch(() => {});
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
    if (connectStep !== 'idle') return;
    try {
      // Шаг 1: подключаем кошелёк через TonConnect
      setConnectStep('connecting');
      showToast('Opening wallet...');
      const wallet = await connectWallet();
      const addr = wallet.account?.address;
      if (!addr) throw new Error('Failed to get wallet address');

      // Шаг 2: отправляем 1 TON платёж
      setConnectStep('paying');
      showToast('Confirm 1 TON payment in wallet...');
      const user = onUserRefresh as unknown as () => { id?: string };
      const userId = (window as unknown as { __userId?: string }).__userId ?? '';
      const boc = await sendVerificationPayment(userId);

      // Шаг 3: верифицируем на бэкенде
      setConnectStep('verifying');
      showToast('Verifying transaction...');
      // Ждём ~15 сек пока транзакция появится в блокчейне
      await new Promise(r => setTimeout(r, 15_000));
      await tonApi.verifyWallet(addr, boc);

      setWalletAddress(addr);
      setWalletConnected(true);
      showToast('✅ TON wallet connected!');
      onUserRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Connection error';
      if (msg.includes('not confirmed')) {
        showToast('⏳ ' + msg + ' — retrying');
        // Повторная попытка верификации через 30 сек
        setTimeout(async () => {
          try {
            const addr = await getWalletAddress();
            if (!addr) return;
            showToast('Re-verifying transaction...');
            await tonApi.verifyWallet(addr, '');
            setWalletAddress(addr);
            setWalletConnected(true);
            showToast('✅ TON wallet connected!');
            onUserRefresh();
          } catch {}
        }, 30_000);
      } else if (!msg.includes('Timeout') && !msg.includes('reject')) {
        showToast(msg);
      }
    } finally {
      setConnectStep('idle');
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
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary, #F0F2F8)', marginBottom: 6 }}>TON / USDT</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B92A8)', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
            Connect a TON wallet and get access to buying coins with real crypto and withdrawing earnings
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {[
              { ico: '🪙', text: 'Buy coins with TON or USDT', sub: '1 TON = 1,000,000 ᚙ' },
              { ico: '💸', text: 'Withdraw coins to TON', sub: '0.5% fee on all operations' },
              { ico: '🔒', text: 'One-time unlock payment', sub: '1 TON — forever' },
            ].map(r => (
              <div key={r.ico} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18 }}>{r.ico}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>{r.text}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>{r.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleConnectWallet}
            disabled={connectStep !== 'idle'}
            style={{ width: '100%', padding: '14px', background: 'var(--exchange-ton-shop-gradient, linear-gradient(90deg,#0098EA,#007AC2))', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {connectStep === 'idle' ? '💎 Connect TON Wallet' :
       connectStep === 'connecting' ? '🔗 Opening wallet...' :
       connectStep === 'paying' ? '💸 Awaiting payment...' :
       '⏳ Verifying...'}
          </button>
          <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', marginTop: 8, textAlign: 'center' }}>
            1 TON payment to unlock
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Wallet Info */}
      <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg, rgba(0,152,234,0.15), rgba(0,122,194,0.08))', border: '1px solid rgba(0,152,234,0.3)', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 22 }}>💎</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--color-blue, #0098EA)', fontWeight: 700, marginBottom: 2 }}>TON wallet connected</div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{walletAddress}</div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--green, #00D68F)', fontWeight: 700 }}>✓ Active</div>
      </div>

      {/* Balance row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, padding: '12px', background: 'var(--bg-card, #1C2030)', borderRadius: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', marginBottom: 4 }}>BALANCE ᚙ</div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 14, fontWeight: 700, color: 'var(--accent, #F5C842)' }}>{fmtBalance(user?.balance ?? '0')}</div>
        </div>
        <div style={{ flex: 1, padding: '12px', background: 'var(--bg-card, #1C2030)', borderRadius: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', marginBottom: 4 }}>RATE</div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, fontWeight: 700, color: 'var(--color-blue, #0098EA)' }}>1 TON = {(tonToCoins / 1000).toFixed(0)}K ᚙ</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted, #4A5270)', marginTop: 2 }}>≈ ${tonUsdt.toFixed(2)}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['buy', 'sell', 'withdraw'] as const).map(a => (
          <button key={a} onClick={() => setActiveAction(activeAction === a ? null : a)} style={{
            flex: 1, padding: '10px 4px', border: 'none', borderRadius: 12, fontFamily: 'inherit',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: activeAction === a ? (a === 'buy' ? 'var(--color-blue, #0098EA)' : a === 'sell' ? 'var(--color-purple-dark, #7B61FF)' : 'var(--color-green, #00D68F)') : 'var(--bg-card, #1C2030)',
            color: activeAction === a ? '#fff' : 'var(--text-secondary, #8B92A8)',
          }}>
            {a === 'buy' ? '📥 Buy' : a === 'sell' ? '📤 Sell' : '🏦 Withdraw'}
          </button>
        ))}
      </div>

      {/* Buy panel */}
      {activeAction === 'buy' && (
        <div style={{ padding: '16px', background: 'var(--bg-card, #13161E)', border: '1px solid rgba(0,152,234,0.2)', borderRadius: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', marginBottom: 12 }}>Buy coins</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {[{ label: '0.5 TON', val: '0.5', ton: true }, { label: '1 TON', val: '1', ton: true }, { label: '10 USDT', val: '10', ton: false }].map(opt => {
              const c = calcCoins(opt.val, opt.ton);
              return (
                <button key={opt.label} onClick={() => setAmount(opt.val)} style={{ flex: 1, padding: '8px 4px', border: `1px solid ${amount === opt.val ? 'var(--color-blue, #0098EA)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, background: amount === opt.val ? 'rgba(0,152,234,0.12)' : 'var(--bg-card, #1C2030)', color: 'var(--text-primary, #F0F2F8)', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <div>{opt.label}</div>
                  <div style={{ color: 'var(--accent, #F5C842)', marginTop: 2 }}>+{fmtBalance(String(Math.round(c.net)))} ᚙ</div>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              placeholder="TON amount"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'var(--text-primary, #F0F2F8)', fontSize: 13, fontFamily: 'inherit' }}
            />
            <button
              disabled={processing || !amount}
              style={{ padding: '10px 16px', background: processing ? '#555' : 'var(--color-blue, #0098EA)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: processing ? 'default' : 'pointer', fontFamily: 'inherit' }}
              onClick={async () => {
                if (!amount || parseFloat(amount) < 0.1) { showToast('Minimum 0.1 TON'); return; }
                setProcessing(true);
                try {
                  const r = await tonApi.buy(parseFloat(amount));
                  showToast(`✅ Credited ${fmtBalance(String(r.coinsReceived))} ᚙ`);
                  setAmount('');
                  onUserRefresh();
                } catch (e: unknown) { showToast((e instanceof Error ? e.message : "Error") || 'Error'); }
                finally { setProcessing(false); }
              }}
            >
              {processing ? '...' : 'Buy'}
            </button>
          </div>
          {amount && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary, #8B92A8)', lineHeight: 1.8 }}>
              {(() => { const c = calcCoins(amount, true); return <>
                <div>You receive: <b style={{ color: 'var(--accent, #F5C842)' }}>{fmtBalance(String(Math.round(c.net)))} ᚙ</b></div>
                <div>Fee {FEE_PERCENT}%: {fmtBalance(String(Math.round(c.fee)))} ᚙ</div>
              </>; })()}
            </div>
          )}
        </div>
      )}

      {/* Sell panel */}
      {activeAction === 'sell' && (
        <div style={{ padding: '16px', background: 'var(--bg-card, #13161E)', border: '1px solid rgba(123,97,255,0.2)', borderRadius: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', marginBottom: 12 }}>Sell coins for TON</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              placeholder="Amount ᚙ"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'var(--text-primary, #F0F2F8)', fontSize: 13, fontFamily: 'inherit' }}
            />
            <button
              disabled={processing || !amount}
              style={{ padding: '10px 16px', background: processing ? '#555' : '#7B61FF', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: processing ? 'default' : 'pointer', fontFamily: 'inherit' }}
              onClick={async () => {
                if (!amount || BigInt(amount.replace(/\D/g,'') || '0') < 1_000_000n) { showToast('Minimum 1,000,000 ᚙ'); return; }
                setProcessing(true);
                try {
                  const r = await tonApi.sell(amount.replace(/\D/g,''));
                  showToast(`✅ Order created: ${r.tonAmount.toFixed(4)} TON`);
                  setAmount('');
                  onUserRefresh();
                } catch (e: unknown) { showToast((e instanceof Error ? e.message : "Error") || 'Error'); }
                finally { setProcessing(false); }
              }}
            >
              {processing ? '...' : 'Sell'}
            </button>
          </div>
          {amount && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary, #8B92A8)', lineHeight: 1.8 }}>
              {(() => { const c = calcWithdraw(amount); return <>
                <div>You receive: <b style={{ color: 'var(--color-blue, #0098EA)' }}>{c.net.toFixed(4)} TON</b></div>
                <div>Fee {FEE_PERCENT}%: {c.fee.toFixed(4)} TON</div>
              </>; })()}
            </div>
          )}
        </div>
      )}

      {/* Withdraw panel */}
      {activeAction === 'withdraw' && (
        <div style={{ padding: '16px', background: 'var(--bg-card, #13161E)', border: '1px solid rgba(0,214,143,0.2)', borderRadius: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', marginBottom: 4 }}>Withdraw to TON</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginBottom: 12 }}>To wallet: {walletAddress?.slice(0, 12)}...{walletAddress?.slice(-6)}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              placeholder="Amount ᚙ"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'var(--text-primary, #F0F2F8)', fontSize: 13, fontFamily: 'inherit' }}
            />
            <button
              disabled={processing || !amount}
              style={{ padding: '10px 16px', background: processing ? '#555' : 'var(--green, #00D68F)', color: 'var(--bg, #0B0D11)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: processing ? 'default' : 'pointer', fontFamily: 'inherit' }}
              onClick={async () => {
                if (!amount || BigInt(amount.replace(/\D/g,'') || '0') < 1_000_000n) { showToast('Minimum 1,000,000 ᚙ'); return; }
                setProcessing(true);
                try {
                  const r = await tonApi.withdraw(amount.replace(/\D/g,''));
                  showToast(`✅ Order created: ${(r as Record<string,unknown> & { netTon?: number }).netTon?.toFixed(4)} TON`);
                  setAmount('');
                  onUserRefresh();
                } catch (e: unknown) { showToast((e instanceof Error ? e.message : "Error") || 'Error'); }
                finally { setProcessing(false); }
              }}
            >
              {processing ? '...' : 'Withdraw'}
            </button>
          </div>
          {amount && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary, #8B92A8)', lineHeight: 1.8 }}>
              {(() => { const c = calcWithdraw(amount); return <>
                <div>You receive: <b style={{ color: 'var(--green, #00D68F)' }}>{c.net.toFixed(4)} TON</b></div>
                <div>Fee {FEE_PERCENT}%: {c.fee.toFixed(4)} TON</div>
                <div style={{ color: 'var(--text-muted, #4A5270)' }}>≈ {(c.net * 5.5).toFixed(2)} USDT</div>
              </>; })()}
            </div>
          )}
        </div>
      )}

      {/* История TON операций */}
      <div style={{ padding: '14px', background: 'var(--bg-card, #1C2030)', borderRadius: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #4A5270)', marginBottom: 8 }}>TRANSACTION HISTORY</div>
        {tonHistory.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted, #4A5270)', textAlign: 'center', padding: '12px 0' }}>
            No TON transactions
          </div>
        ) : (
          tonHistory.slice(0, 5).map((tx, i) => {
            const type = tx.type as string;
            const amount = tx.amount as string;
            const date = new Date(tx.createdAt as string);
            const isIn = ['TON_DEPOSIT'].includes(type);
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>
                    {type === 'TON_DEPOSIT' ? '📥 Deposit' : type === 'WITHDRAWAL' ? '📤 Withdrawal' : '🔒 Verification'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)' }}>
                    {date.toLocaleDateString('en-US')}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isIn ? 'var(--green, #00D68F)' : '#FF4D6A', fontFamily: 'JetBrains Mono, monospace' }}>
                  {isIn ? '+' : '-'}{fmtBalance(amount)} ᚙ
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ── Main Shop ────────────────────────────────────────────────
export const ShopPage: React.FC = () => {
  const t = useT();
  const { user, setUser } = useUserStore();
  const location = useLocation();
  // Deep link: navigate('/shop', { state: { tab: 'frames', highlightItemId: 'item_123' } })
  const initTab = (location.state as Record<string,unknown>)?.tab as Tab ?? 'avatars'; // N6: по умолчанию Аватары
  const highlightItemId: string | null = ((location.state as Record<string,unknown>)?.highlightItemId as string) ?? null;
  const [tab, setTab] = useState<Tab>(initTab);
  const [visualSubType, setVisualSubType] = useState<'BOARD_SKIN'|'PIECE_SKIN'|'PIECE_SET'|'MOVE_ANIMATION'|'FONT'>('BOARD_SKIN');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showTon, setShowTon] = useState(false);
  const shopSlides = [
    { icon: '🎭', title: t?.shop?.title ?? 'Магазин ChessCoin', desc: 'Покупай аватары, рамки, доски и темы за монеты ᚙ. Подключи TON кошелек для вывода или покупки за TON/USDT.' },
    { icon: '✨', title: 'Как использовать предметы', desc: 'Купи предмет, затем нажми "Применить". Он мгновенно появится в твоем профиле и будет виден для других игроков.' },
    { icon: '💎', title: 'TON Wallet', desc: 'Подключи TON кошелек чтобы выводить заработанные монеты. Курс конвертации обновляется автоматически.' },
  ];
  const shopInfo = useInfoPopup('shop', shopSlides); // N6: TON modal
  const [confirmPurchase, ConfirmPurchaseDialog] = useConfirm(); // N9

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const refreshUser = useCallback(async () => {
    try { const u = await authApi.me(); setUser(u); } catch {}
  }, [setUser]);

  const loadItems = useCallback(async () => {
    const tabType = TAB_TYPE[tab];
    if (!tabType) return; // exchange и др. не загружают товары
    setLoading(true);
    try {
      // S1: для visual загружаем только текущий субтаб
      if (tab === 'visual') {
        const data = await shopApi.getItems(visualSubType);
        setItems(data.items);
      } else if (Array.isArray(tabType)) {
        const results = await Promise.all(tabType.map(t => shopApi.getItems(t)));
        setItems(results.flatMap(r => r.items));
      } else {
        const data = await shopApi.getItems(tabType);
        setItems(data.items);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, visualSubType]);

  const handleThemePurchase = async (item: ShopItem) => {
    if (!await confirmPurchase({ title: `Buy "${item.name}"?`, message: `Price: ${fmtBalance(item.priceCoins)} ᚙ`, okLabel: 'Buy' })) return;
    setActionId(item.id);
    try {
      const res = await shopApi.purchase(item.id);
      await refreshUser();
      await loadItems();
      // Apply theme immediately after purchase
      const key = THEME_NAME_TO_KEY[item.name] ?? 'default';
      setActiveTheme(key);
      profileApi.saveTheme(key).catch(() => {});
      showToast(`✅ Theme "${item.name}" purchased and applied!`);
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : "Error"));
    } finally {
      setActionId(null);
    }
  };

  const handleThemeApply = (item: ShopItem) => {
    const key = THEME_NAME_TO_KEY[item.name] ?? 'default';
    setActiveTheme(key);
    profileApi.saveTheme(key).catch(() => {});
    showToast(`Theme "${item.name}" applied`);
  };

  useEffect(() => { loadItems(); }, [loadItems]);

  const handlePurchase = async (item: ShopItem) => {
    if (!await confirmPurchase({ title: `Buy "${item.name}"?`, message: `Price: ${fmtBalance(item.priceCoins)} ᚙ`, okLabel: 'Buy' })) return;
    setActionId(item.id);
    try {
      const res = await shopApi.purchase(item.id);
      await refreshUser();
      await loadItems();
      showToast(res.message);
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : "Error"));
    } finally {
      setActionId(null);
    }
  };

  const handleEquip = async (item: ShopItem) => {
    setActionId(item.id);
    try {
      const res = await shopApi.equip(item.id);
      await refreshUser();
      await loadItems();
      showToast(res.message);
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : "Error"));
    } finally {
      setActionId(null);
    }
  };

  // Снять надетый аватар (вернуть Telegram/градиент)
  const handleUnequip = async (item: ShopItem) => {
    setActionId(item.id);
    try {
      await shopApi.unequip(item.id);
      await refreshUser();
      await loadItems();
      showToast('Avatar unequipped');
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : "Error"));
    } finally {
      setActionId(null);
    }
  };

  return (
    <PageLayout title={t.shop.title} centered>
      {shopInfo.show && <InfoPopup infoKey="shop" slides={shopSlides} onClose={shopInfo.close} />}
      {/* N9: Кастомный диалог подтверждения покупки */}
      {ConfirmPurchaseDialog}
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-input, #232840)', border: '1px solid #F5C842', borderRadius: 12,
          padding: '10px 20px', fontSize: 13, color: 'var(--accent, #F5C842)',
          zIndex: "var(--z-toast, 400)", fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      {/* N6: TON модал — открывается по клику на кнопку сверху */}
      {showTon && (
        <div
          onClick={(e) => e.target === e.currentTarget && setShowTon(false)}
          style={{ position: 'fixed', inset: 0, zIndex: "var(--z-modal, 300)", background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end' }}
        >
          <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg-card, #13161F)', borderRadius: '24px 24px 0 0', border: '1px solid rgba(0,152,234,0.3)', borderBottom: 'none', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-blue, #0098EA)' }}>💎 TON Wallet</div>
              <button onClick={() => setShowTon(false)} style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#8B92A8', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
            </div>
            <TonTab user={user} showToast={showToast} onUserRefresh={refreshUser} />
          </div>
        </div>
      )}

      {/* Balance */}
      {user && (
        <div style={{ margin: '4px 18px 8px', padding: '10px 14px', background: 'var(--bg-card, #1C2030)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #8B92A8)' }}>Balance</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent, #F5C842)', fontFamily: 'JetBrains Mono, monospace' }}>
            {fmtBalance(user.balance)} ᚙ
          </span>
        </div>
      )}

      {/* N6: TON — синяя кнопка сверху, отдельно от вкладок покупок */}
      <div style={{ margin: '0 18px 14px' }}>
        <button
          onClick={() => setShowTon(true)}
          style={{
            width: '100%', padding: '13px 18px',
            background: 'var(--shop-ton-wallet-gradient, linear-gradient(135deg, #0098EA, #006BBF))',
            border: 'none', borderRadius: 14,
            display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 20px rgba(0,152,234,0.3)',
          }}
        >
          <span style={{ fontSize: 24 }}>💎</span>
          <div style={{ textAlign: 'left' as const }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{t.shop.tonTab.connectWallet.replace('💎 ', '')}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>{t.shop.tonTab.benefits[0].text}</div>
          </div>
          <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.7)', fontSize: 18 }}>→</span>
        </button>
      </div>

      {/* N6: 6 вкладок покупок в 2 ряда по 3 */}
      {(() => {
        // S1: Ровно 6 вкладок в 2 ряда по 3
        const SHOP_TABS: { key: Tab; label: string }[] = [
          { key: 'avatars',   label: t.shop.tabs.avatars   },
          { key: 'frames',    label: t.shop.tabs.frames    },
          { key: 'visual',    label: t.shop.tabs.visual    },
          { key: 'themes',    label: t.shop.tabs.themes    },
          { key: 'effects',   label: t.shop.tabs.effects   },
          { key: 'exchange',  label: t.shop.tabs.exchange  },
        ];
        const rows = [SHOP_TABS.slice(0, 3), SHOP_TABS.slice(3, 6)];
        return (
          <div style={{ margin: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.map((row, ri) => (
              <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {row.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    style={{
                      padding: '10px 6px', borderRadius: 12,
                      fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', transition: 'all .15s',
                      background: tab === key ? 'rgba(245,200,66,0.15)' : 'var(--bg-card, #1C2030)',
                      color: tab === key ? 'var(--accent, #F5C842)' : 'var(--text-secondary, #8B92A8)',
                      border: `1px solid ${tab === key ? 'rgba(245,200,66,0.35)' : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Заголовок вкладки эффектов */}
      {tab === 'effects' && (
        <div style={{ margin: '0 18px 8px', padding: '10px 14px', background: 'rgba(155,133,255,0.08)', borderRadius: 12, border: '1px solid rgba(155,133,255,0.2)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9B85FF', marginBottom: 3 }}>🎬 Game Effects</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted, #4A5270)' }}>Win animations · Capture effects · Opening styles</div>
        </div>
      )}

      {/* S1: Визуал — сабтабы Доски / Фигуры */}
      {tab === 'visual' && (
        <div style={{ margin: '0 18px 10px', display: 'flex', background: 'var(--bg-card, #1C2030)', borderRadius: 10, padding: 3, gap: 2 }}>
          {([
            ['BOARD_SKIN',   t.shop.visualTabs.boards],
            ['PIECE_SKIN',   t.shop.visualTabs.pieces],
            ['PIECE_SET',    t.shop.visualTabs.sets],
            ['MOVE_ANIMATION', t.shop.visualTabs.animations],
            ['FONT', t.shop.visualTabs.fonts],
          ] as const).map(([type, label]) => (
            <button key={type} onClick={() => setVisualSubType(type)} style={{
              flex: 1, padding: '7px 4px', border: 'none', borderRadius: 8,
              fontFamily: 'inherit', fontSize: 10, fontWeight: 600, cursor: 'pointer',
              background: visualSubType === type ? 'var(--bg-input, #232840)' : 'transparent',
              color: visualSubType === type ? 'var(--text-primary, #F0F2F8)' : 'var(--text-secondary, #8B92A8)',
            }}>{label}</button>
          ))}
        </div>
      )}

      {/* S2: Биржа — ExchangeTab (отдельный компонент) */}
      {tab === 'exchange' && (
        <ExchangeTab user={user} showToast={showToast} onUserRefresh={refreshUser} />
      )}

      {tab === 'avatars' && (
        loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted, #4A5270)', fontSize: 13 }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted, #4A5270)', fontSize: 13 }}>No avatars</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '0 18px 24px' }}>
            {/* Подсказка */}
            <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginBottom: 12, lineHeight: 1.5 }}>
              Buy a premium avatar and click <b style={{ color: 'var(--accent, #F5C842)' }}>Apply</b> — it will appear in your profile.
              Other players will see your avatar on your profile and can navigate here.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {items.map((item) => (
                <AvatarItemCard
                  key={item.id}
                  item={item}
                  loading={actionId === item.id}
                  highlighted={item.id === highlightItemId}
                  onPurchase={() => handlePurchase(item)}
                  onEquip={() => handleEquip(item)}
                  onUnequip={() => handleUnequip(item)}
                />
              ))}
            </div>
          </div>
        )
      )}

      {/* Все остальные вкладки кроме avatars и exchange — стандартная сетка */}
      {tab !== 'avatars' && tab !== 'exchange' && (
        loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted, #4A5270)', fontSize: 13 }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted, #4A5270)', fontSize: 13 }}>
            'No items'
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 18px 24px' }}>
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                loading={actionId === item.id}
                highlighted={item.id === highlightItemId}
                onPurchase={() => handlePurchase(item)}
                onEquip={() => handleEquip(item)}
              />
            ))}
          </div>
        )
      )}
    </PageLayout>
  );
};
const heroCard: React.CSSProperties = {
  padding: 'var(--space-xl)',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
};
