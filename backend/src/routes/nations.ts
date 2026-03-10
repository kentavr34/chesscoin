import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";

export const nationsRouter = Router();

// ─── GET /api/v1/nations/clans ────────────────────────────────────────────────
nationsRouter.get("/clans", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const clans = await prisma.clan.findMany({
      include: {
        _count: { select: { members: true } },
        members: {
          where: { userId },
          select: { role: true },
        },
      },
      orderBy: { elo: "desc" },
    });

    const result = clans.map((clan) => ({
      ...clan,
      myMembership: clan.members[0] ?? null,
      members: undefined, // убираем сырые члены
    }));

    res.json({ clans: result });
  } catch (err) {
    console.error("[nations/clans]", err);
    res.status(500).json({ error: "Ошибка загрузки сборных" });
  }
});

// ─── GET /api/v1/nations/wars ─────────────────────────────────────────────────
nationsRouter.get("/wars", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const wars = await prisma.clanWar.findMany({
      where: { status: "IN_PROGRESS" },
      include: {
        attackerClan: { select: { name: true, flag: true, countryCode: true } },
        defenderClan: { select: { name: true, flag: true, countryCode: true } },
      },
      orderBy: { startedAt: "desc" },
    });
    res.json({ wars });
  } catch (err) {
    console.error("[nations/wars]", err);
    res.status(500).json({ error: "Ошибка загрузки войн" });
  }
});

// ─── POST /api/v1/nations/join ────────────────────────────────────────────────
nationsRouter.post("/join", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { clanId } = req.body;
    if (!clanId) return res.status(400).json({ error: "clanId обязателен" });

    const userId = req.user!.id;

    // Проверяем клан
    const clan = await prisma.clan.findUnique({ where: { id: clanId } });
    if (!clan) return res.status(404).json({ error: "Сборная не найдена" });

    // Проверяем текущее членство
    const existing = await prisma.clanMember.findUnique({
      where: { userId },
    });
    if (existing) {
      if (existing.clanId === clanId)
        return res.status(409).json({ error: "Вы уже в этой сборной" });
      return res.status(409).json({ error: "Вы уже состоите в другой сборной" });
    }

    await prisma.clanMember.create({
      data: { clanId, userId, role: "SOLDIER" },
    });

    res.json({ success: true, clan: { id: clan.id, name: clan.name, flag: clan.flag } });
  } catch (err) {
    console.error("[nations/join]", err);
    res.status(500).json({ error: "Ошибка вступления в сборную" });
  }
});

// ─── POST /api/v1/nations/leave ───────────────────────────────────────────────
nationsRouter.post("/leave", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const membership = await prisma.clanMember.findUnique({ where: { userId } });
    if (!membership) return res.status(404).json({ error: "Вы не состоите в сборной" });

    // Командир не может покинуть без передачи полномочий (простая проверка)
    if (membership.role === "COMMANDER") {
      const otherMembers = await prisma.clanMember.count({
        where: { clanId: membership.clanId, userId: { not: userId } },
      });
      if (otherMembers > 0)
        return res.status(400).json({ error: "Передайте командование перед выходом" });
    }

    await prisma.clanMember.delete({ where: { userId } });

    res.json({ success: true });
  } catch (err) {
    console.error("[nations/leave]", err);
    res.status(500).json({ error: "Ошибка выхода из сборной" });
  }
});
