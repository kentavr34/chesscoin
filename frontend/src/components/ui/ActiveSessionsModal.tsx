import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameSession } from '@/types';

interface Props {
  sessions: GameSession[];
  onClose: () => void;
}

// ── Символы шахматных фигур ───────────────────────────────────────────────────
const PIECE_SYMBOLS: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};
const WHITE_PIECES = new Set('KQRBNP');

// ── Мини-доска из FEN ─────────────────────────────────────────────────────────
const MiniBoard: React.FC<{ fen: string; myIsWhite: boolean; size?: number }> = ({
  fen, myIsWhite, size = 80,
}) => {
  const cellSize = size / 8;
  const rows = fen.split(' ')[0].split('/');

  const cells: { piece: string | null; dark: boolean }[] = [];
  rows.forEach((row, ri) => {
    let ci = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        const n = parseInt(ch);
        for (let k = 0; k < n; k++) {
          cells.push({ piece: null, dark: (ri + ci + k) % 2 === 1 });
          ci++;
        }
      } else {
        cells.push({ piece: ch, dark: (ri + ci) % 2 === 1 });
        ci++;
      }
    }
  });

  const displayCells = myIsWhite ? cells : [...cells].reverse();

  return (
    <div style={{
      width: size, height: size,
      display: 'grid', gridTemplateColumns: `repeat(8, 1fr)`,
      borderRadius: 6, overflow: 'hidden',
      border: '.5px solid rgba(212,168,67,.3)',
      flexShrink: 0,
    }}>
      {displayCells.map((cell, i) => {
        const isWhitePiece = cell.piece ? WHITE_PIECES.has(cell.piece) : false;
        return (
          <div key={i} style={{
            width: cellSize, height: cellSize,
            background: cell.dark ? 'rgba(90,55,14,.9)' : 'rgba(210,170,80,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: cellSize * 0.72,
            lineHeight: 1,
            color: isWhitePiece ? '#F0E8D0' : '#1A1208',
            textShadow: isWhitePiece
              ? '0 .5px 1.5px rgba(0,0,0,.9)'
              : '0 .5px 1px rgba(255,255,200,.2)',
          }}>
            {cell.piece ? (PIECE_SYMBOLS[cell.piece] ?? '') : ''}
          </div>
        );
      })}
    </div>
  );
};

