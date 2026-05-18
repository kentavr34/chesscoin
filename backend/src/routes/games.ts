import { Router, Request, Response } from "express";
import { authMiddleware, AuthRequest } from "@/middleware/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getIo } from "@/lib/io";
import { redis } from "@/lib/redis";

const router = Router();

// PR-3 hotfix Кенан 2026-05-18: GET /games/public-history — общая лента
// ВСЕХ завершённых публичных партий (любых юзеров). Используется в
// BattleHistoryPage вкладка «Публичные» — юзер может листать чужие партии
// как чтиво/просмотр. Только публичные (isPrivate=false), только финиш.
router.get("/public-history", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 50);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const sessions = await prisma.session.findMany({
      where: {
        type: "BATTLE",
        isPrivate: false,
        status: { in: ["FINISHED", "DRAW", "TIME_EXPIRED"] },
      },
      orderBy: { finishedAt: "desc" },
      skip: offset,
      take: limit,
      select: {
        id: true, fen: true, pgn: true, status: true, type: true,
        bet: true, duration: true, startedAt: true, finishedAt: true,
        sourceType: true, shareToken: true,
        sides: {
          select: {
            isWhite: true, status: true, isBot: true,
            winningAmount: true,
            player: {
              select: { id: true, firstName: true, lastName: true, username: true, avatar: true, avatarGradient: true, avatarType: true, elo: true },
            },
          },
        },
      } as any,
    });

    const total = await prisma.session.count({
      where: {
        type: "BATTLE",
        isPrivate: false,
        status: { in: ["FINISHED", "DRAW", "TIME_EXPIRED"] },
      },
    });

    res.json({
      total,
      games: sessions.map((s: any) => {
        const winnerSide = s.sides.find((x: any) => x.status === 'WON');
        const loserSide = s.sides.find((x: any) => x.status === 'LOST');
        return {
          sessionId: s.id,
          type: s.type,
          status: s.status,
          fen: s.fen,
          pgn: s.pgn,
          bet: s.bet?.toString() ?? null,
          duration: s.duration,
          startedAt: s.startedAt,
          finishedAt: s.finishedAt,
          sourceType: s.sourceType ?? null,
          shareToken: s.shareToken ?? null,
          winner: winnerSide?.player ?? null,
          loser:  loserSide?.player ?? null,
          isDraw: !winnerSide && !loserSide,
          payout: winnerSide?.winningAmount?.toString() ?? null,
        };
      }),
    });
  } catch (err) {
    logger.error("[games/public-history]", err instanceof Error ? err.message : String(err));
    res.status(500).json({ error: "Internal server error" });
  }
});

