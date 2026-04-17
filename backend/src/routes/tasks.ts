import { Router, Request, Response } from "express";
import { z } from "zod";
import { logger, logError } from "@/lib/logger";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";
import { validate } from "@/middleware/validate";
import { updateBalance } from "@/services/economy";
import { TransactionType } from "@prisma/client";

const CompleteTaskSchema = z.object({ taskId: z.string() });

export const tasksRouter = Router();

// ─── GET /api/v1/tasks ────────────────────────────────────────────────────────
tasksRouter.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const [tasks, completed] = await Promise.all([
      prisma.task.findMany({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
      }),
      prisma.completedTask.findMany({
        where: { userId },
        select: { taskId: true, completedAt: true },
      }),
    ]);

    const completedSet = new Map(
      completed.map((c) => [c.taskId, c.completedAt])
    );

    // G16: Авто-начисление реферальных заданий
    for (const task of tasks) {
      if (completedSet.has(task.id)) continue;
      if (task.taskType === 'REFERRAL') {
        const meta = task.metadata as Record<string, unknown>;
        const required = Number(meta?.referralCount ?? 1);
        const actual = await prisma.user.count({ where: { referrerId: userId, referralActivated: true } });
        if (actual >= required) {
          try {
            await prisma.completedTask.create({ data: { userId, taskId: task.id } });
            await updateBalance(userId, task.winningAmount, TransactionType.TASK_REWARD, { taskId: task.id, auto: true }, { isEmission: true });
            completedSet.set(task.id, new Date());
            logger.info(`[tasks] Auto-completed REFERRAL task ${task.id} for user ${userId}`);
          } catch {}
        }
      }
    }

    const getCategory = (task: any): string => {
      const meta = task.metadata as any;
      if (meta?.category) return meta.category;
      switch (task.taskType) {
        case 'SUBSCRIBE_TELEGRAM':
        case 'FOLLOW_LINK':
        case 'REFERRAL':
          return 'SOCIAL';
        case 'DAILY_LOGIN':
        case 'WIN_N':
        case 'WIN_STREAK_N':
        case 'PLAY_N':
        case 'FIRST_GAME':
          return 'DAILY';
        case 'WIN_BOT_N':
        case 'ENTER_CODE':
        case 'PUZZLE':
          return 'LEARN';
        default:
          return 'OTHER';
      }
    };

    const result = tasks.map((task) => {
      const isCompleted = completedSet.has(task.id);
      return {
        id: task.id,
        type: getCategory(task),
        taskType: task.taskType,
        icon: task.icon,
        title: task.title,
        description: task.description,
        metadata: task.metadata,
        status: task.status,
        reward: task.winningAmount.toString(),
        winningAmount: task.winningAmount.toString(),
        isCompleted,
        completed: isCompleted,
        completedAt: completedSet.get(task.id) ?? null,
      };
    });

    res.json({ tasks: result });
  } catch (err) {
    logger.error("[tasks/list]", err);
    res.status(500).json({ error: "Failed to load tasks" });
  }
});

// ─── POST /api/v1/tasks/complete ─────────────────────────────────────────────
tasksRouter.post("/complete", authMiddleware, validate(CompleteTaskSchema), async (req: Request, res: Response) => { // R4
  try {
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: "taskId обязателен" });

    const userId = req.user!.id;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.status !== "ACTIVE")
      return res.status(404).json({ error: "Task not found" });

    // Проверяем что не выполнено
    const existing = await prisma.completedTask.findUnique({
      where: { userId_taskId: { userId, taskId } },
    });
    if (existing) return res.status(409).json({ error: "Task already completed" });

    // Для FOLLOW_LINK / SUBSCRIBE_TELEGRAM — доверяем клиенту (v5)
    // Для REFERRAL — проверяем количество рефералов
    if (task.taskType === "REFERRAL") {
      const meta = task.metadata as Record<string, unknown>;
      const requiredCount = Number(meta?.referralCount ?? 1);
      const actualCount = await prisma.user.count({
        where: { referrerId: userId, referralActivated: true },
      });
      if (actualCount < requiredCount) {
        return res.status(400).json({
          error: `Нужно ${requiredCount} рефералов, у вас ${actualCount}`,
        });
      }
    }

    // Если код — проверяем (если autoComplete=true — код не нужен)
    if (task.taskType === "ENTER_CODE") {
      const meta = task.metadata as Record<string, unknown>;
      const isAutoComplete = meta?.autoComplete === true;
      if (!isAutoComplete) {
        const { code } = req.body;
        if (!code || code !== meta?.code)
          return res.status(400).json({ error: "Invalid code" });
      }
    }

    // Начислить награду через updateBalance (создаёт транзакцию автоматически)
    await prisma.completedTask.create({ data: { userId, taskId } });
    await updateBalance(userId, BigInt(task.winningAmount.toString()), TransactionType.TASK_REWARD, { taskId, taskTitle: task.title });

    res.json({
      success: true,
      reward: task.winningAmount.toString(),
      message: `+${task.winningAmount} ᚙ за задание «${task.title}»`,
    });
  } catch (err: unknown) {
    logger.error("[tasks/complete]", err);
    res.status(500).json({ error: "Failed to complete task" });
  }
});

