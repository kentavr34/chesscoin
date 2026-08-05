// Отбор уроков 121–300 — комбинации, атака, красивые маты, тяжёлые окончания.
//
// Кенан 05.08.2026: «максимальное количество профессиональных версий… начинать
// с лёгкого и идти к сложному».
//
// ЧТО ЗНАЧИТ «ОТ ЛЁГКОГО К СЛОЖНОМУ». Первый заход брал просто десять самых
// лёгких задач каждой темы — и все восемнадцать блоков вышли с рейтингом
// 900–1010. Разница в сто пунктов лестницей не является: ученик не почувствует
// её, а награда при этом росла бы вдвое. Поэтому у каждого блока своя ПОЛОСА
// рейтинга, и полосы поднимаются вдоль всей линейки: начало — около 1000,
// конец — около 2100. Внутри блока задачи тоже идут по возрастанию.
//
// Порядок тем — не по рейтингу, а по смыслу обучения: сперва рисунки мата,
// которые надо просто узнавать, потом атака, потом тонкие приёмы, и только
// в конце то, где нужен расчёт и терпение.
import { readFileSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';

const SRC = process.argv[2];
const OUT = process.argv[3];
const НА_БЛОК = 10;
const С_НОМЕРА = 121;

// theme  — тема в базе Lichess
// key    — имя блока внутри проекта (по нему берутся тексты)
// от, до — полоса рейтинга; растёт от блока к блоку
// mate   — сценарий обязан кончаться матом
// ходов  — жёсткая длина решения (для матов в N ходов)
const БЛОКИ = [
  // Узнаваемые рисунки мата — их запоминают, а не считают.
  { theme: 'backRankMate',      key: 'backrank',     от: 950,  до: 1250, mate: true },
  { theme: 'smotheredMate',     key: 'smothered',    от: 1000, до: 1300, mate: true },
  { theme: 'arabianMate',       key: 'arabian',      от: 1050, до: 1350, mate: true },
  { theme: 'anastasiaMate',     key: 'anastasia',    от: 1100, до: 1400, mate: true },
  // Атака на короля.
  { theme: 'kingsideAttack',    key: 'kingattack',   от: 1200, до: 1500 },
  { theme: 'exposedKing',       key: 'exposedking',  от: 1300, до: 1600 },
  { theme: 'sacrifice',         key: 'sacrifice',    от: 1350, до: 1650 },
  { theme: 'doubleCheck',       key: 'doublecheck',  от: 1400, до: 1700 },
  // Тонкие приёмы — тут уже надо считать.
  { theme: 'capturingDefender', key: 'defender',     от: 1450, до: 1750 },
  { theme: 'xRayAttack',        key: 'xray',         от: 1500, до: 1800 },
  { theme: 'mateIn2',           key: 'matein2',      от: 1500, до: 1800, mate: true, ходов: 3 },
  { theme: 'clearance',         key: 'clearance',    от: 1550, до: 1850 },
  { theme: 'interference',      key: 'interference', от: 1600, до: 1900 },
  { theme: 'intermezzo',        key: 'intermezzo',   от: 1650, до: 1950 },
  { theme: 'attraction',        key: 'attraction',   от: 1700, до: 2000 },
  { theme: 'trappedPiece',      key: 'trapped',      от: 1750, до: 2050 },
  // Расчёт и терпение.
  { theme: 'quietMove',         key: 'quietmove',    от: 1850, до: 2150 },
  { theme: 'mateIn3',           key: 'matein3',      от: 1700, до: 2100, mate: true, ходов: 5 },
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

// ── Отбор ────────────────────────────────────────────────────────────────────
const собрано = [];
const занятые = new Set();     // одна задача не должна попасть в два блока
for (const блок of БЛОКИ) {
  const все = (cands[блок.theme] || []).filter((p) => !занятые.has(p.id));
  // Внутри полосы берём равномерно по трудности, а не десять подряд из начала:
  // иначе блок «мат в 2» весь состоял бы из задач одного уровня.
  const впол = все.filter((p) => p.rating >= блок.от && p.rating <= блок.до)
                  .sort((a, b) => a.rating - b.rating || (a.id < b.id ? -1 : 1));
  const good = [];
  let отсеяно = 0;
  const шаг = Math.max(1, Math.floor(впол.length / (НА_БЛОК * 2)));
  for (let i = 0; i < впол.length && good.length < НА_БЛОК; i += (i % шаг === 0 ? 1 : 1)) {
    const p = впол[i];
    if (годна(p, блок)) { good.push(p); занятые.add(p.id); i += шаг - 1; } else отсеяно += 1;
  }
  // Полоса могла оказаться бедной — расширяем на весь запас темы, но
  // по-прежнему по возрастанию: лучше блок чуть легче, чем блок с дырой.
  if (good.length < НА_БЛОК) {
    const остальные = все.filter((p) => !занятые.has(p.id))
                         .sort((a, b) => Math.abs(a.rating - блок.от) - Math.abs(b.rating - блок.от));
    for (const p of остальные) {
      if (good.length >= НА_БЛОК) break;
      if (годна(p, блок)) { good.push(p); занятые.add(p.id); } else отсеяно += 1;
    }
  }
  if (good.length < НА_БЛОК) {
    console.log(`✗ ${блок.theme}: годных только ${good.length} из ${НА_БЛОК} (отсеяно ${отсеяно}) — блок пропущен`);
    good.forEach((p) => занятые.delete(p.id));
    continue;
  }
  good.sort((a, b) => a.rating - b.rating);
  собрано.push({ ...блок, задачи: good, медиана: медиана(good.map((p) => p.rating)) });
}

// ── Лестница наград ──────────────────────────────────────────────────────────
// Уроки 1–120 стоят 1000/2000/3000/5000. Новые продолжают до 20 000 за самое
// трудное (Кенан 05.08.2026: «сложные маты — 15, даже 20 тысяч»).
const ОТ = 7000, ДО = 20000;
const шагНаграды = собрано.length > 1 ? (ДО - ОТ) / (собрано.length - 1) : 0;

const уроки = [];
let номер = С_НОМЕРА;
собрано.forEach((блок, i) => {
  // Округляем до тысячи — награда должна читаться, а не считаться.
  блок.награда = Math.round((ОТ + шагНаграды * i) / 1000) * 1000;
  блок.от_урока = номер;
  блок.задачи.forEach((p, j) => {
    уроки.push({
      id: номер++, block: блок.key, theme: блок.theme, ord: j + 1,
      reward: блок.награда, rating: p.rating, puzzleId: p.id,
      fen: p.fen, moves: p.moves,
    });
  });
  блок.до_урока = номер - 1;
});

writeFileSync(OUT, JSON.stringify({ блоки: собрано.map(({ задачи, ...b }) => b), уроки }, null, 1), 'utf8');

console.log('ЛЕСТНИЦА 121–300 — трудность и награда растут вместе\n');
console.log('  уроки     блок           рейтинг задач    медиана  награда');
for (const b of собрано) {
  const r = b.задачи.map((p) => p.rating);
  console.log(`  ${String(b.от_урока).padStart(3)}–${b.до_урока}   ${b.key.padEnd(13)} ${String(r[0]).padStart(5)}–${String(r[r.length - 1]).padEnd(5)}     ${String(b.медиана).padStart(4)}    ${b.награда}`);
}
console.log(`\nвсего уроков: ${уроки.length}, блоков: ${собрано.length}`);
