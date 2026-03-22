import { Router, Request, Response } from "express";
import { z } from "zod";
import { validate } from "@/middleware/validate"; // R4
import { Chess } from "chess.js"; // BUG-10 fix
import { nanoid } from "nanoid"; // BUG-10 fix
import { getIo } from "@/lib/io";
import { logger, logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/middleware/auth";
import { updateBalance } from "@/services/economy";
import { TransactionType, CountryWarStatus } from "@prisma/client";


// ── R4: Zod схемы ─────────────────────────────────────────────────────────────
const DeclareWarSchema = z.object({
  defenderCountryId: z.string().cuid("Некорректный ID страны"),
  duration: z.number().int().positive().optional(),
});

const ChallengeSchema = z.object({
  opponentUserId: z.string().cuid("Некорректный ID пользователя"),
});

const DonateWarSchema = z.object({
  amount: z.string().regex(/^\d+$/, "Сумма должна быть числом"),
});

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
function fmtCountry(c: Record<string,unknown> & { treasury?: bigint; _count?: { members?: number }; members?: unknown[] }, myMembership: Record<string,unknown> | null, commanderId: string | null) {
  return {
    id: c.id,
    code: c.code,
    nameRu: c.nameRu,
    nameEn: c.nameEn,
    flag: c.flag,
    treasury: (c.treasury as bigint | undefined)?.toString() ?? "0",
    wins: c.wins,
    losses: c.losses,
    maxMembers: c.maxMembers,
    memberCount: (c._count as Record<string,unknown> | undefined)?.members as number ?? 0,
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
  } catch (e: unknown) {
    logError("[Wars]", e);
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
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

    const myMembership = members.find((m: Record<string,unknown>) => m.userId === userId) ?? null;

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
  } catch (e: unknown) {
    logError("[Wars]", e);
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
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
  } catch (e: unknown) {
    logError("[Wars]", e);
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
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
      const activeWar = await prisma.countryWar.findFirst({
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
  } catch (e: unknown) {
    logError("[Wars]", e);
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
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
    const activeWar = await prisma.countryWar.findFirst({
      where: {
        status: "IN_PROGRESS",
        OR: [{ attackerCountryId: existing.countryId }, { defenderCountryId: existing.countryId }],
      },
    });
    if (activeWar) return res.status(400).json({ error: "Cannot leave during active war" });

    await prisma.countryMember.delete({ where: { userId } });

    res.json({ success: true });
  } catch (e: unknown) {
    logError("[Wars]", e);
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
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
  } catch (e: unknown) {
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
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
  } catch (e: unknown) {
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
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
  } catch (e: unknown) {
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FIX #3: Статические маршруты /my-saved-games и /games/:id перенесены СЮДА —
// до /:warId, иначе Express перехватывал их как warId = "my-saved-games"
// ─────────────────────────────────────────────────────────────────────────────

// GET /wars/my-saved-games — мои сохранённые партии
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
  } catch (e: unknown) {
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
  }
});

// POST /wars/games/:sessionId/save — сохранить партию в профиль
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
  } catch (e: unknown) {
    logError("[Wars]", e);
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
  }
});

