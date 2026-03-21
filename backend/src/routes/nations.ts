import { Router, Request, Response } from "express";
import { logger, logError } from "@/lib/logger";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";
import { updateBalance } from "@/services/economy";
import { TransactionType } from "@prisma/client";
import { getIo } from "@/lib/io"; // Q7 fix: no circular dependency

export const nationsRouter = Router();

// ─── GET /api/v1/nations/clans ────────────────────────────────────────────────
nationsRouter.get("/clans", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const clans = await prisma.clan.findMany({
      include: {
        _count: { select: { members: { where: { isPending: false } } } },
        members: {
          where: { userId },
          select: { role: true, contribution: true, warWins: true, warLosses: true, isPending: true },
        },
      },
      orderBy: { elo: "desc" },
    });

    const result = clans.map((clan: Record<string,unknown>) => ({
      ...clan,
      memberCount: ((clan._count as Record<string,unknown>)?.members as number | undefined) ?? 0,
      myMembership: (clan.members as Array<Record<string,unknown>> | undefined)?.[0] ?? null,
      members: undefined,
    }));

    res.json({ clans: result });
  } catch (err: unknown) {
    logger.error("[nations/clans]", err);
    res.status(500).json({ error: "Ошибка загрузки сборных" });
  }
});

// ─── GET /api/v1/nations/my ───────────────────────────────────────────────────
nationsRouter.get("/my", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const membership = await prisma.clanMember.findUnique({ where: { userId } });
    if (!membership) return res.json({ clan: null });

    const clan = await prisma.clan.findUnique({
      where: { id: membership.clanId },
      include: {
        _count: { select: { members: { where: { isPending: false } } } },
        warsAsAttacker: { where: { status: "IN_PROGRESS" }, take: 1, include: { defenderClan: true } },
        warsAsDefender: { where: { status: "IN_PROGRESS" }, take: 1, include: { attackerClan: true } },
      },
    });
    if (!clan) return res.json({ clan: null });

    const activeWar = clan.warsAsAttacker[0] || clan.warsAsDefender[0] || null;

    res.json({ clan, membership, activeWar });
  } catch (err: unknown) {
    logger.error("[nations/my]", err);
    res.status(500).json({ error: "Ошибка" });
  }
});

// ─── GET /api/v1/nations/members ─────────────────────────────────────────────
nationsRouter.get("/members", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const membership = await prisma.clanMember.findUnique({ where: { userId } });
    if (!membership) return res.status(400).json({ error: "Вы не в клане" });

    const members = await prisma.clanMember.findMany({
      where: { clanId: membership.clanId },
      include: {
        // user relation not defined in schema but we query by userId manually
      },
      orderBy: [{ warWins: "desc" }, { contribution: "desc" }],
    });

    // Fetch user data manually
    const userIds = members.map(m => m.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, username: true, avatar: true, avatarGradient: true, elo: true, league: true, referralCount: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const result = members.map(m => ({
      ...m,
      user: userMap.get(m.userId) ?? null,
    }));

    res.json({ members: result });
  } catch (err: unknown) {
    logger.error("[nations/members]", err);
    res.status(500).json({ error: "Ошибка" });
  }
});

// ─── POST /api/v1/nations/join ────────────────────────────────────────────────
nationsRouter.post("/join", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { clanId, contribution = 0 } = req.body;
    if (!clanId) return res.status(400).json({ error: "clanId обязателен" });
    const userId = req.user!.id;

    const clan = await prisma.clan.findUnique({
      where: { id: clanId },
      include: { _count: { select: { members: { where: { isPending: false } } } } },
    });
    if (!clan) return res.status(404).json({ error: "Сборная не найдена" });

    if (clan._count.members >= clan.maxMembers) {
      return res.status(400).json({ error: "Клан переполнен (максимум 100 бойцов)" });
    }

    const existing = await prisma.clanMember.findUnique({ where: { userId } });
    if (existing) {
      if (existing.clanId === clanId) return res.status(409).json({ error: "Вы уже в этой сборной" });
      return res.status(409).json({ error: "Вы уже состоите в другой сборной" });
    }

    // Если клан без лидера — первый участник становится лидером
    const isFirstMember = clan._count.members === 0;
    const role = isFirstMember ? "COMMANDER" : "SOLDIER";

    const member = await prisma.clanMember.create({
      data: {
        clanId,
        userId,
        role,
        isPending: !isFirstMember && clan.leaderId ? true : false, // ожидает одобрения если есть лидер
        pendingContribution: BigInt(contribution),
      },
    });

    if (isFirstMember) {
      await prisma.clan.update({ where: { id: clanId }, data: { leaderId: userId } });
    }

    res.json({ success: true, pending: member.isPending, clan: { id: clan.id, name: clan.name, flag: clan.flag } });
  } catch (err: unknown) {
    logger.error("[nations/join]", err);
    res.status(500).json({ error: "Ошибка вступления в сборную" });
  }
});

