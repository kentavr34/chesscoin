# -*- coding: utf-8 -*-
"""ВОРОТА ДИАГНОЗА — прогонять ПЕРЕД словом «корень».

Печатает три вещи по теме:
  1. боевой путь подсистемы (чем это проверяется в реальности и где ловушка);
  2. что уже решали по теме и какие корни назывались;
  3. мои ошибки по теме и правила, которые их закрывают.

Запуск:  python project_management/tools/why.py "батлы"
"""
import sys
sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from _pm import q, esc, head  # noqa: E402

if len(sys.argv) < 2:
    print('Укажи тему: python why.py "турниры"')
    sys.exit(1)

TOPIC = sys.argv[1]
t = esc(TOPIC)
words = [w for w in TOPIC.replace(',', ' ').split() if len(w) > 3] or [TOPIC]

head('ВОРОТА ДИАГНОЗА · тема: %s' % TOPIC)

print('\n▶ 1. БОЕВОЙ ПУТЬ (чем проверяется в реальности)')
rows = q("""select subsystem, prod_path, coalesce(how_to_test,'-'), coalesce(trap,'-')
            from chesscoin_pm.prod_path_registry
            where subsystem ilike '%%%s%%' or prod_path ilike '%%%s%%' or trap ilike '%%%s%%'""" % (t, t, t))
if not rows:
    print('   ⚠️ подсистемы нет в реестре боевых путей.')
    print('   Сначала найди её боевой путь, внеси в chesscoin_pm.prod_path_registry,')
    print('   и только потом объявляй диагноз. Все подсистемы:')
    for r in q('select subsystem from chesscoin_pm.prod_path_registry order by 1'):
        print('     · %s' % r[0])
for r in rows:
    print('   ● %s' % r[0])
    print('     путь:     %s' % r[1])
    print('     проверка: %s' % r[2])
    print('     ЛОВУШКА:  %s' % r[3])

print('\n▶ 2. ЧТО УЖЕ РЕШАЛИ ПО ЭТОЙ ТЕМЕ')
seen = False
for w in words:
    for r in q("""select left(problem,90), left(coalesce(root_cause,'-'),90),
                         left(coalesce(notes,'-'),90), coalesce(rating::text,'—')
                  from public.claudia_learned_solutions
                  where project='chesscoin' and (problem ~* '\\m%s' or notes ~* '\\m%s'
                        or array_to_string(keywords,' ') ~* '\\m%s')
                  order by rating desc nulls last limit 5""" % (esc(w), esc(w), esc(w))):
        seen = True
        print('   [%s] %s' % (r[3] if len(r) > 3 else '—', r[0]))
        print('        корень:  %s' % (r[1] if len(r) > 1 else '-'))
        print('        заметка: %s' % (r[2] if len(r) > 2 else '-'))
if not seen:
    print('   (по теме записей нет — значит это новый класс проблемы, запиши результат)')

print('\n▶ 3. МОИ ОШИБКИ ПО ЭТОЙ ТЕМЕ')
seen = False
for w in words:
    for r in q("""select happened_on, left(mistake,90), left(coalesce(rule,'-'),110)
                  from chesscoin_pm.agent_mistakes
                  where mistake ~* '\\m%s' or rule ~* '\\m%s'
                        or coalesce(root_cause,'') ~* '\\m%s' limit 4"""
               % (esc(w), esc(w), esc(w))):
        seen = True
        print('   ⚠️ %s — %s' % (r[0], r[1]))
        print('      правило: %s' % r[2])
if not seen:
    print('   (по теме промахов не записано)')

print('\n' + '=' * 74)
print('Диагноз объявляется ТОЛЬКО после прохода боевым путём с боевыми параметрами.')
print('Проверка соседней функции или десктоп-браузера доказательством не является.')
