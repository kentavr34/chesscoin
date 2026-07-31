// Сплошная проверка ВСЕХ задач в базе — по факту, движком.
// Ровно то, чем ловили прежний брак: позиция легальна, ходы решения играются,
// сторона в FEN совпадает с той, за кого игрок делает первый ход,
// а заявленный мат — действительно мат.
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';

const rows = JSON.parse(readFileSync(process.argv[2], 'utf8').trim());
let ok = 0;
const bad = [];

for (const p of rows) {
  const moves = Array.isArray(p.moves) ? p.moves
    : String(p.moves).replace(/[{}]/g, '').split(',').filter(Boolean);
  const themes = Array.isArray(p.themes) ? p.themes
    : String(p.themes).replace(/[{}]/g, '').split(',').filter(Boolean);
  const problems = [];

  let chess;
  try { chess = new Chess(p.fen); } catch (e) { bad.push({ id: p.id, problems: ['FEN не разбирается'] }); continue; }
  if (chess.isGameOver()) problems.push('позиция уже закончена');
  if (moves.length === 0) problems.push('решение пустое');
  if (moves.length % 2 === 0) problems.push('решение кончается ходом соперника');

  const playerColor = chess.turn();
  for (let i = 0; i < moves.length; i++) {
    const uci = moves[i];
    // Чётные индексы — ходы игрока, нечётные — ответы соперника.
    const expect = i % 2 === 0 ? playerColor : (playerColor === 'w' ? 'b' : 'w');
    if (chess.turn() !== expect) { problems.push(`ход ${i} за не ту сторону`); break; }
    let mv = null;
    try { mv = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || 'q' }); } catch { mv = null; }
    if (!mv) { problems.push(`ход ${uci} (индекс ${i}) невозможен`); break; }
  }

  const mateTheme = themes.find(t => /^mateIn\d$/.test(t));
  if (mateTheme && problems.length === 0) {
    if (!chess.isCheckmate()) problems.push(`${mateTheme}, но мата нет`);
    const n = Number(mateTheme.slice(6));
    if (moves.length !== n * 2 - 1) problems.push(`${mateTheme}, но полуходов ${moves.length}`);
  }

  if (problems.length) bad.push({ id: p.id, rating: p.rating, fen: p.fen, moves, themes, problems });
  else ok++;
}

console.log(`всего задач: ${rows.length}`);
console.log(`решаемых: ${ok}`);
console.log(`с дефектами: ${bad.length}`);
for (const b of bad.slice(0, 15)) {
  console.log(`  ✗ ${b.id} [${b.themes}] ${b.moves?.join(' ')} → ${b.problems.join('; ')}`);
}
process.exit(bad.length === 0 ? 0 : 1);
