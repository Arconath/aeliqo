#!/usr/bin/env python3
"""Read-only validation of the final-v3 planning pack, NOT Aeliqo product tests.

Uses only Python's standard library. Hashes detect changes to the handoff;
they are not a publisher signature. No extraction or network access occurs.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import zipfile


class PackError(ValueError):
    """A concrete inconsistency in the handoff pack."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise PackError(message)


def safe_relative(name: str) -> bool:
    p = PurePosixPath(name)
    return bool(name) and not p.is_absolute() and '..' not in p.parts and '\\' not in name and ':' not in name and str(p) == name


def load_json(path: Path) -> dict:
    data = json.loads(path.read_text(encoding='utf-8'))
    require(isinstance(data, dict), f'Expected JSON object: {path.name}')
    return data


def read_text(root: Path, name: str) -> str:
    require(safe_relative(name), f'Unsafe file reference: {name}')
    path = root / name
    require(path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(root.resolve()), f'Missing/unsafe file: {name}')
    return path.read_text(encoding='utf-8')


def check_structure(root: Path) -> dict:
    index = load_json(root / 'PLAN-INDEX.json')
    require(index.get('pack_version') == 'final-v3', 'Wrong plan version')
    tasks = index['tasks']
    requirements = index['requirements']
    task_ids = [t['id'] for t in tasks]
    rq_ids = [r['id'] for r in requirements]
    require(task_ids == [f'T{i:02d}' for i in range(22)], 'Task IDs/count must be T00-T21')
    require(rq_ids == [f'RQ{i:02d}' for i in range(1, 47)], 'Requirement IDs/count must be RQ01-RQ46')
    by_task = {t['id']: t for t in tasks}
    by_rq = {r['id']: r for r in requirements}
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(task_id: str) -> None:
        require(task_id in by_task, f'Unknown dependency: {task_id}')
        require(task_id not in visiting, f'Dependency cycle at {task_id}')
        if task_id in visited:
            return
        visiting.add(task_id)
        deps = by_task[task_id]['depends_on']
        require(len(deps) == len(set(deps)), f'Duplicate dependency: {task_id}')
        for dep in deps:
            visit(dep)
        visiting.remove(task_id)
        visited.add(task_id)

    for task_id in task_ids:
        visit(task_id)
    plan = read_text(root, '02-EXECPLAN.md')
    sections = re.findall(r'^## (T\d{2}) — ([^\n]+)\n(.*?)(?=^## T\d{2} — |\Z)', plan, re.M | re.S)
    require([s[0] for s in sections] == task_ids, 'Plan task headings disagree with index')
    for task_id, title, text in sections:
        require(title == by_task[task_id]['title'], f'Task title mismatch: {task_id}')
        match = re.search(r'\*\*Requirements:\*\* (.*?)\. \*\*Dependencies:\*\* (.*?)\.', text)
        require(match is not None, f'Missing task contract: {task_id}')
        reqs = re.findall(r'RQ\d{2}', match[1])
        deps = re.findall(r'T\d{2}', match[2])
        require(reqs == by_task[task_id]['requirements'], f'Task requirement mismatch: {task_id}')
        require(deps == by_task[task_id]['depends_on'], f'Task dependency mismatch: {task_id}')
        require('- [ ]' in text and '```' in text, f'Missing steps or concrete code: {task_id}')
        for rq in reqs:
            require(rq in by_rq and by_rq[rq]['owner'] == task_id, f'Wrong primary owner for {rq}')
    acceptance = read_text(root, '03-ACCEPTANCE.md')
    rows = re.findall(r'^\| (RQ\d{2}) \| (.*?) \| (T\d{2}) \| (.*?) \|$', acceptance, re.M)
    require([r[0] for r in rows] == rq_ids, 'Acceptance rows do not cover RQ01-RQ46 once')
    for rq, description, owner, evidence in rows:
        item = by_rq[rq]
        require(owner == item['owner'] and rq in by_task[owner]['requirements'], f'Unowned requirement: {rq}')
        require(description == item['requirement'], f'Requirement text drift: {rq}')
        require(evidence == item['required_evidence'], f'Evidence text drift: {rq}')
    checkpoint = read_text(root, '07-EXECUTION-STATE.md')
    recorded = re.findall(r'^\| (T\d{2}) \| (.*?) \|', checkpoint, re.M)
    require([t for t, _ in recorded] == task_ids, 'Checkpoint task mapping drift')
    require(all(s == 'not-started' for _, s in recorded), 'Handoff unexpectedly claims product execution')
    for path in sorted(root.glob('*.md')):
        text = path.read_text(encoding='utf-8')
        fences = re.findall(r'^(`{3,}|~{3,})[^\n]*$', text, re.M)
        require(len(fences) % 2 == 0, f'Unclosed code fence: {path.name}')
        for i in range(0, len(fences), 2):
            require(fences[i] == fences[i+1], f'Mismatched fences: {path.name}')
        for link in re.findall(r'\]\(([^)]+)\)', text):
            if '://' not in link and not link.startswith('#'):
                target = link.split('#', 1)[0]
                require(safe_relative(target) and (path.parent / target).is_file(), f'Broken local link: {path.name}: {target}')
    for name in ['00-START-HERE.md', '05-CODEX-PROMPT.md']:
        text = read_text(root, name)
        require('aeliqo-vnext-final-v3.zip' in text, f'Missing final archive name: {name}')
        require('aeliqo-vnext-execution-pack.zip' not in text and 'execution-pack-v2.zip' not in text, f'Obsolete archive name: {name}')
    probe = read_text(root, 'contracts/contract-probe.ts')
    require('DECLARATION-ONLY DESIGN PROBE, NOT AELIQO IMPLEMENTATION' in probe, 'Probe missing status boundary')
    require(probe.count('@ts-expect-error') == 8, 'Design negative-case count drift')
    return {'tasks': len(task_ids), 'requirements': len(rq_ids), 'dependency_graph': 'acyclic', 'design_negative_cases': 8}