// ─── POST /api/v1/nations/leave ───────────────────────────────────────────────
nationsRouter.post("/leave", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const membership = await prisma.clanMember.findUnique({ where: { userId } });
    if (!membership) return res.status(404).json({ error: "Вы не состоите в сборной" });

    // Возвращаем взнос при выходе
    if (membership.contribution > 0n) {
      await updateBalance(userId, membership.contribution, TransactionType.CLAN_CONTRIBUTION, { reason: "left_clan" });
      await prisma.clan.update({
        where: { id: membership.clanId },
        data: { treasury: { decrement: membership.contribution } },
      });
    }

    // Если лидер уходит — назначаем нового по числу военных побед
    if (membership.role === "COMMANDER") {
      const nextLeader = await prisma.clanMember.findFirst({
        where: { clanId: membership.clanId, userId: { not: userId }, isPending: false },
        orderBy: [{ warWins: "desc" }, { contribution: "desc" }],
      });
      if (nextLeader) {
        await prisma.clan.update({ where: { id: membership.clanId }, data: { leaderId: nextLeader.userId } });
        await prisma.clanMember.update({ where: { id: nextLeader.id }, data: { role: "COMMANDER" } });
      }
    }

    await prisma.clanMember.delete({ where: { userId } });
    res.json({ success: true });
  } catch (err: unknown) {
    logger.error("[nations/leave]", err);
    res.status(500).json({ error: "Ошибка выхода из сборной" });
  }
});

// ─── POST /api/v1/nations/members/:memberId/approve ──────────────────────────
nationsRouter.post("/members/:memberId/approve", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { memberId } = req.params;
    const { approve } = req.body;

    const myMembership = await prisma.clanMember.findUnique({ where: { userId } });
    if (!myMembership || myMembership.role !== "COMMANDER") {
      return res.status(403).json({ error: "Только лидер клана может одобрять участников" });
    }

    const member = await prisma.clanMember.findUnique({ where: { id: memberId } });
    if (!member || member.clanId !== myMembership.clanId || !member.isPending) {
      return res.status(404).json({ error: "Заявка не найдена" });
    }

    if (!approve) {
      await prisma.clanMember.delete({ where: { id: memberId } });
      return res.json({ success: true, approved: false });
    }

    // Подтверждаем — переводим взнос в казну
    await prisma.clanMember.update({
      where: { id: memberId },
      data: { isPending: false, contribution: member.pendingContribution, pendingContribution: 0n },
    });

    if (member.pendingContribution > 0n) {
      await updateBalance(member.userId, BigInt(-Number(member.pendingContribution)), TransactionType.CLAN_CONTRIBUTION, {
        clanId: myMembership.clanId, reason: "join_contribution",
      });
      await prisma.clan.update({
        where: { id: myMembership.clanId },
        data: { treasury: { increment: member.pendingContribution } },
      });
    }

    res.json({ success: true, approved: true });
  } catch (err: unknown) {
    logger.error("[nations/members/approve]", err);
    res.status(500).json({ error: "Ошибка" });
  }
});

// ─── POST /api/v1/nations/members/:userId/kick ───────────────────────────────
nationsRouter.post("/members/:targetUserId/kick", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { targetUserId } = req.params;

    const myMembership = await prisma.clanMember.findUnique({ where: { userId } });
    if (!myMembership || myMembership.role !== "COMMANDER") {
      return res.status(403).json({ error: "Только лидер клана может исключать участников" });
    }

    const target = await prisma.clanMember.findUnique({ where: { userId: targetUserId } });
    if (!target || target.clanId !== myMembership.clanId) {
      return res.status(404).json({ error: "Участник не найден" });
    }

    // Возвращаем взнос исключённому
    if (target.contribution > 0n) {
      await updateBalance(targetUserId, target.contribution, TransactionType.CLAN_CONTRIBUTION, {
        reason: "kicked_from_clan", clanId: myMembership.clanId,
      });
      await prisma.clan.update({
        where: { id: myMembership.clanId },
        data: { treasury: { decrement: target.contribution } },
      });
    }

    await prisma.clanMember.delete({ where: { userId: targetUserId } });

    // Уведомляем через сокет
    try { getIo().emit(`user:${targetUserId}`, { type: "clan:kicked", clanId: myMembership.clanId }); } catch {}

    res.json({ success: true });
  } catch (err: unknown) {
    logger.error("[nations/kick]", err);
    res.status(500).json({ error: "Ошибка" });
  }
});

// ─── POST /api/v1/nations/contribute ─────────────────────────────────────────
nationsRouter.post("/contribute", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amount } = req.body;
    if (!amount || BigInt(amount) <= 0n) return res.status(400).json({ error: "Сумма обязательна" });

    const membership = await prisma.clanMember.findUnique({ where: { userId } });
    if (!membership || membership.isPending) return res.status(400).json({ error: "Вы не в клане или ожидаете одобрения" });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } });
    if (!user || user.balance < BigInt(amount)) return res.status(400).json({ error: "Недостаточно монет" });

    await updateBalance(userId, -BigInt(amount), TransactionType.CLAN_CONTRIBUTION, {
      clanId: membership.clanId, reason: "voluntary_contribution",
    });
    await prisma.clan.update({ where: { id: membership.clanId }, data: { treasury: { increment: BigInt(amount) } } });
    await prisma.clanMember.update({
      where: { userId },
      data: { contribution: { increment: BigInt(amount) } },
    });

    res.json({ success: true });
  } catch (err: unknown) {
    logger.error("[nations/contribute]", err);
    res.status(500).json({ error: "Ошибка взноса" });
  }
});

