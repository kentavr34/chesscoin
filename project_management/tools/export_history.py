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

by_day = {}
for d, cat, text in rows:
    by_day.setdefault(d, []).append((cat, text))

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
print('записей: %d | дней: %d | файл: %s' % (len(rows), len(by_day), OUT))
