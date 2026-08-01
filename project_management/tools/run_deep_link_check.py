# -*- coding: utf-8 -*-
"""Обёртка для стража: ссылка на партию обязана открывать доску.

Кенан 01.08.2026 жаловался, что переход по ссылке из канала бросает на
главный экран. Причина была в том, что параметр ссылки разбирался только
при первом входе — у всех, кто открывал приложение раньше, он терялся.
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
    print('NO_SECRET')
    sys.exit(0)
with urllib.request.urlopen('%s/api/v1/screenshotter/token?secret=%s' % (APP, secret), timeout=20) as r:
    token = json.load(r).get('token', '')

# Берём любую существующую партию: важен сам факт перехода на доску.
sid = sh('docker exec chesscoin_postgres psql -U chesscoin -d chesscoin -t -A '
         '-c "SELECT id FROM sessions ORDER BY \\"createdAt\\" DESC LIMIT 1;"').strip()
if not sid:
    print('NO_SESSION')
    sys.exit(0)

ok = True
for param in ('match_%s' % sid, 'refmatch_254450353_%s' % sid):
    r = subprocess.run(['node', os.path.join(REPO, 'project_management', 'tools', 'check_deep_link.mjs'),
                        param, '/game/'],
                       cwd=REPO, env=dict(os.environ, AUTH_TOKEN=token, APP_URL=APP),
                       capture_output=True, encoding='utf-8', errors='replace', timeout=600)
    out = (r.stdout or '').strip()
    print(out)
    if 'DEEPLINK_OK' not in out:
        ok = False

print('DEEPLINKS_OK' if ok else 'DEEPLINKS_BROKEN')
