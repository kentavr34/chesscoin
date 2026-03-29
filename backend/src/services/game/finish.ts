import { SessionStatus, SessionType, SessionSideStatus, TransactionType } from "@prisma/client";
import { logger, logError } from "@/lib/logger";
import type { SessionWithSides } from "@/types/db"; // R1 // Q2
import { prisma } from "@/lib/prisma";
import config from "@/config";
import { updateBalance, canEmit, getCurrentPhase } from "@/services/economy";
import { activateReferral, applyReferralIncome } from "@/services/referral";
import { deleteCachedSession } from "./session";
import { checkGameAchievements, checkJarvisAchievement, checkWarAchievements } from "@/services/achievements";
import { checkGameTasks } from "@/services/gameTasks"; // BUG #1 fix

// ─────────────────────────────────────────
// Завершить сессию
// ─────────────────────────────────────────
export const finishSession = async (
  sessionId: string,
  status: SessionStatus,
  opts: {
    winnerSideId?: string;
    loserSideId?: string;
    isDraw?: boolean;
  } = {}
) => {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { sides: { include: { player: true } } },
  });

  if (!session) {
    logger.error("[finishSession] Session not found:", sessionId);
    throw new Error(`Session ${sessionId} not found`);
  }

  if (session.status === SessionStatus.FINISHED ||
      session.status === SessionStatus.DRAW ||
      session.status === SessionStatus.TIME_EXPIRED) {
    return session; // уже завершена
  }

  const { winnerSideId, loserSideId, isDraw = false } = opts;

  // Wraps in a transaction to ensure all core database changes succeed atomically
  const finished = await prisma.$transaction(async (tx) => {
    // 1. Рассчитываем выплаты
    await processPayouts(session, winnerSideId, loserSideId, isDraw, tx);

    // 2. Обновляем стороны
    if (isDraw) {
      await tx.sessionSide.updateMany({
        where: { sessionId },
        data: { status: SessionSideStatus.DRAW },
      });
    } else if (winnerSideId && loserSideId) {
      await tx.sessionSide.update({
        where: { id: winnerSideId },
        data: { status: SessionSideStatus.WON },
      });
      await tx.sessionSide.update({
        where: { id: loserSideId },
        data: { status: SessionSideStatus.LOST },
      });
    }

    // 3. Обновляем сессию
    const updatedSession = await tx.session.update({
      where: { id: sessionId },
      data: {
        status,
        finishedAt: new Date(),
        winnerSideId: isDraw ? null : winnerSideId,
      },
      include: { sides: { include: { player: true } } },
    });

    // 4. Убираем из активных сессий пользователей
    for (const side of session.sides) {
      if (!side.isBot) {
        await tx.user.update({
          where: { id: side.playerId },
          data: { activeSessions: { disconnect: { id: sessionId } } },
        });
      }
    }

    // 5. Обновляем ELO (для батлов)
    if (session.type === SessionType.BATTLE && !isDraw && winnerSideId) {
      const wSide = session.sides.find(s => s.id === winnerSideId);
      const lSide = session.sides.find(s => s.id === loserSideId);
      if (wSide && lSide) {
        await updateElo(wSide.playerId, lSide.playerId, tx);
      }
    }

    return updatedSession;
  });

  // 6. Активируем реферала (при первой завершённой партии)
  for (const side of session.sides) {
    if (!side.isBot) {
      // fire-and-forget — не блокирует ответ клиенту
      setImmediate(() => activateReferral(side.playerId).catch(err => logError("[finish]", err)));
    }
  }

  // 7. Чистим Redis кеш
  await deleteCachedSession(sessionId);

  // 8. Обновляем WarBattle если сессия является частью войны между странами
  setImmediate(() => updateWarBattle(sessionId, winnerSideId, isDraw).catch(err => logError("[finish]", err)));

  return finished;
};

