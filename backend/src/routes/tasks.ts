import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";

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

    const result = tasks.map((task) => ({
      ...task,
      completed: completedSet.has(task.id),
      completedAt: completedSet.get(task.id) ?? null,
    }));

    res.json({ tasks: result });
  } catch (err) {
    console.error("[tasks/list]", err);
    res.status(500).json({ error: "Ошибка загрузки заданий" });
  }
});

// ─── POST /api/v1/tasks/complete ─────────────────────────────────────────────
tasksRouter.post("/complete", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: "taskId обязателен" });

    const userId = req.user!.id;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.status !== "ACTIVE")
      return res.status(404).json({ error: "Задание не найдено" });

    // Проверяем что не выполнено
    const existing = await prisma.completedTask.findUnique({
      where: { userId_taskId: { userId, taskId } },
    });
    if (existing) return res.status(409).json({ error: "Задание уже выполнено" });

    // Для FOLLOW_LINK / SUBSCRIBE_TELEGRAM — доверяем клиенту (v5)
    // Для REFERRAL — проверяем количество рефералов
    if (task.taskType === "REFERRAL") {
      const meta = task.metadata as any;
      const requiredCount: number = meta?.referralCount ?? 1;
      const actualCount = await prisma.user.count({
        where: { referrerId: userId, referralActivated: true },
      });
      if (actualCount < requiredCount) {
        return res.status(400).json({
          error: `Нужно ${requiredCount} рефералов, у вас ${actualCount}`,
        });
      }
    }

    // Если код — проверяем
    if (task.taskType === "ENTER_CODE") {
      const meta = task.metadata as any;
      const { code } = req.body;
      if (!code || code !== meta?.code)
        return res.status(400).json({ error: "Неверный код" });
    }

    // Начислить награду
    await prisma.$transaction([
      prisma.completedTask.create({ data: { userId, taskId } }),
      prisma.user.update({
        where: { id: userId },
        data: {
          balance: { increment: task.winningAmount },
          totalEarned: { increment: task.winningAmount },
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          amount: task.winningAmount,
          type: "TASK_REWARD",
          payload: { taskId, taskTitle: task.title },
        },
      }),
    ]);

    res.json({
      success: true,
      reward: task.winningAmount.toString(),
      message: `+${task.winningAmount} ᚙ за задание «${task.title}»`,
    });
  } catch (err) {
    console.error("[tasks/complete]", err);
    res.status(500).json({ error: "Ошибка выполнения задания" });
  }
});
