# -*- coding: utf-8 -*-
"""Обёртка для стража: живое прохождение урока обучения."""
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
    print('NO_SECRET')
    sys.exit(0)
with urllib.request.urlopen('%s/api/v1/screenshotter/token?secret=%s' % (APP, secret), timeout=20) as r:
    token = json.load(r).get('token', '')

r = subprocess.run(['node', os.path.join(REPO, 'project_management', 'tools', 'check_lesson_flow.mjs'), '3'],
                   cwd=REPO, env=dict(os.environ, AUTH_TOKEN=token, APP_URL=APP),
                   capture_output=True, encoding='utf-8', errors='replace', timeout=600)
print((r.stdout or '').strip())
if r.returncode != 0:
    print((r.stderr or '')[:200])
