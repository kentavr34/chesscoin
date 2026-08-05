import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { PageLayout, useInfoPopup, InfoPopup } from '@/components/layout/PageLayout';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { shopApi, authApi, tonApi, profileApi } from '@/api';
import { connectWallet, getWalletAddress, disconnectWallet, sendVerificationPayment } from '@/lib/tonconnect';
import { useUserStore } from '@/store/useUserStore';
import { fmtBalance } from '@/utils/format';
import type { ShopItem, ItemType } from '@/types';
import { setActiveTheme, getActiveTheme, THEMES } from '@/lib/theme';
import type { ThemeKey } from '@/lib/theme';
import { useT, useText } from '@/i18n/useT';
import { useI18nStore } from '@/i18n/useI18nStore';
import { ExchangeTab } from './ExchangeTab';
import { ItemCard, AvatarItemCard, RARITY_COLOR, ShopCardStyles } from '@/components/shop/ShopItemCards';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { IcoBolt, IcoBriefcase, IcoExchange, IcoLock, IcoMoneyFly, IcoShop, IcoTon, IcoArrowDown, IcoArrowUp, IcoCheck2, IcoClose, IcoMask, IcoFrame, IcoPalette, IcoSparkles, IcoDiceShop } from '@/components/icons/UiIcons';

// N6: 6 вкладок покупок (объединены Фигуры = pieces+pieceSets+anims) + TON отдельно сверху
// S1: 6 вкладок в 2 ряда по 3: [Аватары|Рамки|Визуал] / [Темы|Эффекты|Биржа]
type Tab = 'avatars' | 'frames' | 'visual' | 'themes' | 'effects' | 'exchange';

