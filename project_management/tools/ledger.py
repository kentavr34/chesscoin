# -*- coding: utf-8 -*-
"""ЧЕК-БАЛАНС — сходится ли бухгалтерия монет (Кенан, 2026-07-30).

Две независимые функции считают одно и то же разными путями:

  1. СКОЛЬКО МОНЕТ НА РУКАХ  — сумма балансов всех игроков;
  2. СКОЛЬКО СИСТЕМА ВЫДАЛА МИНУС ЗАБРАЛА — сумма всей истории транзакций.

Цифры обязаны совпадать. Разошлись — значит где-то прошла ошибочная процедура:
монеты появились или исчезли мимо истории. Именно так 30.07.2026 у 33 игроков
из 91 пропало 329 900 монет: updateBalance затирал параллельные начисления.

  ledger.py            — сводка и вердикт
  ledger.py --types    — разбивка: что выдали, что забрали, по типам
  ledger.py --bisect   — поиск расхождения делением пополам (по Кенану)
  ledger.py --snapshot — записать снимок в chesscoin_pm.ledger_snapshots

Исключения из проверки — аккаунты со стартовым балансом, выданным напрямую
мимо транзакций: бот J.A.R.V.I.S и служебный screenshotter. Они не жертвы
ошибок, а данные посева, и считаются отдельной строкой.
"""
import sys
sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from _pm import q, one, head  # noqa: E402

LIVE = 'u."isBot" = false AND u."telegramId" <> \'screenshotter_001\''


def fmt(n):
    try:
        return f'{int(n):,}'.replace(',', ' ')
    except Exception:
        return str(n)


def summary():
    head('ЧЕК-БАЛАНС МОНЕТ')

    on_hands = one(f'select coalesce(sum(u.balance),0) from users u where {LIVE}', game_db=True)
    emitted = one(f'''select coalesce(sum(t.amount),0) from transactions t
                      join users u on u.id = t."userId" where {LIVE}''', game_db=True)
    seed = one('''select coalesce(sum(u.balance),0) from users u
                  where u."isBot" = true or u."telegramId" = 'screenshotter_001' ''', game_db=True)

    diff = int(on_hands) - int(emitted)

    print('\n▶ ДВЕ НЕЗАВИСИМЫЕ ЦИФРЫ')
    print('   1. на руках у игроков:            %18s ᚙ' % fmt(on_hands))
    print('   2. выдано системой минус забрано: %18s ᚙ' % fmt(emitted))
    print('   ' + '-' * 52)
    print('   расхождение:                      %18s ᚙ' % fmt(diff))

    print('\n▶ ВНЕ ПРОВЕРКИ (стартовые балансы, выданы мимо транзакций)')
    print('   бот и служебный аккаунт:          %18s ᚙ' % fmt(seed))

    if diff == 0:
        print('\n✅ БУХГАЛТЕРИЯ СХОДИТСЯ: каждая монета на руках обеспечена историей.')
        return 0

    print('\n🚨 РАСХОЖДЕНИЕ %s ᚙ — где-то прошла процедура мимо истории.' % fmt(diff))
    print('   Знак «минус» = начисления терялись (как 30.07 при lost update).')
    print('   Знак «плюс»  = монеты появились из ниоткуда.')
    print('   Локализовать: python project_management/tools/ledger.py --bisect')
    return 1


def by_types():
    print('\n▶ ЧТО СИСТЕМА ВЫДАЛА (положительные суммы)')
    rows = q(f'''select t.type::text, count(*), sum(t.amount) from transactions t
                 join users u on u.id = t."userId"
                 where t.amount > 0 and {LIVE}
                 group by 1 order by 3 desc''', game_db=True)
    total_in = 0
    for r in rows:
        if len(r) >= 3:
            total_in += int(r[2])
            print('   %-22s %6s шт %18s ᚙ' % (r[0], r[1], fmt(r[2])))
    print('   ' + '-' * 52)
    print('   %-22s %6s    %18s ᚙ' % ('ИТОГО ВЫДАНО', '', fmt(total_in)))

    print('\n▶ ЧТО СИСТЕМА ЗАБРАЛА (отрицательные суммы)')
    rows = q(f'''select t.type::text, count(*), sum(t.amount) from transactions t
                 join users u on u.id = t."userId"
                 where t.amount < 0 and {LIVE}
                 group by 1 order by 3 asc''', game_db=True)
    total_out = 0
    for r in rows:
        if len(r) >= 3:
            total_out += int(r[2])
            print('   %-22s %6s шт %18s ᚙ' % (r[0], r[1], fmt(r[2])))
    print('   ' + '-' * 52)
    print('   %-22s %6s    %18s ᚙ' % ('ИТОГО ЗАБРАНО', '', fmt(total_out)))
    print('\n   баланс эмиссии: %s ᚙ' % fmt(total_in + total_out))


