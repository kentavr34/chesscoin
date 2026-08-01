// Отбор уроков окончаний (блок 81–120). Правила те же, что и у приёмов:
// в линейку идёт только то, что прогнал движок, и ни одна позиция не должна
// повториться из уже заведённых уроков.
import { readFileSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';

const [SRC, USED, OUT] = process.argv.slice(2);

const BLOCKS = [
  { theme: 'pawnEndgame',   key: 'pawnend',  from: 81 },
  { theme: 'rookEndgame',   key: 'rookend',  from: 91 },
  { theme: 'bishopEndgame', key: 'bishend',  from: 101 },
  { theme: 'advancedPawn',  key: 'passer',   from: 111 },
];
const PER_BLOCK = 10;

const cands = JSON.parse(readFileSync(SRC, 'utf8'));
const usedFens = new Set(JSON.parse(readFileSync(USED, 'utf8')));

function valid(p) {
  if (!Array.isArray(p.moves) || p.moves.length % 2 !== 1) return false;
  let chess;
  try { chess = new Chess(p.fen); } catch { return false; }
  for (const uci of p.moves) {
    try {
      const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || 'q' });
      if (!m) return false;
    } catch { return false; }
  }
  return true;
}

const picked = [];
let rejected = 0, dup = 0;
for (const b of BLOCKS) {
  const pool = cands
    .filter(p => p.theme === b.theme)
    .sort((a, c) => a.rating - c.rating || (a.id < c.id ? -1 : 1));
  const good = [];
  for (const p of pool) {
    if (good.length >= PER_BLOCK) break;
    if (usedFens.has(p.fen)) { dup++; continue; }
    if (!valid(p)) { rejected++; continue; }
    usedFens.add(p.fen);
    good.push(p);
  }
  if (good.length < PER_BLOCK) console.log(`✗ ${b.theme}: годных ${good.length} из ${PER_BLOCK}`);
  else console.log(`✓ ${b.theme} → уроки ${b.from}–${b.from + good.length - 1}, рейтинг ${good[0].rating}–${good[good.length - 1].rating}`);
  good.forEach((p, i) => picked.push({
    id: b.from + i, block: b.key, puzzleId: p.id, rating: p.rating,
    fen: p.fen, moves: p.moves, ord: i + 1,
  }));
}

writeFileSync(OUT, JSON.stringify(picked, null, 1), 'utf8');
console.log(`отобрано ${picked.length}, отсеяно движком ${rejected}, повторов ${dup}`);
console.log(picked.length === BLOCKS.length * PER_BLOCK ? 'ENDGAME_OK' : 'ENDGAME_SHORT');
