#!/usr/bin/env python3
"""Read-only DAG scheduler: suggest independent ready tasks, never spawn agents itself."""
from __future__ import annotations
import argparse
import json
from pathlib import PurePosixPath
from check_ownership import canonical_lease
from common import ROOT,dag_errors,load_json

def overlaps(left: list[str],right: list[str]) -> bool:
    for a in left:
        ap=PurePosixPath(a).parts
        for b in right:
            bp=PurePosixPath(b).parts
            if ap==bp[:len(ap)] or bp==ap[:len(bp)]: return True
    return False

def choose(tasks:list[dict],limit:int) -> dict:
    errors=dag_errors(tasks)
    for task in tasks:
        for lease in task.get("paths",[]): canonical_lease(lease)
    if errors: raise ValueError('; '.join(errors))
    if not isinstance(limit,int) or isinstance(limit,bool) or limit<1 or limit>256:
        raise ValueError('Use a verified available slot count in 1..256')
    done={t['id'] for t in tasks if t['status']=='done'}
    active=[t for t in tasks if t['status'] in ('active','review')]
    ready=[t for t in tasks if t['status']=='planned' and set(t['dependsOn']).issubset(done)]
    selected=[]; deferred=[]
    for task in ready:
        if len(selected)>=limit or any(overlaps(task['paths'],other['paths']) for other in active+selected):
            deferred.append(task['id']); continue
        selected.append(task)
    return {'suggested':[{'id':t['id'],'title':t['title'],'role':t['ownerRole'],'paths':t['paths']} for t in selected],
            'active':[t['id'] for t in active],'readyButDeferred':deferred,
            'blocked':[t['id'] for t in tasks if t['status']=='blocked'],
            'note':'Read-only suggestion. Orchestrator verifies semantic coupling and acquires worktree/path ownership before spawning.'}

def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limit',type=int,default=1,help='Available slots already bounded by real runtime and resource capacity')
    args=parser.parse_args()
    print(json.dumps(choose(load_json(ROOT/'harness/tasks.json')['tasks'],args.limit),indent=2))
    return 0
if __name__=='__main__': raise SystemExit(main())
