/**
 * Scheduled tasks / cron jobs
 * - Hourly: post top battle to Telegram channel
 * - Hourly: check and distribute finished clan war prizes
 * - Weekly/Monthly/Seasonal/Yearly: post tournament results and create new tournaments
 */

import cron from "node-cron";
import { prisma } from "@/lib/prisma";
import { logger, logError } from "@/lib/logger"; // Q2
import type { TournamentWithPlayers } from "@/types/db"; // R1
import { updateBalance } from "@/services/economy";
import { TransactionType } from "@prisma/client";
import { ensureSystemTournaments, checkTournamentForfeits, matchmakeAllTournaments, processSwissAutoloss } from "@/routes/tournaments";
import { settleClanBattle } from "@/routes/nations";
import { verifyTonTransaction } from "@/lib/tonverify";
import { recoverStuckGames } from "@/services/game/recover";
import { releaseExpiredReservations } from "@/routes/exchange";
import { splitTournamentPot, splitWarPot } from "@/services/prizes";
import { getTreasuryId } from "@/services/treasury";
import { ensurePlatformOrder } from "@/services/platformOrder";
import { processWarAutoloss } from "@/services/game/warAutoloss"; // PR-1
import { processTonWithdrawals } from "@/services/tonWithdrawalWorker"; // A5

type TelegramKeyboard = { inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> };

const BOT_TOKEN = () => process.env.BOT_TOKEN ?? "";
const CHANNEL_ID = () => process.env.TELEGRAM_CHANNEL_ID ?? "";
const BOT_LINK = "https://t.me/chessgamecoin_bot";

// ─── Telegram helper ─────────────────────────────────────────────────────────
// Минимальная ставка для поста в канал. Было `> 10000`, а стандартная ставка
// батла — ровно 10 000: под условие попадали 3 батла из 43, канал молчал.
const MIN_CHANNEL_BET = 10_000n;

async function sendToChannel(text: string, keyboard?: TelegramKeyboard) {
  if (!BOT_TOKEN() || !CHANNEL_ID()) {
    // Раньше выходили молча, и cron рапортовал «completed», ничего не отправив.
    logger.warn("[Cron/Channel] Пост пропущен: не задан BOT_TOKEN или TELEGRAM_CHANNEL_ID");
    return;
  }
  try {
    const body: Record<string, unknown> = { chat_id: CHANNEL_ID(), text, parse_mode: "HTML" };
    if (keyboard) body.reply_markup = keyboard;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err: unknown) {
    logError("[Cron/Channel]", err);
  }
}

// ─── Hourly: пост топ-батла в канал ─────────────────────────────────────────
async function postTopBattle() {
  try {
    // G20: Публикуем два типа топ-батлов

    // 1. Топ-батл LIVE (идёт прямо сейчас)
    const topLive = await prisma.session.findFirst({
      where: { type: "BATTLE", status: "IN_PROGRESS", isPrivate: false },
      orderBy: { bet: "desc" },
      include: {
        sides: { include: { player: { select: { firstName: true, username: true, elo: true } } } },
      },
    });

    if (topLive?.bet && topLive.bet >= MIN_CHANNEL_BET) {
      const betK = (Number(topLive.bet) / 1000).toFixed(1);
      const p1 = topLive.sides[0]?.player;
      const p2 = topLive.sides[1]?.player;
      const liveText = `🔴 <b>LIVE — Топ-батл!</b>\n\n` +
        `♟ <b>${p1?.firstName ?? '?'}</b> (ELO ${p1?.elo ?? '?'}) vs <b>${p2?.firstName ?? '?'}</b> (ELO ${p2?.elo ?? '?'})\n\n` +
        `💰 Ставка: <b>${betK}K ᚙ</b>\n\n` +
        `Смотри и болей за победителя!`;
      const liveKb: TelegramKeyboard = {
        inline_keyboard: [[{ text: '👁 Смотреть игру', url: `${BOT_LINK}?start=spectate_${topLive.id}` }]],
      };
      await sendToChannel(liveText, liveKb);
    }

    // 2. Топ-вызов (ожидает соперника — самая высокая ставка за последний час)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const topWaiting = await prisma.session.findFirst({
      where: {
        type: "BATTLE", status: "WAITING_FOR_OPPONENT", isPrivate: false,
        createdAt: { gte: oneHourAgo },
      },
      orderBy: { bet: "desc" },
      include: {
        sides: { include: { player: { select: { firstName: true, username: true, elo: true } } } },
      },
    });

    if (topWaiting?.bet && topWaiting.bet >= MIN_CHANNEL_BET) {
      const betK = (Number(topWaiting.bet) / 1000).toFixed(1);
      const creator = topWaiting.sides[0]?.player;
      const waitText = `⚔️ <b>Вызов на батл!</b>\n\n` +
        `♟ <b>${creator?.firstName ?? '?'}</b> (ELO ${creator?.elo ?? '?'}) ставит <b>${betK}K ᚙ</b>!\n\n` +
        `Первый, кто примет — сразится за двойной банк!\n` +
        `Кто готов? 💪`;
      const waitKb: TelegramKeyboard = {
        inline_keyboard: [[{ text: '⚔️ Принять вызов', url: `${BOT_LINK}?start=battle_${topWaiting.code}` }]],
      };
      await sendToChannel(waitText, waitKb);
    }

    logger.info("[Cron] Top battles check completed");
  } catch (err: unknown) {
    logError("[Cron/TopBattle]", err);
  }
}