// PR-3 hotfix Кенан 2026-05-18: GET /games/spectate/:sessionId — зритель
// публичной партии (клик «СМОТРЕТЬ» на live-карточке). Раньше GamePage
// получал null из store т.к. user не участник и session не загружена через
// /auth/me → бесконечный лоадер. Теперь публично достаём по id, проверяем
// что партия не приватная (приватные смотреть нельзя).
router.get("/spectate/:sessionId", async (req: Request, res: Response) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.sessionId },
      include: {
        sides: {
          include: {
            player: {
              select: {
                id: true, firstName: true, lastName: true, username: true,
                avatar: true, avatarType: true, avatarGradient: true, elo: true, league: true,
                countryMember: { select: { country: { select: { code: true } } } },
              },
            },
          },
        },
      },
    });
    if (!session) return res.status(404).json({ error: "SESSION_NOT_FOUND" });
    if (session.isPrivate) return res.status(403).json({ error: "SESSION_PRIVATE" });

    // Формируем как formatSession, но без mySide (зритель не участник).
    const formatSide = (s: any) => ({
      id: s.id, playerId: s.playerId, isWhite: s.isWhite, isBot: s.isBot,
      status: s.status, eatenPieces: s.eatenPieces,
      winningAmount: s.winningAmount?.toString() ?? null, timeLeft: s.timeLeft,
      player: {
        id: s.player.id, firstName: s.player.firstName, lastName: s.player.lastName,
        username: s.player.username, avatar: s.player.avatar,
        avatarType: s.player.avatarType, avatarGradient: s.player.avatarGradient,
        elo: s.player.elo, league: s.player.league,
        country: s.player.countryMember?.country?.code ?? null,
      },
    });
    res.json({
      session: {
        id: session.id, code: session.code, type: session.type, status: session.status,
        fen: session.fen, pgn: session.pgn,
        bet: session.bet?.toString() ?? null, botLevel: session.botLevel,
        currentSideId: session.currentSideId, winnerSideId: session.winnerSideId,
        isPrivate: session.isPrivate,
        startedAt: session.startedAt, finishedAt: session.finishedAt,
        sides: session.sides.map(formatSide),
        isMyTurn: null, mySideId: null, // зритель
        donationPool: session.donationPool?.toString() ?? "0",
        duration: (session as any).duration ?? null,
        sourceType: (session as any).sourceType ?? null,
        shareToken: (session as any).shareToken ?? null,
      },
    });
  } catch (err) {
    logger.error("[games/spectate]", err instanceof Error ? err.message : String(err));
    res.status(500).json({ error: "Internal server error" });
  }
});

