// Проверка глубоких ссылок глазами игрока.
//
// Кенан 01.08.2026: «человек кликает на неё, но попадает на главную страницу
// игры, а не сразу на ту игровую доску». Telegram отдаёт параметр ссылки в
// initDataUnsafe.start_param — здесь мы подставляем его так же, как это делает
// клиент Telegram, и смотрим, куда приложение в итоге привело.
//
// Запуск: AUTH_TOKEN=<jwt> node project_management/tools/check_deep_link.mjs <start_param> <ожидаемый кусок пути>
import { chromium } from 'playwright';

const APP_URL = process.env.APP_URL || 'https://chesscoin.app';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const START_PARAM = process.argv[2] || '';
const EXPECT = process.argv[3] || '/game/';
if (!AUTH_TOKEN || !START_PARAM) { console.error('нужны AUTH_TOKEN и start_param'); process.exit(2); }

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
});
await context.route('**/telegram-web-app.js*', (route) => route.abort());
await context.addInitScript(([token, startParam]) => {
  localStorage.setItem('accessToken', token);
  window.Telegram = {
    WebApp: {
      initData: '', initDataUnsafe: { start_param: startParam }, version: '7.0',
      colorScheme: 'dark', themeParams: {}, isExpanded: true,
      viewportHeight: 844, viewportStableHeight: 844,
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
}, [AUTH_TOKEN, START_PARAM]);

const page = await context.newPage();
await page.goto(APP_URL, { waitUntil: 'networkidle' });

// Приложению нужно время: логин, сокет, разбор параметра, переход.
let url = '';
for (let i = 0; i < 30; i++) {
  url = page.url();
  if (url.includes(EXPECT)) break;
  await page.waitForTimeout(500);
}

const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 120);
console.log('параметр:', START_PARAM);
console.log('итоговый адрес:', url.replace(APP_URL, '') || '/');
console.log('экран:', body);
console.log(url.includes(EXPECT) ? 'DEEPLINK_OK' : `DEEPLINK_BROKEN (ждали ${EXPECT})`);

await browser.close();
