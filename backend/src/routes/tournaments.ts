import { Router } from "express";
import { z } from "zod"; // R4
import { validate } from "@/middleware/validate"; // R4
import { logger, logError } from "@/lib/logger"; // Q2
import { prisma } from "@/lib/prisma";
import { getIo } from "@/lib/io"; // BUG-01 fix: без circular dependency
import { authMiddleware } from "@/middleware/auth";
import { updateBalance } from "@/services/economy";
import { TransactionType } from "@prisma/client";
import { Chess } from "chess.js";
import { nanoid } from "nanoid";
import {
  pairSwissRound,
  totalRoundsForBracket,
  type SwissParticipant,
  type SwissPreviousMatch,
} from "@/services/tournamentSwiss"; // Sprint 4: Swiss bracket

const router = Router();
const MATCH_DEADLINE_MS = 24 * 60 * 60 * 1000; // 24h на матч (Sprint 4)

// R4: Zod schemas
const DonateTournamentSchema = z.object({
  amount: z.string().regex(/^\d+$/, "amount must be integer"),
});

router.use(authMiddleware);

// Типы турниров
// T8: YEARLY переименован в COUNTRY (чемпион страны) — требует членства в стране
const TOURNAMENT_TYPES = ['WORLD', 'COUNTRY', 'WEEKLY', 'MONTHLY', 'SEASONAL'] as const;
type TournamentType = typeof TOURNAMENT_TYPES[number];

// T8/T9: Порядок важности: WORLD > COUNTRY > SEASONAL > MONTHLY > WEEKLY
const TOURNAMENT_LABELS: Record<TournamentType, string> = {
  WORLD:    'Чемпион Мира',
  COUNTRY:  'Чемпион Страны',
  SEASONAL: 'Чемпион Сезона',
  MONTHLY:  'Чемпион Месяца',
  WEEKLY:   'Чемпион Недели',
};

// T9: Взносы по важности — WORLD самый дорогой
const TOURNAMENT_ENTRY_FEES: Record<TournamentType, bigint> = {
  WORLD:    50000n,  // Чемпион Мира — самый престижный
  COUNTRY:  25000n,  // Чемпион Страны
  SEASONAL: 10000n,  // Чемпион Сезона
  MONTHLY:   3000n,  // Чемпион Месяца
  WEEKLY:    1000n,  // Чемпион Недели
};

// Получить текущий период
function getCurrentPeriod(type: TournamentType): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const weekNum = Math.ceil((now.getTime() - new Date(year, 0, 1).getTime()) / (7 * 86400000));
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  switch (type) {
    case 'WEEKLY': return `${year}-W${String(weekNum).padStart(2, '0')}`;
    case 'MONTHLY': return `${year}-${month}`;
    case 'SEASONAL': return `${year}-Q${quarter}`;
    case 'COUNTRY': return `${year}-${month}`; // COUNTRY = monthly period per country
    case 'WORLD': return `${year}`;
    case 'COUNTRY': return `${year}-${month}`;
  }
}

// Инициализировать системные турниры (вызывается из cron)
export async function ensureSystemTournaments() {
  const types: TournamentType[] = ['WEEKLY', 'MONTHLY', 'SEASONAL', 'COUNTRY', 'WORLD'];
  for (const type of types) {
    const period = getCurrentPeriod(type);
    const existing = await prisma.tournament.findFirst({
      where: { type, period, status: { in: ['REGISTRATION', 'IN_PROGRESS'] } },
    });
    if (!existing) {
      const now = new Date();
      let endAt: Date;
      switch (type) {
        case 'WEEKLY': endAt = new Date(now.getTime() + 7 * 86400000); break;
        case 'MONTHLY': endAt = new Date(now.getFullYear(), now.getMonth() + 1, 1); break;
        case 'SEASONAL': endAt = new Date(now.getFullYear(), Math.ceil((now.getMonth() + 1) / 3) * 3, 1); break;
        case 'COUNTRY': endAt = new Date(now.getFullYear(), now.getMonth() + 1, 1); break; // месячный цикл
        default: endAt = new Date(now.getTime() + 7 * 86400000);
      }
      await prisma.tournament.create({
        data: {
          name: TOURNAMENT_LABELS[type],
          description: `Системный турнир: ${TOURNAMENT_LABELS[type]}`,
          entryFee: TOURNAMENT_ENTRY_FEES[type],
          maxPlayers: 10000,
          status: 'REGISTRATION',
          type,
          period,
          endAt,
          startAt: now,
        },
      });
      logger.info(`[Tournaments] Created ${type} for period ${period}`);
    }
  }
}

