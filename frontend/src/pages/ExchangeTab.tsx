// ═══════════════════════════════════════════════════════════════
// ExchangeTab — P2P Exchange ChessCoin v7.0.1
// Placement: "💱 Exchange" tab inside ShopPage
//
// Structure:
//   [Price indicator + CandleChart (TradingView)]
//   [Period switcher 1D/7D/30D]
//   [Order book]
//   [Sell ᚙ / Buy ᚙ buttons]
//
// Without TON wallet: locked screen, price visible, operations blocked
// With TON wallet: full functionality
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { exchangeApi, P2POrder, BuyP2POrder, PriceCandle } from '@/api';
import { fmtBalance } from '@/utils/format';
import type { User } from '@/types';
import { sendTonPayment } from '@/lib/tonconnect';
import { createChart, IChartApi, ColorType, LineStyle, type Time } from 'lightweight-charts';
import { useT } from '@/i18n/useT';

interface ExchangeTabProps {
  user: User | null;
  showToast: (msg: string) => void;
  onUserRefresh: () => void;
}

const PLATFORM_FEE = 0.005; // 0.5%
const MIN_PRICE    = 0.00001;
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
        textColor:   '#4A5270',
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
      const lineSeries = chart.addLineSeries({ color: '#4A5270', lineWidth: 1 });
      lineSeries.setData([{ time: Math.floor(Date.now() / 1000) as Time, value: 0 }]);
    } else {
      // Candlestick chart series
      const candleSeries = chart.addCandlestickSeries({
        upColor:          '#00D68F',
        downColor:        '#FF4D6A',
        borderUpColor:    '#00D68F',
        borderDownColor:  '#FF4D6A',
        wickUpColor:      '#00D68F',
        wickDownColor:    '#FF4D6A',
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
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted, #4A5270)', fontSize: 11, pointerEvents: 'none' }}>
          {t.exchange.noDataForPeriod}
        </div>
      )}
    </div>
  );
};