// PR-2: GET /games/by-share/:token — публичная точка просмотра партии.
// Возвращает сессию любого статуса (WAITING / IN_PROGRESS / FINISHED) с
// полным PGN, бойцами и метаданными для зрителя. Без auth: deep-link
// должны открывать незарегистрированные посетители тоже. Если IN_PROGRESS,
// клиент сам подпишется на socket-комнату spectate:<sessionId>.
router.get("/by-share/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const session = await (prisma.session as any).findUnique({
      where: { shareToken: token },
      include: {
        sides: {
          include: {
            player: {
              select: {
                id: true, firstName: true, lastName: true, username: true,
                avatar: true, avatarType: true, avatarGradient: true, elo: true, league: true,
                countryMember: { select: { country: { select: { code: true, nameRu: true, flag: true } } } },
              },
            },
          },
        },
      },
    });
    if (!session) return res.status(404).json({ error: "SHARE_TOKEN_NOT_FOUND" });

    // Top-donor по сторонам — Redis sorted-set (заполняется в battle:donate).
    const donorsBySide: Record<string, { userId: string; amount: string } | null> = {};
    for (const side of session.sides) {
      try {
        const top = await redis.zrevrange(`donors:${session.id}:${side.id}`, 0, 0, "WITHSCORES");
        if (top.length >= 2) donorsBySide[side.id] = { userId: top[0]!, amount: top[1]! };
        else donorsBySide[side.id] = null;
      } catch {
        donorsBySide[side.id] = null;
      }
    }

    res.json({
      session: {
        id: session.id,
        shareToken: session.shareToken,
        status: session.status,
        type: session.type,
        sourceType: session.sourceType,
        sourceRefId: session.sourceRefId,
        deadlineAt: session.deadlineAt,
        acceptedByAll: session.acceptedByAll,
        fen: session.fen,
        pgn: session.pgn,
        bet: session.bet?.toString() ?? null,
        duration: session.duration,
        currentSideId: session.currentSideId,
        winnerSideId: session.winnerSideId,
        startedAt: session.startedAt,
        finishedAt: session.finishedAt,
        donationPool: session.donationPool?.toString() ?? "0",
        sides: session.sides.map((s: any) => ({
          id: s.id,
          isWhite: s.isWhite,
          isBot: s.isBot,
          status: s.status,
          timeLeft: s.timeLeft,
          winningAmount: s.winningAmount?.toString() ?? null,
          player: {
            id: s.player.id,
            firstName: s.player.firstName,
            lastName: s.player.lastName,
            username: s.player.username,
            avatar: s.player.avatar,
            avatarType: s.player.avatarType,
            avatarGradient: s.player.avatarGradient,
            elo: s.player.elo,
            league: s.player.league,
            country: s.player.countryMember?.country ?? null,
          },
          topDonor: donorsBySide[s.id],
        })),
      },
    });
  } catch (err) {
    logger.error("[games/by-share]", err instanceof Error ? err.message : String(err));
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /games/saved — сохранённые партии пользователя
router.get("/saved", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const saved = await prisma.savedGame.findMany({
      where: { userId },
      orderBy: { savedAt: "desc" },
      skip: offset,
      take: limit,
      include: {
        session: {
          select: {
            id: true,
            type: true,
            status: true,
            pgn: true,
            fen: true,
            bet: true,
            botLevel: true,
            startedAt: true,
            finishedAt: true,
            sides: {
              select: {
                isWhite: true,
                status: true,
                winningAmount: true,
                isBot: true,
                player: {
                  select: { id: true, firstName: true, lastName: true, username: true, avatar: true, avatarGradient: true, elo: true },
                },
              },
            },
          },
        },
      },
    });

    res.json(saved.map((s: any) => ({
      savedAt: s.savedAt,
      session: {
        id: s.session.id,
        type: s.session.type,
        status: s.session.status,
        pgn: s.session.pgn,
        fen: s.session.fen,
        bet: s.session.bet?.toString() ?? null,
        botLevel: s.session.botLevel,
        startedAt: s.session.startedAt,
        finishedAt: s.session.finishedAt,
        sides: s.session.sides,
      },
    })));
  } catch (err) {
    logger.error("[games] GET /saved error:", (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /games/:sessionId/save — сохранить партию
// 2026-05-19 (Кенан): сохранять можно ЛЮБУЮ партию (свою и чужую) после её
// окончания. Раньше требовалось быть участником, из-за чего нельзя было
// добавить в избранное чужой матч из PGN-просмотра/архива.
router.post("/:sessionId/save", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { sessionId } = req.params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    await prisma.savedGame.upsert({
      where: { userId_sessionId: { userId, sessionId } },
      create: { userId, sessionId },
      update: { savedAt: new Date() },
    });

    // Broadcast live-обновление счётчика сохранений зрителям (шапка GamePage)
    try {
      const count = await prisma.savedGame.count({ where: { sessionId } });
      getIo().to(sessionId).emit("game:saves-count", { sessionId, count });
      getIo().to(`spectate:${sessionId}`).emit("game:saves-count", { sessionId, count });
    } catch {}

    res.json({ saved: true });
  } catch (err) {
    logger.error("[games] POST /save error:", (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /games/:sessionId/save — убрать из сохранённых
router.delete("/:sessionId/save", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { sessionId } = req.params;

    await prisma.savedGame.deleteMany({ where: { userId, sessionId } });

    try {
      const count = await prisma.savedGame.count({ where: { sessionId } });
      getIo().to(sessionId).emit("game:saves-count", { sessionId, count });
      getIo().to(`spectate:${sessionId}`).emit("game:saves-count", { sessionId, count });
    } catch {}

    res.json({ saved: false });
  } catch (err) {
    logger.error("[games] DELETE /save error:", (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /games/:sessionId/saved — проверить сохранена ли партия
router.get("/:sessionId/saved", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { sessionId } = req.params;

    const saved = await prisma.savedGame.findUnique({
      where: { userId_sessionId: { userId, sessionId } },
    });

    res.json({ saved: !!saved });
  } catch (err) {
    logger.error("[games] GET /saved check error:", (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /games/:sessionId/saves/count — сколько раз партию сохраняли (для шапки
// зрителя публичного батла, 2026-05-16).
router.get("/:sessionId/saves/count", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const count = await prisma.savedGame.count({ where: { sessionId } });
    res.json({ count });
  } catch (err) {
    logger.error("[games] GET /saves/count error:", (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
