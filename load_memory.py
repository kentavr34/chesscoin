# -*- coding: utf-8 -*-
"""
Загрузчик памяти в LightRAG v2.0 — все проекты КЕНАНА.
Структурированная загрузка с тегами проектов.

Проекты:
  APP_CHESSCOIN   — D:\CHESSMATE + сервер /opt/chesscoin
  BOOK_ILLUMINANT — D:\BOOKS\illumunant
  BOOK_VIRUSVINY  — D:\BOOKS\Vina
  BOOK_PSYCH      — D:\BOOKS\Psychiatrist
  BOOK_SCHIZO     — D:\BOOKS\Shizofrenia
  WEB_EVENTCY     — D:\WEB\eventcy
  WEB_IPAS        — D:\WEB\ipas
  CLAUDIA         — D:\CLAUDIA + /root/claudia

Запуск: python load_memory.py
        python load_memory.py --project chesscoin  (только один проект)
        python load_memory.py --dry-run            (показать что будет загружено)
"""
import os
import re
import sys
import time
import httpx
import asyncio
import argparse
from pathlib import Path

# Windows консоль — безопасный вывод
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def safe_print(*args, **kwargs):
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        text = ' '.join(str(a) for a in args)
        print(text.encode('ascii', errors='replace').decode('ascii'), **kwargs)

LIGHTRAG_URL = "https://chesscoin.app/lightrag"
API_KEY      = "chesscoin_rag_secret_2026"
USERNAME     = "kenan"
PASSWORD     = "chesscoin_rag_secret_2026"

# ─── Базовые пути ─────────────────────────────────────────────────────────────
D_BOOKS    = Path("D:/BOOKS")
D_WEB      = Path("D:/WEB")
D_CHESSMATE = Path("D:/CHESSMATE")
D_CLAUDIA  = Path("D:/CLAUDIA")
CHESSCOIN  = Path("C:/Users/SAM/Desktop/chesscoin")

# ─── Все документы для загрузки ───────────────────────────────────────────────
# Формат: (путь, проект-тег, описание, приоритет 1-3)
# приоритет 1 = ключевые документы, 3 = вспомогательные

