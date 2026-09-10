#!/usr/bin/env python3
"""Fail-closed product CI/readiness/release gate; never substitutes reports for real testing."""
from __future__ import annotations
import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from common import ROOT,candidate_digest,load_json,safe_file,sha256
from kit_check import validate

KINDS={'typecheck','lint','unit','browser','packages','security','performance','boundaries'}
READY_CLAIMS={'browser-matrix','visual-review','package-consumers',
              'performance','security','real-mcp','real-byok','independent-review'}
RELEASE_CLAIMS={'source-release','npm-integrity','site-digest','rollback-verification'}

def artifact_errors(root: Path, records: object, label: str) -> list[str]:
    if not isinstance(records,list) or not records:
        return [label+': no evidence artifacts']
    errors=[]
    for record in records:
        try:
            path=safe_file(root,record['path'])
            digest=record['sha256']
            if not re.fullmatch(r'[0-9a-f]{64}',digest) or not path.is_file() or sha256(path)!=digest:
                errors.append(label+': missing/mismatching artifact '+record['path'])
        except (KeyError,ValueError,TypeError,OSError) as exc:
            errors.append(label+': invalid artifact '+str(exc))
    return errors

def command_errors(root: Path) -> tuple[list[str],list[dict]]:
    try: commands=load_json(root/'harness/product-commands.json')['commands']
    except (OSError,ValueError,KeyError) as exc: return [str(exc)],[]
    if not isinstance(commands,list): return ['Command ledger is not a list'],[]
    errors=[]
    kinds={command.get('kind') for command in commands if isinstance(command,dict)}
    if not KINDS.issubset(kinds): errors.append('Missing real product commands: '+', '.join(sorted(KINDS-kinds)))
    for command in commands:
        if not isinstance(command,dict):
            errors.append('Each command must be an object'); continue
        if command.get('kind') not in KINDS:
            errors.append('Unknown command kind')
        argv=command.get('argv')
        if not isinstance(argv,list) or not argv or any(not isinstance(v,str) or not v for v in argv):
            errors.append('Commands require a nonempty argv array (no shell string)')
        timeout=command.get('timeoutSeconds',900)
        if not isinstance(timeout,int) or isinstance(timeout,bool) or not 1<=timeout<=3600:
            errors.append('Command timeout must be 1..3600 seconds')
    return errors,commands

def readiness_errors(root: Path, mode: str) -> list[str]:
    errors,_=validate(root)
    cmd_errors,_=command_errors(root); errors+=cmd_errors
    tasks=load_json(root/'harness/tasks.json')['tasks']
    for task in tasks:
        if mode=='ready' and task['stage']=='release': continue
        if task['status']!='done': errors.append(f'{task["id"]}: {task["status"]}, not done')
        else:
            errors+=artifact_errors(root,task.get('evidence'),task['id'])
            review=task.get('review',{})
            if review.get('status')!='approved' or not review.get('author') or not review.get('reviewer') or review.get('author')==review.get('reviewer'):
                errors.append(task['id']+': independent reviewer/author evidence missing')
            else: errors+=artifact_errors(root,review.get('artifacts'),task['id']+' review')
    for component in load_json(root/'harness/components.json')['components']:
        if component['status']!='done': errors.append(component['id']+': not implemented/evidenced')
        else:
            errors+=artifact_errors(root,component.get('evidence'),component['id'])
            actual={e.get('kind') for e in component.get('evidence',[]) if isinstance(e,dict)}
            if not set(component.get('evidenceRequired',[])).issubset(actual):
                errors.append(component['id']+': incomplete component evidence categories')
    native_advertised=False
    try:
        native_advertised=load_json(root/'harness/evidence/integrated.json').get('webmcpNativeAdvertised') is True
    except (OSError,ValueError,AttributeError): pass
    for scenario in load_json(root/'harness/scenarios.json')['scenarios']:
        if mode=='ready' and scenario.get('stage','ready')=='release': continue
        if scenario.get('deferredForRelease') is True: continue
        if scenario.get('nativeHostRequired') and not native_advertised: continue
        if scenario.get('status')!='done': errors.append(scenario['id']+': scenario not passed')
        else: errors+=artifact_errors(root,scenario.get('evidence'),scenario['id'])
    digest=candidate_digest(root)
    configured_ci=os.environ.get('AELIQO_CI_EVIDENCE_PATH')
    ledger_path=safe_file(root,configured_ci) if configured_ci else root/'harness/evidence/ci.json'
    try:
        ci=load_json(ledger_path)
        if ci.get('subjectSha256')!=digest or ci.get('status')!='pass':
            errors.append('CI evidence is absent, failed or stale for this candidate')
        if not KINDS.issubset({r.get('kind') for r in ci.get('results',[]) if r.get('exitCode')==0}):
            errors.append('CI evidence does not cover all required command kinds')
        for result in ci.get('results',[]): errors+=artifact_errors(root,result.get('artifacts'),'CI '+str(result.get('kind')))
    except (OSError,ValueError): errors.append('No actual CI command evidence')
    try:
        integrated=load_json(root/'harness/evidence/integrated.json')
        if integrated.get('subjectSha256')!=digest:
            errors.append('Integrated evidence does not match candidate source digest')
        claims=integrated.get('claims',[])
        by_name={c.get('name'):c for c in claims}
        required=READY_CLAIMS | (RELEASE_CLAIMS if mode=='release' else set())
        if integrated.get('webmcpNativeAdvertised') is True: required=required|{'real-native-webmcp'}
        for name in sorted(required):
            claim=by_name.get(name)
            if not claim or claim.get('status')!='pass': errors.append('Missing passing integrated evidence: '+name); continue
            if name.startswith('real-') and claim.get('provenance')!='live':
                errors.append('Live integration evidence required: '+name)
            errors+=artifact_errors(root,claim.get('artifacts'),name)
    except (OSError,ValueError,TypeError): errors.append('No valid integrated candidate evidence')
    return errors

