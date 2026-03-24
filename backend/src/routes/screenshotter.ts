import { Router, Request, Response } from "express";
import { prisma } from "@/lib/prisma";
import { signAccessToken } from "@/services/auth";
import { timingSafeEqual } from "crypto";
import { rateLimit } from "express-rate-limit";
import config from "@/config";

const router = Router();

const screenshotterLimit = rateLimit({ windowMs: 60_000, max: 5, message: { error: "Too many requests" } });

router.get("/token", screenshotterLimit, async (req: Request, res: Response) => {
  const secret = req.query.secret as string;
  const expected = process.env.SCREENSHOT_SECRET;
  if (!expected || !secret || secret.length !== expected.length ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
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
