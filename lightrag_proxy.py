"""
LightRAG Multi-Project Proxy
Адаптер: старый API /query/{project} и /insert/{project} → новый LightRAG API
Запускается на порту 9622, проксирует на localhost:9621
"""
import os
import logging
import httpx
from pathlib import Path
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

LIGHTRAG_URL = "http://localhost:9621"
API_KEY = os.environ.get("LIGHTRAG_API_KEY", "chesscoin_rag_secret_2026")
WEBUI_PATH = Path("/root/lightrag_app/lightrag/api/webui")

app = FastAPI(title="LightRAG Multi-Project Proxy")


def check_key(x_api_key: str = None):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


@app.get("/health")
async def health():
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{LIGHTRAG_URL}/health", timeout=5)
        data = r.json()
    return {
        "status": "ok",
        "projects": ["chesscoin", "illuminant", "virus_viny", "claudia"],
        "loaded": ["chesscoin"],
        "llm_model": data.get("configuration", {}).get("llm_binding", "openai"),
        "embed_model": data.get("configuration", {}).get("embedding_binding", "openai"),
    }


@app.post("/query/{project}")
async def query(project: str, request: Request, x_api_key: str = Header(None)):
    check_key(x_api_key)
    body = await request.json()
    question = body.get("query", "")
    mode = body.get("mode", "hybrid")
    top_k = body.get("top_k", 5)

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{LIGHTRAG_URL}/query",
            json={"query": question, "mode": mode, "top_k": top_k},
            headers={"X-API-Key": API_KEY},
            timeout=60,
        )
    if r.status_code != 200:
        return JSONResponse({"error": r.text}, status_code=r.status_code)
    data = r.json()
    return {
        "project": project,
        "query": question,
        "result": data.get("response", data.get("result", "")),
    }


@app.post("/insert/{project}")
async def insert(project: str, request: Request, x_api_key: str = Header(None)):
    check_key(x_api_key)
    body = await request.json()
    text = body.get("text", "")

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{LIGHTRAG_URL}/documents/text",
            json={"text": text, "description": f"[{project}]"},
            headers={"X-API-Key": API_KEY},
            timeout=60,
        )
    if r.status_code != 200:
        logger.error(f"Insert failed: {r.status_code} {r.text[:200]}")
        return JSONResponse({"error": r.text}, status_code=r.status_code)
    return {"project": project, "status": "inserted", "chars": len(text)}


@app.get("/projects")
async def projects(x_api_key: str = Header(None)):
    check_key(x_api_key)
    return ["chesscoin", "illuminant", "virus_viny", "claudia"]


# Статические файлы из webui (favicon, logo и т.д.)
@app.get("/favicon.png")
@app.get("/logo.svg")
async def static_file(request: Request):
    """Обслуживает статические файлы из webui"""
    file_path = WEBUI_PATH / request.url.path.lstrip("/")
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    return JSONResponse({"error": "Not found"}, status_code=404)


# WebUI Proxy - все остальные запросы
@app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_all(path_name: str, request: Request):
    """Проксирует все остальные запросы на localhost:9621"""

    # Пропускаем query/{project} и insert/{project} которые уже обработаны выше
    if path_name.startswith("query/") or path_name.startswith("insert/"):
        return JSONResponse({"error": "Not found"}, status_code=404)

    url = f"{LIGHTRAG_URL}/{path_name}"
    method = request.method

    try:
        async with httpx.AsyncClient() as client:
            body = await request.body() if method in ["POST", "PUT", "PATCH"] else b""
            r = await client.request(
                method,
                url,
                content=body,
                headers={k: v for k, v in request.headers.items() if k.lower() not in ["host", "connection"]},
                timeout=30
            )

        return StreamingResponse(
            iter([r.content]),
            status_code=r.status_code,
            media_type=r.headers.get("content-type"),
            headers={k: v for k, v in r.headers.items() if k.lower() not in ["content-encoding", "transfer-encoding"]},
        )
    except Exception as e:
        logger.error(f"Proxy error for {method} {url}: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=9622, log_level="info")
