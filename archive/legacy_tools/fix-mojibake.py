#!/usr/bin/env python3
"""
Чинит mojibake (UTF-8 → cp1251 → UTF-8 double-encoding) в .ts/.tsx файлах.

Алгоритм:
1. Прочитать файл как UTF-8.
2. Найти все максимальные последовательности не-ASCII символов.
3. Для каждой попробовать декодировать: text.encode('cp1251').decode('utf-8').
   Если получается строка, состоящая в основном из кириллицы / типографских
   знаков — это был mojibake → заменить.
4. Если расшифрованная строка совпадает с оригиналом или содержит много
   мусора — пропустить (legit Unicode).

Запуск:
  python fix-mojibake.py --dry        # просто посчитать
  python fix-mojibake.py               # реально починить (+создаёт .bak)
  python fix-mojibake.py path/to/file  # один файл
"""

import sys
import re
import unicodedata
from pathlib import Path

# Все максимальные последовательности не-ASCII символов
NON_ASCII_RUN = re.compile(r'[^\x00-\x7f]+')

# Допустимые символы в "правильном" русском тексте
def is_acceptable_char(ch: str) -> bool:
    """Кириллица, типографические знаки, пробелы, пунктуация ASCII, эмодзи."""
    if ch.isascii():
        return True
    code = ord(ch)
    # Кириллица
    if 0x0400 <= code <= 0x04FF:
        return True
    # Армянская кириллица и расширения
    if 0x0500 <= code <= 0x052F:
        return True
    # Типографические знаки (— … « » “ ” ‘ ’ · • etc.)
    if 0x2000 <= code <= 0x206F:
        return True
    # Стрелки, математика, тире, прочие символы
    if 0x2010 <= code <= 0x203F:
        return True
    # Эмодзи и пиктограммы (часто легитимны: 🏆 ⚔️ etc.)
    if 0x2300 <= code <= 0x27FF:
        return True
    if 0x1F000 <= code <= 0x1FFFF:
        return True
    # Box drawing (для разделителей в комментариях)
    if 0x2500 <= code <= 0x257F:
        return True
    # Юникод-флаги (Regional indicators)
    if 0x1F1E6 <= code <= 0x1F1FF:
        return True
    return False

def looks_like_mojibake(text: str) -> bool:
    """Эвристика: текст содержит много 'Р', 'С', 'в', 'Ё' и подобных
    стартеров mojibake."""
    if len(text) < 2:
        return False
    mojibake_starters = sum(1 for ch in text if ch in 'РСвВЁЁЃ–—‘’“”„¶·°«»ЇЎЊЉТЎ•')
    return mojibake_starters >= len(text) / 3  # хотя бы треть mojibake-стартеров

def _try_one_encoding(s: str, enc: str) -> tuple[str, int]:
    """Возвращает (decoded, bad_chars)."""
    try:
        raw = s.encode(enc, errors='strict')
    except UnicodeEncodeError:
        # fallback — кодируем что можно, остальное оставляем как ?
        raw = s.encode(enc, errors='replace')
    decoded = raw.decode('utf-8', errors='replace')
    bad = sum(1 for ch in decoded if ch == '�' or not is_acceptable_char(ch))
    return decoded, bad

def try_decode_mojibake(s: str) -> str | None:
    """Попытка декодировать mojibake. Пробует cp1251, cp1252, latin-1.
    Выбирает вариант с минимумом replacement chars."""
    if not looks_like_mojibake(s):
        return None
    # Пробуем три кодировки
    candidates = []
    for enc in ('cp1251', 'cp1252', 'latin-1'):
        decoded, bad = _try_one_encoding(s, enc)
        # Должна быть хотя бы одна кириллица
        has_cyr = any(0x0400 <= ord(ch) <= 0x04FF for ch in decoded)
        if has_cyr and decoded != s:
            candidates.append((bad, decoded))
    if not candidates:
        return None
    # Выбираем с минимумом мусора
    candidates.sort()
    bad, best = candidates[0]
    # >10% мусора в результате → не уверены
    if bad > max(1, len(best) * 0.1):
        return None
    return best

# Точные mojibake-замены для коротких типографских блоков, которые наш
# эвристический декодер пропускает.
EXACT_REPLACEMENTS = {
    'вЂ”': '—',   # em dash
    'вЂ"': '–',   # en dash
    'вЂ¦': '…',   # ellipsis
    'вЂў': '•',   # bullet
    'вЂ˜': '‘',   # left single quote
    'вЂ™': '’',   # right single quote
    'вЂњ': '“',   # left double quote
    'вЂќ': '”',   # right double quote
    'в”Ђ': '─',   # box light horizontal
    'в”Њ': '┌',   # box top-left
    'в”ђ': '┐',   # box top-right
    'в””': '└',   # box bottom-left
    'в”ј': '┼',   # cross
    'В«': '«',    # left guillemet
    'В»': '»',    # right guillemet
    'В·': '·',    # middle dot
    'В°': '°',    # degree
    'В­': '­',   # soft hyphen
    'Вђ': '‐',   # hyphen
    'Г—': '×',    # multiplication
    'Г·': '÷',    # division
    'в†’': '→',   # right arrow
    'в†ђ': '←',   # left arrow
    'в†‘': '↑',   # up arrow
    'в†“': '↓',   # down arrow
    'в„–': '№',   # numero sign
    'вњ"': '✓',   # check mark
    'вњ–': '✖',   # cross mark
    '�?': '',     # stale replacement char (very rare)
}

def fix_text(text: str) -> tuple[str, int]:
    count = 0
    def replace(m):
        nonlocal count
        s = m.group(0)
        decoded = try_decode_mojibake(s)
        if decoded and decoded != s:
            count += 1
            return decoded
        return s
    out = NON_ASCII_RUN.sub(replace, text)
    # Затем точечные замены оставшихся коротких mojibake
    for src, dst in EXACT_REPLACEMENTS.items():
        n = out.count(src)
        if n:
            out = out.replace(src, dst)
            count += n
    return out, count

def process(path: Path, dry: bool) -> int:
    raw = path.read_text(encoding='utf-8', errors='replace')
    fixed, count = fix_text(raw)
    if count == 0:
        return 0
    print(f'{"DRY" if dry else "FIX"} {path}: {count} replacements')
    if not dry:
        backup = path.with_suffix(path.suffix + '.mojibake-bak')
        if not backup.exists():
            backup.write_text(raw, encoding='utf-8')
        path.write_text(fixed, encoding='utf-8')
    return count

def main():
    args = sys.argv[1:]
    dry = '--dry' in args or '-n' in args
    targets = [a for a in args if not a.startswith('-')]
    if not targets:
        targets = ['frontend/src']
    files = []
    for t in targets:
        p = Path(t)
        if p.is_file():
            files.append(p)
        elif p.is_dir():
            files.extend(p.rglob('*.ts'))
            files.extend(p.rglob('*.tsx'))
    total = 0
    n_files = 0
    for f in sorted(files):
        c = process(f, dry)
        if c:
            total += c
            n_files += 1
    print(f'\nTOTAL: {total} replacements, {n_files} files {"(dry)" if dry else "changed"}')

if __name__ == '__main__':
    main()
