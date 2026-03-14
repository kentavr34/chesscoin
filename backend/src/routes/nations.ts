import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";
import { updateBalance } from "@/services/economy";
import { TransactionType } from "@prisma/client";
import { io } from "@/index";

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

    const result = clans.map((clan) => ({
      ...clan,
      memberCount: clan._count.members,
      myMembership: clan.members[0] ?? null,
      members: undefined,
    }));

    res.json({ clans: result });
  } catch (err) {
    console.error("[nations/clans]", err);
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
  } catch (err) {
    console.error("[nations/my]", err);
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
  } catch (err) {
    console.error("[nations/members]", err);
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
  } catch (err) {
    console.error("[nations/leave]", err);
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
      await updateBalance(member.userId, -member.pendingContribution, TransactionType.CLAN_CONTRIBUTION, {
        clanId: myMembership.clanId, reason: "join_contribution",
      });
      await prisma.clan.update({
        where: { id: myMembership.clanId },
        data: { treasury: { increment: member.pendingContribution } },
      });
    }

    res.json({ success: true, approved: true });
  } catch (err) {
    console.error("[nations/members/approve]", err);
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
    try { io.emit(`user:${targetUserId}`, { type: "clan:kicked", clanId: myMembership.clanId }); } catch {}

    res.json({ success: true });
  } catch (err) {
    console.error("[nations/kick]", err);
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
  } catch (err) {
    console.error("[nations/contribute]", err);
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
        io.emit(`user:${defenderClan.leaderId}`, {
          type: "clan:war_challenge",
          war: { id: war.id, attackerName: attackerClan.name, attackerFlag: attackerClan.flag, prize: prize.toString(), duration: warDuration },
        });
      } catch {}
    }

    res.json({ success: true, war });
  } catch (err) {
    console.error("[nations/war/challenge]", err);
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
        io.emit(`user:${m.userId}`, {
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
  } catch (err) {
    console.error("[nations/war/accept]", err);
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
  } catch (err) {
    console.error("[nations/wars]", err);
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
  } catch (err) {
    res.status(500).json({ error: "Ошибка" });
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
    io.emit(`user:${targetUserId}`, {
      type: "battle:challenge",
      from: userId,
      bet: String(bet),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка отправки вызова" });
  }
});

// ─── Публикация войны в Telegram-канал ────────────────────────────────────────
async function publishWarToChannel(attacker: any, defender: any, war: any, prize: bigint) {
  const botToken = process.env.BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!botToken || !channelId) return;

  const durationText = war.duration < 3600 ? `${war.duration / 60} мин` :
    war.duration < 86400 ? `${war.duration / 3600} ч` :
    war.duration < 604800 ? `${war.duration / 86400} дн` : `${Math.round(war.duration / 604800)} нед`;

  const text = `⚔️ <b>Клановая война началась!</b>\n\n` +
    `${attacker.flag} <b>${attacker.name}</b> vs ${defender.flag} <b>${defender.name}</b>\n\n` +
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
