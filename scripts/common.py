"""Standard-library helpers shared by the executable specification harness."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_PARTS = {'.git', 'node_modules', '__pycache__', '.pytest_cache', 'artifacts', 'dist', 'coverage'}

def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))

def safe_file(root: Path, relative: str) -> Path:
    """Reject traversal, absolute paths and symlinks, including symlink ancestors."""
    if not isinstance(relative, str) or not relative or '\\' in relative:
        raise ValueError('Expected a nonempty portable relative path')
    parts = PurePosixPath(relative)
    if parts.is_absolute() or '..' in parts.parts or ':' in parts.parts[0]:
        raise ValueError('Absolute/traversing paths are not permitted')
    current = root.resolve()
    for part in parts.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError('Symlink paths are not permitted')
    resolved = current.resolve()
    if not resolved.is_relative_to(root.resolve()):
        raise ValueError('Path escapes repository')
    return resolved

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def export_files(root: Path) -> list[Path]:
    """Public kit tree only; do not export local credentials, model config or build state."""
    selected: list[Path] = []
    for path in sorted(root.rglob('*')):
        relative = path.relative_to(root)
        if any(part in EXCLUDED_PARTS for part in relative.parts):
            continue
        if path.is_symlink():
            raise ValueError(f'Refusing symlink: {relative}')
        if not path.is_file():
            continue
        if path.name.startswith('.env') and path.name != '.env.example':
            continue
        if relative.as_posix() == '.codex/config.toml':
            continue
        if relative.parts[:2] == ('.codex', 'agents') and path.suffix == '.toml':
            continue
        if path.suffix in {'.pem', '.key', '.p12', '.pfx'}:
            raise ValueError(f'Refusing credential-like file: {relative}')
        selected.append(path)
    return selected

# Mutable evidence is deliberately omitted; acceptance and test definitions are not.
BOOKKEEPING = {'status', 'evidence', 'review', 'startedAt', 'completedAt', 'progress', 'assignedTo', 'notes'}
CRITERIA_FILES = {'tasks.json', 'components.json', 'requirements.json', 'scenarios.json'}

def without_bookkeeping(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: without_bookkeeping(v) for k, v in value.items() if k not in BOOKKEEPING}
    if isinstance(value, list):
        return [without_bookkeeping(v) for v in value]
    return value

def candidate_digest(root: Path) -> str:
    """Bind evidence to source, design, build config, commands and acceptance criteria.

    Excludes evidence/status bookkeeping to avoid circular hashes. This is a freshness
    detector, not tamper-proof attestation; external CI and review remain required.
    """
    source_roots = {'packages', 'apps', 'examples', 'contracts', 'fixtures', 'scripts',
                    'tests', 'deploy', 'design', 'schemas', '.github'}
    root_files = {'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json',
                  '.npmrc', '.node-version', '.nvmrc', 'AGENTS.md', 'KIT-REVISION.json', 'MASTER-SOT.md'}
    h = hashlib.sha256()
    for path in export_files(root):
        relative = path.relative_to(root)
        name = relative.as_posix()
        payload = None
        if relative.parts[:1] == ('harness',) and path.name in CRITERIA_FILES:
            payload = json.dumps(without_bookkeeping(load_json(path)), sort_keys=True,
                                 separators=(',', ':'), ensure_ascii=False).encode()
        elif name == 'harness/product-commands.json':
            payload = path.read_bytes()
        elif relative.parts[0] in source_roots or name in root_files or (
                len(relative.parts) == 1 and ('.config.' in path.name or
                path.name.startswith(('PROMPT-', 'tsconfig.')))):
            payload = path.read_bytes()
        elif relative.parts[0] == 'docs' and len(relative.parts) > 1 and (
                relative.parts[1][0:2].isdigit() or relative.parts[1] == 'adr'):
            payload = path.read_bytes()
        if payload is not None:
            h.update(name.encode() + b'\0' + hashlib.sha256(payload).digest())
    return h.hexdigest()

def dag_errors(tasks: Iterable[dict[str, Any]]) -> list[str]:
    rows = list(tasks)
    ids = [row['id'] for row in rows]
    errors: list[str] = []
    if len(ids) != len(set(ids)):
        errors.append('Duplicate task identifiers')
    graph = {row['id']: row.get('dependsOn', []) for row in rows}
    for key, dependencies in graph.items():
        for dep in dependencies:
            if dep not in graph:
                errors.append(f'{key} depends on missing {dep}')
    active: set[str] = set()
    done: set[str] = set()
    def visit(key: str) -> None:
        if key in active:
            raise ValueError(f'Task dependency cycle at {key}')
        if key in done or key not in graph:
            return
        active.add(key)
        for dep in graph[key]:
            visit(dep)
        active.remove(key)
        done.add(key)
    try:
        for key in graph:
            visit(key)
    except ValueError as exc:
        errors.append(str(exc))
    return errors
