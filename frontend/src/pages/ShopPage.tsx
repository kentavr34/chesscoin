import React, { useState, useEffect, useCallback } from 'react';
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
const TAB_TYPE: Partial<Record<Tab, ItemType | ItemType[]>> = {
  avatars:  ['PIECE_SET', 'PIECE_SKIN'],  // наборы/скины фигур (PREMIUM_AVATAR в разработке)
  frames:   'AVATAR_FRAME',
  visual:   'BOARD_SKIN',
  effects:  'MOVE_ANIMATION',             // анимации ходов (WIN_ANIMATION/CAPTURE_EFFECT в разработке)
  themes:   'THEME',
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

const DEFAULT_TON_TO_COINS = 1_000_000;
const DEFAULT_USDT_TO_COINS = 200_000;
const FEE_PERCENT = 0.5;

// ── Premium Dark style constants ─────────────────────────────
const S = {
  card: {
    background: 'linear-gradient(135deg,#141018,#0F0E18)',
    border: '.5px solid rgba(154,148,144,.22)',
    borderRadius: 16,
  } as React.CSSProperties,
  sectionLabel: {
    fontSize: '.58rem',
    fontWeight: 700,
    color: '#7A7875',
    textTransform: 'uppercase' as const,
    letterSpacing: '.14em',
  } as React.CSSProperties,
  primaryText: { color: '#EAE2CC' } as React.CSSProperties,
  mutedText: { color: '#7A7875' } as React.CSSProperties,
  goldBtn: {
    background: 'linear-gradient(135deg,#2A1E08,#4A3810)',
    border: '.5px solid rgba(212,168,67,.42)',
    color: '#F0C85A',
    borderRadius: 12,
    padding: '12px 20px',
    fontWeight: 900,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all .15s',
  } as React.CSSProperties,
  input: {
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(255,255,255,.1)',
    color: '#EAE2CC',
    borderRadius: 10,
    padding: '10px 14px',
    fontFamily: 'inherit',
    fontSize: 13,
    outline: 'none',
  } as React.CSSProperties,
};

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

  useEffect(() => {
    if (user?.tonWalletAddress) {
      setWalletConnected(true);
      setWalletAddress(user.tonWalletAddress);
      tonApi.history(10).then(r => setTonHistory(r.transactions ?? [])).catch(() => {});
    }
  }, [user]);

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
      setConnectStep('connecting');
      showToast('Opening wallet...');
      const wallet = await connectWallet();
      const addr = wallet.account?.address;
      if (!addr) throw new Error('Failed to get wallet address');

      setConnectStep('paying');
      showToast('Confirm 1 TON payment in wallet...');
      const userId = user?.id ?? '';
      const boc = await sendVerificationPayment(userId);

      setConnectStep('verifying');
      showToast('Verifying transaction...');
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
        <div style={{ ...S.card, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          {/* Diamond icon */}
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,rgba(0,152,234,.18),rgba(0,122,194,.08))', border: '.5px solid rgba(0,152,234,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 14 }}>
            💎
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#EAE2CC', marginBottom: 6 }}>TON / USDT</div>
          <div style={{ fontSize: 12, color: '#7A7875', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
            Connect a TON wallet and get access to buying coins with real crypto and withdrawing earnings
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {[
              { ico: '🪙', text: 'Buy coins with TON or USDT', sub: '1 TON = 1,000,000 ᚙ' },
              { ico: '💸', text: 'Withdraw coins to TON', sub: '0.5% fee on all operations' },
              { ico: '🔒', text: 'One-time unlock payment', sub: '1 TON — forever' },
            ].map(r => (
              <div key={r.ico} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '.5px solid rgba(154,148,144,.14)', borderRadius: 12, alignItems: 'flex-start', transition: 'all .15s' }}>
                <span style={{ fontSize: 18 }}>{r.ico}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#EAE2CC' }}>{r.text}</div>
                  <div style={{ fontSize: 10, color: '#7A7875', marginTop: 2 }}>{r.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleConnectWallet}
            disabled={connectStep !== 'idle'}
            style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#0098EA,#006BBF)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: connectStep === 'idle' ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'all .15s', opacity: connectStep !== 'idle' ? 0.7 : 1 }}
          >
            {connectStep === 'idle' ? '💎 Connect TON Wallet' :
             connectStep === 'connecting' ? '🔗 Opening wallet...' :
             connectStep === 'paying' ? '💸 Awaiting payment...' :
             '⏳ Verifying...'}
          </button>
          <div style={{ fontSize: 10, color: '#7A7875', marginTop: 8, textAlign: 'center' }}>
            1 TON payment to unlock
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Wallet Info */}
      <div style={{ padding: '13px 15px', background: 'linear-gradient(135deg,rgba(0,152,234,.12),rgba(0,122,194,.06))', border: '.5px solid rgba(0,152,234,.28)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 22 }}>💎</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#0098EA', fontWeight: 700, marginBottom: 2 }}>TON wallet connected</div>
          <div style={{ fontSize: 10, color: '#7A7875', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{walletAddress}</div>
        </div>
        <div style={{ fontSize: 10, color: '#3DBA7A', fontWeight: 700 }}>✓ Active</div>
      </div>

      {/* Balance row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, padding: '12px', ...S.card, borderRadius: 12, textAlign: 'center' }}>
          <div style={{ ...S.sectionLabel, marginBottom: 4 }}>BALANCE ᚙ</div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 14, fontWeight: 700, color: '#F5C842' }}>{fmtBalance(user?.balance ?? '0')}</div>
        </div>
        <div style={{ flex: 1, padding: '12px', ...S.card, borderRadius: 12, textAlign: 'center' }}>
          <div style={{ ...S.sectionLabel, marginBottom: 4 }}>RATE</div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, fontWeight: 700, color: '#0098EA' }}>1 TON = {(tonToCoins / 1000).toFixed(0)}K ᚙ</div>
          <div style={{ fontSize: 9, color: '#7A7875', marginTop: 2 }}>≈ ${tonUsdt.toFixed(2)}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['buy', 'sell', 'withdraw'] as const).map(a => {
          const isActive = activeAction === a;
          const activeColor = a === 'buy' ? '#0098EA' : a === 'sell' ? '#7B61FF' : '#3DBA7A';
          return (
            <button key={a} onClick={() => setActiveAction(activeAction === a ? null : a)} style={{
              flex: 1, padding: '10px 4px', border: isActive ? `.5px solid ${activeColor}40` : '.5px solid rgba(154,148,144,.18)', borderRadius: 12, fontFamily: 'inherit',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
              background: isActive ? `${activeColor}18` : 'rgba(255,255,255,.04)',
              color: isActive ? activeColor : '#7A7875',
            }}>
              {a === 'buy' ? '📥 Buy' : a === 'sell' ? '📤 Sell' : '🏦 Withdraw'}
            </button>
          );
        })}
      </div>

      {/* Buy panel */}
      {activeAction === 'buy' && (
        <div style={{ padding: '16px', ...S.card, border: '.5px solid rgba(0,152,234,.22)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#EAE2CC', marginBottom: 12 }}>Buy coins</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[{ label: '0.5 TON', val: '0.5', ton: true }, { label: '1 TON', val: '1', ton: true }, { label: '10 USDT', val: '10', ton: false }].map(opt => {
              const c = calcCoins(opt.val, opt.ton);
              const isSelected = amount === opt.val;
              return (
                <button key={opt.label} onClick={() => setAmount(opt.val)} style={{
                  flex: 1, padding: '8px 4px',
                  border: isSelected ? '.5px solid rgba(0,152,234,.5)' : '.5px solid rgba(154,148,144,.18)',
                  borderRadius: 10,
                  background: isSelected ? 'rgba(0,152,234,.1)' : 'rgba(255,255,255,.04)',
                  color: '#EAE2CC', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                }}>
                  <div>{opt.label}</div>
                  <div style={{ color: '#F5C842', marginTop: 2 }}>+{fmtBalance(String(Math.round(c.net)))} ᚙ</div>
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
              style={{ ...S.input, flex: 1 }}
            />
            <button
              disabled={processing || !amount}
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
              style={{ padding: '10px 16px', background: processing ? 'rgba(255,255,255,.08)' : 'linear-gradient(135deg,#0065A0,#0098EA)', color: processing ? '#7A7875' : '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: processing ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
            >
              {processing ? '...' : 'Buy'}
            </button>
          </div>
          {amount && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#7A7875', lineHeight: 1.8 }}>
              {(() => { const c = calcCoins(amount, true); return <>
                <div>You receive: <b style={{ color: '#F5C842' }}>{fmtBalance(String(Math.round(c.net)))} ᚙ</b></div>
                <div>Fee {FEE_PERCENT}%: {fmtBalance(String(Math.round(c.fee)))} ᚙ</div>
              </>; })()}
            </div>
          )}
        </div>
      )}

      {/* Sell panel */}
      {activeAction === 'sell' && (
        <div style={{ padding: '16px', ...S.card, border: '.5px solid rgba(123,97,255,.22)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#EAE2CC', marginBottom: 12 }}>Sell coins for TON</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              placeholder="Amount ᚙ"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ ...S.input, flex: 1 }}
            />
            <button
              disabled={processing || !amount}
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
              style={{ padding: '10px 16px', background: processing ? 'rgba(255,255,255,.08)' : 'linear-gradient(135deg,#4A2E9A,#7B61FF)', color: processing ? '#7A7875' : '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: processing ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
            >
              {processing ? '...' : 'Sell'}
            </button>
          </div>
          {amount && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#7A7875', lineHeight: 1.8 }}>
              {(() => { const c = calcWithdraw(amount); return <>
                <div>You receive: <b style={{ color: '#0098EA' }}>{c.net.toFixed(4)} TON</b></div>
                <div>Fee {FEE_PERCENT}%: {c.fee.toFixed(4)} TON</div>
              </>; })()}
            </div>
          )}
        </div>
      )}

      {/* Withdraw panel */}
      {activeAction === 'withdraw' && (
        <div style={{ padding: '16px', ...S.card, border: '.5px solid rgba(61,186,122,.22)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#EAE2CC', marginBottom: 4 }}>Withdraw to TON</div>
          <div style={{ fontSize: 11, color: '#7A7875', marginBottom: 12 }}>To wallet: {walletAddress?.slice(0, 12)}...{walletAddress?.slice(-6)}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              placeholder="Amount ᚙ"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ ...S.input, flex: 1 }}
            />
            <button
              disabled={processing || !amount}
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
              style={{ padding: '10px 16px', background: processing ? 'rgba(255,255,255,.08)' : 'linear-gradient(135deg,#1A5C3A,#3DBA7A)', color: processing ? '#7A7875' : '#0D0D12', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: processing ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
            >
              {processing ? '...' : 'Withdraw'}
            </button>
          </div>
          {amount && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#7A7875', lineHeight: 1.8 }}>
              {(() => { const c = calcWithdraw(amount); return <>
                <div>You receive: <b style={{ color: '#3DBA7A' }}>{c.net.toFixed(4)} TON</b></div>
                <div>Fee {FEE_PERCENT}%: {c.fee.toFixed(4)} TON</div>
                <div style={{ color: '#7A7875' }}>≈ {(c.net * 5.5).toFixed(2)} USDT</div>
              </>; })()}
            </div>
          )}
        </div>
      )}

      {/* Transaction History */}
      <div style={{ padding: '14px', ...S.card }}>
        <div style={{ ...S.sectionLabel, marginBottom: 10 }}>TRANSACTION HISTORY</div>
        {tonHistory.length === 0 ? (
          <div style={{ fontSize: 12, color: '#7A7875', textAlign: 'center', padding: '12px 0' }}>
            No TON transactions
          </div>
        ) : (
          tonHistory.slice(0, 5).map((tx, i) => {
            const type = tx.type as string;
            const amount = tx.amount as string;
            const date = new Date(tx.createdAt as string);
            const isIn = ['TON_DEPOSIT'].includes(type);
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '.5px solid rgba(154,148,144,.12)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#EAE2CC' }}>
                    {type === 'TON_DEPOSIT' ? '📥 Deposit' : type === 'WITHDRAWAL' ? '📤 Withdrawal' : '🔒 Verification'}
                  </div>
                  <div style={{ fontSize: 10, color: '#7A7875' }}>
                    {date.toLocaleDateString('en-US')}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isIn ? '#3DBA7A' : '#FF4D6A', fontFamily: 'JetBrains Mono, monospace' }}>
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
  const initTab = (location.state as Record<string,unknown>)?.tab as Tab ?? 'avatars';
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
  const shopInfo = useInfoPopup('shop', shopSlides);
  const [confirmPurchase, ConfirmPurchaseDialog] = useConfirm();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const refreshUser = useCallback(async () => {
    try { const u = await authApi.me(); setUser(u); } catch {}
  }, [setUser]);

  const loadItems = useCallback(async () => {
    const tabType = TAB_TYPE[tab];
    if (!tabType) return;
    setLoading(true);
    try {
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

  const SHOP_TABS: { key: Tab; label: string }[] = [
    { key: 'avatars',   label: t.shop.tabs.avatars   },
    { key: 'frames',    label: t.shop.tabs.frames    },
    { key: 'visual',    label: t.shop.tabs.visual    },
    { key: 'themes',    label: t.shop.tabs.themes    },
    { key: 'effects',   label: t.shop.tabs.effects   },
    { key: 'exchange',  label: t.shop.tabs.exchange  },
  ];
  const tabRows = [SHOP_TABS.slice(0, 3), SHOP_TABS.slice(3, 6)];

  return (
    <PageLayout title={t.shop.title} centered>
      {shopInfo.show && <InfoPopup infoKey="shop" slides={shopSlides} onClose={shopInfo.close} />}
      {ConfirmPurchaseDialog}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg,#1A1508,#2A2010)',
          border: '.5px solid rgba(212,168,67,.42)',
          borderRadius: 12, padding: '10px 20px',
          fontSize: 13, color: '#F0C85A',
          zIndex: 400, fontWeight: 700, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,.5)',
        }}>
          {toast}
        </div>
      )}

      {/* TON modal — bottom sheet */}
      {showTon && (
        <div
          onClick={(e) => e.target === e.currentTarget && setShowTon(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(18px)', display: 'flex', alignItems: 'flex-end' }}
        >
          <div style={{ width: '100%', maxWidth: 480, background: 'linear-gradient(160deg,#12151E,#0E111A)', borderRadius: '24px 24px 0 0', border: '1px solid rgba(0,152,234,.22)', borderBottom: 'none', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#0098EA' }}>💎 TON Wallet</div>
              <button onClick={() => setShowTon(false)} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.07)', border: '.5px solid rgba(154,148,144,.2)', color: '#7A7875', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>✕</button>
            </div>
            <TonTab user={user} showToast={showToast} onUserRefresh={refreshUser} />
          </div>
        </div>
      )}

      {/* Balance bar */}
      {user && (
        <div style={{ margin: '4px 18px 10px', padding: '11px 16px', ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ ...S.sectionLabel }}>BALANCE</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: '#F5C842' }}>
            {fmtBalance(user.balance)} ᚙ
          </span>
        </div>
      )}

      {/* TON wallet button */}
      <div style={{ margin: '0 18px 14px' }}>
        <button
          onClick={() => setShowTon(true)}
          style={{
            width: '100%', padding: '13px 16px',
            background: 'linear-gradient(135deg,rgba(0,101,160,.6),rgba(0,152,234,.35))',
            border: '.5px solid rgba(0,152,234,.4)',
            borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 4px 20px rgba(0,152,234,.15)',
            transition: 'all .15s',
          }}
        >
          <span style={{ fontSize: 24 }}>💎</span>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#5BC8F5' }}>{t.shop.tonTab.connectWallet.replace('💎 ', '')}</div>
            <div style={{ fontSize: 11, color: 'rgba(91,200,245,.7)', marginTop: 1 }}>{t.shop.tonTab.benefits[0].text}</div>
          </div>
          <span style={{ color: 'rgba(91,200,245,.6)', fontSize: 18 }}>→</span>
        </button>
      </div>

      {/* Tab bar — 2 rows × 3 */}
      <div style={{ margin: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Tab container background */}
        <div style={{ background: 'rgba(255,255,255,.05)', borderRadius: 14, padding: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tabRows.map((row, ri) => (
            <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              {row.map(({ key, label }) => {
                const isActive = tab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    style={{
                      padding: '8px 4px', border: 'none', borderRadius: 10, fontFamily: 'inherit',
                      fontSize: 11, fontWeight: isActive ? 800 : 600, cursor: 'pointer', transition: 'all .15s',
                      background: isActive ? 'linear-gradient(135deg,#2A1E08,#4A3810)' : 'transparent',
                      color: isActive ? '#F0C85A' : '#7A7875',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Effects tab header */}
      {tab === 'effects' && (
        <div style={{ margin: '0 18px 10px', padding: '12px 14px', ...S.card, background: 'linear-gradient(135deg,rgba(155,133,255,.1),rgba(100,80,220,.06))', border: '.5px solid rgba(155,133,255,.22)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#EAE2CC', marginBottom: 3 }}>✨ Move Animations</div>
          <div style={{ fontSize: 11, color: '#7A7875' }}>Animate your pieces · Trails · Effects</div>
        </div>
      )}

      {/* Visual subtabs */}
      {tab === 'visual' && (
        <div style={{ margin: '0 18px 10px', display: 'flex', background: 'rgba(255,255,255,.05)', borderRadius: 10, padding: 3, gap: 2 }}>
          {([
            ['BOARD_SKIN',     t.shop.visualTabs.boards],
            ['PIECE_SKIN',     t.shop.visualTabs.pieces],
            ['PIECE_SET',      t.shop.visualTabs.sets],
            ['MOVE_ANIMATION', t.shop.visualTabs.animations],
            ['FONT',           t.shop.visualTabs.fonts],
          ] as const).map(([type, label]) => {
            const isActive = visualSubType === type;
            return (
              <button key={type} onClick={() => setVisualSubType(type)} style={{
                flex: 1, padding: '7px 4px', border: 'none', borderRadius: 8,
                fontFamily: 'inherit', fontSize: 10, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                background: isActive ? 'linear-gradient(135deg,#2A1E08,#4A3810)' : 'transparent',
                color: isActive ? '#F0C85A' : '#7A7875',
              }}>{label}</button>
            );
          })}
        </div>
      )}

      {/* Exchange tab */}
      {tab === 'exchange' && (
        <ExchangeTab user={user} showToast={showToast} onUserRefresh={refreshUser} />
      )}

      {/* Piece sets & skins grid */}
      {tab === 'avatars' && (
        loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#7A7875', fontSize: 13 }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#7A7875', fontSize: 13 }}>No items</div>
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

      {/* All other tabs except avatars and exchange */}
      {tab !== 'avatars' && tab !== 'exchange' && (
        loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#7A7875', fontSize: 13 }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#7A7875', fontSize: 13 }}>No items</div>
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
