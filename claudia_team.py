#!/usr/bin/env python3
"""
claudia_team.py — CLI управления AI_TEAM.

Команды:
    claudia-team roster                                — полный состав
    claudia-team stats <role>                          — статистика за 30 дней
    claudia-team hire <name> "Персона" "Работа" <provider> <model>
    claudia-team fire <name> "причина"
    claudia-team assign <role> <provider> <model> "причина"
    claudia-team temp <role> <provider> <model> <часов> "причина"
    claudia-team teach <role> "урок"
    claudia-team lessons <role>                        — уроки роли
    claudia-team call <role> "запрос"                  — разовый вызов
    claudia-team suggest                               — предложения перестановок
    claudia-team revert                                — снять истёкшие temp
"""
import sys
import os
sys.path.insert(0, '/root/claudia')
from team import Commander
import psycopg2.extras


def fmt_pct(v):
    return f'{v*100:.0f}%' if v is not None else '—'


def cmd_roster(c, args):
    team = c.roster()
    print(f'\n{"Персона":15s} {"Дep":10s} {"Мозг":30s} {"30д":12s} {"$30д":8s} {"Уроков":6s}')
    print('─' * 90)
    for r in team:
        total = (r['success_30d'] or 0) + (r['fail_30d'] or 0)
        success_pct = (r['success_30d'] / total) if total else None
        brain = f"{r['current_model']}"
        if r['temp_model']:
            brain = f"{r['temp_model']} (temp)"
        print(f'{r["persona"]:15s} {r["department"] or "-":10s} {brain:30s} '
              f'{total}з/{fmt_pct(success_pct):5s} '
              f'${float(r["cost_30d_usd"] or 0):6.2f}  {r["lessons"]}')


def cmd_stats(c, args):
    if not args: print('Нужно: stats <role>'); return
    role = args[0]
    days = int(args[1]) if len(args) > 1 else 30
    s = c.stats(role, days)
    print(f'\n{role} за {days} дней:')
    for k, v in s.items():
        print(f'  {k:15s} {v}')


def cmd_hire(c, args):
    if len(args) < 5:
        print('Нужно: hire <name> "Персона" "Работа" <provider> <model>')
        return
    ok = c.hire(args[0], persona=args[1], job=args[2],
                default_provider=args[3], default_model=args[4],
                hired_by='kenan')
    print('✓ Нанят' if ok else '✗ Не получилось')


def cmd_fire(c, args):
    if len(args) < 2: print('Нужно: fire <name> "причина"'); return
    print('✓ Уволен' if c.fire(args[0], args[1], fired_by='kenan') else '✗ Не получилось')


def cmd_assign(c, args):
    if len(args) < 4:
        print('Нужно: assign <role> <provider> <model> "причина"')
        return
    ok = c.assign(args[0], args[1], args[2], reason=args[3], decided_by='kenan')
    print('✓ Назначен' if ok else '✗ Не получилось')


def cmd_temp(c, args):
    if len(args) < 5:
        print('Нужно: temp <role> <provider> <model> <часов> "причина"')
        return
    ok = c.assign_temp(args[0], args[1], args[2], hours=float(args[3]),
                       reason=args[4], decided_by='kenan')
    print('✓ Временно назначен' if ok else '✗ Не получилось')


def cmd_teach(c, args):
    if len(args) < 2: print('Нужно: teach <role> "урок"'); return
    ok = c.teach(args[0], args[1], source='kenan')
    print('✓ Выучил' if ok else '✗ Не получилось')


def cmd_lessons(c, args):
    if not args: print('Нужно: lessons <role>'); return
    import team as _t
    conn = _t._connect()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, lesson, source, confidence, learned_at, used_count
        FROM specialist_lessons
        WHERE role_name=%s AND is_active
        ORDER BY learned_at DESC
    """, (args[0],))
    for r in cur.fetchall():
        print(f'[{r["learned_at"]:%Y-%m-%d}] {r["source"]:8s} → {r["lesson"]}')
    conn.close()


def cmd_call(c, args):
    if len(args) < 2: print('Нужно: call <role> "запрос"'); return
    import time
    t0 = time.time()
    a = c.call(args[0], args[1])
    print(f'\n[{time.time()-t0:.1f}s]')
    print(a)


def cmd_suggest(c, args):
    recs = c.suggestions()
    if not recs:
        print('Нет предложений — команда работает стабильно.')
        return
    for r in recs:
        print(f'{r["action"].upper():10s} {r["role"]:15s} — {r["reason"]}  ({r["current"]})')


def cmd_revert(c, args):
    n = c.revert_expired_temps()
    print(f'✓ Возвращено на постоянный мозг: {n} ролей')


COMMANDS = {
    'roster': cmd_roster, 'stats': cmd_stats,
    'hire': cmd_hire, 'fire': cmd_fire,
    'assign': cmd_assign, 'temp': cmd_temp,
    'teach': cmd_teach, 'lessons': cmd_lessons,
    'call': cmd_call,
    'suggest': cmd_suggest, 'revert': cmd_revert,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help', 'help'):
        print(__doc__)
        return
    cmd = sys.argv[1]
    fn = COMMANDS.get(cmd)
    if not fn:
        print(f'Неизвестная команда: {cmd}\nДоступны: {", ".join(COMMANDS)}')
        return
    c = Commander()
    fn(c, sys.argv[2:])


if __name__ == '__main__':
    main()
