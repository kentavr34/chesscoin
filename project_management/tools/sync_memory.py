# -*- coding: utf-8 -*-
"""СИНХРОНИЗАЦИЯ НЕЗАВИСИМОЙ ПАМЯТИ ПРОЕКТА (Кенан, 2026-07-29).

Держит копию памяти ChessCoin в схеме chesscoin_pm свежей и самодостаточной,
чтобы при переносе проекта на отдельный сервер память уехала вместе с ним
одним куском и не зависела от базы Claudia.

Досинхронизирует:
  · chat_history      ← claudia_memory.dialog_history (project='chesscoin')
  · problem_solutions ← public.claudia_learned_solutions (project='chesscoin')
  · change_log        ← git log рабочей копии

Повторный запуск безопасен: дубликаты отсекаются по src_id и commit_sha.

Запуск:  python project_management/tools/sync_memory.py
"""
import os
import sys
import subprocess
sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from _pm import q, one, esc, head  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

head('СИНХРОНИЗАЦИЯ ПАМЯТИ ПРОЕКТА')

# ── 1. Диалог ───────────────────────────────────────────────────────────
before = one('select count(*) from chesscoin_pm.chat_history')
q("""insert into chesscoin_pm.chat_history
       (src_id, ts, role, text, text_summary, category, importance, tags, session_id)
     select id, timestamp, role, coalesce(text, user_message), text_summary,
            category, importance, tags, session_id
     from claudia_memory.dialog_history
     where project='chesscoin'
     on conflict (src_id) do nothing""", timeout=180)
after = one('select count(*) from chesscoin_pm.chat_history')
print('   диалог: %s → %s (+%d)' % (before, after, int(after) - int(before)))

# ── 2. Решения ──────────────────────────────────────────────────────────
before = one('select count(*) from chesscoin_pm.problem_solutions')
q("""insert into chesscoin_pm.problem_solutions
       (created_at, problem, keywords, root_cause, solution_steps, files_touched,
        notes, rating, verified_at, src)
     select s.created_at, s.problem, s.keywords, s.root_cause, s.solution_steps,
            s.files_touched, s.notes, s.rating, s.verified_at, 'claudia'
     from public.claudia_learned_solutions s
     where s.project='chesscoin'
       and not exists (select 1 from chesscoin_pm.problem_solutions p
                       where p.problem = s.problem)""")
after = one('select count(*) from chesscoin_pm.problem_solutions')
print('   решения: %s → %s (+%d)' % (before, after, int(after) - int(before)))

# ── 3. История модификаций ──────────────────────────────────────────────
raw = subprocess.run(['git', '-C', REPO, 'log', '--pretty=format:@@@%H\x1f%aI\x1f%an\x1f%s',
                      '--name-only'], capture_output=True, encoding='utf-8',
                     errors='replace').stdout
rows, cur, files = [], None, 0
for line in raw.split('\n'):
    if line.startswith('@@@'):
        if cur:
            rows.append((*cur, files))
        p = line[3:].split('\x1f')
        cur, files = (p[0], p[1], p[2], p[3] if len(p) > 3 else ''), 0
    elif line.strip():
        files += 1
if cur:
    rows.append((*cur, files))

before = one('select count(*) from chesscoin_pm.change_log')
CHUNK = 200
for i in range(0, len(rows), CHUNK):
    vals = ','.join("('%s','%s','%s','%s',%d)" % (r[0], r[1], esc(r[2]), esc(r[3])[:400], r[4])
                    for r in rows[i:i + CHUNK])
    q('insert into chesscoin_pm.change_log (commit_sha, ts, author, subject, files_count) '
      'values %s on conflict (commit_sha) do nothing' % vals, timeout=120)
after = one('select count(*) from chesscoin_pm.change_log')
print('   коммиты: %s → %s (+%d)' % (before, after, int(after) - int(before)))

print('\n▶ ПАМЯТЬ ПРОЕКТА (схема chesscoin_pm — переносится вместе с проектом)')
for r in q("""select table_name || ': ' || (xpath('/row/c/text()',
             query_to_xml('select count(*) c from chesscoin_pm.'||table_name, false, true, '')))[1]::text
             from information_schema.tables where table_schema='chesscoin_pm' order by table_name"""):
    print('   %s' % r[0])