// ─── POST /api/v1/nations/war/challenge ──────────────────────────────────────
nationsRouter.post("/war/challenge", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { defenderClanId, duration } = req.body; // duration в секундах: 3600|86400|604800|2592000

    const myMembership = await prisma.clanMember.findUnique({ where: { userId } });
    if (!myMembership || myMembership.role !== "COMMANDER") {
      return res.status(403).json({ error: "Только лидер клана может объявлять войну" });
    }

    const attackerClan = await prisma.clan.findUnique({ where: { id: myMembership.clanId } });
    const defenderClan = await prisma.clan.findUnique({ where: { id: defenderClanId } });
    if (!attackerClan || !defenderClan) return res.status(404).json({ error: "Клан не найден" });

    if (attackerClan.id === defenderClan.id) return res.status(400).json({ error: "Нельзя объявить войну самим себе" });

    // Проверяем наличие офицера (минимум лейтенант) в атакующем клане
    const officerRanks = ["LIEUTENANT", "SR_LIEUTENANT", "CAPTAIN", "MAJOR", "LT_COLONEL", "COLONEL", "BRIGADIER", "MAJ_GENERAL", "LT_GENERAL", "COL_GENERAL", "MARSHAL", "EMPEROR"];
    const clanMemberIds = await prisma.clanMember.findMany({
      where: { clanId: myMembership.clanId, isPending: false },
      select: { userId: true },
    });
    const officerUser = clanMemberIds.length > 0
      ? await prisma.user.findFirst({
          where: { id: { in: clanMemberIds.map(m => m.userId) }, militaryRank: { in: officerRanks } },
          select: { id: true },
        })
      : null;
    if (!officerUser) {
      return res.status(403).json({ error: "Для объявления войны в клане должен быть хотя бы один офицер (Лейтенант и выше)" });
    }

    // Проверяем нет ли уже активной войны
    const existing = await prisma.clanWar.findFirst({
      where: {
        status: "IN_PROGRESS",
        OR: [
          { attackerClanId: attackerClan.id },
          { defenderClanId: attackerClan.id },
        ],
      },
    });
    if (existing) return res.status(400).json({ error: "У вашего клана уже есть активная война" });

    const validDurations = [3600, 86400, 604800, 2592000];
    const warDuration = validDurations.includes(duration) ? duration : 86400;
    const prize = attackerClan.treasury;
    const endAt = new Date(Date.now() + warDuration * 1000);

    const war = await prisma.clanWar.create({
      data: {
        attackerClanId: attackerClan.id,
        defenderClanId: defenderClan.id,
        isPending: true,
        duration: warDuration,
        endAt,
        prize,
        attackerTreasury: attackerClan.treasury,
        betPerPlayer: 0n,
        status: "IN_PROGRESS",
      },
    });

    // Уведомляем лидера защищающегося клана
    if (defenderClan.leaderId) {
      try {
        getIo().emit(`user:${defenderClan.leaderId}`, {
          type: "clan:war_challenge",
          war: { id: war.id, attackerName: attackerClan.name, attackerFlag: attackerClan.flag, prize: prize.toString(), duration: warDuration },
        });
      } catch {}
    }

    res.json({ success: true, war });
  } catch (err: unknown) {
    logger.error("[nations/war/challenge]", err);
    res.status(500).json({ error: "Ошибка объявления войны" });
  }
});

// ─── POST /api/v1/nations/war/:id/accept ─────────────────────────────────────
nationsRouter.post("/war/:id/accept", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const myMembership = await prisma.clanMember.findUnique({ where: { userId } });
    if (!myMembership || myMembership.role !== "COMMANDER") {
      return res.status(403).json({ error: "Только лидер клана может принять вызов" });
    }

    const war = await prisma.clanWar.findUnique({
      where: { id },
      include: {
        attackerClan: { select: { id: true, name: true, flag: true, treasury: true } },
        defenderClan: { select: { id: true, name: true, flag: true, treasury: true } },
      },
    });

    if (!war || !war.isPending) return res.status(404).json({ error: "Вызов не найден" });
    if (war.defenderClanId !== myMembership.clanId) return res.status(403).json({ error: "Не ваш вызов" });

    const totalPrize = war.attackerClan.treasury + war.defenderClan.treasury;

    await prisma.clanWar.update({
      where: { id },
      data: {
        isPending: false,
        defenderTreasury: war.defenderClan.treasury,
        prize: totalPrize,
      },
    });

    // Публикуем в канал
    await publishWarToChannel(war.attackerClan, war.defenderClan, war, totalPrize);

    // Уведомляем всех участников обоих кланов
    const attackerMembers = await prisma.clanMember.findMany({
      where: { clanId: war.attackerClanId, isPending: false },
    });
    const defenderMembers = await prisma.clanMember.findMany({
      where: { clanId: war.defenderClanId, isPending: false },
    });

    [...attackerMembers, ...defenderMembers].forEach(m => {
      try {
        getIo().emit(`user:${m.userId}`, {
          type: "clan:war_started",
          warId: id,
          attackerName: war.attackerClan.name,
          defenderName: war.defenderClan.name,
          attackerFlag: war.attackerClan.flag,
          defenderFlag: war.defenderClan.flag,
          prize: totalPrize.toString(),
        });
      } catch {}
    });

    res.json({ success: true });
  } catch (err: unknown) {
    logger.error("[nations/war/accept]", err);
    res.status(500).json({ error: "Ошибка принятия вызова" });
  }
});

