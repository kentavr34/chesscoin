// Playwright screenshot script — runs in GitHub Actions
// Captures key pages of the live app for visual review
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const APP_URL = process.env.APP_URL || 'https://chesscoin.app';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const OUT = process.env.OUT || './screenshots';

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },   // iPhone 14 Pro размер
  deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
});

// Настоящий telegram-web-app.js перетирает наш мок и роняет страницы:
// PageLayout зовёт CloudStorage.getItems, вне Telegram это WebAppMethodUnsupported,
// исключение долетает до ErrorBoundary → «Something went wrong» вместо экрана.
// Для съёмки блокируем загрузку SDK, чтобы остался наш мок.
await context.route('**/telegram-web-app.js*', (route) => route.abort());

// Inject auth token before every page load
if (AUTH_TOKEN) {
  await context.addInitScript((token) => {
    localStorage.setItem('accessToken', token);
    // Mock Telegram WebApp to prevent auth redirect
    window.Telegram = {
      WebApp: {
        initData: '',
        initDataUnsafe: {},
        version: '7.0',
        colorScheme: 'dark',
        themeParams: {},
        isExpanded: true,
        viewportHeight: 844,
        viewportStableHeight: 844,
        expand: () => {},
        close: () => {},
        ready: () => {},
        HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {}, selectionChanged: () => {} },
        BackButton: { isVisible: false, show: () => {}, hide: () => {}, onClick: () => {} },
        // CloudStorage обязателен: PageLayout читает через него флаги подсказок
        CloudStorage: {
          getItem: (k, cb) => cb && cb(null, ''),
          getItems: (ks, cb) => cb && cb(null, Object.fromEntries((ks || []).map((k) => [k, '']))),
          setItem: (k, v, cb) => cb && cb(null, true),
          removeItem: (k, cb) => cb && cb(null, true),
          removeItems: (ks, cb) => cb && cb(null, true),
          getKeys: (cb) => cb && cb(null, []),
        },
        MainButton: { isVisible: false, text: '', show: () => {}, hide: () => {}, enable: () => {}, disable: () => {}, setText: () => {}, onClick: () => {} },
      }
    };
  }, AUTH_TOKEN);
}

const page = await context.newPage();

const PAGES = [
  { name: '00_home',        path: '/',             wait: 3000 },
  { name: '01_game_setup',  path: '/',             wait: 1000, click: 'text=Играть' },
  { name: '02_battles',     path: '/battles',      wait: 2000 },
  { name: '03_leaderboard', path: '/leaderboard',  wait: 2000 },
  { name: '04_shop',        path: '/shop',         wait: 3000 },
  { name: '05_shop_boards', path: '/shop',         wait: 500,  click: 'text=Доски' },
  { name: '06_shop_pieces', path: '/shop',         wait: 500,  click: 'text=Фигуры' },
  { name: '07_shop_anims',  path: '/shop',         wait: 500,  click: 'text=Анимации' },
  { name: '08_profile',     path: '/profile',      wait: 2000 },
  { name: '09_tasks',       path: '/tasks',        wait: 2000 },
  { name: '10_nations',     path: '/nations',      wait: 2000 },
  { name: '11_referrals',   path: '/referrals',    wait: 2000 },
  // ── добавлено 2026-07-29 для визуального эталона: экраны, по которым
  //    Кенан исторически ловил регрессии (заголовки, панели, шаблоны) ──
  { name: '12_wars',        path: '/wars',         wait: 2500 },
  { name: '13_tournaments', path: '/tournaments',  wait: 2500 },
  { name: '14_lessons',     path: '/lessons',      wait: 2000 },
  { name: '15_battle_hist', path: '/battles/history', wait: 2000 },
  { name: '16_settings',    path: '/settings',     wait: 1500 },
  { name: '17_transactions', path: '/transactions', wait: 2000 },
];

// Каждый goto — полная перезагрузка SPA, авторизация проходит заново.
// Фиксированное ожидание не годится: часть экранов снималась на «Loading…».
// Ждём ПО ФАКТУ исчезновения индикатора, потом даём отрисовке успокоиться.
async function waitReady(page) {
  try {
    await page.waitForFunction(
      () => !/Loading\.\.\./.test(document.body.innerText || ''),
      { timeout: 25000 }
    );
  } catch { /* остаёмся с тем, что есть — это увидит проверка содержимого */ }
}

for (const pg of PAGES) {
  try {
    await page.goto(`${APP_URL}${pg.path}`, { waitUntil: 'networkidle', timeout: 15000 });
    await waitReady(page);
    await page.waitForTimeout(pg.wait);
    if (pg.click) {
      try { await page.click(pg.click, { timeout: 2000 }); await page.waitForTimeout(1000); }
      catch {}
    }
    await page.screenshot({ path: `${OUT}/${pg.name}.png`, fullPage: false });
    console.log(`✅ ${pg.name}.png`);
  } catch (e) {
    console.error(`❌ ${pg.name}: ${e.message}`);
    await page.screenshot({ path: `${OUT}/${pg.name}_error.png`, fullPage: false }).catch(() => {});
  }
}

// Also capture API status
import { writeFileSync } from 'fs';
try {
  const health = await page.evaluate(async () => {
    const r = await fetch('/api/v1/health');
    return r.json();
  });
  const shopItems = await page.evaluate(async (token) => {
    const r = await fetch('/api/v1/shop/items', { headers: { Authorization: `Bearer ${token}` } });
    return r.json();
  }, AUTH_TOKEN);

  const report = {
    timestamp: new Date().toISOString(),
    health,
    shopItems: shopItems.items?.map(i => ({ name: i.name, type: i.type, imageUrl: i.imageUrl })),
  };
  writeFileSync(`${OUT}/api_report.json`, JSON.stringify(report, null, 2));
  console.log('✅ api_report.json');
} catch (e) {
  console.error('❌ API report failed:', e.message);
}

await browser.close();
console.log(`\nDone! ${PAGES.length} screenshots saved to ${OUT}/`);