// S1: маппинг вкладок → типы товаров
const TAB_TYPE: Partial<Record<Tab, ItemType | ItemType[]>> = {
  avatars:  'PREMIUM_AVATAR',
  frames:   'AVATAR_FRAME',
  visual:   'BOARD_SKIN',
  // Звуковые наборы живут рядом с анимациями: и то и другое — то, что
  // происходит при ходе (Кенан 03.08.2026).
  effects:  ['MOVE_ANIMATION', 'SOUND'],
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

// Курс: 100 000 монет за 1 TON (Кенан 31.07.2026). Настоящий курс
// приходит с бэкенда, это запасное значение до ответа.
const DEFAULT_TON_TO_COINS = 100_000;
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
  // Панель TON была целиком написана по-английски прямо в разметке — при
  // выборе любого языка она оставалась английской (Кенан 31.07.2026).
  const t = useT();
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [activeAction, setActiveAction] = useState<'buy' | 'sell' | null>(null);
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [tonToCoins, setTonToCoins] = useState(DEFAULT_TON_TO_COINS);
  const [usdtToCoins, setUsdtToCoins] = useState(DEFAULT_USDT_TO_COINS);
  const [tonUsdt, setTonUsdt] = useState(5.5);
  const [tonHistory, setTonHistory] = useState<Array<Record<string,unknown>>>([]);
  // A1 2026-05-19 (Кенан): убран платный 1-TON unlock — теперь connect просто
  // подключает TonConnect (никаких списаний). verify происходит без BOC.
  const [connectStep, setConnectStep] = useState<'idle' | 'connecting' | 'verifying'>('idle');

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
      showToast(t.shop.tonTab.connecting);
      const wallet = await connectWallet();
      const addr = wallet.account?.address;
      if (!addr) throw new Error('Failed to get wallet address');

      // Подтверждение кошелька (Кенан 31.07.2026): 1 TON платится ОДИН раз за
      // адрес. Уже подтверждённый кошелёк подключается бесплатно — бэкенд
      // сразу отвечает успехом. Новый адрес возвращает 402 WALLET_NOT_CONFIRMED:
      // тогда просим оплату и подтверждаем. До этого плату не спрашивали вовсе,
      // и любой кошелёк подключался бесплатно.
      setConnectStep('verifying');
      showToast(t.shop.tonTab.saving);
      try {
        await tonApi.connectWallet(addr);
      } catch (err: unknown) {
        const emsg = err instanceof Error ? err.message : String(err);
        if (!emsg.includes('WALLET_NOT_CONFIRMED')) throw err;
        showToast(t.shop.tonTab.unlockPrompt);
        const boc = await sendVerificationPayment(user?.id ?? '');
        showToast(t.exchange.verifying);
        await tonApi.verifyWallet(addr, boc);
      }

      setWalletAddress(addr);
      setWalletConnected(true);
      showToast(t.shop.tonTab.connected);
      onUserRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Connection error';
      // Молчаливо пропускаем cancel/timeout пользователя.
      if (!msg.includes('Timeout') && !msg.includes('reject') && !msg.includes('cancel')) {
        console.warn('[shop/ton] connect error:', msg);
        showToast(msg);
      }
    } finally {
      setConnectStep('idle');
    }
  };

  const handleDisconnectWallet = async () => {
    // Кенан 03.08.2026: «нажимаю отвязать — пишет отключено, а по факту нет,
    // и другой кошелёк подключить нельзя». Причина: рвался только сеанс
    // TonConnect в браузере, а на сервере адрес оставался привязанным.
    // Отвязка обязана дойти до сервера, иначе сообщение врёт.
    try {
      await disconnectWallet();
    } catch (e) {
      console.warn('[shop/ton] disconnect failed', e);
    }
    try {
      await tonApi.disconnectWallet();
    } catch (e) {
      showToast('Не удалось отвязать кошелёк, попробуй ещё раз');
      return;
    }
    setWalletConnected(false);
    setWalletAddress(null);
    showToast('Кошелёк отвязан');
    onUserRefresh();
  };

  const calcCoins = (tonOrUsdt: string, isTon: boolean) => {
    const n = parseFloat(tonOrUsdt) || 0;
    const rate = isTon ? tonToCoins : usdtToCoins;
    const gross = n * rate;
    const fee = gross * (FEE_PERCENT / 100);
    return { gross, fee, net: gross - fee };
  };



  if (!walletConnected) {
    return (
      <div style={{ padding: '0 18px 24px' }}>
        <div style={{ ...S.card, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          {/* TON icon */}
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,rgba(0,152,234,.18),rgba(0,122,194,.08))', border: '.5px solid rgba(0,152,234,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0098EA', marginBottom: 14 }}>
            <IcoTon size={28} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#EAE2CC', marginBottom: 6 }}>TON / USDT</div>
          <div style={{ fontSize: 12, color: '#7A7875', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
            {t.shop.tonTab.introText}
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {([
              { key: 'coin', Ico: () => <CoinIcon size={18} />, text: t.shop.tonTab.benefits[0].text, sub: t.shop.tonTab.benefits[0].sub },
              { key: 'fly',  Ico: () => <IcoMoneyFly size={18} color="#0098EA" />, text: t.shop.tonTab.benefits[1].text, sub: t.shop.tonTab.benefits[1].sub },
              // A1: 1 TON unlock-плата убрана. Подключение бесплатное.
              { key: 'free', Ico: () => <IcoCheck2 size={18} color="#3DBA7A" />, text: t.shop.tonTab.benefits[2].text, sub: t.shop.tonTab.benefits[2].sub },
            ] as const).map(r => (
              <div key={r.key} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '.5px solid rgba(154,148,144,.14)', borderRadius: 12, alignItems: 'flex-start', transition: 'all .15s' }}>
                <span style={{ display: 'flex', alignItems: 'center' }}><r.Ico /></span>
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
            {connectStep === 'idle' ? t.shop.tonTab.connectWallet :
             connectStep === 'connecting' ? t.shop.tonTab.connecting :
             t.exchange.verifying}
          </button>
          <div style={{ fontSize: 10, color: '#7A7875', marginTop: 8, textAlign: 'center' }}>
            {t.shop.tonTab.freeNote}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Wallet Info */}
      <div style={{ padding: '13px 15px', background: 'linear-gradient(135deg,rgba(0,152,234,.12),rgba(0,122,194,.06))', border: '.5px solid rgba(0,152,234,.28)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'flex', color: '#0098EA' }}><IcoTon size={22} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#0098EA', fontWeight: 700, marginBottom: 2 }}>{t.shop.tonTab.connected}</div>
          <div style={{ fontSize: 10, color: '#7A7875', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{walletAddress}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ fontSize: 10, color: '#3DBA7A', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}><IcoCheck2 size={10} color="#3DBA7A" /> Active</div>
          <button
            onClick={handleDisconnectWallet}
            style={{ fontSize: 9, padding: '3px 7px', background: 'transparent', color: '#7A7875', border: '.5px solid rgba(154,148,144,.25)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
            title={t.shop.tonTab.disconnect}
          >
            {t.shop.tonTab.disconnect}
          </button>
        </div>
      </div>

      {/* Balance row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, padding: '12px', ...S.card, borderRadius: 12, textAlign: 'center' }}>
          <div style={{ ...S.sectionLabel, marginBottom: 4 }}>{t.profile.balance}</div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 14, fontWeight: 700, color: '#F5C842' }}>{fmtBalance(user?.balance ?? '0')}</div>
        </div>
        <div style={{ flex: 1, padding: '12px', ...S.card, borderRadius: 12, textAlign: 'center' }}>
          <div style={{ ...S.sectionLabel, marginBottom: 4 }}>{t.shop.tonTab.rate}</div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, fontWeight: 700, color: '#0098EA' }}>1 TON = {(tonToCoins / 1000).toFixed(0)}K</div>
          <div style={{ fontSize: 9, color: '#7A7875', marginTop: 2 }}>≈ ${tonUsdt.toFixed(2)}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6 }}>
        {/* Продажа монет за TON закрыта (Кенан 03.08.2026): крипта идёт
            только к нам. Продать монеты можно другому игроку на бирже. */}
        {(['buy'] as const).map(a => {
          const isActive = activeAction === a;
          const activeColor = a === 'buy' ? '#0098EA' : '#7B61FF';
          return (
            <button key={a} onClick={() => setActiveAction(activeAction === a ? null : a)} style={{
              flex: 1, padding: '10px 4px', border: isActive ? `.5px solid ${activeColor}40` : '.5px solid rgba(154,148,144,.18)', borderRadius: 12, fontFamily: 'inherit',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
              background: isActive ? `${activeColor}18` : 'rgba(255,255,255,.04)',
              color: isActive ? activeColor : '#7A7875',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              {a === 'buy' ? <><IcoArrowDown size={11} /> {t.shop.tonTab.buy}</> : <><IcoArrowUp size={11} /> {t.shop.tonTab.sell}</>}
            </button>
          );
        })}
      </div>

      {/* Buy panel */}
      {activeAction === 'buy' && (
        <div style={{ padding: '16px', ...S.card, border: '.5px solid rgba(0,152,234,.22)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#EAE2CC', marginBottom: 12 }}>{t.shop.tonTab.buyCoins}</div>
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
                  <div style={{ color: '#F5C842', marginTop: 2 }}>+{fmtBalance(String(Math.round(c.net)))}</div>
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
                  showToast(`Credited ${fmtBalance(String(r.coinsReceived))}`);
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
                <div>You receive: <b style={{ color: '#F5C842' }}>{fmtBalance(String(Math.round(c.net)))}</b></div>
                <div>Fee {FEE_PERCENT}%: {fmtBalance(String(Math.round(c.fee)))}</div>
              </>; })()}
            </div>
          )}
        </div>
      )}

      {/* Sell panel */}
      {/* Transaction History */}
      <div style={{ padding: '14px', ...S.card }}>
        <div style={{ ...S.sectionLabel, marginBottom: 10 }}>{t.txHistory.title}</div>
        {tonHistory.length === 0 ? (
          <div style={{ fontSize: 12, color: '#7A7875', textAlign: 'center', padding: '12px 0' }}>
            {t.txHistory.noTx}
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      {type === 'TON_DEPOSIT' ? <><IcoArrowDown size={11} /> Deposit</> : type === 'WITHDRAWAL' ? <><IcoArrowUp size={11} /> Withdrawal</> : <><IcoLock size={11} /> Verification</>}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#7A7875' }}>
                    {date.toLocaleDateString('en-US')}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isIn ? '#3DBA7A' : '#FF5B5B', fontFamily: 'JetBrains Mono, monospace' }}>
                  {isIn ? '+' : '-'}{fmtBalance(amount)}
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
  const [visualSubType, setVisualSubType] = useState<'BOARD_SKIN'|'PIECE_SKIN'|'PIECE_SET'|'CELL_SHAPE'|'MOVE_ANIMATION'|'FONT'>('BOARD_SKIN');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showTon, setShowTon] = useState(false);
  const shopSlides = [
    { icon: <IcoShop size={32} color="#F5C842" />, title: t?.shop?.title ?? 'Магазин ChessCoin', desc: 'Покупай аватары, рамки, доски и темы за монеты. Подключи TON-кошелёк, чтобы купить монеты за TON или торговать ими на бирже с другими игроками.' },
    { icon: <IcoBolt size={32} color="#F5C842" />, title: 'Как использовать предметы', desc: 'Купи предмет, затем нажми "Применить". Он мгновенно появится в твоем профиле и будет виден для других игроков.' },
    { icon: <IcoTon size={32} color="#0098EA" />, title: 'TON Wallet', desc: 'Подключи TON кошелек чтобы выводить заработанные монеты. Курс конвертации обновляется автоматически.' },
  ];
  const shopInfo = useInfoPopup('shop', shopSlides);
  const [confirmPurchase, ConfirmPurchaseDialog] = useConfirm();
  // Названия товаров и подпись «Цена» на языке интерфейса — диалог покупки
  // был на английском («Buy … ?», «Price», «Buy»).
  const dict = useI18nStore((st) => st.dict);
  const priceLabel = useText('shop.priceLabel', 'Цена');
  const effectsTitle = useText('shop.effects.title', 'Ход и звук');
  const effectsSubtitle = useText('shop.effects.subtitle', 'Анимации ходов и звуковые наборы');
  const cellsLabel = useText('shop.visualTabs.cells', 'Клетки');

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
    // Диалог покупки был на английском: «Buy … ?», «Price», «Buy».
    const shownName = dict[`shop.item.${item.id}.name`] ?? item.name;
    if (!await confirmPurchase({
      title: `${t.shop.buy} «${shownName}»?`,
      message: `${priceLabel}: ${fmtBalance(item.priceCoins)}`,
      okLabel: t.shop.buy,
    })) return;
    setActionId(item.id);
    try {
      const res = await shopApi.purchase(item.id);
      await refreshUser();
      await loadItems();
      // Применяем тему ТОЛЬКО если у товара есть реальная тема. Иначе (это
      // мис-категоризированные эффекты под типом THEME — Fireworks, Capture:…)
      // НЕ трогаем активную тему пользователя, чтобы не сбросить её в default.
      const key = THEME_NAME_TO_KEY[item.name];
      if (key) {
        setActiveTheme(key);
        profileApi.saveTheme(key).catch(() => {});
      }
      showToast(key ? `Тема «${item.name}» куплена и применена` : `«${item.name}» куплено`);
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : "Error"));
    } finally {
      setActionId(null);
    }
  };

  const handleThemeApply = (item: ShopItem) => {
    const key = THEME_NAME_TO_KEY[item.name];
    if (key) {
      setActiveTheme(key);
      profileApi.saveTheme(key).catch(() => {});
      showToast(`Тема «${item.name}» применена`);
    } else {
      // Товар куплен, но это эффект без живой механики — не сбрасываем тему.
      showToast(`«${item.name}» — эффект появится в игре`);
    }
  };

  useEffect(() => { loadItems(); }, [loadItems]);

  const handlePurchase = async (item: ShopItem) => {
    // Диалог покупки был на английском: «Buy … ?», «Price», «Buy».
    const shownName = dict[`shop.item.${item.id}.name`] ?? item.name;
    if (!await confirmPurchase({
      title: `${t.shop.buy} «${shownName}»?`,
      message: `${priceLabel}: ${fmtBalance(item.priceCoins)}`,
      okLabel: t.shop.buy,
    })) return;
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

  // Иконки вместо эмодзи (правило проекта, подтверждено Кенаном 03.08.2026).
  const SHOP_TABS: { key: Tab; label: string; Icon: React.FC<{ size?: number; color?: string }> }[] = [
    { key: 'avatars',   label: t.shop.tabs.avatars,  Icon: IcoMask     },
    { key: 'frames',    label: t.shop.tabs.frames,   Icon: IcoFrame    },
    { key: 'visual',    label: t.shop.tabs.visual,   Icon: IcoDiceShop },
    { key: 'themes',    label: t.shop.tabs.themes,   Icon: IcoPalette  },
    { key: 'effects',   label: t.shop.tabs.effects,  Icon: IcoSparkles },
    { key: 'exchange',  label: t.shop.tabs.exchange, Icon: IcoExchange },
  ];
  const tabRows = [SHOP_TABS.slice(0, 3), SHOP_TABS.slice(3, 6)];

  return (
    <PageLayout title={t.shop.title} centered>
      {/* Hover/shine стили карточек — один раз на страницу */}
      <ShopCardStyles />
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
              <div style={{ fontSize: 17, fontWeight: 800, color: '#0098EA', display: 'inline-flex', alignItems: 'center', gap: 6 }}><IcoTon size={17} /> TON Wallet</div>
              <button onClick={() => setShowTon(false)} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.07)', border: '.5px solid rgba(154,148,144,.2)', color: '#7A7875', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}><IcoClose size={12} /></button>
            </div>
            <TonTab user={user} showToast={showToast} onUserRefresh={refreshUser} />
          </div>
        </div>
      )}

      {/* Balance bar */}
      {user && (
        <div style={{ margin: '4px 18px 10px', padding: '11px 16px', ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ ...S.sectionLabel }}>{t.profile.balance}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: '#F5C842' }}>
            {fmtBalance(user.balance)}
          </span>
        </div>
      )}

      {/* Отдельной кнопки «TON кошелёк» здесь больше нет. Она вела ровно
          туда же, куда вкладка «Биржа», и при уже подключённом кошельке
          продолжала звать подключаться — Кенан 05.08.2026: «внутри магазина
          осталась кнопка биржа… после привязки не сворачивается в одну тонкую
          полоску». Вход один — вкладка; кошелёк живёт наверху биржи. */}

      {/* Tab bar — 2 rows × 3 */}
      <div style={{ margin: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Tab container background */}
        <div style={{ background: 'rgba(255,255,255,.05)', borderRadius: 14, padding: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tabRows.map((row, ri) => (
            <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              {row.map(({ key, label, Icon }) => {
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
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    }}
                  >
                    <Icon size={15} color={isActive ? '#F0C85A' : '#7A7875'} />
                    <span>{label}</span>
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
          <div style={{ fontSize: 13, fontWeight: 700, color: '#EAE2CC', marginBottom: 3, display: 'inline-flex', alignItems: 'center', gap: 5 }}><IcoBolt size={13} color="#9B85FF" /> {effectsTitle}</div>
          <div style={{ fontSize: 11, color: '#7A7875' }}>{effectsSubtitle}</div>
        </div>
      )}

      {/* Visual subtabs */}
      {tab === 'visual' && (
        <div style={{ margin: '0 18px 10px', display: 'flex', background: 'rgba(255,255,255,.05)', borderRadius: 10, padding: 3, gap: 2 }}>
          {([
            ['BOARD_SKIN',     t.shop.visualTabs.boards],
            ['PIECE_SKIN',     t.shop.visualTabs.pieces],
            ['PIECE_SET',      t.shop.visualTabs.sets],
            // Форма клеток — отдельное измерение (B9, Кенан 30.07.2026).
            ['CELL_SHAPE',     cellsLabel],
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
                comingSoon={item.type === 'THEME' && !THEME_NAME_TO_KEY[item.name]}
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
