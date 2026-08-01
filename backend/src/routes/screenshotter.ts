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

  // Второй проверочный аккаунт (?who=2) заведён по разрешению Кенана
  // 01.08.2026: часть путей нельзя пройти одним игроком — свой батл не
  // примешь, свою ссылку-приглашение не проверишь.
  //
  // Баланс НЕ засыпаем: у первого аккаунта 999 999 монет были дописаны прямо
  // в базу мимо истории операций, и сверка балансов с историей на нём до сих
  // пор не сходится. Монеты, если понадобятся, переводим со счёта платформы.
  const second = req.query.who === "2";
  const testUser = await prisma.user.upsert({
    where: { telegramId: second ? "screenshotter_002" : "screenshotter_001" },
    create: second
      ? {
          telegramId: "screenshotter_002",
          firstName: "Screenshot",
          lastName: "Two",
          username: "screenshotter2",
          balance: BigInt(0),
          elo: 1200,
        }
      : {
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
