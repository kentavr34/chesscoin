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

const router = Router();

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

    const matches = await (prisma.tournamentMatch as any).findMany({
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

    res.json({ matches });
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
        return res.status(400).json({ error: "COUNTRY_REQUIRED", message: "Для участия в Чемпионате Страны необходимо вступить в страну. Перейди в раздел Войны и выбери страну." });
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
          await tx.user.update({
            where: { id: req.userId },
            data: { balance: { decrement: tournament.entryFee } },
          });
          await tx.transaction.create({
            data: { userId: req.userId, type: TransactionType.TOURNAMENT_ENTRY, amount: -(tournament.entryFee as bigint), payload: { tournamentId: tournament.id } },
          });
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
    if (!amount || BigInt(amount) <= 0n) return res.status(400).json({ error: "Сумма обязательна" });

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
// T1-T6: Основная функция матчмейкинга турнира
// Находит свободного соперника, создаёт реальный приватный батл,
// уведомляет обоих игроков через socket и бота
// ─────────────────────────────────────────────────────────────────────────────
async function runTournamentMatchmaking(
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

  // Определяем раунд
  const lastMatch = await prisma.tournamentMatch.findFirst({
    where: { tournamentId },
    orderBy: { round: 'desc' },
  });
  const round = lastMatch ? lastMatch.round + 1 : 1;

  // T1: Q1 fix — session + match в одной транзакции (атомарно)
  const chess = new Chess();
  const sessionCode = nanoid(8).toUpperCase();

  const { session, match } = await prisma.$transaction(async (tx: import("@prisma/client").Prisma.TransactionClient) => {
    const session = await tx.session.create({
      data: {
        status: 'WAITING_FOR_OPPONENT',
        type: 'BATTLE',
        isPrivate: true, // T5: не показывать в публичном списке батлов
        fen: chess.fen(),
        pgn: '',
        code: sessionCode,
        sides: {
          create: [
            { playerId: userId, status: 'WAITING_FOR_OPPONENT', isWhite: true },
          ],
        },
        activeUsers: { connect: [{ id: userId }] },
      },
    });

    // T1: Сохраняем матч с sessionId в той же транзакции
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

  // T2: Socket-уведомление обоим игрокам (если онлайн)
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
    // Уведомляем игрока 1 (только что вступил)
    getIo().emit(`user:${userId}`, { ...notifyPayload, opponentName: opponent.user?.firstName ?? 'Соперник' });
    // Уведомляем игрока 2 (соперник)
    getIo().emit(`user:${opponent.userId}`, { ...notifyPayload, opponentName: myUser?.firstName ?? 'Соперник' });
  } catch {}

  // T3: AdminNotification для бота — если игрок оффлайн
  for (const [playerId, telegramId, oppName] of [
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
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // T4: 24ч
        },
      },
    });
  }

  logger.info(`[Tournaments] Match created: ${userId} vs ${opponent.userId} — session ${session.id} code ${sessionCode}`);
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

      // Определяем кто не ответил — player2 (соперник, которому был отправлен вызов)
      // player1 создал батл и ожидал, player2 должен был принять
      const forfeitPlayerId = match.player2Id;
      const winnerId = match.player1Id;

      // Присуждаем победу player1
      await prisma.tournamentMatch.update({
        where: { id: match.id },
        data: {
          status: 'FINISHED',
          winnerId,
        },
      });

      // Обновляем статистику игроков
      await prisma.tournamentPlayer.update({
        where: { id: winnerId },
        data: { wins: { increment: 1 }, points: { increment: 1 } },
      });
      await prisma.tournamentPlayer.update({
        where: { id: forfeitPlayerId },
        data: { losses: { increment: 1 }, skippedMatches: { increment: 1 } },
      });

      // Отменяем сессию
      if (match.sessionId) {
        await prisma.session.update({
          where: { id: match.sessionId },
          data: { status: 'CANCELLED' },
        });
      }

      // Look up player2 name for logging
      const player2 = await prisma.tournamentPlayer.findUnique({
        where: { id: forfeitPlayerId },
        include: { user: { select: { firstName: true } } },
      });
      logger.info(`[Tournaments] Forfeit: match ${match.id} — ${player2?.user?.firstName ?? 'Unknown'} auto-lost`);
    } catch (err: unknown) {
      logger.error(`[Tournaments] Forfeit error for match ${match.id}:`, err);
    }
  }
}

export default router;