// ── Форматирование времени ────────────────────────────────────────────────────
const fmtTime = (secs: number): string => {
  if (secs <= 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// ── Компонент ─────────────────────────────────────────────────────────────────
export const ActiveSessionsModal: React.FC<Props> = ({ sessions, onClose }) => {
  const navigate = useNavigate();
  const items = sessions.slice(0, 3);

  const handleGo = (id: string) => {
    onClose();
    navigate(`/game/${id}`);
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 350,
        background: 'rgba(4,3,8,.84)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 max(20px, env(safe-area-inset-bottom, 20px))',
      }}
    >
      <style>{`
        @keyframes asm-slide { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        .asm-sheet { animation: asm-slide .22s cubic-bezier(.25,.8,.25,1) both; }
        @keyframes asm-blink { 0%,100%{opacity:1} 55%{opacity:.35} }
        .asm-card:active { opacity:.85; transform: scale(.985); }
      `}</style>

      <div className="asm-sheet" style={{
        width: '100%', maxWidth: 420,
        background: 'linear-gradient(170deg,#0E1008,#0A0C10)',
        border: '.5px solid rgba(212,168,67,.22)',
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -12px 40px rgba(0,0,0,.65), 0 -1px 0 rgba(212,168,67,.1)',
        padding: '0 0 8px',
      }}>

        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.1)' }} />
        </div>

        {/* Заголовок */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 18px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="7" height="7" rx="1" fill="rgba(212,168,67,.15)" stroke="#D4A843" strokeWidth="1.2"/>
              <rect x="11" y="2" width="7" height="7" rx="1" fill="#0A0C08" stroke="#D4A843" strokeWidth="1.2"/>
              <rect x="2" y="11" width="7" height="7" rx="1" fill="#0A0C08" stroke="#D4A843" strokeWidth="1.2"/>
              <rect x="11" y="11" width="7" height="7" rx="1" fill="rgba(212,168,67,.15)" stroke="#D4A843" strokeWidth="1.2"/>
              <circle cx="10" cy="10" r="2" fill="#D4A843" opacity=".8"/>
            </svg>
            <span style={{ fontSize: '1rem', fontWeight: 900, color: '#E8D8A0', letterSpacing: '.01em' }}>
              Активные партии
            </span>
            <div style={{
              background: 'rgba(212,168,67,.15)', border: '.5px solid rgba(212,168,67,.3)',
              borderRadius: 20, padding: '1px 8px',
              fontSize: '.6rem', fontWeight: 900, color: '#D4A843',
            }}>{items.length}</div>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(255,255,255,.06)', border: '.5px solid rgba(255,255,255,.1)',
            color: '#6A7090', fontSize: '.8rem', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* ── Карточки ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 14px 8px' }}>
          {items.map((s) => {
            const mySide   = s.sides?.find(sd => sd.isMe);
            const oppSide  = s.sides?.find(sd => !sd.isMe);
            const myIsWhite = mySide?.isWhite ?? true;
            const isMyTurn  = s.isMyTurn;
            const typeLabel = s.type === 'BOT' ? 'vs J.A.R.V.I.S' : s.type === 'BATTLE' ? 'Батл' : 'Дружеская';
            const oppName   = oppSide?.isBot ? 'J.A.R.V.I.S' : (oppSide?.player?.firstName ?? '???');
            const oppAvatar = oppSide?.player?.avatar;
            const myTimeLeft  = mySide?.timeLeft ?? 0;
            const oppTimeLeft = oppSide?.timeLeft ?? 0;
            const fen = s.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

            return (
              <div
                key={s.id}
                className="asm-card"
                onClick={() => handleGo(s.id)}
                style={{
                  background: isMyTurn
                    ? 'linear-gradient(135deg,#191A08,#1E1E0E)'
                    : 'linear-gradient(135deg,#0E100A,#111408)',
                  border: `.5px solid ${isMyTurn ? 'rgba(212,168,67,.4)' : 'rgba(212,168,67,.14)'}`,
                  borderRadius: 14, padding: '12px 14px',
                  cursor: 'pointer', position: 'relative', overflow: 'hidden',
                  transition: 'all .15s',
                }}
              >
                {/* Верхняя декор-линия */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 1.5,
                  background: isMyTurn
                    ? 'linear-gradient(90deg,transparent,rgba(212,168,67,.55),transparent)'
                    : 'linear-gradient(90deg,transparent,rgba(212,168,67,.14),transparent)',
                }} />

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>

                  {/* ── Мини-доска ── */}
                  <MiniBoard fen={fen} myIsWhite={myIsWhite} size={80} />

                  {/* ── Инфо ── */}
                  <div style={{ flex: 1, minWidth: 0 }}>

                    {/* Тип */}
                    <div style={{ fontSize: '.5rem', fontWeight: 700, color: '#6A6050', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 5 }}>
                      {typeLabel}
                    </div>

                    {/* Соперник */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: oppAvatar ? 'transparent' : 'rgba(212,168,67,.1)',
                        border: '.5px solid rgba(212,168,67,.2)',
                        overflow: 'hidden', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '.62rem', fontWeight: 800, color: '#D4A843',
                      }}>
                        {oppAvatar
                          ? <img src={oppAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : (oppName[0]?.toUpperCase() ?? '?')
                        }
                      </div>
                      <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#C8C0A8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {oppName}
                      </span>
                      {/* Цвет соперника */}
                      <div style={{
                        width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                        background: myIsWhite ? '#1A1208' : '#F0E8D0',
                        border: '.5px solid rgba(212,168,67,.3)',
                      }} title={myIsWhite ? 'Соперник — чёрные' : 'Соперник — белые'} />
                    </div>

                    {/* Таймеры */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {/* Мой таймер */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: isMyTurn ? 'rgba(212,168,67,.12)' : 'rgba(255,255,255,.04)',
                        border: `.5px solid ${isMyTurn ? 'rgba(212,168,67,.3)' : 'rgba(255,255,255,.07)'}`,
                        borderRadius: 6, padding: '3px 8px',
                      }}>
                        <div style={{
                          width: 7, height: 7, borderRadius: 2, flexShrink: 0,
                          background: myIsWhite ? '#E8E0C8' : '#1A1208',
                          border: '.5px solid rgba(212,168,67,.35)',
                        }} />
                        <span style={{
                          fontSize: '.64rem', fontWeight: 900,
                          color: isMyTurn ? '#F0C85A' : '#6A6050',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {fmtTime(myTimeLeft)}
                        </span>
                      </div>
                      {/* Таймер соперника */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: 'rgba(255,255,255,.04)',
                        border: '.5px solid rgba(255,255,255,.07)',
                        borderRadius: 6, padding: '3px 8px',
                      }}>
                        <div style={{
                          width: 7, height: 7, borderRadius: 2, flexShrink: 0,
                          background: myIsWhite ? '#1A1208' : '#E8E0C8',
                          border: '.5px solid rgba(212,168,67,.35)',
                        }} />
                        <span style={{ fontSize: '.64rem', fontWeight: 900, color: '#5A5448', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtTime(oppTimeLeft)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Правая часть ── */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {isMyTurn && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        background: 'rgba(61,186,122,.1)', border: '.5px solid rgba(61,186,122,.32)',
                        borderRadius: 7, padding: '4px 7px',
                        animation: 'asm-blink 1.6s ease-in-out infinite',
                      }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#3DBA7A', boxShadow: '0 0 5px #3DBA7A' }} />
                        <span style={{ fontSize: '.52rem', fontWeight: 900, color: '#6FEDB0', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>ВАШ ХОД</span>
                      </div>
                    )}
                    <span style={{ fontSize: '1rem', color: 'rgba(212,168,67,.35)' }}>›</span>
                  </div>

                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
