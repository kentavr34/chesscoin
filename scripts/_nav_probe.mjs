import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 420, height: 880 }, deviceScaleFactor: 2 });
await ctx.addInitScript((t) => {
  localStorage.setItem('accessToken', t);
  const L = process.env.LANG_CODE || 'ru';
  window.Telegram = { WebApp: { initData:'', initDataUnsafe:{}, ready(){}, expand(){}, close(){},
    colorScheme:'dark', themeParams:{}, viewportHeight:880,
    MainButton:{show(){},hide(){},setText(){},onClick(){}}, BackButton:{show(){},hide(){},onClick(){}},
    HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}},
    CloudStorage:{getItem:(k,cb)=>cb(null,'1'),getItems:(ks,cb)=>cb&&cb(null,Object.fromEntries((ks||[]).map(k=>[k,'1']))),setItem:(k,v,cb)=>cb&&cb(null,true),removeItem:(k,cb)=>cb&&cb(null,true),getKeys:(cb)=>cb&&cb(null,[])},
    openTelegramLink(){},openLink(){},showPopup(){},showAlert(){} } };
}, process.env.AUTH_TOKEN || '');
await ctx.route('**/telegram-web-app.js*', (r) => r.abort());
const p = await ctx.newPage();
await p.goto('https://chesscoin.app/', { waitUntil: 'networkidle', timeout: 25000 });
await p.waitForTimeout(4500);
const нав = await p.evaluate(() => {
  const n = document.querySelector('nav');
  if (!n) return { есть: false };
  const b = n.querySelector('button');
  const r = b ? b.getBoundingClientRect() : null;
  const значки = [...n.querySelectorAll('div')].filter(d => d.innerText && d.innerText.length < 14 && d.querySelector('svg'));
  const ряд = значки.length ? значки[0].getBoundingClientRect() : null;
  return { есть: true, полоса: b ? b.innerText.replace(/\n/g,' | ') : null,
           надРядом: r && ряд ? r.bottom <= ряд.top + 2 : null,
           значков: значки.length };
});
console.log(JSON.stringify(нав, null, 1));
await p.screenshot({ path: 'scripts/_nav.png', clip: { x: 0, y: 700, width: 420, height: 180 } });
await b.close();
