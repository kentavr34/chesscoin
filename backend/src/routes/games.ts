import { Router, Request, Response } from "express";
import { authMiddleware, AuthRequest } from "@/middleware/auth";
import { prisma } from "@/lib/prisma";

const router = Router();

// GET /games/saved — сохранённые партии пользователя
router.get("/saved", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const limit = parseInt(req.query.limit as string ?? "20");
  const offset = parseInt(req.query.offset as string ?? "0");

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
});

// POST /games/:sessionId/save — сохранить партию
router.post("/:sessionId/save", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { sessionId } = req.params;

  // Проверяем что сессия существует и пользователь в ней участвовал
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, sides: { select: { playerId: true } } },
  });

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const isParticipant = session.sides.some((s: any) => s.playerId === userId);
  if (!isParticipant) {
    return res.status(403).json({ error: "Not a participant" });
  }

  await prisma.savedGame.upsert({
    where: { userId_sessionId: { userId, sessionId } },
    create: { userId, sessionId },
    update: { savedAt: new Date() },
  });

  res.json({ saved: true });
});

// DELETE /games/:sessionId/save — убрать из сохранённых
router.delete("/:sessionId/save", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { sessionId } = req.params;

  await prisma.savedGame.deleteMany({ where: { userId, sessionId } });

  res.json({ saved: false });
});

// GET /games/:sessionId/saved — проверить сохранена ли партия
router.get("/:sessionId/saved", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { sessionId } = req.params;

  const saved = await prisma.savedGame.findUnique({
    where: { userId_sessionId: { userId, sessionId } },
  });

  res.json({ saved: !!saved });
});

export default router;