// DELETE /wars/games/:sessionId/save — убрать из сохранённых
warsRouter.delete("/games/:sessionId/save", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;

    await prisma.savedGame.deleteMany({ where: { userId, sessionId } });
    res.json({ success: true });
  } catch (e: unknown) {
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
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

    // W3: Добавляем количество зрителей для каждого активного батла
    // spectatorRooms хранится в socket.ts — получаем через io
    const battlesWithSpectators = (war as WarRecord & { battles?: Array<Record<string,unknown> & { sessionId?: string }> }).battles?.map((b) => {
      let spectatorCount = 0;
      try {
        const room = getIo().sockets.adapter.rooms?.get(`spectate:${b.sessionId}`);
        spectatorCount = room?.size ?? 0;
      } catch {}
      return { ...b, spectatorCount };
    });

    res.json({ war: { ...formatWar(war), battles: battlesWithSpectators } });
  } catch (e: unknown) {
    logError("[Wars]", e);
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /wars/declare — объявить войну (только Главнокомандующий)
// ─────────────────────────────────────────────────────────────────────────────
warsRouter.post("/declare", authMiddleware, validate(DeclareWarSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { defenderCountryId, duration } = req.body; // R4: validated

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
        prizePerWin: 100n, // FIX #9: BigInt — схема определяет поле как BigInt
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
        getIo().emit(`user:${defenderCommanderId}`, {
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
        getIo().emit(`user:${m.userId}`, {
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

    // Автоматический матчмейкинг — запустить первые партии через 5 секунд
    setTimeout(async () => {
      try {
        const { scheduleWarMatches } = await import("@/services/game/warMatchmaking");
        const created = await scheduleWarMatches(war.id);
        logger.info(`[Wars] Auto-matchmaking started for war ${war.id}: ${created} matches created`);
      } catch (err) {
        logError("[Wars] Auto-matchmaking start error:", err);
      }
    }, 5000);

    res.json({ success: true, war: formatWar(war) });
  } catch (e: unknown) {
    logError("[Wars]", e);
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /wars/:warId/challenge — вызвать бойца в рамках войны
// ─────────────────────────────────────────────────────────────────────────────
warsRouter.post("/:warId/challenge", authMiddleware, validate(ChallengeSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { warId } = req.params;
    const { opponentUserId } = req.body; // R4: validated

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

    // W2: Лимит одновременных батлов в войне — максимум 10
    const activeBattlesCount = await prisma.warBattle.count({
      where: {
        warId,
        status: "IN_PROGRESS",
      },
    });
    if (activeBattlesCount >= 10) {
      return res.status(400).json({
        error: "WAR_BATTLES_LIMIT",
        message: "Достигнут лимит одновременных сражений (10). Дождитесь завершения текущих партий.",
      });
    }

    // Q1 fix: session + warBattle в одной атомарной транзакции
    const chess = new Chess();
    const sessionCode = nanoid(8).toUpperCase();

    const { session } = await prisma.$transaction(async (tx: import("@prisma/client").Prisma.TransactionClient) => {
      const session = await tx.session.create({
        data: {
          status: "WAITING_FOR_OPPONENT",
          type: "BATTLE",
          fen: chess.fen(),
          pgn: "",
          code: sessionCode,
          sides: {
            create: [
              { playerId: userId, status: "WAITING_FOR_OPPONENT", isWhite: true },
            ],
          },
          activeUsers: { connect: [{ id: userId }] },
        },
      });

      // Связать с войной в той же транзакции
      await tx.warBattle.create({
        data: {
          warId,
          sessionId: session.id,
          attackerId: isAttacker ? userId : opponentUserId,
          defenderId: isAttacker ? opponentUserId : userId,
          attackerCountryId: war.attackerCountryId,
          defenderCountryId: war.defenderCountryId,
        },
      });

      return { session };
    });

    // Уведомить оппонента — передаём code чтобы он мог вызвать game:join
    try {
      getIo().emit(`user:${opponentUserId}`, {
        type: "war:challenge",
        sessionId: session.id,
        sessionCode,           // FIX #4: добавлен code для game:join
        warId,
        challengerUserId: userId,
        message: "Вас вызвали на военную дуэль!",
      });
    } catch {}

    res.json({ success: true, sessionId: session.id, sessionCode });
  } catch (e: unknown) {
    logError("[Wars]", e);
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
  }
});

// ── Форматирование войны ─────────────────────────────────────────────────────
type WarRecord = Record<string,unknown> & { id: string; endAt?: string | Date; _count?: { battles?: number } };
function formatWar(war: WarRecord) {
  const now = new Date();
  const endAt = new Date(war.endAt as string | Date);
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
    battleCount: (war._count as Record<string,unknown> | undefined)?.battles as number ?? 0,
  };
}

// ── POST /wars/countries/:id/donate — донат в казну страны ───────────────────
warsRouter.post("/countries/:id/donate", authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const countryId = req.params.id;
  const amount = BigInt(req.body.amount); // R4: validated by DonateWarSchema

  if (amount <= 0n) return res.status(400).json({ error: "Invalid amount" });

  try {
    const membership = await prisma.countryMember.findFirst({
      where: { userId, countryId },
    });
    if (!membership) return res.status(403).json({ error: "Not a member of this country" });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (BigInt(user.balance) < amount) return res.status(400).json({ error: "Insufficient balance" });

    // Списать с баланса и пополнить казну — атомарно
    const [, updated] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount }, totalSpent: { increment: amount } },
      }),
      prisma.country.update({
        where: { id: countryId },
        data: { treasury: { increment: amount } },
      }),
    ]);

    res.json({ success: true, treasury: updated.treasury.toString() });
  } catch (e: unknown) {
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
  }
});

// ── GET /wars/countries/:id/members — список бойцов страны ───────────────────
warsRouter.get("/countries/:id/members", authMiddleware, async (req: Request, res: Response) => {
  const countryId = req.params.id;
  try {
    const members = await prisma.countryMember.findMany({
      where: { countryId },
      orderBy: [{ warWins: "desc" }, { joinedAt: "asc" }],
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true, username: true,
            avatar: true, avatarType: true, avatarGradient: true,
            elo: true, league: true, militaryRank: true,
          },
        },
      },
    });
    const fmt = members.map((m, i) => ({
      userId: m.userId,
      rank: i + 1,
      isCommander: i === 0,
      warWins: m.warWins,
      warLosses: m.warLosses,
      joinedAt: m.joinedAt,
      user: m.user,
    }));
    res.json({ members: fmt });
  } catch (e: unknown) {
    res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) });
  }
});
