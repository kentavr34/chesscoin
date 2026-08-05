// Отбор уроков 121–300 — комбинации, атака, красивые маты, тяжёлые окончания.
//
// Кенан 05.08.2026: «максимальное количество профессиональных версий… начинать
// с лёгкого и идти к сложному».
//
// Порядок блоков НЕ выдуман: каждый блок собирается из своей темы, после чего
// блоки сортируются по МЕДИАННОМУ рейтингу отобранных задач. Что оказалось
// труднее по мнению миллионов решавших, то и идёт позже и стоит дороже.
//
// Внутри блока тот же принцип: задачи идут по возрастанию рейтинга.
import { readFileSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';

const SRC = process.argv[2];
const OUT = process.argv[3];
const НА_БЛОК = 10;
const С_НОМЕРА = 121;

// Блок = тема Lichess + внутреннее имя + требование к финалу.
// mate: сценарий обязан кончаться матом — иначе это не урок про мат.
const БЛОКИ = [
  { theme: 'attraction',     key: 'attraction' },
  { theme: 'clearance',      key: 'clearance' },
  { theme: 'interference',   key: 'interference' },
  { theme: 'trappedPiece',   key: 'trapped' },
  { theme: 'doubleCheck',    key: 'doublecheck' },
  { theme: 'intermezzo',     key: 'intermezzo' },
  { theme: 'kingsideAttack', key: 'kingattack' },
  { theme: 'sacrifice',      key: 'sacrifice' },
  { theme: 'exposedKing',    key: 'exposedking' },
  { theme: 'quietMove',      key: 'quietmove' },
  { theme: 'zugzwang',       key: 'zugzwang' },
  { theme: 'capturingDefender', key: 'defender' },
  { theme: 'xRayAttack',     key: 'xray' },
  { theme: 'backRankMate',   key: 'backrank',   mate: true },
  { theme: 'smotheredMate',  key: 'smothered',  mate: true },
  { theme: 'mateIn2',        key: 'matein2',    mate: true, ходов: 3 },
  { theme: 'mateIn3',        key: 'matein3',    mate: true, ходов: 5 },
  { theme: 'queenEndgame',   key: 'queenend' },
];

const cands = JSON.parse(readFileSync(SRC, 'utf8'));

/** Задача обязана играться до конца и, где нужно, кончаться матом. */
function годна(p, блок) {
  if (!Array.isArray(p.moves) || p.moves.length % 2 !== 1) return false;
  if (блок.ходов && p.moves.length !== блок.ходов) return false;
  let chess;
  try { chess = new Chess(p.fen); } catch { return false; }
  for (const u of p.moves) {
    try {
      if (!chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.slice(4) || 'q' })) return false;
    } catch { return false; }
  }
  // Мат объявляем матом только по слову движка, а не по названию темы:
  // 05.08.2026 в блоке матов один урок матом не кончался, поймала проверка.
  if (блок.mate && !chess.isCheckmate()) return false;
  return true;
}

const медиана = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// ── Отбор по каждому блоку ───────────────────────────────────────────────────
const собрано = [];
const занятые = new Set();      // одна задача не должна попасть в два блока
for (const блок of БЛОКИ) {
  const pool = (cands[блок.theme] || [])
    .filter((p) => !занятые.has(p.id))
    .sort((a, b) => a.rating - b.rating || (a.id < b.id ? -1 : 1));
  const good = [];
  let отсеяно = 0;
  for (const p of pool) {
    if (good.length >= НА_БЛОК) break;
    if (годна(p, блок)) { good.push(p); занятые.add(p.id); } else отсеяно += 1;
  }
  if (good.length < НА_БЛОК) {
    console.log(`✗ ${блок.theme}: годных только ${good.length} из ${НА_БЛОК} (отсеяно ${отсеяно})`);
    // Блок неполный — в линейку не берём: дыра в середине хуже отсутствия темы.
    good.forEach((p) => занятые.delete(p.id));
    continue;
  }
  собрано.push({ ...блок, задачи: good, медиана: медиана(good.map((p) => p.rating)) });
  console.log(`✓ ${блок.theme.padEnd(18)} рейтинг ${good[0].rating}–${good[good.length - 1].rating}, медиана ${медиана(good.map((p) => p.rating))}`);
}

// ── Порядок блоков — по фактической трудности ────────────────────────────────
собрано.sort((a, b) => a.медиана - b.медиана);

// ── Лестница наград ──────────────────────────────────────────────────────────
// Уроки 1–120 уже стоят 1000/2000/3000/5000. Новые продолжают ту же лестницу
// до 20 000 за самое трудное (Кенан 05.08.2026).
const СТУПЕНИ = [7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000,
                 15000, 16000, 17000, 18000, 19000, 20000];
const шаг = Math.max(1, Math.ceil(собрано.length / СТУПЕНИ.length));

const уроки = [];
let номер = С_НОМЕРА;
собрано.forEach((блок, i) => {
  const награда = СТУПЕНИ[Math.min(СТУПЕНИ.length - 1, Math.floor(i / шаг))];
  блок.задачи.forEach((p, j) => {
    уроки.push({
      id: номер++, block: блок.key, theme: блок.theme, ord: j + 1,
      reward: награда, rating: p.rating, puzzleId: p.id,
      fen: p.fen, moves: p.moves,
    });
  });
  блок.награда = награда;
  блок.от = номер - НА_БЛОК;
  блок.до = номер - 1;
});

writeFileSync(OUT, JSON.stringify({ блоки: собрано.map(({ задачи, ...b }) => b), уроки }, null, 1), 'utf8');

console.log('\nПОРЯДОК ОТ ЛЁГКОГО К СЛОЖНОМУ');
for (const b of собрано) {
  console.log(`  ${String(b.от).padStart(3)}–${b.до}  ${b.key.padEnd(13)} медиана ${b.медиана}  награда ${b.награда}`);
}
console.log(`\nвсего уроков: ${уроки.length}, блоков: ${собрано.length}`);
