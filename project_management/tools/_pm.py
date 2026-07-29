# -*- coding: utf-8 -*-
"""Общий слой доступа управляющего контура ChessCoin.

Все инструменты работают С ПК: ssh → docker exec → psql на проде.
Отдельная установка на сервер не нужна.
"""
import io
import os
import sys
import subprocess

try:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
except Exception:
    pass

PROD = 'root@45.67.216.36'                       # адрес проверяется резолвом chesscoin.app
KEY = os.path.expanduser('~/.ssh/claude_deploy_key')
SEP = '~|~'   # разделитель колонок: обычный | встречается внутри команд (docker logs | grep)
PG = "docker exec -i chesscoin_postgres psql -U claudia -d claudia -tA -F '%s'" % SEP
PG_GAME = "docker exec -i chesscoin_postgres psql -U chesscoin -d chesscoin -tA -F '%s'" % SEP
SSH = ['ssh', '-i', KEY, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
       '-o', 'StrictHostKeyChecking=no', PROD]


def sh(cmd, timeout=90):
    """Выполнить команду на проде, вернуть stdout (строкой)."""
    try:
        r = subprocess.run(SSH + [cmd], capture_output=True, encoding='utf-8',
                           errors='replace', timeout=timeout)
        return (r.stdout or '').strip()
    except Exception as e:
        return 'ОШИБКА SSH: %s' % str(e)[:80]


def q(sql, game_db=False, timeout=90):
    """Запрос к БД. Возвращает список строк, каждая — список колонок (разделитель |)."""
    try:
        r = subprocess.run(SSH + [PG_GAME if game_db else PG], input=sql,
                           capture_output=True, encoding='utf-8', errors='replace',
                           timeout=timeout)
        out = (r.stdout or '').strip()
        if not out:
            return []
        return [line.split(SEP) for line in out.split('\n') if line.strip()]
    except Exception as e:
        return [['ОШИБКА SQL: %s' % str(e)[:80]]]


def one(sql, game_db=False, default='—'):
    """Первое значение первой строки."""
    rows = q(sql, game_db=game_db)
    return rows[0][0] if rows and rows[0] else default


def esc(text):
    """Экранирование для вставки в SQL-литерал."""
    return (text or '').replace("'", "''")


def head(title):
    print('\n' + '=' * 74)
    print(title)
    print('=' * 74)
