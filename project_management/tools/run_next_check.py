# -*- coding: utf-8 -*-
"""Обёртка для стража: берёт токен и запускает живую проверку кнопки.

Отдельный файл нужен, потому что страж выполняет одну команду, а проверке
нужен свежий JWT — его выдаёт штатный эндпоинт скриншотера.
"""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _pm import sh  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APP = 'https://chesscoin.app'

secret = sh('grep "^SCREENSHOT_SECRET=" /opt/chesscoin/.env | cut -d= -f2-').strip()
if not secret:
    print('СТРАЖ НЕ СРАБОТАЛ: секрет скриншотера не прочитался с прода — '
          'это отказ проверки, а не поломка продукта')
    sys.exit(2)

import json
import urllib.request
with urllib.request.urlopen('%s/api/v1/screenshotter/token?secret=%s' % (APP, secret), timeout=20) as r:
    token = json.load(r).get('token', '')
if not token:
    print('NO_TOKEN')
    sys.exit(0)

r = subprocess.run(['node', os.path.join(REPO, 'project_management', 'tools', 'check_next_button.mjs')],
                   cwd=REPO, env=dict(os.environ, AUTH_TOKEN=token, APP_URL=APP),
                   capture_output=True, encoding='utf-8', errors='replace', timeout=600)
print((r.stdout or '').strip())
if r.returncode != 0:
    print((r.stderr or '')[:200])
