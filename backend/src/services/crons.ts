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
import { ensureSystemTournaments, checkTournamentForfeits } from "@/routes/tournaments";
import { settleClanBattle } from "@/routes/nations";

const BOT_TOKEN = () => process.env.BOT_TOKEN ?? "";
const CHANNEL_ID = () => process.env.TELEGRAM_CHANNEL_ID ?? "";
const BOT_LINK = "https://t.me/chessgamecoin_bot";

// ─── Telegram helper ─────────────────────────────────────────────────────────
async function sendToChannel(text: string, keyboard?: TelegramKeyboard) {
  if (!BOT_TOKEN() || !CHANNEL_ID()) return;
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
    // Найти батл с наибольшей ставкой в статусе IN_PROGRESS
    const topBattle = await prisma.session.findFirst({
      where: {
        type: "BATTLE",
        status: "IN_PROGRESS",
      },
      orderBy: { bet: "desc" },
      include: {
        sides: {
          include: {
            player: { select: { firstName: true, username: true, elo: true } },
          },
        },
      },
    });

    if (!topBattle || !topBattle.bet) return;

    // Проверяем — не публиковали ли уже этот батл
    const lastPosted = await prisma.platformConfig.findUnique({
      where: { id: "singleton" },
      select: { totalUsersSnapshot: true }, // используем как временный трекер
    });

    const betAmount = Number(topBattle.bet) / 1000;
    const p1 = topBattle.sides[0]?.player;
    const p2 = topBattle.sides[1]?.player;

    const text = `⚔️ <b>Топ-батл часа!</b>\n\n` +
      `♟ <b>${p1?.firstName ?? 'Игрок'}</b> (ELO ${p1?.elo ?? '?'}) vs <b>${p2?.firstName ?? 'Игрок'}</b> (ELO ${p2?.elo ?? '?'})\n\n` +
      `💰 Ставка: <b>${betAmount.toFixed(1)}K ᚙ</b>\n\n` +
      `Смотри игру и болей за победителя!\n` +
      `<a href="${BOT_LINK}?start=spectate_${topBattle.id}">👁 Следить за игрой</a>`;

    await sendToChannel(text);
    logger.info("[Cron] Top battle posted:", topBattle.id);
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

      // Получаем победы участников в этой войне
      const memberWarWins = await Promise.all(
        winnerMembers.map(async m => {
          const member = await prisma.clanMember.findUnique({ where: { id: m.id } });
          return { userId: m.userId, wins: member?.warWins ?? 0, contribution: m.contribution };
        })
      );

      memberWarWins.sort((a, b) => b.wins - a.wins);

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
          // Уведомить пользователя
          try {
            const user = await prisma.user.findUnique({ where: { id: m.userId }, select: { telegramId: true, firstName: true } });
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
          } catch {}
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
      if (t.players.length === 0) {
        await prisma.tournament.update({ where: { id: t.id }, data: { status: "FINISHED" } });
        continue;
      }

      const totalPool = t.prizePool + t.donationPool;
      // БАГ #5 fix: WORLD получает 70/20/10%, COUNTRY — 60/30/10%
      const prizes: [bigint, number][] =
        t.type === 'WORLD'
          ? [[totalPool * 70n / 100n, 0], [totalPool * 20n / 100n, 1], [totalPool * 10n / 100n, 2]]
        : t.type === 'COUNTRY'
          ? [[totalPool * 60n / 100n, 0], [totalPool * 30n / 100n, 1], [totalPool * 10n / 100n, 2]]
        : t.type === 'SEASONAL'
          ? [[totalPool * 30n / 100n, 0], [totalPool * 10n / 100n, 1]]
        : t.type === 'MONTHLY'
          ? [[totalPool * 20n / 100n, 0]]
          : [[totalPool * 10n / 100n, 0]]; // WEEKLY

      for (const [amount, idx] of prizes) {
        const player = t.players[idx];
        if (!player || amount <= 0n) continue;
        await updateBalance(player.userId, amount, TransactionType.TOURNAMENT_WIN, {
          tournamentId: t.id, place: idx + 1,
        });
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
          } catch {}
        }
      }

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
        const amtK = (Number(prizes[0]?.[0] ?? 0n) / 1000).toFixed(1);
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
      const allMembers = await prisma.countryMember.findMany({
        where: { countryId: { in: [winnerCountryId, loserCountryId] } },
        select: { userId: true, countryId: true },
      });
      for (const m of allMembers) {
        const user = await prisma.user.findUnique({ where: { id: m.userId }, select: { telegramId: true } });
        if (user?.telegramId) {
          const won = m.countryId === winnerCountryId;
          await prisma.adminNotification.create({
            data: {
              type: "WAR_FINISHED",
              payload: {
                telegramId: user.telegramId,
                won,
                winnerName: winnerCountry.nameRu,
                winnerFlag: winnerCountry.flag,
                loserName: loserCountry.nameRu,
                loserFlag: loserCountry.flag,
                attackerWins: war.attackerWins,
                defenderWins: war.defenderWins,
              },
            },
          }).catch(() => {});
        }
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
      const allMembers = await prisma.countryMember.findMany({
        where: { countryId: { in: [war.attackerCountryId, war.defenderCountryId] } },
        select: { userId: true },
      });
      for (const m of allMembers) {
        const user = await prisma.user.findUnique({ where: { id: m.userId }, select: { telegramId: true } });
        if (user?.telegramId) {
          await prisma.adminNotification.create({
            data: {
              type: "WAR_ENDING_SOON",
              payload: {
                telegramId: user.telegramId,
                attackerName: war.attackerCountry.nameRu,
                attackerFlag: war.attackerCountry.flag,
                defenderName: war.defenderCountry.nameRu,
                defenderFlag: war.defenderCountry.flag,
                attackerWins: war.attackerWins,
                defenderWins: war.defenderWins,
              },
            },
          }).catch(() => {});
        }
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
  cron.schedule("0 3 * * *", async () => { // Opt: раз в сутки в 03:00 UTC
    await checkTournamentForfeits().catch((err) =>
      logError("[Crons/TournamentForfeit] Error:", err)
    );
  });

  // E11: Перепроверка PENDING TON-транзакций — каждые 5 минут
  cron.schedule("*/10 * * * *", async () => { // OPT-9: каждые 10 мин (было: 5)
    await retryPendingTonVerifications().catch((err) =>
      logError("[Crons/TonVerify] Error:", err)
    );
  });

  logger.info("[Crons] Started: battles, clan wars, country wars, tournaments, forfeit-check, ton-verify");
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
      select: { id: true, sellerId: true, amountCoins: true },
    });
    if (stale.length === 0) return;

    for (const order of stale) {
      await prisma.$transaction(async (tx) => {
        await tx.p2POrder.update({ where: { id: order.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
        await tx.user.update({ where: { id: order.sellerId }, data: { balance: { increment: order.amountCoins } } });
        await tx.transaction.create({ data: { userId: order.sellerId, type: TransactionType.EXCHANGE_UNFREEZE, amount: order.amountCoins, payload: { orderId: order.id, reason: 'stale_auto_cancel' } } });
      });
    }
    logger.info(`[Cron/Exchange] Cancelled ${stale.length} stale orders older than 30 days`);
  } catch (err: unknown) {
    logError('[Cron/Exchange/cancelStale]', err);
  }
}
