/**
 * warMatchmaking.ts — Автоматический матчмейкинг войн между странами
 *
 * Логика:
 * - Максимум 10 одновременных партий в каждой войне
 * - Система распределяет партии среди ВСЕХ бойцов обеих стран
 * - Ротация: все получают шанс до повторных назначений
 * - Когда партия завершается → автоматически стартует следующая
 * - 1 боец может победить 1000 — важен только итоговый счёт за время войны
 */

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getIo } from "@/lib/io";
import { logger, logError } from "@/lib/logger";
import { Chess } from "chess.js";
import { nanoid } from "nanoid";
import { updateBalance } from "@/services/economy";
import { TransactionType } from "@prisma/client";

const MAX_CONCURRENT_BATTLES = 10;
const WAR_MATCHMAKING_LOCK_TTL = 15; // seconds
const WAR_SESSION_DURATION = 600; // 10 min per side

// ─── Ключевая функция: заполнить слоты войны партиями ─────────────────────────
export async function scheduleWarMatches(warId: string): Promise<number> {
  // Acquire lock — предотвращаем дублирование при параллельных вызовах
  const lockKey = `war:matchmaking:lock:${warId}`;
  const locked = await redis.set(lockKey, "1", "EX", WAR_MATCHMAKING_LOCK_TTL, "NX");
  if (!locked) return 0;

  try {
    const war = await prisma.countryWar.findUnique({ where: { id: warId } });
    if (!war || war.status !== "IN_PROGRESS") return 0;
    if (new Date() > war.endAt) return 0;

    // Сколько партий активно сейчас?
    const activeBattles = await prisma.warBattle.count({
      where: { warId, status: "IN_PROGRESS" },
    });
    const slotsAvailable = MAX_CONCURRENT_BATTLES - activeBattles;
    if (slotsAvailable <= 0) return 0;

    // Получить бойцов обеих стран
    const [attackerMembers, defenderMembers] = await Promise.all([
      prisma.countryMember.findMany({
        where: { countryId: war.attackerCountryId },
        select: { userId: true },
      }),
      prisma.countryMember.findMany({
        where: { countryId: war.defenderCountryId },
        select: { userId: true },
      }),
    ]);

    if (attackerMembers.length === 0 || defenderMembers.length === 0) return 0;

    // Получить userId всех бойцов, которые СЕЙЧАС в активной партии этой войны
    const busyBattles = await prisma.warBattle.findMany({
      where: { warId, status: "IN_PROGRESS" },
      select: { attackerId: true, defenderId: true },
    });
    const busyIds = new Set<string>();
    for (const b of busyBattles) {
      busyIds.add(b.attackerId);
      busyIds.add(b.defenderId);
    }

    // Свободные бойцы ИЗ ОЧЕРЕДИ
    const queuedAttackersRaw = await redis.smembers(`war:queue:${warId}:${war.attackerCountryId}`);
    const queuedDefendersRaw = await redis.smembers(`war:queue:${warId}:${war.defenderCountryId}`);

    const freeAttackers = queuedAttackersRaw.filter((id) => !busyIds.has(id));
    const freeDefenders = queuedDefendersRaw.filter((id) => !busyIds.has(id));

    if (freeAttackers.length === 0 || freeDefenders.length === 0) return 0;

    // Ротация: сортируем по количеству сыгранных партий (кто играл меньше — первый)
    const playedCounts = await getPlayedCounts(warId);

    const sortedAttackers = sortByPlayed(freeAttackers, playedCounts);
    const sortedDefenders = sortByPlayed(freeDefenders, playedCounts);

    // Создаём пары
    const matchCount = Math.min(slotsAvailable, sortedAttackers.length, sortedDefenders.length);
    let created = 0;

    for (let i = 0; i < matchCount; i++) {
      const attackerUserId = sortedAttackers[i]!;
      const defenderUserId = sortedDefenders[i]!;

      try {
        await createWarMatch(war, attackerUserId, defenderUserId);
        created++;
      } catch (err) {
        logError(`[WarMatch] Failed to create match ${attackerUserId} vs ${defenderUserId}:`, err);
      }
    }

    if (created > 0) {
      logger.info(
        `[WarMatch] War ${warId}: created ${created} matches (${activeBattles + created}/${MAX_CONCURRENT_BATTLES} active)`
      );
    }

    return created;
  } catch (err) {
    logError("[WarMatch] scheduleWarMatches error:", err);
    return 0;
  } finally {
    await redis.del(lockKey);
  }
}

