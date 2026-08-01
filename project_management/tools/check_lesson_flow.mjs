// Проверка урока глазами игрока: показ, затем тест.
//
// Кенан 01.08.2026 описал урок как два этапа на одной доске. Проверяем именно
// это: листаются ли ходы в обучении, ждёт ли доска игрока в тесте, появляются
// ли «Следующий урок» и «Вернуться в меню» после прохождения.
//
// Запуск: AUTH_TOKEN=<jwt> node project_management/tools/check_lesson_flow.mjs [id]
import { chromium } from 'playwright';

const APP_URL = process.env.APP_URL || 'https://chesscoin.app';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const LESSON_ID = process.argv[2] || '3';
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
let scenario = null;
page.on('response', async (res) => {
  if (!res.url().includes('/api/v1/lessons/')) return;
  try {
    const b = await res.json();
    if (b?.lesson?.moves) scenario = b.lesson;
  } catch {}
});

await page.goto(`${APP_URL}/learn/${LESSON_ID}`, { waitUntil: 'networkidle' });
// Фиксированной паузы мало: на холодном старте (сразу после пересборки
// фронта) бандлы тянутся дольше, и страж врал про «урок не загрузился».
// Ждём именно ответ по уроку, до 20 секунд.
for (let i = 0; i < 40 && !scenario; i++) await page.waitForTimeout(500);
await page.waitForTimeout(500);

const head = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 140);
console.log('экран:', head);
if (!scenario) { console.log('LESSON_NOT_LOADED'); await browser.close(); process.exit(0); }

// ── Этап «Обучение»: перемотка как в разборе партий ───────────────────────
// Кенан 01.08.2026 заменил стрелки «‹ ›» на привычный набор: в начало, шаг
// назад, воспроизведение, шаг вперёд, в конец. Проверяем, что они на месте.
const controls = ['start', 'prev', 'play', 'next', 'end'];
const missing = [];
for (const c of controls) {
  if (await page.locator(`button[aria-label="${c}"]`).count() === 0) missing.push(c);
}
console.log('кнопки перемотки:', missing.length ? 'нет ' + missing.join(',') : 'все пять');

const forward = page.locator('button[aria-label="next"]');
let stepped = 0;
for (let i = 0; i < scenario.moves.length; i++) {
  if (await forward.count() === 0) break;
  if (await forward.first().isDisabled()) break;
  await forward.first().click();
  stepped++;
  await page.waitForTimeout(250);
}
console.log('пролистано ходов:', stepped, 'из', scenario.moves.length);

// ── Этап «Тест»: играем ходы сами ─────────────────────────────────────────
await page.locator('button', { hasText: /^Тест$|^Test$/ }).first().click();
await page.waitForTimeout(600);

for (let i = 0; i < scenario.moves.length; i += 2) {
  const uci = scenario.moves[i];
  for (const sq of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const cell = page.locator(`[data-square="${sq}"]`);
    if (await cell.count() === 0) { console.log('нет клетки', sq); break; }
    await cell.first().click();
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(700);
}
await page.waitForTimeout(1500);

const finalText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const done = /Урок пройден|Lesson complete|Dərs keçildi|Ders tamamlandı/.test(finalText);
// Нижняя панель постоянная: подписи короткие, «Следующий» гаснет, пока урок
// не пройден, и для последнего урока в линейке остаётся выключенной.
const nextBtn = page.locator('button', { hasText: /^(Следующий|Next|Növbəti|Sonraki)$/ });
const menuBtn = page.locator('button', { hasText: /^(Меню|Menu|Menyu|Menü)$/ });
const hasNext = await nextBtn.count() > 0 && !(await nextBtn.first().isDisabled());
const hasMenu = await menuBtn.count() > 0;

console.log('после теста:', finalText.slice(0, 160));
console.log('пройден:', done, '| кнопка «следующий»:', hasNext, '| кнопка «в меню»:', hasMenu);

if (done && hasMenu && missing.length === 0 && stepped === scenario.moves.length) console.log('LESSON_FLOW_OK');
else console.log('LESSON_FLOW_BROKEN');

await browser.close();
