/**
 * tonWithdrawalWorker.ts — opt-in выплаты TON по WithdrawalRequest.
 *
 * Безопасный по умолчанию: если HOT_WALLET_MNEMONIC не задан в .env,
 * worker НЕ запускает реальных переводов — только логирует количество
 * PENDING-заявок. Включение реальных выплат:
 *
 *   HOT_WALLET_MNEMONIC="word1 word2 ... word24"  # 24 слова seed
 *   HOT_WALLET_ENABLED=true
 *
 * И установить пакет @ton/ton, который выполняет реальный signing/send:
 *   cd backend && npm i @ton/ton @ton/core
 *
 * Реальная имплементация send-TON в этом файле помечена TODO — это
 * последний шаг перед production, требует ручного подтверждения админа
 * (выпуск средств с горячего кошелька). До этого worker безопасно
 * пропускает все заявки в PENDING (admin может обработать вручную).
 */

import { prisma } from "@/lib/prisma";
import { logger, logError } from "@/lib/logger";

const HOT_WALLET_MNEMONIC = process.env.HOT_WALLET_MNEMONIC ?? "";
const HOT_WALLET_ENABLED = process.env.HOT_WALLET_ENABLED === "true";
const MAX_BATCH_PER_TICK = Math.max(1, Math.min(20,
  parseInt(process.env.HOT_WALLET_BATCH ?? "5", 10) || 5));

let warnOnce = false;

/**
 * Выгрузить TON юзеру по конкретной WithdrawalRequest.
 *
 * Реальный send TON требует @ton/ton + signer. Этот метод сейчас —
 * заглушка: ждём явного включения через HOT_WALLET_ENABLED=true.
 * Возвращает txHash при успехе либо бросает.
 */
async function sendTonPayout(_address: string, _amountTon: number): Promise<string> {
  if (!HOT_WALLET_ENABLED || !HOT_WALLET_MNEMONIC) {
    throw new Error("hot_wallet_disabled");
  }
  // TODO: интегрировать @ton/ton signer с mnemonic. Пример (после npm i @ton/ton):
  //
  //   import { mnemonicToWalletKey } from "@ton/crypto";
  //   import { WalletContractV4, TonClient, internal, beginCell } from "@ton/ton";
  //   const key = await mnemonicToWalletKey(HOT_WALLET_MNEMONIC.split(/\s+/));
  //   const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
  //   const client = new TonClient({ endpoint: "https://toncenter.com/api/v2/jsonRPC", apiKey: ... });
  //   const contract = client.open(wallet);
  //   const seqno = await contract.getSeqno();
  //   await contract.sendTransfer({
  //     secretKey: key.secretKey, seqno,
  //     messages: [internal({ to: _address, value: String(_amountTon), bounce: false })],
  //   });
  //   // дождаться нового seqno или txHash через client.getTransactions
  //   return "<real_txhash>";
  throw new Error("hot_wallet_send_not_implemented");
}

export async function processTonWithdrawals(): Promise<void> {
  try {
    const pending = await prisma.withdrawalRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: MAX_BATCH_PER_TICK,
    });
    if (pending.length === 0) return;

    if (!HOT_WALLET_ENABLED || !HOT_WALLET_MNEMONIC) {
      if (!warnOnce) {
        logger.warn(
          `[TonWithdraw] ${pending.length} PENDING заявок, но HOT_WALLET_ENABLED!=true ` +
          `или HOT_WALLET_MNEMONIC пуст — выплаты ВРУЧНУЮ (admin). ` +
          `Чтобы включить worker: HOT_WALLET_ENABLED=true + HOT_WALLET_MNEMONIC="..." ` +
          `(см. tonWithdrawalWorker.ts TODO). Это сообщение печатается один раз за рантайм.`
        );
        warnOnce = true;
      }
      return;
    }

    for (const w of pending) {
      try {
        // Помечаем как PROCESSING чтобы не взять повторно при следующем тике
        await prisma.withdrawalRequest.update({
          where: { id: w.id },
          data: { status: "PROCESSING" },
        });

        // Сумма к выплате: переводим монеты в TON по фиксированному rate
        // (1_000_000 монет = 1 TON). Комиссия уже была удержана при создании
        // заявки (см. /profile/ton/sell → tonCommission).
        const amountTon = Number(w.amountCoins) / 1_000_000;
        const txHash = await sendTonPayout(w.tonWalletAddress, amountTon);

        await prisma.withdrawalRequest.update({
          where: { id: w.id },
          data: { status: "COMPLETED", txHash, processedAt: new Date() },
        });
        logger.info(`[TonWithdraw] paid ${amountTon} TON to ${w.tonWalletAddress} (${w.id}) tx=${txHash}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // hot_wallet_disabled/not_implemented — возвращаем в PENDING, ждём ручного флага.
        const isSoft = msg.includes("hot_wallet_disabled") || msg.includes("not_implemented");
        await prisma.withdrawalRequest.update({
          where: { id: w.id },
          data: { status: isSoft ? "PENDING" : "FAILED", processedAt: new Date() },
        });
        if (!isSoft) {
          logError(`[TonWithdraw] failed payout ${w.id}:`, e);
        }
      }
    }
  } catch (e) {
    logError("[TonWithdraw] cron error:", e);
  }
}