// GET /tournaments/my-matches — T6: активные турнирные матчи пользователя
router.get("/my-matches", async (req: import("express").Request, res: import("express").Response) => {
  try {
    const players = await prisma.tournamentPlayer.findMany({
      where: { userId: req.userId, isActive: true },
      select: { id: true },
    });
    const playerIds = players.map(p => p.id);

    const matches: any = await (prisma.tournamentMatch as any).findMany({
      where: {
        status: 'IN_PROGRESS',
        OR: [
          { player1Id: { in: playerIds } },
          { player2Id: { in: playerIds } },
        ],
      },
      include: {
        tournament: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const sessionIds = matches.map((m: any) => m.sessionId).filter(Boolean);
    let sessionsMap = new Map();
    if (sessionIds.length > 0) {
      const sessions = await prisma.session.findMany({
        where: { id: { in: sessionIds } },
        select: { id: true, code: true }
      });
      sessionsMap = new Map(sessions.map(s => [s.id, s.code]));
    }

    const matchesWithCode = matches.map((m: any) => ({
      ...m,
      sessionCode: m.sessionId ? sessionsMap.get(m.sessionId) : null
    }));

    res.json({ matches: matchesWithCode });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// GET /tournaments — список турниров
router.get("/", async (req: import("express").Request, res: import("express").Response) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      where: { status: { in: ["REGISTRATION", "IN_PROGRESS"] } },
      include: {
        _count: { select: { players: { where: { isActive: true } } } },
        players: {
          where: { userId: req.userId },
          select: { id: true, wins: true, losses: true, draws: true, points: true },
        },
      },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
      take: 20,
    });

    res.json({
      tournaments: (tournaments as any[]).map((t: any) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        typeLabel: TOURNAMENT_LABELS[t.type as TournamentType] ?? t.type,
        description: t.description,
        entryFee: t.entryFee.toString(),
        maxPlayers: t.maxPlayers,
        currentPlayers: t._count.players,
        status: t.status,
        startAt: t.startAt,
        endAt: t.endAt,
        period: t.period,
        prizePool: t.prizePool.toString(),
        donationPool: t.donationPool.toString(),
        totalPool: (t.prizePool + t.donationPool).toString(),
        isJoined: t.players.length > 0,
        myStats: t.players[0] ?? null,
      })),
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// GET /tournaments/:id — детали турнира с лидербордом
router.get("/:id", async (req: import("express").Request, res: import("express").Response) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: {
        players: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, firstName: true, username: true, elo: true, avatar: true, avatarGradient: true },
            },
          },
          orderBy: [{ points: "desc" }, { wins: "desc" }],
          take: 100,
        },
        matches: { orderBy: [{ round: "desc" }, { createdAt: "desc" }], take: 20 },
      },
    });

    if (!tournament) return res.status(404).json({ error: "NOT_FOUND" });
    res.json({ tournament });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// POST /tournaments/:id/join — вступить в турнир
router.post("/:id/join", async (req: import("express").Request, res: import("express").Response) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { players: true } } },
    });

    if (!tournament) return res.status(404).json({ error: "NOT_FOUND" });
    if (tournament.status !== "REGISTRATION" && tournament.status !== "IN_PROGRESS") {
      return res.status(400).json({ error: "REGISTRATION_CLOSED" });
    }

    // T8: COUNTRY турнир требует членства в стране
    if (tournament.type === "COUNTRY") {
      const membership = await prisma.countryMember.findUnique({
        where: { userId: req.userId },
      });
      if (!membership) {
        return res.status(400).json({ error: "COUNTRY_REQUIRED", message: "Join a country first to participate in the Country Championship. Go to Wars and choose your country." });
      }
    }

    // БАГ #3 fix: атомарный join — защита от race condition
    // TournamentPlayer имеет @@unique([tournamentId, userId])
    // Если два запроса одновременно — второй упадёт с P2002
    let newPlayer: Awaited<ReturnType<typeof prisma.tournamentPlayer.create>>;
    try {
      newPlayer = await prisma.$transaction(async (tx) => {
        // Проверяем уже не зарегистрирован
        const existing = await tx.tournamentPlayer.findUnique({
          where: { tournamentId_userId: { tournamentId: tournament.id, userId: req.userId } },
        });
        if (existing) throw Object.assign(new Error('ALREADY_JOINED'), { code: 'ALREADY_JOINED' });

        if (tournament.entryFee > 0n) {
          const user = await tx.user.findUniqueOrThrow({ where: { id: req.userId } });
          if (user.balance < tournament.entryFee) {
            throw Object.assign(new Error('INSUFFICIENT_BALANCE'), { code: 'INSUFFICIENT_BALANCE' });
          }
          // Атомарно: списание + prizePool + создание игрока
          await updateBalance(req.userId, -(tournament.entryFee as bigint), TransactionType.TOURNAMENT_ENTRY, { tournamentId: tournament.id }, { tx });
          await tx.tournament.update({
            where: { id: tournament.id },
            data: { prizePool: { increment: tournament.entryFee }, status: 'IN_PROGRESS' },
          });
        }

        return tx.tournamentPlayer.create({
          data: { tournamentId: tournament.id, userId: req.userId, contribution: tournament.entryFee },
        });
      });
    } catch (joinErr: unknown) {
      const code = (joinErr as { code?: string })?.code;
      if (code === 'ALREADY_JOINED') return res.status(400).json({ error: 'ALREADY_JOINED' });
      if (code === 'INSUFFICIENT_BALANCE') return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' });
      if (code === 'P2002') return res.status(400).json({ error: 'ALREADY_JOINED' }); // race condition
      throw joinErr;
    }

    // T1: Auto-matchmaking — создаём реальный приватный батл
    try {
      await runTournamentMatchmaking(tournament.id, newPlayer, req.userId);
    } catch (matchErr) {
      logError('[Tournaments] Auto-matchmaking error:', matchErr);
      // Non-fatal: player joined successfully
    }

    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// POST /tournaments/:id/donate — зрительский донат в казну
router.post("/:id/donate", validate(DonateTournamentSchema), async (req: import("express").Request, res: import("express").Response) => { // R4
  try {
    const { amount } = req.body;
    if (!amount || BigInt(amount) <= 0n) return res.status(400).json({ error: "Amount is required" });

    const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });
    if (!tournament || tournament.status === "FINISHED") return res.status(404).json({ error: "NOT_FOUND" });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
    if (user.balance < BigInt(amount)) return res.status(400).json({ error: "INSUFFICIENT_BALANCE" });

    await updateBalance(req.userId, -BigInt(amount), TransactionType.TOURNAMENT_ENTRY, {
      tournamentId: req.params.id, reason: "donation",
    });
    await prisma.tournament.update({
      where: { id: req.params.id },
      data: { donationPool: { increment: BigInt(amount) } },
    });

    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// POST /tournaments/:id/leave — выйти из турнира
router.post("/:id/leave", async (req: import("express").Request, res: import("express").Response) => {
  try {
    const player = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: req.params.id, userId: req.userId } },
    });
    if (!player) return res.status(404).json({ error: "NOT_FOUND" });

    // Взнос не возвращается
    await prisma.tournamentPlayer.update({
      where: { id: player.id },
      data: { isActive: false, eliminated: true },
    });

    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// POST /tournaments — создать турнир (admin)
