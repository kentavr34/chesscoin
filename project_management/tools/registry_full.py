# -*- coding: utf-8 -*-
"""ПОЛНЫЙ ПЕРЕЧЕНЬ ФАЙЛОВ — дополняет FILE_REGISTRY.md.

`inventory.py` показывает, что изменилось со вчера. Этот инструмент отвечает на
другой вопрос: что вообще есть в проекте и зачем. Кенан 31.07.2026 просил
«реестр файлов, полный перечень», отдельно — где во фронте лежат тексты.

Для каждого файла фронта считается, сколько в нём видимых пользователю строк
написано прямо в коде мимо словаря переводов (см. i18n_audit.py). Это и есть
рабочий список для перевода интерфейса.

Запуск:  python project_management/tools/registry_full.py
"""
import io
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from i18n_audit import collect  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'project_management', 'registry', 'FILE_REGISTRY.md')

# Назначение по каталогу. Порядок важен: первое совпадение выигрывает.
AREAS = [
    ('backend/prisma',            'Игра · схема БД и миграции'),
    ('backend/src/routes',        'Игра · HTTP-эндпоинты'),
    ('backend/src/services',      'Игра · бизнес-логика и кроны'),
    ('backend/src/__tests__',     'Игра · тесты'),
    ('backend/src',               'Игра · бэкенд, прочее'),
    ('bot/',                      'Бот · Telegram'),
    ('frontend/src/pages',        'Игра · экраны Mini App'),
    ('frontend/src/components',   'Игра · компоненты интерфейса'),
    ('frontend/src/i18n',         'Игра · словарь переводов'),
    ('frontend/src',              'Игра · фронтенд, прочее'),
    ('frontend/public',           'Игра · статика фронта'),
    ('design_canon',              'Канон дизайна · шаблоны и эталонные экраны'),
    ('project_management',        'Управляющий контур'),
    ('docs/kenan_canon',          'Канон требований Кенана'),
    ('docs',                      'Документация'),
    ('scripts',                   'Инфраструктура · скрипты'),
    ('chesscoin-archive',         'Архив (неприкосновенно)'),
    ('archive',                   'Архив (неприкосновенно)'),
]


def area_of(path):
    p = path.replace('\\', '/')
    for prefix, name in AREAS:
        if p.startswith(prefix):
            return name
    return 'Корень проекта'


def main():
    files = subprocess.run(['git', 'ls-files'], cwd=ROOT, capture_output=True,
                           encoding='utf-8', errors='replace').stdout.split('\n')
    files = [f for f in files if f.strip()]

    # Сколько видимых строк мимо словаря в каждом файле фронта.
    hardcoded = {}
    for rel, _lineno, _txt in collect():
        key = 'frontend/src/' + rel.replace('\\', '/')
        hardcoded[key] = hardcoded.get(key, 0) + 1

    by_area = {}
    for f in files:
        by_area.setdefault(area_of(f), []).append(f)

    lines = []
    lines.append('')
    lines.append('---')
    lines.append('')
    lines.append('# 📖 ПОЛНЫЙ ПЕРЕЧЕНЬ')
    lines.append('')
    lines.append('> Генерируется `tools/registry_full.py` по `git ls-files`. '
                 'Всё, что versioned, — здесь. Правки руками бессмысленны.')
    lines.append('')
    lines.append('| Область | Файлов |')
    lines.append('|---|---|')
    for area in sorted(by_area, key=lambda a: -len(by_area[a])):
        lines.append('| %s | %d |' % (area, len(by_area[area])))
    lines.append('| **Всего** | **%d** |' % len(files))
    lines.append('')

    total_hc = sum(hardcoded.values())
    lines.append('## Где во фронте лежат тексты интерфейса')
    lines.append('')
    lines.append('Словарь переводов — `frontend/src/i18n/translations.ts`, '
                 'выбор языка — `store/useSettingsStore.ts`, чтение — хук `useT`.')
    lines.append('')
    lines.append('Ниже — файлы, где видимые пользователю строки написаны прямо в коде '
                 'мимо словаря. Такая строка останется русской, даже если клиент '
                 'выбрал другой язык. Всего таких строк: **%d**.' % total_hc)
    lines.append('')
    if hardcoded:
        lines.append('| Файл | Строк мимо словаря |')
        lines.append('|---|---|')
        for path in sorted(hardcoded, key=lambda p: -hardcoded[p]):
            lines.append('| `%s` | %d |' % (path, hardcoded[path]))
    else:
        lines.append('Не найдено — весь текст идёт через словарь.')
    lines.append('')

    for area in sorted(by_area):
        lines.append('## %s' % area)
        lines.append('')
        for f in sorted(by_area[area]):
            mark = ''
            if f in hardcoded:
                mark = '  ← %d строк мимо словаря' % hardcoded[f]
            lines.append('- `%s`%s' % (f, mark))
        lines.append('')

    text = io.open(OUT, encoding='utf-8').read()
    marker = '\n---\n\n# 📖 ПОЛНЫЙ ПЕРЕЧЕНЬ'
    if marker in text:
        text = text[:text.index(marker)]
    io.open(OUT, 'w', encoding='utf-8').write(text.rstrip() + '\n' + '\n'.join(lines))

    print('файлов в реестре: %d' % len(files))
    print('строк мимо словаря: %d в %d файлах' % (total_hc, len(hardcoded)))
    print('отчёт: %s' % OUT)


if __name__ == '__main__':
    main()
