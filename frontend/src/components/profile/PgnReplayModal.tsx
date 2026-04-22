import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import type { UserPublic } from '@/types';

interface PgnReplayModalProps {
  pgn: string;
  title?: string;
  sessionId?: string;
  // Игроки — для шапки с кликабельными аватарами (клик → профиль)
  whitePlayer?: UserPublic | null;
  blackPlayer?: UserPublic | null;
  onClose: () => void;
}

export const PgnReplayModal: React.FC<PgnReplayModalProps> = ({ pgn, title, whitePlayer, blackPlayer, onClose }) => {
  const navigate = useNavigate();
  const [moves, setMoves] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [fens, setFens] = useState<string[]>([]);

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
  // Chessboard требует числовой boardWidth — используем ResizeObserver на контейнере.
  // window.innerWidth нарочно не трогаем (правило 4): размер берём из реального wrapper-а.
  const boardWrapRef = React.useRef<HTMLDivElement | null>(null);
  const [boardW, setBoardW] = useState(320);
  useEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setBoardW(Math.min(w, 380));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const totalMoves = fens.length - 1;
  const currentMove = step > 0 ? moves[step - 1] : null;

  // Крупная навигация — tap target >= 44px, читаемый размер иконки
  const ctrlBtn: React.CSSProperties = {
    flex: 1, height: 48,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, rgba(212,168,67,.14), rgba(212,168,67,.06))',
    border: '.5px solid rgba(212,168,67,.32)',
    borderRadius: 14, color: '#F0C85A',
    fontSize: 22, lineHeight: 1, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background .12s, transform .08s',
    letterSpacing: 0,
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(4,3,8,.88)',
        backdropFilter: 'blur(12px)',
        /* Центрируем модалку в окне, не «bottom-sheet» */
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{`@keyframes pgn-in{from{transform:scale(.96) translateY(8px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}`}</style>
      <div style={{
        width: '100%', maxWidth: 440,
        background: 'linear-gradient(170deg,#100C18,#0A080E)',
        border: '.5px solid rgba(212,168,67,.22)',
        borderRadius: 22,
        boxShadow: '0 18px 56px rgba(0,0,0,.75), 0 0 0 1px rgba(212,168,67,.06) inset',
        maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto',
        animation: 'pgn-in .24s cubic-bezier(.2,.9,.3,1.05) both',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Шапка */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 10px',
          borderBottom: '.5px solid rgba(212,168,67,.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
              <path d="M9 2v3M7.5 3.5h3" stroke="#D4A843" strokeWidth="1.3" strokeLinecap="round"/>
              <rect x="7" y="5" width="4" height="2" rx=".5" fill="#D4A843" opacity=".8"/>
              <path d="M5.5 7h7l-1 8H6.5L5.5 7z" fill="#D4A843" opacity=".7"/>
              <path d="M4 15h10" stroke="#D4A843" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span style={{
              fontFamily: 'Inter, sans-serif', fontSize: '.95rem', fontWeight: 800, color: '#F0E8CC',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {title ?? 'Партия'}
            </span>
          </div>
          <button onClick={onClose} aria-label="Закрыть" style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'rgba(255,255,255,.05)', border: '.5px solid rgba(255,255,255,.1)',
            color: '#B8B0A4', fontSize: '.9rem', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>✕</button>
        </div>

        {/* Шапка с игроками — кликабельные аватары ведут на страницу профиля */}
        {(whitePlayer || blackPlayer) && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, padding: '12px 16px 10px',
            borderBottom: '.5px solid rgba(212,168,67,.08)',
          }}>
            <PlayerChip player={whitePlayer} isWhite onClick={(id) => { onClose(); navigate('/profile/' + id); }} />
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '.66rem', fontWeight: 800, color: '#8A8580',
              letterSpacing: '.14em',
              padding: '3px 9px',
              borderRadius: 8,
              background: 'rgba(212,168,67,.08)',
              border: '.5px solid rgba(212,168,67,.18)',
              flexShrink: 0,
            }}>VS</div>
            <PlayerChip player={blackPlayer} isWhite={false} align="right" onClick={(id) => { onClose(); navigate('/profile/' + id); }} />
          </div>
        )}

        {/* Доска — центр, крупно. Ширину измеряет ResizeObserver у внутреннего wrapper-а (без горизонтального паддинга). */}
        <div style={{ padding: '14px 16px 12px' }}>
          <div ref={boardWrapRef} style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <Chessboard position={currentFen} arePiecesDraggable={false} boardWidth={boardW} />
          </div>
        </div>

        {/* Счётчик хода + текущий ход — крупно и читаемо */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '0 16px 12px' }}>
          <span style={{ fontSize: '.78rem', color: '#8A8580', fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '.02em' }}>
            Ход <span style={{ color: '#E8E0D0' }}>{step}</span> / {totalMoves}
          </span>
          {currentMove && (
            <span style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '.88rem', color: '#F0C85A', fontWeight: 800,
              background: 'rgba(212,168,67,.14)', border: '.5px solid rgba(212,168,67,.32)',
              borderRadius: 8, padding: '4px 12px',
            }}>
              {currentMove}
            </span>
          )}
        </div>

        {/* Кнопки управления — крупные, без жадничанья */}
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px' }}>
          <button onClick={() => setStep(0)}                                    style={ctrlBtn} aria-label="В начало">⏮</button>
          <button onClick={() => setStep(s => Math.max(0, s - 1))}              style={ctrlBtn} aria-label="Назад на ход">◀</button>
          <button onClick={() => setStep(s => Math.min(totalMoves, s + 1))}     style={ctrlBtn} aria-label="Вперёд на ход">▶</button>
          <button onClick={() => setStep(totalMoves)}                           style={ctrlBtn} aria-label="В конец">⏭</button>
        </div>

        {/* Список ходов — ощутимые тап-таргеты, больше воздуха */}
        {moves.length > 0 && (
          <div style={{
            padding: '10px 16px 16px',
            borderTop: '.5px solid rgba(212,168,67,.08)',
            maxHeight: 140,
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {moves.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i + 1)}
                  style={{
                    padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '.74rem', fontWeight: 700,
                    background: step === i + 1 ? 'rgba(212,168,67,.22)' : 'rgba(255,255,255,.04)',
                    border: step === i + 1 ? '.5px solid rgba(212,168,67,.5)' : '.5px solid rgba(255,255,255,.08)',
                    color: step === i + 1 ? '#F0C85A' : '#8A8580',
                    minHeight: 30,
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

// ── PlayerChip — аватар + имя + ELO + ♔/♚, клик → профиль ───────────────────
const PlayerChip: React.FC<{
  player?: UserPublic | null;
  isWhite: boolean;
  align?: 'left' | 'right';
  onClick: (userId: string) => void;
}> = ({ player, isWhite, align = 'left', onClick }) => {
  const clickable = !!player?.id;
  const symbol = isWhite ? '♔' : '♚';
  const symbolColor = isWhite ? '#F0F2F8' : '#8B92A8';

  const inner = (
    <>
      {align === 'left' && (
        <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', overflow: 'hidden' }}>
          {player ? <Avatar user={player} size="s" /> : <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(154,148,144,.08)',
            border: '.5px solid rgba(154,148,144,.18)',
          }} />}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: '.78rem', fontWeight: 800, color: '#F0E8CC',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: 110,
          fontFamily: 'Inter, sans-serif',
        }}>
          {align === 'left' && <span style={{ fontSize: 14, color: symbolColor, opacity: .9, lineHeight: 1 }}>{symbol}</span>}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {player?.firstName ?? '—'}
          </span>
          {align === 'right' && <span style={{ fontSize: 14, color: symbolColor, opacity: .9, lineHeight: 1 }}>{symbol}</span>}
        </div>
        {player?.elo != null && (
          <span style={{
            fontSize: '.6rem', fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
            color: '#7A7470', marginTop: 2,
          }}>
            ELO <span style={{ color: '#F0C85A' }}>{player.elo}</span>
          </span>
        )}
      </div>
      {align === 'right' && (
        <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', overflow: 'hidden' }}>
          {player ? <Avatar user={player} size="s" /> : <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(154,148,144,.08)',
            border: '.5px solid rgba(154,148,144,.18)',
          }} />}
        </div>
      )}
    </>
  );

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={(e) => { e.stopPropagation(); if (player?.id) onClick(player.id); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        flex: 1, minWidth: 0,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        padding: '4px 6px',
        background: 'none', border: 'none',
        borderRadius: 10,
        cursor: clickable ? 'pointer' : 'default',
        fontFamily: 'inherit',
        transition: 'background .15s',
      }}
      onMouseEnter={(e) => { if (clickable) (e.currentTarget.style.background = 'rgba(212,168,67,.08)'); }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      aria-label={player ? `Профиль ${player.firstName}` : 'Игрок'}
    >
      {inner}
    </button>
  );
};

// ── BadgeDetailModal ─────────────────────────────────────────────────────────
