/**
 * Scheduled tasks / cron jobs
 * - Hourly: post top battle to Telegram channel
 * - Hourly: check and distribute finished clan war prizes
 * - Weekly/Monthly/Seasonal/Yearly: post tournament results and create new tournaments
 */

import { prisma } from "@/lib/prisma";
import { updateBalance } from "@/services/economy";
import { TransactionType } from "@prisma/client";
import { ensureSystemTournaments } from "@/routes/tournaments";
import { settleClanBattle } from "@/routes/nations";

const BOT_TOKEN = () => process.env.BOT_TOKEN ?? "";
const CHANNEL_ID = () => process.env.TELEGRAM_CHANNEL_ID ?? "";
const BOT_LINK = "https://t.me/chessgamecoin_bot";

// ─── Telegram helper ─────────────────────────────────────────────────────────
async function sendToChannel(text: string, keyboard?: any) {
  if (!BOT_TOKEN() || !CHANNEL_ID()) return;
  try {
    const body: any = { chat_id: CHANNEL_ID(), text, parse_mode: "HTML" };
    if (keyboard) body.reply_markup = keyboard;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[Cron/Channel]", err);
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
    console.log("[Cron] Top battle posted:", topBattle.id);
  } catch (err) {
    console.error("[Cron/TopBattle]", err);
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
      const winner = war.attackerWins >= war.defenderWins
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
      // 1 место по победам: 20%, 2 место: 10%, 3 место: 5%, остальные: 65% пропорционально вкладу

      // Получаем победы участников в этой войне
      const memberWarWins = await Promise.all(
        winnerMembers.map(async m => {
          const member = await prisma.clanMember.findUnique({ where: { id: m.id } });
          return { userId: m.userId, wins: member?.warWins ?? 0, contribution: m.contribution };
        })
      );

      memberWarWins.sort((a, b) => b.wins - a.wins);

      const prize20 = totalPrize * 20n / 100n;
      const prize10 = totalPrize * 10n / 100n;
      const prize5  = totalPrize * 5n / 100n;
      const prizeRest = totalPrize - prize20 - prize10 - prize5;

      const totalContribution = winnerMembers.reduce((sum, m) => sum + m.contribution, 0n);
      const commission = totalPrize * 10n / 100n; // 10% комиссия

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

        amount = amount * 90n / 100n; // вычитаем 10% комиссию

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
  } catch (err) {
    console.error("[Cron/ClanWars]", err);
  }
}

// ─── Hourly: расчёт завершённых клановых батлов ──────────────────────────────
async function checkClanBattleResults() {
  try {
    const expired = await (prisma as any).clanBattle.findMany({
      where: {
        status: "IN_PROGRESS",
        endAt: { lte: new Date() },
      },
      include: { contributions: true },
    });

    for (const battle of expired) {
      await settleClanBattle(battle);
      console.log("[Cron/ClanBattle] Settled battle:", battle.id);
    }
  } catch (err) {
    console.error("[Cron/ClanBattles]", err);
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
      const isYearly = t.type === "YEARLY";

      // Распределение призов
      const prizes: [bigint, number][] = isYearly
        ? [[totalPool * 60n / 100n, 0], [totalPool * 30n / 100n, 1], [totalPool * 10n / 100n, 2]]
        : t.type === "SEASONAL"
        ? [[totalPool * 30n / 100n, 0]]
        : t.type === "MONTHLY"
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

        if (t.type === 'YEARLY') {
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
  } catch (err) {
    console.error("[Cron/Tournaments]", err);
  }
}

// ─── Hourly: расчёт завершённых войн между странами ─────────────────────────
async function checkCountryWarResults() {
  try {
    const expiredWars = await (prisma as any).countryWar.findMany({
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
      await (prisma as any).countryWar.update({
        where: { id: war.id },
        data: { status: "FINISHED", finishedAt: new Date(), winnerCountryId },
      });

      // Обновляем счётчики побед/поражений стран
      await (prisma as any).country.update({
        where: { id: winnerCountryId },
        data: { wins: { increment: 1 } },
      });
      await (prisma as any).country.update({
        where: { id: loserCountryId },
        data: { losses: { increment: 1 } },
      });

      console.log(`[Cron/CountryWar] Finished war ${war.id}: winner=${winnerCountryId}`);
    }
  } catch (err) {
    console.error("[Cron/CountryWars]", err);
  }
}

// ─── Запуск всех кронов ──────────────────────────────────────────────────────
export function startGameCrons() {
  // Обеспечиваем наличие системных турниров при старте
  ensureSystemTournaments().catch(console.error);

  // Каждый час
  setInterval(async () => {
    await postTopBattle();
    await checkClanWarResults();
    await checkClanBattleResults();
    await checkTournamentResults();
    await checkCountryWarResults();
  }, 60 * 60 * 1000);

  // Первый запуск через 30 сек после старта сервера
  setTimeout(async () => {
    await checkClanWarResults();
    await checkClanBattleResults();
    await checkTournamentResults();
    await checkCountryWarResults();
  }, 30000);

  console.log("[Crons] Started: battles, clan wars, country wars, tournaments");
}
