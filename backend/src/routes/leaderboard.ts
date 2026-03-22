import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { authMiddleware, AuthRequest } from "@/middleware/auth";

const router = Router();

// GET /leaderboard?league=GOLD&limit=50&search=nick&sort=elo&period=all|week|month
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { league, limit, offset, search, sort, period } = z.object({
      league: z.string().optional(),
      limit:  z.coerce.number().min(1).max(200).default(50),
      offset: z.coerce.number().min(0).default(0),
      search: z.string().min(3).max(32).optional(),
      sort:   z.enum(["elo", "balance", "totalEarned"]).default("elo"),
      period: z.enum(["all", "week", "month"]).default("all"),
    }).parse(req.query);

    const userId = (req as AuthRequest).userId;

    // Fetch current user's elo once — used for rank calculation
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { elo: true },
    });
    const myElo = currentUser?.elo ?? 0;

    // User's global rank (always fresh, user-specific)
    const myRank =
      (await prisma.user.count({
        where: { isBanned: false, isBot: false, elo: { gt: myElo } },
      })) + 1;

    // Фильтр по периоду — через транзакции (приближение)
    let periodFilter: Record<string, unknown> = {};
    if (period === "week") {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      periodFilter = { lastLoginDate: { gte: since } };
    } else if (period === "month") {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      periodFilter = { lastLoginDate: { gte: since } };
    }

    const where = {
      isBanned: false,
      isBot: false,
      ...periodFilter,
      ...(league ? { league: league } : {}),
      ...(search ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { username:  { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
    };

    // Redis cache — only for non-search queries (cache key includes league/sort/limit/offset)
    const cacheKey = search
      ? null
      : `leaderboard:${sort}:${league ?? "all"}:${limit}:${offset}`;

    if (cacheKey) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return res.json({ ...parsed, myRank });
      }
    }

    // For large offsets, use cursor-based pagination to avoid slow SKIP scans.
    // We first grab the ID at `offset` position, then fetch from that cursor.
    let users;
    if (offset > 500) {
      // Get the cursor row: the single row at `offset` position
      const cursorRows = await prisma.user.findMany({
        where: where as any,
        orderBy: { [sort]: "desc" },
        take: 1,
        skip: offset,
        select: { id: true },
      });

      if (cursorRows.length > 0) {
        users = await prisma.user.findMany({
          where: where as any,
          orderBy: { [sort]: "desc" },
          take: limit,
          cursor: { id: cursorRows[0].id },
          select: {
            id: true, firstName: true, lastName: true, username: true,
            avatar: true, avatarGradient: true,
            elo: true, league: true, balance: true,
            isMonthlyChampion: true,
          },
        });
      } else {
        users = [];
      }
    } else {
      users = await prisma.user.findMany({
        where: where as any,
        orderBy: { [sort]: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true, firstName: true, lastName: true, username: true,
          avatar: true, avatarGradient: true,
          elo: true, league: true, balance: true,
          isMonthlyChampion: true,
        },
      });
    }

    const total = await prisma.user.count({ where: where as any });

    const payload = {
      total,
      myRank,
      users: users.map(u => ({ ...u, balance: u.balance.toString() })),
    };

    if (cacheKey) {
      await redis.set(cacheKey, JSON.stringify({ total, users: payload.users }), "EX", 60);
    }

    res.json(payload);
  } catch (err: unknown) {
    res.status(400).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

export default router;
