// ─────────────────────────────────────────────────────────────────────────────
// ExchangeTab — P2P Exchange ChessCoin v7.0.1
// Placement: "Exchange" tab inside ShopPage
//
// Structure:
//   [Price indicator + CandleChart (TradingView)]
//   [Period switcher 1D/7D/30D]
//   [Order book]
//   [Sell / Buy buttons]
//
// Without TON wallet: locked screen, price visible, operations blocked
// With TON wallet: full functionality
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import { exchangeApi, tonApi, P2POrder, BuyP2POrder, PriceCandle } from '@/api';
import { fmtBalance } from '@/utils/format';
import type { User } from '@/types';
import { sendTonPayment, connectWallet, disconnectWallet, sendVerificationPayment,
         setPlatformWallet } from '@/lib/tonconnect';
import { createChart, IChartApi, ColorType, LineStyle, type Time } from 'lightweight-charts';
import { useT } from '@/i18n/useT';
import { IcoArrowDown, IcoArrowUp } from '@/components/icons/UiIcons';
import { IcoTon } from '@/components/icons/UiIcons';

// ── Иконки состояний модалов (заменяют битые глифы/пустые placeholder'ы; без эмодзи) ──
const sx = (size: number, body: React.ReactNode, color = 'currentColor') => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{body}</svg>
);
const ExWarn:   React.FC<{ size?: number }> = ({ size = 40 }) => sx(size, <><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4"/><circle cx="12" cy="17.5" r=".6" fill="currentColor"/></>, '#FF5B5B');
const ExSearch: React.FC<{ size?: number }> = ({ size = 40 }) => sx(size, <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.2-4.2"/></>, '#82CFFF');
const ExClock:  React.FC<{ size?: number }> = ({ size = 40 }) => sx(size, <><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></>, '#D4A843');
const ExEmpty:  React.FC<{ size?: number }> = ({ size = 30 }) => sx(size, <><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 10h17M8 5V3.5M16 5V3.5"/></>, '#5A5248');
const ExTrophy: React.FC<{ size?: number }> = ({ size = 30 }) => sx(size, <><path d="M7 4h10v3a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4v1a3 3 0 0 0 3 3M17 5h3v1a3 3 0 0 1-3 3M9 14h6M10 17h4M9 20h6"/></>, '#D4A843');
const ExCoinSwap: React.FC<{ size?: number }> = ({ size = 40 }) => sx(size, <><circle cx="9" cy="9" r="5.5"/><circle cx="15.5" cy="15.5" r="5"/></>, '#0ECB81');

interface ExchangeTabProps {
  user: User | null;
  showToast: (msg: string) => void;
  onUserRefresh: () => void;
}

const PLATFORM_FEE = 0.005; // 0.5%
const MIN_PRICE    = 0.00001;
// Базовая цена платформы: 10 TON за миллион монет = 100 000 монет за тонну
// (Кенан 31.07.2026). Запасное значение, если рынок ещё не отдал цену.
const BASE_PRICE   = 10;
const PERIODS = [
  { label: '1D',  hours: 24  as const },
  { label: '7D',  hours: 168 as const },
  { label: '30D', hours: 720 as const },
] as const;

// ── CandleChart (E14: TradingView lightweight-charts) ─────────
const CandleChart: React.FC<{ candles: PriceCandle[]; up: boolean; height?: number }> = ({ candles, up, height = 120 }) => {
  const t = useT();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chartRef     = React.useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Create chart
    const chart = createChart(el, {
      width:  el.clientWidth || 320,
      height,
      layout: {
        background:  { type: ColorType.Solid, color: 'transparent' },
        textColor:   '#5A5248',
      },
      grid: {
        vertLines:   { color: 'rgba(255,255,255,0.04)', style: LineStyle.Dotted },
        horzLines:   { color: 'rgba(255,255,255,0.04)', style: LineStyle.Dotted },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale:       { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true },
      crosshair: { mode: 1 },
    });
    chartRef.current = chart;

    if (candles.length < 2) {
      // No data — line chart with placeholder
      const lineSeries = chart.addLineSeries({ color: '#5A5248', lineWidth: 1 });
      lineSeries.setData([{ time: Math.floor(Date.now() / 1000) as Time, value: 0 }]);
    } else {
      // Candlestick chart series
      const candleSeries = chart.addCandlestickSeries({
        upColor:          '#3DBA7A',
        downColor:        '#FF5B5B',
        borderUpColor:    '#3DBA7A',
        borderDownColor:  '#FF5B5B',
        wickUpColor:      '#3DBA7A',
        wickDownColor:    '#FF5B5B',
      });

      const data = candles.map(c => ({
        time:  (new Date(c.time).getTime() / 1000) as Time,
        open:  c.open,
        high:  c.high,
        low:   c.low,
        close: c.close,
      })).sort((a, b) => (a.time as number) - (b.time as number));

      candleSeries.setData(data);
      chart.timeScale().fitContent();
    }

    // Resize observer
    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);

    return () => { chart.remove(); ro.disconnect(); };
  }, [candles, up, height]);

  return (
    <div ref={containerRef} style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden' }}>
      {candles.length < 2 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A5248', fontSize: 11, pointerEvents: 'none' }}>
          {t.exchange.noDataForPeriod}
        </div>
      )}
    </div>
  );
};