// ─────────────────────────────────────────
// Обновление статуса военной дуэли
// ─────────────────────────────────────────
async function updateWarBattle(sessionId: string, winnerSideId?: string, isDraw: boolean = false) {
  try {
    const warBattle = await prisma.warBattle.findUnique({
      where: { sessionId },
      include: { war: true },
    });
    if (!warBattle) return; // не военная партия

    if (isDraw) {
      await prisma.warBattle.update({
        where: { id: warBattle.id },
        data: { status: "FINISHED", finishedAt: new Date() },
      });
      return;
    }

    if (!winnerSideId) return;

    // Определяем победителя среди участников войны
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { sides: true },
    });
    if (!session) return;

    const winnerSide = session.sides.find((s: Record<string,unknown>) => s.id === winnerSideId);
    if (!winnerSide) return;

    const winnerId = winnerSide.playerId;
    const winnerMembership = await prisma.countryMember.findUnique({
      where: { userId: winnerId },
    });
    const winnerCountryId = winnerMembership?.countryId ?? null;

    const loserId = warBattle.attackerId === winnerId ? warBattle.defenderId : warBattle.attackerId;
    const loserMembership = await prisma.countryMember.findUnique({
      where: { userId: loserId },
    });

    // Обновляем WarBattle
    await prisma.warBattle.update({
      where: { id: warBattle.id },
      data: { status: "FINISHED", finishedAt: new Date(), winnerId, winnerCountryId },
    });

    // Обновляем счёт войны
    const isAttackerWon = winnerCountryId === warBattle.attackerCountryId;
    await prisma.countryWar.update({
      where: { id: warBattle.warId },
      data: isAttackerWon
        ? { attackerWins: { increment: 1 } }
        : { defenderWins: { increment: 1 } },
    });

    // Обновляем warWins/warLosses у бойцов
    if (winnerMembership) {
      await prisma.countryMember.update({
        where: { id: winnerMembership.id },
        data: { warWins: { increment: 1 } },
      });
    }
    if (loserMembership) {
      await prisma.countryMember.update({
        where: { id: loserMembership.id },
        data: { warLosses: { increment: 1 } },
      });
    }

    // Начисляем prizePerWin в казну победившей страны
    const prize = warBattle.war.prizePerWin ?? 0n;
    if (winnerCountryId && prize > 0n) {
      await prisma.country.update({
        where: { id: winnerCountryId },
        data: { treasury: { increment: prize } },
      });
    }

    logger.info(`[WarBattle] Battle ${warBattle.id} finished: winner=${winnerId} country=${winnerCountryId}`);

    // Триггер автоматического матчмейкинга — заполнить освободившийся слот
    import("@/services/game/warMatchmaking")
      .then((m) => m.onWarBattleComplete(warBattle.warId))
      .catch((err) => logError("[WarBattle] matchmaking trigger error:", err));
  } catch (err: unknown) {
    logError("[WarBattle] updateWarBattle error:", err);
  }
}

// ─────────────────────────────────────────
// Расчёт выплат по типу игры
// ─────────────────────────────────────────
const processPayouts = async (
  session: SessionWithSides,
  winnerSideId?: string,
  loserSideId?: string,
  isDraw: boolean = false,
  tx?: import("@prisma/client").Prisma.TransactionClient
) => {
  const phase = await getCurrentPhase();

  switch (session.type) {
    case SessionType.BOT:
      await processBotPayouts(session, winnerSideId, loserSideId, isDraw, phase, tx);
      break;

    case SessionType.BATTLE:
      await processBattlePayouts(session, winnerSideId, loserSideId, isDraw, tx);
      break;

    case SessionType.FRIENDLY:
      // Дружеские игры: только монеты за фигуры (Фаза 1)
      // Уже начислены в процессе игры
      break;
  }
};