ALL_DOCS = [

    # ─── APP_CHESSCOIN — правила, задачи, архитектура ──────────────────────────
    (CHESSCOIN / "CLAUDE.md",                         "app_chesscoin", "ChessCoin — правила для ИИ агентов", 1),
    (CHESSCOIN / "BIBLE.md",                          "app_chesscoin", "ChessCoin BIBLE — запрещённые практики", 1),
    (CHESSCOIN / ".claude/management/01-RULES.md",    "app_chesscoin", "ChessCoin — правила разработки", 1),
    (CHESSCOIN / ".claude/management/02-TASKS.md",    "app_chesscoin", "ChessCoin — задачи и бэклог", 1),
    (CHESSCOIN / ".claude/management/03-VISUAL.md",   "app_chesscoin", "ChessCoin — визуальные стандарты", 2),
    (CHESSCOIN / ".claude/management/04-PROGRESS.md", "app_chesscoin", "ChessCoin — прогресс разработки", 2),
    (CHESSCOIN / ".claude/management/05-STATUS.md",   "app_chesscoin", "ChessCoin — текущий статус", 1),
    (CHESSCOIN / ".claude/management/06-COMPREHENSIVE_PLAN.md", "app_chesscoin", "ChessCoin — комплексный план", 1),
    (CHESSCOIN / ".claude/management/07-DESIGN_STANDARD.md",    "app_chesscoin", "ChessCoin — дизайн-стандарт", 2),
    (CHESSCOIN / ".claude/archive/GAME_MECHANICS.md",           "app_chesscoin", "ChessCoin — игровая механика", 2),
    (CHESSCOIN / ".claude/archive/MULTILINGUAL_SYSTEM.md",      "app_chesscoin", "ChessCoin — мультиязычность", 3),
    # Старые планы
    (D_CHESSMATE / "Old/CHESSCOIN-PLAN.md",           "app_chesscoin", "ChessCoin — старый план разработки v1", 2),
    (D_CHESSMATE / "Old/CHESSCOIN-PLAN-1.md",         "app_chesscoin", "ChessCoin — план разработки v2", 2),
    (D_CHESSMATE / "Old/CLAUDE.md",                   "app_chesscoin", "ChessCoin — старый CLAUDE.md", 3),
    (D_CHESSMATE / "Old/CLAUDE_CODE_MASTER_PROMPT.md","app_chesscoin", "ChessCoin — мастер-промпт для Claude Code", 2),
    (D_CHESSMATE / "Old/SKILL.md",                    "app_chesscoin", "ChessCoin — skills системы", 3),
    (D_CHESSMATE / "Old/SKILL-1.md",                  "app_chesscoin", "ChessCoin — skill 1", 3),
    (D_CHESSMATE / "Old/SKILL-2.md",                  "app_chesscoin", "ChessCoin — skill 2", 3),
    (D_CHESSMATE / "Chesscoin.txt",                   "app_chesscoin", "ChessCoin — концепция (текст)", 1),
    # Диалоги
    (CHESSCOIN / ".claude/chats/chat-1-11.04.2026.txt", "app_chesscoin", "Диалог 11.04.2026 — Клаудиа v4, деплой", 2),
    (CHESSCOIN / ".claude/chats/chat-1-8.04.2026.txt",  "app_chesscoin", "Диалог 08.04.2026 — компоненты, дизайн", 2),
    (CHESSCOIN / ".claude/chats/Chessmategame.txt",      "app_chesscoin", "ChessCoin — концепция игры", 2),
    (CHESSCOIN / ".claude/chats/Задачи.txt",             "app_chesscoin", "ChessCoin — задачи и идеи", 2),

    # ─── BOOK_ILLUMINANT — трилогия Иллюминант ────────────────────────────────
    (D_BOOKS / "illumunant/MASTER_DOCUMENT.md",         "book_illuminant", "Иллюминант — мастер-документ трилогии", 1),
    (D_BOOKS / "illumunant/РОАДМАП_ТРИЛОГИИ_ИЛЛЮМИНАНТ.md", "book_illuminant", "Иллюминант — роадмап трилогии", 1),
    (D_BOOKS / "illumunant/STYLISTIC_CODEX.md",         "book_illuminant", "Иллюминант — стилистический кодекс", 1),
    (D_BOOKS / "illumunant/FULL_STRUCTURE_V2.md",       "book_illuminant", "Иллюминант — полная структура v2", 1),
    (D_BOOKS / "illumunant/FULL_STRUCTURE.md",          "book_illuminant", "Иллюминант — структура v1", 2),
    (D_BOOKS / "illumunant/CHAT_PROGRESS_LOG.md",       "book_illuminant", "Иллюминант — лог прогресса работы", 2),
    (D_BOOKS / "illumunant/STYLE_TRANSFORMATION_SUMMARY.md", "book_illuminant", "Иллюминант — итоги трансформации стиля", 2),
    (D_BOOKS / "illumunant/PROGRESS_CHECKPOINT.md",     "book_illuminant", "Иллюминант — чекпойнт прогресса", 2),
    # Книга I — только структурные/ключевые главы (не весь текст)
    # Полные главы добавляй вручную: python load_memory.py --project illuminant --priority 3
    (D_BOOKS / "illumunant/illuminant_work/Claude/BOOK_1/00_PROLOG.md",  "book_illuminant", "Иллюминант Кн.1 — Пролог", 2),
    (D_BOOKS / "illumunant/illuminant_work/Claude/BOOK_1/11_KATARSIS.md","book_illuminant", "Иллюминант Кн.1 — Гл.11 Катарсис (ключевая)", 2),

    # ─── BOOK_VIRUSVINY — Вирус Вины ──────────────────────────────────────────
    (D_BOOKS / "Vina/Vina_ru/Deepseek/01_MASTER_PLAN_VIRUS_VINY.md", "book_virusviny", "Вирус Вины — мастер-план книги", 1),
    (D_BOOKS / "Vina/Vina_ru/Deepseek/02_VVEDENIE_NEW.md",           "book_virusviny", "Вирус Вины — Введение", 1),
    (D_BOOKS / "Vina/Vina_ru/Deepseek/03_GLAVA_1_NEW.md",            "book_virusviny", "Вирус Вины — Глава 1", 2),
    (D_BOOKS / "Vina/Vina_ru/Deepseek/04_GLAVA_2_NEW.md",            "book_virusviny", "Вирус Вины — Глава 2", 2),
    (D_BOOKS / "Vina/Vina_ru/Deepseek/05_GLAVA_3_NEW.md",            "book_virusviny", "Вирус Вины — Глава 3", 2),
    (D_BOOKS / "Vina/Vina_ru/Deepseek/22_PRILEZHENIE_NEW.md",        "book_virusviny", "Вирус Вины — Приложение", 2),
    # Азербайджанская версия — только первые главы
    (D_BOOKS / "Vina/Vina_az/00_GIRIS_AZ.md",                        "book_virusviny", "Вирус Вины (AZ) — Введение", 3),
    (D_BOOKS / "Vina/Vina_az/01_FESIL_1_AZ.md",                      "book_virusviny", "Вирус Вины (AZ) — Глава 1", 3),

    # ─── BOOK_PSYCH — Психиатрия (только финальные версии, не архивы) ────────────
    (D_BOOKS / "Psychiatrist/Psixiatriya_Tam_Kitab_Final.md",         "book_psych", "Психиатрия — полная книга финал", 1),
    (D_BOOKS / "Psychiatrist/Psixiatriya_Terapiya_Komplekt_2026.md",  "book_psych", "Психиатрия — терапия комплект 2026", 1),
    # Папки Arxiv/, PSYH/, Клиническая Психиатрия/ — НЕ грузим автоматически
    # (сотни файлов, дубли). Добавляй вручную по необходимости.

    # ─── BOOK_SCHIZO ───────────────────────────────────────────────────────────
    (D_BOOKS / "Shizofrenia/Tərcümə_1_Tarix_Şizofreniya.md",          "book_schizo", "Шизофрения — история и перевод", 1),

    # ─── WEB_EVENTCY ──────────────────────────────────────────────────────────
    (D_WEB / "eventcy/README.md",                                      "web_eventcy", "Eventcy — README проекта", 1),
    (CHESSCOIN / ".claude/chats/chat-eventcy.txt",                     "web_eventcy", "Eventcy — концепция платформы знакомств", 1),

    # ─── WEB_IPAS ─────────────────────────────────────────────────────────────
    (D_WEB / "ipas/README.md",                                         "web_ipas", "IPAS — README проекта", 1),

    # ─── CLAUDIA — система ────────────────────────────────────────────────────
    (D_CLAUDIA / "CLAUDIA_MASTER.md",                                  "claudia", "Клаудиа — мастер-гид системы", 1),
    (D_CLAUDIA / "CLAUDIA_SETUP.md",                                   "claudia", "Клаудиа — инструкция по настройке", 1),
    (CHESSCOIN / ".claude/chats/Claudia-about.txt",                    "claudia", "Клаудиа — о проекте", 1),
    (CHESSCOIN / ".claude/chats/chat-illuminant-cowork.txt",           "book_illuminant", "Illuminant Cowork — совместная работа", 2),
]


