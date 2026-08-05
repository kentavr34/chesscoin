/**
 * Эмодзи в ЖИВОМ интерфейсе — обход всех экранов Mini App на проде.
 *
 * Правило проекта: в Mini App только SVG-иконки (CLAUDE.md, раздел «UI ПРАВИЛА»).
 * Проверять по коду недостаточно: тексты интерфейса лежат в таблице ui_texts,
 * и словарь из базы перекрывает статический. 05.08.2026 профиль показывал
 * четыре эмодзи, которых в коде уже не было — они приходили из базы.
 *
 * Считаем то, что правило действительно запрещает — цветные эмодзи.
 * Шахматные символы (♔♛♟) — нотация, флаги стран — разрешённое исключение.
 */
import { chromium } from 'playwright';

const APP_URL = process.env.APP_URL || 'https://chesscoin.app';
const TOKEN = process.env.AUTH_TOKEN || '';

const PAGES = [
  '/', '/battles', '/battles/history', '/leaderboard', '/shop', '/profile',
  '/tasks', '/nations', '/referrals', '/wars', '/tournaments', '/lessons',
  '/settings', '/transactions',
];

// Цветные эмодзи + отдельно частые «значковые» из старых диапазонов.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu;
// Флаги стран — разрешены правилом, это исторические данные Country.flag.
const FLAG = /[\u{1F1E6}-\u{1F1FF}]/u;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 420, height: 860 },
  deviceScaleFactor: 2,
});
await ctx.addInitScript((token) => {
  localStorage.setItem('auth_token', token);
  window.Telegram = {
    WebApp: {
      initData: '', initDataUnsafe: {}, ready() {}, expand() {}, close() {},
      colorScheme: 'dark', themeParams: {}, viewportHeight: 860,
      MainButton: { show() {}, hide() {}, setText() {}, onClick() {} },
      BackButton: { show() {}, hide() {}, onClick() {} },
      HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
      CloudStorage: { getItem: (k, cb) => cb(null, '1'), setItem: (k, v, cb) => cb && cb(null, true) },
      openTelegramLink() {}, openLink() {}, showPopup() {}, showAlert() {},
    },
  };
}, TOKEN);

const page = await ctx.newPage();
let всего = 0;

for (const path of PAGES) {
  try {
    await page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForFunction(
      () => !/Loading|Загрузка|Yüklənir|Yükleniyor/i.test(document.body.innerText || ''),
      { timeout: 25000 },
    ).catch(() => {});
    await page.waitForTimeout(2500);

    const text = await page.evaluate(() => document.body.innerText || '');
    const найдено = [...text.matchAll(EMOJI)]
      .map((m) => m[0])
      .filter((e) => !FLAG.test(e));

    if (найдено.length) {
      всего += найдено.length;
      const уник = [...new Set(найдено)];
      console.log(`ЭМОДЗИ  ${path.padEnd(20)} ${найдено.length}  ${уник.join(' ')}`);
      // Показываем строку, где сидит эмодзи, — иначе искать негде.
      for (const e of уник.slice(0, 4)) {
        const line = text.split('\n').find((l) => l.includes(e));
        if (line) console.log(`        ${e}  «${line.trim().slice(0, 60)}»`);
      }
    } else {
      console.log(`чисто   ${path}`);
    }
  } catch (e) {
    console.log(`сбой    ${path.padEnd(20)} ${String(e).split('\n')[0].slice(0, 70)}`);
  }
}

console.log(`\nВСЕГО ЭМОДЗИ НА ЖИВЫХ ЭКРАНАХ: ${всего}`);
await browser.close();
process.exit(всего === 0 ? 0 : 1);
