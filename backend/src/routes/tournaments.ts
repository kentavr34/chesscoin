import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/middleware/auth";
import { updateBalance } from "@/services/economy";
import { TransactionType } from "@prisma/client";
import config from "@/config";

const router = Router();
router.use(authMiddleware);

// GET /tournaments — список активных турниров
router.get("/", async (req, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      where: { status: { in: ["REGISTRATION", "IN_PROGRESS"] } },
      include: {
        _count: { select: { players: true } },
        players: {
          where: { userId: req.userId },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    res.json({
      tournaments: tournaments.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        entryFee: t.entryFee.toString(),
        maxPlayers: t.maxPlayers,
        currentPlayers: t._count.players,
        status: t.status,
        startAt: t.startAt,
        prizePool: t.prizePool.toString(),
        isJoined: t.players.length > 0,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /tournaments/:id — детали турнира
router.get("/:id", async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, firstName: true, username: true, elo: true, avatar: true, avatarGradient: true },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
        matches: { orderBy: [{ round: "asc" }, { matchOrder: "asc" }] },
      },
    });

    if (!tournament) return res.status(404).json({ error: "NOT_FOUND" });

    res.json({ tournament });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /tournaments/:id/join — вступить в турнир
router.post("/:id/join", async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { players: true } } },
    });

    if (!tournament) return res.status(404).json({ error: "NOT_FOUND" });
    if (tournament.status !== "REGISTRATION") {
      return res.status(400).json({ error: "REGISTRATION_CLOSED" });
    }
    if (tournament._count.players >= tournament.maxPlayers) {
      return res.status(400).json({ error: "TOURNAMENT_FULL" });
    }

    // Проверяем не участвует ли уже
    const existing = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: req.userId } },
    });
    if (existing) return res.status(400).json({ error: "ALREADY_JOINED" });

    // Списываем взнос
    if (tournament.entryFee > 0n) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
      if (user.balance < tournament.entryFee) {
        return res.status(400).json({ error: "INSUFFICIENT_BALANCE" });
      }
      await updateBalance(req.userId, -tournament.entryFee, TransactionType.TOURNAMENT_ENTRY, {
        tournamentId: tournament.id,
      });
      // Добавляем взнос в призовой фонд
      await prisma.tournament.update({
        where: { id: tournament.id },
        data: { prizePool: { increment: tournament.entryFee } },
      });
    }

    await prisma.tournamentPlayer.create({
      data: { tournamentId: tournament.id, userId: req.userId },
    });

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /tournaments — создать турнир (admin only)
router.post("/", async (req, res) => {
  try {
    const adminIds = (process.env.ADMIN_IDS ?? "254450353").split(",").map((s) => s.trim());
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId }, select: { telegramId: true } });
    if (!adminIds.includes(user.telegramId)) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    const { name, description, entryFee = "0", maxPlayers = 8, startAt } = req.body;
    if (!name) return res.status(400).json({ error: "NAME_REQUIRED" });

    const tournament = await prisma.tournament.create({
      data: {
        name,
        description,
        entryFee: BigInt(entryFee),
        maxPlayers: Math.min(64, Math.max(2, parseInt(maxPlayers))),
        startAt: startAt ? new Date(startAt) : undefined,
        createdBy: req.userId,
      },
    });

    res.json({ tournament });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
