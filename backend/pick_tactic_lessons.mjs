// Отбор задач из базы Lichess в уроки-приёмы (блок 21–80).
//
// Правило то же, что и с матами: в линейку попадает только то, что прогнал
// движок. Позиция обязана быть легальной, каждый ход — играться, сценарий —
// кончаться ходом игрока (нечётная длина, moves[0] — ход игрока).
import { readFileSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';

const SRC = process.argv[2];
const OUT = process.argv[3];

// Порядок блоков — от простого приёма к сложному.
const BLOCKS = [
  { theme: 'hangingPiece',     key: 'hanging',    from: 21 },
  { theme: 'fork',             key: 'fork',       from: 31 },
  { theme: 'pin',              key: 'pin',        from: 41 },
  { theme: 'skewer',           key: 'skewer',     from: 51 },
  { theme: 'discoveredAttack', key: 'discovered', from: 61 },
  { theme: 'deflection',       key: 'deflection', from: 71 },
];
const PER_BLOCK = 10;

const cands = JSON.parse(readFileSync(SRC, 'utf8'));

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
let rejected = 0;
for (const b of BLOCKS) {
  const pool = cands
    .filter(p => p.theme === b.theme)
    .sort((a, c) => a.rating - c.rating || (a.id < c.id ? -1 : 1));
  const good = [];
  for (const p of pool) {
    if (good.length >= PER_BLOCK) break;
    if (valid(p)) good.push(p); else rejected++;
  }
  if (good.length < PER_BLOCK) {
    console.log(`✗ ${b.theme}: годных только ${good.length} из ${PER_BLOCK}`);
  }
  good.forEach((p, i) => picked.push({
    id: b.from + i, block: b.key, puzzleId: p.id, rating: p.rating,
    fen: p.fen, moves: p.moves, ord: i + 1,
  }));
  console.log(`✓ ${b.theme} → уроки ${b.from}–${b.from + good.length - 1}, рейтинг ${good[0]?.rating}–${good[good.length - 1]?.rating}`);
}

writeFileSync(OUT, JSON.stringify(picked, null, 1), 'utf8');
console.log(`отобрано ${picked.length}, отсеяно движком ${rejected}`);
console.log(picked.length === BLOCKS.length * PER_BLOCK ? 'TACTICS_OK' : 'TACTICS_SHORT');
