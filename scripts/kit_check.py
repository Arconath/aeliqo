#!/usr/bin/env python3
"""Check document/manifest consistency. This does NOT test the future UI runtime."""
from __future__ import annotations
import re
import sys
from pathlib import Path
from urllib.parse import unquote
from check_ownership import canonical_lease
from common import ROOT, dag_errors, export_files, load_json, safe_file

REQUIRED = ['MASTER-SOT.md','docs/37-model-failure-containment.md','docs/38-public-site-docs-playground.md','docs/39-discussion-ledger.md','docs/40-current-research.md','docs/41-engineering-operating-standard.md','README.md','AGENTS.md','PROMPT-START.md','START-HERE.id.md',
            'docs/00-decisions.md','docs/01-architecture.md','docs/25-traceability.md',
            'docs/29-component-contracts.md','contracts/reference.ts',
            'scripts/gate.py','scripts/publish_git.py','scripts/bootstrap.py',
            'scripts/configure_agents.py','fixtures/hr/raw.json','fixtures/hr/expected.json']

def validate(root: Path) -> tuple[list[str], dict[str,int]]:
    errors: list[str] = []
    for relative in REQUIRED:
        if not safe_file(root, relative).is_file():
            errors.append('Missing required file: '+relative)
    try:
        tasks = load_json(root/'harness/tasks.json')['tasks']
        components = load_json(root/'harness/components.json')['components']
        requirements = load_json(root/'harness/requirements.json')['requirements']
        scenarios = load_json(root/'harness/scenarios.json')['scenarios']
    except (OSError, ValueError, KeyError) as exc:
        return errors+[f'Invalid manifest: {exc}'], {}
    errors += dag_errors(tasks)
    revision = load_json(root/'KIT-REVISION.json')
    if revision.get('productTarget') != '0.1.0': errors.append('Master product target must be 0.1.0')
    if load_json(root/'harness/tasks.json').get('target') != '0.1.0': errors.append('Task target drift')
    if (root/'AGENTS.md').stat().st_size > 28000: errors.append('Root AGENTS exceeds project context budget')
    tids={t['id'] for t in tasks}
    sids={s['id'] for s in scenarios}
    for title, rows in [('component',components),('requirement',requirements),('scenario',scenarios)]:
        ids=[row['id'] for row in rows]
        if title in {'requirement','scenario'}:
            prefix = 'R' if title=='requirement' else 'S'
            if any(not isinstance(i,str) or not re.fullmatch(prefix+r'\d{2}',i) for i in ids):
                errors.append(f'Invalid stable {title} identifier')
        if len(ids)!=len(set(ids)):
            errors.append(f'Duplicate {title} identifiers')
    for task in tasks:
        if task.get('status') not in {'planned','active','blocked','review','done'}:
            errors.append(f'Invalid task status: {task["id"]}')
        if not task.get('acceptance') or not task.get('paths'):
            errors.append(f'Task lacks acceptance/ownership: {task["id"]}')
        if task.get('stage') not in {'ready','release'}:
            errors.append('Invalid gate stage: '+task['id'])
        for lease in task.get('paths',[]):
            try: canonical_lease(lease)
            except ValueError as exc: errors.append(task['id']+': '+str(exc))
    for component in components:
        if not component.get('contract') or component.get('license')!='Apache-2.0':
            errors.append(f'Invalid owned component contract: {component["id"]}')
        if component.get('requiredFor')!='0.1.0':
            errors.append(f'Unexpected catalog release: {component["id"]}')
    for req in requirements:
        if not safe_file(root,req['doc']).is_file():
            errors.append(f'Missing requirement specification: {req["id"]}')
        if not req['tasks'] or any(t not in tids for t in req['tasks']):
            errors.append(f'Invalid requirement tasks: {req["id"]}')
        if not req['scenarios'] or any(s not in sids for s in req['scenarios']):
            errors.append(f'Invalid requirement scenarios: {req["id"]}')
    for scenario in scenarios:
        if scenario.get('stage','ready') not in {'ready','release'}:
            errors.append('Invalid scenario stage: '+scenario['id'])
        if scenario['task'] not in tids:
            errors.append(f'Invalid scenario task: {scenario["id"]}')
    files=export_files(root)
    for path in files:
        if path.suffix=='.json':
            try: load_json(path)
            except ValueError as exc: errors.append(f'Invalid JSON {path}: {exc}')
        if path.suffix != '.md': continue
        text=path.read_text(encoding='utf-8')
        # Ignore fenced code, where hypothetical filenames and links are examples.
        prose=re.sub(r'```.*?```','',text,flags=re.S)
        for target in re.findall(r'(?<!!)\[[^\]]+\]\(([^)]+)\)',prose):
            target=target.split(' "',1)[0]
            if re.match(r'^[a-zA-Z][\w+.-]*:',target) or target.startswith('#'):
                continue
            target=unquote(target.split('#',1)[0])
            if not target: continue
            resolved=(path.parent/target).resolve()
            if not resolved.is_relative_to(root.resolve()) or not resolved.exists():
                errors.append(f'Broken local link {path.relative_to(root)} -> {target}')
    return errors,{'files':len(files),'tasks':len(tasks),'components':len(components),
                   'requirements':len(requirements),'scenarios':len(scenarios)}

def main() -> int:
    try: errors,counts=validate(ROOT)
    except (OSError,ValueError,KeyError,TypeError) as exc:
        print('KIT CHECK FAILED:',exc,file=sys.stderr); return 1
    if errors:
        print('\n'.join(errors),file=sys.stderr); return 1
    print('KIT CONSISTENCY PASS:',counts)
    print('This checks the implementation kit, not product readiness.')
    return 0
if __name__=='__main__': raise SystemExit(main())
