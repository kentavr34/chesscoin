import React, { useState, useEffect } from 'react';
import { useT } from '@/i18n/useT';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

export const PgnReplayModal: React.FC<{ pgn: string; title?: string; sessionId?: string; onClose: () => void }> = ({ pgn, title, sessionId, onClose }) => {
  const [moves, setMoves] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [step, setStep] = useState(0);
  const [fens, setFens] = useState<string[]>([]);

  useEffect(() => {
    try {
      const chess = new Chess();
      chess.loadPgn(pgn);
      const history = chess.history();
      const fenList: string[] = ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'];
      const c2 = new Chess();
      for (const m of history) {
        c2.move(m);
        fenList.push(c2.fen());
      }
      setMoves(history);
      setFens(fenList);
      setStep(fenList.length - 1);
    } catch {}
  }, [pgn]);

  const currentFen = fens[step] ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--pgn-replay-overlay-bg, rgba(0,0,0,0.85))', backdropFilter: 'blur(8px)', zIndex: "var(--z-modal, 300)", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--color-bg-card, #13161E)', borderRadius: 24, padding: 20, width: '100%', maxWidth: 420, border: '1px solid var(--pgn-replay-modal-border, rgba(255,255,255,0.1))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-accent, #F5C842)' }}>♟ {title ?? 'Game replay'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary, #8B92A8)', fontSize: 16, cursor: 'pointer', padding: 0 }}>✕</button>
        </div>

        <Chessboard position={currentFen} arePiecesDraggable={false} boardWidth={Math.min(380, window.innerWidth - 72)} />

        {/* Move counter */}
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: 'var(--color-text-secondary, #8B92A8)' }}>
          Move {step} / {fens.length - 1}
          {step > 0 && moves[step - 1] && <span style={{ color: 'var(--color-accent, #F5C842)', marginLeft: 6 }}>{moves[step - 1]}</span>}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {[
            { label: '⏮', action: () => setStep(0) },
            { label: '◀', action: () => setStep(s => Math.max(0, s - 1)) },
            { label: '▶', action: () => setStep(s => Math.min(fens.length - 1, s + 1)) },
            { label: '⏭', action: () => setStep(fens.length - 1) },
          ].map(({ label, action }) => (
            <button key={label} onClick={action} style={{ flex: 1, padding: '10px 0', background: 'var(--color-bg-input, #232840)', border: 'none', borderRadius: 10, color: 'var(--color-text-primary, #F0F2F8)', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
              {label}
            </button>
          ))}
        </div>
        {/* Кнопка сохранить партию */}
        {sessionId && (
          <button
            onClick={async () => {
              if (saved) return;
              try {
                await (await import('@/api')).warsApi.saveGame(sessionId);
                setSaved(true);
              } catch {}
            }}
            style={{ width: '100%', marginTop: 8, padding: '9px', background: saved ? 'var(--pgn-replay-save-saved-bg, rgba(0,214,143,0.1))' : 'var(--pgn-replay-save-unsaved-bg, rgba(155,133,255,0.1))', border: `1px solid ${saved ? 'var(--pgn-replay-save-saved-border, rgba(0,214,143,0.2))' : 'var(--pgn-replay-save-unsaved-border, rgba(155,133,255,0.2))'}`, borderRadius: 10, color: saved ? 'var(--color-green, #00D68F)' : 'var(--color-purple, #9B85FF)', fontSize: 12, fontWeight: 600, cursor: saved ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >
            {saved ? '✓ Saved' : '💾 Save game'}
          </button>
        )}

        {/* Move list */}
        <div style={{ marginTop: 12, maxHeight: 100, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {moves.map((m, i) => (
            <button key={i} onClick={() => setStep(i + 1)} style={{
              padding: '3px 7px', fontSize: 11, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: step === i + 1 ? 'var(--color-accent, #F5C842)' : 'var(--color-bg-card, #1C2030)',
              color: step === i + 1 ? 'var(--color-bg-dark, #0B0D11)' : 'var(--color-text-secondary, #8B92A8)',
            }}>
              {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ''}{m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── BadgeDetailModal ─────────────────────────────────────────────────────────
