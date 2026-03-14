import { Router, Request, Response } from "express";
import { prisma } from "@/lib/prisma";
import { signAccessToken } from "@/services/auth";
import config from "@/config";

const router = Router();

// GET /api/v1/screenshotter/token?secret=...
// Возвращает JWT для тестового пользователя — ТОЛЬКО для скриншотов/мониторинга
router.get("/token", async (req: Request, res: Response) => {
  const secret = req.query.secret as string;
  const expected = process.env.SCREENSHOT_SECRET;
  if (!expected || secret !== expected) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Создаём / получаем тестового пользователя
  const testUser = await prisma.user.upsert({
    where: { telegramId: "screenshotter_001" },
    create: {
      telegramId: "screenshotter_001",
      firstName: "Screenshot",
      lastName: "Bot",
      username: "screenshotter",
      balance: BigInt(999_999),
      elo: 1200,
    },
    update: {},
  });

  const token = signAccessToken(testUser.id);
  res.json({ token, userId: testUser.id });
});

export default router;
