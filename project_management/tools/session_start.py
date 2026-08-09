# -*- coding: utf-8 -*-
"""СТАРТ СЕССИИ — исполняемая Инструкция 1 (ChessCoin, 2026-07-29).

Не «прочитать и вспомнить», а ВЫПОЛНИТЬ: собрать всю картину одним прогоном.
Если этот вывод не даёт понимания состояния — значит контур управления неполон.

Запуск:  python project_management/tools/session_start.py ["тема работы"]
"""
import sys
import time
import subprocess
sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from _pm import sh, q, one, esc, head  # noqa: E402

TOPIC = sys.argv[1] if len(sys.argv) > 1 else ''

head('СТАРТ СЕССИИ CHESSCOIN · %s%s' % (time.strftime('%Y-%m-%d %H:%M'),
                                        ('  · тема: ' + TOPIC) if TOPIC else ''))

# ── 1. ГДЕ ПРОД (адрес берём из резолва, не из документации) ─────────────
print('\n▶ 1. ПРОД И ДОСТУП')
try:
    dns = subprocess.run(['nslookup', 'chesscoin.app'], capture_output=True,
                         encoding='utf-8', errors='replace', timeout=25).stdout
    ips = [l.split(':')[-1].strip() for l in dns.split('\n')
           if l.strip().lower().startswith('address') and '#' not in l]
    ip = ips[-1] if ips else '?'
except Exception:
    ip = '?'
print('   chesscoin.app → %s %s' % (ip, '' if ip == '45.67.216.36' else
                                    '⚠️ НЕ СОВПАДАЕТ с 00_CONTEXT.md — сначала правим документацию!'))
print('   ' + (sh('hostname; uptime -p') or '⚠️ ssh не отвечает').replace('\n', ' · '))

# ── 2. СОСТОЯНИЕ СИСТЕМЫ ────────────────────────────────────────────────
print('\n▶ 2. СОСТОЯНИЕ СИСТЕМЫ')
ps = sh("docker ps --format '{{.Names}} {{.Status}}' | grep '^chesscoin_'")
up = len([l for l in ps.split('\n') if ' Up' in l])
print('   контейнеры ChessCoin: %d из 8 подняты' % up)
for line in ps.split('\n'):
    if line and ' Up' not in line:
        print('     ⚠️ %s' % line)
print('   health: %s' % sh('docker exec chesscoin_backend sh -lc '
                           '"wget -qO- http://localhost:3000/health"'))
print('   прод-репо: %s' % sh('cd /opt/chesscoin && git log --oneline -1').strip())
behind = sh('cd /opt/chesscoin && git fetch -q origin 2>/dev/null; '
            'git rev-list --count HEAD..origin/main')
print('   отставание прода от origin/main: %s коммит(ов)%s'
      % (behind, '' if behind == '0' else '  ⚠️'))
print('   диск: %s' % sh("df -h / | tail -1 | awk '{print \"занято \"$3\" из \"$2\", свободно \"$4}'"))

# ── 3. ЧТО ГОВОРИЛИ ЗА СУТКИ ────────────────────────────────────────────
print('\n▶ 3. ДИАЛОГ ЗА 24 ЧАСА')
rows = q("""select to_char(timestamp,'MM-DD HH24:MI')||' '||coalesce(role,'?')||': '||
            left(regexp_replace(coalesce(text_summary,text,user_message),E'[\\n\\r]+',' ','g'),120)
            from claudia_memory.dialog_history
            where project='chesscoin' and timestamp > now()-interval '24 hours'
            order by timestamp desc limit 12""")
if not rows:
    print('   (за сутки записей нет — либо не работали, либо не записали итог)')
for r in rows:
    print('   · %s' % r[0])

# ── 4. ПАМЯТЬ ПРОЕКТА ───────────────────────────────────────────────────
print('\n▶ 4. ПАМЯТЬ ПРОЕКТА')
print('   решённых проблем: %s | моих ошибок: %s | случаев в эталоне: %s'
      % (one("select count(*) from public.claudia_learned_solutions where project='chesscoin'"),
         one('select count(*) from chesscoin_pm.agent_mistakes'),
         one('select count(*) from chesscoin_pm.regression_cases where active')))