// ─────────────────────────────────────────
// Выплаты за игру с ботом
// ─────────────────────────────────────────
const processBotPayouts = async (
  session: SessionWithSides,
  winnerSideId?: string,
  loserSideId?: string,
  isDraw: boolean = false,
  phase: number = 1,
  tx?: import("@prisma/client").Prisma.TransactionClient
) => {
  if (isDraw) return;

  const winnerSide = session.sides.find((s: Record<string,unknown>) => s.id === winnerSideId);
  const loserSide = session.sides.find((s: Record<string,unknown>) => s.id === loserSideId);
  if (!winnerSide || !loserSide) return;

  const humanSide = winnerSide.isBot ? loserSide : winnerSide;
  const humanWon = !winnerSide.isBot;

  if (phase === 1) {
    // Фаза 1: победа над ботом = монеты из эмиссии
    if (humanWon && session.botLevel) {
      const botReward = config.economy.botRewards[session.botLevel] ?? 1000n;
      // Монеты за фигуры уже начислены во время игры
      // Здесь начисляем только финальный бонус за победу
      await updateBalance(
        humanSide.playerId,
        botReward,
        TransactionType.BOT_WIN,
        { sessionId: session.id, botLevel: session.botLevel },
        { isEmission: true, tx }
      );

      const db = tx ?? prisma;
      // Записываем winningAmount для отображения в GameResultModal
      await db.sessionSide.update({
        where: { id: humanSide.id },
        data: { winningAmount: botReward },
      });

      // fire-and-forget — не блокирует завершение игры
      setImmediate(() => applyReferralIncome(humanSide.playerId, botReward).catch(err => logError("[finish]", err)));
      // BUG #1 fix: проверяем геймплейные задания
      setImmediate(() => checkGameTasks(humanSide.playerId, 'BOT', humanWon).catch(err => logError("[finish/tasks]", err)));

      // Начислить JARVIS бейдж — СИНХРОННО, до отправки game:over на клиент,
      // чтобы /auth/me вернул уже обновлённый jarvisLevel
      try {
        const JARVIS_NAMES: Record<number, string> = {
            1: 'Beginner', 2: 'Rookie', 3: 'Player', 4: 'Challenger', 5: 'Fighter',
            6: 'Guardian', 7: 'Warrior', 8: 'Knight', 9: 'Expert', 10: 'Tactician',
            11: 'Master', 12: 'Grandmaster', 13: 'Professional', 14: 'Champion', 15: 'Elite',
            16: 'Epic', 17: 'Legendary', 18: 'Immortal', 19: 'Divine', 20: 'Mystic',
          };
          const lvl = session.botLevel ?? 1;
          const badgeName = JARVIS_NAMES[lvl] ?? 'Beginner';
          const db = tx ?? prisma;
          const player = await db.user.findUnique({ where: { id: humanSide.playerId } });
          if (player) {
            const alreadyHas = player.jarvisBadges.includes(badgeName);
            const nextLevel = Math.min(20, lvl + 1);  // J2: расширено до 20
          const badgeDates = ((player as unknown as { jarvisBadgeDates: Record<string, string> }).jarvisBadgeDates) || {};
          if (!alreadyHas) badgeDates[badgeName] = new Date().toISOString().split('T')[0];
          await db.user.update({
            where: { id: humanSide.playerId },
            data: {
              jarvisLevel: player.jarvisLevel <= lvl ? nextLevel : player.jarvisLevel,
              jarvisBadges: alreadyHas ? undefined : { push: badgeName },
              jarvisBadgeDates: badgeDates,
            },
          });
          logger.info(`[JARVIS] Badge '` + badgeName + `' awarded, next level: ` + nextLevel);
        }
      } catch (e) {
        logError('[JARVIS] Badge error:', e);
      }
    }
    // Проигрыш боту в фазе 1 — ничего не снимаем
  } else {
    // Фаза 2+: победитель получает награду из резерва, проигравший ничего не теряет
    if (session.botLevel && humanWon) {
      const botReward = config.economy.botRewards[session.botLevel] ?? 1000n;
      await updateBalance(
        humanSide.playerId,
        botReward,
        TransactionType.BOT_WIN,
        { sessionId: session.id },
        { isEmission: false, tx }
      );
    }
    // При проигрыше боту — только теряется попытка, монеты не снимаются
  }
};

