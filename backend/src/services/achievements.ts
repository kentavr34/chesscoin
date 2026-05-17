/**
 * achievements.ts — система достижений ChessCoin
 * Вызывается из finish.ts, economy.ts, crons.ts
 */
import { logger, logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { updateBalance } from "@/services/economy";
import { TransactionType } from "@prisma/client";

export interface Achievement {
  id: string;
  icon: string;
  nameRu: string;
  nameEn: string;
  descRu: string;
  reward: bigint;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_blood',   icon: '⚔️',  nameRu: 'Первая кровь',       nameEn: 'First Blood',        descRu: 'Сыграть первую партию',        reward: 500n   },
  { id: 'winner_10',     icon: '🏆',  nameRu: 'Победитель',          nameEn: 'Victor',             descRu: 'Победить 10 раз',              reward: 2000n  },
  { id: 'winner_100',    icon: '👑',  nameRu: 'Легенда',             nameEn: 'Legend',             descRu: 'Победить 100 раз',             reward: 20000n },
  { id: 'jarvis_hunter', icon: '🤖',  nameRu: 'Охотник на J.A.R.V.I.S', nameEn: 'JARVIS Hunter',  descRu: 'Победить на максимальном уровне', reward: 5000n },
  { id: 'recruiter',     icon: '👥',  nameRu: 'Вербовщик',           nameEn: 'Recruiter',          descRu: 'Пригласить 10 друзей',          reward: 3000n  },
  { id: 'millionaire',   icon: '💰',  nameRu: 'Миллионер',           nameEn: 'Millionaire',        descRu: 'Набрать 1 000 000 ᚙ',          reward: 10000n },
  { id: 'patriot',       icon: '🌍',  nameRu: 'Патриот',             nameEn: 'Patriot',            descRu: 'Сыграть 10 войн за страну',    reward: 4000n  },
  { id: 'puzzler',       icon: '🧩',  nameRu: 'Шахматист',           nameEn: 'Puzzler',            descRu: 'Решить 50 головоломок',         reward: 5000n  },
  { id: 'streak_7',      icon: '🔥',  nameRu: 'Огонь',               nameEn: 'On Fire',            descRu: 'Стрик 7 дней подряд',          reward: 2000n  },
  { id: 'streak_30',     icon: '💎',  nameRu: 'Несломимый',          nameEn: 'Unbreakable',        descRu: 'Стрик 30 дней подряд',         reward: 15000n },
  // PR-3 (Кенан 2026-05-18): новые типы — турниры, войны, командир, рефералы по порогам.
  { id: 'tournament_winner_week',  icon: 'trophy',  nameRu: 'Чемпион Недели',  nameEn: 'Champion of the Week',  descRu: 'Победа в недельном турнире',  reward: 5000n  },
  { id: 'tournament_winner_month', icon: 'trophy',  nameRu: 'Чемпион Месяца',  nameEn: 'Champion of the Month', descRu: 'Победа в месячном турнире',   reward: 20000n },
  { id: 'tournament_winner_year',  icon: 'trophy',  nameRu: 'Чемпион Года',    nameEn: 'Champion of the Year',  descRu: 'Победа в годовом турнире',     reward: 100000n},
  { id: 'commander',               icon: 'crown',   nameRu: 'Главнокомандующий', nameEn: 'Commander',           descRu: 'Стать главкомом страны',        reward: 0n     },
  { id: 'war_victor',              icon: 'swords',  nameRu: 'Победитель Войны',  nameEn: 'War Victor',           descRu: 'Страна победила в войне',      reward: 0n     },
  { id: 'war_ace',                 icon: 'swords',  nameRu: 'Ас Войны',          nameEn: 'War Ace',              descRu: '10+ побед в одной войне',     reward: 5000n  },
  { id: 'referral_bronze',         icon: 'users',   nameRu: 'Бронзовый вербовщик', nameEn: 'Bronze Recruiter',   descRu: '5 рефералов',                 reward: 1000n  },
  { id: 'referral_silver',         icon: 'users',   nameRu: 'Серебряный вербовщик', nameEn: 'Silver Recruiter',  descRu: '25 рефералов',                reward: 5000n  },
  { id: 'referral_gold',           icon: 'users',   nameRu: 'Золотой вербовщик',   nameEn: 'Gold Recruiter',     descRu: '100 рефералов',               reward: 25000n },
];

/** Выдать достижение пользователю (идемпотентно) */
export async function grantAchievement(userId: string, achievementId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { achievements: true },
    });
    if (!user) return false;

    const current: Array<Record<string,unknown>> = Array.isArray(user.achievements) ? user.achievements as Array<Record<string,unknown>> : [];
    if (current.some((a: Record<string,unknown>) => a.id === achievementId)) return false; // уже есть

    const ach = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!ach) return false;

    current.push({ id: achievementId, date: new Date().toISOString() });
    await prisma.user.update({
      where: { id: userId },
      data: { achievements: current as any },
    });

    // Начисляем награду
    if (ach.reward > 0n) {
      await updateBalance(userId, ach.reward, TransactionType.TASK_REWARD, {
        achievement: achievementId,
      }, { isEmission: true });
    }

    logger.info(`[Achievement] ${userId} unlocked "${ach.nameRu}" (+${ach.reward} ᚙ)`);
    return true;
  } catch (e) {
    logger.error('[Achievement] error:', e);
    return false;
  }
}