if TOPIC:
    t = esc(TOPIC)
    print('\n   ── по теме «%s» ──' % TOPIC)
    for r in q("""select left(problem,70), left(coalesce(root_cause,'-'),70)
                  from public.claudia_learned_solutions
                  where project='chesscoin' and (problem ilike '%%%s%%' or notes ilike '%%%s%%'
                        or array_to_string(keywords,' ') ilike '%%%s%%')
                  order by rating desc nulls last limit 4""" % (t, t, t)):
        print('   ✅ %s' % r[0])
        if len(r) > 1:
            print('        корень: %s' % r[1])
    for r in q("""select left(mistake,70), left(coalesce(rule,'-'),90)
                  from chesscoin_pm.agent_mistakes
                  where mistake ilike '%%%s%%' or rule ilike '%%%s%%' limit 3""" % (t, t)):
        print('   ⚠️ моя ошибка: %s' % r[0])
        if len(r) > 1:
            print('        правило: %s' % r[1])

# ── 5. ОТКРЫТЫЕ ДЕФЕКТЫ И СЧЁТЧИК ЭТАЛОНА ───────────────────────────────
print('\n▶ 5. ОТКРЫТЫЕ ДЕФЕКТЫ (registry/TODO_FIXES.md)')
import os  # noqa: E402
todo = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    'registry', 'TODO_FIXES.md')
if os.path.exists(todo):
    # Реестр разбит на секции «## Закрыто» и «## Открыто» — считаем по секции,
    # а не по галочке в строке (галочка внутри текста давала ложный счёт).
    closed, openx, section = [], [], None
    for l in open(todo, encoding='utf-8'):
        if l.startswith('## '):
            section = 'closed' if 'Закрыт' in l else ('open' if 'Открыт' in l else None)
        elif l.startswith('| ') and not l.startswith('|---') and '№' not in l[:6]:
            if section == 'closed':
                closed.append(l)
            elif section == 'open':
                openx.append(l)
    lines = closed + openx
    guard = one('select count(*) from chesscoin_pm.regression_cases where active')
    print('   всего: %d | закрыто: %d | открыто: %d | случаев в эталоне: %s'
          % (len(lines), len(closed), len(openx), guard))
    if isinstance(guard, str) and guard.isdigit() and len(closed) > int(guard):
        print('     ⚠️ закрытых дефектов больше, чем охраняемых случаев — '
              '%d без охраны, вернутся незамеченными' % (len(closed) - int(guard)))
    for l in openx:
        if '🔴' in l or '🟠' in l:
            print('     %s' % l.strip()[:110])
else:
    print('   ⚠️ файла нет')

# ── 6. ЧТО МЕНЯЛОСЬ ЗА СУТКИ ────────────────────────────────────────────
print('\n▶ 6. ИЗМЕНЕНИЯ ЗА 24 ЧАСА НА ПРОДЕ')
ch = sh("find /opt/chesscoin -mtime -1 -type f -not -path '*/node_modules/*' "
        "-not -path '*/.git/*' -not -path '*/avatars/*' 2>/dev/null | head -12")
files = [x for x in ch.split('\n') if x]
print('   файлов изменено: %d' % len(files))
for f in files[:8]:
    print('     · %s' % f)

# ── 7. СИНХРОНИЗАЦИЯ ЗНАНИЙ ─────────────────────────────────────────────
# Кенан 09.08.2026: граф отставал от разговоров — решения выгружены до 04.08,
# карта собрана 05.08. Теперь догоняем на каждом входе: выгрузка решений из
# ЦНС и пересборка графа по коду. Обе операции без модели, стоят секунд.
print('\n▶ 7. ПАМЯТЬ ДОГОНЯЕТ РАЗГОВОРЫ')
_sync = subprocess.run(
    [sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sync_graph.py'), '--quiet'],
    capture_output=True, encoding='utf-8', errors='replace', timeout=900)
_вывод = (_sync.stdout or '').strip()
print('   %s' % (_вывод if _вывод else 'всё уже было свежим'))
if _sync.returncode != 0 and not _вывод:
    print('   ⚠️ синхронизация вернула код %s' % _sync.returncode)

# ── 8. РЕГИСТРАЦИЯ ВХОДА ────────────────────────────────────────────────
sid = one("insert into chesscoin_pm.session_log (agent, purpose) values ('claude','%s') returning id"
          % esc(TOPIC or 'сессия'))
print('\n▶ 8. ВХОД ЗАРЕГИСТРИРОВАН: session_log id=%s' % sid)

print('\n' + '=' * 74)
print('Планировать изменения можно только после этого вывода.')
print('ПЕРЕД словом «корень» — ворота диагноза: python tools/why.py <тема>')