def run_ci(root: Path) -> int:
    kit_errors,_=validate(root); errors,commands=command_errors(root)
    if kit_errors or errors:
        print('\n'.join(kit_errors+errors),file=sys.stderr); return 1
    before=candidate_digest(root)
    directory=root/'artifacts/product-ci'; directory.mkdir(parents=True,exist_ok=True)
    results=[]
    for index,command in enumerate(commands):
        output=directory/f'{index:02d}-{command["kind"]}.log'
        try:
            with output.open('wb') as log:
                completed=subprocess.run(command['argv'],cwd=root,stdout=log,stderr=subprocess.STDOUT,
                                         timeout=command.get('timeoutSeconds',900),check=False)
            code=completed.returncode
        except subprocess.TimeoutExpired: code=124
        except OSError as exc:
            output.write_text(str(exc)); code=127
        results.append({'kind':command['kind'],'argv':command['argv'],'exitCode':code,
                        'artifacts':[{'path':output.relative_to(root).as_posix(),'sha256':sha256(output)}]})
        print(f'{command["kind"]}: exit {code}')
    after=candidate_digest(root)
    passed=all(r['exitCode']==0 for r in results) and before==after
    report={'subjectSha256':after,'status':'pass' if passed else 'fail',
            'sourceChangedDuringRun':before!=after,'timestamp':dt.datetime.now(dt.timezone.utc).isoformat(),'results':results}
    evidence=root/'harness/evidence/ci.json'; evidence.parent.mkdir(parents=True,exist_ok=True)
    evidence.write_text(json.dumps(report,indent=2)+'\n')
    return 0 if passed else 1

def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode',choices=['ci','ready','release','digest'])
    args=parser.parse_args()
    if args.mode=='digest': print(candidate_digest(ROOT)); return 0
    if args.mode=='ci': return run_ci(ROOT)
    try: errors=readiness_errors(ROOT,args.mode)
    except (OSError,ValueError,KeyError,TypeError) as exc: errors=[str(exc)]
    if errors:
        print(f'{args.mode.upper()} BLOCKED: {len(errors)} unmet conditions',file=sys.stderr)
        for error in errors[:24]: print('- '+error,file=sys.stderr)
        if len(errors)>24: print(f'- ... and {len(errors)-24} more',file=sys.stderr)
        return 1
    print(args.mode.upper()+' evidence structure and artifact hashes pass; retain independent review/CI authority.')
    return 0
if __name__=='__main__': raise SystemExit(main())
