import React, { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { shopApi, authApi, tonApi, profileApi } from '@/api';
import { useUserStore } from '@/store/useUserStore';
import { fmtBalance } from '@/utils/format';
import type { ShopItem, ItemType } from '@/types';
import { setActiveTheme, getActiveTheme, THEMES } from '@/lib/theme';
import type { ThemeKey } from '@/lib/theme';

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
  COMMON: '#8B92A8',
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

    setConnecting(true);
    try {
      // Show confirmation for one-time unlock payment
      const confirmed = confirm(
        'Подключение TON кошелька\n\n' +
        'Стоимость: 1 TON (одноразово)\n\n' +
        'Это откроет:\n• Покупка монет за TON/USDT\n• Вывод монет на кошелёк\n• Комиссия 0.5% на операции\n\nПродолжить?'
      );
      if (!confirmed) { setConnecting(false); return; }

      // In production: trigger TonConnect or TON Wallet connection
      // For now show address input simulation
      const addr = prompt('Введите адрес TON кошелька (UQ...)');
      if (!addr || !addr.startsWith('UQ')) {
        showToast('Неверный формат адреса TON');
        setConnecting(false);
        return;
      }

      // POST to backend to unlock + store wallet address
      await tonApi.connectWallet(addr);
      setWalletAddress(addr);
      setWalletConnected(true);
      showToast('✅ TON кошелёк подключён!');
      onUserRefresh();
    } catch (e: any) {
      showToast(e.message || 'Ошибка подключения');
    } finally {
      setConnecting(false);
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
          <div style={{ fontSize: 12, color: '#8B92A8', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
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
                  <div style={{ fontSize: 10, color: '#8B92A8', marginTop: 2 }}>{r.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleConnectWallet}
            disabled={connecting}
            style={{ width: '100%', padding: '14px', background: 'linear-gradient(90deg,#0098EA,#007AC2)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {connecting ? 'Подключение...' : '💎 Подключить TON кошелёк'}
          </button>
          <div style={{ fontSize: 10, color: '#4A5270', marginTop: 8, textAlign: 'center' }}>
            Оплата 1 TON для разблокировки
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
          <div style={{ fontSize: 11, color: '#0098EA', fontWeight: 700, marginBottom: 2 }}>TON кошелёк подключён</div>
          <div style={{ fontSize: 10, color: '#8B92A8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{walletAddress}</div>
        </div>
        <div style={{ fontSize: 10, color: '#00D68F', fontWeight: 700 }}>✓ Активен</div>
      </div>

      {/* Balance row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, padding: '12px', background: '#1C2030', borderRadius: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#4A5270', marginBottom: 4 }}>БАЛАНС ᚙ</div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 14, fontWeight: 700, color: '#F5C842' }}>{fmtBalance(user?.balance ?? '0')}</div>
        </div>
        <div style={{ flex: 1, padding: '12px', background: '#1C2030', borderRadius: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#4A5270', marginBottom: 4 }}>КУРС</div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, fontWeight: 700, color: '#0098EA' }}>1 TON = {(tonToCoins / 1000).toFixed(0)}K ᚙ</div>
          <div style={{ fontSize: 9, color: '#4A5270', marginTop: 2 }}>≈ ${tonUsdt.toFixed(2)}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['buy', 'sell', 'withdraw'] as const).map(a => (
          <button key={a} onClick={() => setActiveAction(activeAction === a ? null : a)} style={{
            flex: 1, padding: '10px 4px', border: 'none', borderRadius: 12, fontFamily: 'inherit',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: activeAction === a ? (a === 'buy' ? '#0098EA' : a === 'sell' ? '#7B61FF' : '#00D68F') : '#1C2030',
            color: activeAction === a ? '#fff' : '#8B92A8',
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
            <div style={{ marginTop: 10, fontSize: 11, color: '#8B92A8', lineHeight: 1.8 }}>
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
            <div style={{ marginTop: 10, fontSize: 11, color: '#8B92A8', lineHeight: 1.8 }}>
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
          <div style={{ fontSize: 11, color: '#8B92A8', marginBottom: 12 }}>На кошелёк: {walletAddress?.slice(0, 12)}...{walletAddress?.slice(-6)}</div>
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
            <div style={{ marginTop: 10, fontSize: 11, color: '#8B92A8', lineHeight: 1.8 }}>
              {(() => { const c = calcWithdraw(amount); return <>
                <div>Получишь: <b style={{ color: '#00D68F' }}>{c.net.toFixed(4)} TON</b></div>
                <div>Комиссия {FEE_PERCENT}%: {c.fee.toFixed(4)} TON</div>
                <div style={{ color: '#4A5270' }}>≈ {(c.net * 5.5).toFixed(2)} USDT</div>
              </>; })()}
            </div>
          )}
        </div>
      )}

      {/* Transaction history placeholder */}
      <div style={{ padding: '14px', background: '#1C2030', borderRadius: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#4A5270', marginBottom: 8 }}>ИСТОРИЯ ОПЕРАЦИЙ</div>
        <div style={{ fontSize: 12, color: '#4A5270', textAlign: 'center', padding: '12px 0' }}>
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

  const handleThemePurchase = async (item: ShopItem) => {
    if (!confirm(`Купить тему «${item.name}» за ${fmtBalance(item.priceCoins)} ᚙ?`)) return;
    setActionId(item.id);
    try {
      const res = await shopApi.purchase(item.id);
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
  };

  const handleThemeApply = (item: ShopItem) => {
    const key = THEME_NAME_TO_KEY[item.name] ?? 'default';
    setActiveTheme(key);
    profileApi.saveTheme(key).catch(() => {});
    showToast(`Тема «${item.name}» применена`);
  };

  useEffect(() => { loadItems(); }, [loadItems]);

  const handlePurchase = async (item: ShopItem) => {
    if (!confirm(`Купить «${item.name}» за ${fmtBalance(item.priceCoins)} ᚙ?`)) return;
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
          <span style={{ fontSize: 12, color: '#8B92A8' }}>Баланс</span>
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
            color: tab === t ? (t === 'ton' ? '#0098EA' : '#F0F2F8') : '#8B92A8',
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
          <div style={{ textAlign: 'center', padding: 40, color: '#4A5270', fontSize: 13 }}>Загрузка...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#4A5270', fontSize: 13 }}>Нет предметов</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 18px 24px' }}>
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                loading={actionId === item.id}
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

interface ItemCardProps {
  item: ShopItem;
  loading: boolean;
  onPurchase: () => void;
  onEquip: () => void;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, loading, onPurchase, onEquip }) => {
  const rarityColor = RARITY_COLOR[item.rarity] || '#8B92A8';
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