def bisect():
    """Поиск расхождения делением пополам — как предложил Кенан.

    Сначала режем игроков на половины и смотрим, в какой половине сидит
    расхождение. Потом ещё пополам, пока не останется конкретный список.
    Затем для найденных смотрим их транзакции по дням.
    """
    head('ЛОКАЛИЗАЦИЯ РАСХОЖДЕНИЯ ДЕЛЕНИЕМ ПОПОЛАМ')

    rows = q(f'''with s as (select "userId", sum(amount) total from transactions group by "userId")
                 select u.id, coalesce(u."firstName",'?'), u.balance - coalesce(s.total,0)
                 from users u left join s on s."userId" = u.id
                 where {LIVE} and u.balance <> coalesce(s.total,0)
                 order by abs(u.balance - coalesce(s.total,0)) desc''', game_db=True)
    rows = [r for r in rows if len(r) >= 3]

    if not rows:
        print('\n✅ Делить нечего: расхождений нет ни у одного игрока.')
        return 0

    print('\n▶ игроков с расхождением: %d' % len(rows))

    # Половинное деление — показываем, как сужается зона поиска
    pool = rows[:]
    step = 1
    while len(pool) > 1:
        half = len(pool) // 2 or 1
        left, right = pool[:half], pool[half:]
        sl = sum(int(r[2]) for r in left)
        sr = sum(int(r[2]) for r in right)
        print('   шаг %d: первая половина (%d игроков) %s ᚙ · вторая (%d) %s ᚙ'
              % (step, len(left), fmt(sl), len(right), fmt(sr)))
        pool = left if abs(sl) >= abs(sr) else right
        step += 1
        if step > 12:
            break

    worst = pool[0]
    print('\n▶ КРУПНЕЙШИЙ ИСТОЧНИК: %s — %s ᚙ' % (worst[1], fmt(worst[2])))

    print('\n▶ ЕГО ТРАНЗАКЦИИ ПО ДНЯМ (где искать ошибочную процедуру)')
    for r in q(f'''select to_char(t."createdAt",'YYYY-MM-DD'), count(*), sum(t.amount)
                   from transactions t where t."userId" = '{worst[0]}'
                   group by 1 order by 1 desc limit 10''', game_db=True):
        if len(r) >= 3:
            print('   %s  транзакций %4s  сумма %16s ᚙ' % (r[0], r[1], fmt(r[2])))

    print('\n▶ ПОДОЗРИТЕЛЬНАЯ ОДНОВРЕМЕННОСТЬ (признак затирания параллельных записей)')
    rows = q(f'''select to_char("createdAt",'YYYY-MM-DD HH24:MI:SS'), count(*)
                 from transactions where "userId" = '{worst[0]}'
                 group by 1 having count(*) > 1 order by 2 desc limit 5''', game_db=True)
    if rows and len(rows[0]) >= 2:
        for r in rows:
            print('   %s — %s записей в одну секунду' % (r[0], r[1]))
    else:
        print('   не найдено — расхождение возникло не из-за гонки записей')
    return 1


def snapshot():
    q('''create table if not exists chesscoin_pm.ledger_snapshots (
           id serial primary key,
           taken_at timestamptz default now(),
           on_hands bigint,
           emitted bigint,
           diff bigint,
           players int)''')
    on_hands = one(f'select coalesce(sum(u.balance),0) from users u where {LIVE}', game_db=True)
    emitted = one(f'''select coalesce(sum(t.amount),0) from transactions t
                      join users u on u.id = t."userId" where {LIVE}''', game_db=True)
    players = one(f'select count(*) from users u where {LIVE}', game_db=True)
    q('''insert into chesscoin_pm.ledger_snapshots (on_hands, emitted, diff, players)
         values (%s, %s, %s, %s)''' % (on_hands, emitted, int(on_hands) - int(emitted), players))
    print('снимок записан: на руках %s, выдано %s, расхождение %s'
          % (fmt(on_hands), fmt(emitted), fmt(int(on_hands) - int(emitted))))
    print('\n▶ ИСТОРИЯ СНИМКОВ')
    for r in q('''select to_char(taken_at,'MM-DD HH24:MI'), on_hands, emitted, diff, players
                  from chesscoin_pm.ledger_snapshots order by taken_at desc limit 8'''):
        if len(r) >= 5:
            print('   %s  на руках %14s  выдано %14s  расх. %10s  игроков %s'
                  % (r[0], fmt(r[1]), fmt(r[2]), fmt(r[3]), r[4]))


if __name__ == '__main__':
    arg = sys.argv[1] if len(sys.argv) > 1 else ''
    if arg == '--types':
        summary(); by_types(); sys.exit(0)
    if arg == '--bisect':
        sys.exit(bisect())
    if arg == '--snapshot':
        snapshot(); sys.exit(0)
    sys.exit(summary())
