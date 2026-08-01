// Проверка: можно ли сесть за доску с непройденным уровнем Джарвиса.
//
// Кенан 01.08.2026: «уровень вроде открыт, но когда я нажал играть, вышло
// красное уведомление, что сначала тебе нужно пройти девятый». Список уровней
// действительно открыт, запрет сидел в бэкенде. Проверяем тем же путём, каким
// шёл он: главный экран → «Играть» → перелистать уровни вверх → начать партию.
//
// Запуск: AUTH_TOKEN=<jwt> node project_management/tools/check_jarvis_level.mjs [сколько уровней вверх]
import { chromium } from 'playwright';

const APP_URL = process.env.APP_URL || 'https://chesscoin.app';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const STEPS_UP = Number(process.argv[2] || 8);
if (!AUTH_TOKEN) { console.error('нужен AUTH_TOKEN'); process.exit(2); }

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
});
await context.route('**/telegram-web-app.js*', (route) => route.abort());
await context.addInitScript((token) => {
  localStorage.setItem('accessToken', token);
  window.Telegram = {
    WebApp: {
      initData: '', initDataUnsafe: {}, version: '7.0', colorScheme: 'dark', themeParams: {},
      isExpanded: true, viewportHeight: 844, viewportStableHeight: 844,
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
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });

await page.goto(APP_URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

// Закрыть всё, что успело открыться поверх (подсказки, «активные партии»):
// иначе клик по блоку Джарвиса не доходит.
for (let i = 0; i < 4; i++) {
  const close = page.locator('button', { hasText: /^[✕✖×]$/ }).first();
  if (await close.count() === 0) break;
  await close.click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(400);
}

// Открыть окно игры с Джарвисом
const playBlock = page.locator('text=/Джарвис|J\\.A\\.R\\.V\\.I\\.S|Jarvis/i').first();
if (await playBlock.count() === 0) { console.log('JARVIS_BLOCK_NOT_FOUND'); await browser.close(); process.exit(0); }
await playBlock.click();
await page.waitForTimeout(1500);

const levelText = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
console.log('окно:', (await levelText()).slice(0, 110));

// Перелистать уровни вверх — стрелка «вперёд» справа от названия уровня.
// Стрелка «уровень выше» — первая кнопка с «›» в строке уровня.
const upBtn = page.locator('button', { hasText: /^›$/ }).first();
if (await upBtn.count() === 0) { console.log('LEVEL_ARROW_NOT_FOUND'); await browser.close(); process.exit(0); }
for (let i = 0; i < STEPS_UP; i++) {
  await upBtn.click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(250);
}
const afterPick = await levelText();
console.log('после перелистывания:', afterPick.slice(0, 110));

// Начать партию
const startBtn = page.locator('button', { hasText: /Играть|Начать|Play|Start|В бой/i }).last();
if (await startBtn.count() === 0) { console.log('START_BUTTON_NOT_FOUND'); await browser.close(); process.exit(0); }
const disabled = await startBtn.isDisabled().catch(() => false);
console.log('кнопка старта заблокирована:', disabled);
await startBtn.click().catch(() => {});

// Ждём либо доску, либо красное сообщение
let url = '';
let toast = '';
for (let i = 0; i < 30; i++) {
  url = page.url();
  const body = await levelText();
  const m = body.match(/(не разблокирован|not unlocked|сначала[^.]{0,60}|Level \d+ is not[^.]{0,40})/i);
  if (m) toast = m[0];
  if (url.includes('/game/') || toast) break;
  await page.waitForTimeout(500);
}

console.log('адрес:', url.replace(APP_URL, '') || '/');
if (toast) console.log('сообщение:', toast);
if (errors.length) console.log('ошибки консоли:', errors.slice(0, 2).join(' | '));

console.log(url.includes('/game/') && !toast ? 'JARVIS_LEVEL_OK' : 'JARVIS_LEVEL_BLOCKED');
await browser.close();
