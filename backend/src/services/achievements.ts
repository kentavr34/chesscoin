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
