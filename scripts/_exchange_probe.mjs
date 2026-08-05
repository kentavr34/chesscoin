// Разбор экрана биржи: что видно с кошельком и без него.
import { chromium } from 'playwright';
const APP = process.env.APP_URL || 'https://chesscoin.app';
const TOKEN = process.env.AUTH_TOKEN || '';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript((t) => {
  localStorage.setItem('accessToken', t);
  window.Telegram = { WebApp: {
    initData: '', initDataUnsafe: {}, ready() {}, expand() {}, close() {},
    colorScheme: 'dark', themeParams: {}, viewportHeight: 900,
    MainButton: { show() {}, hide() {}, setText() {}, onClick() {} },
    BackButton: { show() {}, hide() {}, onClick() {} },
    HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
    CloudStorage: { getItem: (k, cb) => cb(null, '1'), getItems: (ks, cb) => cb && cb(null, Object.fromEntries((ks||[]).map(k=>[k,'1']))), setItem: (k, v, cb) => cb && cb(null, true), removeItem: (k,cb)=>cb&&cb(null,true), getKeys: (cb)=>cb&&cb(null,[]) },
    openTelegramLink() {}, openLink() {}, showPopup() {}, showAlert() {},
  } };
}, TOKEN);
await ctx.route('**/telegram-web-app.js*', (r) => r.abort());
const p = await ctx.newPage();

await p.goto(APP + '/shop', { waitUntil: 'networkidle', timeout: 25000 });
await p.waitForTimeout(4000);

const вкладки = await p.evaluate(() =>
  [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter((s) => s && s.length < 22));
console.log('кнопки магазина:', JSON.stringify(вкладки.slice(0, 20)));

// Открываем вкладку биржи
const биржа = p.locator('button', { hasText: /^(Биржа|Exchange|Birja|Borsa)$/ });
if (await биржа.count()) {
  await биржа.first().click();
  await p.waitForTimeout(3500);
  const текст = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
  console.log('\nэкран биржи:', текст.slice(0, 420));
  const кнопки = await p.evaluate(() =>
    [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter(Boolean));
  console.log('\nкнопки на бирже:', JSON.stringify(кнопки.slice(0, 25)));
  const отвязка = кнопки.some((k) => /Отвяз|Disconnect|Ayır|Kes/i.test(k));
  console.log('кнопка отвязки кошелька:', отвязка);
} else {
  console.log('вкладки «Биржа» не нашлось');
}
await b.close();
