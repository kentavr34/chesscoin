// Что происходит при нажатии «Подключить TON-кошелёк» — по факту, в браузере.
//
// Кенан 18.08.2026: «отсоединение и присоединение кошелька не работает».
// В логах сервера за сутки нет ни одного запроса к /profile/ton-wallet —
// значит, до сервера дело не доходит и ломается на стороне TonConnect.
import { chromium } from 'playwright';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
await ctx.addInitScript((t) => {
  localStorage.setItem('accessToken', t);
  window.Telegram = { WebApp: {
    initData: '', initDataUnsafe: {}, ready() {}, expand() {}, close() {},
    colorScheme: 'dark', themeParams: {}, viewportHeight: 900, version: '7.0',
    MainButton: { show() {}, hide() {}, setText() {}, onClick() {} },
    BackButton: { show() {}, hide() {}, onClick() {} },
    HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
    CloudStorage: { getItem: (k, cb) => cb(null, '1'), getItems: (ks, cb) => cb && cb(null, Object.fromEntries((ks || []).map(k => [k, '1']))), setItem: (k, v, cb) => cb && cb(null, true), removeItem: (k, cb) => cb && cb(null, true), getKeys: (cb) => cb && cb(null, []) },
    openTelegramLink() { window.__openTG = true; },
    openLink() { window.__openLink = true; },
    showPopup() {}, showAlert() {},
  } };
}, process.env.AUTH_TOKEN || '');
await ctx.route('**/telegram-web-app.js*', (r) => r.abort());

const p = await ctx.newPage();
const консоль = [];
p.on('console', (m) => консоль.push(`[${m.type()}] ${m.text().slice(0, 160)}`));
p.on('pageerror', (e) => консоль.push(`[pageerror] ${String(e).slice(0, 200)}`));

// Что именно не загрузилось — SDK кошелька тянет список кошельков и манифест.
const сорвалось = [];
p.on('requestfailed', (r) => сорвалось.push(`${r.method()} ${r.url().slice(0, 130)} — ${r.failure()?.errorText}`));
p.on('response', (r) => { if (r.status() >= 400) сорвалось.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`); });

const запросы = [];
p.on('request', (r) => {
  const u = r.url();
  if (/ton-wallet|tonconnect|bridge|walletsList/i.test(u)) запросы.push(`${r.method()} ${u.slice(0, 110)}`);
});

await p.goto('https://chesscoin.app/shop', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(3500);
await p.locator('button', { hasText: /^(Биржа|Exchange)$/ }).first().click();
await p.waitForTimeout(3500);

const кнопка = p.locator('button', { hasText: /Подключить TON/ });
console.log('кнопка подключения найдена:', await кнопка.count() > 0);
if (await кнопка.count()) {
  await кнопка.first().click();
  await p.waitForTimeout(9000);

  const модал = await p.evaluate(() => {
    const узлы = [...document.querySelectorAll('*')].filter((e) => {
      const id = (e.id || '') + ' ' + (typeof e.className === 'string' ? e.className : '');
      return /tc-|tonconnect/i.test(id);
    });
    return {
      элементов: узлы.length,
      видимых: узлы.filter((e) => e.getBoundingClientRect().height > 40).length,
      текст: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
    };
  });
  console.log('окно кошелька:', JSON.stringify(модал));
}

console.log('\nзапросы TonConnect:');
console.log(запросы.length ? запросы.slice(0, 8).map((x) => '  ' + x).join('\n') : '  НИ ОДНОГО');
console.log('\nсорванные запросы:');
console.log(сорвалось.length ? сорвалось.slice(0, 10).map((x) => '  ' + x).join('\n') : '  нет');

console.log('\nконсоль:');
console.log(консоль.length ? консоль.slice(-10).map((x) => '  ' + x).join('\n') : '  пусто');
await p.screenshot({ path: 'scripts/_tonconnect.png' });
await b.close();
