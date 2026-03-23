// ─────────────────────────────────────────────────────────────────────────────
// CandleChart.tsx — Candlestick график для P2P биржи (E14)
// Использует lightweight-charts от TradingView (MIT)
// Установка: npm install lightweight-charts
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import type { IChartApi, UTCTimestamp } from 'lightweight-charts';
import type { PriceCandle } from '@/api';
import { useT } from '@/i18n/useT';

interface CandleChartProps {
  candles: PriceCandle[];
  up:      boolean;
  height?: number;
}

export const CandleChart: React.FC<CandleChartProps> = ({ candles, up, height = 80 }) => {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Динамический импорт — не блокируем первый рендер
    import('lightweight-charts').then(({ createChart, ColorType, CrosshairMode }) => {
      if (!containerRef.current) return;
      // Удаляем старый график если он был
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

      const chart = createChart(containerRef.current, {
        width:  containerRef.current.clientWidth,
        height,
        layout: {
          background:  { type: ColorType.Solid, color: 'transparent' },
          textColor:   '#4A5270',
        },
        grid: {
          vertLines:   { color: 'rgba(255,255,255,0.03)' },
          horzLines:   { color: 'rgba(255,255,255,0.03)' },
        },
        crosshair:    { mode: CrosshairMode.Magnet },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)', textColor: '#4A5270', scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true, secondsVisible: false },
        handleScroll: false,
        handleScale:  false,
      });

      const upColor   = '#00D68F';
      const downColor = '#FF4D6A';

      const series = chart.addCandlestickSeries({
        upColor,
        downColor,
        borderUpColor:   upColor,
        borderDownColor: downColor,
        wickUpColor:     upColor,
        wickDownColor:   downColor,
      });

      // Форматируем данные для lightweight-charts
      const data = candles
        .filter(c => c.open && c.high && c.low && c.close)
        .map(c => ({
          time:  Math.floor(new Date(c.time).getTime() / 1000) as UTCTimestamp,
          open:  c.open,
          high:  c.high,
          low:   c.low,
          close: c.close,
        }))
        .sort((a, b) => a.time - b.time);

      if (data.length > 0) {
        series.setData(data);
        chart.timeScale().fitContent();
      }

      chartRef.current  = chart;
      seriesRef.current = series;

      // Адаптивная ширина
      const ro = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.resize(containerRef.current.clientWidth, height);
        }
      });
      ro.observe(containerRef.current);
      return () => ro.disconnect();
    }).catch(() => {
      // Fallback: если lightweight-charts не установлен — показываем заглушку
    });

    return () => {
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    };
  }, [candles, height]);

  // Если нет данных — простая sparkline заглушка
  if (candles.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted, #4A5270)', fontSize: 11 }}>
        {t.exchange.noChartData}
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: '100%', height }} />;
};
