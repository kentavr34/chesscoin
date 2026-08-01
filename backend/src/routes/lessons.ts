/**
 * Обучение: линейка уроков от простого к сложному.
 *
 * Кенан 01.08.2026: обучение — не случайные задачи. Урок проходится в два
 * этапа: сначала доска сама проигрывает сценарий, потом игрок повторяет его
 * без подсказок. Тексты приходят ключами — фронт берёт их из словаря, поэтому
 * урок сразу работает на всех языках.
 *
 * Прогресс и награда живут там же, где были: lesson_progress и
 * POST /tasks/lessons/:level/complete. Второй системы прогресса не заводим.
 */
import { Router, Request, Response } from "express";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/middleware/auth";
import { logger } from "@/lib/logger";

export const lessonsRouter = Router();

const fmt = (l: {
  id: number; block: string; titleKey: string; explainKey: string;
  fen: string; moves: string[]; reward: bigint;
}) => ({
  id: l.id,
  block: l.block,
  titleKey: l.titleKey,
  explainKey: l.explainKey,
  fen: l.fen,
  moves: l.moves,
  reward: l.reward.toString(),
});

// ── GET /api/v1/lessons — вся линейка с отметкой пройденного ────────────────
lessonsRouter.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const [lessons, progress] = await Promise.all([
      prisma.lesson.findMany({ orderBy: { id: "asc" } }),
      prisma.$queryRaw<Array<{ currentLevel: number }>>`
        SELECT "currentLevel" FROM lesson_progress WHERE "userId" = ${userId} LIMIT 1
      `,
    ]);
    const currentLevel = progress[0]?.currentLevel ?? 1;

    res.json({
      currentLevel,
      total: lessons.length,
      lessons: lessons.map(l => ({
        ...fmt(l),
        // Пройденные видно, но заново их проходить незачем; следующий за
        // текущим открыт — линейка не должна упираться в стену.
        isCompleted: l.id < currentLevel,
        isCurrent: l.id === currentLevel,
      })),
    });
  } catch (err) {
    logger.error("[lessons/list]", err);
    res.status(500).json({ error: "Failed to load lessons" });
  }
});

// ── GET /api/v1/lessons/:id — один урок ──────────────────────────────────────
lessonsRouter.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid lesson id" });

    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (!lesson) return res.status(404).json({ error: "LESSON_NOT_FOUND" });

    // Есть ли следующий — от этого зависит, показывать ли кнопку «Следующий».
    const next = await prisma.lesson.findFirst({
      where: { id: { gt: id } }, orderBy: { id: "asc" }, select: { id: true },
    });

    res.json({ lesson: fmt(lesson), nextId: next?.id ?? null });
  } catch (err) {
    logger.error("[lessons/get]", err);
    res.status(500).json({ error: "Failed to load lesson" });
  }
});
