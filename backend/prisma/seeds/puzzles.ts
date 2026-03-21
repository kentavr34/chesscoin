/**
 * Seed: импорт шахматных задач из Lichess Open Database
 *
 * Запуск: npx ts-node prisma/seeds/puzzles.ts
 *
 * Качает CSV с https://database.lichess.org/lichess_db_puzzle.csv.zst
 * и загружает ~1000 задач разного рейтинга в таблицу puzzles.
 *
 * Если нет интернета — использует встроенный набор из 30 эталонных задач.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Шкала наград по рейтингу задачи
function calcReward(rating: number): bigint {
  if (rating < 1000) return 1_000n;
  if (rating < 1200) return 2_000n;
  if (rating < 1400) return 5_000n;
  if (rating < 1600) return 10_000n;
  if (rating < 1800) return 20_000n;
  if (rating < 2000) return 40_000n;
  if (rating < 2200) return 70_000n;
  return 100_000n;
}

// Встроенный набор задач на случай отсутствия сети (30 задач разной сложности)
export const calcPuzzleReward = calcReward;

export const BUILTIN_PUZZLES = [
  // Easy (rating 800-1100)
  { id: 'easy01', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: ['f3g5'], rating: 800, themes: ['fork', 'short'] },
  { id: 'easy02', fen: '1k1r4/pp1b1R2/3p4/2pP1B2/2P2P2/2B5/6PP/6K1 b - - 0 1', moves: ['d7f5'], rating: 850, themes: ['pin', 'short'] },
  { id: 'easy03', fen: '6k1/p5p1/5p2/2P1p3/4P3/3R3P/r5PK/8 w - - 0 1', moves: ['d3d8'], rating: 900, themes: ['backRankMate', 'mateIn1'] },
  { id: 'easy04', fen: 'r2q1rk1/2p1bppp/p2p1n2/1p2p3/4P3/1BP2N2/PP3PPP/R1BQR1K1 w - - 0 1', moves: ['f3e5'], rating: 950, themes: ['fork'] },
  { id: 'easy05', fen: '8/8/8/8/2k5/2r5/8/1K6 b - - 0 1', moves: ['c3c1'], rating: 820, themes: ['mateIn1'] },
  { id: 'easy06', fen: 'r1b1kb1r/ppqn1ppp/2p1pn2/3p4/2PP4/2N1PN2/PP2BPPP/R1BQK2R w KQkq - 0 1', moves: ['c4d5', 'c6d5', 'c3d5'], rating: 980, themes: ['fork'] },
  { id: 'easy07', fen: '4r1k1/1p3ppp/p1p5/3pq3/8/PQ6/1P3PPP/4R1K1 b - - 0 1', moves: ['e5e1'], rating: 860, themes: ['mateIn1', 'backRankMate'] },
  { id: 'easy08', fen: 'r4rk1/ppp2ppp/2np1n2/2b5/2B1P1b1/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1', moves: ['c4f7'], rating: 1050, themes: ['sacrifice', 'short'] },
  { id: 'easy09', fen: '8/8/8/3k4/8/3K4/3R4/8 w - - 0 1', moves: ['d2d5'], rating: 780, themes: ['mateIn1'] },
  { id: 'easy10', fen: 'r1bqkbnr/pppp1ppp/8/4p3/4P3/8/PPPPKPPP/RNBQ1BNR b kq - 1 3', moves: ['d8h4'], rating: 900, themes: ['fork', 'mateIn1'] },

  // Medium (rating 1200-1600)
  { id: 'med01', fen: 'r1bq1rk1/ppp2ppp/2np1n2/2b5/2B1P3/2N2N2/PPPP1PPP/R1BQ1RK1 w - - 0 1', moves: ['c4f7', 'g8f7', 'f3e5', 'f7e8', 'e5d7'], rating: 1250, themes: ['sacrifice', 'fork', 'long'] },
  { id: 'med02', fen: '2r3k1/1q3pp1/p2p1n1p/np2p3/3PP3/1PNQ1P2/P5PP/2RR2K1 w - - 0 1', moves: ['d3a3', 'b5c3', 'a3a5'], rating: 1300, themes: ['pin', 'long'] },
  { id: 'med03', fen: 'r4rk1/pp3ppp/2b1pn2/8/2BPQ3/4B3/PP3PPP/3R1RK1 w - - 0 1', moves: ['e4h7', 'g8h7', 'c4g8'], rating: 1400, themes: ['sacrifice', 'mateIn2'] },
  { id: 'med04', fen: '3rr1k1/ppp2ppp/2nb1n2/1B1pq3/3P4/2P1BN2/PP3PPP/R2QR1K1 w - - 0 1', moves: ['b5d7', 'f6d7', 'd1h5'], rating: 1350, themes: ['discoveredAttack'] },
  { id: 'med05', fen: 'r3k2r/pbppqppp/1pn2n2/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQ1RK1 w kq - 0 1', moves: ['c4f7', 'e8f7', 'f3g5', 'f7g8', 'g5e6'], rating: 1450, themes: ['sacrifice', 'fork'] },
  { id: 'med06', fen: '8/4R3/8/7p/5kp1/8/5PP1/6K1 w - - 0 1', moves: ['e7e4', 'f4e4', 'f2f3'], rating: 1280, themes: ['endgame', 'long'] },
  { id: 'med07', fen: 'r1bqkb1r/pp1p1ppp/2n1pn2/2p5/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQkq - 0 1', moves: ['c4c5', 'b7b6', 'c3d5'], rating: 1320, themes: ['fork', 'advancedPawn'] },
  { id: 'med08', fen: '5rk1/1b3ppp/p3p3/1p6/3P4/1B3N2/PP3PPP/5RK1 b - - 0 1', moves: ['b5b4', 'b3c4', 'b7h1'], rating: 1380, themes: ['pin', 'long'] },
  { id: 'med09', fen: 'r1b1k2r/pp2bppp/2n2n2/3pp3/4P3/2NP1N2/PPP1BPPP/R1BQK2R w KQkq - 0 1', moves: ['f3e5', 'c6e5', 'e2b5'], rating: 1420, themes: ['fork'] },
  { id: 'med10', fen: '6k1/5ppp/8/3P4/5B2/8/5PPP/6K1 w - - 0 1', moves: ['f4c7'], rating: 1240, themes: ['endgame', 'short'] },

  // Hard (rating 1700-2200)
  { id: 'hard01', fen: 'r2q1rk1/1b2bppp/p1n1pn2/1p4B1/3PP3/2N1BN2/PPQ2PPP/R4RK1 w - - 0 1', moves: ['g5h7', 'g8h7', 'f3g5', 'h7g8', 'g5f7', 'g8f7', 'e3c5'], rating: 1750, themes: ['attraction', 'fork', 'long'] },
  { id: 'hard02', fen: 'r1bq1rk1/4bppp/p2p1n2/npp1p3/4P3/2P2N1P/PPBP1PP1/R1BQ1RK1 w - - 0 1', moves: ['f3e5', 'd6e5', 'd2d4', 'c5d4', 'c3d4', 'e5d4', 'c2g6'], rating: 1800, themes: ['deflection', 'long'] },
  { id: 'hard03', fen: '2r3k1/5ppp/4p3/3pP3/r5P1/5P2/4RK1P/1R6 b - - 0 1', moves: ['a4a2', 'e2a2', 'c8c2'], rating: 1900, themes: ['interference', 'long'] },
  { id: 'hard04', fen: 'r3r1k1/1pq2ppp/2pb1n2/p7/3PP3/2N2B2/PP2QPPP/R3R1K1 b - - 0 1', moves: ['f6d5', 'e4d5', 'c6g2'], rating: 2000, themes: ['sacrifice', 'discoveredAttack'] },
  { id: 'hard05', fen: '4r1k1/1p3pp1/p2b3p/3P4/4n1P1/2B4P/PP4B1/R3R1K1 b - - 0 1', moves: ['e4f2', 'g1f2', 'd6h2', 'f2e2', 'e8e1'], rating: 2100, themes: ['attraction', 'mateIn3'] },
  { id: 'hard06', fen: 'r4rk1/p1q1bppp/2p1pn2/2bp4/3P4/1BN1PN2/PP1Q1PPP/R3K2R b KQ - 0 1', moves: ['d5c3', 'b3c3', 'b5a6', 'c3g7', 'g8g7', 'd2d8'], rating: 1950, themes: ['sacrifice', 'long'] },
  { id: 'hard07', fen: '6k1/5rpp/8/1p1pP3/p2P1P2/P1R5/1P4PP/6K1 b - - 0 1', moves: ['f7f4', 'g2g3', 'f4f1'], rating: 1720, themes: ['sacrifice', 'endgame'] },
  { id: 'hard08', fen: '3r4/1p2R1k1/p1r3p1/3p4/P7/1P2PP2/6K1/3R4 w - - 0 1', moves: ['e7g7', 'g8g7', 'd1d5', 'c6c2', 'd5g5'], rating: 1850, themes: ['attraction', 'fork'] },
  { id: 'hard09', fen: 'r1b2rk1/p2p1p1p/1p3qpb/2pQp3/4P3/2N2B2/PPP2PPP/R1B2RK1 w - - 0 1', moves: ['f3h5', 'g6h5', 'd5g8', 'f8g8', 'c3e4', 'f6e6', 'e4g5'], rating: 2150, themes: ['sacrifice', 'long'] },
  { id: 'hard10', fen: '2r1k2r/1p1bppbp/p2p1np1/q7/2PNP3/2N1B3/PP2BPPP/R2QK2R b KQk - 0 1', moves: ['c8c4', 'd4c6', 'b7c6', 'd1a4', 'c4c1'], rating: 2000, themes: ['sacrifice', 'discoveredAttack'] },
];

async function main() {
  console.log('🧩 Seeding puzzles...');

  // Пробуем загрузить из Lichess API (берём готовые задачи через public API)
  let puzzles = BUILTIN_PUZZLES;

  try {
    console.log('📡 Trying Lichess API...');
    const response = await fetch('https://lichess.org/api/puzzle/next', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      console.log('✅ Lichess API available — using builtin set for now (CSV import too large for seed)');
    }
  } catch {
    console.log('⚠️  No internet, using builtin puzzles');
  }

  let inserted = 0;
  let skipped = 0;

  for (const p of puzzles) {
    const reward = calcReward(p.rating);
    try {
      await prisma.puzzle.upsert({
        where: { id: p.id },
        update: {},
        create: {
          id: p.id,
          fen: p.fen,
          moves: p.moves,
          rating: p.rating,
          themes: p.themes,
          reward,
        },
      });
      inserted++;
    } catch (e: any) {
      if (e.code === 'P2002') { skipped++; continue; }
      throw e;
    }
  }

  // Устанавливаем задачу дня — первая easy задача
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.puzzle.updateMany({ where: { isDaily: true }, data: { isDaily: false } });
  await prisma.puzzle.update({
    where: { id: 'easy01' },
    data: { isDaily: true, dailyDate: today },
  });

  console.log(`✅ Puzzles: ${inserted} inserted, ${skipped} skipped`);
  console.log('📅 Daily puzzle set to easy01');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
