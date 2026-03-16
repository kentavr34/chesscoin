import { Router, Request, Response } from "express";
import { authMiddleware, AuthRequest } from "@/middleware/auth";
import { prisma } from "@/lib/prisma";
import { updateBalance } from "@/services/economy";
import { TransactionType } from "@prisma/client";

const router = Router();

// GET /puzzles/lessons — список уроков с прогрессом пользователя
router.get("/lessons", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const lang = req.query.lang as string ?? "ru";

  const [puzzles, completions] = await Promise.all([
    prisma.chessPuzzle.findMany({
      where: { type: "LESSON", isActive: true },
      orderBy: [{ sortOrder: "asc" }, { difficulty: "asc" }],
      select: { id: true, titleRu: true, titleEn: true, descRu: true, descEn: true, difficulty: true, reward: true, category: true, sortOrder: true },
    }),
    prisma.puzzleCompletion.findMany({
      where: { userId },
      select: { puzzleId: true, passedAt: true },
    }),
  ]);

  const completedIds = new Set(completions.map((c: any) => c.puzzleId));

  res.json(puzzles.map((p: any) => ({
    id: p.id,
    title: lang === "en" ? p.titleEn : p.titleRu,
    description: lang === "en" ? p.descEn : p.descRu,
    difficulty: p.difficulty,
    reward: p.reward.toString(),
    category: p.category,
    sortOrder: p.sortOrder,
    completed: completedIds.has(p.id),
  })));
});

// GET /puzzles/lessons/:id — один урок
router.get("/lessons/:id", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const lang = req.query.lang as string ?? "ru";

  const puzzle = await prisma.chessPuzzle.findUnique({
    where: { id: req.params.id },
  });

  if (!puzzle || puzzle.type !== "LESSON") {
    return res.status(404).json({ error: "Lesson not found" });
  }

  const completion = await prisma.puzzleCompletion.findUnique({
    where: { userId_puzzleId: { userId, puzzleId: puzzle.id } },
  });

  res.json({
    id: puzzle.id,
    title: lang === "en" ? puzzle.titleEn : puzzle.titleRu,
    description: lang === "en" ? puzzle.descEn : puzzle.descRu,
    fen: puzzle.fen,
    moves: puzzle.moves,
    difficulty: puzzle.difficulty,
    reward: puzzle.reward.toString(),
    category: puzzle.category,
    completed: !!completion,
    completedAt: completion?.passedAt ?? null,
  });
});

// POST /puzzles/lessons/:id/complete — засчитать прохождение + reward
router.post("/lessons/:id/complete", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;

  const puzzle = await prisma.chessPuzzle.findUnique({ where: { id: req.params.id } });
  if (!puzzle || puzzle.type !== "LESSON") {
    return res.status(404).json({ error: "Lesson not found" });
  }

  // Проверяем уже пройдено
  const existing = await prisma.puzzleCompletion.findUnique({
    where: { userId_puzzleId: { userId, puzzleId: puzzle.id } },
  });

  if (existing) {
    return res.json({ alreadyCompleted: true, reward: "0" });
  }

  // Создаём completion и начисляем монеты
  await prisma.puzzleCompletion.create({ data: { userId, puzzleId: puzzle.id } });

  const updatedUser = await updateBalance(
    userId,
    puzzle.reward,
    TransactionType.PUZZLE_REWARD,
    { puzzleId: puzzle.id, type: "LESSON" },
    { isEmission: true }
  );

  res.json({
    alreadyCompleted: false,
    reward: puzzle.reward.toString(),
    balance: updatedUser.balance.toString(),
  });
});

// GET /puzzles/daily — ежемесячные задачи
router.get("/daily", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const lang = req.query.lang as string ?? "ru";
  const now = new Date();

  const [puzzles, completions] = await Promise.all([
    prisma.chessPuzzle.findMany({
      where: {
        type: "DAILY",
        isActive: true,
        OR: [
          { month: null },
          { month: now.getMonth() + 1, year: now.getFullYear() },
        ],
      },
      orderBy: [{ difficulty: "asc" }, { sortOrder: "asc" }],
      select: { id: true, titleRu: true, titleEn: true, descRu: true, descEn: true, difficulty: true, reward: true, category: true },
    }),
    prisma.puzzleCompletion.findMany({
      where: { userId, puzzle: { type: "DAILY" } },
      select: { puzzleId: true },
    }),
  ]);

  const completedIds = new Set(completions.map((c: any) => c.puzzleId));

  // Не показываем уже выполненные
  const filtered = puzzles.filter((p: any) => !completedIds.has(p.id));

  res.json(filtered.map((p: any) => ({
    id: p.id,
    title: lang === "en" ? p.titleEn : p.titleRu,
    description: lang === "en" ? p.descEn : p.descRu,
    difficulty: p.difficulty,
    reward: p.reward.toString(),
    category: p.category,
  })));
});

// GET /puzzles/daily/:id — одна задача
router.get("/daily/:id", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const lang = req.query.lang as string ?? "ru";

  const puzzle = await prisma.chessPuzzle.findUnique({ where: { id: req.params.id } });
  if (!puzzle || puzzle.type !== "DAILY") {
    return res.status(404).json({ error: "Daily puzzle not found" });
  }

  const completion = await prisma.puzzleCompletion.findUnique({
    where: { userId_puzzleId: { userId, puzzleId: puzzle.id } },
  });

  if (completion) {
    return res.status(409).json({ error: "Already completed" });
  }

  res.json({
    id: puzzle.id,
    title: lang === "en" ? puzzle.titleEn : puzzle.titleRu,
    description: lang === "en" ? puzzle.descEn : puzzle.descRu,
    fen: puzzle.fen,
    moves: puzzle.moves,
    difficulty: puzzle.difficulty,
    reward: puzzle.reward.toString(),
  });
});

// POST /puzzles/daily/:id/complete
router.post("/daily/:id/complete", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;

  const puzzle = await prisma.chessPuzzle.findUnique({ where: { id: req.params.id } });
  if (!puzzle || puzzle.type !== "DAILY") {
    return res.status(404).json({ error: "Daily puzzle not found" });
  }

  const existing = await prisma.puzzleCompletion.findUnique({
    where: { userId_puzzleId: { userId, puzzleId: puzzle.id } },
  });

  if (existing) {
    return res.status(409).json({ error: "Already completed" });
  }

  await prisma.puzzleCompletion.create({ data: { userId, puzzleId: puzzle.id } });

  const updatedUser = await updateBalance(
    userId,
    puzzle.reward,
    TransactionType.PUZZLE_REWARD,
    { puzzleId: puzzle.id, type: "DAILY" },
    { isEmission: true }
  );

  res.json({
    reward: puzzle.reward.toString(),
    balance: updatedUser.balance.toString(),
  });
});

export default router;
