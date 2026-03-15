import { SessionStatus, SessionType, SessionSideStatus, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import config from "@/config";
import { updateBalance, canEmit, getCurrentPhase } from "@/services/economy";
import { activateReferral, applyReferralIncome } from "@/services/referral";
import { deleteCachedSession } from "./session";

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
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: { sides: { include: { player: true } } },
  });

  if (session.status === SessionStatus.FINISHED ||
      session.status === SessionStatus.DRAW ||
      session.status === SessionStatus.TIME_EXPIRED) {
    return session; // уже завершена
  }

  const { winnerSideId, loserSideId, isDraw = false } = opts;

  // 1. Рассчитываем выплаты
  await processPayouts(session, winnerSideId, loserSideId, isDraw);

  // 2. Обновляем стороны
  if (isDraw) {
    await prisma.sessionSide.updateMany({
      where: { sessionId },
      data: { status: SessionSideStatus.DRAW },
    });
  } else if (winnerSideId && loserSideId) {
    await prisma.sessionSide.update({
      where: { id: winnerSideId },
      data: { status: SessionSideStatus.WON },
    });
    await prisma.sessionSide.update({
      where: { id: loserSideId },
      data: { status: SessionSideStatus.LOST },
    });
  }

  // 3. Обновляем сессию
  const finished = await prisma.session.update({
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
      await prisma.user.update({
        where: { id: side.playerId },
        data: { activeSessions: { disconnect: { id: sessionId } } },
      });
    }
  }

  // 5. Обновляем ELO (для батлов)
  if (session.type === SessionType.BATTLE && !isDraw && winnerSideId) {
    const winnerSide = session.sides.find(s => s.id === winnerSideId);
    const loserSide = session.sides.find(s => s.id === loserSideId);
    if (winnerSide && loserSide) {
      await updateElo(winnerSide.playerId, loserSide.playerId);
    }
  }

  // 6. Активируем реферала (при первой завершённой партии)
  for (const side of session.sides) {
    if (!side.isBot) {
      // fire-and-forget — не блокирует ответ клиенту
      setImmediate(() => activateReferral(side.playerId).catch(console.error));
    }
  }

  // 7. Чистим Redis кеш
  await deleteCachedSession(sessionId);

  // 8. Обновляем WarBattle если сессия является частью войны между странами
  setImmediate(() => updateWarBattle(sessionId, winnerSideId, isDraw).catch(console.error));

  return finished;
};

