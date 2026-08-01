// Приглашение на батл глазами двух игроков.
//
// Кенан 01.08.2026: «тот, кто переходит по ссылке, не заходит на главную
// страницу игры, он прямиком попадает на эту игральную доску. Либо если
// первый, он как бы принять выходит, либо если игра уже началась, то он
// попадает в список зрителей».
//
// Одним аккаунтом этот путь не пройти — свой батл не примешь. Поэтому здесь
// два: первый создаёт вызов, второй приходит по ссылке и принимает.
//
// Запуск: TOKEN1=<jwt> TOKEN2=<jwt> TG1=<telegramId> node check_invite_accept.mjs
import { chromium } from 'playwright';
import { io } from '../../frontend/node_modules/socket.io-client/build/esm/index.js';

const APP_URL = process.env.APP_URL || 'https://chesscoin.app';
const { TOKEN1, TOKEN2, TG1 } = process.env;
if (!TOKEN1 || !TOKEN2 || !TG1) { console.error('нужны TOKEN1, TOKEN2, TG1'); process.exit(2); }

const STUB = `(function(token, startParam){
  localStorage.setItem('accessToken', token);
  window.Telegram = { WebApp: {
    initData: '', initDataUnsafe: startParam ? { start_param: startParam } : {},
    version: '7.0', colorScheme: 'dark', themeParams: {}, isExpanded: true,
    viewportHeight: 844, viewportStableHeight: 844,
    expand: function(){}, close: function(){}, ready: function(){},
    HapticFeedback: { impactOccurred: function(){}, notificationOccurred: function(){}, selectionChanged: function(){} },
    BackButton: { isVisible: false, show: function(){}, hide: function(){}, onClick: function(){} },
    CloudStorage: {
      getItem: function(k, cb){ cb && cb(null, ''); },
      getItems: function(ks, cb){ var o={}; (ks||[]).forEach(function(k){o[k]='';}); cb && cb(null, o); },
      setItem: function(k, v, cb){ cb && cb(null, true); },
      removeItem: function(k, cb){ cb && cb(null, true); },
      removeItems: function(ks, cb){ cb && cb(null, true); },
      getKeys: function(cb){ cb && cb(null, []); }
    },
    MainButton: { isVisible: false, text: '', show: function(){}, hide: function(){}, enable: function(){}, disable: function(){}, setText: function(){}, onClick: function(){} }
  } };
})`;

const browser = await chromium.launch({ headless: true });

async function openAs(token, startParam) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  await ctx.route('**/telegram-web-app.js*', (r) => r.abort());
  await ctx.addInitScript({ content: `(${STUB})(${JSON.stringify(token)}, ${JSON.stringify(startParam ?? '')});` });
  const page = await ctx.newPage();
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  return { ctx, page };
}

// ── Игрок 1: создаёт приватный вызов напрямую через сокет ──────────────────
const sessionId = await new Promise((resolve) => {
  const s = io(APP_URL, { auth: { token: TOKEN1 }, transports: ['websocket'], path: '/socket.io' });
  const done = (v) => { try { s.close(); } catch {} resolve(v); };
  s.on('connect_error', (e) => { console.log('сокет не подключился:', e?.message); done(null); });
  s.on('connect', () => {
    s.emit('game:create:battle', { color: 'white', duration: 300, bet: '1000', isPrivate: true },
      (res) => {
        if (!res?.session?.id) console.log('ответ сервера:', JSON.stringify(res).slice(0, 200));
        done(res?.session?.id ?? null);
      });
  });
  setTimeout(() => done(null), 15000);
});
console.log('вызов создан:', sessionId || 'НЕ УДАЛОСЬ');
if (!sessionId) { console.log('INVITE_NO_SESSION'); await browser.close(); process.exit(0); }

// ── Игрок 2: приходит по ссылке-приглашению ────────────────────────────────
const two = await openAs(TOKEN2, `refmatch_${TG1}_${sessionId}`);
let url = '';
for (let i = 0; i < 30; i++) {
  url = two.page.url();
  if (url.includes('/game/')) break;
  await two.page.waitForTimeout(500);
}
console.log('второй игрок попал на:', url.replace(APP_URL, '') || '/');

await two.page.waitForTimeout(2500);
const acceptBtn = two.page.locator('button', { hasText: /Принять вызов/i });
const hasAccept = await acceptBtn.count() > 0;
console.log('кнопка «Принять вызов»:', hasAccept);

let joined = false;
if (hasAccept) {
  await acceptBtn.first().click().catch(() => {});
  // Признак успеха — кнопка исчезла: она рисуется, только пока место свободно.
  // Искать «ВАШ ХОД» нельзя: принявший ходит вторым, и надпись у него другая.
  for (let i = 0; i < 24; i++) {
    if (await acceptBtn.count() === 0) { joined = true; break; }
    await two.page.waitForTimeout(500);
  }
  if (!joined) {
    const body = (await two.page.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log('после нажатия экран:', body.slice(0, 220));
  }
}
console.log('сел за доску игроком:', joined);

console.log(url.includes('/game/') && hasAccept && joined ? 'INVITE_ACCEPT_OK' : 'INVITE_ACCEPT_BROKEN');
console.log('sessionId=' + sessionId);
await browser.close();
