// Отбор кандидатов из открытой базы задач Lichess (CC0) под блоки уроков.
//
// База — 6,1 млн строк, держать её в проекте незачем: скрипт читает поток,
// оставляет по теме ограниченный запас и выбрасывает остальное. Итоговый
// JSON — единицы мегабайт, его и разбирает подборщик уроков.
//
// Формат строки: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,
//                NbPlays,Themes,GameUrl,OpeningTags,DailyDate
//
// В задаче Lichess ПЕРВЫЙ ход — ответ соперника: позиция в FEN стоит до него.
// Урок начинается с хода ученика, поэтому первый ход применяем сразу, а в
// решение кладём остаток. Это та же договорённость, что и в уроках 21–120.
import { createReadStream } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Chess } from 'chess.js';

const SRC = process.argv[2];              // распакованный csv (или /dev/stdin)
const OUT = process.argv[3];
const ЗАПАС = Number(process.argv[4] || 400);   // сколько держать на тему

// Темы, из которых собираются блоки 121–300. Имена — как в базе Lichess.
const ТЕМЫ = [
  'attraction', 'clearance', 'interference', 'trappedPiece', 'doubleCheck',
  'intermezzo', 'kingsideAttack', 'sacrifice', 'exposedKing', 'quietMove',
  'zugzwang', 'backRankMate', 'smotheredMate', 'mateIn2', 'mateIn3',
  'queenEndgame', 'knightEndgame', 'xRayAttack', 'capturingDefender',
  'defensiveMove', 'underPromotion', 'anastasiaMate', 'arabianMate',
];

// Слишком лёгкие и слишком дикие задачи одинаково плохи для урока: первые
// ничему не учат, вторые отбивают охоту. Держим осмысленный коридор и
// требуем, чтобы задачу реально решали люди и она им нравилась.
const РЕЙТИНГ_ОТ = 900;
const РЕЙТИНГ_ДО = 2400;
const ПОПУЛЯРНОСТЬ = 80;    // из 100
const СЫГРАНО = 300;

const кандидаты = new Map(ТЕМЫ.map((t) => [t, []]));
let строк = 0, годных = 0;

const rl = createInterface({ input: createReadStream(SRC), crlfDelay: Infinity });

for await (const line of rl) {
  строк += 1;
  if (строк === 1 && line.startsWith('PuzzleId')) continue;
  const c = line.split(',');
  if (c.length < 8) continue;

  const rating = Number(c[3]);
  if (!(rating >= РЕЙТИНГ_ОТ && rating <= РЕЙТИНГ_ДО)) continue;
  if (Number(c[5]) < ПОПУЛЯРНОСТЬ) continue;
  if (Number(c[6]) < СЫГРАНО) continue;

  const themes = c[7].split(' ');
  // Проверять движком задачу, у темы которой запас уже набран, — чистая трата:
  // база большая, и на популярных темах (mateIn2, sacrifice) это сотни тысяч
  // лишних разборов. Берём только те строки, которым ещё есть куда лечь.
  const нужные = themes.filter((t) => кандидаты.has(t) && кандидаты.get(t).length < ЗАПАС);
  if (!нужные.length) continue;

  const uci = c[2].split(' ');
  if (uci.length < 2) continue;

  // Первый ход — соперника. Применяем и получаем позицию ученика.
  let chess;
  try {
    chess = new Chess(c[1]);
    const m = chess.move({ from: uci[0].slice(0, 2), to: uci[0].slice(2, 4), promotion: uci[0].slice(4) || 'q' });
    if (!m) continue;
  } catch { continue; }

  const решение = uci.slice(1);
  // Сценарий обязан кончаться ходом ученика: ход ученика, ответ, ход ученика…
  if (решение.length % 2 !== 1) continue;

  // Каждый ход обязан играться — иначе урок сломается прямо у ученика.
  let ок = true;
  const проба = new Chess(chess.fen());
  for (const u of решение) {
    try {
      if (!проба.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.slice(4) || 'q' })) { ок = false; break; }
    } catch { ок = false; break; }
  }
  if (!ок) continue;

  годных += 1;
  const запись = {
    id: c[0], fen: chess.fen(), moves: решение, rating,
    popularity: Number(c[5]), plays: Number(c[6]), themes,
    mate: проба.isCheckmate(),
  };
  for (const t of нужные) {
    const список = кандидаты.get(t);
    if (список.length < ЗАПАС) список.push(запись);
  }
}

const итог = {};
for (const [t, список] of кандидаты) итог[t] = список;
writeFileSync(OUT, JSON.stringify(итог), 'utf8');

console.log(`прочитано строк: ${строк}, годных: ${годных}`);
for (const t of ТЕМЫ) console.log(`${t.padEnd(20)} ${кандидаты.get(t).length}`);
