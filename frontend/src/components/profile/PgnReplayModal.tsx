import React, { useState, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

export const PgnReplayModal: React.FC<{ pgn: string; title?: string; sessionId?: string; onClose: () => void }> = ({ pgn, title, onClose }) => {
  const [moves, setMoves] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [fens, setFens] = useState<string[]>([]);
  // Размер доски через ResizeObserver — без window.innerWidth (нарушение CLAUDE.md #3)
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const [boardW, setBoardW] = useState(360);
  useEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.min(Math.floor(entry.contentRect.width), 400);
        if (w > 0) setBoardW(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    try {
      const chess = new Chess();
      chess.loadPgn(pgn);
      const history = chess.history();
      const fenList: string[] = ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'];
      const c2 = new Chess();
      for (const m of history) { c2.move(m); fenList.push(c2.fen()); }
      setMoves(history);
      setFens(fenList);
      setStep(fenList.length - 1);
    } catch {}
  }, [pgn]);

  const currentFen = fens[step] ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const totalMoves = fens.length - 1;
  const currentMove = step > 0 ? moves[step - 1] : null;

  const ctrlBtn: React.CSSProperties = {
    flex: 1, padding: '11px 0',
    background: 'rgba(212,168,67,.08)',
    border: '.5px solid rgba(212,168,67,.2)',
    borderRadius: 12, color: '#D4A843',
    fontSize: 17, cursor: 'pointer', fontFamily: 'inherit',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(4,3,8,.88)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{`@keyframes pgn-up{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={{
        width: '100%', maxWidth: 440,
        background: 'linear-gradient(170deg,#100C18,#0A080E)',
        border: '.5px solid rgba(212,168,67,.18)',
        borderRadius: '24px 24px 0 0',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        boxShadow: '0 -16px 48px rgba(0,0,0,.7)',
        maxHeight: '92vh', overflowY: 'auto',
        animation: 'pgn-up .3s cubic-bezier(.2,.9,.3,1.05) both',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(212,168,67,.2)' }} />
        </div>

        {/* Шапка */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M9 2v3M7.5 3.5h3" stroke="#D4A843" strokeWidth="1.3" strokeLinecap="round"/>
              <rect x="7" y="5" width="4" height="2" rx=".5" fill="#D4A843" opacity=".8"/>
              <path d="M5.5 7h7l-1 8H6.5L5.5 7z" fill="#D4A843" opacity=".7"/>
              <path d="M4 15h10" stroke="#D4A843" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '.9rem', fontWeight: 800, color: '#F0E8CC' }}>
              {title ?? 'Партия'}
            </span>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(255,255,255,.05)', border: '.5px solid rgba(255,255,255,.09)',
            color: '#6A7090', fontSize: '.75rem', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Доска — центрирована, ширина через ResizeObserver (без window.innerWidth) */}
        <div ref={boardWrapRef} style={{ display: 'flex', justifyContent: 'center', padding: '0 16px 10px', width: '100%', boxSizing: 'border-box' }}>
          <Chessboard position={currentFen} arePiecesDraggable={false} boardWidth={boardW} />
        </div>

        {/* Счётчик хода + текущий ход */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 16px 10px' }}>
          <span style={{ fontSize: '.7rem', color: '#5A5650', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
            Ход {step} / {totalMoves}
          </span>
          {currentMove && (
            <span style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '.78rem', color: '#F0C85A', fontWeight: 700,
              background: 'rgba(212,168,67,.1)', border: '.5px solid rgba(212,168,67,.28)',
              borderRadius: 6, padding: '2px 9px',
            }}>
              {currentMove}
            </span>
          )}
        </div>

        {/* Кнопки управления */}
        <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px' }}>
          <button onClick={() => setStep(0)} style={ctrlBtn}>⏮</button>
          <button onClick={() => setStep(s => Math.max(0, s - 1))} style={ctrlBtn}>◀</button>
          <button onClick={() => setStep(s => Math.min(totalMoves, s + 1))} style={ctrlBtn}>▶</button>
          <button onClick={() => setStep(totalMoves)} style={ctrlBtn}>⏭</button>
        </div>

        {/* Список ходов */}
        {moves.length > 0 && (
          <div style={{ padding: '0 16px 4px', maxHeight: 88, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {moves.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i + 1)}
                  style={{
                    padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '.67rem', fontWeight: 700,
                    background: step === i + 1 ? 'rgba(212,168,67,.18)' : 'rgba(255,255,255,.04)',
                    border: step === i + 1 ? '.5px solid rgba(212,168,67,.45)' : '.5px solid rgba(255,255,255,.07)',
                    color: step === i + 1 ? '#F0C85A' : '#5A5650',
                  }}
                >
                  {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ''}{m}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── BadgeDetailModal ─────────────────────────────────────────────────────────
