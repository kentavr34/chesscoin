import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";
import { updateBalance } from "@/services/economy";
import { TransactionType } from "@prisma/client";

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

    const getCategory = (task: any): string => {
      const meta = task.metadata as any;
      if (meta?.category) return meta.category;
      switch (task.taskType) {
        case 'SUBSCRIBE_TELEGRAM':
        case 'FOLLOW_LINK':
        case 'REFERRAL':
          return 'SOCIAL';
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

    // Начислить награду через updateBalance (создаёт транзакцию автоматически)
    await prisma.completedTask.create({ data: { userId, taskId } });
    await updateBalance(userId, BigInt(task.winningAmount.toString()), TransactionType.TASK_REWARD, { taskId, taskTitle: task.title });

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
