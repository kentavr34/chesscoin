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


def scan_file(path, rel):
    text = io.open(path, encoding='utf-8', errors='replace').read()
    code = strip_comments(text)
    findings = []
    for lineno, line in enumerate(code.split('\n'), 1):
        if not CYR.search(line):
            continue
        hits = []
        for m in STRING_LIT.finditer(line):
            body = m.group(2)
            if CYR.search(body):
                hits.append(body.strip())
        # Текст прямо в разметке: >Привет<
        for m in re.finditer(r'>([^<>{}]*[А-Яа-яЁё][^<>{}]*)<', line):
            body = m.group(1).strip()
            if body:
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
