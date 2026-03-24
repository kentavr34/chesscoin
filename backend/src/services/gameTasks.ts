// ═══════════════════════════════════════════════════════════════
// gameTasks.ts — Автоматическое выполнение геймплейных заданий
// v7.1.7: BUG #1 FIX
//
// Вызывается из finish.ts после каждой партии (fire-and-forget).
// Также вызывается из auth.ts при каждом входе (DAILY_LOGIN).
//
// ПРИНЦИП:
// - Задания с типом WIN_N/WIN_BOT_N/PLAY_N/FIRST_GAME проверяются
//   автоматически после каждой завершённой партии
// - DAILY_LOGIN — при каждом входе (auth/me)
// - WIN_STREAK_N — считается через Redis (быстрый счётчик)
//
// ИДЕМПОТЕНТНОСТЬ:
// - CompletedTask имеет unique(userId, taskId) — нельзя выполнить дважды
// - DAILY_LOGIN — уникален по (userId, taskId, date)
// ═══════════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { updateBalance } from '@/services/economy';
import { TransactionType, TaskType } from '@prisma/client';
import { logger } from '@/lib/logger';

// ── Вспомогательная: завершить задание (идемпотентно) ────────
async function completeTask(userId: string, taskId: string, reward: bigint): Promise<boolean> {
  try {
    // Проверяем не выполнено ли уже
    const exists = await prisma.completedTask.findFirst({
      where: { userId, taskId },
    });
    if (exists) return false; // уже выполнено

    await prisma.completedTask.create({ data: { userId, taskId } });
    await updateBalance(userId, reward, TransactionType.TASK_REWARD, { taskId }, { isEmission: true });

    logger.info(`[gameTasks] User ${userId} completed task ${taskId} (+${reward} ᚙ)`);
    return true;
  } catch (err: unknown) {
    // unique constraint violation = уже выполнено (race condition safe)
    if ((err as { code?: string })?.code === 'P2002') return false;
    logger.error('[gameTasks] completeTask error:', err);
    return false;
  }
}

// ── Получить прогресс пользователя для задания ────────────────
async function getUserProgress(userId: string) {
  const [wonBattles, wonBotGames, totalGames] = await Promise.all([
    // Победы в батлах P2P
    prisma.sessionSide.count({
      where: { playerId: userId, status: 'WON', session: { type: 'BATTLE' } },
    }),
    // Победы над ботом
    prisma.sessionSide.count({
      where: { playerId: userId, status: 'WON', session: { type: 'BOT' } },
    }),
    // Всего партий
    prisma.sessionSide.count({
      where: { playerId: userId },
    }),
  ]);
  return { wonBattles, wonBotGames, totalGames };
}

// ── Главная функция: вызывается из finish.ts ──────────────────
export async function checkGameTasks(
  userId: string,
  sessionType: 'BOT' | 'BATTLE' | 'FRIENDLY',
  humanWon: boolean
): Promise<void> {
  try {
    // Загружаем активные геймплейные задания
    const tasks = await prisma.task.findMany({
      where: {
        status: 'ACTIVE',
        taskType: {
          in: [
            TaskType.FIRST_GAME,
            TaskType.WIN_N,
            TaskType.WIN_BOT_N,
            TaskType.WIN_STREAK_N,
            TaskType.PLAY_N,
          ],
        },
      },
    });

    if (tasks.length === 0) return;

    // Получаем прогресс пользователя
    const progress = await getUserProgress(userId);

    for (const task of tasks) {
      const meta = task.metadata as Record<string, unknown>;
      const target = Number(meta?.targetCount ?? 1);

      switch (task.taskType as string) {
        case 'FIRST_GAME':
          // Первая завершённая партия (любая)
          if (progress.totalGames >= 1) {
            await completeTask(userId, task.id, task.winningAmount);
          }
          break;

        case 'WIN_N':
          // N побед в батлах P2P
          if (humanWon && sessionType === 'BATTLE' && progress.wonBattles >= target) {
            await completeTask(userId, task.id, task.winningAmount);
          }
          break;

        case 'WIN_BOT_N':
          // N побед над ботом
          if (humanWon && sessionType === 'BOT' && progress.wonBotGames >= target) {
            await completeTask(userId, task.id, task.winningAmount);
          }
          break;

        case 'PLAY_N':
          // N сыгранных партий (любых)
          if (progress.totalGames >= target) {
            await completeTask(userId, task.id, task.winningAmount);
          }
          break;

        case 'WIN_STREAK_N':
          // N побед подряд — считаем через Redis (быстро)
          if (humanWon) {
            const streakKey = `streak:${userId}`;
            const streak = await redis.incr(streakKey);
            await redis.expire(streakKey, 86400 * 7); // сбрасывается через 7 дней неактивности

            if (streak >= target) {
              const completed = await completeTask(userId, task.id, task.winningAmount);
              if (completed) await redis.del(streakKey); // сбрасываем стрик после получения
            }
          } else if (!humanWon && sessionType !== 'FRIENDLY') {
            // Проигрыш сбрасывает стрик (дружеские не считаются)
            await redis.del(`streak:${userId}`).catch(() => {});
          }
          break;
      }
    }
  } catch (err) {
    logger.error('[gameTasks] checkGameTasks error:', err);
    // Не бросаем — не должно ломать игровой процесс
  }
}

// ── DAILY_LOGIN: вызывается из auth.ts при входе ─────────────
export async function checkDailyLoginTask(userId: string): Promise<void> {
  try {
    const tasks = await prisma.task.findMany({
      where: { status: 'ACTIVE', taskType: TaskType.DAILY_LOGIN },
    });

    if (tasks.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0]; // "2026-03-20"

    for (const task of tasks) {
      // Для DAILY_LOGIN: ключ = userId + taskId + дата
      // Один раз в сутки — используем Redis TTL как guard
      const dailyKey = `daily_task:${userId}:${task.id}:${todayStr}`;

      // Проверяем через Redis (быстро, до запроса к БД)
      const alreadyDone = await redis.get(dailyKey);
      if (alreadyDone) continue;

      // Начисляем (DAILY_LOGIN разрешает повторное выполнение каждый день)
      // Используем специальную запись с датой как суффиксом
      const dailyTaskId = `${task.id}:${todayStr}`;

      const exists = await prisma.completedTask.findFirst({
        where: { userId, taskId: task.id, completedAt: { gte: today } },
      });
      if (exists) {
        await redis.setex(dailyKey, 86400, '1');
        continue;
      }

      await prisma.completedTask.create({ data: { userId, taskId: task.id } });
      await updateBalance(userId, task.winningAmount, TransactionType.TASK_REWARD, {
        taskId: task.id, date: todayStr, type: 'daily_login',
      }, { isEmission: true });

      // Помечаем в Redis на 24 часа
      await redis.setex(dailyKey, 86400, '1');

      logger.info(`[gameTasks] Daily login bonus: user ${userId} +${task.winningAmount} ᚙ`);
    }
  } catch (err) {
    logger.error('[gameTasks] checkDailyLoginTask error:', err);
  }
}
