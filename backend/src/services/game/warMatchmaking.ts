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
// PR-1: 15 минут на сторону (Кенан 2026-05-17). Было 10. Причина: онлайн-связь
// в Telegram WebView лагает, 10 мин жёстко не хватало при таймауте на ход.
const WAR_SESSION_DURATION = 900;
// PR-1: дедлайн «успеть принять и сыграть» — 24ч. Превышение → форфейт через
// processWarAutoloss (crons.ts): при двойном неответе проигрывает чей был ход.
const WAR_ACCEPT_DEADLINE_MS = 24 * 60 * 60 * 1000;
// PR-1: лимит параллельных партий на игрока со ВСЕХ источников
// (война + турнир + личные вызовы). 1 партия от каждого источника + общий
// потолок 3, чтобы боец войны не задыхался от десятков параллельных партий.
const MAX_PARALLEL_SESSIONS_PER_USER = 3;

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

    // PR-1: фильтр «≤3 параллельных партий на игрока со всех источников».
    // Считаем активные WAITING_FOR_OPPONENT/IN_PROGRESS сессии каждого свободного
    // бойца — если уже 3, в эту волну его не берём (получит следующий слот).
    const candidates = [...new Set([...freeAttackers, ...freeDefenders])];
    const sessionCounts = await prisma.session.groupBy({
      by: ["currentSideId"], // dummy — нужен лишь where
      where: {
        status: { in: ["WAITING_FOR_OPPONENT", "IN_PROGRESS"] },
        sides: { some: { playerId: { in: candidates } } },
      },
      _count: { _all: true },
    }).catch(() => [] as any[]); // groupBy через relation не работает напрямую — fallback ниже

    // Прямой подсчёт через sides (надёжнее groupBy через relation)
    const sidesActive = await prisma.sessionSide.findMany({
      where: {
        playerId: { in: candidates },
        session: { status: { in: ["WAITING_FOR_OPPONENT", "IN_PROGRESS"] } },
      },
      select: { playerId: true },
    });
    const activeCount = new Map<string, number>();
    for (const s of sidesActive) {
      activeCount.set(s.playerId, (activeCount.get(s.playerId) ?? 0) + 1);
    }
    void sessionCounts;

    const isFree = (uid: string) => (activeCount.get(uid) ?? 0) < MAX_PARALLEL_SESSIONS_PER_USER;
    const freeAttackersLimited = freeAttackers.filter(isFree);
    const freeDefendersLimited = freeDefenders.filter(isFree);
    if (freeAttackersLimited.length === 0 || freeDefendersLimited.length === 0) return 0;

    // Ротация: сортируем по количеству сыгранных партий (кто играл меньше — первый)
    const playedCounts = await getPlayedCounts(warId);

    const sortedAttackers = sortByPlayed(freeAttackersLimited, playedCounts);
    const sortedDefenders = sortByPlayed(freeDefendersLimited, playedCounts);

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
          // PR-1: war-партия стартует в WAITING_FOR_OPPONENT и помечена как
          // приватная — видна только обоим участникам в их «Приватных» батлах.
          // В Public LIVE переедет когда оба сделают game:accept_private →
          // acceptedByAll=true + status=IN_PROGRESS.
          status: "WAITING_FOR_OPPONENT",
          type: "BATTLE",
          isPrivate: true,
          sourceType: "WAR",
          sourceRefId: war.id,
          deadlineAt: new Date(Date.now() + WAR_ACCEPT_DEADLINE_MS),
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
                status: "WAITING_FOR_OPPONENT",
                timeLeft: WAR_SESSION_DURATION,
              },
              {
                playerId: defenderUserId,
                isWhite: !attackerIsWhite,
                status: "WAITING_FOR_OPPONENT",
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

  // PR-1: шахматный таймер белых стартует только когда ОБА игрока приняли
  // партию (game:accept_private обоих → acceptedByAll=true). До этого
  // действует только дедлайн 24ч (deadlineAt), форфейт-логика — в crons.

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
// PR-3 (Кенан 2026-05-17): новая логика распределения казны.
//   • Победитель забирает из казны ПРОИГРАВШЕГО сумму = min(treasury_winner,
//     treasury_loser). Это потолок: нельзя выиграть больше, чем у тебя есть.
//   • 10% комиссии платформы.
//   • 20% / 10% / 5% — топ-1/2/3 бойцам по warWinsCurrent.
//   • 65% — остальным пропорционально warWinsCurrent.
//   • Ничья — никто никого не списывает, оба сохраняют казну.
//
// Реализация общая в crons.ts → distributeCountryWarPrize. Здесь вызываем её,
// чтобы избежать дублирования с checkCountryWarResults.
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

  // PR-3: распределение казны min-prize (общая реализация в crons.ts).
  try {
    const { distributeCountryWarPrize } = await import("@/services/crons");
    await (distributeCountryWarPrize as any)(war);
  } catch (e) {
    logError("[finishWar] distributePrize error:", e);
  }

  // Закрываем войну (после распределения, чтобы избежать гонки с checkCountryWarResults)
  await prisma.countryWar.update({
    where: { id: warId },
    data: { status: "FINISHED", finishedAt: new Date(), winnerCountryId },
  });

  // Счётчики стран
  if (winnerCountryId) {
    const loserCountryId = winnerCountryId === war.attackerCountryId
      ? war.defenderCountryId
      : war.attackerCountryId;
    await prisma.country.update({ where: { id: winnerCountryId }, data: { wins: { increment: 1 } } });
    await prisma.country.update({ where: { id: loserCountryId }, data: { losses: { increment: 1 } } });
  }

  logger.info(
    `[WarMatch] War ${warId} finished: ${war.attackerWins}:${war.defenderWins}, winner=${winnerCountryId ?? "DRAW"}`
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
