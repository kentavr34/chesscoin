// Premium Oak chess board. Renders a position and supports:
//   lastMove: { from, to }            — gold 3px inset border on both squares
//   dots: ['e4', 'd4']                — gold dots on empty squares
//   captures: ['d5']                  — gold ring on enemy pieces
//   checkSq: 'e1'                     — pulsing red ring on the king
const FILES = ['a','b','c','d','e','f','g','h'];
const PIECE_FILE = { K:'king', Q:'queen', R:'rook', B:'bishop', N:'knight', P:'pawn' };

function ChessBoard({ position = DEFAULT_POSITION, size = 320, lastMove, dots = [], captures = [], checkSq, flipped, arrows = [] }) {
  const sq = size / 8;
  const ranks = flipped ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1];
  const files = flipped ? [...FILES].reverse() : FILES;
  const sqCenter = (id) => {
    const f = id.charCodeAt(0) - 97;
    const r = parseInt(id[1], 10);
    const fi = flipped ? 7 - f : f;
    const ri = flipped ? r - 1 : 8 - r;
    return { x: fi * sq + sq / 2, y: ri * sq + sq / 2 };
  };
  return (
    <div style={{
      width: size, height: size,
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 14px 40px rgba(0,0,0,.55),0 0 0 1px rgba(212,168,67,.25),inset 0 0 0 3px #4a2e0e',
      position: 'relative',
    }}>
      {ranks.map((rank, ri) => (
        <div key={rank} style={{ display: 'flex', height: sq }}>
          {files.map((f, fi) => {
            const isLight = (ri + fi) % 2 === 0;
            const id = `${f}${rank}`;
            const p = position[id];
            const isLast = lastMove && (lastMove.from === id || lastMove.to === id);
            const hasDot = dots.includes(id);
            const isCapture = captures.includes(id);
            const isCheck = checkSq === id;
            return (
              <div key={id} style={{
                width: sq, height: sq,
                background: isLight ? '#DEB887' : '#8B4513',
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isLast && (
                  <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 3px #D4A843', pointerEvents: 'none' }} />
                )}
                {isCapture && (
                  <div style={{ position: 'absolute', inset: 3, boxShadow: 'inset 0 0 0 2.5px #D4A843', borderRadius: 4, pointerEvents: 'none' }} />
                )}
                {isCheck && (
                  <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 3px #EF4444', animation: 'ccCheckPulse 1.1s ease-in-out infinite', pointerEvents: 'none' }} />
                )}
                {fi === 0 && (
                  <span style={{
                    position: 'absolute', left: 2, top: 1,
                    fontSize: Math.max(8, sq * 0.14), fontWeight: 700,
                    color: isLight ? '#8B4513' : '#DEB887', opacity: .55,
                  }}>{rank}</span>
                )}
                {ri === 7 && (
                  <span style={{
                    position: 'absolute', right: 3, bottom: 0,
                    fontSize: Math.max(8, sq * 0.14), fontWeight: 700,
                    color: isLight ? '#8B4513' : '#DEB887', opacity: .55,
                  }}>{f}</span>
                )}
                {p && (
                  <img src={`../../assets/pieces/${p.color}-${PIECE_FILE[p.piece]}.svg`}
                       width={sq * 0.92} height={sq * 0.92}
                       draggable={false}
                       style={{ pointerEvents: 'none', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.35))', position: 'relative' }} alt="" />
                )}
                {hasDot && !p && (
                  <div style={{
                    width: sq * 0.22, height: sq * 0.22, borderRadius: '50%',
                    background: '#D4A843', boxShadow: '0 0 8px rgba(212,168,67,.6)',
                    position: 'relative',
                  }} />
                )}
              </div>
            );
          })}
        </div>
      ))}
      {arrows.length > 0 && (
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}
             style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <defs>
            <marker id="ccArrowBlue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 Z" fill="#6FA8DC" />
            </marker>
            <marker id="ccArrowGreen" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 Z" fill="#3DBA7A" />
            </marker>
          </defs>
          {arrows.map((a, i) => {
            const s = sqCenter(a.from), e = sqCenter(a.to);
            const color = a.color === 'green' ? '#3DBA7A' : '#6FA8DC';
            const marker = a.color === 'green' ? 'url(#ccArrowGreen)' : 'url(#ccArrowBlue)';
            return (
              <line key={i} x1={s.x} y1={s.y} x2={e.x} y2={e.y}
                    stroke={color} strokeWidth={sq * 0.14} strokeLinecap="round"
                    opacity=".82" markerEnd={marker} />
            );
          })}
        </svg>
      )}
    </div>
  );
}

// Endgame mate — classic smothered-mate-like setup
const MATE_POSITION = (() => {
  const p = {};
  p.g8 = { piece: 'K', color: 'black' };
  p.h8 = { piece: 'R', color: 'black' };
  p.h7 = { piece: 'P', color: 'black' };
  p.g7 = { piece: 'P', color: 'black' };
  p.f7 = { piece: 'N', color: 'white' };
  p.c4 = { piece: 'Q', color: 'white' };
  p.g1 = { piece: 'K', color: 'white' };
  p.f2 = { piece: 'P', color: 'white' };
  p.g2 = { piece: 'P', color: 'white' };
  p.h2 = { piece: 'P', color: 'white' };
  return p;
})();

const DEFAULT_POSITION = (() => {
  const p = {};
  const back = ['R','N','B','Q','K','B','N','R'];
  FILES.forEach((f, i) => {
    p[`${f}1`] = { piece: back[i], color: 'white' };
    p[`${f}2`] = { piece: 'P',     color: 'white' };
    p[`${f}7`] = { piece: 'P',     color: 'black' };
    p[`${f}8`] = { piece: back[i], color: 'black' };
  });
  return p;
})();

const SAMPLE_POSITION = (() => {
  const p = { ...DEFAULT_POSITION };
  delete p.e2; p.e4 = { piece: 'P', color: 'white' };
  delete p.e7; p.e5 = { piece: 'P', color: 'black' };
  delete p.g1; p.f3 = { piece: 'N', color: 'white' };
  delete p.b8; p.c6 = { piece: 'N', color: 'black' };
  delete p.f1; p.b5 = { piece: 'B', color: 'white' };
  return p;
})();

// Position with check — black queen on h4, white king exposed on e1
const CHECK_POSITION = (() => {
  const p = { ...DEFAULT_POSITION };
  delete p.e2; p.e4 = { piece: 'P', color: 'white' };
  delete p.f2; p.f3 = { piece: 'P', color: 'white' };
  delete p.g2; p.g4 = { piece: 'P', color: 'white' };
  delete p.e7; p.e5 = { piece: 'P', color: 'black' };
  delete p.d8; p.h4 = { piece: 'Q', color: 'black' };
  return p;
})();

Object.assign(window, { ChessBoard, DEFAULT_POSITION, SAMPLE_POSITION, CHECK_POSITION, MATE_POSITION });