// ─── GET /api/v1/nations/wars ─────────────────────────────────────────────────
nationsRouter.get("/wars", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const wars = await prisma.clanWar.findMany({
      where: { status: "IN_PROGRESS", isPending: false },
      include: {
        attackerClan: { select: { name: true, flag: true, countryCode: true, elo: true, treasury: true } },
        defenderClan: { select: { name: true, flag: true, countryCode: true, elo: true, treasury: true } },
      },
      orderBy: { prize: "desc" },
    });
    res.json({ wars });
  } catch (err: unknown) {
    logger.error("[nations/wars]", err);
    res.status(500).json({ error: "Ошибка загрузки войн" });
  }
});

// ─── GET /api/v1/nations/war-challenges ──────────────────────────────────────
nationsRouter.get("/war-challenges", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const membership = await prisma.clanMember.findUnique({ where: { userId } });
    if (!membership) return res.json({ challenges: [] });

    const challenges = await prisma.clanWar.findMany({
      where: { defenderClanId: membership.clanId, isPending: true },
      include: {
        attackerClan: { select: { name: true, flag: true, elo: true, treasury: true } },
      },
      orderBy: { startedAt: "desc" },
    });
    res.json({ challenges });
  } catch (err: unknown) {
    res.status(500).json({ error: "Ошибка" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLAN BATTLES — командные соревнования
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /api/v1/nations/battle/challenge ────────────────────────────────────
// Любой член клана может создать вызов, НО в клане должен быть хотя бы 1 OFFICER
nationsRouter.post("/battle/challenge", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { defenderClanId, duration, bet } = req.body;
    // duration: секунды от 3600 (1ч) до 2592000 (30 дней)
    if (!defenderClanId || !duration || !bet) {
      return res.status(400).json({ error: "defenderClanId, duration и bet обязательны" });
    }

    const myMembership = await prisma.clanMember.findUnique({ where: { userId } });
    if (!myMembership || myMembership.isPending) {
      return res.status(403).json({ error: "Вы не состоите в клане" });
    }

    // Правило: в клане должен быть хотя бы 1 офицер (OFFICER или COMMANDER)
    const hasOfficer = await prisma.clanMember.findFirst({
      where: {
        clanId: myMembership.clanId,
        isPending: false,
        role: { in: ["OFFICER", "COMMANDER"] },
      },
    });
    if (!hasOfficer) {
      return res.status(403).json({
        error: "Для вызова на сражение в клане должен быть хотя бы один офицер (лейтенант)",
      });
    }

    const challengerClan = await prisma.clan.findUnique({ where: { id: myMembership.clanId } });
    const defenderClan   = await prisma.clan.findUnique({ where: { id: defenderClanId } });
    if (!challengerClan || !defenderClan) return res.status(404).json({ error: "Клан не найден" });
    if (challengerClan.id === defenderClan.id) return res.status(400).json({ error: "Нельзя вызвать свой клан" });

    // Не более 3 одновременных активных вызовов от одного клана
    const activeChallenges = await prisma.clanBattle.count({
      where: {
        challengerClanId: challengerClan.id,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    });
    if (activeChallenges >= 3) {
      return res.status(400).json({ error: "У вашего клана уже 3 активных сражения" });
    }

    const validMin = 3600;
    const validMax = 2592000;
    const battleDuration = Math.max(validMin, Math.min(validMax, Number(duration)));
    const endAt = new Date(Date.now() + battleDuration * 1000);

    const battle = await prisma.clanBattle.create({
      data: {
        challengerClanId: challengerClan.id,
        defenderClanId:   defenderClan.id,
        duration:         battleDuration,
        endAt,
        status:           "PENDING",
        maxSimultaneous:  10,
      },
    });

    // Инициатор автоматически вносит ставку
    const betAmount = BigInt(bet);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } });
    if (!user || user.balance < betAmount) {
      await prisma.clanBattle.delete({ where: { id: battle.id } });
      return res.status(400).json({ error: "Недостаточно монет" });
    }

    await updateBalance(userId, -betAmount, TransactionType.CLAN_CONTRIBUTION, {
      reason: "clan_battle_bet", battleId: battle.id,
    });
    await prisma.clanBattleContribution.create({
      data: { battleId: battle.id, userId, clanId: challengerClan.id, amount: betAmount },
    });
    await prisma.clanBattle.update({
      where: { id: battle.id },
      data: { pool: betAmount },
    });

    // Уведомляем лидера защищающегося клана
    if (defenderClan.leaderId) {
      try {
        getIo().emit(`user:${defenderClan.leaderId}`, {
          type: "clan:battle_challenge",
          battle: {
            id: battle.id,
            challengerName: challengerClan.name,
            challengerFlag: challengerClan.flag,
            bet: betAmount.toString(),
            duration: battleDuration,
          },
        });
      } catch {}
    }

    res.json({ success: true, battle });
  } catch (err: unknown) {
    logger.error("[nations/battle/challenge]", err);
    res.status(500).json({ error: "Ошибка создания вызова" });
  }
});