// ── Locked screen (no wallet) ───────────────────────────────
// Карточка подключения кошелька. Цена, стакан и история живут на самой
// странице биржи — здесь только само подключение, чтобы не было двух
// механизмов (Кенан 03.08.2026).
const LockedScreen: React.FC<{ user: User | null; connecting: boolean; onConnect: () => void }> = ({ user, connecting, onConnect }) => {
  const t = useT();
  const avatar = user?.avatar;
  const initial = (user?.firstName ?? '?').slice(0, 1).toUpperCase();
  return (
    <div style={{ padding: '0 18px 24px' }}>
      {/* CTA connect wallet */}
      <div style={{ background: 'linear-gradient(135deg,rgba(0,152,234,0.12),rgba(0,152,234,0.06))', border: '1px solid rgba(0,152,234,0.3)', borderRadius: 18, padding: '24px 20px', textAlign: 'center' }}>
        {/* Аватар пользователя — кого подключаем (Кенан 2026-06-13) */}
        <div style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 12px', overflow: 'hidden', border: '2px solid rgba(0,152,234,0.5)', background: 'linear-gradient(135deg,#0098EA,#006FB8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {avatar
            ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{initial}</span>}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#EAE2CC', marginBottom: 8 }}>
          {t.exchange.connectWalletTitle}
        </div>
      <div style={{ fontSize: 12, color: '#9A9490', lineHeight: 1.6, marginBottom: 20 }}>
          {t.exchange.connectWalletNeed}<br />
          {t.exchange.confirmAddressNote} <b style={{ color: '#F0C85A' }}>{t.exchange.confirmOnce}</b>.
          {t.exchange.sameWalletFree}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#9A9490', marginBottom: 20, textAlign: 'left' }}>
          {[t.exchange.sellDirect, t.exchange.buyAtMarket, t.exchange.platformFee].map(line => (
            <div key={line} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#3DBA7A' }}>✓</span>{line}
            </div>
          ))}
        </div>
        <button onClick={onConnect} disabled={connecting} style={{ width: '100%', padding: '14px', background: connecting ? '#1E3A52' : 'linear-gradient(90deg,#0098EA,#006FB8)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: connecting ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: connecting ? 0.8 : 1 }}>
          {connecting ? t.exchange.connecting : t.exchange.connectWalletTitle}
        </button>
      </div>
    </div>
  );
};

// ── Create order modal (E8) ────────────────────────────────
const CreateOrderModal: React.FC<{
  userBalance: string;
  marketPrice: number;
  onClose: () => void;
  onCreated: () => void;
  showToast: (m: string) => void;
}> = ({ userBalance, marketPrice, onClose, onCreated, showToast }) => {
  const t = useT();
  const maxCoins = Math.min(Number(BigInt(userBalance)), 100_000_000);
  const [amount, setAmount] = useState(Math.max(1_000, Math.min(10_000, maxCoins)));
  // Цена по умолчанию — рыночная. Раньше стояло 0.001 TON за миллион, то есть
  // миллиард монет за тонну: выставив ордер «как есть», человек отдавал монеты
  // даром (Кенан 03.08.2026 прислал этот экран).
  const [price, setPrice]   = useState(marketPrice > 0 ? marketPrice : BASE_PRICE);
  const [loading, setLoading] = useState(false);

  const totalTon  = (amount / 1_000_000) * price;
  const feeTon    = totalTon * PLATFORM_FEE;
  const netTon    = totalTon - feeTon;
  const QUICK = [1_000, 10_000, 100_000, 1_000_000].filter(v => v <= maxCoins);

  const handleCreate = async () => {
    if (amount < 1_000) return showToast(t.exchange.minCoins);
    if (price < MIN_PRICE) return showToast(t.exchange.minPrice(MIN_PRICE));
    setLoading(true);
    try {
      await exchangeApi.createOrder(String(amount), price);
      showToast(t.exchange.orderCreated);
      onCreated();
      onClose();
    } catch (e: unknown) {
      showToast((e as Error).message ?? t.exchange.orderCreateError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#141018', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', borderRadius: '24px 24px 0 0', padding: '20px 18px', paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
        <div style={{ width: 36, height: 4, background: 'rgba(154,148,144,.18)', borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#EAE2CC' }}>{t.exchange.kindSale}</div>
          <button onClick={onClose} style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: 'none', color: '#9A9490', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', flexShrink: 0 }}>✕</button>
        </div>

        {/* Amount */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#5A5248', marginBottom: 8 }}>{t.exchange.labelQuantity}</div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 800, color: '#F0C85A', textAlign: 'center', marginBottom: 10 }}>
          {fmtBalance(String(amount))}
        </div>
        <input type="range" min={1_000} max={Math.max(1_000, maxCoins)} step={1_000} value={amount}
          onChange={e => setAmount(Number(e.target.value))}
          style={{ width: '100%', marginBottom: 10, accentColor: '#F0C85A' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 18 }}>
          {QUICK.map(v => (
            <button key={v} onClick={() => setAmount(v)} style={{ padding: '7px 4px', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: amount === v ? 'rgba(245,200,66,0.12)' : '#141018', color: amount === v ? '#F0C85A' : '#9A9490', border: `1px solid ${amount === v ? 'rgba(245,200,66,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
              {v >= 1_000_000 ? `${v/1_000_000}M` : v >= 1_000 ? `${v/1_000}K` : v}
            </button>
          ))}
        </div>

        {/* Price */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#5A5248', marginBottom: 8 }}>{t.exchange.labelPricePerM}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <button onClick={() => setPrice(p => Math.max(MIN_PRICE, +(p * 0.9).toFixed(5)))} style={{ width: 44, height: 44, borderRadius: 10, background: '#141018', border: '1px solid rgba(255,255,255,0.07)', color: '#EAE2CC', fontSize: 20, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
          <input type="number" min={MIN_PRICE} step={0.00001} value={price}
            onChange={e => setPrice(Math.max(MIN_PRICE, Number(e.target.value)))}
            style={{ flex: 1, padding: '10px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#EAE2CC', fontSize: 15, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, textAlign: 'center', outline: 'none' }} />
          <button onClick={() => setPrice(p => +(p * 1.1).toFixed(5))} style={{ width: 44, height: 44, borderRadius: 10, background: '#141018', border: '1px solid rgba(255,255,255,0.07)', color: '#EAE2CC', fontSize: 20, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        </div>

        {/* Total */}
        <div style={{ background: '#0D0D12', borderRadius: 12, padding: '12px 14px', marginBottom: 18 }}>
          {[
            [t.exchange.colTotalTon, `${totalTon.toFixed(4)} TON`],
            [t.exchange.fee05, `${feeTon.toFixed(4)} TON`],
            [t.exchange.youGet, `${netTon.toFixed(4)} TON`],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: '#9A9490' }}>{l}</span>
              <span style={{ fontWeight: 700, color: l === t.exchange.youGet ? '#3DBA7A' : '#EAE2CC', fontFamily: "'JetBrains Mono',monospace" }}>{v}</span>
            </div>
          ))}
        </div>

        <button onClick={handleCreate} disabled={loading || amount < 1_000} style={{ width: '100%', padding: '16px', background: loading ? '#2A2F48' : '#F6465D', color: loading ? '#5A5248' : '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
          {loading ? t.exchange.creatingOrder : t.exchange.placeSell}
        </button>
      </div>
    </div>
  );
};

// ── Execute order modal (E9) ──────────────────────────────
const ExecuteOrderModal: React.FC<{
  order: P2POrder;
  buyerWallet: string;
  onClose: () => void;
  onExecuted: () => void;
  showToast: (m: string) => void;
  onUserRefresh: () => void;
}> = ({ order, buyerWallet, onClose, onExecuted, showToast, onUserRefresh }) => {
  const t = useT();
  const [step, setStep] = useState<'confirm' | 'paying' | 'verifying' | 'done' | 'error'>('confirm');
  const [errMsg, setErrMsg] = useState('');

  const maxCoins = Number(order.amountCoins);
  const [partialAmt, setPartialAmt] = useState(maxCoins);
  const isPartial = partialAmt < maxCoins;

  const totalTon = order.totalTon;
  const feeTon   = totalTon * PLATFORM_FEE;
  const toSeller = totalTon - feeTon;

  const handlePay = async () => {
    setStep('paying');
    try {
      // Initiate TON transaction via TonConnect
      // Seller receives 99.5%, platform 0.5%
      const { boc } = await sendTonPayment({
        toAddress:  order.sellerWallet,
        amount:     toSeller,
        comment:    `ChessCoin P2P Order ${order.id}`,
      });

      setStep('verifying');
      // Бэкенд сам находит оба платежа в блокчейне и берёт реальный хэш оттуда:
      // клиент настоящий хэш получить не может, а выдуманный доказательством не был.
      await exchangeApi.executeOrder(order.id, boc, isPartial ? String(partialAmt) : undefined);
      await onUserRefresh();
      setStep('done');
      onExecuted();
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? 'Transaction cancelled';
      setErrMsg(msg);
      setStep('error');
    }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, background: 'linear-gradient(180deg,#100C18,#0A080E)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 28, textAlign: 'center' }}>

        {step === 'confirm' && (<>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><ExCoinSwap size={42} /></div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#EAE2CC', marginBottom: 8 }}>{t.exchange.kindPurchase}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#F0C85A', marginBottom: 4, fontFamily: "'JetBrains Mono',monospace" }}>
            {fmtBalance(order.amountCoins)}
          </div>
          <div style={{ fontSize: 13, color: '#9A9490', marginBottom: 20 }}>от {order.sellerName} · ELO {order.sellerElo}</div>
          {/* E12: Partial purchase slider */}
          {maxCoins > 100_000 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#5A5248', marginBottom: 6 }}>
                <span>{t.exchange.volumeShort}</span>
                <span style={{ color: '#F0C85A', fontWeight: 700 }}>{partialAmt.toLocaleString()} {isPartial ? t.exchange.partly : t.exchange.whole}</span>
              </div>
              <input type="range" min={Math.min(10_000, maxCoins)} max={maxCoins} step={10_000}
                value={partialAmt} onChange={e => setPartialAmt(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#F0C85A' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#5A5248', marginTop: 3 }}>
                <span>10K</span><span>{(maxCoins/1000).toFixed(0)}K</span>
              </div>
            </div>
          )}
          <div style={{ background: '#0D0D12', borderRadius: 12, padding: '12px 14px', marginBottom: 20, textAlign: 'left' }}>
            {[
              [t.exchange.colPrice, `${order.priceTon.toFixed(5)} TON/1M`],
              [t.exchange.colTotal, `${totalTon.toFixed(4)} TON`],
              [t.exchange.toSeller, `${toSeller.toFixed(4)} TON`],
              [t.exchange.colFee, `${feeTon.toFixed(4)} TON`],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: '#9A9490' }}>{l}</span>
                <span style={{ fontWeight: 700, color: '#EAE2CC', fontFamily: "'JetBrains Mono',monospace" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.06)', color: '#9A9490', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.exchange.cancel}</button>
            <button onClick={handlePay} style={{ flex: 1, padding: '13px', background: 'rgba(0,152,234,0.15)', color: '#0098EA', border: '1px solid rgba(0,152,234,0.35)', borderRadius: 14, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              Оплатить {totalTon.toFixed(4)} TON
            </button>
          </div>
        </>)}

        {step === 'paying' && (<>
          <div style={{ fontSize: 44, marginBottom: 16 }}><ExClock size={38} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#EAE2CC' }}>{t.exchange.awaitingConfirmation}</div>
          <div style={{ fontSize: 12, color: '#9A9490', marginTop: 8 }}>{t.exchange.confirmInWallet}</div>
        </>)}

        {step === 'verifying' && (<>
          <div style={{ fontSize: 44, marginBottom: 16 }}><ExSearch size={38} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#EAE2CC' }}>{t.exchange.verifying}</div>
          <div style={{ fontSize: 12, color: '#9A9490', marginTop: 8 }}>{t.exchange.checkingBlockchain}</div>
        </>)}

        {step === 'done' && (<>
          <div style={{ fontSize: 56, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#3DBA7A', marginBottom: 8 }}>{t.common.success}!</div>
          <div style={{ fontSize: 13, color: '#9A9490', marginBottom: 20 }}>
            {t.exchange.credited(fmtBalance(order.amountCoins))}
          </div>
          <button onClick={onClose} style={{ width: '100%', padding: '14px', background: 'rgba(0,214,143,0.15)', color: '#3DBA7A', border: '1px solid rgba(0,214,143,0.3)', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.common.close}</button>
        </>)}

        {step === 'error' && (<>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><ExWarn size={40} /></div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#FF5B5B', marginBottom: 8 }}>{t.exchange.operationAborted}</div>
          <div style={{ fontSize: 12, color: '#9A9490', lineHeight: 1.6, marginBottom: 20 }}>
            {errMsg}<br />
            <span style={{ color: '#5A5248', fontSize: 11 }}>{t.exchange.coinsNotCharged}</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.06)', color: '#9A9490', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.common.close}</button>
            <button onClick={handlePay} style={{ flex: 1, padding: '13px', background: 'rgba(0,152,234,0.12)', color: '#0098EA', border: '1px solid rgba(0,152,234,0.25)', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.exchange.retry}</button>
          </div>
        </>)}
      </div>
    </div>
  );
};


// ── E15: CreateBuyOrderModal ──────────────────────────────────
const CreateBuyOrderModal: React.FC<{
  marketPrice: number;
  onClose: () => void;
  onCreated: () => void;
  showToast: (m: string) => void;
}> = ({ marketPrice, onClose, onCreated, showToast }) => {
  const t = useT();
  const [amount, setAmount] = useState(10_000);
  const [price, setPrice]   = useState(marketPrice > 0 ? marketPrice : BASE_PRICE);
  const [loading, setLoading] = useState(false);
  const totalTon = (amount / 1_000_000) * price;
  const QUICK = [1_000, 10_000, 100_000, 1_000_000];

  const handleCreate = async () => {
    if (amount < 1_000) return showToast(t.exchange.minCoins);
    if (price < MIN_PRICE) return showToast(t.exchange.minPrice(MIN_PRICE));
    setLoading(true);
    try {
      await exchangeApi.createBuyOrder(String(amount), price);
      showToast(t.exchange.buyOrderCreated);
      onCreated();
    } catch (e: unknown) {
      showToast((e as Error).message ?? t.common.error);
    } finally { setLoading(false); }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#141018', border: '1px solid rgba(0,152,234,0.2)', borderBottom: 'none', borderRadius: '24px 24px 0 0', padding: '20px 18px', paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
        <div style={{ width: 36, height: 4, background: 'rgba(154,148,144,.18)', borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0ECB81' }}>{t.exchange.kindPurchase}</div>
          <button onClick={onClose} style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: 'none', color: '#9A9490', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#5A5248', marginBottom: 8 }}>{t.exchange.labelWantBuy}</div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 26, fontWeight: 800, color: '#0098EA', textAlign: 'center', marginBottom: 10 }}>
          {amount.toLocaleString()}
        </div>
        <input type="range" min={1_000} max={10_000_000} step={1_000} value={amount} onChange={e => setAmount(Number(e.target.value))} style={{ width: '100%', marginBottom: 10, accentColor: '#0ECB81' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 16 }}>
          {QUICK.map(v => (
            <button key={v} onClick={() => setAmount(v)} style={{ padding: '7px 4px', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: amount === v ? 'rgba(0,152,234,0.15)' : '#141018', color: amount === v ? '#0098EA' : '#9A9490', border: `1px solid ${amount === v ? 'rgba(0,152,234,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
              {v >= 1_000_000 ? `${v/1_000_000}M` : `${v/1_000}K`}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#5A5248', marginBottom: 8 }}>{t.exchange.labelMyPrice}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={() => setPrice(p => Math.max(MIN_PRICE, +(p*0.9).toFixed(5)))} style={{ width: 44, height: 44, borderRadius: 10, background: '#141018', border: '1px solid rgba(255,255,255,0.07)', color: '#EAE2CC', fontSize: 20, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
          <input type="number" min={MIN_PRICE} step={0.00001} value={price} onChange={e => setPrice(Math.max(MIN_PRICE, Number(e.target.value)))} style={{ flex: 1, padding: '10px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(0,152,234,0.2)', borderRadius: 10, color: '#0098EA', fontSize: 15, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, textAlign: 'center' as const, outline: 'none' }} />
          <button onClick={() => setPrice(p => +(p*1.1).toFixed(5))} style={{ width: 44, height: 44, borderRadius: 10, background: '#141018', border: '1px solid rgba(255,255,255,0.07)', color: '#EAE2CC', fontSize: 20, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        </div>
        <div style={{ background: '#0D0D12', borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
          {[[t.exchange.youPay, `${totalTon.toFixed(4)} TON`], [t.exchange.youGet, `${amount.toLocaleString()}`]].map(([l,v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: '#9A9490' }}>{l}</span>
              <span style={{ fontWeight: 700, color: '#0098EA', fontFamily: "'JetBrains Mono',monospace" }}>{v}</span>
            </div>
          ))}
        </div>
        <button onClick={handleCreate} disabled={loading} style={{ width: '100%', padding: '14px', background: loading ? '#2A2F48' : 'rgba(0,152,234,0.2)', color: '#0098EA', border: '1px solid rgba(0,152,234,0.4)', borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {loading ? t.exchange.creating : t.exchange.placeBuy}
        </button>
      </div>
    </div>
  );
};

// ── E15: FillBuyOrderModal — продавец РЕЗЕРВИРУЕТ BUY-ордер ───────────
// Продавец только соглашается и замораживает монеты. TON платит покупатель
// со своего кошелька вторым шагом — подписать за него продавец не может.
const FillBuyOrderModal: React.FC<{
  order: BuyP2POrder;
  sellerWallet: string;
  userBalance: string;
  onClose: () => void;
  onFilled: () => void;
  showToast: (m: string) => void;
}> = ({ order, userBalance, onClose, onFilled, showToast }) => {
  const t = useT();
  const [step, setStep] = useState<'confirm'|'reserving'|'done'|'error'>('confirm');
  const [errMsg, setErrMsg] = useState('');
  const balance = BigInt(userBalance);
  const orderCoins = BigInt(order.amountCoins);
  const hasEnough = balance >= orderCoins;

  const handleFill = async () => {
    if (!hasEnough) return showToast(t.exchange.notEnoughCoinsForOrder);
    setStep('reserving');
    try {
      await exchangeApi.reserveBuyOrder(order.id);
      setStep('done');
      onFilled();
    } catch (e: unknown) {
      setErrMsg((e as Error)?.message ?? t.exchange.reserveFailed);
      setStep('error');
    }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, background: 'linear-gradient(180deg,#100C18,#0A080E)', border: '1px solid rgba(0,214,143,0.25)', borderRadius: 24, padding: 28, textAlign: 'center' }}>
        {step === 'confirm' && (<>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><ExCoinSwap size={42} /></div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#3DBA7A', marginBottom: 6 }}>{t.exchange.saleToBuyer}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#F0C85A', marginBottom: 4, fontFamily: "'JetBrains Mono',monospace" }}>{Number(orderCoins).toLocaleString()}</div>
          <div style={{ fontSize: 13, color: '#9A9490', marginBottom: 16 }}>
            Покупатель: {order.buyerName ?? t.exchange.colPlayer} · ELO {order.buyerElo ?? order.sellerElo}
          </div>
          {!hasEnough && <div style={{ fontSize: 12, color: '#FF5B5B', marginBottom: 12, padding: '8px 12px', background: 'rgba(255,77,106,0.1)', borderRadius: 10 }}>{t.exchange.notEnoughBalance}</div>}
          <div style={{ fontSize: 11, color: '#9A9490', marginBottom: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, textAlign: 'left' as const, lineHeight: 1.5 }}>
            Монеты замораживаются, TON придёт от покупателя на твой кошелёк напрямую.
            Не оплатит за 30 минут — монеты вернутся автоматически.
          </div>
          <div style={{ background: '#0D0D12', borderRadius: 12, padding: '12px 14px', marginBottom: 20, textAlign: 'left' as const }}>
            {[[t.exchange.youSell, `${Number(orderCoins).toLocaleString()}`], [t.exchange.youGet, `${order.totalTon.toFixed(4)} TON`], [t.exchange.colPrice, `${order.priceTon.toFixed(5)} TON/1M`]].map(([l,v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: '#9A9490' }}>{l}</span>
                <span style={{ fontWeight: 700, color: '#EAE2CC', fontFamily: "'JetBrains Mono',monospace" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.06)', color: '#9A9490', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.common.cancel}</button>
            <button onClick={handleFill} disabled={!hasEnough} style={{ flex: 1, padding: '13px', background: 'rgba(0,214,143,0.15)', color: '#3DBA7A', border: '1px solid rgba(0,214,143,0.3)', borderRadius: 14, fontSize: 13, fontWeight: 800, cursor: hasEnough ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: hasEnough ? 1 : 0.5 }}>
              Принять за {order.totalTon.toFixed(4)} TON
            </button>
          </div>
        </>)}
        {step === 'reserving' && (<><div style={{ fontSize: 44, marginBottom: 12 }}><ExClock size={38} /></div><div style={{ fontSize: 14, color: '#EAE2CC' }}>{t.exchange.reserving}</div></>)}
        {step === 'done' && (<><div style={{ fontSize: 56, marginBottom: 12 }}>✓</div><div style={{ fontSize: 15, fontWeight: 800, color: '#3DBA7A', marginBottom: 8 }}>{t.exchange.orderReserved}</div><div style={{ fontSize: 12, color: '#9A9490', marginBottom: 16 }}>{t.exchange.coinsFrozenNote(order.totalTon.toFixed(4))}</div><button onClick={onClose} style={{ width: '100%', padding: '13px', background: 'rgba(0,214,143,0.12)', color: '#3DBA7A', border: '1px solid rgba(0,214,143,0.25)', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.common.close}</button></>)}
        {step === 'error' && (<><div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><ExWarn size={40} /></div><div style={{ fontSize: 14, fontWeight: 800, color: '#FF5B5B', marginBottom: 8 }}>{t.common.error}</div><div style={{ fontSize: 12, color: '#9A9490', marginBottom: 16 }}>{errMsg}</div><div style={{ display: 'flex', gap: 10 }}><button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)', color: '#9A9490', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.common.close}</button><button onClick={handleFill} style={{ flex: 1, padding: '12px', background: 'rgba(0,214,143,0.1)', color: '#3DBA7A', border: '1px solid rgba(0,214,143,0.2)', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.exchange.retry}</button></div></>)}
      </div>
    </div>
  );
};

// ── E15-4b: PayReservedOrderModal — создатель BUY-ордера платит ──────────────
// Второй шаг сделки: продавец уже заморозил монеты, теперь покупатель платит
// ему TON напрямую (99.5%) и комиссию платформе (0.5%). Бэкенд находит оба
// платежа в блокчейне и только тогда отдаёт монеты.
const PayReservedOrderModal: React.FC<{
  order: BuyP2POrder;
  onClose: () => void;
  onPaid: () => void;
}> = ({ order, onClose, onPaid }) => {
  const t = useT();
  const [step, setStep] = useState<'confirm'|'paying'|'verifying'|'done'|'error'>('confirm');
  const [errMsg, setErrMsg] = useState('');
  const orderCoins = BigInt(order.amountCoins);

  const handlePay = async () => {
    if (!order.sellerWallet) return setErrMsg(t.exchange.sellerWalletMissing);
    setStep('paying');
    try {
      const { boc } = await sendTonPayment({
        toAddress: order.sellerWallet,
        amount:    order.totalTon,
        comment:   `ChessCoin BUY Order ${order.id}`,
      });
      setStep('verifying');
      await exchangeApi.settleBuyOrder(order.id, boc);
      setStep('done');
      onPaid();
    } catch (e: unknown) {
      setErrMsg((e as Error)?.message ?? t.exchange.txCancelled);
      setStep('error');
    }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, background: 'linear-gradient(180deg,#100C18,#0A080E)', border: '1px solid rgba(0,152,234,0.25)', borderRadius: 24, padding: 28, textAlign: 'center' }}>
        {step === 'confirm' && (<>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><ExCoinSwap size={42} /></div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0098EA', marginBottom: 6 }}>{t.exchange.sellerFound}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#F0C85A', marginBottom: 4, fontFamily: "'JetBrains Mono',monospace" }}>{Number(orderCoins).toLocaleString()}</div>
          <div style={{ fontSize: 13, color: '#9A9490', marginBottom: 16 }}>
            {order.reservedByName ?? t.exchange.colPlayer} заморозил монеты и ждёт оплату
          </div>
          <div style={{ background: '#0D0D12', borderRadius: 12, padding: '12px 14px', marginBottom: 20, textAlign: 'left' as const }}>
            {[[t.exchange.youGet, `${Number(orderCoins).toLocaleString()}`], [t.exchange.willPay, `${order.totalTon.toFixed(4)} TON`], [t.exchange.colPrice, `${order.priceTon.toFixed(5)} TON/1M`]].map(([l,v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: '#9A9490' }}>{l}</span>
                <span style={{ fontWeight: 700, color: '#EAE2CC', fontFamily: "'JetBrains Mono',monospace" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.06)', color: '#9A9490', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.common.cancel}</button>
            <button onClick={handlePay} style={{ flex: 1, padding: '13px', background: 'rgba(0,152,234,0.15)', color: '#0098EA', border: '1px solid rgba(0,152,234,0.3)', borderRadius: 14, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              Оплатить {order.totalTon.toFixed(4)} TON
            </button>
          </div>
        </>)}
        {step === 'paying' && (<><div style={{ fontSize: 44, marginBottom: 12 }}><ExClock size={38} /></div><div style={{ fontSize: 14, color: '#EAE2CC' }}>{t.exchange.confirmInWalletShort}</div></>)}
        {step === 'verifying' && (<><div style={{ fontSize: 44, marginBottom: 12 }}><ExSearch size={38} /></div><div style={{ fontSize: 14, color: '#EAE2CC' }}>{t.exchange.verifying}...</div></>)}
        {step === 'done' && (<><div style={{ fontSize: 56, marginBottom: 12 }}>✓</div><div style={{ fontSize: 15, fontWeight: 800, color: '#3DBA7A', marginBottom: 8 }}>{t.exchange.coinsReceived}</div><div style={{ fontSize: 12, color: '#9A9490', marginBottom: 16 }}>{Number(orderCoins).toLocaleString()} {t.exchange.creditedToBalance}</div><button onClick={onClose} style={{ width: '100%', padding: '13px', background: 'rgba(0,214,143,0.12)', color: '#3DBA7A', border: '1px solid rgba(0,214,143,0.25)', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.common.close}</button></>)}
        {step === 'error' && (<><div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><ExWarn size={40} /></div><div style={{ fontSize: 14, fontWeight: 800, color: '#FF5B5B', marginBottom: 8 }}>{t.common.error}</div><div style={{ fontSize: 12, color: '#9A9490', marginBottom: 16 }}>{errMsg}</div><div style={{ display: 'flex', gap: 10 }}><button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)', color: '#9A9490', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.common.close}</button><button onClick={handlePay} style={{ flex: 1, padding: '12px', background: 'rgba(0,152,234,0.1)', color: '#0098EA', border: '1px solid rgba(0,152,234,0.2)', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.exchange.retry}</button></div></>)}
      </div>
    </div>
  );
};

// ── Main ExchangeTab component (E7) ────────────────────────
export const ExchangeTab: React.FC<ExchangeTabProps> = ({ user, showToast, onUserRefresh }) => {
  const t = useT();
  const hasWallet = !!user?.tonWalletAddress;
  const [period, setPeriod]           = useState<24|168|720>(24);
  const [priceData, setPriceData]     = useState<{ currentPrice: number; change24h: number; candles: PriceCandle[]; volume24h: number } | null>(null);
  const [orders, setOrders]           = useState<P2POrder[]>([]);
  const [myOrders, setMyOrders]       = useState<P2POrder[]>([]);
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [stats, setStats] = useState<{ openOrdersCount: number; volume24hTon: number; trades24h: number; allTimeTrades: number } | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [executeOrder, setExecuteOrder] = useState<P2POrder | null>(null);
  const [view, setView]               = useState<'buy' | 'sell' | 'buybook' | 'my' | 'top'>('buy');
  const [buyOrders, setBuyOrders]     = useState<BuyP2POrder[]>([]);
  const [showCreateBuy, setShowCreateBuy] = useState(false);
  const [fillOrder, setFillOrder]     = useState<BuyP2POrder | null>(null);
  const [payOrder, setPayOrder]       = useState<BuyP2POrder | null>(null);
  const [leaderboard, setLeaderboard] = useState<Array<{ rank: number; name: string; elo: number; trades: number; volumeTon: number }>>([]);
  const [lbPeriod, setLbPeriod]       = useState<'24h'|'7d'|'30d'>('30d'); // BUY order that seller accepts

  const loadPrice = useCallback(async () => {
    try {
      const [price, s] = await Promise.all([
        exchangeApi.getPriceHistory(period),
        exchangeApi.getStats(),
      ]);
      setPriceData(price);
      setStats(s);
    } catch {} finally {
      setLoadingPrice(false);
    }
  }, [period]);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const [all, mine, buys] = await Promise.all([
        exchangeApi.getOrders(false),
        hasWallet ? exchangeApi.getOrders(true) : Promise.resolve({ orders: [] }),
        exchangeApi.getBuyOrders(),
      ]);
      setOrders(all.orders);
      setMyOrders(mine.orders);
      setBuyOrders(buys.orders as BuyP2POrder[]);
    } catch {} finally {
      setLoadingOrders(false);
    }
  }, [hasWallet]);

  useEffect(() => { loadPrice(); }, [loadPrice]);
  useEffect(() => { loadOrders(); }, [loadOrders]);

  // E13: Auto-refresh on trade execution (socket push)
  useEffect(() => {
    const handler = () => {
      loadOrders();
      loadPrice();
      onUserRefresh();
    };
    window.addEventListener('chesscoin:exchange:executed', handler);
    return () => window.removeEventListener('chesscoin:exchange:executed', handler);
  }, [loadOrders, loadPrice, onUserRefresh]);

  const loadLeaderboard = useCallback(async () => {
    try {
      const data = await exchangeApi.getLeaderboard(lbPeriod);
      setLeaderboard(data.leaderboard);
    } catch {}
  }, [lbPeriod]);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  // Адрес для комиссии берём у сервера, а не из значения, зашитого в код.
  // Иначе при смене кошелька в .env комиссия уходила бы на старый адрес,
  // сервер её не находил бы и ни одна покупка не проходила (Кенан 09.08.2026).
  useEffect(() => {
    tonApi.rate()
      .then((r) => setPlatformWallet(r.platformWallet))
      .catch(() => { /* останется запасной адрес */ });
  }, []);

  const handleCancelOrder = async (orderId: string) => {
    try {
      await exchangeApi.cancelOrder(orderId);
      showToast(t.exchange.orderCancelled);
      loadOrders();
      onUserRefresh();
    } catch (e: unknown) {
      showToast((e as Error).message ?? t.exchange.cancelError);
    }
  };

  const up = (priceData?.change24h ?? 0) >= 0;

  // Подключение кошелька прямо из биржи.
  //
  // Здесь стоял укороченный путь: открыть TonConnect и сохранить адрес.
  // Сервер при этом требует подтверждения — новый адрес возвращает 402
  // WALLET_NOT_CONFIRMED (правило Кенана 31.07.2026: 1 TON один раз за адрес,
  // дальше тот же кошелёк бесплатно). Ответ 402 никто не обрабатывал: игрок
  // получал тост с ошибкой и упирался в стену — НОВЫЙ КОШЕЛЁК ПОДКЛЮЧИТЬ БЫЛО
  // НЕЛЬЗЯ ВООБЩЕ. Полный путь жил в панели магазина, которую не открывали.
  // Переносим его сюда целиком (Кенан 05.08.2026).
  const [connecting, setConnecting] = useState(false);

  /**
   * Подключение кошелька: адрес сохраняется ТОЛЬКО после оплаты 1 TON.
   *
   * Кенан 19.08.2026: «без получения 1 TON должно возвращать в игру без
   * подключения, с уведомлением — нет 1 TON оплаты».
   *
   * Две вещи, из-за которых процесс был неисправен:
   *
   * 1. ПРОВЕРКА ШЛА СРАЗУ. Платёж доходит до блокчейна за десятки секунд,
   *    а мы спрашивали сервер немедленно и получали «платёж не найден».
   *    Человек платил — и всё равно видел отказ. Теперь ждём и переспрашиваем.
   *
   * 2. ОТКАЗ ОСТАВЛЯЛ ПОЛОВИНУ. Сеанс TonConnect оставался подключённым,
   *    хотя на сервере адреса нет: экран показывал одно, сервер знал другое.
   *    Теперь при любой неудаче сеанс рвётся — возвращаемся в игру чистыми.
   */
  const handleConnect = async () => {
    if (connecting) return;
    setConnecting(true);

    /** Откат: рвём сеанс кошелька, чтобы экран и сервер не разошлись. */
    const откатить = async (сообщение: string) => {
      try { await disconnectWallet(); } catch { /* уже отключён */ }
      showToast(сообщение);
      onUserRefresh();
    };

    try {
      showToast(t.exchange.openingWallet);
      const wallet = await connectWallet();
      const addr = wallet.account?.address;
      if (!addr) throw new Error(t.exchange.walletAddrFail);

      try {
        await tonApi.connectWallet(addr);
      } catch (err: unknown) {
        const emsg = err instanceof Error ? err.message : String(err);
        if (!emsg.includes('WALLET_NOT_CONFIRMED')) throw err;

        // ── Адрес новый: просим разовую оплату 1 TON ──────────────────────
        let boc: string;
        try {
          showToast(t.shop.tonTab.unlockPrompt);
          boc = await sendVerificationPayment(user?.id ?? '');
        } catch (payErr: unknown) {
          // Не заплатил, закрыл кошелёк, вышло время — во всех случаях
          // подключения НЕ происходит, и человек должен это ПРОЧИТАТЬ.
          console.warn('[кошелёк] оплата не прошла:',
            payErr instanceof Error ? payErr.message : payErr);
          await откатить(t.exchange.noPayment);
          return;
        }

        // ── Платёж отправлен: ждём, пока он появится в блокчейне ──────────
        const ПОПЫТОК = 8;          // ~90 секунд суммарно
        const ПАУЗА_МС = 12_000;
        let подтверждён = false;
        for (let i = 1; i <= ПОПЫТОК && !подтверждён; i++) {
          showToast(t.exchange.checkingPayment(i, ПОПЫТОК));
          try {
            await tonApi.verifyWallet(addr, boc);
            подтверждён = true;
          } catch (vErr: unknown) {
            const vmsg = vErr instanceof Error ? vErr.message : String(vErr);
            // «Ещё не видно» — ждём дальше. Любая другая беда — наружу.
            const ещёНеВидно = /not confirmed|не найден|Try again/i.test(vmsg);
            if (!ещёНеВидно) throw vErr;
            if (i < ПОПЫТОК) await new Promise((r) => setTimeout(r, ПАУЗА_МС));
          }
        }
        if (!подтверждён) {
          await откатить(t.exchange.paymentNotFound);
          return;
        }
      }

      showToast(t.exchange.walletConnectedToast);
      onUserRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t.exchange.connectError;
      console.warn('[кошелёк] подключение не удалось:', msg);
      // Человек сам закрыл окно выбора кошелька — это не ошибка, но и
      // подключения нет: возвращаем чистое состояние молча.
      const самОтменил = /user\s*reject|cancell?ed by user|UserReject/i.test(msg);
      await откатить(самОтменил ? t.exchange.connectCancelled : msg);
    } finally {
      setConnecting(false);
    }
  };

  // Отвязка. Кенан 05.08.2026: «отвязать TON-кошелёк я не могу» — кнопки
  // не было ни на одном живом экране. Она жила в панели магазина, которую
  // никто не открывал: showTon никогда не становился true.
  //
  // Рвём и сеанс TonConnect в браузере, и запись на сервере. Если оборвать
  // только браузер, адрес остаётся в базе и другой кошелёк не подключить —
  // ровно этим Кенан жаловался 03.08.2026.
  const [disconnecting, setDisconnecting] = useState(false);
  const handleDisconnect = async () => {
    if (disconnecting) return;
    if (!window.confirm(t.exchange.disconnectConfirm)) return;
    setDisconnecting(true);
    try {
      try { await disconnectWallet(); } catch (e) { console.warn('[exchange] tonconnect disconnect', e); }
      await tonApi.disconnectWallet();
      showToast(t.exchange.walletDisconnected);
      onUserRefresh();
    } catch {
      showToast(t.exchange.disconnectFailed);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div style={{ paddingBottom: 24 }}>

      {/* ── Кошелёк. Кенан 03.08.2026: «подключить кошелёк и биржа — одна
            страница, а не два механизма». Пока не подключён — карточка
            подключения; после подключения ужимается в одну полоску, а ниже
            идёт сама биржа: цена, график, купля-продажа, стакан, история. ── */}
      {!hasWallet ? (
        <LockedScreen user={user} connecting={connecting} onConnect={handleConnect} />
      ) : (
        <div style={{
          margin: '0 18px 12px', padding: '10px 14px', borderRadius: 12,
          background: 'rgba(0,152,234,.07)', border: '.5px solid rgba(0,152,234,.25)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ color: '#5BC8F5', display: 'flex' }}><IcoTon size={16} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#5BC8F5' }}>{t.exchange.walletConnected}</div>
            <div style={{
              fontSize: 10, color: '#7A7875', fontFamily: "'JetBrains Mono',monospace",
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user?.tonWalletAddress}
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{
              flexShrink: 0, padding: '5px 10px', borderRadius: 8,
              background: 'transparent', color: '#9A9490',
              border: '.5px solid rgba(154,148,144,.28)',
              fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
              cursor: disconnecting ? 'default' : 'pointer',
              opacity: disconnecting ? 0.6 : 1,
            }}
          >
            {disconnecting ? t.exchange.disconnecting : t.exchange.disconnect}
          </button>
        </div>
      )}

      {/* ── Price indicator ── */}
      <div style={{ margin: '0 18px 12px', background: '#141018', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: '#5A5248', marginBottom: 4 }}>{t.exchange.pricePerMln}</div>
            {loadingPrice ? (
              <div style={{ fontSize: 24, fontWeight: 800, color: '#5A5248' }}>—</div>
            ) : (
              <div style={{ fontSize: 24, fontWeight: 800, color: '#F0C85A', fontFamily: "'JetBrains Mono',monospace" }}>
                {(priceData?.currentPrice ?? 0) > 0 ? (priceData!.currentPrice).toFixed(5) : '—'}
              </div>
            )}
            <div style={{ fontSize: 11, color: up ? '#3DBA7A' : '#FF5B5B', marginTop: 2 }}>
              {priceData?.currentPrice ? t.exchange.changeAndVolume(`${up ? '+' : ''}${priceData.change24h.toFixed(2)}`, priceData.volume24h.toFixed(2)) : t.exchange.noTradesYet}
            </div>
          </div>
          {/* Period switcher */}
          <div style={{ display: 'flex', gap: 4 }}>
            {PERIODS.map(p => (
              <button key={p.label} onClick={() => setPeriod(p.hours)} style={{ padding: '4px 8px', borderRadius: 8, border: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: period === p.hours ? 'rgba(245,200,66,0.15)' : 'rgba(255,255,255,0.05)', color: period === p.hours ? '#F0C85A' : '#5A5248' }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {/* E14: CandleChart */}
        <div style={{ overflow: 'hidden', borderRadius: 8 }}>
          <CandleChart candles={priceData?.candles ?? []} up={up} height={120} />
        </div>
      </div>

      {/* ── Exchange stats ── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, margin: '0 18px 12px' }}>
          {[
            { label: t.exchange.statOrders, value: String(stats.openOrdersCount) },
            { label: t.exchange.statVolume24, value: `${stats.volume24hTon.toFixed(2)} T` },
            { label: t.exchange.statTrades24, value: String(stats.trades24h) },
            { label: t.exchange.statTradesAll, value: String(stats.allTimeTrades) },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#141018', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#EAE2CC' }}>{value}</div>
              <div style={{ fontSize: 9, color: '#5A5248', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Action buttons (биржевые цвета: купить=зелёный, продать=красный) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '0 18px 12px' }}>
        <button onClick={() => setShowCreateBuy(true)} style={{ padding: '15px', background: 'linear-gradient(180deg,#0ECB81,#0BA873)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(14,203,129,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, letterSpacing: '.02em' }}>
          <IcoArrowDown size={16} /> {t.exchange.buy}
        </button>
        <button onClick={() => setShowCreate(true)} style={{ padding: '15px', background: 'linear-gradient(180deg,#F6465D,#D63A4F)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(246,70,93,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, letterSpacing: '.02em' }}>
          <IcoArrowUp size={16} /> {t.exchange.sell}
        </button>
      </div>

      {/* ── Order book tabs ── */}
      <div style={{ display: 'flex', margin: '0 18px 10px', background: '#141018', borderRadius: 10, padding: 3, gap: 2 }}>
        {([['buy',t.exchange.tabSelling],['buybook',t.exchange.tabBuying],['sell',t.exchange.tabMine],['my',t.exchange.tabHistory],['top',t.exchange.tabTop]] as ['buy'|'buybook'|'sell'|'my'|'top', string][]).map(([v, l]) => (
          <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: '7px 2px', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: view === v ? 'rgba(255,255,255,.05)' : 'transparent', color: view === v ? '#EAE2CC' : '#9A9490' }}>{l}</button>
        ))}
      </div>

      {/* ── Order book (view: Buy) ── */}
      {view === 'buy' && (
        <div style={{ padding: '0 18px' }}>
          {/* Price range in order book */}
          {orders.filter(o => o.status === 'OPEN' && !o.isOwn).length > 0 && (() => {
            const openOthers = orders.filter(o => o.status === 'OPEN' && !o.isOwn);
            const prices = openOthers.map(o => o.priceTon);
            const minP = Math.min(...prices); const maxP = Math.max(...prices);
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0 0 8px', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: '#3DBA7A' }}>Мин: {minP.toFixed(5)} TON</div>
                <div style={{ fontSize: 10, color: '#5A5248' }}>{openOthers.length} ордеров</div>
                <div style={{ fontSize: 10, color: '#FF5B5B' }}>Макс: {maxP.toFixed(5)} TON</div>
              </div>
            );
          })()}
          {/* Общий объём стакана: сколько монет выставлено и на сколько TON. */}
          {orders.filter(o => o.status === 'OPEN' && !o.isOwn).length > 0 && (() => {
            const open = orders.filter(o => o.status === 'OPEN' && !o.isOwn);
            const coins = open.reduce((sum, o) => sum + BigInt(o.amountCoins), 0n);
            const ton = open.reduce((sum, o) => sum + o.totalTon, 0);
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0 0 8px', padding: '8px 10px', background: 'rgba(0,152,234,0.06)', border: '1px solid rgba(0,152,234,0.15)', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: '#9A9490' }}>{t.exchange.onSale}</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: '#F0C85A' }}>
                  {fmtBalance(coins.toString())}
                  <span style={{ color: '#0098EA', marginLeft: 8 }}>{ton.toFixed(4)} TON</span>
                </div>
              </div>
            );
          })()}
          {/* Order book header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 4, padding: '6px 10px', marginBottom: 4 }}>
            {[t.exchange.seller, t.exchange.coinsInTon, t.exchange.colPricePerM].map(h => (
              <div key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.07em', color: '#5A5248', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>
          {loadingOrders ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#5A5248' }}>{t.exchange.loadingDots}</div>
          ) : orders.filter(o => o.status === 'OPEN' && !o.isOwn).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><ExEmpty size={30} /></div>
              <div style={{ fontSize: 13, color: '#5A5248' }}>{t.exchange.emptySell}</div>
              <div style={{ fontSize: 11, color: '#5A5248', marginTop: 4 }}>{t.exchange.beFirst}</div>
            </div>
          ) : orders.filter(o => o.status === 'OPEN' && !o.isOwn).sort((a,b) => a.priceTon - b.priceTon).map(order => (
            <div key={order.id} onClick={() => setExecuteOrder(order)} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 4, alignItems: 'center', padding: '10px', background: '#141018', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 6, cursor: 'pointer', transition: 'border-color .15s' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#EAE2CC' }}>{order.sellerName}</div>
                <div style={{ fontSize: 10, color: '#5A5248', marginTop: 1 }}>ELO {order.sellerElo}</div>
              </div>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#F0C85A' }}>
                  {fmtBalance(order.amountCoins)}
                </div>
                {/* Сколько это в TON — чтобы не считать в уме (Кенан 31.07). */}
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#0098EA', marginTop: 1 }}>
                  {order.totalTon.toFixed(4)} TON
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#0098EA' }}>{order.priceTon.toFixed(5)}</div>
                <div style={{ fontSize: 9, color: '#5A5248' }}>TON/1M</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── My orders ── */}
      {view === 'sell' && (
        <div style={{ padding: '0 18px' }}>
          {myOrders.filter(o => o.status === 'OPEN').length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><ExEmpty size={30} /></div>
              <div style={{ fontSize: 13, color: '#5A5248' }}>{t.exchange.emptyMine}</div>
            </div>
          ) : myOrders.filter(o => o.status === 'OPEN').map(order => (
            <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#141018', border: '1px solid rgba(245,200,66,0.15)', borderRadius: 14, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#F0C85A', fontFamily: "'JetBrains Mono',monospace" }}>{fmtBalance(order.amountCoins)}</div>
                <div style={{ fontSize: 11, color: '#9A9490', marginTop: 2 }}>{order.priceTon.toFixed(5)} TON/1M · total {order.totalTon.toFixed(4)} TON</div>
              </div>
              <button onClick={() => handleCancelOrder(order.id)} style={{ padding: '7px 12px', background: 'rgba(255,77,106,0.1)', color: '#FF5B5B', border: '1px solid rgba(255,77,106,0.2)', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Отменить
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Executed history ── */}
      {view === 'my' && (
        <div style={{ padding: '0 18px' }}>
          {myOrders.filter(o => o.status !== 'OPEN').length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}><ExTrophy size={30} /></div>
              <div style={{ fontSize: 13, color: '#5A5248' }}>{t.exchange.emptyHistory}</div>
            </div>
          ) : myOrders.filter(o => o.status !== 'OPEN').map(order => (
            <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#141018', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, marginBottom: 8 }}>
              <div style={{ fontSize: 24 }}>{order.status === 'EXECUTED' ? '✓' : '✕'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#EAE2CC' }}>{fmtBalance(order.amountCoins)}</div>
                <div style={{ fontSize: 10, color: '#5A5248', marginTop: 2 }}>{order.status === 'EXECUTED' ? t.exchange.executed : t.exchange.cancelled} · {order.priceTon.toFixed(5)} TON/1M</div>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: order.status === 'EXECUTED' ? '#3DBA7A' : '#5A5248' }}>
                {order.totalTon.toFixed(4)} TON
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Buyers order book (BUY orders) ── */}
      {view === 'buybook' && (
        <div style={{ padding: '0 18px' }}>
          {/* Мои ордера, которые продавец уже принял — ждут оплаты от меня */}
          {buyOrders.filter(o => o.isOwn && o.status === 'RESERVED').map(order => (
            <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#141018', border: '1px solid rgba(0,152,234,0.35)', borderRadius: 14, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0098EA' }}>{t.exchange.sellerFound}</div>
                <div style={{ fontSize: 11, color: '#9A9490', marginTop: 2 }}>
                  {Number(BigInt(order.amountCoins)).toLocaleString()} за {order.totalTon.toFixed(4)} TON
                </div>
              </div>
              <button onClick={() => setPayOrder(order)} style={{ padding: '9px 14px', background: 'rgba(0,152,234,0.15)', color: '#0098EA', border: '1px solid rgba(0,152,234,0.3)', borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                Оплатить
              </button>
            </div>
          ))}
          {buyOrders.filter(o => !o.isOwn && o.status === 'OPEN').length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><ExEmpty size={30} /></div>
              <div style={{ fontSize: 13, color: '#5A5248' }}>{t.exchange.emptyBuy}</div>
              <div style={{ fontSize: 11, color: '#5A5248', marginTop: 4 }}>{t.exchange.createBuyHint}</div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, padding: '6px 10px', marginBottom: 4 }}>
                {[t.exchange.buyer, t.exchange.colAmount, t.exchange.tonPrice].map(h => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.07em', color: '#5A5248', textTransform: 'uppercase' as const }}>{h}</div>
                ))}
              </div>
              {buyOrders.filter(o => !o.isOwn && o.status === 'OPEN').sort((a, b) => b.priceTon - a.priceTon).map(order => (
                <div key={order.id} onClick={() => setFillOrder(order)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, alignItems: 'center', padding: '10px', background: '#141018', border: '1px solid rgba(0,214,143,0.12)', borderRadius: 12, marginBottom: 6, cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#EAE2CC' }}>{(order as BuyP2POrder).buyerName ?? order.sellerName}</div>
                    <div style={{ fontSize: 10, color: '#5A5248', marginTop: 1 }}>ELO {(order as BuyP2POrder).buyerElo ?? order.sellerElo}</div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#3DBA7A' }}>
                    {Number(BigInt(order.amountCoins)).toLocaleString()}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#3DBA7A' }}>{order.priceTon.toFixed(5)}</div>
                    <div style={{ fontSize: 9, color: '#5A5248' }}>TON/1M</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {showCreate && user && (
        <CreateOrderModal
          userBalance={user.balance}
          marketPrice={priceData?.currentPrice ?? 0}
          onClose={() => setShowCreate(false)}
          onCreated={() => { loadOrders(); onUserRefresh(); }}
          showToast={showToast}
        />
      )}
      {executeOrder && user && (
        <ExecuteOrderModal
          order={executeOrder}
          buyerWallet={user.tonWalletAddress ?? ''}
          onClose={() => setExecuteOrder(null)}
          onExecuted={() => { loadOrders(); setExecuteOrder(null); }}
          showToast={showToast}
          onUserRefresh={onUserRefresh}
        />
      )}

      {/* P2: Trader leaderboard */}
      {view === 'top' && (
        <div style={{ padding: '0 18px' }}>
          {/* Period switcher */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {(['24h','7d','30d'] as const).map(p => (
              <button key={p} onClick={() => setLbPeriod(p)} style={{ flex: 1, padding: '7px', borderRadius: 10, border: 'none', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: lbPeriod === p ? 'rgba(245,200,66,0.15)' : '#141018', color: lbPeriod === p ? '#F0C85A' : '#9A9490' }}>
                {p === '24h' ? '24h' : p === '7d' ? '7 days' : '30 days'}
              </button>
            ))}
          </div>
          {/* List */}
          {leaderboard.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}><ExTrophy size={30} /></div>
              <div style={{ fontSize: 13, color: '#5A5248' }}>{t.exchange.noDataPeriod}</div>
            </div>
          ) : leaderboard.map((trader, i) => (
            <div key={trader.name + i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#141018', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, marginBottom: 6 }}>
              <div style={{ fontSize: i < 3 ? 22 : 14, fontWeight: 800, minWidth: 28, textAlign: 'center', color: i === 0 ? '#F0C85A' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#5A5248' }}>
                {i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : `${i+1}`}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#EAE2CC' }}>{trader.name}</div>
                <div style={{ fontSize: 10, color: '#5A5248', marginTop: 2 }}>ELO {trader.elo} · {trader.trades} trades</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: '#F0C85A' }}>{trader.volumeTon.toFixed(2)} TON</div>
                <div style={{ fontSize: 9, color: '#5A5248' }}>volume</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* E15: Create BUY order */}
      {showCreateBuy && (
        <CreateBuyOrderModal
          marketPrice={priceData?.currentPrice ?? 0}
          onClose={() => setShowCreateBuy(false)}
          onCreated={() => { loadOrders(); setShowCreateBuy(false); }}
          showToast={showToast}
        />
      )}

      {/* E15: Seller accepts BUY order */}
      {fillOrder && user && (
        <FillBuyOrderModal
          order={fillOrder}
          sellerWallet={user.tonWalletAddress ?? ''}
          userBalance={user.balance}
          onClose={() => setFillOrder(null)}
          onFilled={() => { loadOrders(); setFillOrder(null); onUserRefresh(); }}
          showToast={showToast}
        />
      )}

      {/* E15: Создатель BUY-ордера оплачивает зарезервированную сделку */}
      {payOrder && user && (
        <PayReservedOrderModal
          order={payOrder}
          onClose={() => setPayOrder(null)}
          onPaid={() => { loadOrders(); setPayOrder(null); onUserRefresh(); }}
        />
      )}
    </div>
  );
};
