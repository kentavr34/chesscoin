// Проверка уроков блока «Первые маты».
//
// Здесь мало проверить, что ходы играются: последний ход ОБЯЗАН быть матом.
// Именно на этом сгорели задачи — стояла тема «мат в 1», а мата не было.
import { Chess } from 'chess.js';

export const LESSONS = [
  { id: 11, key: 'rookmate',   fen: '7k/8/7K/8/8/8/8/R7 w - - 0 1',            moves: ['a1a8'] },
  { id: 12, key: 'ladder',     fen: '1R6/8/8/4K3/8/8/R7/7k w - - 0 1',         moves: ['b8b1'] },
  { id: 13, key: 'queenmate',  fen: '7k/Q7/6K1/8/8/8/8/8 w - - 0 1',           moves: ['a7g7'] },
  { id: 14, key: 'backrank',   fen: '6k1/5ppp/8/8/8/8/8/4R2K w - - 0 1',       moves: ['e1e8'] },
  { id: 15, key: 'scholar',    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'] },
  { id: 16, key: 'smothered',  fen: '6rk/6pp/8/6N1/8/8/8/7K w - - 0 1',        moves: ['g5f7'] },
  { id: 17, key: 'bishops',    fen: '7k/8/6K1/3B4/8/8/8/B7 w - - 0 1',         moves: ['a1b2'] },
  { id: 18, key: 'queenfile',  fen: '7k/8/6K1/8/8/8/8/3Q4 w - - 0 1',          moves: ['d1d8'] },
  { id: 19, key: 'epaulette',  fen: '3rkr2/8/Q7/8/8/8/8/4K3 w - - 0 1',        moves: ['a6e6'] },
  { id: 20, key: 'anastasia',  fen: '8/4N1pk/8/R7/8/8/8/7K w - - 0 1',        moves: ['a5h5'] },
];

let bad = 0;
for (const l of LESSONS) {
  const problems = [];
  let chess = null;
  try { chess = new Chess(l.fen); } catch (e) { problems.push('FEN: ' + e.message); }

  if (chess) {
    if (l.moves.length % 2 === 0) problems.push('сценарий кончается ходом соперника');
    for (let i = 0; i < l.moves.length; i++) {
      const uci = l.moves[i];
      let mv = null;
      try {
        mv = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || 'q' });
      } catch { mv = null; }
      if (!mv) { problems.push(`ход ${uci} (индекс ${i}) невозможен`); break; }
    }
    if (problems.length === 0 && !chess.isCheckmate()) {
      problems.push('последний ход НЕ мат');
    }
  }

  if (problems.length) { bad++; console.log(`✗ урок ${l.id} (${l.key}): ${problems.join('; ')}`); }
  else console.log(`✓ урок ${l.id} (${l.key}): мат подтверждён`);
}
console.log(bad === 0 ? 'MATES_OK' : `MATES_BROKEN=${bad}`);
