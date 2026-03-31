/**
 * VictoryScreen.tsx — V3: Помпезный экран победы на 3 секунды
 * Появляется ДО GameResultModal. Проигрыш — маленький тост, без экрана.
 */

import React, { useEffect, useState, useRef } from 'react';
import { sound } from '@/lib/sound';
import { haptic } from '@/lib/haptic';
import { useUserStore } from '@/store/useUserStore';
import { WIN_ANIMATION_CONFIG } from '@/lib/equippedItems';
import { useT } from '@/i18n/useT';

interface VictoryScreenProps {
  result: 'win' | 'lose' | 'draw';
  opponentName?: string;
  earned?: string;
  onDone: () => void;
}

interface Spark { id: number; x: number; y: number; color: string; size: number; dur: number; delay: number }
const COLORS = ['#F5C842','#FF4D6A','#9B85FF','#00D68F','#FFD700','#FF9F43','#64C8FF','#E040FB','#00FF9D'];

function makeSparks(n: number): Spark[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -10 - Math.random() * 20,
    color: COLORS[i % COLORS.length]!,
    size: 6 + Math.random() * 12,
    dur: 1400 + Math.random() * 1600,
    delay: Math.random() * 800,
  }));
}

export const VictoryScreen: React.FC<VictoryScreenProps> = ({ result, opponentName, earned, onDone }) => {
  const t = useT();
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [wave2, setWave2] = useState<Spark[]>([]);
  const user = useUserStore((s) => s.user);
  const winAnimName = user?.equippedItems?.WIN_ANIMATION?.name;
  const winCfg = winAnimName ? (WIN_ANIMATION_CONFIG[winAnimName] ?? null) : null;
  const doneRef = useRef(false);

  // Проигрыш — сразу onDone без экрана (обрабатывается снаружи через Toast)
  useEffect(() => {
    if (result === 'lose') { onDone(); return; }
    if (result === 'draw') {
      const t = setTimeout(() => onDone(), 1500);
      return () => clearTimeout(t);
    }

    // WIN — торжество
    const duration = winCfg?.duration ?? 3000;

    setPhase('enter');
    setSparks(makeSparks(70));
    sound.win();
    haptic.win();

    const t1 = setTimeout(() => setPhase('show'), 100);
    const t2 = setTimeout(() => setWave2(makeSparks(50)), 800);
    const t3 = setTimeout(() => setPhase('exit'), duration - 400);
    const t4 = setTimeout(() => {
      if (!doneRef.current) { doneRef.current = true; onDone(); }
    }, duration);

    return () => { [t1,t2,t3,t4].forEach(clearTimeout); };
  }, []);

  if (result === 'lose' || result === 'draw') return null;

  const isVisible = phase === 'show';
  const emoji = winCfg ? winCfg.emoji : '🏆';

  return (
    <div style={overlay}>
      {/* Конфетти — первая волна */}
      <div style={sparksContainer}>
        {sparks.map(s => <div key={s.id} style={sparkCss(s)} />)}
        {wave2.map(s => <div key={`w2_${s.id}`} style={sparkCss(s)} />)}
      </div>

      {/* Центральный контент */}
      <div style={{
        ...centerContent,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.7) translateY(30px)',
      }}>
        {/* Большой эмодзи */}
        <div style={bigEmoji}>{emoji}</div>

        {/* Заголовок */}
        <div style={victoryTitle}>{t.gameResult.win.toUpperCase()}</div>

        {/* Имя соперника */}
        {opponentName && (
          <div style={opponentText}>
            {t.game.youWon} {opponentName}
          </div>
        )}

        {/* Заработано */}
        {earned && BigInt(earned) > 0n && (
          <div style={earnedText}>
            +{Number(BigInt(earned) / 1000n)}K ᚙ
          </div>
        )}

        {/* Обратный отсчёт */}
        <CountdownDots duration={winCfg?.duration ?? 3000} />
      </div>
    </div>
  );
};

// ── Три точки — визуальный отсчёт ─────────────────────────────────────────────
const CountdownDots: React.FC<{ duration: number }> = ({ duration }) => {
  const [active, setActive] = useState(3);
  useEffect(() => {
    const interval = (duration - 400) / 3;
    const t1 = setTimeout(() => setActive(2), interval);
    const t2 = setTimeout(() => setActive(1), interval * 2);
    const t3 = setTimeout(() => setActive(0), interval * 3);
    return () => [t1,t2,t3].forEach(clearTimeout);
  }, [duration]);

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
      {[3,2,1].map(n => (
        <div key={n} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: active >= n ? 'var(--accent, #F5C842)' : 'rgba(255,255,255,0.2)',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  );
};

// ── Стили ─────────────────────────────────────────────────────────────────────
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: "var(--z-overlay, 200)",
  background: 'rgba(0,0,0,0.88)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const sparksContainer: React.CSSProperties = {
  position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden',
};

const centerContent: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
  transition: 'all 0.5s cubic-bezier(.34,1.56,.64,1)',
  position: 'relative', zIndex: 2,
};

const bigEmoji: React.CSSProperties = {
  fontSize: 80, lineHeight: 1,
  animation: 'pulse 1.2s ease-in-out infinite',
  filter: 'drop-shadow(0 0 30px rgba(245,200,66,0.6))',
};

const victoryTitle: React.CSSProperties = {
  fontSize: 48, fontWeight: 900,
  color: '#F5C842',
  letterSpacing: '0.1em',
  fontFamily: 'inherit',
  textShadow: '0 0 40px rgba(245,200,66,0.8), 0 0 80px rgba(245,200,66,0.4)',
  animation: 'victoryPulse 1.5s ease-in-out infinite',
};

const opponentText: React.CSSProperties = {
  fontSize: 16, color: 'rgba(255,255,255,0.8)',
  fontFamily: 'inherit', fontWeight: 500,
};

const earnedText: React.CSSProperties = {
  fontSize: 28, fontWeight: 800,
  color: '#00D68F',
  textShadow: '0 0 20px rgba(0,214,143,0.7)',
  fontFamily: 'inherit',
};

const sparkCss = (s: Spark): React.CSSProperties => ({
  position: 'absolute',
  left: `${s.x}%`, top: `${s.y}%`,
  width: s.size, height: s.size,
  background: s.color,
  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
  animation: `fall ${s.dur}ms ease-in ${s.delay}ms forwards`,
  boxShadow: `0 0 ${s.size}px ${s.color}55`,
});