// ─────────────────────────────────────────
// Обновление статуса военной дуэли
// ─────────────────────────────────────────
async function updateWarBattle(sessionId: string, winnerSideId?: string, isDraw: boolean = false) {
  try {
    const warBattle = await (prisma as any).warBattle.findUnique({
      where: { sessionId },
      include: { war: true },
    });
    if (!warBattle) return; // не военная партия

    if (isDraw) {
      await (prisma as any).warBattle.update({
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

    const winnerSide = session.sides.find((s: any) => s.id === winnerSideId);
    if (!winnerSide) return;

    const winnerId = winnerSide.playerId;
    const winnerMembership = await (prisma as any).countryMember.findUnique({
      where: { userId: winnerId },
    });
    const winnerCountryId = winnerMembership?.countryId ?? null;

    const loserId = warBattle.attackerId === winnerId ? warBattle.defenderId : warBattle.attackerId;
    const loserMembership = await (prisma as any).countryMember.findUnique({
      where: { userId: loserId },
    });

    // Обновляем WarBattle
    await (prisma as any).warBattle.update({
      where: { id: warBattle.id },
      data: { status: "FINISHED", finishedAt: new Date(), winnerId, winnerCountryId },
    });

    // Обновляем счёт войны
    const isAttackerWon = winnerCountryId === warBattle.attackerCountryId;
    await (prisma as any).countryWar.update({
      where: { id: warBattle.warId },
      data: isAttackerWon
        ? { attackerWins: { increment: 1 } }
        : { defenderWins: { increment: 1 } },
    });

    // Обновляем warWins/warLosses у бойцов
    if (winnerMembership) {
      await (prisma as any).countryMember.update({
        where: { id: winnerMembership.id },
        data: { warWins: { increment: 1 } },
      });
    }
    if (loserMembership) {
      await (prisma as any).countryMember.update({
        where: { id: loserMembership.id },
        data: { warLosses: { increment: 1 } },
      });
    }

    // Начисляем prizePerWin в казну победившей страны
    const prize = warBattle.war.prizePerWin ?? 0n;
    if (winnerCountryId && prize > 0n) {
      await (prisma as any).country.update({
        where: { id: winnerCountryId },
        data: { treasury: { increment: prize } },
      });
    }

    console.log(`[WarBattle] Battle ${warBattle.id} finished: winner=${winnerId} country=${winnerCountryId}`);
  } catch (err) {
    console.error("[WarBattle] updateWarBattle error:", err);
  }
}

// ─────────────────────────────────────────
// Расчёт выплат по типу игры
// ─────────────────────────────────────────
const processPayouts = async (
  session: any,
  winnerSideId?: string,
  loserSideId?: string,
  isDraw: boolean = false
) => {
  const phase = await getCurrentPhase();

  switch (session.type) {
    case SessionType.BOT:
      await processBotPayouts(session, winnerSideId, loserSideId, isDraw, phase);
      break;

    case SessionType.BATTLE:
      await processBattlePayouts(session, winnerSideId, loserSideId, isDraw);
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
  session: any,
  winnerSideId?: string,
  loserSideId?: string,
  isDraw: boolean = false,
  phase: number = 1
) => {
  if (isDraw) return;

  const winnerSide = session.sides.find((s: any) => s.id === winnerSideId);
  const loserSide = session.sides.find((s: any) => s.id === loserSideId);
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
        { isEmission: true }
      );

      // Записываем winningAmount для отображения в GameResultModal
      await prisma.sessionSide.update({
        where: { id: humanSide.id },
        data: { winningAmount: botReward },
      });

      // fire-and-forget — не блокирует завершение игры
      setImmediate(() => applyReferralIncome(humanSide.playerId, botReward).catch(console.error));

      // Начислить JARVIS бейдж — СИНХРОННО, до отправки game:over на клиент,
      // чтобы /auth/me вернул уже обновлённый jarvisLevel
      try {
        const JARVIS_NAMES: Record<number, string> = {
          1: 'Beginner', 2: 'Player', 3: 'Fighter', 4: 'Warrior', 5: 'Expert',
          6: 'Master', 7: 'Professional', 8: 'Epic', 9: 'Legendary', 10: 'Mystic',
        };
        const lvl = session.botLevel ?? 1;
        const badgeName = JARVIS_NAMES[lvl] ?? 'Beginner';
        const player = await prisma.user.findUnique({ where: { id: humanSide.playerId } });
        if (player) {
          const alreadyHas = player.jarvisBadges.includes(badgeName);
          const nextLevel = Math.min(10, lvl + 1);
          const badgeDates = ((player as any).jarvisBadgeDates as Record<string, string>) || {};
          if (!alreadyHas) badgeDates[badgeName] = new Date().toISOString().split('T')[0];
          await prisma.user.update({
            where: { id: humanSide.playerId },
            data: {
              jarvisLevel: player.jarvisLevel <= lvl ? nextLevel : player.jarvisLevel,
              jarvisBadges: alreadyHas ? undefined : { push: badgeName },
              jarvisBadgeDates: badgeDates,
            },
          });
          console.log(`[JARVIS] Badge '` + badgeName + `' awarded, next level: ` + nextLevel);
        }
      } catch (e) {
        console.error('[JARVIS] Badge error:', e);
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
        { isEmission: false }
      );
    }
    // При проигрыше боту — только теряется попытка, монеты не снимаются
  }
};

// ─────────────────────────────────────────
// Выплаты за батл
// ─────────────────────────────────────────
const processBattlePayouts = async (
  session: any,
  winnerSideId?: string,
  loserSideId?: string,
  isDraw: boolean = false
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
        { sessionId: session.id, result: "draw" }
      );
    }
    return;
  }

  const winnerSide = session.sides.find((s: any) => s.id === winnerSideId);
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
    }
  );

  // Записываем winningAmount в SessionSide (для GameResultModal)
  await prisma.sessionSide.update({
    where: { id: winnerSide.id },
    data: { winningAmount: winnerPayout },
  });

  // Комиссия идёт на счёт платформы (platform_reserve увеличивается)
  await prisma.platformConfig.update({
    where: { id: "singleton" },
    data: { platformReserve: { increment: commission } },
  });

  // Уведомление победителю через бота (MP-6)
  const winnerPlayer = winnerSide.player;
  if (winnerPlayer?.telegramId) {
    await prisma.adminNotification.create({
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
  setImmediate(() => applyReferralIncome(winnerSide.playerId, winnerPayout).catch(console.error));
};

// ─────────────────────────────────────────
// Обновление ELO (упрощённая формула К=32)
// ─────────────────────────────────────────
const updateElo = async (winnerId: string, loserId: string) => {
  const K = 32;

  const [winner, loser] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: winnerId }, select: { elo: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: loserId }, select: { elo: true } }),
  ]);

  const expectedWinner = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400));
  const expectedLoser = 1 - expectedWinner;

  const newWinnerElo = Math.round(winner.elo + K * (1 - expectedWinner));
  const newLoserElo = Math.max(100, Math.round(loser.elo + K * (0 - expectedLoser)));

  await Promise.all([
    prisma.user.update({ where: { id: winnerId }, data: { elo: newWinnerElo } }),
    prisma.user.update({ where: { id: loserId }, data: { elo: newLoserElo } }),
  ]);
};
