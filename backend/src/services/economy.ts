import { TransactionType, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import config from "@/config";

// ─────────────────────────────────────────
// Получить текущую фазу платформы
// ─────────────────────────────────────────
export const getPlatformConfig = async () => {
  return prisma.platformConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
};

export const getCurrentPhase = async (): Promise<number> => {
  const cfg = await getPlatformConfig();
  // Автоматический переход в Фазу 2 при достижении emission_cap
  if (cfg.totalEmitted >= cfg.emissionCap && cfg.currentPhase === 1) {
    await prisma.platformConfig.update({
      where: { id: "singleton" },
      data: { currentPhase: 2 },
    });
    console.log("[Economy] 🚨 Emission cap reached! Phase 1 → 2");
    return 2;
  }
  return cfg.currentPhase;
};

// ─────────────────────────────────────────
// Проверка: можно ли сейчас раздавать монеты
// ─────────────────────────────────────────
export const canEmit = async (): Promise<boolean> => {
  const phase = await getCurrentPhase();
  return phase === 1;
};

// ─────────────────────────────────────────
// Основная функция изменения баланса
// Все операции с монетами ТОЛЬКО через неё
// ─────────────────────────────────────────
type UpdateBalanceOptions = {
  isEmission?: boolean; // true = новые монеты из резерва платформы
  skipLeagueUpdate?: boolean;
};

export const updateBalance = async (
  userId: string,
  amount: bigint, // положительное = начислить, отрицательное = списать
  type: TransactionType,
  payload: Record<string, unknown> = {},
  options: UpdateBalanceOptions = {}
) => {
  return prisma.$transaction(async (tx) => {
    // 1. Получаем пользователя с блокировкой
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // 2. Проверяем достаточно ли монет для списания
    if (amount < 0n && user.balance + amount < 0n) {
      throw new Error(`Insufficient balance: ${user.balance} < ${-amount}`);
    }

    const newBalance = user.balance + amount;

    // 3. Определяем лигу по новому балансу
    const newLeague = calculateLeague(newBalance);

    // 4. Обновляем баланс пользователя
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        balance: newBalance,
        totalEarned: amount > 0n ? user.totalEarned + amount : user.totalEarned,
        totalSpent:  amount < 0n ? user.totalSpent + (-amount) : user.totalSpent,
        league: options.skipLeagueUpdate ? user.league : newLeague,
      },
    });

    // 5. Записываем транзакцию
    await tx.transaction.create({
      data: {
        userId,
        amount,
        type,
        payload: payload as any,
      },
    });

    // 6. Если это эмиссия — обновляем счётчик платформы
    if (options.isEmission && amount > 0n) {
      await tx.platformConfig.update({
        where: { id: "singleton" },
        data: {
          totalEmitted: { increment: amount },
          platformReserve: { decrement: amount },
        },
      });
    }

    // 7. Если это возврат в платформу — пополняем резерв
    if (!options.isEmission && amount < 0n) {
      // Часть монет возвращается в резерв (комиссии, покупки)
      // Это внутренний перевод, не меняет total_emitted
    }

    return updatedUser;
  });
};

// ─────────────────────────────────────────
// Welcome бонус (только для новых)
// ─────────────────────────────────────────
export const giveWelcomeBonus = async (userId: string) => {
  const canGive = await canEmit();
  if (!canGive) return null;

  return updateBalance(
    userId,
    config.economy.welcomeBonus,
    TransactionType.WELCOME_BONUS,
    { reason: "new_user" },
    { isEmission: true }
  );
};

// processReferralFirstGame → перенесена в services/referral.ts (activateReferral)

// processReferralIncome → перенесена в services/referral.ts (applyReferralIncome)

// ─────────────────────────────────────────
// Определение лиги по балансу
// ─────────────────────────────────────────
export const calculateLeague = (balance: bigint) => {
  const t = config.economy.leagueThresholds;
  if (balance >= t.STAR)     return "STAR";
  if (balance >= t.CHAMPION) return "CHAMPION";
  if (balance >= t.DIAMOND)  return "DIAMOND";
  if (balance >= t.GOLD)     return "GOLD";
  if (balance >= t.SILVER)   return "SILVER";
  return "BRONZE";
};

// purchaseAttempt удалена — дублировала attempts.ts::purchaseAttempts (MP-1 аудит)
