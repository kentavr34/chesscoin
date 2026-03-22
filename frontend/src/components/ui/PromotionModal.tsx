/**
 * PromotionModal.tsx — V1: Диалог выбора фигуры при промоции пешки
 *
 * При появлении: фейерверки + торжественный звук (пешка дошла!)
 * После выбора: аккорд "да!" + звёздная анимация
 */

import React, { useEffect, useState } from 'react';
import { useEquippedPieceSet, useEquippedPieceFilter } from '@/lib/equippedItems';
import { sound } from '@/lib/sound';
import { haptic } from '@/lib/haptic';

interface PromotionModalProps {
  color: 'white' | 'black';
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void;
}

const PIECES: Array<{ code: 'q' | 'r' | 'b' | 'n'; label: string; emoji: { white: string; black: string } }> = [
  { code: 'q', label: 'Queen',  emoji: { white: '♕', black: '♛' } },
  { code: 'r', label: 'Rook',   emoji: { white: '♖', black: '♜' } },
  { code: 'b', label: 'Bishop', emoji: { white: '♗', black: '♝' } },
  { code: 'n', label: 'Knight', emoji: { white: '♘', black: '♞' } },
];

const PIECE_FILE: Record<string, Record<string, string>> = {
  white: { q: 'white-queen', r: 'white-rook', b: 'white-bishop', n: 'white-knight' },
  black: { q: 'black-queen', r: 'black-rook', b: 'black-bishop', n: 'black-knight' },
};

// Генератор частиц фейерверка
interface Spark { id: number; x: number; y: number; color: string; size: number; duration: number; delay: number }
const COLORS = ['#F5C842','#FF4D6A','#9B85FF','#00D68F','#FF9F43','#64C8FF','#FFD700','#E040FB','#00FF9D'];

function makeSparks(count = 55): Spark[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -8 - Math.random() * 15,
    color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
    size: 5 + Math.random() * 10,
    duration: 1200 + Math.random() * 1400,
    delay: Math.random() * 600,
  }));
}

export const PromotionModal: React.FC<PromotionModalProps> = ({ color, onSelect }) => {
  const { path: setPath, isEmoji } = useEquippedPieceSet();
  const pieceFilter = useEquippedPieceFilter();
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [postSparks, setPostSparks] = useState<Spark[]>([]);

  // При появлении — фейерверк + торжественный звук
  useEffect(() => {
    sound.promote();
    haptic.impact('heavy');
    setSparks(makeSparks(55));
    const t = setTimeout(() => setSparks([]), 2200);
    return () => clearTimeout(t);
  }, []);

  const getPieceUrl = (code: string) => {
    const fileName = PIECE_FILE[color]?.[code] ?? '';
    try {
      return new URL(`../../assets/${setPath}/${fileName}.svg`, import.meta.url).href;
    } catch {
      return new URL(`../../assets/pieces/${fileName}.svg`, import.meta.url).href;
    }
  };

  const handleSelect = (piece: 'q' | 'r' | 'b' | 'n') => {
    if (confirmed) return;
    setConfirmed(piece);

    // Торжественный звук "да!" + вибрация
    sound.promotionConfirmed();
    haptic.impact('heavy');
    setTimeout(() => haptic.impact('medium'), 250);
    setTimeout(() => haptic.impact('light'), 450);

    // Вторая волна звёзд — победный взрыв
    setPostSparks(makeSparks(80));

    // Передаём выбор через 600мс (дать насладиться анимацией)
    setTimeout(() => {
      setSparks([]);
      setPostSparks([]);
      onSelect(piece);
    }, 700);
  };

  return (
    <div style={overlay}>
      {/* Частицы фейерверка — первая волна */}
      <div style={particlesContainer}>
        {sparks.map(s => <div key={s.id} style={sparkStyle(s)} />)}
        {postSparks.map(s => <div key={`p${s.id}`} style={sparkStyle(s, true)} />)}
      </div>

      <div style={modal}>
        {/* Заголовок */}
        <div style={crownRow}>
          <span style={crownEmoji}>♟</span>
          <div style={titleCol}>
            <div style={titleStyle}>Pawn promoted!</div>
            <div style={subtitleStyle}>Choose a piece</div>
          </div>
          <span style={crownEmoji}>👑</span>
        </div>

        {/* Фигуры */}
        <div style={grid}>
          {PIECES.map(({ code, label, emoji }) => {
            const isChosen = confirmed === code;
            return (
              <button
                key={code}
                style={{
                  ...btn,
                  ...(isChosen ? chosenBtn : {}),
                  transform: isChosen ? 'scale(1.15)' : undefined,
                }}
                onClick={() => handleSelect(code)}
                disabled={!!confirmed}
              >
                {isEmoji ? (
                  <span style={{ fontSize: 42, lineHeight: 1 }}>{emoji[color]}</span>
                ) : (
                  <img
                    src={getPieceUrl(code)}
                    alt={label}
                    style={{ width: 54, height: 54, filter: pieceFilter }}
                    draggable={false}
                  />
                )}
                <span style={labelStyle}>{label}</span>
                {isChosen && <span style={checkMark}>✓</span>}
              </button>
            );
          })}
        </div>

        {confirmed && (
          <div style={confirmMsg}>
            🎉 Great choice!
          </div>
        )}
      </div>
    </div>
  );
};

