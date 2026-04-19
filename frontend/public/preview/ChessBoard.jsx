// Premium Oak chess board. Simplified — renders a position from an array of
// { piece, color, sq } where sq is e.g. "e4".
const FILES = ['a','b','c','d','e','f','g','h'];
const PIECE_FILE = { K:'king', Q:'queen', R:'rook', B:'bishop', N:'knight', P:'pawn' };

function ChessBoard({ position = DEFAULT_POSITION, size = 320, lastMove, flipped }) {
  const sq = size / 8;
  const ranks = flipped ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1];
  const files = flipped ? [...FILES].reverse() : FILES;
  return (
    <div style={{
      width: size, height: size,
      borderRadius: 6, overflow: 'hidden',
      boxShadow: '0 10px 30px rgba(0,0,0,.55),0 0 0 1px rgba(212,168,67,.2),inset 0 0 0 3px #4a2e0e',
      position: 'relative',
    }}>
      {ranks.map((rank, ri) => (
        <div key={rank} style={{ display: 'flex', height: sq }}>
          {files.map((f, fi) => {
            const isLight = (ri + fi) % 2 === 0;
            const id = `${f}${rank}`;
            const p = position[id];
            const isLast = lastMove && (lastMove.from === id || lastMove.to === id);
            return (
              <div key={id} style={{
                width: sq, height: sq,
                background: isLight ? '#DEB887' : '#8B4513',
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isLast && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(212,168,67,.28)' }} />
                )}
                {fi === 0 && (
                  <span style={{
                    position: 'absolute', left: 2, top: 1,
                    fontSize: Math.max(8, sq * 0.14), fontWeight: 700,
                    color: isLight ? '#8B4513' : '#DEB887', opacity: .6,
                  }}>{rank}</span>
                )}
                {ri === 7 && (
                  <span style={{
                    position: 'absolute', right: 3, bottom: 0,
                    fontSize: Math.max(8, sq * 0.14), fontWeight: 700,
                    color: isLight ? '#8B4513' : '#DEB887', opacity: .6,
                  }}>{f}</span>
                )}
                {p && (
                  <img src={`../../assets/pieces/${p.color}-${PIECE_FILE[p.piece]}.svg`}
                       width={sq * 0.92} height={sq * 0.92}
                       draggable={false}
                       style={{ pointerEvents: 'none', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.35))', position: 'relative' }} alt="" />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

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

// Sample mid-game position for the Game screen
const SAMPLE_POSITION = (() => {
  const p = { ...DEFAULT_POSITION };
  delete p.e2; p.e4 = { piece: 'P', color: 'white' };
  delete p.e7; p.e5 = { piece: 'P', color: 'black' };
  delete p.g1; p.f3 = { piece: 'N', color: 'white' };
  delete p.b8; p.c6 = { piece: 'N', color: 'black' };
  delete p.f1; p.b5 = { piece: 'B', color: 'white' };
  return p;
})();

Object.assign(window, { ChessBoard, DEFAULT_POSITION, SAMPLE_POSITION });
