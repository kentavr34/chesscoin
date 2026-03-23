/**
 * EventEffects.tsx — V2: Визуальные эффекты игровых событий
 *
 * Рендерится поверх игрового поля (pointer-events: none).
 * Бесплатные эффекты встроены. Премиум покупаются в магазине.
 *
 * Использование:
 *   <EventEffects event="checkmate" style="fireworks" active />
 */

import React, { useEffect, useState, useRef } from 'react';
import { sound } from '@/lib/sound';

export type GameEvent = 'checkmate' | 'check' | 'capture' | 'promotion' | null;

interface EventEffectsProps {
  event: GameEvent;
  captureSquare?: string; // e.g. "e4" — для эффекта на конкретной клетке
  winAnimStyle?: string;  // название купленной WIN_ANIMATION
  captureStyle?: string;  // название купленной CAPTURE_EFFECT
  onDone?: () => void;
}

export const EventEffects: React.FC<EventEffectsProps> = ({
  event, captureSquare, winAnimStyle, captureStyle, onDone,
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [flash, setFlash] = useState(false);
  const [checkFlash, setCheckFlash] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!event) return;

    if (event === 'checkmate') {
      const style = winAnimStyle ?? 'confetti';
      setParticles(makeParticles(style));
      timerRef.current = setTimeout(() => { setParticles([]); onDone?.(); }, 3200);
    }

    if (event === 'check') {
      setCheckFlash(true);
      timerRef.current = setTimeout(() => setCheckFlash(false), 500);
    }

    if (event === 'capture') {
      setFlash(true);
      // Звук взятия теперь лучше в sound.capture() — уже вызывается из ChessBoard
      timerRef.current = setTimeout(() => { setFlash(false); onDone?.(); }, 700);
    }

    if (event === 'promotion') {
      setParticles(makeParticles('stars'));
      timerRef.current = setTimeout(() => { setParticles([]); onDone?.(); }, 1500);
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [event, winAnimStyle]);

  if (!event && particles.length === 0 && !flash && !checkFlash) return null;

  return (
    <div style={container}>
      {/* Шах — красная вспышка */}
      {checkFlash && <div style={checkFlashStyle} />}

      {/* Взятие — вспышка + расходящиеся кольца */}
      {flash && (
        <>
          <div style={captureFlashStyle} />
          <div style={captureRing1} />
          <div style={captureRing2} />
          <div style={captureStar} />
        </>
      )}

      {/* Частицы (победа / промоция) */}
      {particles.map((p) => (
        <div key={p.id} style={particleStyle(p)} />
      ))}

      {/* Победная надпись при мате */}
      {event === 'checkmate' && (
        <div style={mateBannerContainer}>
          <div style={mateBanner}>
            {winAnimStyle === 'lightning' ? '⚡' : winAnimStyle === 'explosion' ? '💥' : '👑'}
            <span style={mateText}>CHECKMATE!</span>
            {winAnimStyle === 'lightning' ? '⚡' : winAnimStyle === 'explosion' ? '💥' : '👑'}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Фабрика частиц ────────────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number; y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  shape: 'circle' | 'star' | 'square';
}

const CONFETTI_COLORS = [
  '#F5C842', '#FF4D6A', '#9B85FF', '#00D68F', '#FF9F43',
  '#64C8FF', '#FF6B9D', '#00FF9D', '#FFD700', '#E040FB',
];

const STAR_COLORS = ['#F5C842', '#FFD700', '#FFF8DC', '#FFFACD'];

function makeParticles(style: string): Particle[] {
  const count = style === 'stars' ? 20 : 60;
  const colors = style === 'stars' ? STAR_COLORS : CONFETTI_COLORS;
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -5 - Math.random() * 20,
    size: style === 'stars' ? 8 + Math.random() * 12 : 6 + Math.random() * 10,
    color: colors[Math.floor(Math.random() * colors.length)]!,
    duration: 1500 + Math.random() * 1500,
    delay: Math.random() * 800,
    shape: style === 'stars' ? 'star' : Math.random() > 0.5 ? 'circle' : 'square',
  }));
}

// ── Стили ─────────────────────────────────────────────────────────────────────

const container: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
  zIndex: 100,
  borderRadius: 'inherit',
};

const checkFlashStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(255,50,50,0.35)',
  animation: 'checkFlash 0.5s ease-out',
  borderRadius: 'inherit',
};

const captureRing1: React.CSSProperties = {
  position: 'absolute',
  top: '50%', left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 60, height: 60,
  borderRadius: '50%',
  border: '3px solid rgba(255,150,0,0.7)',
  animation: 'ringExpand 0.6s ease-out forwards',
};

const captureRing2: React.CSSProperties = {
  position: 'absolute',
  top: '50%', left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 30, height: 30,
  borderRadius: '50%',
  border: '2px solid rgba(255,200,50,0.9)',
  animation: 'ringExpand 0.45s ease-out 0.08s forwards',
};

const captureStar: React.CSSProperties = {
  position: 'absolute',
  top: '50%', left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 16, height: 16,
  background: 'rgba(255,220,80,0.95)',
  borderRadius: '2px',
  animation: 'starBurst 0.5s ease-out forwards',
  boxShadow: '0 0 20px rgba(255,200,50,0.8)',
};

const captureFlashStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(255,150,0,0.15)',
  animation: 'captureFlash 0.6s ease-out',
  borderRadius: 'inherit',
};

const mateBannerContainer: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const mateBanner: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  background: 'rgba(0,0,0,0.85)',
  border: '2px solid var(--accent, #F5C842)',
  borderRadius: 20,
  padding: '16px 28px',
  boxShadow: '0 0 40px rgba(245,200,66,0.5)',
  animation: 'mateBannerIn 0.4s cubic-bezier(.34,1.56,.64,1)',
  fontSize: 28,
};

const mateText: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: '#F5C842',
  letterSpacing: '0.1em',
  fontFamily: 'inherit',
  textShadow: '0 0 20px rgba(245,200,66,0.8)',
};

const particleStyle = (p: Particle): React.CSSProperties => ({
  position: 'absolute',
  left: `${p.x}%`,
  top: `${p.y}%`,
  width: p.size,
  height: p.size,
  background: p.color,
  borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'star' ? '2px' : '3px',
  transform: p.shape === 'star' ? 'rotate(45deg)' : undefined,
  animation: `fall ${p.duration}ms ease-in ${p.delay}ms forwards`,
  opacity: 1,
});
