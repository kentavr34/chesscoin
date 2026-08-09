import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
await ctx.addInitScript((t) => {
  localStorage.setItem('accessToken', t);
  window.Telegram = { WebApp: { initData: '', initDataUnsafe: {}, ready(){}, expand(){}, close(){},
    colorScheme: 'dark', themeParams: {}, viewportHeight: 900,
    MainButton:{show(){},hide(){},setText(){},onClick(){}}, BackButton:{show(){},hide(){},onClick(){}},
    HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}},
    CloudStorage:{getItem:(k,cb)=>cb(null,'1'),getItems:(ks,cb)=>cb&&cb(null,Object.fromEntries((ks||[]).map(k=>[k,'1']))),setItem:(k,v,cb)=>cb&&cb(null,true),removeItem:(k,cb)=>cb&&cb(null,true),getKeys:(cb)=>cb&&cb(null,[])},
    openTelegramLink(){},openLink(){},showPopup(){},showAlert(){} } };
}, process.env.AUTH_TOKEN || '');
await ctx.route('**/telegram-web-app.js*', (r) => r.abort());
const p = await ctx.newPage();
await p.goto('https://chesscoin.app/battles', { waitUntil: 'networkidle', timeout: 25000 });
await p.waitForTimeout(5000);
const кнопки = await p.evaluate(() => [...document.querySelectorAll('button')].map(b => (b.innerText||'').trim()).filter(Boolean));
console.log('кнопки на батлах:', JSON.stringify(кнопки.slice(0, 20)));
console.log('есть «быстрый»:', кнопки.some(k => /быстр|quick|sürətli|hızlı/i.test(k)));
console.log('есть «история»:', кнопки.some(k => /истор|history|tarix|geçmiş/i.test(k)));
await b.close();
