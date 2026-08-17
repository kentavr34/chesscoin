import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
await ctx.addInitScript((t) => {
  localStorage.setItem('accessToken', t);
  // Подсказки помечаем прочитанными ЛОКАЛЬНО — так же, как у игрока,
  // который их однажды закрыл. Иначе они лягут поверх экрана.
  for (const k of ['info_seen_shop','info_seen_battles','info_seen_tasks','info_seen_profile','info_seen_tournaments'])
    localStorage.setItem(k, '1');
  window.__след = [];
  window.addEventListener('unhandledrejection', e => window.__след.push('rejection: ' + String(e.reason).slice(0,180)));
  window.Telegram = { WebApp: { initData:'', initDataUnsafe:{}, ready(){}, expand(){}, close(){},
    colorScheme:'dark', themeParams:{}, viewportHeight:900, version:'7.0',
    MainButton:{show(){},hide(){},setText(){},onClick(){}}, BackButton:{show(){},hide(){},onClick(){}},
    HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}},
    CloudStorage:{getItem:(k,cb)=>cb(null,'1'),getItems:(ks,cb)=>cb&&cb(null,Object.fromEntries((ks||[]).map(k=>[k,'1']))),setItem:(k,v,cb)=>cb&&cb(null,true),removeItem:(k,cb)=>cb&&cb(null,true),getKeys:(cb)=>cb&&cb(null,[])},
    openTelegramLink(u){ window.__след.push('openTelegramLink → ' + String(u).slice(0,90)); },
    openLink(u){ window.__след.push('openLink → ' + String(u).slice(0,90)); },
    showPopup(){}, showAlert(){} } };
}, process.env.AUTH_TOKEN || '');
await ctx.route('**/telegram-web-app.js*', r => r.abort());
const p = await ctx.newPage();
p.on('console', m => { const t=m.text(); if (m.type()==='error' || /tonconnect|manifest|wallet/i.test(t)) console.log('  [конс]', t.slice(0,170)); });
p.on('requestfailed', r => { if (!/telegram-web-app|analytics/.test(r.url())) console.log('  [сорвано]', r.url().slice(0,110), r.failure()?.errorText); });
p.on('request', r => { if (/wallets-v2|walletsList|raw\.github|bridge|manifest/i.test(r.url())) console.log('  [запрос]', r.url().slice(0,110)); });

await p.goto('https://chesscoin.app/shop', { waitUntil:'networkidle', timeout:30000 });
await p.waitForTimeout(3000);
await p.locator('button', { hasText: /^(Биржа|Exchange)$/ }).first().click();
await p.waitForTimeout(3000);
const кн = p.locator('button', { hasText: /Подключить TON/ }).first();
console.log('нажимаю «Подключить»…');
await кн.click();
for (let i = 1; i <= 14; i++) {
  await p.waitForTimeout(500);
  const с = await p.evaluate(() => {
    const кн = [...document.querySelectorAll('button')].find(b => /Подключ/i.test(b.innerText||''));
    const тост = [...document.querySelectorAll('div')].map(d => (d.innerText||'').trim())
      .find(t => t && t.length < 80 && /Открываю|Ошибка|не удалось|Timeout|reject/i.test(t));
    // Окно TonConnect живёт в теневом DOM внутри <tc-root>.
    const корень = document.querySelector('tc-root') || document.getElementById('tc-widget-root');
    let модал = 0, теневых = 0;
    if (корень) {
      теневых = корень.shadowRoot ? 1 : 0;
      const внутри = корень.shadowRoot ? корень.shadowRoot.querySelectorAll('*') : корень.querySelectorAll('*');
      модал = [...внутри].filter(e => e.getBoundingClientRect && e.getBoundingClientRect().height > 60).length;
    }
    return { кнопка: (кн?.innerText||'—').replace(/\s+/g,' '), тост: тост||null, модал, корень: !!корень, теневых };
  });
  if (i % 2 === 0 || с.тост || с.модал) console.log(`  ${(i*0.5).toFixed(1)}с  «${с.кнопка}» видимых_в_окне:${с.модал} корень:${с.корень}${с.тост?' | '+с.тост:''}`);
}
console.log('\nсобытия:', JSON.stringify(await p.evaluate(() => window.__след)));
await b.close();