// ── Locked screen (no wallet) ───────────────────────────────
const LockedScreen: React.FC<{ currentPrice: number; change24h: number; onConnect: () => void }> = ({ currentPrice, change24h, onConnect }) => {
  const up = change24h >= 0;
  return (
    <div style={{ padding: '0 18px 24px' }}>
      {/* Price — visible to all */}
      <div style={{ background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 16, marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted, #4A5270)', marginBottom: 4 }}>CURRENT PRICE</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent, #F5C842)', fontFamily: "'JetBrains Mono',monospace" }}>
          {currentPrice > 0 ? `${currentPrice.toFixed(5)} TON` : '—'}
        </div>
        <div style={{ fontSize: 12, color: currentPrice > 0 ? (up ? '#00D68F' : '#FF4D6A') : 'var(--text-muted, #4A5270)', marginTop: 4 }}>
          {currentPrice > 0 ? `${up ? '+' : ''}${change24h.toFixed(2)}% 24h` : 'per 1,000,000 ᚙ'}
        </div>
      </div>

      {/* CTA connect wallet */}
      <div style={{ background: 'linear-gradient(135deg,rgba(0,152,234,0.12),rgba(0,152,234,0.06))', border: '1px solid rgba(0,152,234,0.3)', borderRadius: 18, padding: '24px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary, #F0F2F8)', marginBottom: 8 }}>
          Connect TON wallet
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B92A8)', lineHeight: 1.6, marginBottom: 20 }}>
          A TON wallet is required for exchange trading.<br />
          One-time payment: <b style={{ color: '#0098EA' }}>1 TON</b> — forever.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--text-secondary, #8B92A8)', marginBottom: 20 }}>
          {['💱 Sell ᚙ for TON directly to other players', '🛒 Buy ᚙ at market price', '💰 Platform fee: 0.5%'].map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{t}</div>
          ))}
        </div>
        <button onClick={onConnect} style={{ width: '100%', padding: '14px', background: 'linear-gradient(90deg,#0098EA,#006FB8)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          💎 Connect TON wallet
        </button>
      </div>
    </div>
  );
};

// ── Create order modal (E8) ────────────────────────────────
const CreateOrderModal: React.FC<{
  userBalance: string;
  onClose: () => void;
  onCreated: () => void;
  showToast: (m: string) => void;
}> = ({ userBalance, onClose, onCreated, showToast }) => {
  const t = useT();
  const maxCoins = Math.min(Number(BigInt(userBalance)), 100_000_000);
  const [amount, setAmount] = useState(Math.max(10_000, Math.min(100_000, maxCoins)));
  const [price, setPrice]   = useState(0.001); // TON per 1M ᚙ
  const [loading, setLoading] = useState(false);

  const totalTon  = (amount / 1_000_000) * price;
  const feeTon    = totalTon * PLATFORM_FEE;
  const netTon    = totalTon - feeTon;
  const QUICK = [10_000, 100_000, 1_000_000, 10_000_000].filter(v => v <= maxCoins);

  const handleCreate = async () => {
    if (amount < 10_000) return showToast(t.exchange.minCoins);
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
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg-card, #13161F)', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', borderRadius: '24px 24px 0 0', padding: '20px 18px', paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
        <div style={{ width: 36, height: 4, background: '#2A2F48', borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary, #F0F2F8)' }}>📤 Sell ᚙ</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>✕</button>
        </div>

        {/* Amount ᚙ */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--text-muted, #4A5270)', marginBottom: 8 }}>AMOUNT ᚙ</div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 800, color: 'var(--accent, #F5C842)', textAlign: 'center', marginBottom: 10 }}>
          {fmtBalance(String(amount))} ᚙ
        </div>
        <input type="range" min={10_000} max={maxCoins} step={10_000} value={amount}
          onChange={e => setAmount(Number(e.target.value))}
          style={{ width: '100%', marginBottom: 10, accentColor: 'var(--accent, #F5C842)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 18 }}>
          {QUICK.map(v => (
            <button key={v} onClick={() => setAmount(v)} style={{ padding: '7px 4px', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: amount === v ? 'rgba(245,200,66,0.12)' : 'var(--bg-card, #1C2030)', color: amount === v ? 'var(--accent, #F5C842)' : 'var(--text-secondary)', border: `1px solid ${amount === v ? 'rgba(245,200,66,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
              {v >= 1_000_000 ? `${v/1_000_000}M` : v >= 1_000 ? `${v/1_000}K` : v}
            </button>
          ))}
        </div>

        {/* Price */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--text-muted, #4A5270)', marginBottom: 8 }}>PRICE (TON per 1,000,000 ᚙ)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <button onClick={() => setPrice(p => Math.max(MIN_PRICE, +(p * 0.9).toFixed(5)))} style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
          <input type="number" min={MIN_PRICE} step={0.00001} value={price}
            onChange={e => setPrice(Math.max(MIN_PRICE, Number(e.target.value)))}
            style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-input, #1A1E2E)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'var(--text-primary, #F0F2F8)', fontSize: 15, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, textAlign: 'center', outline: 'none' }} />
          <button onClick={() => setPrice(p => +(p * 1.1).toFixed(5))} style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        </div>

        {/* Total */}
        <div style={{ background: 'var(--bg, #0D0F17)', borderRadius: 12, padding: '12px 14px', marginBottom: 18 }}>
          {[
            ['Total TON', `${totalTon.toFixed(4)} TON`],
            ['Fee 0.5%', `${feeTon.toFixed(4)} TON`],
            ['You receive', `${netTon.toFixed(4)} TON`],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-secondary, #8B92A8)' }}>{l}</span>
              <span style={{ fontWeight: 700, color: l === 'You receive' ? '#00D68F' : 'var(--text-primary, #F0F2F8)', fontFamily: "'JetBrains Mono',monospace" }}>{v}</span>
            </div>
          ))}
        </div>

        <button onClick={handleCreate} disabled={loading || amount < 10_000} style={{ width: '100%', padding: '16px', background: loading ? '#2A2F48' : 'var(--accent, #F5C842)', color: loading ? 'var(--text-muted)' : '#0B0D11', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Creating order...' : '📤 Place order'}
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
      const { txHash, boc } = await sendTonPayment({
        toAddress:  order.sellerWallet,
        amount:     toSeller,
        comment:    `ChessCoin P2P Order ${order.id}`,
      });

      setStep('verifying');
      // Send proof to backend (with partial amount if needed)
      await exchangeApi.executeOrder(order.id, txHash, boc, isPartial ? String(partialAmt) : undefined);
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
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, background: 'linear-gradient(135deg,#181B2E,#12162A)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 28, textAlign: 'center' }}>

        {step === 'confirm' && (<>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🛒</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary, #F0F2F8)', marginBottom: 8 }}>Buy ᚙ</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent, #F5C842)', marginBottom: 4, fontFamily: "'JetBrains Mono',monospace" }}>
            {fmtBalance(order.amountCoins)} ᚙ
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary, #8B92A8)', marginBottom: 20 }}>from {order.sellerName} · ELO {order.sellerElo}</div>
          {/* E12: Partial purchase slider */}
          {maxCoins > 100_000 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted,#4A5270)', marginBottom: 6 }}>
                <span>Amount</span>
                <span style={{ color: 'var(--accent,#F5C842)', fontWeight: 700 }}>{partialAmt.toLocaleString()} ᚙ {isPartial ? '(partial)' : '(all)'}</span>
              </div>
              <input type="range" min={Math.min(10_000, maxCoins)} max={maxCoins} step={10_000}
                value={partialAmt} onChange={e => setPartialAmt(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent,#F5C842)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted,#4A5270)', marginTop: 3 }}>
                <span>10K ᚙ</span><span>{(maxCoins/1000).toFixed(0)}K ᚙ</span>
              </div>
            </div>
          )}
          <div style={{ background: 'var(--bg, #0D0F17)', borderRadius: 12, padding: '12px 14px', marginBottom: 20, textAlign: 'left' }}>
            {[
              ['Price', `${order.priceTon.toFixed(5)} TON/1M ᚙ`],
              ['Total', `${totalTon.toFixed(4)} TON`],
              ['To seller', `${toSeller.toFixed(4)} TON`],
              ['Platform fee', `${feeTon.toFixed(4)} TON`],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-secondary, #8B92A8)' }}>{l}</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', fontFamily: "'JetBrains Mono',monospace" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={handlePay} style={{ flex: 1, padding: '13px', background: 'rgba(0,152,234,0.15)', color: '#0098EA', border: '1px solid rgba(0,152,234,0.35)', borderRadius: 14, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              💎 Pay {totalTon.toFixed(4)} TON
            </button>
          </div>
        </>)}

        {step === 'paying' && (<>
          <div style={{ fontSize: 44, marginBottom: 16 }}>⏳</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t.exchange.awaitingConfirmation}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{t.exchange.confirmInWallet}</div>
        </>)}

        {step === 'verifying' && (<>
          <div style={{ fontSize: 44, marginBottom: 16 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t.exchange.verifying}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{t.exchange.checkingBlockchain}</div>
        </>)}

        {step === 'done' && (<>
          <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#00D68F', marginBottom: 8 }}>{t.common.success}!</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            {t.exchange.credited(fmtBalance(order.amountCoins))}
          </div>
          <button onClick={onClose} style={{ width: '100%', padding: '14px', background: 'rgba(0,214,143,0.15)', color: '#00D68F', border: '1px solid rgba(0,214,143,0.3)', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.common.close}</button>
        </>)}

        {step === 'error' && (<>
          <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--red, #FF4D6A)', marginBottom: 8 }}>{t.exchange.operationAborted}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
            {errMsg}<br />
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{t.exchange.coinsNotCharged}</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.common.close}</button>
            <button onClick={handlePay} style={{ flex: 1, padding: '13px', background: 'rgba(0,152,234,0.12)', color: '#0098EA', border: '1px solid rgba(0,152,234,0.25)', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.exchange.retry}</button>
          </div>
        </>)}
      </div>
    </div>
  );
};


// ── E15: CreateBuyOrderModal ──────────────────────────────────
const CreateBuyOrderModal: React.FC<{
  onClose: () => void;
  onCreated: () => void;
  showToast: (m: string) => void;
}> = ({ onClose, onCreated, showToast }) => {
  const t = useT();
  const [amount, setAmount] = useState(100_000);
  const [price, setPrice]   = useState(0.001);
  const [loading, setLoading] = useState(false);
  const totalTon = (amount / 1_000_000) * price;
  const QUICK = [10_000, 100_000, 1_000_000, 10_000_000];

  const handleCreate = async () => {
    if (amount < 10_000) return showToast(t.exchange.minCoins);
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
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg-card, #13161F)', border: '1px solid rgba(0,152,234,0.2)', borderBottom: 'none', borderRadius: '24px 24px 0 0', padding: '20px 18px', paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
        <div style={{ width: 36, height: 4, background: '#2A2F48', borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0098EA' }}>🛒 Buy ᚙ (BUY)</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>✕</button>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 8 }}>WANT TO BUY ᚙ</div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 26, fontWeight: 800, color: '#0098EA', textAlign: 'center', marginBottom: 10 }}>
          {amount.toLocaleString()} ᚙ
        </div>
        <input type="range" min={10_000} max={10_000_000} step={10_000} value={amount} onChange={e => setAmount(Number(e.target.value))} style={{ width: '100%', marginBottom: 10, accentColor: '#0098EA' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 16 }}>
          {QUICK.map(v => (
            <button key={v} onClick={() => setAmount(v)} style={{ padding: '7px 4px', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: amount === v ? 'rgba(0,152,234,0.15)' : 'var(--bg-card,#1C2030)', color: amount === v ? '#0098EA' : 'var(--text-secondary)', border: `1px solid ${amount === v ? 'rgba(0,152,234,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
              {v >= 1_000_000 ? `${v/1_000_000}M` : `${v/1_000}K`}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 8 }}>MY PRICE (TON per 1M ᚙ)</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={() => setPrice(p => Math.max(MIN_PRICE, +(p*0.9).toFixed(5)))} style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--bg-card,#1C2030)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
          <input type="number" min={MIN_PRICE} step={0.00001} value={price} onChange={e => setPrice(Math.max(MIN_PRICE, Number(e.target.value)))} style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-input,#1A1E2E)', border: '1px solid rgba(0,152,234,0.2)', borderRadius: 10, color: '#0098EA', fontSize: 15, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, textAlign: 'center' as const, outline: 'none' }} />
          <button onClick={() => setPrice(p => +(p*1.1).toFixed(5))} style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--bg-card,#1C2030)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        </div>
        <div style={{ background: 'var(--bg,#0D0F17)', borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
          {[['Pay TON', `${totalTon.toFixed(4)} TON`], ['Receive ᚙ', `${amount.toLocaleString()} ᚙ`]].map(([l,v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{l}</span>
              <span style={{ fontWeight: 700, color: '#0098EA', fontFamily: "'JetBrains Mono',monospace" }}>{v}</span>
            </div>
          ))}
        </div>
        <button onClick={handleCreate} disabled={loading} style={{ width: '100%', padding: '14px', background: loading ? '#2A2F48' : 'rgba(0,152,234,0.2)', color: '#0098EA', border: '1px solid rgba(0,152,234,0.4)', borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {loading ? 'Creating...' : '🛒 Place BUY order'}
        </button>
      </div>
    </div>
  );
};

// ── E15: FillBuyOrderModal (seller accepts BUY) ───────────
const FillBuyOrderModal: React.FC<{
  order: BuyP2POrder;
  sellerWallet: string;
  userBalance: string;
  onClose: () => void;
  onFilled: () => void;
  showToast: (m: string) => void;
}> = ({ order, sellerWallet, userBalance, onClose, onFilled, showToast }) => {
  const t = useT();
  const [step, setStep] = useState<'confirm'|'paying'|'verifying'|'done'|'error'>('confirm');
  const [errMsg, setErrMsg] = useState('');
  const balance = BigInt(userBalance);
  const orderCoins = BigInt(order.amountCoins);
  const hasEnough = balance >= orderCoins;
  const buyerWalletAddr = order.buyerWallet ?? order.sellerWallet;

  const handleFill = async () => {
    if (!hasEnough) return showToast('Insufficient ᚙ to fill this order');
    setStep('paying');
    try {
      // Buyer (BUY order creator) pays seller (us) via TonConnect
      const { txHash, boc } = await sendTonPayment({
        toAddress: sellerWallet,        // ᚙ seller receives TON
        amount:    order.totalTon,
        comment:   `ChessCoin BUY Order ${order.id}`,
      });
      setStep('verifying');
      await exchangeApi.fillBuyOrder(order.id, txHash, boc);
      setStep('done');
      onFilled();
    } catch (e: unknown) {
      setErrMsg((e as Error)?.message ?? 'Transaction cancelled');
      setStep('error');
    }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, background: 'linear-gradient(135deg,#0A1628,#12162A)', border: '1px solid rgba(0,214,143,0.25)', borderRadius: 24, padding: 28, textAlign: 'center' }}>
        {step === 'confirm' && (<>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📤</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#00D68F', marginBottom: 6 }}>Sell ᚙ to buyer</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent,#F5C842)', marginBottom: 4, fontFamily: "'JetBrains Mono',monospace" }}>{Number(orderCoins).toLocaleString()} ᚙ</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Buyer: {order.buyerName ?? 'Player'} · ELO {order.buyerElo ?? order.sellerElo}
          </div>
          {!hasEnough && <div style={{ fontSize: 12, color: 'var(--red,#FF4D6A)', marginBottom: 12, padding: '8px 12px', background: 'rgba(255,77,106,0.1)', borderRadius: 10 }}>⚠️ Insufficient ᚙ balance</div>}
          <div style={{ background: 'var(--bg,#0D0F17)', borderRadius: 12, padding: '12px 14px', marginBottom: 20, textAlign: 'left' as const }}>
            {[['Selling', `${Number(orderCoins).toLocaleString()} ᚙ`], ['You receive', `${order.totalTon.toFixed(4)} TON`], ['Price', `${order.priceTon.toFixed(5)} TON/1M ᚙ`]].map(([l,v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{l}</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono',monospace" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.common.cancel}</button>
            <button onClick={handleFill} disabled={!hasEnough} style={{ flex: 1, padding: '13px', background: 'rgba(0,214,143,0.15)', color: '#00D68F', border: '1px solid rgba(0,214,143,0.3)', borderRadius: 14, fontSize: 13, fontWeight: 800, cursor: hasEnough ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: hasEnough ? 1 : 0.5 }}>
              {t.exchange.sellFor(order.totalTon.toFixed(4))}
            </button>
          </div>
        </>)}
        {step === 'paying' && (<><div style={{ fontSize: 44, marginBottom: 12 }}>⏳</div><div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{t.exchange.buyerPaying}</div></>)}
        {step === 'verifying' && (<><div style={{ fontSize: 44, marginBottom: 12 }}>🔍</div><div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{t.exchange.verifying}...</div></>)}
        {step === 'done' && (<><div style={{ fontSize: 56, marginBottom: 12 }}>✅</div><div style={{ fontSize: 15, fontWeight: 800, color: '#00D68F', marginBottom: 8 }}>{t.exchange.saleSuccess}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>{t.exchange.transferred(Number(orderCoins).toLocaleString())}</div><button onClick={onClose} style={{ width: '100%', padding: '13px', background: 'rgba(0,214,143,0.12)', color: '#00D68F', border: '1px solid rgba(0,214,143,0.25)', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.common.close}</button></>)}
        {step === 'error' && (<><div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--red,#FF4D6A)', marginBottom: 8 }}>{t.common.error}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>{errMsg}</div><div style={{ display: 'flex', gap: 10 }}><button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.common.close}</button><button onClick={handleFill} style={{ flex: 1, padding: '12px', background: 'rgba(0,214,143,0.1)', color: '#00D68F', border: '1px solid rgba(0,214,143,0.2)', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.exchange.retry}</button></div></>)}
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
      setBuyOrders(buys.orders as any);
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

  if (!hasWallet) {
    return (
      <LockedScreen
        currentPrice={priceData?.currentPrice ?? 0}
        change24h={priceData?.change24h ?? 0}
        onConnect={() => showToast('Connect TON wallet in the section above')}
      />
    );
  }

  return (
    <div style={{ paddingBottom: 24 }}>

      {/* ── Price indicator ── */}
      <div style={{ margin: '0 18px 12px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', marginBottom: 4 }}>ᚙ / TON (per 1M ᚙ)</div>
            {loadingPrice ? (
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-muted)' }}>—</div>
            ) : (
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent, #F5C842)', fontFamily: "'JetBrains Mono',monospace" }}>
                {(priceData?.currentPrice ?? 0) > 0 ? (priceData!.currentPrice).toFixed(5) : '—'}
              </div>
            )}
            <div style={{ fontSize: 11, color: up ? '#00D68F' : '#FF4D6A', marginTop: 2 }}>
              {priceData?.currentPrice ? `${up ? '+' : ''}${priceData.change24h.toFixed(2)}% 24h · Vol: ${priceData.volume24h.toFixed(2)} TON` : 'No trades'}
            </div>
          </div>
          {/* Period switcher */}
          <div style={{ display: 'flex', gap: 4 }}>
            {PERIODS.map(p => (
              <button key={p.label} onClick={() => setPeriod(p.hours)} style={{ padding: '4px 8px', borderRadius: 8, border: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: period === p.hours ? 'rgba(245,200,66,0.15)' : 'rgba(255,255,255,0.05)', color: period === p.hours ? 'var(--accent, #F5C842)' : 'var(--text-muted, #4A5270)' }}>
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
            { label: 'Orders', value: String(stats.openOrdersCount) },
            { label: 'Vol 24h', value: `${stats.volume24hTon.toFixed(2)} T` },
            { label: 'Trades 24h', value: String(stats.trades24h) },
            { label: 'Total trades', value: String(stats.allTimeTrades) },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--bg-card,#1C2030)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: 'var(--text-primary,#F0F2F8)' }}>{value}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted,#4A5270)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Action buttons ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '0 18px 10px' }}>
        <button onClick={() => setShowCreate(true)} style={{ padding: '12px', background: 'rgba(0,214,143,0.12)', color: '#00D68F', border: '1px solid rgba(0,214,143,0.3)', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
          📤 Sell ᚙ
        </button>
        <button onClick={() => setShowCreateBuy(true)} style={{ padding: '12px', background: 'rgba(0,152,234,0.12)', color: '#0098EA', border: '1px solid rgba(0,152,234,0.3)', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
          🛒 Buy ᚙ
        </button>
      </div>

      {/* ── Order book tabs ── */}
      <div style={{ display: 'flex', margin: '0 18px 10px', background: 'var(--bg-card, #1C2030)', borderRadius: 10, padding: 3, gap: 2 }}>
        {([['buy','📉 Selling'],['buybook','📈 Buying'],['sell','📋 Mine'],['my','📊 History'],['top','🏆 Top']] as ['buy'|'buybook'|'sell'|'my'|'top', string][]).map(([v, l]) => (
          <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: '7px 2px', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: view === v ? 'var(--bg-input, #232840)' : 'transparent', color: view === v ? 'var(--text-primary, #F0F2F8)' : 'var(--text-secondary, #8B92A8)' }}>{l}</button>
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
                <div style={{ fontSize: 10, color: '#00D68F' }}>Min: {minP.toFixed(5)} TON</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted,#4A5270)' }}>{openOthers.length} orders</div>
                <div style={{ fontSize: 10, color: 'var(--red,#FF4D6A)' }}>Max: {maxP.toFixed(5)} TON</div>
              </div>
            );
          })()}
          {/* Order book header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, padding: '6px 10px', marginBottom: 4 }}>
            {['Seller', 'Amount ᚙ', 'Price TON'].map(h => (
              <div key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.07em', color: 'var(--text-muted, #4A5270)', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>
          {loadingOrders ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading...</div>
          ) : orders.filter(o => o.status === 'OPEN' && !o.isOwn).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No sell orders yet</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Be the first — place an order!</div>
            </div>
          ) : orders.filter(o => o.status === 'OPEN' && !o.isOwn).sort((a,b) => a.priceTon - b.priceTon).map(order => (
            <div key={order.id} onClick={() => setExecuteOrder(order)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, alignItems: 'center', padding: '10px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 6, cursor: 'pointer', transition: 'border-color .15s' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>{order.sellerName}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>ELO {order.sellerElo}</div>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: 'var(--accent, #F5C842)' }}>
                {fmtBalance(order.amountCoins)} ᚙ
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#0098EA' }}>{order.priceTon.toFixed(5)}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>TON/1M</div>
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
              <div style={{ fontSize: 32, marginBottom: 8 }}>📤</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>You have no active orders</div>
            </div>
          ) : myOrders.filter(o => o.status === 'OPEN').map(order => (
            <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(245,200,66,0.15)', borderRadius: 14, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent, #F5C842)', fontFamily: "'JetBrains Mono',monospace" }}>{fmtBalance(order.amountCoins)} ᚙ</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{order.priceTon.toFixed(5)} TON/1M · total {order.totalTon.toFixed(4)} TON</div>
              </div>
              <button onClick={() => handleCancelOrder(order.id)} style={{ padding: '7px 12px', background: 'rgba(255,77,106,0.1)', color: 'var(--red, #FF4D6A)', border: '1px solid rgba(255,77,106,0.2)', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
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
              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>History is empty</div>
            </div>
          ) : myOrders.filter(o => o.status !== 'OPEN').map(order => (
            <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, marginBottom: 8 }}>
              <div style={{ fontSize: 24 }}>{order.status === 'EXECUTED' ? '✅' : '❌'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtBalance(order.amountCoins)} ᚙ</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{order.status === 'EXECUTED' ? 'Executed' : 'Cancelled'} · {order.priceTon.toFixed(5)} TON/1M</div>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: order.status === 'EXECUTED' ? '#00D68F' : 'var(--text-muted)' }}>
                {order.totalTon.toFixed(4)} TON
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Buyers order book (BUY orders) ── */}
      {view === 'buybook' && (
        <div style={{ padding: '0 18px' }}>
          {buyOrders.filter(o => !o.isOwn).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No buy orders</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Create a BUY order — set price and amount</div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, padding: '6px 10px', marginBottom: 4 }}>
                {['Buyer', 'Amount ᚙ', 'Price TON'].map(h => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.07em', color: 'var(--text-muted, #4A5270)', textTransform: 'uppercase' as const }}>{h}</div>
                ))}
              </div>
              {buyOrders.filter(o => !o.isOwn).sort((a, b) => b.priceTon - a.priceTon).map(order => (
                <div key={order.id} onClick={() => setFillOrder(order)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, alignItems: 'center', padding: '10px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(0,214,143,0.12)', borderRadius: 12, marginBottom: 6, cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>{(order as BuyP2POrder).buyerName ?? order.sellerName}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>ELO {(order as BuyP2POrder).buyerElo ?? order.sellerElo}</div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#00D68F' }}>
                    {Number(BigInt(order.amountCoins)).toLocaleString()} ᚙ
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#00D68F' }}>{order.priceTon.toFixed(5)}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>TON/1M</div>
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
              <button key={p} onClick={() => setLbPeriod(p)} style={{ flex: 1, padding: '7px', borderRadius: 10, border: 'none', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: lbPeriod === p ? 'rgba(245,200,66,0.15)' : 'var(--bg-card,#1C2030)', color: lbPeriod === p ? 'var(--accent,#F5C842)' : 'var(--text-secondary)' }}>
                {p === '24h' ? '24h' : p === '7d' ? '7 days' : '30 days'}
              </button>
            ))}
          </div>
          {/* List */}
          {leaderboard.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No data for this period</div>
            </div>
          ) : leaderboard.map((trader, i) => (
            <div key={trader.name + i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-card,#1C2030)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, marginBottom: 6 }}>
              <div style={{ fontSize: i < 3 ? 22 : 14, fontWeight: 800, minWidth: 28, textAlign: 'center', color: i === 0 ? '#F5C842' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--text-muted)' }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{trader.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>ELO {trader.elo} · {trader.trades} trades</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: 'var(--accent,#F5C842)' }}>{trader.volumeTon.toFixed(2)} TON</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>volume</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* E15: Create BUY order */}
      {showCreateBuy && (
        <CreateBuyOrderModal
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
    </div>
  );
};