// ─── POST /api/v1/nations/battle/:id/join ─────────────────────────────────────
// Участник из любого клана вносит ставку, чтобы участвовать в батле
nationsRouter.post("/battle/:id/join", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { bet } = req.body;
    if (!bet) return res.status(400).json({ error: "bet обязателен" });

    const membership = await prisma.clanMember.findUnique({ where: { userId } });
    if (!membership || membership.isPending) return res.status(403).json({ error: "Вы не в клане" });

    const battle = await prisma.clanBattle.findUnique({ where: { id } });
    if (!battle) return res.status(404).json({ error: "Сражение не найдено" });
    if (battle.status !== "PENDING" && battle.status !== "IN_PROGRESS") {
      return res.status(400).json({ error: "Сражение недоступно для вступления" });
    }

    // Проверяем, что игрок из одного из кланов-участников
    if (membership.clanId !== battle.challengerClanId && membership.clanId !== battle.defenderClanId) {
      return res.status(403).json({ error: "Вы не состоите ни в одном из кланов-участников" });
    }

    // Нельзя вносить дважды
    const existing = await prisma.clanBattleContribution.findUnique({
      where: { battleId_userId: { battleId: id, userId } },
    });
    if (existing) return res.status(409).json({ error: "Вы уже участвуете в этом сражении" });

    const betAmount = BigInt(bet);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } });
    if (!user || user.balance < betAmount) return res.status(400).json({ error: "Недостаточно монет" });

    await updateBalance(userId, -betAmount, TransactionType.CLAN_CONTRIBUTION, {
      reason: "clan_battle_join", battleId: id,
    });
    await prisma.clanBattleContribution.create({
      data: { battleId: id, userId, clanId: membership.clanId, amount: betAmount },
    });
    await prisma.clanBattle.update({
      where: { id },
      data: { pool: { increment: betAmount } },
    });

    // Если батл ещё PENDING — переводим в IN_PROGRESS когда есть участники из обоих кланов
    if (battle.status === "PENDING") {
      const contribs = await prisma.clanBattleContribution.findMany({ where: { battleId: id } });
      const hasBoth = contribs.some((c: Record<string,unknown>) => c.clanId === battle.challengerClanId) &&
                      contribs.some((c: Record<string,unknown>) => c.clanId === battle.defenderClanId);
      if (hasBoth) {
        await prisma.clanBattle.update({
          where: { id },
          data: { status: "IN_PROGRESS", startedAt: new Date() },
        });
      }
    }

    res.json({ success: true, pool: (BigInt(battle.pool) + betAmount).toString() });
  } catch (err: unknown) {
    logger.error("[nations/battle/join]", err);
    res.status(500).json({ error: "Ошибка вступления в сражение" });
  }
});

// ─── POST /api/v1/nations/battle/:id/start-game ───────────────────────────────
// Участник начинает партию против соперника из другого клана в рамках батла
nationsRouter.post("/battle/:id/start-game", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { opponentId } = req.body;
    if (!opponentId) return res.status(400).json({ error: "opponentId обязателен" });

    const battle = await prisma.clanBattle.findUnique({ where: { id } });
    if (!battle || battle.status !== "IN_PROGRESS") {
      return res.status(400).json({ error: "Сражение не активно" });
    }

    // Проверяем лимит одновременных партий
    if (battle.activeGames >= battle.maxSimultaneous) {
      return res.status(400).json({
        error: `Достигнут лимит одновременных партий (${battle.maxSimultaneous}). Дождитесь завершения текущих.`,
      });
    }

    // Оба игрока должны быть участниками сражения
    const myContrib = await prisma.clanBattleContribution.findUnique({
      where: { battleId_userId: { battleId: id, userId } },
    });
    const oppContrib = await prisma.clanBattleContribution.findUnique({
      where: { battleId_userId: { battleId: id, userId: opponentId } },
    });
    if (!myContrib || !oppContrib) {
      return res.status(400).json({ error: "Оба игрока должны вступить в сражение" });
    }

    // Они должны быть из разных кланов
    if (myContrib.clanId === oppContrib.clanId) {
      return res.status(400).json({ error: "Нельзя играть против игрока своего клана" });
    }

    // Создаём запись (реальная сессия создаётся через socket game:create:battle)
    await prisma.clanBattle.update({
      where: { id },
      data: { activeGames: { increment: 1 }, totalGames: { increment: 1 } },
    });

    res.json({ success: true, battleId: id });
  } catch (err: unknown) {
    logger.error("[nations/battle/start-game]", err);
    res.status(500).json({ error: "Ошибка старта партии" });
  }
});

