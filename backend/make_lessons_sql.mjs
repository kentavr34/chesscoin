// Сборка SQL для уроков 121–300: сами уроки + их тексты на четырёх языках.
//
// Ничего не удаляет: старые уроки 1–120 не трогаются. Повторный запуск
// безопасен — записи перезаписываются по ключу, а не дублируются.
import { readFileSync, writeFileSync } from 'node:fs';
import { БЛОКИ } from './lesson_texts.mjs';

const SRC = process.argv[2];
const OUT = process.argv[3];

const { уроки } = JSON.parse(readFileSync(SRC, 'utf8'));
const строки = [];
const кав = (s) => "'" + String(s).replace(/'/g, "''") + "'";

строки.push('-- Уроки 121–300: комбинации, атака, красивые маты, тяжёлые окончания.');
строки.push('-- Кенан 05.08.2026: «максимальное количество профессиональных версий,');
строки.push('-- начинать с лёгкого и идти к сложному».');
строки.push('BEGIN;');

const пропущенные = new Set();
for (const у of уроки) {
  const блок = БЛОКИ[у.block];
  if (!блок) { пропущенные.add(у.block); continue; }

  строки.push(
    `INSERT INTO lessons (id, block, "titleKey", "explainKey", fen, moves, reward) VALUES (` +
    `${у.id}, ${кав(у.block)}, ${кав(`lessons.item.${у.id}.title`)}, ` +
    `${кав(`lessons.theme.${у.block}.explain`)}, ${кав(у.fen)}, ` +
    `ARRAY[${у.moves.map(кав).join(',')}]::text[], ${у.reward}) ` +
    `ON CONFLICT (id) DO UPDATE SET block=EXCLUDED.block, "titleKey"=EXCLUDED."titleKey", ` +
    `"explainKey"=EXCLUDED."explainKey", fen=EXCLUDED.fen, moves=EXCLUDED.moves, reward=EXCLUDED.reward;`
  );

  // Название урока — «Приём · номер в блоке», как в уроках 21–120.
  const n = блок.name;
  строки.push(
    `INSERT INTO ui_texts (key, screen, place, kind, ru, en, az, tr, "updatedAt") VALUES (` +
    `${кав(`lessons.item.${у.id}.title`)}, 'lessons', 'title', 'label', ` +
    `${кав(`${n.ru} · ${у.ord}`)}, ${кав(`${n.en} · ${у.ord}`)}, ` +
    `${кав(`${n.az} · ${у.ord}`)}, ${кав(`${n.tr} · ${у.ord}`)}, now()) ` +
    `ON CONFLICT (key) DO UPDATE SET ru=EXCLUDED.ru, en=EXCLUDED.en, az=EXCLUDED.az, ` +
    `tr=EXCLUDED.tr, "updatedAt"=now();`
  );
}

// Объяснение приёма — одно на блок.
for (const [ключ, блок] of Object.entries(БЛОКИ)) {
  if (!уроки.some((у) => у.block === ключ)) continue;
  const e = блок.explain;
  строки.push(
    `INSERT INTO ui_texts (key, screen, place, kind, ru, en, az, tr, "updatedAt") VALUES (` +
    `${кав(`lessons.theme.${ключ}.explain`)}, 'lessons', 'explain', 'text', ` +
    `${кав(e.ru)}, ${кав(e.en)}, ${кав(e.az)}, ${кав(e.tr)}, now()) ` +
    `ON CONFLICT (key) DO UPDATE SET ru=EXCLUDED.ru, en=EXCLUDED.en, az=EXCLUDED.az, ` +
    `tr=EXCLUDED.tr, "updatedAt"=now();`
  );
}

строки.push('COMMIT;');
writeFileSync(OUT, строки.join('\n') + '\n', 'utf8');

if (пропущенные.size) {
  console.log('НЕТ ТЕКСТОВ для блоков: ' + [...пропущенные].join(', ') + ' — они пропущены');
}
console.log(`уроков в SQL: ${уроки.filter((у) => БЛОКИ[у.block]).length}`);
