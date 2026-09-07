#!/usr/bin/env python3
"""Check an explicit task's changed paths. Does not acquire locks or alter Git."""
from __future__ import annotations
import argparse
import sys
from pathlib import Path, PurePosixPath
from common import ROOT, load_json, safe_file

def canonical_lease(value: str) -> tuple[str, ...]:
    if not isinstance(value, str) or not value or '\\' in value:
        raise ValueError('Lease must be a nonempty portable relative path')
    p=PurePosixPath(value)
    if p.is_absolute() or '..' in p.parts or not p.parts or ':' in p.parts[0] or value in ('.','./'):
        raise ValueError('Unsafe ownership path')
    if p.parts[0]=='packages' and len(p.parts)>2 and p.parts[2]!='src' and len(p.parts)>3:
        raise ValueError('Nested package implementation leases must include src')
    if p.parts[0]=='packages' and len(p.parts)==3 and p.parts[2] not in {'src','package.json','tsconfig.json','README.md'}:
        raise ValueError('Package module lease must point into src; lease whole package explicitly when needed')
    return p.parts

def ownership_errors(root: Path, task: dict, changes: list[str]) -> list[str]:
    leases=[canonical_lease(v) for v in task.get('paths',[])]
    if not leases:return ['Task has no path leases']
    errors=[]
    for change in changes:
        try:
            resolved=safe_file(root,change)
            parts=resolved.relative_to(root.resolve()).parts
            if not any(parts[:len(lease)]==lease for lease in leases):
                errors.append('Outside task ownership: '+change)
        except ValueError as exc:errors.append(str(exc)+': '+change)
    return errors

def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--task',required=True)
    parser.add_argument('--paths',nargs='+',required=True)
    args=parser.parse_args()
    try:
        task=next((t for t in load_json(ROOT/'harness/tasks.json')['tasks'] if t['id']==args.task),None)
        if task is None:raise ValueError('Unknown task')
        errors=ownership_errors(ROOT,task,args.paths)
        if errors:print('\n'.join(errors),file=sys.stderr);return 1
        print('Ownership paths match. Worktree exclusivity and semantic review are still required.');return 0
    except (OSError,ValueError,KeyError,TypeError) as exc:print('OWNERSHIP REFUSED:',exc,file=sys.stderr);return 1
if __name__=='__main__':raise SystemExit(main())