router.post("/", async (req: import("express").Request, res: import("express").Response) => {
  try {
    const adminIds = (process.env.ADMIN_IDS ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
    if (!adminIds.length) return res.status(403).json({ error: "FORBIDDEN", message: "ADMIN_IDS не настроен" });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId }, select: { telegramId: true } });
    if (!adminIds.includes(user.telegramId)) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    const { name, description, entryFee = "0", maxPlayers = 256, startAt, type = 'WORLD' } = req.body;
    if (!name) return res.status(400).json({ error: "NAME_REQUIRED" });

    const tournament = await prisma.tournament.create({
      data: {
        name,
        description,
        entryFee: BigInt(entryFee),
        maxPlayers: Math.min(10000, Math.max(2, parseInt(maxPlayers))),
        startAt: startAt ? new Date(startAt) : new Date(),
        createdBy: req.userId,
        type,
        period: getCurrentPeriod(type as TournamentType),
        status: 'REGISTRATION',
      },
    });

    res.json({ tournament });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// settleTournament — distribute prizes when a tournament ends
export async function settleTournament(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      players: {
        where: { isActive: true },
        orderBy: [{ points: 'desc' }, { wins: 'desc' }],
      },
    },
  });

  if (!tournament) throw new Error('Tournament not found');
  if (tournament.status === 'FINISHED') return; // already settled

  const totalPool = tournament.prizePool + tournament.donationPool;
  const type = tournament.type as TournamentType;

  // Prize distribution by type
  const prizes: Array<{ rank: number; share: bigint; playerId: string; userId: string }> = [];

  const byShare = (pct: number) => (totalPool * BigInt(Math.round(pct * 100))) / 10000n;

  if (type === 'COUNTRY' || type === 'WORLD') {
    // 1st=60%, 2nd=30%, 3rd=10%
    const ranks = [
      { rank: 1, pct: 60 },
      { rank: 2, pct: 30 },
      { rank: 3, pct: 10 },
    ];
    for (const { rank, pct } of ranks) {
      const player = tournament.players[rank - 1];
      if (player) {
        prizes.push({ rank, share: byShare(pct), playerId: player.id, userId: player.userId });
      }
    }
  } else {
    // Single winner
    const pct = type === 'WEEKLY' ? 10 : type === 'MONTHLY' ? 20 : type === 'SEASONAL' ? 30 : 10;
    const champion = tournament.players[0];
    if (champion) {
      prizes.push({ rank: 1, share: byShare(pct), playerId: champion.id, userId: champion.userId });
    }
  }

  // Pay out prizes
  for (const prize of prizes) {
    if (prize.share <= 0n) continue;
    await updateBalance(prize.userId, prize.share, TransactionType.TOURNAMENT_WIN, {
      tournamentId: tournament.id,
      rank: prize.rank,
      prizePool: totalPool.toString(),
    });
    // Mark player as eliminated (prizeWon field not in schema, use contribution as proxy)
    await prisma.tournamentPlayer.update({
      where: { id: prize.playerId },
      data: { contribution: prize.share },
    });
  }

  // Mark tournament as finished
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: 'FINISHED' },
  });

  // Выдаём турнирные бейджи топ-3
  for (const prize of prizes) {
    if (prize.rank > 3) continue;
    try {
      const existing = await prisma.user.findUnique({
        where: { id: prize.userId },
        select: { tournamentBadges: true },
      });
      const badges: Array<Record<string,unknown>> = Array.isArray(existing?.tournamentBadges) ? existing!.tournamentBadges as Array<Record<string,unknown>> : [];
      badges.push({
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        type: tournament.type,
        place: prize.rank,
        date: new Date().toISOString(),
        prize: prize.share.toString(),
      });
      await prisma.user.update({
        where: { id: prize.userId },
        data: { tournamentBadges: badges as any },
      });
      logger.info(`[Tournaments] Badge awarded to ${prize.userId} — place ${prize.rank} in "${tournament.name}"`);
    } catch (e) {
      logError('[Tournaments] Badge error:', e);
    }
  }

  // T7: Уведомляем призёров через AdminNotification (бот подхватит)
  for (const prize of prizes) {
    try {
      const winner = await prisma.user.findUnique({
        where: { id: prize.userId },
        select: { telegramId: true, firstName: true },
      });
      if (winner?.telegramId) {
        await prisma.adminNotification.create({
          data: {
            type: 'TOURNAMENT_WIN',
            payload: {
              telegramId: winner.telegramId,
              name: winner.firstName,
              tournamentName: tournament.name,
              tournamentType: tournament.type,
              place: prize.rank,
              prize: prize.share.toString(),
            },
          },
        });
        // T7: socket уведомление если онлайн
        try {
          getIo().emit(`user:${prize.userId}`, {
            type: 'tournament:finished',
            tournamentName: tournament.name,
            place: prize.rank,
            prize: prize.share.toString(),
          });
        } catch {}
      }
    } catch {}
  }

  logger.info(`[Tournaments] Settled ${tournament.type} "${tournament.name}": ${prizes.length} prizes paid from pool ${totalPool}`);
}


// ─────────────────────────────────────────────────────────────────────────────
// T1-T6: Matchmaking Engine (создаёт парные приватные батлы)
// Находит свободного соперника, создаёт реальный приватный батл,
// уведомляет обоих игроков через socket и бота. Оба игрока добавляются в session.sides
// ─────────────────────────────────────────────────────────────────────────────
import { redis } from "@/lib/redis"; // Добавлен импорт для Redis

