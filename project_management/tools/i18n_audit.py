# -*- coding: utf-8 -*-
"""АУДИТ ПЕРЕВОДОВ — что во фронте не переключается на язык клиента.

Кенан 31.07.2026: «стоит клиенту поменять язык — всё должно быть на его языке,
ни одного чужеродного термина, заголовка или слова. Даже уведомления».

Ищем видимые пользователю строки, написанные прямо в коде мимо словаря
`i18n/translations.ts`. Комментарии не трогаем: по правилу проекта они русские
и на экран не попадают.

Что считается находкой:
  · строковый литерал с кириллицей вне комментария;
  · текст между тегами JSX с кириллицей.

Запуск:
  python project_management/tools/i18n_audit.py           — сводка по файлам
  python project_management/tools/i18n_audit.py --list    — все находки построчно
  python project_management/tools/i18n_audit.py --count   — только число (для стража)
  python project_management/tools/i18n_audit.py --max N   — не больше N (для стража)

`--max` сравнивает прямо здесь, а не в оболочке: awk с кавычками не переживает
запуск через Windows-оболочку, и страж вместо ответа возвращал текст ошибки.
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'frontend', 'src')

# Словарь переводов — источник строк, а не нарушение.
SKIP_FILES = {os.path.join('i18n', 'translations.ts')}

CYR = re.compile('[А-Яа-яЁё]')

# Вшитый АНГЛИЙСКИЙ так же ломает интерфейс, как вшитый русский: 01.08.2026
# на экране профиля заголовок и текст были английскими, а кнопка русской.
# Первый аудит искал только кириллицу и этого не видел.
#
# Отличить фразу для человека от технической строки помогает форма:
# начинается с заглавной и содержит хотя бы два обычных слова.
LAT_PHRASE = re.compile(r"^[A-Z][a-z]+(?:[\s,.:;!?'—-]+[A-Za-z][a-z]*)+")

# Служебное, что похоже на фразу, но фразой не является: константы вроде
# TASK_REWARD, ссылки, camelCase-идентификаторы, css-значения.
# Шаблон констант обязательно якорим с обеих сторон: без этого он срабатывал
# на первой же заглавной букве и отбрасывал любую нормальную фразу.
TECH = re.compile(r'^(?:[A-Z0-9_]+$|https?://|[a-z]+[A-Z]|\d|#[0-9a-fA-F]{3,})')
STRING_LIT = re.compile(r"""(['"`])((?:\\.|(?!\1)[^\\])*)\1""")


def strip_comments(text):
    """Убирает // и /* */, не трогая содержимое строковых литералов."""
    out = []
    i, n = 0, len(text)
    quote = None
    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ''
        if quote:
            out.append(ch)
            if ch == '\\':
                if i + 1 < n:
                    out.append(nxt)
                    i += 2
                    continue
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in '\'"`':
            quote = ch
            out.append(ch)
            i += 1
            continue
        if ch == '/' and nxt == '/':
            while i < n and text[i] != '\n':
                i += 1
            continue
        if ch == '/' and nxt == '*':
            i += 2
            while i + 1 < n and not (text[i] == '*' and text[i + 1] == '/'):
                i += 1
            i += 2
            continue
        out.append(ch)
        i += 1
    return ''.join(out)


def is_english_phrase(text):
    """Похоже ли на фразу для человека, а не на техническую строку."""
    if not text or CYR.search(text):
        return False
    if TECH.match(text):
        return False
    return bool(LAT_PHRASE.match(text))


# Запасное значение в useText('ключ', 'строка') переводом НЕ является:
# ключ лежит в таблице текстов на всех языках, а эта строка показывается,
# только если словарь не загрузился. Считать её непереведённой — врать себе
# (03.08.2026: из-за этого счётчик рос на каждый правильно заведённый текст).
USETEXT_FALLBACK = re.compile(r"""useText\(\s*[`'"][^`'"]+[`'"]\s*,\s*'[^']*'""")


OBJECT_KEY = re.compile(r"""^\s*(?:'[^']*'|"[^"]*")\s*:""")

# Имя иконки в слайде — не текст для показа: SlideIcon рисует по нему картинку,
# на экран это слово не попадает. Раньше там стоял эмодзи, и перевод его не
# касался; после замены на имена счётчик стал считать их непереведёнными
# (05.08.2026).
ICON_NAME = re.compile(r"""icon:\s*'[a-z][a-z0-9_]*'""")


def scan_file(path, rel):
    text = io.open(path, encoding='utf-8', errors='replace').read()
    code = strip_comments(text)
    # Вырезаем запасные значения useText, оставляя сам вызов на месте.
    code = USETEXT_FALLBACK.sub(lambda m: m.group(0).split(',')[0] + ", ''", code)
    code = ICON_NAME.sub("icon: ''", code)
    findings = []
    for lineno, line in enumerate(code.split('\n'), 1):
        # Ключ таблицы соответствий — не текст для показа. Строки вида
        #     'Golden pieces': 'sepia(1)...',
        # это то, ПО ЧЕМУ ищут настройку, а не то, что читает игрок. Раньше
        # счётчик считал их непереведёнными, и каждый новый стиль фигур или
        # звуковой набор «ухудшал» перевод (03.08.2026).
        if OBJECT_KEY.match(line):
            continue
        hits = []
        for m in STRING_LIT.finditer(line):
            body = m.group(2).strip()
            if CYR.search(body) or is_english_phrase(body):
                hits.append(body)
        # Текст прямо в разметке: >Привет<
        for m in re.finditer(r'>([^<>{}]+)<', line):
            body = m.group(1).strip()
            if body and (CYR.search(body) or is_english_phrase(body)):
                hits.append(body)
        for h in dict.fromkeys(hits):
            findings.append((rel, lineno, h[:90]))
    return findings


def collect():
    all_findings = []
    for base, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if d not in ('node_modules', 'dist')]
        for f in files:
            if not f.endswith(('.ts', '.tsx')):
                continue
            path = os.path.join(base, f)
            rel = os.path.relpath(path, SRC)
            if rel.replace('\\', '/') in {s.replace('\\', '/') for s in SKIP_FILES}:
                continue
            all_findings.extend(scan_file(path, rel))
    return all_findings


if __name__ == '__main__':
    arg = sys.argv[1] if len(sys.argv) > 1 else ''
    findings = collect()

    if arg == '--count':
        print('HARDCODED_STRINGS=%d' % len(findings))
        sys.exit(0)

    if arg == '--max':
        ceiling = int(sys.argv[2])
        n = len(findings)
        # Потолок опускается по мере переноса строк в таблицу, но расти не должен.
        print('HARDCODED_OK %d/%d' % (n, ceiling) if n <= ceiling
              else 'HARDCODED_GREW %d>%d' % (n, ceiling))
        sys.exit(0)

    print('=' * 74)
    print('АУДИТ ПЕРЕВОДОВ · строк мимо словаря: %d' % len(findings))
    print('=' * 74)

    by_file = {}
    for rel, lineno, txt in findings:
        by_file.setdefault(rel, []).append((lineno, txt))

    for rel in sorted(by_file, key=lambda r: -len(by_file[r])):
        items = by_file[rel]
        print('\n%-52s %3d' % (rel, len(items)))
        if arg == '--list':
            for lineno, txt in items:
                print('   %5d  %s' % (lineno, txt))

    print('\n' + '-' * 74)
    print('файлов затронуто: %d' % len(by_file))
    print('Каждая строка здесь останется русской, даже если клиент выбрал другой язык.')
