/**
 * Публикация в Telegram-канал.
 *
 * Вынесено из crons.ts 2026-07-30: посты о батлах нужны не только часовому
 * cron'у, но и моменту создания вызова. Вызов живёт минуты — к следующему
 * запуску cron'а он уже никому не интересен, а именно канал приводит игроков,
 * которые примут вызов (батлы доигрывались 6 раз из 50 — принять было некому).
 */
import { logError, logger } from "@/lib/logger";

export type TelegramKeyboard = { inline_keyboard: Array<Array<Record<string, unknown>>> };

const BOT_TOKEN = () => process.env.BOT_TOKEN ?? "";
const CHANNEL_ID = () => process.env.TELEGRAM_CHANNEL_ID ?? "";
const BOT_LINK = () => process.env.BOT_LINK ?? "https://t.me/chessgamecoin_bot";

/** Минимальная ставка для поста. Стандартная ставка батла — ровно 10 000. */
export const MIN_CHANNEL_BET = 10_000n;

export async function sendToChannel(text: string, keyboard?: TelegramKeyboard): Promise<boolean> {
  if (!BOT_TOKEN() || !CHANNEL_ID()) {
    logger.warn("[Channel] Пост пропущен: не задан BOT_TOKEN или TELEGRAM_CHANNEL_ID");
    return false;
  }
  try {
    const body: Record<string, unknown> = { chat_id: CHANNEL_ID(), text, parse_mode: "HTML" };
    if (keyboard) body.reply_markup = keyboard;
    const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const ok = resp.ok;
    // Логируем и успех: молчащий канал уже один раз выглядел здоровым —
    // cron рапортовал «completed», не отправив ни одного поста (30.07).
    if (ok) logger.info("[Channel] Пост отправлен: " + text.slice(0, 40) + "…");
    else logger.warn(`[Channel] Telegram ответил ${resp.status}`);
    return ok;
  } catch (err: unknown) {
    logError("[Channel]", err);
    return false;
  }
}

/**
 * Анонс нового публичного вызова — сразу после создания.
 * Тихо выходит, если ставка ниже порога или канал не настроен:
 * создание батла не должно падать из-за Telegram.
 */
/**
 * Объявление войны между странами — публикация в канал.
 *
 * Кенан 31.07.2026: когда страна объявляет войну, канал должен рассказать
 * кто кому объявил, сколько в общей кассе войны, что победитель забирает
 * казну проигравшего целиком и что деньги делятся кратно числу побед
 * каждого бойца. И что войти в войну можно даже после её начала.
 */
export async function announceWarDeclared(params: {
  attackerName: string;
  attackerFlag?: string | null;
  attackerTreasury: bigint;
  defenderName: string;
  defenderFlag?: string | null;
  defenderTreasury: bigint;
  endAt: Date;
}): Promise<void> {
  try {
    const k = (v: bigint) => (Number(v) / 1000).toFixed(1) + "K ᚙ";
    const total = params.attackerTreasury + params.defenderTreasury;
    const hours = Math.max(1, Math.round((params.endAt.getTime() - Date.now()) / 3_600_000));
    const text =
      `⚔️ <b>Объявлена война!</b>\n\n` +
      `${params.attackerFlag ?? ""} <b>${params.attackerName}</b> объявила войну ` +
      `${params.defenderFlag ?? ""} <b>${params.defenderName}</b>\n\n` +
      `Казна нападающих: <b>${k(params.attackerTreasury)}</b>\n` +
      `Казна обороняющихся: <b>${k(params.defenderTreasury)}</b>\n` +
      `Общая касса войны: <b>${k(total)}</b>\n\n` +
      `Победившая страна забирает казну проигравшей <b>целиком</b>. ` +
      `Вся сумма делится между бойцами <b>кратно числу побед</b>: ` +
      `кто принёс пять побед — получит впятеро больше того, кто принёс одну. ` +
      `Кто не сыграл ни партии, не получит ничего.\n\n` +
      `Война идёт <b>${hours} ч</b>. Вступить можно и после начала — ` +
      `новых бойцов система сразу ставит в пары.`;
    const keyboard: TelegramKeyboard = {
      inline_keyboard: [[{ text: "⚔️ Вступить в войну", url: `${BOT_LINK()}?start=wars` }]],
    };
    await sendToChannel(text, keyboard);
  } catch (err: unknown) {
    logError("[Channel/War]", err);
  }
}

export async function announceBattleChallenge(params: {
  code: string;
  bet: bigint;
  creatorName: string;
  creatorElo?: number | null;
}): Promise<void> {
  try {
    if (params.bet < MIN_CHANNEL_BET) return;
    const betK = (Number(params.bet) / 1000).toFixed(1);
    const text =
      `⚔️ <b>Новый вызов!</b>\n\n` +
      `♟ <b>${params.creatorName}</b>${params.creatorElo ? ` (ELO ${params.creatorElo})` : ""} ` +
      `ставит <b>${betK}K ᚙ</b>\n\n` +
      `Первый, кто примет — сразится за двойной банк.`;
    const keyboard: TelegramKeyboard = {
      inline_keyboard: [[{ text: "⚔️ Принять вызов", url: `${BOT_LINK()}?start=battle_${params.code}` }]],
    };
    await sendToChannel(text, keyboard);
  } catch (err: unknown) {
    logError("[Channel/Challenge]", err);
  }
}
