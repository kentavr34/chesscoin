"""
Загрузка архивов старых версий на сервер.

Что делает:
  - Берёт zip/rar архивы из локальных папок
  - Загружает на сервер в /opt/{project}/.versions/archive/
  - Создаёт INDEX.json с картой всех версий
  - НЕ загружает node_modules, dist, build внутри архивов

Запуск:
  python upload_archives.py                  — все проекты
  python upload_archives.py --project chess  — только chesscoin
  python upload_archives.py --dry-run        — показать что будет
"""
import os
import sys
import json
import subprocess
import argparse
from pathlib import Path
from datetime import datetime

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ─── SSH ──────────────────────────────────────────────────────────────────────
SSH_KEY  = "C:/Users/SAM/.ssh/claude_deploy_key"
SSH_PORT = "2222"
SSH_HOST = "root@37.77.106.28"
SCP_BASE = f"scp -i {SSH_KEY} -P {SSH_PORT} -o StrictHostKeyChecking=no"
SSH_BASE = f"ssh -i {SSH_KEY} -p {SSH_PORT} -o StrictHostKeyChecking=no {SSH_HOST}"

# ─── Карта архивов ────────────────────────────────────────────────────────────
# (локальный файл, проект, версия/описание)
ARCHIVES = [
    # ChessCoin — история версий
    ("D:/CHESSMATE/Old/chesscoin-main.zip",        "chesscoin", "v_main_original",    "Оригинальный main"),
    ("D:/CHESSMATE/Old/chesscoin-v606-FULL.zip",   "chesscoin", "v6.0.6-FULL",        "ChessCoin v6.0.6 полная"),
    ("D:/CHESSMATE/Old/chesscoin-v606-fixed-1.zip","chesscoin", "v6.0.6-fixed",       "ChessCoin v6.0.6 исправленная"),
    ("D:/CHESSMATE/Old/chesscoin-v607.zip",        "chesscoin", "v6.0.7",             "ChessCoin v6.0.7"),
    ("D:/CHESSMATE/Old/chesscoin-v7.1.8.zip",      "chesscoin", "v7.1.8",             "ChessCoin v7.1.8"),
    ("D:/CHESSMATE/Old/chesscoin-v7.2.0.zip",      "chesscoin", "v7.2.0",             "ChessCoin v7.2.0"),
    ("D:/CHESSMATE/Old/jarvis-full-upgrade.zip",   "chesscoin", "jarvis-upgrade",     "Jarvis полный апгрейд"),
    # Chessgamewars — отдельный проект
    ("D:/CHESSMATE/chessgamewars",                 "chesscoin",     "chessgamewars-src", "ChessGameWars исходники"),
]


def run_ssh(cmd: str) -> tuple[int, str]:
    r = subprocess.run(
        f'{SSH_BASE} "{cmd}"',
        shell=True, capture_output=True, text=True, timeout=30
    )
    return r.returncode, (r.stdout + r.stderr).strip()


def scp_upload(local: str, remote: str) -> tuple[int, str]:
    r = subprocess.run(
        f'{SCP_BASE} "{local}" {SSH_HOST}:{remote}',
        shell=True, capture_output=True, text=True, timeout=120
    )
    return r.returncode, (r.stdout + r.stderr).strip()


def get_size_mb(path: str) -> float:
    try:
        return Path(path).stat().st_size / 1024 / 1024
    except:
        return 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', help='Фильтр по проекту')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    archives = ARCHIVES
    if args.project:
        archives = [a for a in archives if args.project.lower() in a[1].lower()]

    # Только существующие файлы
    existing = [(p, proj, ver, desc) for p, proj, ver, desc in archives if Path(p).exists()]
    missing  = [(p, proj, ver, desc) for p, proj, ver, desc in archives if not Path(p).exists()]

    total_mb = sum(get_size_mb(p) for p, *_ in existing)

    print(f"\n{'='*60}")
    print(f"Архивов к загрузке: {len(existing)}")
    print(f"Не найдено:         {len(missing)}")
    print(f"Объём:              {total_mb:.1f} MB")
    print(f"{'='*60}")

    if missing:
        print("\n[!] Не найдены:")
        for p, proj, ver, desc in missing:
            print(f"  {Path(p).name}")

    if args.dry_run:
        print("\n[>>] Будет загружено:")
        for p, proj, ver, desc in existing:
            mb = get_size_mb(p)
            print(f"  [{proj}] {ver:20s}  {mb:.1f}MB  {desc}")
        return

    # Группируем по проектам
    by_project: dict = {}
    for p, proj, ver, desc in existing:
        by_project.setdefault(proj, []).append((p, ver, desc))

    for proj, items in by_project.items():
        archive_dir = f"/opt/{proj}/.versions/archive"
        print(f"\n[DIR] Создаём {archive_dir}...")
        rc, out = run_ssh(f"mkdir -p {archive_dir}")
        if rc != 0:
            print(f"  [ERR] {out}")
            continue

        index = []
        for local_path, ver, desc in items:
            fname = Path(local_path).name
            remote = f"{archive_dir}/{fname}"
            mb = get_size_mb(local_path)
            print(f"\n  [ZIP] {ver} ({mb:.1f}MB) -- {fname}")

            rc, out = scp_upload(local_path, remote)
            if rc == 0:
                print(f"     [OK] загружен")
                index.append({
                    "version": ver,
                    "file": fname,
                    "description": desc,
                    "size_mb": round(mb, 2),
                    "uploaded_at": datetime.now().isoformat()
                })
            else:
                print(f"     [ERR] {out[:200]}")

        # Записываем INDEX.json на сервер
        if index:
            index_json = json.dumps(index, ensure_ascii=False, indent=2)
            rc, out = run_ssh(
                f"cat > {archive_dir}/INDEX.json << 'EOFINDEX'\n{index_json}\nEOFINDEX"
            )
            if rc != 0:
                escaped = index_json.replace("'", "'\"'\"'")
                run_ssh(f"echo '{escaped}' > {archive_dir}/INDEX.json")
            print(f"\n  [INDEX] INDEX.json записан ({len(index)} записей)")

    print(f"\n{'='*60}")
    print("Готово. На сервере: /opt/{project}/.versions/archive/")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
