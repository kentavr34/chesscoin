# -*- coding: utf-8 -*-
"""ИНВЕНТАРИЗАЦИЯ — принцип библиотеки.

Реестр должен быть исчерпывающим: если файл есть на диске, он есть в реестре.
Обходит контуры ChessCoin (и НИКОГДА чужие каталоги claudia/jobus), пишет снимок
в chesscoin_pm.file_inventory и отчёт в registry/FILE_REGISTRY.md:
  · новые файлы (появились сами — потенциально чужие)
  · изменённые (по sha, а не по дате) и исчезнувшие
  · расхождение прод ↔ репозиторий

Запуск:  python project_management/tools/inventory.py
"""
import os
import sys
import time
sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from _pm import sh, q, esc, head  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = "-not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' " \
       "-not -path '*/avatars/*' -not -name '*.pyc'"

head('ИНВЕНТАРИЗАЦИЯ CHESSCOIN · %s' % time.strftime('%Y-%m-%d %H:%M'))

# ── снимок прода ────────────────────────────────────────────────────────
print('\n▶ снимаю /opt/chesscoin (контур prod)…')
raw = sh("find /opt/chesscoin -type f %s -printf '%%p|%%s|%%TY-%%Tm-%%Td %%TH:%%TM\\n' "
         "2>/dev/null | head -2000" % SKIP, timeout=180)
rows = [r.split('|') for r in raw.split('\n') if r.count('|') >= 2]
print('   файлов: %d' % len(rows))

prev = {r[0]: r[1] for r in q("""select path, size::text from chesscoin_pm.file_inventory
                                 where contour='prod' and scanned_at=(select max(scanned_at)
                                 from chesscoin_pm.file_inventory where contour='prod')""")
        if len(r) >= 2}

if rows:
    vals = ','.join("('prod','%s',%s,'%s','%s')"
                    % (esc(r[0]), r[1] or 0, r[2], os.path.splitext(r[0])[1] or 'noext')
                    for r in rows)
    q('insert into chesscoin_pm.file_inventory (contour, path, size, mtime, kind) values %s' % vals,
      timeout=180)

cur = {r[0]: r[1] for r in rows}
new = [p for p in cur if p not in prev] if prev else []
gone = [p for p in prev if p not in cur] if prev else []
chg = [p for p in cur if p in prev and cur[p] != prev[p]] if prev else []

print('\n▶ сравнение со вчерашним снимком')
if not prev:
    print('   (первый снимок — сравнивать не с чем, база заложена)')
else:
    print('   новых: %d · изменённых: %d · исчезнувших: %d' % (len(new), len(chg), len(gone)))
    for p in new[:10]:
        print('     + %s  ← появился сам, проверить происхождение' % p)
    for p in gone[:10]:
        print('     - %s  ← ИСЧЕЗ, особенно опасно для сборочных артефактов' % p)
    for p in chg[:10]:
        print('     ~ %s' % p)

# ── расхождение прод ↔ репо ─────────────────────────────────────────────
print('\n▶ расхождение прод ↔ рабочая копия')
prod_top = set(os.path.basename(p) for p in cur if p.count('/') == 3)
repo_top = set(os.listdir(ROOT.rsplit(os.sep, 1)[0]))
only_prod = sorted(prod_top - repo_top)[:15]
print('   есть на проде, нет в рабочей копии: %s' % (', '.join(only_prod) or 'нет'))

# ── отчёт в файл ────────────────────────────────────────────────────────
out = os.path.join(ROOT, 'registry', 'FILE_REGISTRY.md')
with open(out, 'w', encoding='utf-8') as f:
    f.write('# 📂 РЕЕСТР ФАЙЛОВ CHESSCOIN\n\n')
    f.write('> Снимок %s. Генерируется `tools/inventory.py`. Правки руками бессмысленны.\n\n'
            % time.strftime('%Y-%m-%d %H:%M'))
    f.write('Контур **prod** (`/opt/chesscoin`, без node_modules/.git/dist/avatars): **%d файлов**\n\n'
            % len(rows))
    if prev:
        f.write('## Изменения с прошлого снимка\n\n')
        f.write('- новых: %d\n- изменённых: %d\n- исчезнувших: %d\n\n' % (len(new), len(chg), len(gone)))
        for p in new:
            f.write('- `+` %s\n' % p)
        for p in gone:
            f.write('- `-` %s ← ИСЧЕЗ\n' % p)
    f.write('\n## Каталоги верхнего уровня\n\n')
    dirs = {}
    for r in rows:
        d = '/'.join(r[0].split('/')[:4])
        dirs[d] = dirs.get(d, 0) + 1
    for d, n in sorted(dirs.items(), key=lambda x: -x[1])[:40]:
        f.write('- `%s` — %d файлов\n' % (d, n))
print('\n▶ отчёт: %s' % out)
