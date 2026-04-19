"""
Version Manager v1.0 — система версий проектов Клаудии.

Логика:
  1. Перед задачей: snapshot текущего состояния → архив с меткой версии+даты
  2. После задачи: новая версия → git tag + запись в PROJECT.json
  3. Откат: восстановление из архива или git checkout tag

Использование:
  from version_manager import VersionManager
  vm = VersionManager('/opt/chesscoin')
  vm.snapshot('before task-5')          # архивируем текущее
  # ... работа аидера ...
  vm.release('7.2.1', 'task-5: fix X')  # фиксируем новую версию
  vm.rollback('v7.1.2')                 # откат
"""
import os
import json
import shutil
import subprocess
import logging
from datetime import datetime, date
from pathlib import Path

log = logging.getLogger(__name__)


class VersionManager:
    def __init__(self, project_dir: str):
        self.dir = Path(project_dir)
        self.archive_dir = self.dir / '.versions'
        self.archive_dir.mkdir(exist_ok=True)
        self.project_json = self.dir / 'PROJECT.json'
        self._ensure_project_json()

    # ── PROJECT.json ──────────────────────────────────────────────────────────

    def _ensure_project_json(self):
        """Создаёт PROJECT.json если не существует."""
        if self.project_json.exists():
            return
        name = self.dir.name
        # Определяем версию из package.json если есть
        ver = self._detect_version()
        data = {
            "name": name,
            "version": ver,
            "created": date.today().isoformat(),
            "description": "",
            "changelog": []
        }
        self._write_json(data)

    def _detect_version(self) -> str:
        """Пытается найти текущую версию из package.json или git тегов."""
        # package.json
        for pj in [self.dir / 'backend' / 'package.json',
                   self.dir / 'frontend' / 'package.json',
                   self.dir / 'package.json']:
            if pj.exists():
                try:
                    with open(pj) as f:
                        return json.load(f).get('version', '0.1.0')
                except Exception:
                    pass
        # git tag
        try:
            r = subprocess.run(['git', 'describe', '--tags', '--abbrev=0'],
                cwd=self.dir, capture_output=True, text=True, timeout=5)
            if r.returncode == 0 and r.stdout.strip():
                return r.stdout.strip().lstrip('v')
        except Exception:
            pass
        return '0.1.0'

    def read(self) -> dict:
        try:
            with open(self.project_json) as f:
                return json.load(f)
        except Exception:
            return {}

    def _write_json(self, data: dict):
        with open(self.project_json, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def current_version(self) -> str:
        return self.read().get('version', '0.1.0')

    # ── Снимок (перед задачей) ────────────────────────────────────────────────

    def snapshot(self, reason: str = '') -> str:
        """Сохраняет снимок текущего состояния в .versions/ перед изменениями."""
        data = self.read()
        ver = data.get('version', '0.1.0')
        ts = datetime.now().strftime('%Y%m%d_%H%M')
        snap_name = f"v{ver}_{ts}"
        snap_dir = self.archive_dir / snap_name

        # Для git-проектов — сохраняем хэш коммита
        git_hash = ''
        try:
            r = subprocess.run(['git', 'rev-parse', 'HEAD'],
                cwd=self.dir, capture_output=True, text=True, timeout=5)
            if r.returncode == 0:
                git_hash = r.stdout.strip()[:8]
        except Exception:
            pass

        # Сохраняем метаданные снимка
        snap_meta = {
            'version': ver,
            'snapshot': snap_name,
            'date': datetime.now().isoformat(),
            'reason': reason,
            'git_hash': git_hash,
        }
        snap_dir.mkdir(parents=True, exist_ok=True)
        with open(snap_dir / 'SNAPSHOT.json', 'w', encoding='utf-8') as f:
            json.dump(snap_meta, f, ensure_ascii=False, indent=2)

        # Копируем ключевые файлы (не node_modules, не .git, не dist)
        COPY_PATTERNS = ['*.json', '*.md', '*.env*', '*.yml', '*.yaml', '*.ini', '*.conf']
        SKIP_DIRS = {'.git', 'node_modules', 'dist', 'build', '__pycache__',
                     '.venv', 'venv', '.versions', 'postgres_data'}
        self._copy_tree(self.dir, snap_dir / 'files', skip_dirs=SKIP_DIRS,
                        max_depth=3, max_size_mb=50)

        log.info(f'[VersionManager] Snapshot {snap_name}: {reason}')
        return snap_name

    def _copy_tree(self, src: Path, dst: Path, skip_dirs: set,
                   max_depth: int, max_size_mb: int, _depth: int = 0):
        """Рекурсивно копирует дерево с ограничениями."""
        if _depth > max_depth:
            return
        total_mb = 0
        for item in src.iterdir():
            if item.name.startswith('.') and item.name not in {'.env', '.env.prod'}:
                continue
            if item.is_dir():
                if item.name in skip_dirs:
                    continue
                self._copy_tree(item, dst / item.name, skip_dirs, max_depth,
                               max_size_mb, _depth + 1)
            elif item.is_file():
                size_mb = item.stat().st_size / 1024 / 1024
                if size_mb > 5:  # пропускаем файлы > 5MB
                    continue
                total_mb += size_mb
                if total_mb > max_size_mb:
                    break
                (dst).mkdir(parents=True, exist_ok=True)
                try:
                    shutil.copy2(item, dst / item.name)
                except Exception:
                    pass

    # ── Релиз (после задачи) ──────────────────────────────────────────────────

    def release(self, new_version: str, message: str, task_id: int = None) -> bool:
        """Фиксирует новую версию: обновляет PROJECT.json + git tag."""
        data = self.read()
        old_ver = data.get('version', '0.1.0')

        # Обновляем PROJECT.json
        if 'changelog' not in data:
            data['changelog'] = []
        data['changelog'].insert(0, {
            'version': new_version,
            'date': date.today().isoformat(),
            'prev_version': old_ver,
            'message': message,
            'task_id': task_id,
        })
        data['version'] = new_version
        data['updated_at'] = datetime.now().isoformat()
        self._write_json(data)

        # Git tag
        tag = f'v{new_version}'
        try:
            subprocess.run(['git', 'add', 'PROJECT.json'], cwd=self.dir,
                         capture_output=True, timeout=10)
            subprocess.run(['git', 'commit', '-m', f'chore: версия {new_version} — {message}'],
                         cwd=self.dir, capture_output=True, timeout=15)
            subprocess.run(['git', 'tag', '-a', tag, '-m', message],
                         cwd=self.dir, capture_output=True, timeout=10)
            log.info(f'[VersionManager] Git tag {tag} создан')
        except Exception as e:
            log.warning(f'[VersionManager] Git tag: {e}')

        log.info(f'[VersionManager] Release {old_ver} → {new_version}: {message}')
        return True

    # ── Откат ─────────────────────────────────────────────────────────────────

    def rollback(self, version_or_snapshot: str) -> tuple[bool, str]:
        """Откат к версии. version_or_snapshot — 'v7.1.2' или имя снимка."""
        # Пробуем git
        try:
            tag = version_or_snapshot if version_or_snapshot.startswith('v') else f'v{version_or_snapshot}'
            r = subprocess.run(['git', 'checkout', tag],
                cwd=self.dir, capture_output=True, text=True, timeout=30)
            if r.returncode == 0:
                return True, f'git checkout {tag} выполнен'
        except Exception:
            pass

        # Пробуем снимок
        snap = self.archive_dir / version_or_snapshot
        if snap.exists() and (snap / 'SNAPSHOT.json').exists():
            files_dir = snap / 'files'
            if files_dir.exists():
                # Копируем обратно (только конфиги, не код)
                for f in files_dir.rglob('PROJECT.json'):
                    dst = self.dir / f.relative_to(files_dir)
                    shutil.copy2(f, dst)
                return True, f'Снимок {version_or_snapshot} восстановлен'
        return False, f'Версия {version_or_snapshot} не найдена'

    # ── Статус ────────────────────────────────────────────────────────────────

    def status(self) -> dict:
        """Возвращает полный статус версий проекта."""
        data = self.read()
        snapshots = []
        if self.archive_dir.exists():
            for d in sorted(self.archive_dir.iterdir(), reverse=True)[:10]:
                if d.is_dir() and (d / 'SNAPSHOT.json').exists():
                    try:
                        with open(d / 'SNAPSHOT.json') as f:
                            snapshots.append(json.load(f))
                    except Exception:
                        pass

        # Git теги
        git_tags = []
        try:
            r = subprocess.run(['git', 'tag', '-l', '--sort=-version:refname'],
                cwd=self.dir, capture_output=True, text=True, timeout=5)
            if r.returncode == 0:
                git_tags = r.stdout.strip().split('\n')[:10]
        except Exception:
            pass

        return {
            'project': data.get('name', self.dir.name),
            'current_version': data.get('version', '?'),
            'updated_at': data.get('updated_at', ''),
            'changelog': data.get('changelog', [])[:5],
            'snapshots': snapshots[:5],
            'git_tags': [t for t in git_tags if t],
        }

    def status_text(self) -> str:
        """Читаемый статус для Telegram."""
        s = self.status()
        lines = [
            f"📦 <b>{s['project']}</b> v{s['current_version']}",
            f"🕐 {s['updated_at'][:10] if s['updated_at'] else '—'}",
        ]
        if s['changelog']:
            lines.append('\n<b>Последние изменения:</b>')
            for c in s['changelog'][:3]:
                lines.append(f"  • v{c['version']} {c['date']}: {c['message'][:60]}")
        if s['git_tags']:
            lines.append(f"\n<b>Git теги:</b> {', '.join(s['git_tags'][:5])}")
        if s['snapshots']:
            lines.append(f"\n<b>Снимки:</b> {len(s['snapshots'])} в архиве")
        return '\n'.join(lines)


# ── Реестр всех проектов ─────────────────────────────────────────────────────

PROJECTS = {
    'chesscoin':  '/opt/chesscoin',
    'illuminant': '/opt/illuminant',
    'claudia':    '/root/claudia',
}


def get_version_manager(project: str) -> VersionManager | None:
    path = PROJECTS.get(project.lower())
    if not path or not Path(path).exists():
        return None
    return VersionManager(path)


def all_projects_status() -> str:
    """Статус всех проектов одним текстом."""
    lines = ['<b>📋 Все проекты:</b>\n']
    for name, path in PROJECTS.items():
        if not Path(path).exists():
            lines.append(f"• {name}: ⚠ не найден ({path})")
            continue
        try:
            vm = VersionManager(path)
            s = vm.status()
            cl = s['changelog'][0] if s['changelog'] else {}
            last = f" — {cl.get('message','')[:50]}" if cl else ''
            lines.append(f"• <b>{name}</b> v{s['current_version']}{last}")
        except Exception as e:
            lines.append(f"• {name}: ошибка ({e})")
    return '\n'.join(lines)


if __name__ == '__main__':
    # Инициализация PROJECT.json для всех проектов
    import sys
    for name, path in PROJECTS.items():
        if not Path(path).exists():
            print(f'Skip {name}: {path} not found')
            continue
        vm = VersionManager(path)
        print(f'\n=== {name} ===')
        print(vm.status_text())