// ─── Создать одну партию в войне ────────────────────────────────────────────────
async function createWarMatch(
  war: { id: string; attackerCountryId: string; defenderCountryId: string },
  attackerUserId: string,
  defenderUserId: string
) {
  const chess = new Chess();
  const sessionCode = nanoid(8).toUpperCase();

  // Случайный цвет — атакующий не всегда белый
  const attackerIsWhite = Math.random() > 0.5;

  const { session } = await prisma.$transaction(
    async (tx) => {
      const session = await tx.session.create({
        data: {
          status: "IN_PROGRESS",
          type: "BATTLE",
          fen: chess.fen(),
          pgn: "",
          code: sessionCode,
          bet: 0n, // Война бесплатная
          duration: WAR_SESSION_DURATION,
          turnStartedAt: new Date(),
          sides: {
            create: [
              {
                playerId: attackerUserId,
                isWhite: attackerIsWhite,
                status: "IN_PROGRESS",
                timeLeft: WAR_SESSION_DURATION,
              },
              {
                playerId: defenderUserId,
                isWhite: !attackerIsWhite,
                status: "IN_PROGRESS",
                timeLeft: WAR_SESSION_DURATION,
              },
            ],
          },
          activeUsers: {
            connect: [{ id: attackerUserId }, { id: defenderUserId }],
          },
        },
        include: { sides: true },
      });

      // Установить currentSideId — белые ходят первыми
      const whiteSide = session.sides.find(
        (s: Record<string, unknown>) => s.isWhite
      );
      if (whiteSide) {
        await tx.session.update({
          where: { id: session.id },
          data: { currentSideId: whiteSide.id },
        });
      }

      // Создать WarBattle
      await tx.warBattle.create({
        data: {
          warId: war.id,
          sessionId: session.id,
          attackerId: attackerUserId,
          defenderId: defenderUserId,
          attackerCountryId: war.attackerCountryId,
          defenderCountryId: war.defenderCountryId,
        },
      });

      return { session };
    }
  );

  // Уведомить обоих игроков через Socket.io
  const io = getIo();
  for (const userId of [attackerUserId, defenderUserId]) {
    try {
      io.emit(`user:${userId}`, {
        type: "war:match_created",
        sessionId: session.id,
        sessionCode,
        warId: war.id,
        message: "Your war match is ready! Join the battle!",
      });
    } catch {}
  }

  // Удалить из очереди
  await redis.srem(`war:queue:${war.id}:${war.attackerCountryId}`, attackerUserId);
  await redis.srem(`war:queue:${war.id}:${war.defenderCountryId}`, defenderUserId);
  io.to(`war:lobby:${war.id}`).emit("war:queue_update", { countryId: war.attackerCountryId, count: await redis.scard(`war:queue:${war.id}:${war.attackerCountryId}`) });
  io.to(`war:lobby:${war.id}`).emit("war:queue_update", { countryId: war.defenderCountryId, count: await redis.scard(`war:queue:${war.id}:${war.defenderCountryId}`) });

  // Установить таймер для белых
  const whiteSide = session.sides.find(
    (s: Record<string, unknown>) => s.isWhite
  );
  if (whiteSide) {
    const timerKey = `timer:${whiteSide.id}`;
    await redis.setex(timerKey, WAR_SESSION_DURATION, "1");
  }

  return session;
}

// ─── Вызывается после завершения каждой военной партии ──────────────────────────
export async function onWarBattleComplete(warId: string) {
  // Небольшая задержка чтобы БД успела обновиться
  setTimeout(async () => {
    try {
      // Проверить не закончилась ли война по времени
      const war = await prisma.countryWar.findUnique({ where: { id: warId } });
      if (!war || war.status !== "IN_PROGRESS") return;

      if (new Date() > war.endAt) {
        await finishWar(warId);
        return;
      }

      // Заполнить освободившиеся слоты
      await scheduleWarMatches(warId);
    } catch (err) {
      logError("[WarMatch] onWarBattleComplete error:", err);
    }
  }, 2000);
}

