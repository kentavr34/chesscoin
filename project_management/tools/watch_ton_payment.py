# -*- coding: utf-8 -*-
"""НАБЛЮДЕНИЕ ЗА ЖИВЫМ ПЛАТЕЖОМ TON — проверка привязки кошелька по факту.

Кенан 09.08.2026: «есть возможность проверить по факту?» — «делаем».

Повод: заслон на привязке кошелька в коде работает (подделать подтверждение
через API нельзя, проверено запросами), но НАСТОЯЩИЙ платёж через него ни разу
не проходил. Последний приход на кошелёк платформы — 23.01.2026. Три
существующих подтверждения унаследованы миграцией 31.07 и хэша платежа не
имеют. Значит, путь «заплатил 1 TON → подтвердился → торгуешь» непроверен.

Инструмент смотрит одновременно в три места и говорит, что случилось:
  1. блокчейн — пришёл ли перевод на кошелёк платформы;
  2. база — появилась ли запись подтверждения с НАСТОЯЩИМ хэшем;
  3. логи сервера — что сказала проверка платежа.

Запуск:
    python project_management/tools/watch_ton_payment.py           # 10 минут
    python project_management/tools/watch_ton_payment.py --min 20  # дольше
    python project_management/tools/watch_ton_payment.py --snapshot  # только точка отсчёта
"""
import json
import os
import subprocess
import sys
import time

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except (AttributeError, OSError):
    pass

СЕРВЕР = 'root@45.67.216.36'
КЛЮЧ_SSH = 'C:/Users/SAM/.ssh/claude_deploy_key'


def на_сервере(команда, таймаут=90):
    r = subprocess.run(['ssh', '-i', КЛЮЧ_SSH, СЕРВЕР, команда],
                       capture_output=True, encoding='utf-8', errors='replace',
                       timeout=таймаут)
    return (r.stdout or '').strip()


def из_env(имя):
    return на_сервере('grep -m1 "^%s=" /opt/chesscoin/.env | cut -d= -f2-' % имя)


def транзакции(кошелёк, ключ, лимит=12):
    """Последние приходы на кошелёк платформы — прямо из блокчейна."""
    сырое = на_сервере(
        'curl -s -m 25 "https://toncenter.com/api/v2/getTransactions'
        '?address=%s&limit=%d" -H "X-API-Key: %s"' % (кошелёк, лимит, ключ))
    try:
        d = json.loads(сырое)
    except ValueError:
        return None
    if not d.get('ok'):
        return None
    итог = []
    for t in d.get('result', []):
        m = t.get('in_msg') or {}
        итог.append({
            'хэш': (t.get('transaction_id') or {}).get('hash', '')[:24],
            'когда': int(t.get('utime', 0)),
            'сумма': int(m.get('value') or 0) / 1e9,
            'от': (m.get('source') or '—')[:20],
        })
    return итог


def подтверждения():
    сырое = на_сервере(
        'docker exec chesscoin_postgres psql -U chesscoin -d chesscoin -tAF"~" -c '
        '"SELECT \\"walletAddress\\", coalesce(\\"txHash\\",\'\'), \\"confirmedAt\\" '
        'FROM ton_wallet_confirmations ORDER BY \\"confirmedAt\\";"')
    строки = []
    for l in сырое.split('\n'):
        if l.count('~') >= 2:
            адрес, хэш, когда = l.split('~', 2)
            строки.append({'адрес': адрес, 'хэш': хэш, 'когда': когда})
    return строки


def логи_проверки(минут=15):
    return на_сервере(
        'docker logs chesscoin_backend --since %dm 2>&1 | grep -iE "TON verify|ton-wallet|'
        'WALLET_NOT_CONFIRMED|payment not confirmed" | tail -12' % минут)


def показать_снимок(кошелёк, ключ):
    print('=' * 74)
    print('ТОЧКА ОТСЧЁТА ПЕРЕД ПЛАТЕЖОМ')
    print('=' * 74)
    тр = транзакции(кошелёк, ключ)
    if тр is None:
        print('   ⚠️ блокчейн не ответил — проверка вслепую невозможна')
    else:
        print('   приходов на кошелёк платформы: %d, последний:' % len(тр))
        if тр:
            t = тр[0]
            print('      %s  +%.4f TON  от %s…'
                  % (time.strftime('%Y-%m-%d %H:%M', time.localtime(t['когда'])),
                     t['сумма'], t['от']))
    п = подтверждения()
    сХэшем = [x for x in п if x['хэш']]
    print('   подтверждений кошельков: %d, из них с настоящим хэшем: %d'
          % (len(п), len(сХэшем)))
    return тр, п


def главное(аргументы):
    минут = 10
    for i, а in enumerate(аргументы):
        if а == '--min' and i + 1 < len(аргументы):
            минут = int(аргументы[i + 1])

    кошелёк = из_env('PLATFORM_TON_WALLET')
    ключ = из_env('TONCENTER_API_KEY')
    if not кошелёк:
        print('кошелёк платформы не задан на сервере — проверять нечего')
        return 2

    было_тр, было_п = показать_снимок(кошелёк, ключ)
    if '--snapshot' in аргументы:
        return 0

    было_хэшей = {(x['адрес'], x['хэш']) for x in было_п}
    было_txt = {t['хэш'] for t in (было_тр or [])}

    print('\nЖДУ ПЛАТЁЖ %d минут. Опрос каждые 20 секунд.' % минут)
    print('Порядок для Кенана: подключить в приложении НОВЫЙ адрес → оплатить 1 TON.\n')

    до = time.time() + минут * 60
    приход_виден = False
    while time.time() < до:
        time.sleep(20)
        тр = транзакции(кошелёк, ключ)
        if тр:
            новые = [t for t in тр if t['хэш'] not in было_txt]
            for t in новые:
                приход_виден = True
                print('💰 БЛОКЧЕЙН: +%.4f TON от %s… в %s'
                      % (t['сумма'], t['от'],
                         time.strftime('%H:%M:%S', time.localtime(t['когда']))))
                было_txt.add(t['хэш'])

        п = подтверждения()
        for x in п:
            if (x['адрес'], x['хэш']) not in было_хэшей:
                было_хэшей.add((x['адрес'], x['хэш']))
                метка = 'с хэшем %s…' % x['хэш'][:16] if x['хэш'] else 'БЕЗ ХЭША'
                print('✅ БАЗА: подтверждён %s… — %s' % (x['адрес'][:18], метка))
                print('\nПроверка пройдена: платёж найден и записан.')
                print(логи_проверки(минут + 5))
                return 0

        if приход_виден:
            print('   …перевод в блокчейне есть, записи подтверждения пока нет')

    print('\nВремя вышло. Что видно:')
    print('  приход в блокчейне:', 'ДА' if приход_виден else 'нет')
    print('  запись подтверждения: нет')
    хвост = логи_проверки(минут + 5)
    print('  логи проверки платежа:\n%s' % (хвост or '    (пусто — сервер проверку не запускал)'))
    return 1


if __name__ == '__main__':
    sys.exit(главное(sys.argv[1:]))