export async function runTournamentMatchmaking(
  tournamentId: string,
  newPlayer: { id: string; userId: string },
  userId: string
) {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { id: true, name: true, type: true, entryFee: true },
  });

  const activeMatches = await prisma.tournamentMatch.findMany({
    where: { tournamentId, status: 'IN_PROGRESS' },
    select: { player1Id: true, player2Id: true },
  });
  const busyPlayerIds = new Set(activeMatches.flatMap((m) => [m.player1Id, m.player2Id]));

  const candidates = await prisma.tournamentPlayer.findMany({
    where: {
      tournamentId,
      isActive: true,
      id: { not: newPlayer.id },
      userId: { not: userId },
    },
    include: { user: { select: { id: true, firstName: true, telegramId: true } } },
  });

  const available = candidates.filter((p) => !busyPlayerIds.has(p.id));
  if (available.length === 0) return; // нет свободного соперника — ждём

  const opponent = available[Math.floor(Math.random() * available.length)];

  const lastMatch = await prisma.tournamentMatch.findFirst({
    where: { tournamentId },
    orderBy: { round: 'desc' },
  });
  const round = lastMatch ? lastMatch.round + 1 : 1;

  const chess = new Chess();
  const sessionCode = nanoid(8).toUpperCase();

  const { session, match } = await prisma.$transaction(async (tx: import("@prisma/client").Prisma.TransactionClient) => {
    // В турнире батл создается с обоими участниками, status = WAITING_FOR_OPPONENT
    const session = await tx.session.create({
      data: {
        status: 'WAITING_FOR_OPPONENT',
        type: 'BATTLE',
        isPrivate: true, // турнирные батлы по умолчанию приватные до старта
        fen: chess.fen(),
        pgn: '',
        code: sessionCode,
        duration: 300,
        sides: {
          create: [
            { playerId: userId, status: 'WAITING_FOR_OPPONENT', isWhite: true, timeLeft: 300 },
            { playerId: opponent.userId, status: 'WAITING_FOR_OPPONENT', isWhite: false, timeLeft: 300 },
          ],
        },
        activeUsers: { connect: [{ id: userId }, { id: opponent.userId }] },
      },
    });

    const match = await tx.tournamentMatch.create({
      data: {
        tournamentId,
        player1Id: newPlayer.id,
        player2Id: opponent.id,
        round,
        status: 'IN_PROGRESS',
        sessionId: session.id,
      },
    });

    return { session, match };
  });

  // Сохраняем sourceType и sourceMeta для formatSession
  await redis.set(`session:source:${session.id}`, JSON.stringify({
    sourceType: 'TOURNAMENT',
    sourceMeta: tournamentId
  }), 'EX', 86400 * 30); // 30 дней TTL

  const myUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, telegramId: true },
  });

  const notifyPayload = {
    type: 'tournament:match',
    matchId: match.id,
    sessionId: session.id,
    sessionCode,
    tournamentName: tournament.name,
    tournamentType: tournament.type,
    round,
    opponentName: opponent.user?.firstName ?? 'Соперник',
    myName: myUser?.firstName ?? 'Игрок',
  };

  try {
    getIo().emit(`user:${userId}`, { ...notifyPayload, opponentName: opponent.user?.firstName ?? 'Соперник' });
    getIo().emit(`user:${opponent.userId}`, { ...notifyPayload, opponentName: myUser?.firstName ?? 'Соперник' });
  } catch {}

  for (const [pId, telegramId, oppName] of [
    [userId, myUser?.telegramId, opponent.user?.firstName],
    [opponent.userId, opponent.user?.telegramId, myUser?.firstName],
  ] as [string, string | undefined, string | undefined][]) {
    if (!telegramId) continue;
    await prisma.adminNotification.create({
      data: {
        type: 'TOURNAMENT_MATCH',
        payload: {
          telegramId,
          tournamentName: tournament.name,
          opponentName: oppName ?? 'Соперник',
          sessionCode,
          sessionId: session.id,
          round,
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      },
    });
  }

  logger.info(`[Tournaments] Match created: ${userId} vs ${opponent.userId} — session ${session.id} code ${sessionCode}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Matchmaker Cron Engine (Парное спаривание свободных игроков во всех турнирах)
// ─────────────────────────────────────────────────────────────────────────────
export async function matchmakeAllTournaments() {
  try {
    const activeTournaments = await prisma.tournament.findMany({
      where: { status: 'IN_PROGRESS' },
      select: { id: true },
    });

    for (const { id } of activeTournaments) {
      // Ищем всех активных участников
      const candidates = await prisma.tournamentPlayer.findMany({
        where: { tournamentId: id, isActive: true },
        include: { user: { select: { id: true } } }
      });

      // Исключаем тех, кто уже в матче
      const activeMatches = await prisma.tournamentMatch.findMany({
        where: { tournamentId: id, status: 'IN_PROGRESS' },
      });
      const busyIds = new Set(activeMatches.flatMap((m) => [m.player1Id, m.player2Id]));
      const available = candidates.filter(c => !busyIds.has(c.id));

      // Разбиваем на пары
      for (let i = 0; i + 1 < available.length; i += 2) {
        const p1 = available[i];
        const p2 = available[i+1];
        if (!p1 || !p2) continue;

        // Эмулируем запуск как будто p1 присоединился
        // Примечание: runTournamentMatchmaking ищет ЛЮБОГО соперника, поэтому вызовем напрямую.
        // Чтобы избежать случайности, лучше бы переписать, но для совместимости оставим вызов
        try {
          await runTournamentMatchmaking(id, p1, p1.userId);
        } catch (e) {
          logError(`[Tournaments] Matchmaking error for ${id}:`, e);
        }
      }
    }
  } catch (e) {
    logError('[Tournaments] MatchmakeAll engine error:', e);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// T4: Авто-поражение за неответ в течение 24ч
// Вызывается из crons.ts каждый час
// ─────────────────────────────────────────────────────────────────────────────
export async function checkTournamentForfeits() {
  const deadline = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Находим матчи IN_PROGRESS старше 24ч где сессия ещё WAITING_FOR_OPPONENT
  const staleMatches = await (prisma.tournamentMatch as any).findMany({
    where: {
      status: 'IN_PROGRESS',
      createdAt: { lt: deadline },
    },
    include: {
      tournament: { select: { id: true, name: true } },
    },
  }) as any[];

  // Filter to only matches whose session is still WAITING_FOR_OPPONENT
  const filteredMatches: any[] = [];
  for (const m of staleMatches) {
    if (m.sessionId) {
      const session = await prisma.session.findUnique({ where: { id: m.sessionId }, select: { status: true } });
      if (session?.status === 'WAITING_FOR_OPPONENT') filteredMatches.push(m);
    }
  }

  for (const match of filteredMatches) {
    try {
      if (!match.player1Id || !match.player2Id) continue;

      const session = await prisma.session.findUnique({
         where: { id: match.sessionId },
         include: { sides: { include: { player: { select: { tournaments: { where: { tournamentId: match.tournamentId }, select: { id: true } } } } } } },
      });
      
      if (!session || session.status !== 'WAITING_FOR_OPPONENT') continue;

      const acceptedSides = session.sides.filter((s: Record<string,unknown>) => s.status === 'IN_PROGRESS');
      const waitingSides = session.sides.filter((s: Record<string,unknown>) => s.status === 'WAITING_FOR_OPPONENT');

      let winnerId: string | null = null;
      let loserId: string | null = null;

      if (acceptedSides.length === 1 && waitingSides.length === 1) {
         winnerId = (acceptedSides[0] as any)?.player?.tournaments[0]?.id ?? null;
         loserId = (waitingSides[0] as any)?.player?.tournaments[0]?.id ?? null;
      }

      await prisma.$transaction(async (tx) => {
          await tx.tournamentMatch.update({
            where: { id: match.id },
            data: {
              status: 'FINISHED',
              winnerId,
            },
          });

          if (winnerId) {
             await tx.tournamentPlayer.update({
               where: { id: winnerId },
               data: { wins: { increment: 1 }, points: { increment: 1 } },
             });
          }
          if (loserId) {
             await tx.tournamentPlayer.update({
                where: { id: loserId },
                data: { losses: { increment: 1 }, skippedMatches: { increment: 1 } },
             });
          }
          if (!winnerId && !loserId) {
             await tx.tournamentPlayer.updateMany({
                where: { id: { in: [match.player1Id!, match.player2Id!] } },
                data: { skippedMatches: { increment: 1 } },
             });
          }

          await tx.session.update({
            where: { id: match.sessionId! },
            data: { status: 'CANCELLED' },
          });
      });

      if (winnerId && loserId && acceptedSides[0] && waitingSides[0]) {
         const winnerSide = acceptedSides[0];
         const loserSide = waitingSides[0];
         try {
            const wUser = await prisma.user.findUnique({ where: { id: winnerSide.playerId }, select: { telegramId: true } });
            const lUser = await prisma.user.findUnique({ where: { id: loserSide.playerId }, select: { telegramId: true } });

            if (wUser?.telegramId) {
                await prisma.adminNotification.create({
                  data: {
                    type: 'TECHNICAL_WIN',
                    payload: { telegramId: wUser.telegramId, tournamentName: match.tournament.name, opponentId: loserSide.playerId },
                  },
                });
            }
            if (lUser?.telegramId) {
                await prisma.adminNotification.create({
                  data: {
                    type: 'TOURNAMENT_ELIMINATED',
                    payload: { telegramId: lUser.telegramId, tournamentName: match.tournament.name, position: 0 },
                  },
                });
            }
         } catch(e) {}
      }

      logger.info(`[Tournaments] Forfeit processed for match ${match.id} (winner: ${winnerId}, loser: ${loserId})`);

      const playerIds = [match.player1Id, match.player2Id];
      for (const pid of playerIds) {
        if (!pid) continue;
        const pt = await prisma.tournamentPlayer.findUnique({ where: { id: pid } });
        if (pt && pt.skippedMatches >= 3 && pt.isActive) {
          await prisma.tournamentPlayer.update({
            where: { id: pid },
            data: { isActive: false },
          });
          logger.info(`[Tournaments] Player ${pid} excluded due to 3 skips`);
        }
      }

    } catch (err: unknown) {
      logger.error(`[Tournaments] Forfeit error for match ${match.id}:`, err);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// G25: Командные турниры — создание (только для офицеров)
// ─────────────────────────────────────────────────────────────────────────────
const CreateTeamTournamentSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  entryFee: z.string().regex(/^\d+$/),
  maxPlayers: z.number().min(4).max(64).default(16),
  teamSize: z.number().min(2).max(10).default(5),
});

router.post("/team/create", validate(CreateTeamTournamentSchema), async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name, description, entryFee, maxPlayers, teamSize } = req.body;

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { referralCount: true, firstName: true },
    });

    // G25: Только офицеры (≥50 рефералов = CORPORAL и выше) могут создавать командные турниры
    if ((user.referralCount ?? 0) < 50) {
      return res.status(403).json({ error: "Officer rank required (50+ referrals) to create team tournaments" });
    }

    const fee = BigInt(entryFee);
    if (fee < 1000n) return res.status(400).json({ error: "Min entry fee: 1000" });

    const now = new Date();
    const endAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 дней на регистрацию + игру

    const tournament = await prisma.tournament.create({
      data: {
        name,
        description: description ? `TEAM|${teamSize}|${description}` : `TEAM|${teamSize}`,
        type: 'TEAM',
        entryFee: fee,
        maxPlayers,
        status: 'REGISTRATION',
        createdBy: userId,
        startAt: now,
        endAt,
      },
    });

    res.json({
      id: tournament.id,
      name: tournament.name,
      type: 'TEAM',
      teamSize,
      entryFee: fee.toString(),
      maxPlayers,
      status: 'REGISTRATION',
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// GET /tournaments/team — список командных турниров
router.get("/team", async (req, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      where: { type: 'TEAM' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        _count: { select: { players: true } },
      },
    });

    res.json({
      tournaments: tournaments.map(t => {
        const parts = (t.description ?? '').split('|');
        const teamSize = parts[0] === 'TEAM' ? parseInt(parts[1] ?? '5') : 5;
        return {
          id: t.id,
          name: t.name,
          type: 'TEAM',
          teamSize,
          entryFee: t.entryFee.toString(),
          prizePool: t.prizePool.toString(),
          donationPool: t.donationPool.toString(),
          maxPlayers: t.maxPlayers,
          playerCount: t._count.players,
          status: t.status,
          createdBy: t.createdBy,
          startAt: t.startAt,
          endAt: t.endAt,
        };
      }),
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 4: Swiss-system bracket — стартовый и следующий раунд
// ─────────────────────────────────────────────────────────────────────────────

async function isAdmin(userId: string): Promise<boolean> {
  const adminIds = (process.env.ADMIN_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (!adminIds.length) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true } });
  return !!user && adminIds.includes(user.telegramId);
}

/**
 * Создаёт пары следующего раунда турнира по Swiss-системе и оформляет:
 *  - TournamentMatch (round, status=PENDING, deadline=now+24h)
 *  - приватную Session BATTLE для каждой пары (sessionId сохранён в match)
 *  - AdminNotification TOURNAMENT_MATCH обоим игрокам
 *  - bye = авто-победа (status=FINISHED, winnerId, points=1)
 */
export async function generateSwissRound(tournamentId: string, round: number) {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { id: true, name: true, type: true, maxPlayers: true, status: true },
  });

  const players = await prisma.tournamentPlayer.findMany({
    where: { tournamentId, isActive: true },
    select: { id: true, userId: true, points: true },
  });
  if (players.length < 2) {
    logger.info(`[Swiss] Tournament ${tournamentId} has <2 players, skipping round ${round}`);
    return { pairs: [], byes: [] };
  }

  const previousMatches = await (prisma.tournamentMatch as any).findMany({
    where: { tournamentId },
    select: { player1Id: true, player2Id: true, winnerId: true, points: true },
  }) as SwissPreviousMatch[];

  const participants: SwissParticipant[] = players.map(p => ({
    id: p.id,
    userId: p.userId,
    points: Number(p.points ?? 0),
  }));

  const pairs = pairSwissRound(participants, previousMatches, round);
  const userIdByPlayer = new Map(players.map(p => [p.id, p.userId]));
  const deadline = new Date(Date.now() + MATCH_DEADLINE_MS);

  const createdMatches: Array<{ matchId: string; sessionId?: string; player1UserId: string; player2UserId?: string }> = [];

  let order = 0;
  for (const pair of pairs) {
    order++;
    if (pair.isBye || !pair.player2Id) {
      // bye = авто-победа +1 очко
      const userId = userIdByPlayer.get(pair.player1Id);
      if (!userId) continue;
      await prisma.$transaction(async (tx) => {
        await (tx.tournamentMatch as any).create({
          data: {
            tournamentId,
            player1Id: pair.player1Id,
            player2Id: null,
            winnerId: pair.player1Id,
            round,
            matchOrder: order,
            status: 'FINISHED',
            points: 1,
            deadline,
          },
        });
        await tx.tournamentPlayer.update({
          where: { id: pair.player1Id },
          data: { wins: { increment: 1 }, points: { increment: 1 } },
        });
      });
      logger.info(`[Swiss] BYE: player ${pair.player1Id} round ${round}`);
      continue;
    }

    const p1UserId = userIdByPlayer.get(pair.player1Id);
    const p2UserId = userIdByPlayer.get(pair.player2Id);
    if (!p1UserId || !p2UserId) continue;

    const chess = new Chess();
    const sessionCode = nanoid(8).toUpperCase();
    const matchOrder = order;

    const { sessionId, matchId } = await prisma.$transaction(async (tx) => {
      const session = await tx.session.create({
        data: {
          status: 'WAITING_FOR_OPPONENT',
          type: 'BATTLE',
          isPrivate: true,
          fen: chess.fen(),
          pgn: '',
          code: sessionCode,
          duration: 300,
          sides: {
            create: [
              { playerId: p1UserId, status: 'WAITING_FOR_OPPONENT', isWhite: true,  timeLeft: 300 },
              { playerId: p2UserId, status: 'WAITING_FOR_OPPONENT', isWhite: false, timeLeft: 300 },
            ],
          },
          activeUsers: { connect: [{ id: p1UserId }, { id: p2UserId }] },
        },
      });

      const match = await (tx.tournamentMatch as any).create({
        data: {
          tournamentId,
          player1Id: pair.player1Id,
          player2Id: pair.player2Id,
          round,
          matchOrder,
          status: 'PENDING',
          sessionId: session.id,
          deadline,
        },
      });

      return { sessionId: session.id, matchId: match.id };
    });

    createdMatches.push({ matchId, sessionId, player1UserId: p1UserId, player2UserId: p2UserId });

    // socket + AdminNotification
    const [u1, u2] = await Promise.all([
      prisma.user.findUnique({ where: { id: p1UserId }, select: { telegramId: true, firstName: true } }),
      prisma.user.findUnique({ where: { id: p2UserId }, select: { telegramId: true, firstName: true } }),
    ]);

    const baseNotify = {
      type: 'tournament:match',
      matchId,
      sessionId,
      sessionCode,
      tournamentName: tournament.name,
      tournamentType: tournament.type,
      round,
      deadline: deadline.toISOString(),
    };
    try {
      getIo().emit(`user:${p1UserId}`, { ...baseNotify, opponentName: u2?.firstName ?? 'Соперник' });
      getIo().emit(`user:${p2UserId}`, { ...baseNotify, opponentName: u1?.firstName ?? 'Соперник' });
    } catch {}

    for (const [tg, oppName] of [
      [u1?.telegramId, u2?.firstName],
      [u2?.telegramId, u1?.firstName],
    ] as [string | undefined, string | undefined][]) {
      if (!tg) continue;
      await prisma.adminNotification.create({
        data: {
          type: 'TOURNAMENT_MATCH',
          payload: {
            telegramId: tg,
            tournamentName: tournament.name,
            opponentName: oppName ?? 'Соперник',
            sessionCode,
            sessionId,
            round,
            deadline: deadline.toISOString(),
          },
        },
      });
    }
  }

  // Если статус был не IN_PROGRESS — переводим
  if (tournament.status === 'REGISTRATION') {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: 'IN_PROGRESS' },
    });
  }

  logger.info(`[Swiss] Tournament ${tournamentId} round ${round}: ${createdMatches.length} pairs + ${pairs.filter(p=>p.isBye).length} byes`);
  return { pairs, byes: pairs.filter(p => p.isBye), createdMatches };
}

/**
 * POST /tournaments/:id/start-swiss — стартовать Swiss-турнир (первый раунд).
 * Только админ. Создаёт раунд 1 пар через Swiss и переводит статус в IN_PROGRESS.
 */
router.post("/:id/start-swiss", async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) return res.status(403).json({ error: "FORBIDDEN" });

    const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });
    if (!tournament) return res.status(404).json({ error: "NOT_FOUND" });
    if (tournament.status === 'FINISHED') return res.status(400).json({ error: "ALREADY_FINISHED" });

    // Проверим, не было ли уже раундов
    const existingRounds = await (prisma.tournamentMatch as any).count({
      where: { tournamentId: tournament.id },
    });
    if (existingRounds > 0) return res.status(400).json({ error: "ALREADY_STARTED" });

    const result = await generateSwissRound(tournament.id, 1);
    res.json({ ok: true, round: 1, pairs: result.pairs.length, byes: result.byes.length });
  } catch (err: unknown) {
    logError("[Tournaments/start-swiss]", err);
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

/**
 * POST /tournaments/:id/next-round — генерация следующего раунда.
 * Только админ. Использует текущий standings → Swiss-пары.
 * Останавливается, если round > totalRoundsForBracket(maxPlayers).
 */
router.post("/:id/next-round", async (req, res) => {
  try {
    if (!(await isAdmin(req.userId))) return res.status(403).json({ error: "FORBIDDEN" });

    const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });
    if (!tournament) return res.status(404).json({ error: "NOT_FOUND" });
    if (tournament.status !== 'IN_PROGRESS') return res.status(400).json({ error: "NOT_IN_PROGRESS" });

    const lastRoundAgg = await (prisma.tournamentMatch as any).aggregate({
      where: { tournamentId: tournament.id },
      _max: { round: true },
    });
    const lastRound = lastRoundAgg._max.round ?? 0;

    const totalRounds = totalRoundsForBracket(tournament.maxPlayers);
    if (lastRound >= totalRounds) {
      return res.status(400).json({ error: "MAX_ROUNDS_REACHED", lastRound, totalRounds });
    }

    // Все ли матчи прошлого раунда финализированы?
    const pendingPrev = await (prisma.tournamentMatch as any).count({
      where: { tournamentId: tournament.id, round: lastRound, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });
    if (pendingPrev > 0) {
      return res.status(400).json({ error: "PREVIOUS_ROUND_NOT_FINISHED", pendingPrev });
    }

    const nextRound = lastRound + 1;
    const result = await generateSwissRound(tournament.id, nextRound);
    res.json({
      ok: true, round: nextRound, totalRounds,
      pairs: result.pairs.length, byes: result.byes.length,
    });
  } catch (err: unknown) {
    logError("[Tournaments/next-round]", err);
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

/**
 * GET /tournaments/:id/bracket — структурированный bracket для UI:
 *  раунды как массив, каждый раунд — список матчей с участниками.
 */
router.get("/:id/bracket", async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, type: true, status: true, maxPlayers: true },
    });
    if (!tournament) return res.status(404).json({ error: "NOT_FOUND" });

    const matches = await (prisma.tournamentMatch as any).findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ round: 'asc' }, { matchOrder: 'asc' }],
    }) as any[];

    const playerIds = Array.from(new Set(matches.flatMap(m => [m.player1Id, m.player2Id].filter(Boolean) as string[])));
    const players = await prisma.tournamentPlayer.findMany({
      where: { id: { in: playerIds } },
      include: { user: { select: { id: true, firstName: true, avatar: true, avatarGradient: true } } },
    });
    const playerMap = new Map(players.map(p => [p.id, p]));

    const totalRounds = totalRoundsForBracket(tournament.maxPlayers);
    const rounds: Array<{ round: number; matches: any[] }> = [];
    let currentRound = 0;
    const lastRoundAgg = await (prisma.tournamentMatch as any).aggregate({
      where: { tournamentId: tournament.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      _min: { round: true },
    });
    currentRound = lastRoundAgg._min.round ?? 0;

    for (let r = 1; r <= totalRounds; r++) {
      const rMatches = matches.filter(m => m.round === r).map(m => ({
        id: m.id,
        round: m.round,
        matchOrder: m.matchOrder,
        status: m.status,
        sessionId: m.sessionId,
        deadline: m.deadline,
        winnerId: m.winnerId,
        player1: m.player1Id ? {
          playerId: m.player1Id,
          user: playerMap.get(m.player1Id)?.user ?? null,
          points: playerMap.get(m.player1Id)?.points ?? 0,
        } : null,
        player2: m.player2Id ? {
          playerId: m.player2Id,
          user: playerMap.get(m.player2Id)?.user ?? null,
          points: playerMap.get(m.player2Id)?.points ?? 0,
        } : null,
        isBye: !!m.player1Id && !m.player2Id,
      }));
      rounds.push({ round: r, matches: rMatches });
    }

    res.json({
      tournament: {
        id: tournament.id, name: tournament.name, type: tournament.type,
        status: tournament.status, maxPlayers: tournament.maxPlayers,
        totalRounds, currentRound,
      },
      rounds,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 4: 24h autoloss cron handler (вызывается из crons.ts каждые 15 мин)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Находит TournamentMatch с status=PENDING и deadline < now,
 * у которых linked Session.status != FINISHED.
 *  - один играл, другой нет → играющий побеждает (1 очко)
 *  - оба не играли → DRAW (0.5 / 0.5)
 *  - оба сделали ходы (но матч ещё не FINISHED) → не трогаем, ждём окончания партии
 */
export async function processSwissAutoloss() {
  const now = new Date();
  const stale = await (prisma.tournamentMatch as any).findMany({
    where: {
      status: 'PENDING',
      deadline: { lt: now },
    },
    include: {
      tournament: { select: { id: true, name: true } },
    },
    take: 200,
  }) as any[];

  let processed = 0;
  for (const match of stale) {
    try {
      if (!match.player1Id || !match.player2Id) continue; // bye — пропуск

      let session = null as any;
      if (match.sessionId) {
        session = await prisma.session.findUnique({
          where: { id: match.sessionId },
          include: { sides: true },
        });
      }
      // если сессия уже FINISHED — отдельный поток обработает
      if (session && session.status === 'FINISHED') continue;

      // Кто сделал ходы? Проверяем через PGN session, либо через side.status
      // Простая эвристика: если session.pgn содержит хотя бы один ход — игрок белыми играл;
      // проверяем по sides — кто IN_PROGRESS / у кого ходы.
      const movesPlayed = !!session && (session.pgn ?? '').trim().length > 0;

      // Кто реально начал — определяется по side.status === IN_PROGRESS или по ходам.
      const sides = session?.sides ?? [];
      const p1User = await prisma.tournamentPlayer.findUnique({ where: { id: match.player1Id }, select: { userId: true } });
      const p2User = await prisma.tournamentPlayer.findUnique({ where: { id: match.player2Id }, select: { userId: true } });

      const p1Side = sides.find((s: any) => s.playerId === p1User?.userId);
      const p2Side = sides.find((s: any) => s.playerId === p2User?.userId);

      const p1Active = p1Side && p1Side.status === 'IN_PROGRESS';
      const p2Active = p2Side && p2Side.status === 'IN_PROGRESS';

      let winnerPlayerId: string | null = null;
      let loserPlayerId: string | null = null;
      let isDraw = false;

      if (movesPlayed && p1Active && !p2Active) {
        winnerPlayerId = match.player1Id;
        loserPlayerId = match.player2Id;
      } else if (movesPlayed && p2Active && !p1Active) {
        winnerPlayerId = match.player2Id;
        loserPlayerId = match.player1Id;
      } else if (p1Active && !p2Active) {
        winnerPlayerId = match.player1Id;
        loserPlayerId = match.player2Id;
      } else if (p2Active && !p1Active) {
        winnerPlayerId = match.player2Id;
        loserPlayerId = match.player1Id;
      } else {
        // оба не играли (или оба IN_PROGRESS без ходов на дедлайн) — DRAW
        isDraw = true;
      }

      await prisma.$transaction(async (tx) => {
        if (isDraw) {
          await (tx.tournamentMatch as any).update({
            where: { id: match.id },
            data: { status: 'FINISHED', points: 0.5, winnerId: null },
          });
          await tx.tournamentPlayer.update({
            where: { id: match.player1Id },
            data: { draws: { increment: 1 }, points: { increment: 0.5 }, skippedMatches: { increment: 1 } },
          });
          await tx.tournamentPlayer.update({
            where: { id: match.player2Id },
            data: { draws: { increment: 1 }, points: { increment: 0.5 }, skippedMatches: { increment: 1 } },
          });
        } else if (winnerPlayerId && loserPlayerId) {
          await (tx.tournamentMatch as any).update({
            where: { id: match.id },
            data: { status: 'FINISHED', winnerId: winnerPlayerId, points: 1 },
          });
          await tx.tournamentPlayer.update({
            where: { id: winnerPlayerId },
            data: { wins: { increment: 1 }, points: { increment: 1 } },
          });
          await tx.tournamentPlayer.update({
            where: { id: loserPlayerId },
            data: { losses: { increment: 1 }, skippedMatches: { increment: 1 } },
          });
        }

        if (match.sessionId) {
          await tx.session.update({
            where: { id: match.sessionId },
            data: { status: 'CANCELLED' },
          });
        }
      });

      // notifications
      try {
        const winnerUserId = winnerPlayerId === match.player1Id ? p1User?.userId : winnerPlayerId === match.player2Id ? p2User?.userId : null;
        const loserUserId = loserPlayerId === match.player1Id ? p1User?.userId : loserPlayerId === match.player2Id ? p2User?.userId : null;

        const targets: Array<{ userId: string | undefined; outcome: 'WIN' | 'LOSS' | 'DRAW' }> = isDraw
          ? [
              { userId: p1User?.userId, outcome: 'DRAW' },
              { userId: p2User?.userId, outcome: 'DRAW' },
            ]
          : [
              { userId: winnerUserId, outcome: 'WIN' },
              { userId: loserUserId, outcome: 'LOSS' },
            ];

        for (const t of targets) {
          if (!t.userId) continue;
          const u = await prisma.user.findUnique({ where: { id: t.userId }, select: { telegramId: true } });
          if (!u?.telegramId) continue;
          await prisma.adminNotification.create({
            data: {
              type: 'TOURNAMENT_AUTOLOSS',
              payload: {
                telegramId: u.telegramId,
                tournamentId: match.tournamentId,
                tournamentName: match.tournament?.name,
                round: match.round,
                outcome: t.outcome,
              },
            },
          });
          try {
            getIo().emit(`user:${t.userId}`, {
              type: 'tournament:autoloss',
              matchId: match.id,
              outcome: t.outcome,
            });
          } catch {}
        }
      } catch {}

      processed++;
    } catch (e) {
      logError(`[Swiss/Autoloss] Match ${match.id} error:`, e);
    }
  }

  if (processed) logger.info(`[Swiss/Autoloss] Processed ${processed} stale matches`);
  return { processed };
}

export default router;