// ─── POST /api/v1/nations/battle/:id/record-result ───────────────────────────
// Вызывается из game finish, записывает результат партии в батл
nationsRouter.post("/battle/:id/record-result", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sessionId, winnerId, winnerClanId, player1Id, player2Id, clan1Id, clan2Id } = req.body;

    const battle = await prisma.clanBattle.findUnique({ where: { id } });
    if (!battle || battle.status !== "IN_PROGRESS") return res.status(400).json({ error: "Батл не активен" });

    // Записываем игру
    await prisma.clanBattleGame.upsert({
      where: { sessionId },
      update: { winnerId, winnerClanId, status: "FINISHED", finishedAt: new Date() },
      create: {
        battleId: id, sessionId,
        player1Id, player2Id, clan1Id, clan2Id,
        winnerId, winnerClanId, status: "FINISHED", finishedAt: new Date(),
      },
    });

    // Обновляем счёт
    const updateData: Record<string, unknown> = { activeGames: { decrement: 1 } };
    if (winnerClanId === battle.challengerClanId) updateData.challengerWins = { increment: 1 };
    else if (winnerClanId === battle.defenderClanId)  updateData.defenderWins = { increment: 1 };

    await prisma.clanBattle.update({ where: { id }, data: updateData });

    res.json({ success: true });
  } catch (err: unknown) {
    logger.error("[nations/battle/record-result]", err);
    res.status(500).json({ error: "Ошибка записи результата" });
  }
});

// ─── GET /api/v1/nations/battles ──────────────────────────────────────────────
nationsRouter.get("/battles", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const battles = await prisma.clanBattle.findMany({
      where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
      include: {
        challengerClan: { select: { id: true, name: true, flag: true, countryCode: true, elo: true } },
        defenderClan:   { select: { id: true, name: true, flag: true, countryCode: true, elo: true } },
        _count: { select: { contributions: true, games: true } },
      },
      orderBy: { pool: "desc" },
    });
    res.json({ battles });
  } catch (err: unknown) {
    logger.error("[nations/battles]", err);
    res.status(500).json({ error: "Ошибка загрузки сражений" });
  }
});

// ─── GET /api/v1/nations/battle/:id ───────────────────────────────────────────
nationsRouter.get("/battle/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const battle = await prisma.clanBattle.findUnique({
      where: { id },
      include: {
        challengerClan: { select: { id: true, name: true, flag: true, elo: true } },
        defenderClan:   { select: { id: true, name: true, flag: true, elo: true } },
        contributions:  true,
        games:          { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!battle) return res.status(404).json({ error: "Сражение не найдено" });

    const myContrib = battle.contributions.find((c: Record<string,unknown>) => c.userId === userId) ?? null;

    res.json({
      battle: {
        ...battle,
        pool: battle.pool.toString(),
        contributions: battle.contributions.map((c: Record<string,unknown>) => ({ ...c, amount: (c.amount as bigint | string)?.toString() ?? "0" })),
        myContribution: myContrib ? { ...myContrib, amount: myContrib.amount.toString() } : null,
      },
    });
  } catch (err: unknown) {
    logger.error("[nations/battle/:id]", err);
    res.status(500).json({ error: "Ошибка загрузки сражения" });
  }
});

// ─── POST /api/v1/nations/battle/:id/settle ───────────────────────────────────
// Ручное завершение (или вызывается из крона)
nationsRouter.post("/battle/:id/settle", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const myMembership = await prisma.clanMember.findUnique({ where: { userId } });
    if (!myMembership || myMembership.role !== "COMMANDER") {
      return res.status(403).json({ error: "Только лидер клана может досрочно завершить сражение" });
    }

    const battle = await prisma.clanBattle.findUnique({
      where: { id },
      include: { contributions: true },
    });
    if (!battle || battle.status !== "IN_PROGRESS") {
      return res.status(400).json({ error: "Сражение не активно" });
    }

    await settleClanBattle(battle);
    res.json({ success: true });
  } catch (err: unknown) {
    logger.error("[nations/battle/settle]", err);
    res.status(500).json({ error: "Ошибка завершения сражения" });
  }
});

