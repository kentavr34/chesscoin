# -*- coding: utf-8 -*-
"""Обёртка для стража: в интерфейсе Mini App не должно быть эмодзи.

Правило проекта — только SVG-иконки (CLAUDE.md, «UI ПРАВИЛА»). Проверять
по исходникам недостаточно: тексты приходят из таблицы ui_texts, и словарь
из базы перекрывает статический. 05.08.2026 на профиле висели четыре
эмодзи, которых в коде уже не было.
"""
import json
import os
import subprocess
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _pm import sh  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APP = 'https://chesscoin.app'

secret = sh('grep "^SCREENSHOT_SECRET=" /opt/chesscoin/.env | cut -d= -f2-').strip()
if not secret:
    print('СТРАЖ НЕ СРАБОТАЛ: секрет скриншотера не прочитался с прода — '
          'это отказ проверки, а не поломка продукта')
    sys.exit(2)
with urllib.request.urlopen('%s/api/v1/screenshotter/token?secret=%s' % (APP, secret), timeout=20) as r:
    token = json.load(r).get('token', '')

r = subprocess.run(['node', os.path.join(REPO, 'scripts', 'playwright-emoji-scan.mjs')],
                   cwd=REPO, env=dict(os.environ, AUTH_TOKEN=token, APP_URL=APP),
                   capture_output=True, encoding='utf-8', errors='replace', timeout=900)
out = (r.stdout or '').strip()
for line in out.split('\n'):
    if line.strip() and not line.startswith('чисто'):
        print(line)
print('NO_EMOJI_OK' if r.returncode == 0 else 'EMOJI_FOUND')
