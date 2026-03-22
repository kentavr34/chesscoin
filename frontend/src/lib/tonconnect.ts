/**
 * tonconnect.ts — TonConnect 2.0 интеграция
 *
 * Схема:
 * 1. Инициализируем TonConnect с манифестом
 * 2. Пользователь нажимает "Подключить" → открывается Telegram Wallet
 * 3. После подключения запрашиваем платёж 1 TON на кошелёк платформы
 * 4. После подтверждения — сохраняем адрес на бэкенде
 *
 * В Telegram WebApp TonConnect открывает нативный Wallet без редиректов.
 */

import type { TonConnectUI, ConnectedWallet, SendTransactionRequest } from '@tonconnect/ui';

// Ленивая инициализация — TonConnect грузится один раз
let _tc: TonConnectUI | null = null;

// Адрес кошелька ПЛАТФОРМЫ — куда приходит 1 TON за верификацию
// ВАЖНО: заменить на реальный адрес перед деплоем
export const PLATFORM_WALLET = import.meta.env.VITE_PLATFORM_TON_WALLET ?? 'UQDZNHJrTBJ9asNgL15bf-8Ud4Rleku-oP6TSlbg6EWXfq7y';

// Манифест приложения (TonConnect требует публичный URL)
const MANIFEST_URL = import.meta.env.VITE_APP_URL
  ? `${import.meta.env.VITE_APP_URL}/tonconnect-manifest.json`
  : 'https://chesscoin.app/tonconnect-manifest.json';

export async function getTonConnect(): Promise<TonConnectUI> {
  if (_tc) return _tc;

  const { TonConnectUI } = await import('@tonconnect/ui');
  _tc = new TonConnectUI({
    manifestUrl: MANIFEST_URL,
    // В Telegram WebApp — без кнопки, управляем сами
    buttonRootId: undefined,
  });

  return _tc;
}

/** Подключить кошелёк — открывает Telegram Wallet или QR */
export async function connectWallet(): Promise<ConnectedWallet> {
  const tc = await getTonConnect();

  // Если уже подключён — возвращаем
  if (tc.connected && tc.wallet) {
    return tc.wallet as ConnectedWallet;
  }

  return new Promise((resolve, reject) => {
    // Ждём события подключения
    const unsubscribe = tc.onStatusChange((wallet) => {
      if (wallet) {
        unsubscribe();
        resolve(wallet as ConnectedWallet);
      }
    });

    // Открываем модал выбора кошелька
    tc.openModal().catch((err) => {
      unsubscribe();
      reject(err);
    });

    // Таймаут 5 минут
    setTimeout(() => {
      unsubscribe();
      reject(new Error('Timeout: wallet not connected'));
    }, 5 * 60 * 1000);
  });
}

/** Отправить 1 TON платёж за верификацию */
export async function sendVerificationPayment(userId: string): Promise<string> {
  const tc = await getTonConnect();

  if (!tc.connected) {
    throw new Error('Wallet not connected');
  }

  // 1 TON в нано (1 TON = 1_000_000_000 нано)
  const amountNano = '1000000000';

  const tx: SendTransactionRequest = {
    validUntil: Math.floor(Date.now() / 1000) + 600, // 10 минут
    messages: [
      {
        address: PLATFORM_WALLET,
        amount: amountNano,
        // Комментарий — бэкенд ищет userId в комментарии для верификации
        payload: btoa(`chesscoin:verify:${userId}`),
      },
    ],
  };

  const result = await tc.sendTransaction(tx);
  // result.boc — base64 BOC (Bag of Cells) — идентификатор транзакции
  return result.boc;
}

/** Получить адрес подключённого кошелька */
export async function getWalletAddress(): Promise<string | null> {
  const tc = await getTonConnect();
  if (!tc.connected || !tc.wallet) return null;
  const wallet = tc.wallet as ConnectedWallet;
  return wallet.account?.address ?? null;
}


// ── Тип для P2P платежа биржи ────────────────────────────────
export interface TonPaymentParams {
  toAddress: string;     // адрес продавца
  amount: number;        // итоговая сумма в TON (float) — включает 0.5% комиссии
  comment?: string;      // комментарий (orderId и т.д.)
}

export interface TonPaymentResult {
  txHash: string;      // хэш транзакции (из boc)
  boc:    string;      // raw BOC для верификации на бэкенде
}

/**
 * Отправить TON на произвольный адрес (P2P биржа).
 * Используется при исполнении ордера: покупатель платит продавцу.
 * @param params toAddress, amount (TON), comment
 * @returns { txHash, boc }
 */
export async function sendTonPayment(params: TonPaymentParams): Promise<TonPaymentResult> {
  const tc = await getTonConnect();

  if (!tc.connected) {
    throw new Error('Wallet not connected. Connect TON wallet and try again.');
  }

  const PLATFORM_FEE = 0.005; // 0.5%
  const feeAmount    = params.amount * PLATFORM_FEE;
  const sellerAmount = params.amount - feeAmount;

  // Конвертируем TON → наносы (1 TON = 1_000_000_000 nanoTON)
  const sellerNano   = String(Math.floor(sellerAmount * 1_000_000_000));
  const feeNano      = String(Math.floor(feeAmount    * 1_000_000_000));

  const comment = params.comment ?? '';
  const payload = comment ? btoa(unescape(encodeURIComponent(comment))) : undefined;

  const tx: SendTransactionRequest = {
    validUntil: Math.floor(Date.now() / 1000) + 600,
    messages: [
      // 99.5% → продавец
      {
        address: params.toAddress,
        amount:  sellerNano,
        ...(payload ? { payload } : {}),
      },
      // 0.5% → платформа
      {
        address: PLATFORM_WALLET,
        amount:  feeNano,
        payload: payload ?? btoa('chesscoin:fee'),
      },
    ],
  };

  const result = await tc.sendTransaction(tx);
  const boc    = result.boc;

  // Получаем txHash из BOC (первые 32 байта после декодирования = hash)
  // В production используют @ton/core для точного извлечения, здесь — base64 как идентификатор
  const txHash = btoa(boc).slice(0, 44).replace(/[/+=]/g, '').slice(0, 32);

  return { txHash, boc };
}

/** Отключить кошелёк */
export async function disconnectWallet(): Promise<void> {
  const tc = await getTonConnect();
  await tc.disconnect();
}
