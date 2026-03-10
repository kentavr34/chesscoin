// ═══════════════════════════════════════════════════════════════
// РЕФЕРАЛЬНАЯ СИСТЕМА — оптимизированная для 1M+ пользователей
//
// АРХИТЕКТУРНЫЕ РЕШЕНИЯ:
//
// 1. Только 2 уровня. Никакой рекурсии. O(1) — всегда 2 UPDATE запроса максимум.
//
// 2. referrer_id хранится ПРЯМО в user — без JOIN на дерево.
//    l1_id = user.referrerId
//    l2_id = referrer.referrerId  (один доп. запрос, кешируется)
//
// 3. Начисления идут через updateBalance() — единый транзакционный путь.
//    Никаких агрегаций на лету. Счётчики денормализованы в user (referrerIncome).
//
// 4. Реферальный бонус (3000ᚙ) — ТОЛЬКО после первой завершённой партии.
//    Не при регистрации. Не при первом входе. Только game finish.
//
// 5. Реферальный % от выигрыша — fire-and-forget через setImmediate().
//    Не блокирует завершение игры. Если упадёт — логируем, игра не ломается.
//
// 6. При 1M пользователей реферальная система = 2 UPDATE + 1 INSERT.
//    Нагрузка не растёт с числом пользователей.
// ═══════════════════════════════════════════════════════════════

import { TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import config from "@/config";
import { updateBalance, canEmit } from "@/services/economy";

// ─────────────────────────────────────────
// Вызывается в finish.ts при первом завершении партии
// ─────────────────────────────────────────
export const activateReferral = async (userId: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      referralActivated: true,
      referrerId: true,
      firstName: true,
      referrer: {
        select: {
          id: true,
          telegramId: true,
          firstName: true,
        },
      },
    },
  });

  // Уже активирован или нет реферера — выходим
  if (!user || user.referralActivated || !user.referrerId || !user.referrer) return;

  // Атомарно помечаем активацию
  await prisma.user.update({
    where: { id: userId },
    data: { referralActivated: true },
  });

  // Бонус пригласившему — только если фаза 1 (эмиссия открыта)
  const emit = await canEmit();
  if (emit) {
    await updateBalance(
      user.referrerId,
      config.economy.referralFirstGameBonus,
      TransactionType.REFERRAL_BONUS,
      { referralId: userId, referralName: user.firstName },
      { isEmission: true }
    );
  }

  // Уведомляем пригласившего через AdminNotification (бот отправит красивое сообщение)
  await prisma.adminNotification.create({
    data: {
      type: "REFERRAL_ACTIVATED",
      payload: {
        referrerTelegramId: user.referrer.telegramId,
        referrerName: user.referrer.firstName,
        newPlayerName: user.firstName,
        bonus: config.economy.referralFirstGameBonus.toString(),
      },
    },
  });
};

// ─────────────────────────────────────────
// Реферальный % от выигрыша — O(1), 2 запроса максимум
// Вызывается fire-and-forget из finish.ts
// ─────────────────────────────────────────
export const applyReferralIncome = async (
  winnerId: string,
  winAmount: bigint
): Promise<void> => {
  if (winAmount <= 0n) return;

  // Один запрос — получаем winner + его l1 + l2 реферера
  const winner = await prisma.user.findUnique({
    where: { id: winnerId },
    select: {
      referrerId: true,
      referrer: {
        select: {
          id: true,
          referrerId: true,
        },
      },
    },
  });

  if (!winner?.referrerId) return; // нет реферера — выходим

  const l1 = winner.referrerId;
  const l2 = winner.referrer?.referrerId ?? null;

  // L1: 50% от выигрыша — один UPDATE
  const l1Amount = (winAmount * BigInt(config.economy.referrerIncomePercent)) / 100n;
  if (l1Amount > 0n) {
    await updateBalance(
      l1,
      l1Amount,
      TransactionType.REFERRAL_INCOME,
      { sourceUserId: winnerId, winAmount: winAmount.toString(), level: 1 },
      { isEmission: false }
    );
    await prisma.user.update({
      where: { id: l1 },
      data: { referrerIncome: { increment: l1Amount } },
    });
  }

  // L2: 10% от выигрыша — один UPDATE (если есть)
  if (l2) {
    const l2Amount = (winAmount * BigInt(config.economy.subReferrerIncomePercent)) / 100n;
    if (l2Amount > 0n) {
      await updateBalance(
        l2,
        l2Amount,
        TransactionType.SUB_REFERRAL_INCOME,
        { sourceUserId: winnerId, winAmount: winAmount.toString(), level: 2 },
        { isEmission: false }
      );
      await prisma.user.update({
        where: { id: l2 },
        data: { subReferrerIncome: { increment: l2Amount } },
      });
    }
  }
};
