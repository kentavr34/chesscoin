import { Router, Request, Response } from "express";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/middleware/auth";
import { updateBalance } from "@/services/economy";
import { TransactionType, CountryWarStatus } from "@prisma/client";
import { io } from "@/index";

export const warsRouter = Router();

// ── Вспомогательная: Главнокомандующий страны ────────────────────────────────
async function getCommander(countryId: string): Promise<string | null> {
  const top = await prisma.countryMember.findFirst({
    where: { countryId },
    orderBy: [{ warWins: "desc" }, { joinedAt: "asc" }],
    select: { userId: true },
  });
  return top?.userId ?? null;
}

// ── Форматирование страны ────────────────────────────────────────────────────
function fmtCountry(c: any, myMembership: any, commanderId: string | null) {
  return {
    id: c.id,
    code: c.code,
    nameRu: c.nameRu,
    nameEn: c.nameEn,
    flag: c.flag,
    treasury: c.treasury.toString(),
    wins: c.wins,
    losses: c.losses,
    maxMembers: c.maxMembers,
    memberCount: c._count?.members ?? 0,
    commanderId,
    myMembership: myMembership ?? null,
    activeWar: null, // заполняется отдельно при необходимости
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /wars/countries — список всех стран
// ─────────────────────────────────────────────────────────────────────────────
warsRouter.get("/countries", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sort = req.query.sort as string; // "wins" | "alpha"

    const countries = await prisma.country.findMany({
      include: {
        _count: { select: { members: true } },
        members: { where: { userId }, select: { id: true, warWins: true, warLosses: true, joinedAt: true } },
      },
      orderBy: sort === "alpha"
        ? [{ nameRu: "asc" }]
        : [{ wins: "desc" }, { nameRu: "asc" }],
    });

    const result = await Promise.all(
      countries.map(async (c) => {
        const commanderId = await getCommander(c.id);
        return fmtCountry(c, c.members[0] ?? null, commanderId);
      })
    );

    res.json({ countries: result });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /wars/countries/:id — страница страны + бойцы
// ─────────────────────────────────────────────────────────────────────────────
warsRouter.get("/countries/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const country = await prisma.country.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!country) return res.status(404).json({ error: "Country not found" });

    // Бойцы: Главнокомандующий первым
    const members = await prisma.countryMember.findMany({
      where: { countryId: id },
      orderBy: [{ warWins: "desc" }, { joinedAt: "asc" }],
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, username: true, elo: true, league: true, avatar: true, avatarType: true, avatarGradient: true },
        },
      },
    });

    const commanderId = members[0]?.userId ?? null;

    const myMembership = members.find((m) => m.userId === userId) ?? null;

    // Активная война
    const activeWar = await prisma.countryWar.findFirst({
      where: {
        status: "IN_PROGRESS",
        OR: [{ attackerCountryId: id }, { defenderCountryId: id }],
      },
      include: {
        attackerCountry: { select: { id: true, code: true, nameRu: true, nameEn: true, flag: true } },
        defenderCountry: { select: { id: true, code: true, nameRu: true, nameEn: true, flag: true } },
      },
    });

    const fmtMembers = members.map((m, i) => ({
      id: m.id,
      userId: m.userId,
      warWins: m.warWins,
      warLosses: m.warLosses,
      joinedAt: m.joinedAt,
      isCommander: i === 0,
      user: m.user,
    }));

    res.json({
      country: {
        ...fmtCountry(country, myMembership ? { warWins: myMembership.warWins, warLosses: myMembership.warLosses, joinedAt: myMembership.joinedAt } : null, commanderId),
        activeWar,
      },
      members: fmtMembers,
      isCommander: commanderId === userId,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /wars/my-country — моя страна + статус бойца
// ─────────────────────────────────────────────────────────────────────────────
warsRouter.get("/my-country", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const membership = await prisma.countryMember.findUnique({
      where: { userId },
      include: {
        country: { include: { _count: { select: { members: true } } } },
      },
    });

    if (!membership) return res.json({ country: null, membership: null, isCommander: false });

    const commanderId = await getCommander(membership.countryId);
    const isCommander = commanderId === userId;

    const activeWar = await prisma.countryWar.findFirst({
      where: {
        status: "IN_PROGRESS",
        OR: [
          { attackerCountryId: membership.countryId },
          { defenderCountryId: membership.countryId },
        ],
      },
      include: {
        attackerCountry: { select: { id: true, code: true, nameRu: true, nameEn: true, flag: true } },
        defenderCountry: { select: { id: true, code: true, nameRu: true, nameEn: true, flag: true } },
        _count: { select: { battles: true } },
      },
    });

    res.json({
      country: fmtCountry(membership.country, null, commanderId),
      membership: {
        id: membership.id,
        warWins: membership.warWins,
        warLosses: membership.warLosses,
        joinedAt: membership.joinedAt,
      },
      isCommander,
      activeWar,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /wars/countries/:id/join — вступить в страну
// ─────────────────────────────────────────────────────────────────────────────
warsRouter.post("/countries/:id/join", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const country = await prisma.country.findUnique({ where: { id }, include: { _count: { select: { members: true } } } });
    if (!country) return res.status(404).json({ error: "Country not found" });

    if (country._count.members >= country.maxMembers) {
      return res.status(400).json({ error: "Country is full (max 1000 fighters)" });
    }

    // Проверить — уже есть членство в какой-то стране?
    const existing = await prisma.countryMember.findUnique({ where: { userId } });
    if (existing) {
      if (existing.countryId === id) return res.status(400).json({ error: "Already in this country" });
      // Нельзя покинуть страну, если она участвует в активной войне
      const activeWar = await (prisma as any).countryWar.findFirst({
        where: {
          status: "IN_PROGRESS",
          OR: [{ attackerCountryId: existing.countryId }, { defenderCountryId: existing.countryId }],
        },
      });
      if (activeWar) return res.status(400).json({ error: "Cannot transfer during active war" });
      // Выходим из старой страны (трансфер)
      await prisma.countryMember.delete({ where: { userId } });
    }

    const member = await prisma.countryMember.create({
      data: { countryId: id, userId },
    });

    res.json({ success: true, membership: { id: member.id, warWins: 0, warLosses: 0, joinedAt: member.joinedAt } });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /wars/leave — покинуть страну
// ─────────────────────────────────────────────────────────────────────────────
warsRouter.post("/leave", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const existing = await prisma.countryMember.findUnique({ where: { userId } });
    if (!existing) return res.status(400).json({ error: "Not in any country" });

    // Нельзя покинуть страну во время активной войны
    const activeWar = await (prisma as any).countryWar.findFirst({
      where: {
        status: "IN_PROGRESS",
        OR: [{ attackerCountryId: existing.countryId }, { defenderCountryId: existing.countryId }],
      },
    });
    if (activeWar) return res.status(400).json({ error: "Cannot leave during active war" });

    await prisma.countryMember.delete({ where: { userId } });

    res.json({ success: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /wars/intro-seen — отметить просмотр вводного окна
// ─────────────────────────────────────────────────────────────────────────────
warsRouter.post("/intro-seen", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    await prisma.user.update({ where: { id: userId }, data: { hasSeenWarsIntro: true } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /wars/active — активные войны (для всех)
// ─────────────────────────────────────────────────────────────────────────────
warsRouter.get("/active", authMiddleware, async (req: Request, res: Response) => {
  try {
    const wars = await prisma.countryWar.findMany({
      where: { status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
      include: {
        attackerCountry: { select: { id: true, code: true, nameRu: true, nameEn: true, flag: true, wins: true } },
        defenderCountry: { select: { id: true, code: true, nameRu: true, nameEn: true, flag: true, wins: true } },
        _count: { select: { battles: true } },
      },
    });

    res.json({ wars: wars.map(formatWar) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /wars/history — завершённые войны
// ─────────────────────────────────────────────────────────────────────────────
warsRouter.get("/history", authMiddleware, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const wars = await prisma.countryWar.findMany({
      where: { status: "FINISHED" },
      orderBy: { finishedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        attackerCountry: { select: { id: true, code: true, nameRu: true, nameEn: true, flag: true } },
        defenderCountry: { select: { id: true, code: true, nameRu: true, nameEn: true, flag: true } },
        _count: { select: { battles: true } },
      },
    });

    res.json({ wars: wars.map(formatWar) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /wars/:warId — детали войны + партии
// ─────────────────────────────────────────────────────────────────────────────
warsRouter.get("/:warId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { warId } = req.params;

    const war = await prisma.countryWar.findUnique({
      where: { id: warId },
      include: {
        attackerCountry: { select: { id: true, code: true, nameRu: true, nameEn: true, flag: true } },
        defenderCountry: { select: { id: true, code: true, nameRu: true, nameEn: true, flag: true } },
        battles: {
          orderBy: { createdAt: "desc" },
          include: {
            session: {
              select: {
                id: true, pgn: true, fen: true, status: true, finishedAt: true,
                sides: { include: { player: { select: { id: true, firstName: true, lastName: true, avatar: true, avatarType: true, avatarGradient: true, elo: true } } } },
              },
            },
          },
        },
      },
    });

    if (!war) return res.status(404).json({ error: "War not found" });

    res.json({ war: { ...formatWar(war), battles: war.battles } });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /wars/declare — объявить войну (только Главнокомандующий)
// ─────────────────────────────────────────────────────────────────────────────
warsRouter.post("/declare", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { defenderCountryId, duration } = req.body; // duration in seconds

    if (!defenderCountryId || !duration) return res.status(400).json({ error: "defenderCountryId and duration required" });

    // Проверить что пользователь в стране и является Главнокомандующим
    const membership = await prisma.countryMember.findUnique({ where: { userId } });
    if (!membership) return res.status(403).json({ error: "You are not in any country" });

    const commanderId = await getCommander(membership.countryId);
    if (commanderId !== userId) return res.status(403).json({ error: "Only the Commander-in-Chief can declare war" });

    if (membership.countryId === defenderCountryId) return res.status(400).json({ error: "Cannot declare war on your own country" });

    // Проверить — нет ли уже активной войны у атакующей страны
    const existingWar = await prisma.countryWar.findFirst({
      where: {
        status: "IN_PROGRESS",
        OR: [
          { attackerCountryId: membership.countryId },
          { defenderCountryId: membership.countryId },
        ],
      },
    });
    if (existingWar) return res.status(400).json({ error: "Your country is already at war" });

    // Проверить — нет ли уже активной войны у защищающейся страны
    const defenderWar = await prisma.countryWar.findFirst({
      where: {
        status: "IN_PROGRESS",
        OR: [
          { attackerCountryId: defenderCountryId },
          { defenderCountryId: defenderCountryId },
        ],
      },
    });
    if (defenderWar) return res.status(400).json({ error: "Defender country is already at war" });

    const defenderCountry = await prisma.country.findUnique({ where: { id: defenderCountryId } });
    if (!defenderCountry) return res.status(404).json({ error: "Defender country not found" });

    const endAt = new Date(Date.now() + duration * 1000);

    const war = await prisma.countryWar.create({
      data: {
        attackerCountryId: membership.countryId,
        defenderCountryId,
        duration,
        endAt,
        declaredByUserId: userId,
        prizePerWin: 100,
      },
      include: {
        attackerCountry: { select: { id: true, code: true, nameRu: true, nameEn: true, flag: true } },
        defenderCountry: { select: { id: true, code: true, nameRu: true, nameEn: true, flag: true } },
      },
    });

    // Уведомить Главнокомандующего страны-противника
    const defenderCommanderId = await getCommander(defenderCountryId);
    if (defenderCommanderId) {
      try {
        io.emit(`user:${defenderCommanderId}`, {
          type: "war:declared",
          war: formatWar(war),
          message: `${war.attackerCountry.nameRu} объявила войну вашей стране!`,
        });
      } catch {}
      // Bot notification для Главнокомандующего защитников
      const defenderCommander = await prisma.user.findUnique({ where: { id: defenderCommanderId }, select: { telegramId: true, firstName: true } });
      if (defenderCommander?.telegramId) {
        await prisma.adminNotification.create({
          data: {
            type: "WAR_DECLARED",
            payload: {
              telegramId: defenderCommander.telegramId,
              attackerName: war.attackerCountry.nameRu,
              attackerFlag: war.attackerCountry.flag,
              defenderName: war.defenderCountry.nameRu,
              defenderFlag: war.defenderCountry.flag,
              endAt: war.endAt.toISOString(),
            },
          },
        }).catch(() => {});
      }
    }

    // Уведомить всех бойцов атакующей страны
    const attackerMembers = await prisma.countryMember.findMany({
      where: { countryId: membership.countryId },
      select: { userId: true },
    });
    for (const m of attackerMembers) {
      try {
        io.emit(`user:${m.userId}`, {
          type: "war:started",
          war: formatWar(war),
        });
      } catch {}
    }

    // Уведомить всех бойцов защищающейся страны через бота
    const defenderMembers = await prisma.countryMember.findMany({
      where: { countryId: defenderCountryId },
      select: { userId: true },
    });
    const allWarMembers = [...attackerMembers, ...defenderMembers];
    for (const m of allWarMembers) {
      const member = await prisma.user.findUnique({ where: { id: m.userId }, select: { telegramId: true } });
      if (member?.telegramId) {
        await prisma.adminNotification.create({
          data: {
            type: "WAR_STARTED",
            payload: {
              telegramId: member.telegramId,
              attackerName: war.attackerCountry.nameRu,
              attackerFlag: war.attackerCountry.flag,
              defenderName: war.defenderCountry.nameRu,
              defenderFlag: war.defenderCountry.flag,
              endAt: war.endAt.toISOString(),
            },
          },
        }).catch(() => {});
      }
    }

    res.json({ success: true, war: formatWar(war) });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /wars/:warId/challenge — вызвать бойца в рамках войны
// ─────────────────────────────────────────────────────────────────────────────
warsRouter.post("/:warId/challenge", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { warId } = req.params;
    const { opponentUserId } = req.body;

    if (!opponentUserId) return res.status(400).json({ error: "opponentUserId required" });

    const war = await prisma.countryWar.findUnique({ where: { id: warId } });
    if (!war || war.status !== "IN_PROGRESS") return res.status(400).json({ error: "War not active" });

    if (new Date() > war.endAt) return res.status(400).json({ error: "War has ended" });

    // Проверить что пользователь боец в одной из стран
    const myMembership = await prisma.countryMember.findUnique({ where: { userId } });
    if (!myMembership) return res.status(403).json({ error: "You are not in any country" });

    const isAttacker = myMembership.countryId === war.attackerCountryId;
    const isDefender = myMembership.countryId === war.defenderCountryId;
    if (!isAttacker && !isDefender) return res.status(403).json({ error: "Your country is not in this war" });

    // Проверить что opponent — боец страны-противника
    const opponentMembership = await prisma.countryMember.findUnique({ where: { userId: opponentUserId } });
    if (!opponentMembership) return res.status(400).json({ error: "Opponent is not in any country" });

    const expectedOpponentCountry = isAttacker ? war.defenderCountryId : war.attackerCountryId;
    if (opponentMembership.countryId !== expectedOpponentCountry) {
      return res.status(400).json({ error: "Opponent is not fighting for the enemy country" });
    }

    // Создать сессию (обычный батл, но без ставки и без попыток)
    const Chess = require("chess.js").Chess;
    const chess = new Chess();

    const session = await prisma.session.create({
      data: {
        status: "WAITING_FOR_OPPONENT",
        type: "BATTLE",
        fen: chess.fen(),
        pgn: "",
        sides: {
          create: [
            { playerId: userId, status: "WAITING_FOR_OPPONENT", isWhite: true },
          ],
        },
        activeUsers: { connect: [{ id: userId }] },
      },
    });

    // Связать с войной
    await prisma.warBattle.create({
      data: {
        warId,
        sessionId: session.id,
        attackerId: isAttacker ? userId : opponentUserId,
        defenderId: isAttacker ? opponentUserId : userId,
        attackerCountryId: war.attackerCountryId,
        defenderCountryId: war.defenderCountryId,
      },
    });

    // Уведомить оппонента
    try {
      io.emit(`user:${opponentUserId}`, {
        type: "war:challenge",
        sessionId: session.id,
        warId,
        challengerUserId: userId,
        message: "Вас вызвали на военную дуэль!",
      });
    } catch {}

    res.json({ success: true, sessionId: session.id });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /wars/games/:sessionId/save — сохранить партию в профиль
// ─────────────────────────────────────────────────────────────────────────────
warsRouter.post("/games/:sessionId/save", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const saved = await prisma.savedGame.upsert({
      where: { userId_sessionId: { userId, sessionId } },
      update: {},
      create: { userId, sessionId },
    });

    res.json({ success: true, savedGame: { id: saved.id, savedAt: saved.savedAt } });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /wars/games/:sessionId/save — убрать из сохранённых
// ─────────────────────────────────────────────────────────────────────────────
warsRouter.delete("/games/:sessionId/save", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;

    await prisma.savedGame.deleteMany({ where: { userId, sessionId } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /wars/my-saved-games — мои сохранённые партии
// ─────────────────────────────────────────────────────────────────────────────
warsRouter.get("/my-saved-games", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const saved = await prisma.savedGame.findMany({
      where: { userId },
      orderBy: { savedAt: "desc" },
      include: {
        session: {
          select: {
            id: true, pgn: true, fen: true, status: true, type: true,
            finishedAt: true, createdAt: true,
            sides: {
              include: {
                player: { select: { id: true, firstName: true, lastName: true, avatar: true, avatarType: true, avatarGradient: true, elo: true } },
              },
            },
          },
        },
      },
    });

    res.json({ savedGames: saved });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Форматирование войны ─────────────────────────────────────────────────────
function formatWar(war: any) {
  const now = new Date();
  const endAt = new Date(war.endAt);
  const secondsLeft = Math.max(0, Math.floor((endAt.getTime() - now.getTime()) / 1000));

  return {
    id: war.id,
    status: war.status,
    attackerCountryId: war.attackerCountryId,
    defenderCountryId: war.defenderCountryId,
    attackerCountry: war.attackerCountry,
    defenderCountry: war.defenderCountry,
    attackerWins: war.attackerWins,
    defenderWins: war.defenderWins,
    prizePerWin: war.prizePerWin?.toString() ?? "100",
    duration: war.duration,
    startedAt: war.startedAt,
    endAt: war.endAt,
    secondsLeft,
    finishedAt: war.finishedAt ?? null,
    winnerCountryId: war.winnerCountryId ?? null,
    declaredByUserId: war.declaredByUserId,
    battleCount: war._count?.battles ?? 0,
  };
}
