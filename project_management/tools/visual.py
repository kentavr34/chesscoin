# -*- coding: utf-8 -*-
"""ВИЗУАЛЬНЫЙ ЭТАЛОН — закрывает главную слепую зону контура.

Автоматика ловила инфраструктуру и логику, но не видела того, из-за чего Кенан
ругался чаще всего: съехавшую панель, вернувшуюся старую иконку, чужой шрифт,
изменённый отступ. Этот инструмент снимает ключевые экраны Mini App и сравнивает
их с утверждённым эталоном.

  capture           — снять текущие экраны прода (в /tmp, не трогая эталон)
  compare           — сравнить с эталоном, показать процент расхождения
  approve [экран]   — утвердить текущий вид как эталон (ТОЛЬКО по слову Кенана)
  list              — что сейчас в эталоне

Запуск:
  python project_management/tools/visual.py compare
  python project_management/tools/visual.py approve 00_home

Эталон лежит в design_canon/baseline_screens/ и версионируется в git —
как и остальной канон дизайна (rules/09_TEMPLATES.md).
"""
import os
import sys
import json
import shutil
import subprocess

sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from _pm import sh, head  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASELINE = os.path.join(REPO, 'design_canon', 'baseline_screens')
CURRENT = os.path.join(os.environ.get('TEMP', '/tmp'), 'chesscoin_screens')
DIFFDIR = os.path.join(os.environ.get('TEMP', '/tmp'), 'chesscoin_screens_diff')
APP = 'https://chesscoin.app'

# Порог: ниже — считаем шумом рендера (анимации, таймеры, аватары игроков),
# выше — расхождение с утверждённым видом.
THRESHOLD = float(os.environ.get('VISUAL_THRESHOLD', '2.0'))


def get_token():
    """JWT тестового пользователя через штатный эндпоинт скриншотера."""
    secret = sh('grep "^SCREENSHOT_SECRET=" /opt/chesscoin/.env | cut -d= -f2-').strip()
    if not secret:
        print('   ⚠️ SCREENSHOT_SECRET не найден на проде')
        return ''
    import urllib.request
    try:
        with urllib.request.urlopen(
                '%s/api/v1/screenshotter/token?secret=%s' % (APP, secret), timeout=20) as r:
            return json.load(r).get('token', '')
    except Exception as e:
        print('   ⚠️ токен не получен: %s' % str(e)[:70])
        return ''


def capture():
    head('СНИМОК ЭКРАНОВ · %s' % APP)
    token = get_token()
    if not token:
        return False
    shutil.rmtree(CURRENT, ignore_errors=True)
    os.makedirs(CURRENT, exist_ok=True)
    env = dict(os.environ, AUTH_TOKEN=token, OUT=CURRENT, APP_URL=APP)
    r = subprocess.run(['node', os.path.join(REPO, 'scripts', 'playwright-screenshots.mjs')],
                       cwd=REPO, env=env, capture_output=True, encoding='utf-8',
                       errors='replace', timeout=600)
    for line in (r.stdout or '').split('\n'):
        if line.strip():
            print('   %s' % line.strip())
    if r.returncode != 0:
        print('   ⚠️ playwright вернул код %s: %s' % (r.returncode, (r.stderr or '')[:200]))
    shots = [f for f in os.listdir(CURRENT) if f.endswith('.png')] if os.path.isdir(CURRENT) else []
    print('\n   снято экранов: %d → %s' % (len(shots), CURRENT))
    return bool(shots)


def diff_pct(a, b, out_path):
    """Доля различающихся пикселей в процентах + карта различий."""
    from PIL import Image, ImageChops
    ia, ib = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
    if ia.size != ib.size:
        return 100.0, 'размер изменился: %s → %s' % (ib.size, ia.size)
    d = ImageChops.difference(ia, ib)
    # пиксель считается изменённым, если отличие заметно глазу (>16 из 255)
    mask = d.convert('L').point(lambda p: 255 if p > 16 else 0)
    changed = sum(mask.histogram()[255:])
    total = ia.size[0] * ia.size[1]
    pct = 100.0 * changed / total
    if pct > 0:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        Image.merge('RGB', (mask, mask, mask)).save(out_path)
    return pct, ''


def compare():
    if not os.path.isdir(BASELINE) or not os.listdir(BASELINE):
        print('   ⚠️ эталона нет. Снять текущий вид и утвердить его:')
        print('      python project_management/tools/visual.py approve all')
        return 2
    head('СРАВНЕНИЕ С ВИЗУАЛЬНЫМ ЭТАЛОНОМ (порог %.1f%%)' % THRESHOLD)
    shutil.rmtree(DIFFDIR, ignore_errors=True)
    drift, ok, missing = [], 0, []
    for name in sorted(os.listdir(BASELINE)):
        if not name.endswith('.png'):
            continue
        cur = os.path.join(CURRENT, name)
        if not os.path.exists(cur):
            missing.append(name)
            continue
        pct, note = diff_pct(cur, os.path.join(BASELINE, name), os.path.join(DIFFDIR, name))
        if pct > THRESHOLD:
            drift.append((name, pct, note))
            print('   🚨 %-20s расхождение %.2f%% %s' % (name[:-4], pct, note))
        else:
            ok += 1
            print('   ✅ %-20s %.2f%%' % (name[:-4], pct))
    for m in missing:
        print('   ⏳ %-20s экран не снялся (страница не открылась?)' % m[:-4])
    print('\n' + '-' * 74)
    print('совпало: %d · расхождений: %d · не снято: %d' % (ok, len(drift), len(missing)))
    if drift:
        print('\n🚨 ВИЗУАЛЬНОЕ РАСХОЖДЕНИЕ С УТВЕРЖДЁННЫМ ВИДОМ:')
        for n, p, _ in drift:
            print('   · %s — %.2f%%' % (n[:-4], p))
        print('\nКарты различий: %s' % DIFFDIR)
        print('Если изменение согласовано с Кенаном — утвердить новый эталон:')
        print('   python project_management/tools/visual.py approve <экран>')
        return 1
    return 0


def approve(which):
    if not os.path.isdir(CURRENT):
        print('   сначала снимок: visual.py capture')
        return 2
    os.makedirs(BASELINE, exist_ok=True)
    n = 0
    for f in sorted(os.listdir(CURRENT)):
        if not f.endswith('.png') or '_error' in f:
            continue
        if which != 'all' and not f.startswith(which):
            continue
        shutil.copy2(os.path.join(CURRENT, f), os.path.join(BASELINE, f))
        print('   утверждён эталон: %s' % f)
        n += 1
    print('\n   обновлено эталонов: %d → %s' % (n, BASELINE))
    print('   не забыть закоммитить: канон дизайна должен быть в git')
    return 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'compare'
    if cmd == 'capture':
        sys.exit(0 if capture() else 1)
    elif cmd == 'compare':
        sys.exit(compare() if os.path.isdir(CURRENT) and os.listdir(CURRENT)
                 else (compare() if capture() else 2))
    elif cmd == 'approve':
        if not os.path.isdir(CURRENT) or not os.listdir(CURRENT):
            capture()
        sys.exit(approve(sys.argv[2] if len(sys.argv) > 2 else 'all'))
    elif cmd == 'list':
        if os.path.isdir(BASELINE):
            for f in sorted(os.listdir(BASELINE)):
                print('   %s' % f)
        else:
            print('   эталона нет')
    else:
        print(__doc__)
