import { Router, Request, Response } from "express";
import { logger, logError } from "@/lib/logger";
import { z } from "zod";
import { loginWithTelegram, refreshAccessToken } from "@/services/auth";
import { authMiddleware, AuthRequest } from "@/middleware/auth";
import { checkAndRestoreUserAttempts, getSecondsUntilNextRestore } from "@/services/attempts";
import { prisma } from "@/lib/prisma";
import { checkDailyLoginTask } from "@/services/gameTasks"; // BUG #1 fix
import { redis } from "@/lib/redis";
import { getMilitaryRank, getRankBonuses } from "@/utils/militaryRank";
import { updateBalance } from "@/services/economy";
import { TransactionType } from "@prisma/client";
import { checkGameAchievements } from "@/services/achievements";

const router = Router();

// POST /auth/login — вход через Telegram initData
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { initData, referrer } = z
      .object({
        initData: z.string(),
        referrer: z.string().optional(),
      })
      .parse(req.body);

    const result = await loginWithTelegram(initData, referrer);
    res.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: formatUser(result.user),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[Auth/login] Error: " + msg);
    if (err instanceof Error && err.stack) logger.error("[Auth/login] Stack: " + err.stack.split('\n').slice(0,3).join(' | '));
    res.status(401).json({ error: msg });
  }
});

// POST /auth/refresh
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = z
      .object({ refreshToken: z.string() })
      .parse(req.body);

    const result = await refreshAccessToken(refreshToken);
    res.json(result);
  } catch (err: unknown) {
    res.status(401).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// GET /auth/me — текущий пользователь
router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;

    // Восстанавливаем попытки при каждом входе
    await checkAndRestoreUserAttempts(userId);

    // Обновляем login streak
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const currentUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { loginStreak: true, lastLoginDate: true },
    });
    const lastLogin = currentUser.lastLoginDate?.toDateString();
    let newStreak = currentUser.loginStreak;
    if (lastLogin !== today) {
      newStreak = lastLogin === yesterday ? (currentUser.loginStreak ?? 0) + 1 : 1;
      await prisma.user.update({
        where: { id: userId },
        data: { loginStreak: newStreak, lastLoginDate: new Date() },
      });

      // BUG #1 fix: проверяем задание DAILY_LOGIN (fire-and-forget)
      setImmediate(() => checkDailyLoginTask(userId).catch(() => {}));

      // Бонусы за стрик
      const STREAK_BONUSES: Record<number, bigint> = {
        3:  500n,
        7:  2000n,
        14: 5000n,
        30: 10000n,
        100: 50000n,
      };
      if (STREAK_BONUSES[newStreak]) {
        try {
          await updateBalance(userId, STREAK_BONUSES[newStreak], TransactionType.TASK_REWARD, {
            streakBonus: newStreak,
          }, { isEmission: true });
        } catch (e) {
          logger.error('[Auth/Streak] bonus error:', e);
        }
      }
      // Проверяем streak достижения fire-and-forget
      setImmediate(() => checkGameAchievements(userId).catch((err) => logError("[catch]", err)));
    }

    // Opt-3: Redis кеш данных пользователя (30 сек)
    // Инвалидируется в updateBalance, equip, wallet connect
    const cacheKey = `user:me:${userId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    } catch {} // Redis unavailable — continue without cache

    const fullUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        activeSessions: {
          select: {
            id: true,
            type: true,
            status: true,
            fen: true,
            bet: true,
            botLevel: true,
            sides: {
              select: {
                isWhite: true,
                timeLeft: true,
                isBot: true,
                player: { select: { firstName: true, avatar: true } },
              },
            },
          },
        },
        inventory: {
          where: { isEquipped: true },
          select: {
            isEquipped: true,
            item: { select: { id: true, type: true, name: true, imageUrl: true } },
          },
        },
      },
    });

    const meResult = formatUser(fullUser);
    // Кешируем на 30 секунд
    try { await redis.setex(cacheKey, 30, JSON.stringify(meResult)); } catch {}
    res.json(meResult);
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// ─── Форматирование ───────────────────────────────

const formatUser = (user: any) => ({
  id: user.id,
  telegramId: user.telegramId,
  firstName: user.firstName,
  lastName: user.lastName,
  username: user.username,
  language: user.language,
  avatar: user.avatar,
  avatarType: user.avatarType,
  avatarGradient: user.avatarGradient,
  balance: user.balance?.toString() ?? "0",
  totalEarned: user.totalEarned?.toString() ?? "0",
  totalSpent: user.totalSpent?.toString() ?? "0",
  attempts: user.attempts,
  maxAttempts: user.maxAttempts,
  attemptSlots: user.attemptSlots,
  nextRestoreSeconds: (user.attempts ?? 0) < (user.maxAttempts ?? 0) ? getSecondsUntilNextRestore() : 0,
  elo: user.elo,
  league: user.league,
  totalGames: user.totalGames ?? 0,
  wins: user.wins ?? 0,
  losses: user.losses ?? 0,
  draws: user.draws ?? 0,
  winStreak: user.winStreak ?? 0,
  isBanned: user.isBanned ?? false,
  activeSessions: user.activeSessions ?? [],
  jarvisLevel: user.jarvisLevel ?? 1,
  jarvisBadges: user.jarvisBadges ?? [],
  jarvisBadgeDates: user.jarvisBadgeDates ?? {},
  loginStreak: user.loginStreak ?? 0,
  referralCode: user.referralCode,
  nationId: user.nationId,
  // Военное звание
  referralCount: user.referralCount ?? 0,
  teamSize: user.referralCount ?? 0,
  militaryRank: (() => {
    const count = user.referralCount ?? 0;
    const r = getMilitaryRank(count);
    const bonuses = getRankBonuses(count);
    return {
      rank: r.rank,
      label: r.label,
      emoji: r.emoji,
      minMembers: r.minMembers,
      activationBonus: bonuses.activationBonus.toString(),
      l1Percent: bonuses.l1Percent,
    };
  })(),
  createdAt: user.createdAt,
  hasSeenWarsIntro: user.hasSeenWarsIntro ?? false,
  activeTheme: user.activeTheme ?? 'default',
  equippedItems: user.inventory.reduce((acc: Record<string, unknown>, ui) => {
    acc[ui.item.type] = { id: ui.item.id, name: ui.item.name, imageUrl: ui.item.imageUrl };
    return acc;
  }, {}),
});

export default router;
