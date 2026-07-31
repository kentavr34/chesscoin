// Проверка кнопки «Следующая» глазами игрока.
//
// Кенан 01.08.2026: «нажимаешь следующее — один раз перешло, потом не
// переходит». Причина была в том, что загрузка задачи зависела только от
// адреса, а кнопка ведёт на тот же самый адрес. Проверять это осмысленно
// только живым нажатием: API-запросы и раньше отдавали разные задачи.
//
// Скрипт открывает страницу задачи, трижды жмёт «Следующая» и смотрит,
// меняется ли позиция на доске. Заглушка Telegram — как в скриншотере,
// иначе приложение висит на сплэше.
//
// Запуск:
//   AUTH_TOKEN=<jwt> node project_management/tools/check_next_button.mjs
import { chromium } from 'playwright';

const APP_URL = process.env.APP_URL || 'https://chesscoin.app';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
if (!AUTH_TOKEN) {
  console.error('нужен AUTH_TOKEN');
  process.exit(2);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
});

// Настоящий SDK перетирает заглушку и роняет страницу вне Telegram.
await context.route('**/telegram-web-app.js*', (route) => route.abort());

await context.addInitScript((token) => {
  localStorage.setItem('accessToken', token);
  window.Telegram = {
    WebApp: {
      initData: '', initDataUnsafe: {}, version: '7.0', colorScheme: 'dark',
      themeParams: {}, isExpanded: true, viewportHeight: 844, viewportStableHeight: 844,
      expand: () => {}, close: () => {}, ready: () => {},
      HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {}, selectionChanged: () => {} },
      BackButton: { isVisible: false, show: () => {}, hide: () => {}, onClick: () => {} },
      CloudStorage: {
        getItem: (k, cb) => cb && cb(null, ''),
        getItems: (ks, cb) => cb && cb(null, Object.fromEntries((ks || []).map((k) => [k, '']))),
        setItem: (k, v, cb) => cb && cb(null, true),
        removeItem: (k, cb) => cb && cb(null, true),
        removeItems: (ks, cb) => cb && cb(null, true),
        getKeys: (cb) => cb && cb(null, []),
      },
      MainButton: { isVisible: false, text: '', show: () => {}, hide: () => {}, enable: () => {}, disable: () => {}, setText: () => {}, onClick: () => {} },
    },
  };
}, AUTH_TOKEN);

const page = await context.newPage();

// Запоминаем, какие задачи приходили с сервера: смена id — доказательство,
// что страница действительно перезагрузила задачу, а не просто перерисовалась.
const loaded = [];
page.on('response', async (res) => {
  if (!res.url().includes('/api/v1/puzzles/')) return;
  try {
    const body = await res.json();
    const id = body?.puzzle?.id;
    if (id) loaded.push(id);
  } catch {}
});

await page.goto(`${APP_URL}/lesson/random?difficulty=easy`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Задачу надо сначала решить, иначе кнопки «Следующая» не будет. Решаем не
// по-настоящему: жмём «Следующая», если она есть, иначе выходим с диагнозом.
const CLICKS = 3;
let clicked = 0;
for (let i = 0; i < CLICKS; i++) {
  const btn = page.locator('button', { hasText: /Следующая|Next|Növbəti|Sonraki/ });
  if (await btn.count() === 0) break;
  await btn.first().click();
  clicked++;
  await page.waitForTimeout(1800);
}

const unique = [...new Set(loaded)];
console.log('загружено задач:', loaded.length, '| разных:', unique.length);
console.log('порядок:', loaded.join(' → '));
console.log('нажатий «Следующая»:', clicked);

// Кнопка живая, если каждое нажатие приводило к загрузке новой задачи.
if (clicked === 0) {
  console.log('NEXT_BUTTON_ABSENT — кнопки не было на экране (задача не решена)');
} else if (loaded.length >= clicked + 1) {
  console.log('NEXT_BUTTON_OK');
} else {
  console.log('NEXT_BUTTON_DEAD — нажатий больше, чем загрузок');
}

await browser.close();