// ─── Hourly: проверка завершённых клановых войн ──────────────────────────────
async function checkClanWarResults() {
  try {
    const expiredWars = await prisma.clanWar.findMany({
      where: {
        status: "IN_PROGRESS",
        isPending: false,
        endAt: { lte: new Date() },
      },
      include: {
        attackerClan: { include: { members: { where: { isPending: false } } } },
        defenderClan: { include: { members: { where: { isPending: false } } } },
      },
    });

    for (const war of expiredWars) {
      // FIX #6: при равном счёте (ничья) не объявляем атакующих победителями —
      // возвращаем взносы обоим кланам и завершаем войну без победителя
      const isDraw = war.attackerWins === war.defenderWins;

      if (isDraw) {
        // Возвращаем взнос атакующему клану из казны (если был)
        if (war.attackerTreasury > 0n) {
          await prisma.clan.update({
            where: { id: war.attackerClan.id },
            data: { treasury: { increment: war.attackerTreasury } },
          });
        }
        await prisma.clanWar.update({
          where: { id: war.id },
          data: { status: "FINISHED", winnerClanId: null, finishedAt: new Date() },
        });
        logger.info(`[Cron/ClanWars] Draw in war ${war.id}: ${war.attackerWins}:${war.defenderWins}`);
        continue;
      }

      const winner = war.attackerWins > war.defenderWins
        ? war.attackerClan : war.defenderClan;
      const loser = winner.id === war.attackerClan.id
        ? war.defenderClan : war.attackerClan;
      const winnerMembers = winner.id === war.attackerClan.id
        ? war.attackerClan.members : war.defenderClan.members;
      const loserMembers = loser.id === war.defenderClan.id
        ? war.defenderClan.members : war.attackerClan.members;

      const totalPrize = war.prize;
      if (totalPrize <= 0n) {
        await prisma.clanWar.update({ where: { id: war.id }, data: { status: "FINISHED", winnerClanId: winner.id } });
        continue;
      }

      // Распределение призов:
      // Сначала вычитаем 10% комиссии от всего призового фонда,
      // затем из оставшихся 90% делим: 1 место 20%, 2 место 10%, 3 место 5%, остальные 65%
      // FIX #5: раньше комиссия считалась дважды — сначала prizeRest включал 65% без учёта
      // комиссии, а потом ещё раз применялось * 90n / 100n к каждой выплате.

      // Получаем победы участников в этой войне (batch query вместо N+1)
      const memberDetails = await prisma.clanMember.findMany({
        where: { id: { in: winnerMembers.map(m => m.id) } },
        select: { id: true, warWins: true },
      });
      const winsMap = new Map(memberDetails.map(m => [m.id, m.warWins]));
      const memberWarWins = winnerMembers.map(m => ({
        userId: m.userId,
        wins: winsMap.get(m.id) ?? 0,
        contribution: m.contribution,
      }));

      memberWarWins.sort((a, b) => b.wins - a.wins);

      // Batch-загрузка telegramId для уведомлений (вместо N+1 запросов в цикле)
      const userIds = memberWarWins.map(m => m.userId);
      const usersForNotify = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, telegramId: true, firstName: true },
      });
      const userMap = new Map(usersForNotify.map(u => [u.id, u]));

      // Один раз снимаем 10% комиссии со всего фонда
      const commission = totalPrize * 10n / 100n;
      const netPrize   = totalPrize - commission; // 90% идут игрокам

      const prize20    = netPrize * 20n / 100n;
      const prize10    = netPrize * 10n / 100n;
      const prize5     = netPrize * 5n  / 100n;
      const prizeRest  = netPrize - prize20 - prize10 - prize5; // 65% от netPrize

      const totalContribution = winnerMembers.reduce((sum, m) => sum + m.contribution, 0n);

      // Выплаты
      for (let i = 0; i < memberWarWins.length; i++) {
        const m = memberWarWins[i];
        let amount = 0n;
        if (i === 0) amount = prize20;
        else if (i === 1) amount = prize10;
        else if (i === 2) amount = prize5;

        // Пропорциональная доля из остатка
        if (totalContribution > 0n) {
          amount += prizeRest * m.contribution / totalContribution;
        } else {
          amount += prizeRest / BigInt(winnerMembers.length || 1);
        }

        // FIX #5: НЕ применяем * 90n / 100n повторно — комиссия уже вычтена выше

        if (amount > 0n) {
          await updateBalance(m.userId, amount, TransactionType.CLAN_WAR_WIN, {
            warId: war.id, winnerId: winner.id,
          });
          // Уведомить пользователя (используем batch-загруженные данные)
          try {
            const user = userMap.get(m.userId);
            if (user?.telegramId && BOT_TOKEN()) {
              const amtK = (Number(amount) / 1000).toFixed(1);
              await fetch(`https://api.telegram.org/bot${BOT_TOKEN()}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: user.telegramId,
                  text: `🏆 Ваша страна ${winner.flag} <b>${winner.name}</b> победила в клановой войне!\n\nВы получили <b>${amtK}K ᚙ</b> (${i === 0 ? '🥇 1 место' : i === 1 ? '🥈 2 место' : i === 2 ? '🥉 3 место' : 'за вклад'})\n\n10% комиссия удержана.`,
                  parse_mode: "HTML",
                }),
              });
            }
          } catch (e) { logError("[Cron/ClanWars] notify", e); }
        }
      }

      // Обновляем клан победителей
      await prisma.clan.update({
        where: { id: winner.id },
        data: { totalWarWins: { increment: 1 }, treasury: { decrement: war.attackerTreasury } },
      });
      await prisma.clan.update({
        where: { id: loser.id },
        data: { totalWarLosses: { increment: 1 }, treasury: 0n },
      });

      await prisma.clanWar.update({
        where: { id: war.id },
        data: { status: "FINISHED", winnerClanId: winner.id, finishedAt: new Date() },
      });

      // Публикуем результат в канал
      const text = `🏆 <b>Клановая война завершена!</b>\n\n` +
        `${winner.flag} <b>${winner.name}</b> победила!\n` +
        `Счёт: <b>${war.attackerWins}:${war.defenderWins}</b>\n\n` +
        `💰 Призовой фонд: <b>${(Number(totalPrize) / 1000).toFixed(1)}K ᚙ</b> распределён между победителями.\n\n` +
        `<a href="${BOT_LINK}">Вступи в клан своей страны!</a>`;
      await sendToChannel(text);
    }
  } catch (err: unknown) {
    logError("[Cron/ClanWars]", err);
  }
}

// ─── Hourly: расчёт завершённых клановых батлов ──────────────────────────────
async function checkClanBattleResults() {
  try {
    const expired = await prisma.clanBattle.findMany({
      where: {
        status: "IN_PROGRESS",
        endAt: { lte: new Date() },
      },
      include: { contributions: true },
    });

    for (const battle of expired) {
      await settleClanBattle(battle);
      logger.info("[Cron/ClanBattle] Settled battle:", battle.id);
    }
  } catch (err: unknown) {
    logError("[Cron/ClanBattles]", err);
  }
}

// ─── Периодически: итоги турниров ────────────────────────────────────────────
async function checkTournamentResults() {
  try {
    const finishedTournaments = await prisma.tournament.findMany({
      where: {
        status: "IN_PROGRESS",
        endAt: { lte: new Date() },
      },
      include: {
        players: {
          where: { isActive: true },
          orderBy: [{ points: "desc" }, { wins: "desc" }],
          take: 3,
          include: {
            user: { select: { id: true, firstName: true, telegramId: true } },
          },
        },
      },
    });

    for (const t of finishedTournaments) {
      const totalPool = t.prizePool + t.donationPool;

      // PR-3 (Кенан 2026-05-18): если в турнире никто не сыграл (нет
      // активных игроков с очками) → весь призовой пул уходит в platform
      // reserve (не возвращается участникам). Это «налог на дезертирство».
      if (t.players.length === 0) {
        if (totalPool > 0n) {
          try {
            await prisma.platformConfig.update({
              where: { id: "singleton" },
              data: { platformReserve: { increment: totalPool } },
            });
            logger.info(`[Cron/Tournament] ${t.id} "${t.name}": no winners — ${totalPool} → platformReserve`);
          } catch (e) { logError("[Cron/Tournament/platformReserve]", e); }
        }
        await prisma.tournament.update({ where: { id: t.id }, data: { status: "FINISHED" } });
        continue;
      }

      // Кенан 31.07.2026: касса делится 60/30/10 между первыми тремя местами
      // НЕЗАВИСИМО от типа турнира, из каждой доли 10% — комиссия стола.
      // Мест меньше трёх — доли перенормируются, один игрок забирает всё
      // минус комиссию. Прежние проценты (WEEKLY 10%, MONTHLY 20%, SEASONAL
      // 30%) сжигали остаток: за 10 турниров пропало 100 000 монет.
      const { payouts, commission } = splitTournamentPot(totalPool, t.players.length);

      for (let idx = 0; idx < payouts.length; idx++) {
        const amount = payouts[idx];
        const player = t.players[idx];
        if (!player || amount <= 0n) continue;
        await updateBalance(player.userId, amount, TransactionType.TOURNAMENT_WIN, {
          tournamentId: t.id, place: idx + 1,
        });
        // PR-3 (Кенан 2026-05-18): бейдж первому месту — week/month/year по типу турнира.
        if (idx === 0) {
          try {
            const { checkTournamentWinnerAchievement } = await import("@/services/achievements");
            await checkTournamentWinnerAchievement(player.userId, t.type, 1, t.id);
          } catch (e) { logError("[Cron/Tournament/achievement]", e); }
        }
        // Уведомляем победителя
        if (player.user.telegramId && BOT_TOKEN()) {
          const amtK = (Number(amount) / 1000).toFixed(1);
          const placeEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
          try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN()}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: player.user.telegramId,
                text: `${placeEmoji} Поздравляем! Вы заняли ${idx + 1} место в турнире <b>${t.name}</b>!\n\nВы получили <b>${amtK}K ᚙ</b>`,
                parse_mode: "HTML",
              }),
            });
          } catch (e) { logError("[Cron/Tournament] notify", e); }
        }
      }

      // Комиссия стола уходит на СЧЁТ платформы, а не в счётчик: иначе монеты
      // просто исчезают из капитала (Кенан 01.08.2026 — «эти цифры сомнительны»).
      if (commission > 0n) {
        try {
          const treasuryId = await getTreasuryId();
          if (treasuryId) {
            await updateBalance(treasuryId, commission, TransactionType.TOURNAMENT_WIN,
              { tournamentId: t.id, reason: "table_commission" });
          }
          await prisma.platformConfig.update({
            where: { id: "singleton" },
            data: { platformReserve: { increment: commission } },
          });
          logger.info(`[Cron/Tournament] ${t.id} "${t.name}": комиссия стола ${commission} из кассы ${totalPool}`);
        } catch (e) { logError("[Cron/Tournament/commission]", e); }
      }

      // Касса роздана — обнуляем её. Раньше число оставалось в строке турнира
      // навсегда: в завершённых турнирах висело около 6 млн фантомных монет,
      // и капитал переставал сходиться.
      await prisma.tournament.update({
        where: { id: t.id },
        data: { prizePool: 0n, donationPool: 0n },
      }).catch(e => logError("[Cron/Tournament/zeroPool]", e));

      // Обновляем статус
      await prisma.tournament.update({
        where: { id: t.id },
        data: {
          status: "FINISHED",
          winnerId: t.players[0]?.userId ?? null,
        },
      });

      // Публикуем результаты в канал
      const winner = t.players[0];
      if (winner) {
        const amtK = (Number(payouts[0] ?? 0n) / 1000).toFixed(1);
        let text = '';

        if (t.type === 'COUNTRY') {
          text = `🏆 <b>Итоги Чемпионата Года ${t.period}!</b>\n\n` +
            `🥇 Чемпион: <b>${winner.user.firstName}</b> — ${winner.wins} побед, ${winner.losses} поражений\n\n` +
            `Призы распределены между топ-3 участниками.\n\n` +
            `Новый чемпионат уже начался! <a href="${BOT_LINK}">Вступай!</a>`;
        } else {
          text = `🏆 <b>Чемпион ${t.name} (${t.period}):</b>\n\n` +
            `👑 <b>${winner.user.firstName}</b>\n` +
            `📊 ${winner.wins} побед · ${winner.losses} поражений\n` +
            `💰 Приз: <b>${amtK}K ᚙ</b>\n\n` +
            `Теперь ты можешь стать чемпионом следующего периода!\n` +
            `<a href="${BOT_LINK}">Вступить в турнир</a>`;
        }
        await sendToChannel(text);
      }
    }

    // Создаём турниры на следующий период
    await ensureSystemTournaments();
  } catch (err: unknown) {
    logError("[Cron/Tournaments]", err);
  }
}

// ─── Hourly: расчёт завершённых войн между странами ─────────────────────────
//
// Кенан 31.07.2026 — новое правило, отменяет прежнее (min(казна), топ-1/2/3
// 20/10/5% плюс 65% пропорционально):
//
//   У каждой страны своя казна: взносы вступающих воинов плюс донаты.
//   Победившая по числу побед забирает казну проигравшей ЦЕЛИКОМ, до нуля;
//   своя казна остаётся при ней. Захваченное делится между своими воинами
//   строго кратно числу побед, которые они принесли команде: одна победа —
//   один эквивалент, доля = касса × победы ÷ сумма побед. Вложил деньги,
//   но не сыграл ни партии — не получает ничего.
//
// Комиссия стола 10% остаётся как была (Кенан 2026-05-17) — 31.07 он её не
// отменял, а снимать утверждённое правило молча нельзя.
// Ничья — никто никого не списывает.
export async function distributeCountryWarPrize(war: { id: string; attackerCountryId: string; defenderCountryId: string; attackerWins: number; defenderWins: number }) {
  // PR-3: idempotency guard — если статус FINISHED, значит уже распределено
  // (через другой call path: finishWar или checkCountryWarResults).
  const fresh = await prisma.countryWar.findUnique({ where: { id: war.id }, select: { status: true } });
  if (fresh?.status === "FINISHED") {
    logger.info(`[Cron/CountryWar/Prize] War ${war.id} already FINISHED, skipping distribution`);
    return;
  }
  if (war.attackerWins === war.defenderWins) {
    logger.info(`[Cron/CountryWar/Prize] War ${war.id} draw — no treasury transfer`);
    return;
  }
  const winnerCountryId = war.attackerWins > war.defenderWins ? war.attackerCountryId : war.defenderCountryId;
  const loserCountryId  = winnerCountryId === war.attackerCountryId ? war.defenderCountryId : war.attackerCountryId;

  const [winner, loser] = await Promise.all([
    prisma.country.findUnique({ where: { id: winnerCountryId } }),
    prisma.country.findUnique({ where: { id: loserCountryId } }),
  ]);
  if (!winner || !loser) return;

  // Победитель забирает казну проигравшего ЦЕЛИКОМ. Раньше приз ограничивался
  // меньшей из двух казн — из-за этого нападать на богатого было выгоднее,
  // чем защищаться, а большая часть чужой казны оставалась нетронутой.
  const prize = loser.treasury;
  if (prize <= 0n) {
    logger.info(`[Cron/CountryWar/Prize] War ${war.id}: казна проигравшего пуста`);
    return;
  }

  // Обнуляем казну проигравшего — забрали всё.
  await prisma.country.update({
    where: { id: loserCountryId },
    data: { treasury: 0n },
  });

  // Бойцы страны-победителя.
  const winnerMembers = await prisma.countryMember.findMany({
    where: { countryId: winnerCountryId, status: 'APPROVED' as any },
    select: { userId: true, warWinsCurrent: true as any } as any,
  });
  type M = { userId: string; warWinsCurrent: number };
  const members = (winnerMembers as any as M[])
    .sort((a, b) => (b.warWinsCurrent ?? 0) - (a.warWinsCurrent ?? 0));

  // Кратно победам: одна победа — один эквивалент. Никаких мест и бонусов
  // за верхушку: кто принёс пять побед, получает впятеро больше того, кто
  // принёс одну. Кто не сыграл — ничего. Касса делится ЦЕЛИКОМ, комиссия
  // снимается с доли на переходе к балансу игрока (Кенан 31.07.2026).
  const shares = splitWarPot(prize, members.map(m => ({
    userId: m.userId, wins: m.warWinsCurrent ?? 0,
  })));

  // Победа страны без единой личной победы бойцов невозможна, но если счёт
  // сложился так — приз остаётся в казне победителя, а не растворяется.
  if (shares.length === 0) {
    await prisma.country.update({
      where: { id: winnerCountryId },
      data: { treasury: { increment: prize } },
    });
    logger.warn(`[Cron/CountryWar/Prize] War ${war.id}: победных партий нет — ${prize} осталось в казне победителя`);
    return;
  }

  // Комиссия стола — сумма удержаний со всех долей.
  const commission = shares.reduce((s, x) => s + x.commission, 0n);
  if (commission > 0n) {
    try {
      await prisma.platformConfig.update({
        where: { id: "singleton" },
        data: { platformReserve: { increment: commission } },
      });
    } catch (e) { logError("[Cron/CountryWar/Prize] commission", e); }
  }

  const userMap = new Map<string, bigint>(shares.map(s => [s.userId, s.amount]));
  const grossMap = new Map<string, bigint>(shares.map(s => [s.userId, s.gross]));

  // Выплаты + уведомления.
  let totalPaid = 0n;
  for (const [uid, amount] of userMap.entries()) {
    if (amount <= 0n) continue;
    const gross = grossMap.get(uid) ?? amount;
    await updateBalance(uid, amount, TransactionType.COUNTRY_WAR_WIN, {
      warId: war.id, winnerCountryId,
      // Пишем и долю от кассы, и удержание: игрок должен видеть, что касса
      // разошлась ровно, а 10% сняты именно на переходе к его балансу.
      share: gross.toString(),
      commission: (gross - amount).toString(),
      credited: amount.toString(),
    });
    totalPaid += amount;
    try {
      const u = await prisma.user.findUnique({ where: { id: uid }, select: { telegramId: true, firstName: true } });
      if (u?.telegramId) {
        await prisma.adminNotification.create({
          data: {
            type: "COUNTRY_WAR_PAYOUT",
            payload: {
              telegramId: u.telegramId, name: u.firstName,
              amount: amount.toString(), share: gross.toString(),
              commission: (gross - amount).toString(), warId: war.id,
            },
          },
        }).catch(() => {});
      }
    } catch {}
  }

  logger.info(
    `[Cron/CountryWar/Prize] War ${war.id}: prize=${prize}, commission=${commission}, paid=${totalPaid} to ${userMap.size} fighters`
  );

  // PR-3 (Кенан 2026-05-18): бейджи war_victor (всем бойцам с warWinsCurrent>0)
  // и war_ace (10+ побед). Не блокирующий — fire-and-forget.
  try {
    const { awardWarVictorAchievements } = await import("@/services/achievements");
    await awardWarVictorAchievements(winnerCountryId, war.id);
  } catch (e) { logError("[Cron/CountryWar/achievements]", e); }
}

async function checkCountryWarResults() {
  try {
    const expiredWars = await prisma.countryWar.findMany({
      where: { status: "IN_PROGRESS", endAt: { lte: new Date() } },
      include: {
        attackerCountry: true,
        defenderCountry: true,
      },
    });

    for (const war of expiredWars) {
      const attackerWon = war.attackerWins >= war.defenderWins;
      const winnerCountryId = attackerWon ? war.attackerCountryId : war.defenderCountryId;
      const loserCountryId  = attackerWon ? war.defenderCountryId : war.attackerCountryId;

      // PR-3: сначала распределяем казну min-prize, потом помечаем войну FINISHED.
      // (Порядок важен: distribute читает war.attackerWins/defenderWins.)
      await distributeCountryWarPrize(war).catch(e => logError("[Cron/CountryWar] distributePrize", e));

      // Завершаем войну
      await prisma.countryWar.update({
        where: { id: war.id },
        data: { status: "FINISHED", finishedAt: new Date(), winnerCountryId },
      });

      // Обновляем счётчики побед/поражений стран
      await prisma.country.update({
        where: { id: winnerCountryId },
        data: { wins: { increment: 1 } },
      });
      await prisma.country.update({
        where: { id: loserCountryId },
        data: { losses: { increment: 1 } },
      });

      // Уведомляем всех бойцов обеих стран через бота
      const winnerCountry = attackerWon ? war.attackerCountry : war.defenderCountry;
      const loserCountry  = attackerWon ? war.defenderCountry : war.attackerCountry;
      // Batch-загрузка участников + их telegramId (вместо N+1)
      const allMembers = await prisma.countryMember.findMany({
        where: { countryId: { in: [winnerCountryId, loserCountryId] } },
        select: { userId: true, countryId: true },
      });
      const memberUserIds = allMembers.map(m => m.userId);
      const usersWithTg = await prisma.user.findMany({
        where: { id: { in: memberUserIds } },
        select: { id: true, telegramId: true },
      });
      const tgMap = new Map(usersWithTg.map(u => [u.id, u.telegramId]));

      // Batch-создание уведомлений
      const notificationsData = allMembers
        .filter(m => tgMap.get(m.userId))
        .map(m => ({
          type: "WAR_FINISHED" as const,
          payload: {
            telegramId: tgMap.get(m.userId)!,
            won: m.countryId === winnerCountryId,
            winnerName: winnerCountry.nameRu,
            winnerFlag: winnerCountry.flag,
            loserName: loserCountry.nameRu,
            loserFlag: loserCountry.flag,
            attackerWins: war.attackerWins,
            defenderWins: war.defenderWins,
          },
        }));
      if (notificationsData.length > 0) {
        await prisma.adminNotification.createMany({ data: notificationsData }).catch(e => logError("[Cron/CountryWar] notifications", e));
      }

      logger.info(`[Cron/CountryWar] Finished war ${war.id}: winner=${winnerCountryId}`);
    }
  } catch (err: unknown) {
    logError("[Cron/CountryWars]", err);
  }
}

// ─── Hourly: предупреждение за 1 час до конца войны ─────────────────────────
async function sendWarWarnings() {
  try {
    const in1hour = new Date(Date.now() + 60 * 60 * 1000);
    const soon = await prisma.countryWar.findMany({
      where: {
        status: "IN_PROGRESS",
        endAt: { lte: in1hour },
        warningNotifiedAt: null,
      },
      include: {
        attackerCountry: true,
        defenderCountry: true,
      },
    });

    for (const war of soon) {
      // Batch-загрузка вместо N+1
      const allMembers = await prisma.countryMember.findMany({
        where: { countryId: { in: [war.attackerCountryId, war.defenderCountryId] } },
        select: { userId: true },
      });
      const warnUserIds = allMembers.map(m => m.userId);
      const warnUsers = await prisma.user.findMany({
        where: { id: { in: warnUserIds } },
        select: { id: true, telegramId: true },
      });
      const warnTgMap = new Map(warnUsers.map(u => [u.id, u.telegramId]));

      const warnNotifications = allMembers
        .filter(m => warnTgMap.get(m.userId))
        .map(m => ({
          type: "WAR_ENDING_SOON" as const,
          payload: {
            telegramId: warnTgMap.get(m.userId)!,
            attackerName: war.attackerCountry.nameRu,
            attackerFlag: war.attackerCountry.flag,
            defenderName: war.defenderCountry.nameRu,
            defenderFlag: war.defenderCountry.flag,
            attackerWins: war.attackerWins,
            defenderWins: war.defenderWins,
          },
        }));
      if (warnNotifications.length > 0) {
        await prisma.adminNotification.createMany({ data: warnNotifications }).catch(e => logError("[Cron/WarWarning] notifications", e));
      }
      await prisma.countryWar.update({
        where: { id: war.id },
        data: { warningNotifiedAt: new Date() },
      });
      logger.info(`[Cron/WarWarning] Sent 1h warning for war ${war.id}`);
    }
  } catch (err: unknown) {
    logError("[Cron/WarWarning]", err);
  }
}

// ─── Запуск всех кронов ──────────────────────────────────────────────────────
// ─── Daily 00:00 UTC: смена задачи дня ──────────────────────────────────────
async function rotateDailyPuzzle() {
  try {
    // Снимаем флаг с предыдущей задачи дня
    await prisma.puzzle.updateMany({
      where: { isDaily: true },
      data: { isDaily: false },
    });

    // Берём случайную задачу среднего уровня (1200-1600)
    const count = await prisma.puzzle.count({ where: { rating: { gte: 1200, lte: 1600 } } });
    if (count === 0) return;

    const skip = Math.floor(Math.random() * count);
    const [puzzle] = await prisma.puzzle.findMany({
      where: { rating: { gte: 1200, lte: 1600 } },
      skip, take: 1,
    });

    if (puzzle) {
      await prisma.puzzle.update({
        where: { id: puzzle.id },
        data: { isDaily: true, dailyDate: new Date() },
      });
      logger.info(`[Crons/DailyPuzzle] New daily puzzle: ${puzzle.id} (rating ${puzzle.rating})`);
    }
  } catch (err: unknown) {
    logError("[Cron/DailyPuzzle]", err);
  }
}

export function startGameCrons() {
  // Обеспечиваем наличие системных турниров при старте
  ensureSystemTournaments().catch(err => logError("[Crons/ensureTournaments]", err));

  // Каждый час
  // Проверяем каждые 10 минут — не нужно ли обновить задачу дня
  setInterval(async () => {
    const now = new Date();
    // Запускаем только один раз в сутки (между 00:00 и 00:10 UTC)
    if (now.getUTCHours() === 0 && now.getUTCMinutes() < 10) {
      await rotateDailyPuzzle();
      await crownMonthlyChampion(); // чемпион месяца — только 1-го числа
    }
  }, 10 * 60 * 1000);

  setInterval(async () => {
    await postTopBattle();
    await checkClanWarResults();
    await checkClanBattleResults();
    await checkTournamentResults();
    await checkCountryWarResults();
    await sendWarWarnings();
    await cancelStaleExchangeOrders(); // v7.0.3: биржа
  }, 60 * 60 * 1000);

  // Первый запуск через 30 сек после старта сервера
  setTimeout(async () => {
    await checkClanWarResults();
    await checkClanBattleResults();
    await checkTournamentResults();
    await checkCountryWarResults();
  }, 30000);

  // T4: Авто-поражение за неответ — каждый час
  cron.schedule("0 * * * *", async () => {
    await checkTournamentForfeits().catch((err) =>
      logError("[Crons/TournamentForfeit] Error:", err)
    );
  });

  // T1: Matchmaking Engine — каждые 2 минуты (быстрее реагируем на новых игроков)
  cron.schedule("*/2 * * * *", async () => {
    await matchmakeAllTournaments().catch(err =>
      logError("[Crons/TournamentMatchmaker] Error:", err)
    );
  });

  // T0: Создание/чистка системных турниров — каждый час
  // (без этого новый период не появлялся до рестарта backend и копились дубли)
  cron.schedule("5 * * * *", async () => {
    await ensureSystemTournaments().catch(err =>
      logError("[Crons/EnsureTournaments] Error:", err)
    );
  });

  // Sprint 4: Swiss-system 24h autoloss — каждые 15 минут
  cron.schedule("0 */15 * * *", async () => {
    await processSwissAutoloss().catch(err =>
      logError("[Crons/SwissAutoloss] Error:", err)
    );
  });

  // PR-1: war-autoloss — каждые 5 минут. Партии в WAITING_FOR_OPPONENT
  // (созданы автоматическим war-матчмейкингом, дедлайн 24ч). Правило:
  // принял один — он побеждает; не принял никто — проигрывает чей был ход (белые).
  cron.schedule("*/5 * * * *", async () => {
    await processWarAutoloss().catch(err =>
      logError("[Crons/WarAutoloss] Error:", err)
    );
  });

  // E11: Перепроверка PENDING TON-транзакций — каждые 5 минут
  cron.schedule("*/10 * * * *", async () => { // OPT-9: каждые 10 мин (было: 5)
    await retryPendingTonVerifications().catch((err) =>
      logError("[Crons/TonVerify] Error:", err)
    );
  });

  // A5 (Кенан 2026-05-19): obрабатываем PENDING WithdrawalRequest каждые 5 мин.
  // По умолчанию заглушка-no-op (HOT_WALLET_ENABLED!=true) — реальные выплаты
  // активируются только при явном включении env (см. tonWithdrawalWorker.ts).
  cron.schedule("*/5 * * * *", async () => {
    await processTonWithdrawals().catch((err) =>
      logError("[Crons/TonWithdraw] Error:", err)
    );
  });

  // Автоснятие зависших вызовов — каждые 15 минут.
  // Было: раз в сутки и с порогом 30 дней. Из-за этого ставка игрока могла
  // висеть замороженной неделями: на 30.07 две заявки ждали с 24 июля,
  // а 20 отменённых батлов простояли по 14 часов медианно (Кенан: «батлы
  // не доигрываются»). Партия стартует только когда ОБА нажали «принять»,
  // поэтому зависает и та заявка, к которой соперник уже присоединился.
  // Партии, чьё завершение сорвалось: позиция терминальна, а статус игровой.
  // Раз в 5 минут доводим до правильного результата, иначе мат превращается
  // в ничью при последующей уборке (поймано 30.07 живым прогоном).
  cron.schedule("*/5 * * * *", async () => {
    await recoverStuckGames().catch((err) => logError("[Crons/Recover] Error:", err));
  });

  // Постоянный ордер платформы: держим витрину наполненной, пока в казне
  // есть монеты (Кенан 31.07.2026 — «пока все 100 миллиардов не распроданы»).
  cron.schedule("*/5 * * * *", async () => {
    await ensurePlatformOrder().catch((err) =>
      logError("[Crons/PlatformOrder] Error:", err)
    );
  });

  // BUY-ордер: продавец согласился и заморозил монеты, покупатель не заплатил.
  // Без снятия резерва монеты продавца зависли бы навсегда.
  cron.schedule("*/5 * * * *", async () => {
    await releaseExpiredReservations().catch((err) =>
      logError("[Crons/Exchange] Error:", err)
    );
  });

  cron.schedule("*/15 * * * *", async () => {
    await cleanupStaleBattles().catch((err) =>
      logError("[Crons/StaleBattles] Error:", err)
    );
  });

  // G23: Страховка от неактивного главнокомандующего — раз в сутки 05:00 UTC
  cron.schedule("0 5 * * *", async () => {
    await replaceInactiveCommanders().catch((err) =>
      logError("[Crons/InactiveCommanders] Error:", err)
    );
  });

  logger.info("[Crons] Started: battles, clan wars, country wars, tournaments, forfeit-check, ton-verify, stale-battles, inactive-commanders");
}

// ─── Чемпион месяца — 1-го числа каждого месяца 00:05 UTC ────────────────────
async function crownMonthlyChampion() {
  try {
    const now = new Date();
    // Только 1-го числа месяца
    if (now.getUTCDate() !== 1) return;

    logger.info("[Crons/Champion] Crowning monthly champion...");

    // Снимаем старый титул
    await prisma.user.updateMany({
      where: { isMonthlyChampion: true },
      data: { isMonthlyChampion: false },
    });

    // Топ-1 по ELO
    const champion = await prisma.user.findFirst({
      where: { isBot: false, isBanned: false },
      orderBy: { elo: "desc" },
      select: { id: true, firstName: true, elo: true, telegramId: true },
    });

    if (champion) {
      await prisma.user.update({
        where: { id: champion.id },
        data: {
          isMonthlyChampion: true,
          monthlyChampionAt: now,
          monthlyChampionType: "ELO",
        },
      });
      logger.info(`[Crons/Champion] 👑 ${champion.firstName} (ELO ${champion.elo}) is Monthly Champion!`);

      // Уведомление чемпиону через бота
      if (champion.telegramId) {
        await prisma.adminNotification.create({
          data: {
            type: "MONTHLY_CHAMPION",
            payload: {
              telegramId: champion.telegramId,
              name: champion.firstName,
              elo: champion.elo,
              month: now.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }),
            },
          },
        }).catch((err) => logError("[Cron/Champion] notification", err));
      }
    }
  } catch (err: unknown) {
    logError("[Cron/Champion]", err);
  }
}

// ─────────────────────────────────────────
// P2P БИРЖА: автоотмена зависших ордеров (v7.0.3)
// Ордера старше 30 дней без исполнения → CANCELLED, монеты возвращаются
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// E11: Перепроверка PENDING TON-транзакций (v7.0.8)
// Запускается каждые 5 минут
// ─────────────────────────────────────────
export async function retryPendingTonVerifications(): Promise<void> {
  try {
    const pending = await prisma.p2POrder.findMany({
      where:   { verifyStatus: 'PENDING', status: 'EXECUTED' },
      select:  { id: true, txHash: true, txBoc: true, sellerWallet: true, totalTon: true, buyerWallet: true },
      take:    20, // макс 20 за раз
    });
    if (pending.length === 0) return;

    logger.info(`[Cron/TonVerify] Rechecking ${pending.length} pending verifications`);

    for (const order of pending) {
      if (!order.txHash && !order.txBoc) continue;
      const result = await verifyTonTransaction({
        boc:         order.txBoc  ?? undefined,
        txHash:      order.txHash ?? undefined,
        expectedTo:  order.sellerWallet,
        expectedTon: order.totalTon,
        fromAddress: order.buyerWallet ?? undefined,
      });
      if (result.status === 'ok') {
        await prisma.p2POrder.update({ where: { id: order.id }, data: { verifyStatus: 'VERIFIED' } });
        logger.info(`[Cron/TonVerify] ✅ Verified order ${order.id}`);
      } else if (result.status === 'invalid') {
        // Редкий случай: транзакция оказалась невалидной после задержки
        // Логируем для ручного разбора, не откатываем (монеты уже начислены)
        await prisma.p2POrder.update({ where: { id: order.id }, data: { verifyStatus: 'FAILED' } });
        logger.error(`[Cron/TonVerify] ❌ FAILED order ${order.id}: ${result.reason}`);
        await prisma.adminNotification.create({
          data: { type: 'EXCHANGE_VERIFY_FAILED', payload: { orderId: order.id, reason: result.reason } },
        }).catch(() => {});
      }
      // PENDING — оставляем на следующую итерацию
    }
  } catch (err: unknown) {
    logError('[Cron/TonVerify]', err);
  }
}

export async function cancelStaleExchangeOrders(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 дней
    const stale  = await prisma.p2POrder.findMany({
      where: { status: 'OPEN', createdAt: { lt: cutoff } },
      select: { id: true, sellerId: true, amountCoins: true, orderType: true },
    });
    if (stale.length === 0) return;

    for (const order of stale) {
      await prisma.$transaction(async (tx) => {
        await tx.p2POrder.update({ where: { id: order.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
        // Возврат — только SELL-ордерам: там монеты действительно заморожены при
        // создании. У BUY-ордера создатель ничего не замораживал, и возврат
        // печатал ему монеты из воздуха (найдено 30.07.2026).
        if (order.orderType !== 'BUY') {
          await updateBalance(order.sellerId, order.amountCoins, TransactionType.EXCHANGE_UNFREEZE, { orderId: order.id, reason: 'stale_auto_cancel' }, { tx });
        }
      });
    }
    logger.info(`[Cron/Exchange] Cancelled ${stale.length} stale orders older than 30 days`);
  } catch (err: unknown) {
    logError('[Cron/Exchange/cancelStale]', err);
  }
}

// ─── G22: Автоочистка неотвеченных батлов >30 дней ──────────────────────────
// PR-1: трогает ТОЛЬКО PUBLIC/PRIVATE батлы (обычные вызовы). WAR/TOURNAMENT
// партии с дедлайном 24ч обрабатывает свой autoloss (processWarAutoloss /
// processSwissAutoloss) — там логика «есть победитель», не возврат ставки.
async function cleanupStaleBattles() {
  // Час — достаточный срок: если за это время соперник не пришёл или
  // рукопожатие «оба приняли» не состоялось, вызов снимается и ставка
  // возвращается. Раньше здесь стояло 30 дней.
  const STALE_MS = 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - STALE_MS);
  const staleSessions = await prisma.session.findMany({
    where: {
      status: 'WAITING_FOR_OPPONENT',
      createdAt: { lt: cutoff },
      type: 'BATTLE',
      sourceType: { in: ['PUBLIC', 'PRIVATE'] },
    },
    include: { sides: { select: { playerId: true } } },
  });

  for (const session of staleSessions) {
    const creatorId = session.sides[0]?.playerId;
    if (!creatorId) continue;

    await prisma.$transaction(async (tx) => {
      await tx.session.update({ where: { id: session.id }, data: { status: 'CANCELLED' } });
      if (session.bet && session.bet > 0n) {
        await updateBalance(creatorId, session.bet, TransactionType.REFUND, { sessionId: session.id, reason: 'stale_30d' }, { tx });
      }
      await tx.user.update({ where: { id: creatorId }, data: { activeSessions: { disconnect: { id: session.id } } } });
    });
  }

  if (staleSessions.length > 0) {
    logger.info(`[Cron/StaleBattles] Снято зависших вызовов: ${staleSessions.length}, ставки возвращены`);
  }
}

// ─── G23: Замена неактивного главнокомандующего (>7 дней) ────────────────────
async function replaceInactiveCommanders() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const countries = await prisma.country.findMany({
    include: {
      members: {
        orderBy: [{ warWins: 'desc' }, { joinedAt: 'asc' }],
        include: { user: { select: { id: true, updatedAt: true } } },
      },
    },
  });

  for (const country of countries) {
    if (country.members.length < 2) continue;

    const commander = country.members[0];
    if (!commander) continue;

    const commanderLastActive = commander.user.updatedAt;
    if (commanderLastActive > cutoff) continue;

    if (country.members.length < 2) continue;

    const nextActive = country.members.find(
      (m, i) => i > 0 && m.user.updatedAt > cutoff
    );

    if (nextActive) {
      logger.info(`[Cron/Commanders] Country ${country.code}: commander ${commander.userId} inactive >7d, replacing with ${nextActive.userId}`);
    }
  }
}
