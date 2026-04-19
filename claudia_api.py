"""
claudia_api.py — HTTP-обёртка над памятью и AI_TEAM для внешнего доступа.

Endpoints:
  POST /claudia/search          — параллельный поиск (FTS+trigram+semantic+RAG)
  POST /claudia/remember        — закладка в LightRAG
  POST /claudia/team/call       — вызвать специалиста
  GET  /claudia/team/roster     — состав команды
  POST /claudia/team/teach      — научить специалиста
  GET  /claudia/health          — ping

Запуск: uvicorn claudia_api:app --host 0.0.0.0 --port 9623
        (слушаем 0.0.0.0 чтобы docker-nginx мог достучаться через host.docker.internal;
         наружу порт не торчит — nginx закрывает файрволом/location-настройкой)
Nginx: location /claudia/ → 127.0.0.1:9623/
Auth: X-API-Key заголовок (тот же CLAUDIA_API_KEY что LIGHTRAG)
"""
import os
import sys
import logging
from typing import List, Optional
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv('/root/claudia/.env')
sys.path.insert(0, '/root/claudia')

import claudia_memory
from team import Commander

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('claudia_api')

API_KEY = os.getenv('CLAUDIA_API_KEY') or os.getenv('LIGHTRAG_API_KEY') or 'chesscoin_rag_secret_2026'

app = FastAPI(title='Claudia API', version='1.0')
cmdr = Commander()


def _auth(x_api_key: Optional[str]):
    if x_api_key != API_KEY:
        raise HTTPException(401, 'Invalid or missing X-API-Key')


# ─── MODELS ─────────────────────────────────────────────────────────
class SearchRequest(BaseModel):
    query: str
    limit: int = 10
    days: Optional[int] = None
    modes: Optional[List[str]] = None  # ['fts','trigram','semantic','rag']


class RememberRequest(BaseModel):
    text: str
    tags: Optional[List[str]] = None
    category: str = 'bookmark'
    project: str = 'claudia'


class TeamCallRequest(BaseModel):
    role: str
    prompt: str
    task_type: str = 'general'
    max_tokens: Optional[int] = None


class TeachRequest(BaseModel):
    role: str
    lesson: str
    source: str = 'claude_code'
    confidence: float = 1.0


# ─── ENDPOINTS ──────────────────────────────────────────────────────
@app.get('/claudia/health')
def health():
    return {'ok': True, 'service': 'claudia_api'}


@app.post('/claudia/search')
def search(req: SearchRequest, x_api_key: Optional[str] = Header(None)):
    _auth(x_api_key)
    try:
        r = claudia_memory.search(
            req.query, limit=req.limit, days=req.days, modes=req.modes
        )
        # сериализуем datetime → str
        for key in ('pg_fts', 'pg_trigram', 'pg_semantic', 'merged'):
            for item in r.get(key, []):
                for k, v in list(item.items()):
                    if hasattr(v, 'isoformat'):
                        item[k] = v.isoformat()
        return r
    except Exception as e:
        log.exception('search failed')
        raise HTTPException(500, str(e))


@app.post('/claudia/remember')
def remember(req: RememberRequest, x_api_key: Optional[str] = Header(None)):
    _auth(x_api_key)
    ok = claudia_memory.remember(req.text, tags=req.tags or [],
                                  category=req.category, project=req.project)
    return {'ok': ok}


@app.post('/claudia/team/call')
def team_call(req: TeamCallRequest, x_api_key: Optional[str] = Header(None)):
    _auth(x_api_key)
    answer = cmdr.call(req.role, req.prompt,
                       task_type=req.task_type, max_tokens=req.max_tokens)
    if answer is None:
        raise HTTPException(502, 'Specialist failed to respond')
    return {'role': req.role, 'answer': answer}


@app.get('/claudia/team/roster')
def team_roster(x_api_key: Optional[str] = Header(None)):
    _auth(x_api_key)
    team = cmdr.roster()
    # сериализуем datetime
    for r in team:
        for k, v in list(r.items()):
            if hasattr(v, 'isoformat'):
                r[k] = v.isoformat()
            elif hasattr(v, '__float__'):
                try:
                    r[k] = float(v)
                except Exception:
                    r[k] = str(v)
    return {'team': team}


@app.post('/claudia/team/teach')
def team_teach(req: TeachRequest, x_api_key: Optional[str] = Header(None)):
    _auth(x_api_key)
    ok = cmdr.teach(req.role, req.lesson,
                    source=req.source, confidence=req.confidence)
    return {'ok': ok}
