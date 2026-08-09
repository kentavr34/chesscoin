# -*- coding: utf-8 -*-
"""Выгрузка истории решений проекта в docs/history/DECISIONS.md.

Нужна графу знаний: по коду видно УСТРОЙСТВО, но не ЗАМЫСЕЛ. Решения Кенана,
найденные дефекты и уроки на ошибках живут в памяти проекта, а граф читает
файлы — поэтому память выгружается в файл рядом с кодом.

Запуск:  python project_management/tools/export_history.py [сколько записей]
"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _pm import sh  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(REPO, 'docs', 'history', 'DECISIONS.md')
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 80

ЗАГОЛОВКИ = {'decision': 'Решение', 'fix': 'Исправление', 'feature': 'Сделано',
             'recon': 'Разведка', 'note': 'Заметка'}

sql = (
    "SELECT to_char(timestamp,'YYYY-MM-DD'), coalesce(category,'note'), "
    "replace(replace(coalesce(text,claude_decision,user_message),chr(10),' '),chr(13),' ') "
    "FROM claudia_memory.dialog_history WHERE project='chesscoin' "
    "AND coalesce(text,claude_decision,user_message) IS NOT NULL "
    "AND length(coalesce(text,claude_decision,user_message))>200 "
    "AND coalesce(category,'note') IN ('decision','fix','bug_fix','feature',"
    "'plan','infra','monetization','recon') "
    "ORDER BY timestamp DESC LIMIT %d;" % LIMIT
)
raw = sh('docker exec chesscoin_postgres psql -U claudia -d claudia -t -A -F"~" -c "%s"'
         % sql.replace('"', '\\"'), timeout=180)

rows = []
for line in raw.split('\n'):
    line = line.strip()
    if line.count('~') < 2:
        continue
    d, cat, text = line.split('~', 2)
    rows.append((d, cat, text.strip()))

# ── Накопление, а не подмена ─────────────────────────────────────────────────
# Раньше файл переписывался последними 80 записями: каждый запуск ВЫБРАСЫВАЛ
# то, что уже было выгружено. Граф со временем терял старые решения — а именно
# они объясняют, почему сделано так. Теперь новое ДОПИСЫВАЕТСЯ к прежнему,
# ничего не пропадает (Кенан 09.08.2026: «иначе будет тянуть назад»).
#
# Целиком историю в файл не положить: 15 512 записей на 21 МБ. Поэтому свежее
# берётся окном, а накопленное сохраняется.
by_day = {}
if os.path.exists(OUT):
    текущий_день, текущий_вид = None, 'note'
    буфер = []
    def сложить():
        if текущий_день and буфер:
            текст = '\n'.join(буфер).strip()
            if текст:
                by_day.setdefault(текущий_день, []).append((текущий_вид, текст))
    ОБРАТНО = {v: k for k, v in ЗАГОЛОВКИ.items()}
    for строка in io.open(OUT, encoding='utf-8', errors='replace'):
        строка = строка.rstrip('\n')
        if строка.startswith('## '):
            сложить(); буфер = []
            текущий_день, текущий_вид = строка[3:].strip(), 'note'
        elif строка.startswith('### '):
            сложить(); буфер = []
            текущий_вид = ОБРАТНО.get(строка[4:].strip(), 'note')
        elif текущий_день:
            буфер.append(строка)
    сложить()
    прежних = sum(len(v) for v in by_day.values())
else:
    прежних = 0

# Свежие записи поверх накопленного; дубли по тексту не плодим.
добавлено = 0
for d, cat, text in rows:
    уже = {t for _, t in by_day.get(d, [])}
    if text in уже:
        continue
    by_day.setdefault(d, []).append((cat, text))
    добавлено += 1

out = ['# История решений по ChessCoin', '',
       'Выгрузка из памяти проекта (`claudia_memory.dialog_history`, проект chesscoin).',
       'Здесь — **почему** сделано так, а не только что сделано: решения Кенана,',
       'найденные дефекты, уроки на ошибках. Файл нужен графу знаний: без него',
       'карта показывает устройство кода, но не замысел.', '',
       'Обновлять: `python project_management/tools/export_history.py`.', '']
for d in sorted(by_day, reverse=True):
    out += ['## %s' % d, '']
    for cat, text in by_day[d]:
        out += ['### %s' % ЗАГОЛОВКИ.get(cat, cat), '', text, '']

os.makedirs(os.path.dirname(OUT), exist_ok=True)
io.open(OUT, 'w', encoding='utf-8').write('\n'.join(out))
всего = sum(len(v) for v in by_day.values())
print('было %d, добавлено %d, стало %d | дней: %d | файл: %s'
      % (прежних, добавлено, всего, len(by_day), OUT))
