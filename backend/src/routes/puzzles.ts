import { Router, Request, Response } from "express";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/middleware/auth";
import { updateBalance } from "@/services/economy";
import { payFromTreasury } from "@/services/treasury";
import { TransactionType } from "@prisma/client";
import { checkPuzzleAchievements } from "@/services/achievements";

export const puzzlesRouter = Router();

// ── GET /api/v1/puzzles/daily — задача дня ───────────────────────────────────
puzzlesRouter.get("/daily", authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Задача дня действительна только сегодня. Раньше здесь искалась любая
    // строка с isDaily=true без проверки даты, а ротация брала первую по
    // алфавиту id — то есть одну и ту же вечно. «Задача дня» не менялась
    // никогда (Кенан 31.07.2026).
    let daily = await prisma.puzzle.findFirst({
      where: { isDaily: true, dailyDate: today },
      include: {
        completions: { where: { userId }, select: { id: true, reward: true } },
      },
    });

    if (!daily) {
      // Выбор детерминирован по дате: все игроки в один день решают одну
      // задачу, а назавтра она сменится. Смещение — номер дня от эпохи.
      const pool = await prisma.puzzle.findMany({
        where: { rating: { gte: 1200, lte: 1600 } },
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      if (pool.length > 0) {
        const dayNumber = Math.floor(today.getTime() / 86_400_000);
        const chosen = pool[dayNumber % pool.length];
        await prisma.puzzle.updateMany({ where: { isDaily: true }, data: { isDaily: false } });
        daily = await prisma.puzzle.update({
          where: { id: chosen.id },
          data: { isDaily: true, dailyDate: today },
          include: { completions: { where: { userId }, select: { id: true, reward: true } } },
        });
      }
    }

    if (!daily) return res.status(404).json({ error: 'No daily puzzle' });

    const completed = daily.completions.length > 0;
    return res.json({
      puzzle: {
        id: daily.id,
        fen: daily.fen,
        moves: daily.moves,
        rating: daily.rating,
        themes: daily.themes,
        reward: daily.reward.toString(),
        isDaily: true,
        completed,
        earnedReward: completed ? daily.completions[0].reward.toString() : null,
      },
    });
  } catch (e: unknown) {
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
  }
});

// ── GET /api/v1/puzzles/random?difficulty=easy|medium|hard ───────────────────
puzzlesRouter.get("/random", authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const difficulty = req.query.difficulty as string ?? 'medium';

  const ratingRange: Record<string, { gte: number; lte: number }> = {
    easy:   { gte: 600,  lte: 1199 },
    medium: { gte: 1200, lte: 1699 },
    hard:   { gte: 1700, lte: 3000 },
  };
  const range = ratingRange[difficulty] ?? ratingRange.medium;

  try {
    // Уже решённые этим пользователем
    const solved = await prisma.completedPuzzle.findMany({
      where: { userId },
      select: { puzzleId: true },
    });
    const solvedIds = solved.map(s => s.puzzleId);

    // Случайная нерешённая задача нужной сложности
    const candidates = await prisma.puzzle.findMany({
      where: {
        rating: range,
        id: solvedIds.length > 0 ? { notIn: solvedIds } : undefined,
      },
      take: 10,
    });

    if (candidates.length === 0) {
      // Все решены — можно повторить
      const all = await prisma.puzzle.findMany({ where: { rating: range }, take: 10 });
      if (all.length === 0) return res.status(404).json({ error: 'No puzzles found' });
      const pick = all[Math.floor(Math.random() * all.length)];
      return res.json({ puzzle: fmtPuzzle(pick, false) });
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return res.json({ puzzle: fmtPuzzle(pick, false) });
  } catch (e: unknown) {
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
  }
});

// ── GET /api/v1/puzzles/:id — конкретная задача ──────────────────────────────
puzzlesRouter.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  try {
    const puzzle = await prisma.puzzle.findUnique({
      where: { id },
      include: { completions: { where: { userId }, select: { id: true, reward: true } } },
    });
    if (!puzzle) return res.status(404).json({ error: 'Not found' });
    const completed = puzzle.completions.length > 0;
    return res.json({ puzzle: fmtPuzzle(puzzle, completed) });
  } catch (e: unknown) {
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
  }
});

// ── POST /api/v1/puzzles/:id/complete — засчитать решение ────────────────────
// Тело: { moves: string[] } — ходы игрока в UCI (e2e4)
puzzlesRouter.post("/:id/complete", authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const playerMoves: string[] = req.body.moves ?? [];

  try {
    const puzzle = await prisma.puzzle.findUnique({ where: { id } });
    if (!puzzle) return res.status(404).json({ error: 'Puzzle not found' });

    const existing = await prisma.completedPuzzle.findUnique({
      where: { userId_puzzleId: { userId, puzzleId: id } },
    });
    if (existing) return res.json({ ok: true, alreadySolved: true, reward: '0' });

    const correct = validateMoves(playerMoves, puzzle.moves);
    if (!correct) {
      return res.status(400).json({ ok: false, error: 'Incorrect solution', correct: false });
    }

    const finalReward = puzzle.reward;

    await prisma.completedPuzzle.create({
      data: { userId, puzzleId: id, reward: finalReward },
    });

    await payFromTreasury(userId, finalReward, TransactionType.TASK_REWARD, {
      puzzleId: id,
      rating: puzzle.rating,
    });

    // Проверяем достижение Puzzler (50 головоломок)
    setImmediate(() => checkPuzzleAchievements(userId).catch((err) => logError("[Puzzles]", err)));

    return res.json({ ok: true, correct: true, reward: finalReward.toString() });
  } catch (e: unknown) {
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
  }
});

// ── Вспомогательные ──────────────────────────────────────────────────────────

function fmtPuzzle(p: any, completed: boolean) {
  return {
    id: p.id,
    fen: p.fen,
    moves: p.moves,
    rating: p.rating,
    themes: p.themes,
    reward: ((p.reward as number | undefined) ?? 0).toString(),
    isDaily: p.isDaily ?? false,
    completed,
  };
}

/**
 * Сравниваем ходы игрока с правильным решением.
 * В наших задачах FEN — это позиция, где ходит ИГРОК, а moves[0] — его
 * собственный ход. Дальше чередование: 0 игрок, 1 соперник, 2 игрок…
 *
 * Раньше здесь стояла лichess-конвенция (moves[0] — ход соперника) с костылём
 * «кроме задач из одного хода». С данными это не сходилось: во всех задачах
 * длиннее одного хода валидация ждала не те ходы, а фронт вдобавок проигрывал
 * ход игрока за соперника — задачи были невыполнимы (Кенан 31.07.2026).
 *
 * Формат UCI: e2e4, e7e8q (промоция)
 * playerMoves — только ходы игрока (чётные индексы из puzzle.moves)
 */
function validateMoves(playerMoves: string[], solutionMoves: string[]): boolean {
  if (solutionMoves.length === 0) return false;

  const expectedPlayerMoves = solutionMoves.filter((_, i) => i % 2 === 0);

  if (playerMoves.length !== expectedPlayerMoves.length) return false;

  // Сравниваем без учёта регистра (промоция: e7e8Q vs e7e8q)
  return playerMoves.every((move, i) =>
    move.toLowerCase().slice(0, 4) === expectedPlayerMoves[i].toLowerCase().slice(0, 4)
  );
}
