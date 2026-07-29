# -*- coding: utf-8 -*-
"""ЗАПИСЬ В ЖУРНАЛ ПО ХОДУ РАБОТЫ.

Пишет и в БД (chesscoin_pm.operations_log), и в registry/OPERATIONS_LOG.md —
чтобы при обрыве сессии ничего не терялось.

Запуск:
  python project_management/tools/note.py "что сделала"
  python project_management/tools/note.py --kind deploy "выкатила backend" файл1 файл2
Виды: note | change | deploy | rollback | verify | find
"""
import os
import sys
import time
sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from _pm import q, esc  # noqa: E402

args = sys.argv[1:]
kind = 'note'
if args and args[0] == '--kind':
    kind = args[1]
    args = args[2:]
if not args:
    print('Нечего записывать. Пример: python note.py --kind change "правка X"')
    sys.exit(1)

text = args[0]
files = args[1:]
arr = 'ARRAY[%s]::text[]' % ','.join("'%s'" % esc(f) for f in files) if files else "ARRAY[]::text[]"

sid = q("select id from chesscoin_pm.session_log where closed_at is null "
        "order by opened_at desc limit 1")
sid = sid[0][0] if sid else None

q("insert into chesscoin_pm.operations_log (session_id, kind, text, files) "
  "values (%s, '%s', '%s', %s)"
  % (sid if sid else 'null', esc(kind), esc(text), arr))

md = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  'registry', 'OPERATIONS_LOG.md')
line = '| %s | %s | %s | %s |\n' % (time.strftime('%H:%M'), kind, text,
                                    ', '.join(files) if files else '—')
day = '\n## %s\n\n| Время | Вид | Что | Доказательство |\n|---|---|---|---|\n' % time.strftime('%Y-%m-%d')
try:
    body = open(md, encoding='utf-8').read() if os.path.exists(md) else '# 🗒 ЖУРНАЛ ОПЕРАЦИЙ CHESSCOIN\n'
    if ('## %s' % time.strftime('%Y-%m-%d')) not in body:
        body += day
    body += line
    open(md, 'w', encoding='utf-8').write(body)
except Exception as e:
    print('⚠️ в файл не записано: %s' % e)

print('записано [%s] session=%s: %s' % (kind, sid, text))