// ─────────────────────────────────────────
// Выплаты за батл
// ─────────────────────────────────────────
const processBattlePayouts = async (
  session: SessionWithSides,
  winnerSideId?: string,
  loserSideId?: string,
  isDraw: boolean = false,
  tx?: import("@prisma/client").Prisma.TransactionClient
) => {
  const bet = session.bet ?? 0n;
  const totalPot = bet * 2n;
  const commission = (totalPot * BigInt(config.economy.battleCommissionPercent)) / 100n;
  const winnerPayout = totalPot - commission;

  if (isDraw) {
    // Ничья: каждый получает свою ставку обратно (без комиссии)
    for (const side of session.sides) {
      await updateBalance(
        side.playerId,
        bet,
        TransactionType.BATTLE_BET,
        { sessionId: session.id, result: "draw" },
        { tx }
      );
    }
    return;
  }

  const winnerSide = session.sides.find((s: Record<string,unknown>) => s.id === winnerSideId);
  // FIX #1: loserSide не была определена — вызывало ReferenceError при начислении достижений
  const loserSide = session.sides.find((s: Record<string,unknown>) => s.id === loserSideId);
  if (!winnerSide) return;

  // Победитель получает весь банк минус комиссия
  await updateBalance(
    winnerSide.playerId,
    winnerPayout,
    TransactionType.BATTLE_WIN,
    {
      sessionId: session.id,
      totalPot: totalPot.toString(),
      commission: commission.toString(),
    },
    { tx }
  );

  // B1: Донат-пул зрителей → победителю
  const donationPool = session.donationPool ?? 0n;
  if (donationPool > 0n) {
    await updateBalance(
      winnerSide.playerId,
      donationPool,
      TransactionType.BATTLE_WIN,
      { sessionId: session.id, reason: 'spectator_donation_payout' },
      { tx }
    );
  }

  const db = tx ?? prisma;
  // Записываем winningAmount в SessionSide (для GameResultModal)
  await db.sessionSide.update({
    where: { id: winnerSide.id },
    data: { winningAmount: winnerPayout },
  });

  // Комиссия идёт на счёт платформы (platform_reserve увеличивается)
  await db.platformConfig.update({
    where: { id: "singleton" },
    data: { platformReserve: { increment: commission } },
  });

  // Уведомление победителю через бота (MP-6)
  const winnerPlayer = winnerSide.player as any;
  if (winnerPlayer?.telegramId) {
    await db.adminNotification.create({
      data: {
        type: "GAME_WIN",
        payload: {
          winnerTelegramId: winnerPlayer.telegramId,
          winnerName: winnerPlayer.firstName,
          amount: winnerPayout.toString(),
          commission: commission.toString(),
          gameType: "BATTLE",
        },
      },
    }).catch(() => {}); // не критично — игра должна завершиться
  }

  // Реферальный % — fire-and-forget, не блокирует выплату
  setImmediate(() => applyReferralIncome(winnerSide.playerId, winnerPayout).catch(err => logError("[finish]", err)));
  // BUG #1 fix: проверяем геймплейные задания для победителя и проигравшего
  setImmediate(() => checkGameTasks(winnerSide.playerId, 'BATTLE', true).catch(err => logError("[finish/tasks]", err)));
  if (loserSide) {
    setImmediate(() => checkGameTasks(loserSide!.playerId, 'BATTLE', false).catch(err => logError("[finish/tasks]", err)));
  }

  // Достижения — fire-and-forget
  setImmediate(async () => {
    try {
      await checkGameAchievements(winnerSide.playerId);
      // FIX #1: loserSide теперь определена выше
      if (loserSide) await checkGameAchievements(loserSide.playerId);
      // FIX #2: SessionType.WAR не существует — военные дуэли создаются как BATTLE.
      // Проверяем наличие warBattle-записи, чтобы понять что это военная партия.
      const warBattle = await prisma.warBattle.findUnique({ where: { sessionId: session.id } });
      if (warBattle) {
        await checkWarAchievements(winnerSide.playerId);
      }
      // JARVIS: проверяем уровень бота
      if (session.botLevel && session.botLevel >= 20) {
        await checkJarvisAchievement(winnerSide.playerId, session.botLevel);
      }
    } catch (e) {
      logError('[finish/achievements]', e);
    }
  });
};

// ─────────────────────────────────────────
// Обновление ELO (упрощённая формула К=32)
// ─────────────────────────────────────────
const updateElo = async (winnerId: string, loserId: string, tx?: import("@prisma/client").Prisma.TransactionClient) => {
  const K = 32;
  const db = tx ?? prisma;

  const [winner, loser] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: winnerId }, select: { elo: true } }),
    db.user.findUniqueOrThrow({ where: { id: loserId }, select: { elo: true } }),
  ]);

  const expectedWinner = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400));
  const expectedLoser = 1 - expectedWinner;

  const newWinnerElo = Math.round(winner.elo + K * (1 - expectedWinner));
  const newLoserElo = Math.max(100, Math.round(loser.elo + K * (0 - expectedLoser)));

  await Promise.all([
    db.user.update({ where: { id: winnerId }, data: { elo: newWinnerElo } }),
    db.user.update({ where: { id: loserId }, data: { elo: newLoserElo } }),
  ]);
};