/** Проверить и выдать достижения после игры */
export async function checkGameAchievements(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCount: true, loginStreak: true, balance: true },
  });
  if (!user) return;

  // Считаем игры через Session sides
  const wonSides = await prisma.sessionSide.count({
    where: { playerId: userId, status: 'WON' },
  });
  const totalSides = await prisma.sessionSide.count({ where: { playerId: userId } });

  if (totalSides >= 1)  await grantAchievement(userId, 'first_blood');
  if (wonSides >= 10)   await grantAchievement(userId, 'winner_10');
  if (wonSides >= 100)  await grantAchievement(userId, 'winner_100');

  // Миллионер
  if (BigInt(user.balance ?? '0') >= 1_000_000n) await grantAchievement(userId, 'millionaire');

  // Рефералы
  if ((user.referralCount ?? 0) >= 10) await grantAchievement(userId, 'recruiter');

  // Стрик
  if ((user.loginStreak ?? 0) >= 7)  await grantAchievement(userId, 'streak_7');
  if ((user.loginStreak ?? 0) >= 30) await grantAchievement(userId, 'streak_30');
}

/** Проверить достижение JARVIS Hunter */
export async function checkJarvisAchievement(userId: string, botLevel: number) {
  if (botLevel >= 20) await grantAchievement(userId, 'jarvis_hunter');
}

/** Проверить достижение Puzzler */
export async function checkPuzzleAchievements(userId: string) {
  const count = await prisma.completedPuzzle.count({ where: { userId } });
  if (count >= 50) await grantAchievement(userId, 'puzzler');
}

/** Проверить достижение Patriot (войны) */
export async function checkWarAchievements(userId: string) {
  // Считаем через транзакции COUNTRY_WAR_WIN
  const count = await prisma.transaction.count({
    where: { userId, type: 'COUNTRY_WAR_WIN' },
  });
  if (count >= 10) await grantAchievement(userId, 'patriot');
}

// PR-3 (Кенан 2026-05-18): рефералы по порогам.
export async function checkReferralAchievements(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCount: true },
  });
  if (!user) return;
  const n = user.referralCount ?? 0;
  if (n >= 5)   await grantAchievement(userId, 'referral_bronze');
  if (n >= 25)  await grantAchievement(userId, 'referral_silver');
  if (n >= 100) await grantAchievement(userId, 'referral_gold');
}