def chunk_text(text: str, max_chars: int = 6000, overlap: int = 400) -> list[str]:
    """Нарезаем текст на чанки с перекрытием."""
    if len(text) <= max_chars:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = start + max_chars
        if end < len(text):
            cut = text.rfind('\n', start, end)
            if cut > start + overlap:
                end = cut
        chunks.append(text[start:end])
        start = end - overlap
    return chunks


async def get_token(client: httpx.AsyncClient) -> str:
    r = await client.post(
        f"{LIGHTRAG_URL}/login",
        data={"username": USERNAME, "password": PASSWORD},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15
    )
    r.raise_for_status()
    return r.json()["access_token"]


async def insert_doc(client: httpx.AsyncClient, token: str,
                     content: str, description: str, project: str) -> tuple[bool, str]:
    tag = project.upper()
    tagged = f"[ПРОЕКТ: {tag}] {description}\n\n{content}"
    r = await client.post(
        f"{LIGHTRAG_URL}/documents/text",
        json={"text": tagged, "file_source": description},
        headers={"Authorization": f"Bearer {token}"},
        timeout=180
    )
    if r.status_code == 200:
        return True, r.json().get('status', 'ok')
    return False, r.text[:200]


async def main():
    parser = argparse.ArgumentParser(description='Загрузчик памяти в LightRAG')
    parser.add_argument('--project', help='Загрузить только указанный проект (напр: chesscoin, illuminant)')
    parser.add_argument('--priority', type=int, default=3, help='Максимальный приоритет для загрузки (1=только важное, 3=всё)')
    parser.add_argument('--dry-run', action='store_true', help='Только показать что будет загружено')
    args = parser.parse_args()

    # Фильтруем документы
    docs = ALL_DOCS
    if args.project:
        proj_filter = args.project.lower()
        docs = [d for d in docs if proj_filter in d[1].lower()]
    docs = [d for d in docs if d[3] <= args.priority]

    # Считаем только существующие
    existing = [(path, proj, desc, pri) for path, proj, desc, pri in docs if Path(path).exists()]
    missing  = [(path, proj, desc, pri) for path, proj, desc, pri in docs if not Path(path).exists()]

    print(f"\n{'='*60}")
    print(f"Документов к загрузке: {len(existing)}")
    print(f"Не найдено:            {len(missing)}")
    print(f"{'='*60}")

    if missing and not args.project:
        print("\n[!] Не найдены:")
        for path, proj, desc, _ in missing[:10]:
            print(f"  [{proj}] {Path(path).name}")

    if args.dry_run:
        print("\n[>>] Будет загружено:")
        by_project: dict = {}
        for path, proj, desc, pri in existing:
            by_project.setdefault(proj, []).append((Path(path).name, pri))
        for proj, files in sorted(by_project.items()):
            print(f"\n  [{proj.upper()}]")
            for fname, pri in files:
                stars = '*' * pri
                print(f"    {stars}  {fname}")
        return

    # Загружаем
    async with httpx.AsyncClient(timeout=httpx.Timeout(180)) as client:
        print("\nПолучаем токен...")
        token = await get_token(client)
        print("Токен OK")

        total_ok = total_fail = 0
        for path, proj, desc, pri in existing:
            try:
                content = Path(path).read_text(encoding='utf-8', errors='ignore')
            except Exception as e:
                print(f"  [ERR] Чтение {path}: {e}")
                continue

            if len(content) < 50:
                print(f"  [skip] Пустой: {Path(path).name}")
                continue

            chunks = chunk_text(content)
            print(f"\n[{proj.upper()}] {desc}")
            print(f"   {len(content):,} chars -> {len(chunks)} chunk(s)")

            for i, chunk in enumerate(chunks):
                chunk_desc = f"{desc} (ч.{i+1}/{len(chunks)})" if len(chunks) > 1 else desc
                ok, result = await insert_doc(client, token, chunk, chunk_desc, proj)
                status = "[OK]" if ok else "[ERR]"
                print(f"   {status} chunk {i+1}: {str(result)[:80]}")
                if ok:
                    total_ok += 1
                else:
                    total_fail += 1
                if len(chunks) > 1:
                    await asyncio.sleep(0.8)

        print(f"\n{'='*60}")
        print(f"Загружено: {total_ok} | Ошибок: {total_fail}")
        print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
