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
import { BOT_USERNAME } from './deepLink';

// Ленивая инициализация — TonConnect грузится один раз
let _tc: TonConnectUI | null = null;

// Адрес кошелька ПЛАТФОРМЫ — куда приходит 1 TON за верификацию
// ВАЖНО: заменить на реальный адрес перед деплоем
// Кошелёк платформы — куда идёт комиссия 0,5%.
//
// Раньше он брался только отсюда: переменная сборки, а если её нет — адрес,
// зашитый в код. На проде переменная НЕ ЗАДАНА, то есть работал запасной
// адрес. Сегодня он совпадает с серверным, но при смене кошелька в .env
// комиссия ушла бы на старый адрес, сервер её не нашёл бы — и ни одна
// покупка не прошла бы (FEE_NOT_CONFIRMED). Кенан 09.08.2026.
//
// Теперь адрес спрашивается у сервера (GET /profile/ton/rate) и запоминается
// на время сеанса. Зашитое значение остаётся последней подстраховкой, если
// сервер недоступен.
const ЗАПАСНОЙ_КОШЕЛЁК = 'UQDZNHJrTBJ9asNgL15bf-8Ud4Rleku-oP6TSlbg6EWXfq7y';
let кошелёкПлатформы: string | null = null;

/** Запомнить адрес, пришедший с сервера. Вызывается там, где берут курс. */
export function setPlatformWallet(адрес: string | null | undefined): void {
  if (адрес && адрес.length > 20) кошелёкПлатформы = адрес;
}

/** Адрес для комиссии: серверный, если известен, иначе запасной. */
export function getPlatformWallet(): string {
  return кошелёкПлатформы ?? import.meta.env.VITE_PLATFORM_TON_WALLET ?? ЗАПАСНОЙ_КОШЕЛЁК;
}

export const PLATFORM_WALLET = ЗАПАСНОЙ_КОШЕЛЁК;

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
    // КУДА ВЕРНУТЬСЯ ИЗ КОШЕЛЬКА. Без этого адреса Telegram-кошелёк, подтвердив
    // подключение, оставляет человека у себя: наше приложение ответа не получает,
    // адрес не сохраняется, и со стороны это выглядит как «кнопка не работает».
    // Кенан 18.08.2026: «отсоединение и присоединение кошелька не работает» —
    // в логах сервера за сутки НИ ОДНОГО запроса к /profile/ton-wallet, то есть
    // до нас дело действительно не доходило.
    actionsConfiguration: {
      twaReturnUrl: `https://t.me/${BOT_USERNAME}`,
    },
  });

  return _tc;
}

/** Подключить кошелёк — открывает Telegram Wallet или QR */
export async function connectWallet(): Promise<ConnectedWallet> {
  const tc = await getTonConnect();

  // Сеанс восстанавливается асинхронно: сразу после создания объекта
  // tc.connected ещё не отражает действительность. Дожидаемся.
  await (tc as unknown as { connectionRestored: Promise<boolean> }).connectionRestored
    .catch(() => false);

  // Уже подключён — отдаём как есть.
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
        address: getPlatformWallet(),
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
  boc: string;      // raw BOC от кошелька; хэш находит бэкенд в блокчейне
}

/**
 * Отправить TON на произвольный адрес (P2P биржа).
 * Покупатель одной транзакцией платит продавцу 99.5% и комиссию 0.5%
 * на кошелёк платформы — платформа денег не хранит и ничего не отправляет.
 * @param params toAddress, amount (TON), comment
 * @returns { boc }
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
        address: getPlatformWallet(),
        amount:  feeNano,
        payload: payload ?? btoa('chesscoin:fee'),
      },
    ],
  };

  const result = await tc.sendTransaction(tx);
  const boc    = result.boc;

  // Раньше здесь из BOC делался ПСЕВДО-хэш (кусок base64) и отправлялся на бэкенд
  // как txHash. В блокчейне такого хэша нет — верификация искала его и никогда
  // не находила, а биржа на этом основании выдавала монеты бесплатно (30.07.2026).
  // Настоящий хэш клиент получить не может; бэкенд теперь сам находит платёж
  // в блокчейне по паре «отправитель → получатель + сумма + свежесть»
  // и берёт реальный хэш оттуда. Поэтому отдаём только BOC — то, что у нас есть.
  return { boc };
}

/** Отключить кошелёк */
export async function disconnectWallet(): Promise<void> {
  const tc = await getTonConnect();
  // Без ожидания рвать нечего: сеанс мог ещё не восстановиться, и disconnect
  // молча уходил в пустоту — а следом подключение видело «уже подключён».
  await (tc as unknown as { connectionRestored: Promise<boolean> }).connectionRestored
    .catch(() => false);
  if (tc.connected) await tc.disconnect();
}