// ─── GET /api/v1/tasks/puzzles?difficulty=easy|medium|hard ───────────────────
// Возвращает случайную задачу нужной сложности (которую пользователь ещё не решал)
tasksRouter.get("/puzzles", authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const difficulty = (req.query.difficulty as string) ?? "medium";

  const ratingRange: Record<string, { gte?: number; lte?: number }> = {
    easy:   { lte: 1199 },
    medium: { gte: 1200, lte: 1600 },
    hard:   { gte: 1601 },
  };
  const ratingFilter = ratingRange[difficulty] ?? ratingRange.medium;

  try {
    // ID уже решённых задач этим пользователем
    const solved = await prisma.completedPuzzle.findMany({
      where: { userId },
      select: { puzzleId: true },
    });
    const solvedIds = solved.map((s: Record<string,unknown>) => s.puzzleId) as string[];

    // Считаем сколько подходящих задач
    const count = await prisma.puzzle.count({
      where: { rating: ratingFilter, id: { notIn: solvedIds } },
    });

    if (count === 0) {
      return res.status(404).json({ error: "No puzzles available — you solved them all!" });
    }

    // Случайная задача (OFFSET RANDOM — для небольших наборов ок)
    const skip = Math.floor(Math.random() * count);
    const [puzzle] = await prisma.puzzle.findMany({
      where: { rating: ratingFilter, id: { notIn: solvedIds } },
      skip,
      take: 1,
    });

    res.json({ puzzle: { ...puzzle, reward: puzzle.reward.toString() } });
  } catch (e: unknown) {
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
  }
});

// ─── GET /api/v1/tasks/puzzles/daily ─────────────────────────────────────────
// Задача дня — одна на всех, обновляется через cron
tasksRouter.get("/puzzles/daily", authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  try {
    const puzzle = await prisma.puzzle.findFirst({
      where: { isDaily: true },
      orderBy: { dailyDate: "desc" },
    });
    if (!puzzle) return res.status(404).json({ error: "Daily puzzle not assigned" });

    const alreadySolved = await prisma.completedPuzzle.findUnique({
      where: { userId_puzzleId: { userId, puzzleId: puzzle.id } },
    });

    res.json({
      puzzle: { ...puzzle, reward: puzzle.reward.toString() },
      alreadySolved: !!alreadySolved,
    });
  } catch (e: unknown) {
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
  }
});

// ─── POST /api/v1/tasks/puzzles/:id/complete ─────────────────────────────────
// Проверка решения и начисление награды
tasksRouter.post("/puzzles/:id/complete", authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const puzzleId = req.params.id;
  const { moves }: { moves: string[] } = req.body;

  try {
    const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId } });
    if (!puzzle) return res.status(404).json({ error: "Puzzle not found" });

    // Проверяем не решена ли уже
    const existing = await prisma.completedPuzzle.findUnique({
      where: { userId_puzzleId: { userId, puzzleId } },
    });
    if (existing) {
      return res.status(400).json({ error: "Puzzle already solved", alreadySolved: true });
    }

    // Верификация: нормализуем ходы к нижнему регистру без пробелов
    const normalize = (arr: string[]) => arr.map(m => m.trim().toLowerCase());
    const correct = normalize(puzzle.moves);
    const submitted = normalize(moves ?? []);

    // Сравниваем: все ходы должны совпадать
    const isCorrect =
      submitted.length === correct.length &&
      correct.every((m, i) => submitted[i] === m);

    if (!isCorrect) {
      return res.status(422).json({
        error: "Wrong solution",
        correct: false,
        hint: correct[submitted.length] ?? null, // следующий правильный ход (подсказка)
      });
    }

    await prisma.completedPuzzle.create({ data: { userId, puzzleId, reward: puzzle.reward } });
    await updateBalance(userId, puzzle.reward, TransactionType.TASK_REWARD, { puzzleId, rating: puzzle.rating }, { isEmission: true });

    res.json({
      success: true,
      correct: true,
      reward: puzzle.reward.toString(),
      message: `+${puzzle.reward} ᚙ за задачу!`,
    });
  } catch (e: unknown) {
    logger.error("[puzzles/complete]", e);
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
  }
});