// ─── POST /api/v1/nations/challenge-player ───────────────────────────────────
nationsRouter.post("/challenge-player", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { targetUserId, bet } = req.body;
    if (!targetUserId || !bet) return res.status(400).json({ error: "targetUserId и bet обязательны" });

    // Создаём приватный батл-вызов
    const socket = require("@/api/socket");
    // Уведомляем целевого игрока
    getIo().emit(`user:${targetUserId}`, {
      type: "battle:challenge",
      from: userId,
      bet: String(bet),
    });

    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: "Ошибка отправки вызова" });
  }
});

// ─── Расчёт и выплата клановых батлов ─────────────────────────────────────────
export async function settleClanBattle(battle: Record<string,unknown>) {
  if (battle.status === "FINISHED" || battle.status === "CANCELLED") return;

  // Определяем победителя по числу побед
  const chWins = battle.challengerWins as number;
  const defWins = battle.defenderWins as number;

  let winnerClanId: string | null = null;
  let loserClanId: string | null = null;
  if (chWins > defWins) {
    winnerClanId = battle.challengerClanId as string | null;
    loserClanId  = battle.defenderClanId as string | null;
  } else if (defWins > chWins) {
    winnerClanId = battle.defenderClanId as string | null;
    loserClanId  = battle.challengerClanId as string | null;
  }
  // ничья = winnerClanId null → возврат взносов

  await prisma.clanBattle.update({
    where: { id: battle.id },
    data: {
      status:      "FINISHED",
      winnerClanId,
      finishedAt: new Date(),
    },
  });

  const contributions: Array<{ id: string; userId: string; clanId: string; amount: bigint | string; battleId: string }> = (battle.contributions as Array<{ id: string; userId: string; clanId: string; amount: bigint | string; battleId: string }> | undefined) ?? await prisma.clanBattleContribution.findMany({
    where: { battleId: battle.id },
  });

  const totalPool = contributions.reduce<bigint>((s, c) => s + BigInt(c.amount as string | bigint), 0n);

  if (totalPool === 0n) return;

  // ─── Ничья — возврат взносов всем участникам ───────────────────────────────
  if (!winnerClanId) {
    for (const c of contributions) {
      const refund = BigInt(c.amount as string | bigint);
      await updateBalance(c.userId as string, refund, TransactionType.CLAN_WAR_WIN, {
        reason: "clan_battle_draw_refund", battleId: battle.id,
      });
      await prisma.clanBattleContribution.update({
        where: { id: c.id },
        data: { paidOut: true, paidAmount: refund as bigint },
      });
      // Уведомляем игрока
      await prisma.adminNotification.create({
        data: {
          type: "CLAN_BATTLE_RESULT",
          payload: {
            userId: c.userId,
            result: "draw",
            battleId: battle.id,
            refund: refund.toString(),
          },
        },
      });
    }
    getIo().emit("clan:battle_finished", {
      battleId: battle.id, winnerClanId: null, pool: totalPool.toString(),
      challengerWins: chWins, defenderWins: defWins,
    });
    return;
  }

  // ─── Разделяем участников на победителей и проигравших ────────────────────
  const winners = contributions.filter((c) => c.clanId === winnerClanId);
  const losers  = contributions.filter((c) => c.clanId === loserClanId);

  // loserTreasury — сумма взносов проигравших (ставки проигравшего клана)
  const loserTreasury = losers.reduce<bigint>((s, c) => s + BigInt(c.amount as string | bigint), 0n);

  if (loserTreasury === 0n) {
    // Нет взносов у проигравших — возвращаем победителям их взносы
    for (const c of winners) {
      const refund = BigInt(c.amount as string | bigint);
      await updateBalance(c.userId as string, refund, TransactionType.CLAN_WAR_WIN, {
        reason: "clan_battle_win_no_prize", battleId: battle.id,
      });
      await prisma.clanBattleContribution.update({
        where: { id: c.id },
        data: { paidOut: true, paidAmount: refund as bigint },
      });
    }
    getIo().emit("clan:battle_finished", {
      battleId: battle.id, winnerClanId, pool: totalPool.toString(),
      challengerWins: chWins, defenderWins: defWins,
    });
    return;
  }

  // ─── Расчёт призового фонда ────────────────────────────────────────────────
  // 10% комиссия с казны проигравших
  const commission = (loserTreasury as unknown as bigint) * 10n / 100n;
  const prizePool  = (loserTreasury as unknown as bigint) - commission;

  // ─── Получаем статистику побед каждого победителя в этом батле ────────────
  const winnerPlayerWins = await prisma.clanBattleGame.groupBy({
    by: ["winnerId"],
    where: {
      battleId: battle.id,
      winnerClanId,
      winnerId: { not: null },
    },
    _count: { winnerId: true },
  });
  // Преобразуем в Map: userId → winCount
  const winsMap = new Map<string, number>(
    winnerPlayerWins.map((r: Record<string,unknown> & { winnerId?: string; _count?: { winnerId?: number }; userId?: string; firstName?: string; telegramId?: string }) => [r.winnerId, (r._count as Record<string,unknown> | undefined)?.winnerId as number ?? 0])
  );

  // Сортируем победителей по числу побед (по убыванию)
  const sortedWinners = [...winners].sort((a, b) => {
    const wa = winsMap.get(a.userId as string) ?? 0;
    const wb = winsMap.get(b.userId as string) ?? 0;
    return wb - wa;
  });

  const first  = sortedWinners[0] ?? null;
  const second = sortedWinners[1] ?? null;
  const third  = sortedWinners[2] ?? null;

  // Призовые суммы для топ-3
  const prize1 = first  ? prizePool * 20n / 100n : 0n; // 20%
  const prize2 = second ? prizePool * 10n / 100n : 0n; // 10%
  const prize3 = third  ? prizePool *  5n / 100n : 0n; // 5%
  // Остаток (~65%) делится пропорционально по взносам среди всех победителей
  const topPrizesTotal = prize1 + prize2 + prize3;
  const restPool = prizePool - topPrizesTotal;

  const totalWinnerContrib = winners.reduce<bigint>((s, c) => s + BigInt(c.amount as string | bigint), 0n);

  // ─── Выплаты победителям ───────────────────────────────────────────────────
  for (const c of sortedWinners) {
    // Возврат собственного взноса + доля от prizePool
    const ownContrib = BigInt((c as Record<string,unknown> & { amount: string | bigint }).amount as string);
    let topPrize = 0n;
    if (first  && c.userId === first.userId)  topPrize = prize1;
    if (second && c.userId === second.userId) topPrize = prize2;
    if (third  && c.userId === third.userId)  topPrize = prize3;

    const propShare = totalWinnerContrib > 0n
      ? (restPool * ownContrib) / totalWinnerContrib
      : 0n;

    const totalPayout = ownContrib + topPrize + propShare;

    await updateBalance(c.userId as string, totalPayout, TransactionType.CLAN_WAR_WIN, {
      reason: "clan_battle_win",
      battleId: battle.id,
      winnerClanId,
      topPrize: topPrize.toString(),
      propShare: propShare.toString(),
      total: totalPayout.toString(),
    });
    await prisma.clanBattleContribution.update({
      where: { id: c.id },
      data: { paidOut: true, paidAmount: totalPayout },
    });

    // Уведомляем победителя
    const rank = c.userId === first?.userId ? 1
      : c.userId === second?.userId ? 2
      : c.userId === third?.userId  ? 3
      : null;
    await prisma.adminNotification.create({
      data: {
        type: "CLAN_BATTLE_RESULT",
        payload: {
          userId: c.userId,
          result: "win",
          battleId: battle.id,
          rank,
          wins: winsMap.get(c.userId as string) ?? 0,
          topPrize: topPrize.toString(),
          propShare: propShare.toString(),
          total: totalPayout.toString(),
        },
      },
    });
  }

  // ─── Проигравшие: ставки сгорают, уведомляем о поражении ─────────────────
  for (const c of losers) {
    await prisma.clanBattleContribution.update({
      where: { id: c.id },
      data: { paidOut: true, paidAmount: 0n },
    });
    await prisma.adminNotification.create({
      data: {
        type: "CLAN_BATTLE_RESULT",
        payload: {
          userId: c.userId,
          result: "loss",
          battleId: battle.id,
          lost: BigInt((c as Record<string,unknown> & { amount: string | bigint }).amount as string).toString(),
        },
      },
    });
  }

  // ─── Финальный emit ────────────────────────────────────────────────────────
  getIo().emit("clan:battle_finished", {
    battleId: battle.id,
    winnerClanId,
    pool: totalPool.toString(),
    prizePool: prizePool.toString(),
    commission: commission.toString(),
    challengerWins: chWins,
    defenderWins: defWins,
  });
}