// PR-3: турнирный победитель — выдаётся в settleTournament/checkTournamentResults
// при выдаче призового места 1. Тип зависит от Tournament.type:
// WEEKLY → week, MONTHLY → month, SEASONAL → month (сезон ≈ месяц), YEARLY → year,
// WORLD → year (мировой = годовой уровень), COUNTRY → year.
export async function checkTournamentWinnerAchievement(userId: string, tournamentType: string, place: number, tournamentId: string) {
  if (place !== 1) return;
  const key = (tournamentType === 'WEEKLY') ? 'tournament_winner_week'
    : (tournamentType === 'MONTHLY' || tournamentType === 'SEASONAL') ? 'tournament_winner_month'
    : 'tournament_winner_year';
  // Турнирные победы можно повторно — НЕ дедуплицируем по id (используем
  // отдельную процедуру с meta-полем tournamentId, чтобы каждая победа была
  // отдельным бейджем).
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { achievements: true } });
    const cur: Array<Record<string,unknown>> = Array.isArray(u?.achievements) ? u!.achievements as any : [];
    cur.push({ id: key, date: new Date().toISOString(), meta: { tournamentId, place } });
    await prisma.user.update({ where: { id: userId }, data: { achievements: cur as any } });
    const ach = ACHIEVEMENTS.find(a => a.id === key);
    if (ach && ach.reward > 0n) {
      await updateBalance(userId, ach.reward, TransactionType.TASK_REWARD,
        { achievement: key, tournamentId }, { isEmission: true });
    }
    logger.info(`[Achievement] ${userId} tournament-winner ${key} (tournament ${tournamentId})`);
  } catch (e) { logError('[Achievement/tournament]', e); }
}

// PR-3: при назначении командиром.
export async function awardCommanderAchievement(userId: string, countryId: string) {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { achievements: true } });
    const cur: Array<Record<string,unknown>> = Array.isArray(u?.achievements) ? u!.achievements as any : [];
    cur.push({ id: 'commander', date: new Date().toISOString(), meta: { countryId } });
    await prisma.user.update({ where: { id: userId }, data: { achievements: cur as any } });
    logger.info(`[Achievement] ${userId} commander of ${countryId}`);
  } catch (e) { logError('[Achievement/commander]', e); }
}

// PR-3: после победы страны в войне — каждому бойцу с warWinsCurrent > 0.
export async function awardWarVictorAchievements(winnerCountryId: string, warId: string) {
  try {
    const fighters = await prisma.countryMember.findMany({
      where: { countryId: winnerCountryId, status: 'APPROVED' as any },
      select: { userId: true, warWinsCurrent: true as any } as any,
    });
    for (const m of fighters as any as Array<{ userId: string; warWinsCurrent: number }>) {
      const wins = m.warWinsCurrent ?? 0;
      if (wins <= 0) continue;
      const u = await prisma.user.findUnique({ where: { id: m.userId }, select: { achievements: true } });
      const cur: Array<Record<string,unknown>> = Array.isArray(u?.achievements) ? u!.achievements as any : [];
      cur.push({ id: 'war_victor', date: new Date().toISOString(), meta: { warId, wins } });
      if (wins >= 10) {
        cur.push({ id: 'war_ace', date: new Date().toISOString(), meta: { warId, wins } });
        const ace = ACHIEVEMENTS.find(a => a.id === 'war_ace');
        if (ace && ace.reward > 0n) {
          await updateBalance(m.userId, ace.reward, TransactionType.TASK_REWARD,
            { achievement: 'war_ace', warId }, { isEmission: true });
        }
      }
      await prisma.user.update({ where: { id: m.userId }, data: { achievements: cur as any } });
    }
    logger.info(`[Achievement] war_victor awarded for country ${winnerCountryId} (war ${warId})`);
  } catch (e) { logError('[Achievement/war_victor]', e); }
}
