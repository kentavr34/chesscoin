import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { authMiddleware, AuthRequest } from "@/middleware/auth";

const router = Router();

// GET /leaderboard?league=GOLD&limit=50&search=nick&sort=elo
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { league, limit, offset, search, sort } = z.object({
      league: z.string().optional(),
      limit:  z.coerce.number().min(1).max(200).default(50),
      offset: z.coerce.number().min(0).default(0),
      search: z.string().min(3).max(32).optional(),
      sort:   z.enum(["elo", "balance", "totalEarned"]).default("elo"),
    }).parse(req.query);

    const userId = (req as AuthRequest).userId;

    const where = {
      isBanned: false,
      isBot: false,
      ...(league ? { league: league as any } : {}),
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
        // myRank is always fresh (user-specific)
        const myElo = (await prisma.user.findUnique({ where: { id: userId }, select: { elo: true } }))?.elo ?? 0;
        const myRank = await prisma.user.count({ where: { isBanned: false, isBot: false, elo: { gt: myElo } } });
        return res.json({ ...parsed, myRank: myRank + 1 });
      }
    }

    const [users, total, myRank] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { [sort]: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true, firstName: true, lastName: true, username: true,
          avatar: true, avatarGradient: true,
          elo: true, league: true, balance: true,
        },
      }),
      prisma.user.count({ where }),
      // Позиция текущего пользователя
      prisma.user.count({
        where: {
          isBanned: false, isBot: false,
          elo: { gt: (await prisma.user.findUnique({ where: { id: userId }, select: { elo: true } }))?.elo ?? 0 },
        },
      }),
    ]);

    const payload = {
      total,
      myRank: myRank + 1,
      users: users.map(u => ({ ...u, balance: u.balance.toString() })),
    };

    if (cacheKey) {
      await redis.set(cacheKey, JSON.stringify({ total, users: payload.users }), "EX", 60);
    }

    res.json(payload);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