// ─── Публикация войны в Telegram-канал ────────────────────────────────────────
async function publishWarToChannel(attacker: Record<string,unknown>, defender: Record<string,unknown>, war: Record<string,unknown> & { duration?: number; attackerClanId?: string; defenderClanId?: string; attackerCountryId?: string; defenderCountryId?: string; id?: string }, prize: bigint) { // TAIL-3
  const botToken = process.env.BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!botToken || !channelId) return;

  const durationText = (war.duration as number) < 3600 ? `${(war.duration as number) / 60} мин` :
    (war.duration as number) < 86400 ? `${(war.duration as number) / 3600} ч` :
    (war.duration as number) < 604800 ? `${(war.duration as number) / 86400} дн` : `${Math.round((war.duration as number) / 604800)} нед`;

  const text = `⚔️ <b>Клановая война началась!</b>\n\n` +
    `${attacker.flag as string} <b>${attacker.name}</b> vs ${defender.flag as string} <b>${defender.name}</b>\n\n` +
    `💰 На кону: <b>${(Number(prize) / 1000).toFixed(1)}K ᚙ</b>\n` +
    `⏰ Время: <b>${durationText}</b>\n\n` +
    `<a href="https://t.me/chessgamecoin_bot">Вступи в клан и сражайся!</a>`;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: channelId, text, parse_mode: "HTML" }),
    });
    await prisma.clanWar.update({ where: { id: war.id }, data: { isPublished: true } });
  } catch {}
}