// ── Стили ─────────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.8)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999,
  backdropFilter: 'blur(8px)',
};

const particlesContainer: React.CSSProperties = {
  position: 'fixed', inset: 0,
  pointerEvents: 'none', overflow: 'hidden', zIndex: 9998,
};

const modal: React.CSSProperties = {
  background: 'var(--bg-card, #1C2030)',
  border: '2px solid var(--accent, #F5C842)',
  borderRadius: 28,
  padding: '24px 20px 20px',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
  boxShadow: '0 0 60px rgba(245,200,66,0.35), 0 12px 40px rgba(0,0,0,0.7)',
  animation: 'promotionIn 0.3s cubic-bezier(.34,1.56,.64,1)',
  minWidth: 290, position: 'relative', zIndex: 9999,
};

const crownRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
};

const crownEmoji: React.CSSProperties = {
  fontSize: 28, animation: 'pulse 1.5s ease-in-out infinite',
};

const titleCol: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
};

const titleStyle: React.CSSProperties = {
  fontSize: 20, fontWeight: 800,
  color: 'var(--accent, #F5C842)',
  letterSpacing: '0.04em', fontFamily: 'inherit',
  textShadow: '0 0 16px rgba(245,200,66,0.6)',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 12, color: 'var(--text-secondary, #8B92A8)',
  fontFamily: 'inherit',
};

const grid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, width: '100%',
};

const btn: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
  padding: '12px 8px',
  background: 'var(--bg-input, #232840)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 16, cursor: 'pointer',
  transition: 'transform 0.15s, background 0.15s, border-color 0.15s',
  fontFamily: 'inherit', position: 'relative',
};

const chosenBtn: React.CSSProperties = {
  background: 'rgba(245,200,66,0.15)',
  border: '2px solid var(--accent, #F5C842)',
  boxShadow: '0 0 20px rgba(245,200,66,0.4)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10, color: 'var(--text-secondary, #8B92A8)',
  fontWeight: 700, letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

const checkMark: React.CSSProperties = {
  position: 'absolute', top: -8, right: -8,
  background: 'var(--accent, #F5C842)', color: '#0B0D11',
  borderRadius: '50%', width: 20, height: 20,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 11, fontWeight: 900,
};

const confirmMsg: React.CSSProperties = {
  fontSize: 14, color: 'var(--accent, #F5C842)',
  fontWeight: 700, animation: 'fade-in 0.3s ease',
  fontFamily: 'inherit',
};

const sparkStyle = (s: Spark, burst = false): React.CSSProperties => ({
  position: 'absolute',
  left: `${s.x}%`,
  top: burst ? `${20 + Math.random() * 60}%` : `${s.y}%`,
  width: s.size, height: s.size,
  background: s.color,
  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
  transform: `rotate(${Math.random() * 360}deg)`,
  animation: burst
    ? `fall ${s.duration * 0.6}ms ease-in ${s.delay * 0.3}ms forwards`
    : `fall ${s.duration}ms ease-in ${s.delay}ms forwards`,
  boxShadow: `0 0 ${s.size}px ${s.color}`,
});
