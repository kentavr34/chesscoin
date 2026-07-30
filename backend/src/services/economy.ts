import { TransactionType, User } from "@prisma/client";
import { logger, logError } from "@/lib/logger"; // Q2
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
    logger.info("[Economy] 🚨 Emission cap reached! Phase 1 → 2");
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
  tx?: import("@prisma/client").Prisma.TransactionClient;
};

export const updateBalance = async (
  userId: string,
  amount: bigint, // положительное = начислить, отрицательное = списать
  type: TransactionType,
  payload: Record<string, unknown> = {},
  options: UpdateBalanceOptions = {}
) => {
  const execute = async (tx: import("@prisma/client").Prisma.TransactionClient) => {
    // ⚠️ ЗДЕСЬ БЫЛ read-modify-write: читали баланс, складывали в приложении
    // и писали абсолютное значение. Комментарий обещал блокировку, но её не было —
    // параллельные начисления затирали друг друга (lost update).
    // Цена на 30.07.2026: у 33 игроков из 91 баланс разошёлся с историей
    // транзакций, у Mikayıl — на 247 900 монет в минус.
    // Теперь только атомарные inc/dec на стороне Postgres.

    let updatedUser;

    if (amount < 0n) {
      // Списание с атомарной проверкой достатка: условие в WHERE, а не в коде.
      // Если денег не хватило — updateMany вернёт count=0, и мы падаем,
      // не уводя баланс в минус.
      const res = await tx.user.updateMany({
        where: { id: userId, balance: { gte: -amount } },
        data: {
          balance: { increment: amount },
          totalSpent: { increment: -amount },
        },
      });
      if (res.count === 0) {
        const cur = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
        throw new Error(`Insufficient balance: ${cur?.balance ?? 0} < ${-amount}`);
      }
      updatedUser = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    } else {
      updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          balance: { increment: amount },
          totalEarned: { increment: amount },
        },
      });
    }

    // Лига считается по ФАКТИЧЕСКОМУ балансу после инкремента.
    if (!options.skipLeagueUpdate) {
      const newLeague = calculateLeague(updatedUser.balance);
      if (newLeague !== updatedUser.league) {
        updatedUser = await tx.user.update({
          where: { id: userId },
          data: { league: newLeague },
        });
      }
    }

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
  };

  if (options.tx) {
    return execute(options.tx);
  }
  return prisma.$transaction(execute);
};

// ─────────────────────────────────────────
// Welcome бонус (только для новых)
// ─────────────────────────────────────────
export const giveWelcomeBonus = async (userId: string) => {
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
