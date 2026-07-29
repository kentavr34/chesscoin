# -*- coding: utf-8 -*-
"""ЭТАЛОН ДОСТИГНУТОГО — проверка, что система делает сегодня то,
что мы доказали вчера.

Каждый случай в chesscoin_pm.regression_cases: команда → что обязано быть
в выводе / чего быть не должно. Прогон боевым путём.

  🚨 РЕГРЕССИЯ — случай раньше проходил, теперь упал. Сообщать Кенану немедленно.
  ⏳ ДОЛГ      — случай ни разу не проходил. Это работа впереди, не поломка.

Запуск:  python project_management/tools/regression.py [фильтр-по-теме]
"""
import os
import sys
import subprocess
sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from _pm import sh, q, esc, head  # noqa: E402

FILTER = sys.argv[1] if len(sys.argv) > 1 else ''

cases = q("""select id, tema, kind, check_cmd, coalesce(must_contain,''), coalesce(must_not,''),
                    coalesce(proven_at::text,''), coalesce(origin,'')
             from chesscoin_pm.regression_cases
             where active and (%s = '' or tema ilike '%%%s%%' or kind ilike '%%%s%%')
             order by id""" % ("'%s'" % esc(FILTER), esc(FILTER), esc(FILTER)))

head('ЭТАЛОН ДОСТИГНУТОГО · случаев: %d' % len(cases))

passed = failed = debt = 0
regressions = []

for c in cases:
    cid, tema, kind, cmd = c[0], c[1], c[2], c[3]
    must, mustnot, proven = c[4], c[5], c[6]
    # 'local:' — выполнить на ПК (визуальные проверки гоняют браузер локально),
    # 'curl'   — тоже локально, чтобы мерить сайт снаружи;
    # остальное — боевым путём на проде.
    if cmd.startswith('local:') or cmd.startswith('curl'):
        local_cmd = cmd[6:] if cmd.startswith('local:') else cmd
        r = subprocess.run(local_cmd, shell=True, capture_output=True, encoding='utf-8',
                           errors='replace', timeout=900, cwd=os.path.dirname(
                               os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        out = ((r.stdout or '') + (r.stderr or '')).strip()
    else:
        out = sh(cmd, timeout=90)
    ok = True
    why = ''
    if must and must not in out:
        ok, why = False, 'нет «%s» (получено: %s)' % (must, out[:60])
    if ok and mustnot and mustnot in out:
        ok, why = False, 'встретилось запрещённое «%s»' % mustnot

    if ok:
        passed += 1
        print('   ✅ [%s] %s' % (kind, tema))
    elif not proven:
        debt += 1
        print('   ⏳ [%s] %s — долг: %s' % (kind, tema, why))
    else:
        failed += 1
        regressions.append((tema, why, proven))
        print('   🚨 [%s] %s — РЕГРЕССИЯ: %s (работало с %s)' % (kind, tema, why, proven))

    q("insert into chesscoin_pm.regression_runs (case_id, passed, note) values (%s, %s, '%s')"
      % (cid, 'true' if ok else 'false', esc(why or 'ok')[:300]))

print('\n' + '-' * 74)
print('прошло: %d · регрессий: %d · долгов: %d' % (passed, failed, debt))
if regressions:
    print('\n🚨 СООБЩИТЬ КЕНАНУ — пропало то, что раньше работало:')
    for t, w, p in regressions:
        print('   · %s — %s (доказано работавшим %s)' % (t, w, p))
else:
    print('Ничего из доказанного не пропало.')
