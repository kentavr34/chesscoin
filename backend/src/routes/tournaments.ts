import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/middleware/auth";
import { updateBalance } from "@/services/economy";
import { TransactionType } from "@prisma/client";

const router = Router();
router.use(authMiddleware);

// Типы турниров
const TOURNAMENT_TYPES = ['WORLD', 'COUNTRY', 'WEEKLY', 'MONTHLY', 'SEASONAL', 'YEARLY'] as const;
type TournamentType = typeof TOURNAMENT_TYPES[number];

const TOURNAMENT_LABELS: Record<TournamentType, string> = {
  WORLD: 'Чемпион Мира',
  COUNTRY: 'Чемпион Страны',
  WEEKLY: 'Чемпион Недели',
  MONTHLY: 'Чемпион Месяца',
  SEASONAL: 'Чемпион Сезона',
  YEARLY: 'Чемпион Года',
};

const TOURNAMENT_ENTRY_FEES: Record<TournamentType, bigint> = {
  WORLD: 10000n,
  COUNTRY: 5000n,
  WEEKLY: 2000n,
  MONTHLY: 5000n,
  SEASONAL: 15000n,
  YEARLY: 50000n,
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
    case 'YEARLY': return String(year);
    case 'WORLD': return `${year}`;
    case 'COUNTRY': return `${year}-${month}`;
  }
}

// Инициализировать системные турниры (вызывается из cron)
export async function ensureSystemTournaments() {
  const types: TournamentType[] = ['WEEKLY', 'MONTHLY', 'SEASONAL', 'YEARLY', 'WORLD'];
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
        case 'YEARLY': endAt = new Date(now.getFullYear() + 1, 0, 1); break;
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
      console.log(`[Tournaments] Created ${type} for period ${period}`);
    }
  }
}

// GET /tournaments — список турниров
router.get("/", async (req, res) => {
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
      tournaments: tournaments.map((t) => ({
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /tournaments/:id — детали турнира с лидербордом
router.get("/:id", async (req, res) => {
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
    if (tournament.status !== "REGISTRATION" && tournament.status !== "IN_PROGRESS") {
      return res.status(400).json({ error: "REGISTRATION_CLOSED" });
    }

    const existing = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: req.userId } },
    });
    if (existing) return res.status(400).json({ error: "ALREADY_JOINED" });

    if (tournament.entryFee > 0n) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
      if (user.balance < tournament.entryFee) {
        return res.status(400).json({ error: "INSUFFICIENT_BALANCE" });
      }
      await updateBalance(req.userId, -tournament.entryFee, TransactionType.TOURNAMENT_ENTRY, {
        tournamentId: tournament.id,
      });
      await prisma.tournament.update({
        where: { id: tournament.id },
        data: {
          prizePool: { increment: tournament.entryFee },
          status: "IN_PROGRESS",
        },
      });
    }

    const newPlayer = await prisma.tournamentPlayer.create({
      data: {
        tournamentId: tournament.id,
        userId: req.userId,
        contribution: tournament.entryFee,
      },
    });

    // Auto-matchmaking: find a random active participant without an ongoing match
    try {
      const activeMatches = await prisma.tournamentMatch.findMany({
        where: {
          tournamentId: tournament.id,
          status: 'IN_PROGRESS',
        },
        select: { player1Id: true, player2Id: true },
      });
      const busyPlayerIds = new Set(activeMatches.flatMap((m) => [m.player1Id, m.player2Id]));

      const candidates = await prisma.tournamentPlayer.findMany({
        where: {
          tournamentId: tournament.id,
          isActive: true,
          id: { not: newPlayer.id },
          userId: { not: req.userId },
        },
      });

      const available = candidates.filter((p) => !busyPlayerIds.has(p.id));
      if (available.length > 0) {
        const opponent = available[Math.floor(Math.random() * available.length)];
        // Determine current round
        const lastMatch = await prisma.tournamentMatch.findFirst({
          where: { tournamentId: tournament.id },
          orderBy: { round: 'desc' },
        });
        const round = lastMatch ? lastMatch.round + 1 : 1;

        await prisma.tournamentMatch.create({
          data: {
            tournamentId: tournament.id,
            player1Id: newPlayer.id,
            player2Id: opponent.id,
            round,
            status: 'IN_PROGRESS',
          },
        });
      }
    } catch (matchErr) {
      console.error('[Tournaments] Auto-matchmaking error:', matchErr);
      // Non-fatal: player still joined successfully
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /tournaments/:id/donate — зрительский донат в казну
router.post("/:id/donate", async (req, res) => {
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /tournaments/:id/leave — выйти из турнира
router.post("/:id/leave", async (req, res) => {
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /tournaments — создать турнир (admin)
router.post("/", async (req, res) => {
  try {
    const adminIds = (process.env.ADMIN_IDS ?? "254450353").split(",").map((s) => s.trim());
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

  if (type === 'YEARLY' || type === 'WORLD') {
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

  console.log(`[Tournaments] Settled ${tournament.type} "${tournament.name}": ${prizes.length} prizes paid from pool ${totalPool}`);
}

export default router;