// ─── Завершить войну — определить победителя + распределить трофеи ──────────────
//
// Логика распределения (Кенан):
//   • Победители: страна с большим числом побед в войне
//   • Призовой пул = вся казна страны-победителя на момент окончания войны
//     (включая взносы за вступление + донаты)
//   • Каждый боец страны-победителя получает долю пропорционально:
//        weight = wins_in_war * 1000 + contribution
//     То есть и победы за войну, и личный взнос/донат влияют на долю.
//     Победы доминируют (*1000), донаты — корректирующий бонус.
//   • Казна страны-победителя обнуляется → выплачена бойцам.
//   • Проигравшая страна: казна остаётся (пригодится в следующей войне).
//   • Ничья: казна обеих стран сохраняется без выплат.
// ─────────────────────────────────────────────────────────────────────────────
export async function finishWar(warId: string) {
  const war = await prisma.countryWar.findUnique({ where: { id: warId } });
  if (!war || war.status === "FINISHED") return;

  const winnerCountryId =
    war.attackerWins > war.defenderWins
      ? war.attackerCountryId
      : war.defenderWins > war.attackerWins
        ? war.defenderCountryId
        : null;

  let totalPayout = 0n;
  let payoutCount = 0;

  await prisma.$transaction(async (tx) => {
    // 1. Закрываем войну
    await tx.countryWar.update({
      where: { id: warId },
      data: { status: "FINISHED", finishedAt: new Date(), winnerCountryId },
    });

    // 2. Если есть победитель — распределяем казну
    if (winnerCountryId) {
      const country = await tx.country.findUniqueOrThrow({ where: { id: winnerCountryId } });
      const pool = country.treasury;
      if (pool > 0n) {
        // Победы каждого бойца в этой войне
        const battles = await tx.warBattle.findMany({
          where: { warId, status: 'FINISHED', winnerCountryId },
          select: { winnerId: true },
        });
        const winsByUser = new Map<string, number>();
        for (const b of battles) {
          if (b.winnerId) winsByUser.set(b.winnerId, (winsByUser.get(b.winnerId) ?? 0) + 1);
        }

        // Все члены победившей страны (даже без побед — но без вклада не получат)
        const members = await tx.countryMember.findMany({
          where: { countryId: winnerCountryId },
          select: { userId: true, contribution: true },
        });

        // Веса
        let totalWeight = 0n;
        const weights: Array<{ userId: string; weight: bigint }> = [];
        for (const m of members) {
          const wins = BigInt(winsByUser.get(m.userId) ?? 0);
          const w = wins * 1000n + m.contribution;
          if (w > 0n) {
            weights.push({ userId: m.userId, weight: w });
            totalWeight += w;
          }
        }

        // Выплаты
        if (totalWeight > 0n) {
          let distributed = 0n;
          for (let i = 0; i < weights.length; i++) {
            const w = weights[i]!;
            // Последнему — остаток (защита от потерь на округлении)
            const share = i === weights.length - 1
              ? pool - distributed
              : (pool * w.weight) / totalWeight;
            if (share > 0n) {
              await updateBalance(w.userId, share, TransactionType.COUNTRY_WAR_WIN, {
                warId, countryId: winnerCountryId,
                weight: w.weight.toString(),
                totalWeight: totalWeight.toString(),
              }, { tx });
              distributed += share;
              payoutCount++;
            }
          }
          totalPayout = distributed;
        }

        // 3. Казна → 0 (вся выплачена)
        await tx.country.update({
          where: { id: winnerCountryId },
          data: { treasury: 0n, wins: { increment: 1 } },
        });
      }

      // Проигравшей стране — losses++
      const loserCountryId = winnerCountryId === war.attackerCountryId
        ? war.defenderCountryId
        : war.attackerCountryId;
      await tx.country.update({
        where: { id: loserCountryId },
        data: { losses: { increment: 1 } },
      });
    }
  });

  logger.info(
    `[WarMatch] War ${warId} finished: ${war.attackerWins}:${war.defenderWins}, ` +
    `winner=${winnerCountryId ?? "DRAW"}, payout=${totalPayout} to ${payoutCount} fighters`
  );

  // Уведомить всех бойцов обеих стран
  const allMembers = await prisma.countryMember.findMany({
    where: { countryId: { in: [war.attackerCountryId, war.defenderCountryId] } },
    select: { userId: true, countryId: true },
  });

  const io = getIo();
  for (const m of allMembers) {
    try {
      io.emit(`user:${m.userId}`, {
        type: "war:finished",
        warId,
        attackerWins: war.attackerWins,
        defenderWins: war.defenderWins,
        winnerCountryId,
        isWinner: m.countryId === winnerCountryId,
      });
    } catch {}
  }
}

// ─── Утилиты ────────────────────────────────────────────────────────────────────

/** Подсчитать сколько партий каждый боец сыграл в данной войне */
async function getPlayedCounts(warId: string): Promise<Map<string, number>> {
  const battles = await prisma.warBattle.findMany({
    where: { warId },
    select: { attackerId: true, defenderId: true },
  });

  const counts = new Map<string, number>();
  for (const b of battles) {
    counts.set(b.attackerId, (counts.get(b.attackerId) ?? 0) + 1);
    counts.set(b.defenderId, (counts.get(b.defenderId) ?? 0) + 1);
  }
  return counts;
}

/** Сортировка: кто играл меньше — первый (для ротации) */
function sortByPlayed(
  userIds: string[],
  playedCounts: Map<string, number>
): string[] {
  return [...userIds].sort((a, b) => {
    const countA = playedCounts.get(a) ?? 0;
    const countB = playedCounts.get(b) ?? 0;
    if (countA !== countB) return countA - countB; // меньше играл — впереди
    return Math.random() - 0.5; // при равенстве — рандом
  });
}

// ─── Cron: Периодическая проверка всех активных войн ──────────────────────────
export function startWarMatchmakingCron() {
  // Запускать каждые 30 секунд
  setInterval(async () => {
    try {
      const activeWars = await prisma.countryWar.findMany({
        where: { status: "IN_PROGRESS" },
        select: { id: true, endAt: true },
      });

      for (const war of activeWars) {
        if (new Date() > war.endAt) {
          // Война истекла — завершаем
          await finishWar(war.id);
        } else {
          // Заполняем свободные слоты
          await scheduleWarMatches(war.id);
        }
      }
    } catch (err) {
      logError("[WarMatch] Cron error:", err);
    }
  }, 30_000);

  logger.info("[WarMatch] Auto-matchmaking cron started (every 30s)");
}
