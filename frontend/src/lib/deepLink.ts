/**
 * Ссылки в Mini App — одно место на весь фронт.
 *
 * Раньше ссылки собирались по месту и врали: три из них вели на
 * `t.me/ChessCoinBot/app`, тогда как настоящий бот — `chessgamecoin_bot`.
 * Такая ссылка не открывала ничего.
 *
 * Кенан 01.08.2026: «Ссылка должна автоматически содержать реферальный код и
 * код дальше этой комнаты этого батла» — приглашение на партию ведёт прямо на
 * доску и приводит реферала тому, кто поделился. Если пришедший не новый, он
 * просто смотрит партию зрителем.
 */

/** Имя бота проверено через getMe: username = chessgamecoin_bot. */
export const BOT_USERNAME = 'chessgamecoin_bot';

/** Бот открывает главное веб-приложение: ?startapp=<параметр> ведёт внутрь. */
const app = (param: string) => `https://t.me/${BOT_USERNAME}?startapp=${param}`;

/** Приглашение на конкретную партию: сразу доска + реферал пригласившему. */
export const linkToSession = (sessionId: string, myTelegramId?: string | null) =>
  myTelegramId ? app(`refmatch_${myTelegramId}_${sessionId}`) : app(`match_${sessionId}`);

/** Принять открытый вызов по коду батла: вход в партию и сразу доска. */
export const linkToJoinByCode = (code: string) => app(`game_${code}`);

/** Универсальный просмотр партии по shareToken (работает и после конца). */
export const linkToShare = (token: string) => app(`share_${token}`);

/** Готовая ссылка «поделиться» для Telegram. */
export const telegramShare = (url: string, text: string) =>
  `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
