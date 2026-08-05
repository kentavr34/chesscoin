# -*- coding: utf-8 -*-
"""Замена русских строк биржи на ключи словаря — по факту разметки.

Первый заход искал точные куски вида `>Текст<`, а в JSX текст лежит узлом
с переносами и отступами. Здесь три способа подряд: строка в кавычках,
строка в обратных кавычках, текстовый узел с любыми пробелами вокруг.
"""
import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.path.insert(0, 'scripts')

P = 'frontend/src/pages/ExchangeTab.tsx'
s = io.open(P, encoding='utf-8').read()

# Берём соответствие из того же файла, что заполнял словарь.
import importlib.util
spec = importlib.util.spec_from_file_location('_ex', 'scripts/_exchange_i18n.py')
# Модуль при импорте правит файлы — читаем словарь текстом, а не запуском.
исходник = io.open('scripts/_exchange_i18n.py', encoding='utf-8').read()
блок = исходник[исходник.index('СЛОВАРЬ = {'):исходник.index('\n}\n', исходник.index('СЛОВАРЬ = {')) + 2]
СЛОВАРЬ = {}
exec(блок, {}, СЛОВАРЬ)
СЛОВАРЬ = СЛОВАРЬ['СЛОВАРЬ']

# Длинные строки заменяем первыми: иначе короткая съест кусок длинной.
пары = sorted(((ru, ключ) for ключ, (ru, *_) in СЛОВАРЬ.items()),
              key=lambda x: -len(x[0]))

сделано, не_нашлось = 0, []
for ru, ключ in пары:
    выражение = 't.exchange.%s' % ключ
    было = s

    # 1. Строка в одинарных кавычках.
    s = s.replace("'%s'" % ru, выражение)
    # 2. В двойных.
    s = s.replace('"%s"' % ru, выражение)
    # 3. Текстовый узел JSX: >  Текст  <
    s = re.sub(r'>(\s*)' + re.escape(ru) + r'(\s*)<',
               lambda m: '>%s{%s}%s<' % (m.group(1), выражение, m.group(2)), s)

    if s == было:
        не_нашлось.append(ru)
    else:
        сделано += 1

io.open(P, 'w', encoding='utf-8').write(s)
print('ключей применено: %d из %d' % (сделано, len(пары)))
if не_нашлось:
    print('не нашлось в разметке (%d):' % len(не_нашлось))
    for x in не_нашлось:
        print('   ', x[:70])