def check_manifest(root: Path) -> dict:
    manifest = load_json(root / 'MANIFEST.json')
    require(manifest.get('source_reference') == load_json(root / 'PLAN-INDEX.json')['source_reference'], 'Source reference drift')
    require(manifest.get('pack_version') == 'final-v3', 'Manifest version mismatch')
    require(manifest.get('task_count') == 22 and manifest.get('requirement_count') == 46, 'Manifest counts drift')
    entries = manifest['files']
    names = [item['path'] for item in entries]
    require(len(names) == len(set(names)), 'Duplicate manifest path')
    require('MANIFEST.json' not in names, 'Manifest cannot contain its own hash')
    for item in entries:
        name = item['path']
        require(safe_relative(name), f'Unsafe manifest path: {name}')
        path = root / name
        require(path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(root.resolve()), f'Missing/unsafe manifest file: {name}')
        payload = path.read_bytes()
        require(len(payload) == item['bytes'], f'Byte length mismatch: {name}')
        require(hashlib.sha256(payload).hexdigest() == item['sha256'], f'SHA256 mismatch: {name}')
    all_paths = list(root.rglob('*'))
    require(not any(p.is_symlink() for p in all_paths), 'Symlink found in pack')
    actual = {p.relative_to(root).as_posix() for p in all_paths if p.is_file()}
    require(actual == set(names) | {'MANIFEST.json'}, 'File inventory differs from manifest')
    return {'hashed_files': len(names), 'manifest': 'verified', 'hash_is_not_a_signature': True}


def check_archive(root: Path, archive: Path) -> dict:
    manifest = load_json(root / 'MANIFEST.json')
    prefix = manifest['archive_root'] + '/'
    require(safe_relative(manifest['archive_root']), 'Unsafe archive root')
    with zipfile.ZipFile(archive) as zf:
        entries = zf.infolist()
        names = [item.filename for item in entries]
        require(len(entries) <= 100 and len(names) == len(set(names)), 'Archive duplicates or excessive entry count')
        require(sum(x.file_size for x in entries) <= 20 * 1024 * 1024, 'Archive exceeds handoff size bound')
        require(zf.testzip() is None, 'Archive CRC failed')
        expected = {prefix + row['path'] for row in manifest['files']} | {prefix + 'MANIFEST.json'}
        require(set(names) == expected, 'Archive inventory mismatch')
        for entry in entries:
            name = entry.filename
            require(safe_relative(name) and name.startswith(prefix), f'Unsafe archive path: {name}')
            require(stat.S_IFMT(entry.external_attr >> 16) != stat.S_IFLNK, f'Archive symlink: {name}')
            rel = name[len(prefix):]
            require(zf.read(entry) == (root / rel).read_bytes(), f'Archive/disk mismatch: {rel}')
    return {'archive_entries': len(names), 'archive_crc_and_payload': 'verified'}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument('--archive', type=Path, help='Optional ZIP to compare without extracting')
    args = parser.parse_args()
    try:
        result = {'pack_status': 'valid', 'product_status': 'NOT EXECUTED'}
        result.update(check_structure(args.root))
        result.update(check_manifest(args.root))
        if args.archive:
            result.update(check_archive(args.root, args.archive))
        print(json.dumps(result, indent=2))
        return 0
    except (PackError, OSError, ValueError, KeyError, TypeError, zipfile.BadZipFile) as error:
        print(json.dumps({'pack_status': 'invalid', 'error': str(error)}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
