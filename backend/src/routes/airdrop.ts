// ═══════════════════════════════════════════════════════════════
// airdrop.ts — Механика Airdrop (P1)
//
// Принцип:
// 1. Снэпшот: фиксируем балансы всех пользователей на момент X
// 2. Администратор задаёт: коэффициент (multiplier) или фикс. сумму
// 3. Массовое начисление ᚙ всем пользователям из снэпшота
// 4. Запись в историю транзакций
//
// Роуты:
//   POST /admin/airdrop/snapshot   — создать снэпшот балансов
//   GET  /admin/airdrop/snapshots  — список снэпшотов
//   POST /admin/airdrop/execute    — выполнить airdrop
//   GET  /admin/airdrop/history    — история airdrop-ов
// ═══════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { prisma } from '@/lib/prisma';
import { authMiddleware } from '@/middleware/auth';
import { TransactionType } from '@prisma/client';
import { logger } from '@/lib/logger';
export const airdropRouter = Router();

// Middleware: только для администраторов
const adminOnly = async (req: Request, res: Response, next: Function) => {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
};

// ── POST /snapshot — создать снэпшот ─────────────────────────
airdropRouter.post('/snapshot', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { label } = req.body; // описание снэпшота, например "Pre-token airdrop March 2026"

    // Считаем всех активных пользователей и их балансы
    const users = await prisma.user.findMany({
      where:  { balance: { gt: 0n } },
      select: { id: true, telegramId: true, firstName: true, balance: true },
      orderBy: { balance: 'desc' },
    });

    const totalBalance = users.reduce((sum, u) => sum + u.balance, 0n);
    const snapshot = {
      label:        label ?? `Snapshot ${new Date().toISOString()}`,
      createdAt:    new Date().toISOString(),
      usersCount:   users.length,
      totalBalance: totalBalance.toString(),
      topUsers:     users.slice(0, 10).map(u => ({
        id: u.id, name: u.firstName, balance: u.balance.toString(),
      })),
    };

    // Сохраняем снэпшот как AdminNotification для истории
    await prisma.adminNotification.create({
      data: {
        type:    'AIRDROP_SNAPSHOT',
        payload: snapshot,
      },
    });

    logger.info(`[airdrop] Snapshot created: ${users.length} users, total ${totalBalance} ᚙ`);
    res.json({ success: true, snapshot });
  } catch (err) {
    logger.error('[airdrop/snapshot]', err);
    res.status(500).json({ error: 'Ошибка создания снэпшота' });
  }
});

// ── POST /execute — выполнить airdrop ────────────────────────
airdropRouter.post('/execute', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const {
      mode,           // 'fixed' | 'multiplier' | 'proportional'
      fixedAmount,    // для mode='fixed': сумма ᚙ каждому
      multiplier,     // для mode='multiplier': баланс * multiplier
      totalPool,      // для mode='proportional': общий пул делится пропорционально балансу
      minBalance,     // минимальный баланс для участия (фильтр)
      label,          // описание: "Token Launch Airdrop"
      dryRun,         // true = только симуляция, без записи
    } = req.body;

    if (!mode) return res.status(400).json({ error: 'mode обязателен: fixed | multiplier | proportional' });

    // Получаем участников
    const users = await prisma.user.findMany({
      where:  { balance: { gte: BigInt(minBalance ?? 0) } },
      select: { id: true, telegramId: true, firstName: true, balance: true },
    });

    if (users.length === 0) return res.status(400).json({ error: 'Нет участников' });

    // Рассчитываем суммы
    const distributions: Array<{ userId: string; name: string; amount: bigint }> = [];
    const totalBalances = users.reduce((s, u) => s + u.balance, 0n);

    for (const user of users) {
      let amount = 0n;

      if (mode === 'fixed') {
        amount = BigInt(fixedAmount ?? 0);
      } else if (mode === 'multiplier') {
        const mult = Number(multiplier ?? 1);
        amount = BigInt(Math.floor(Number(user.balance) * mult));
      } else if (mode === 'proportional') {
        const pool = BigInt(totalPool ?? 0);
        amount = totalBalances > 0n ? (pool * user.balance) / totalBalances : 0n;
      }

      if (amount > 0n) {
        distributions.push({ userId: user.id, name: user.firstName, amount });
      }
    }

    const totalAirdrop = distributions.reduce((s, d) => s + d.amount, 0n);

    // Dry run — только предпросмотр
    if (dryRun) {
      return res.json({
        dryRun:       true,
        mode,
        participants: distributions.length,
        totalAirdrop: totalAirdrop.toString(),
        preview:      distributions.slice(0, 20).map(d => ({
          name: d.name, amount: d.amount.toString(),
        })),
      });
    }

    // Выполняем батчами по 100 пользователей
    const BATCH = 100;
    let processed = 0;

    for (let i = 0; i < distributions.length; i += BATCH) {
      const batch = distributions.slice(i, i + BATCH);

      await prisma.$transaction(
        batch.map(d =>
          prisma.user.update({
            where: { id: d.userId },
            data:  { balance: { increment: d.amount } },
          })
        )
      );

      // Записываем транзакции
      await prisma.transaction.createMany({
        data: batch.map(d => ({
          userId:  d.userId,
          type:    TransactionType.WELCOME_BONUS, // используем как generic reward
          amount:  d.amount,
          payload: { label: label ?? 'Airdrop', mode, airdrop: true },
        })),
        skipDuplicates: true,
      });

      processed += batch.length;
      logger.info(`[airdrop] Progress: ${processed}/${distributions.length}`);
    }

    logger.info(`[airdrop] Completed: ${distributions.length} users, ${totalAirdrop} ᚙ distributed`);

    res.json({
      success:      true,
      mode,
      participants: distributions.length,
      totalAirdrop: totalAirdrop.toString(),
      label,
    });
  } catch (err) {
    logger.error('[airdrop/execute]', err);
    res.status(500).json({ error: 'Ошибка выполнения airdrop' });
  }
});

// ── GET /history — история airdrop-ов ───────────────────────
airdropRouter.get('/history', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const snapshots = await prisma.adminNotification.findMany({
      where:   { type: { in: ['AIRDROP_SNAPSHOT'] } },
      orderBy: { createdAt: 'desc' },
      take:    20,
    });
    res.json({ snapshots: snapshots.map(s => ({ id: s.id, payload: s.payload, createdAt: s.createdAt })) });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки истории' });
  }
});
