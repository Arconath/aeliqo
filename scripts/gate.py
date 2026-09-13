#!/usr/bin/env python3
"""Fail-closed product CI/readiness/release gate; never substitutes reports for real testing."""
from __future__ import annotations
import argparse
import datetime as dt
import json
import os
import re
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from common import ROOT,candidate_digest,load_json,safe_file,sha256
from kit_check import validate

KINDS={'typecheck','lint','unit','browser','packages','security','performance','boundaries'}
DEFERRED_MEASUREMENT_SCRIPTS={'test:performance:bundles','test:performance:runtime',
                              'test:performance:browser','test:performance:standalone',
                              'test:performance:perceived-input','test:performance:heap-lifecycle',
                              'test:performance:adverse-runtime','test:performance:adverse-visualization'}
READY_CLAIMS={'browser-matrix','visual-review','package-consumers',
              'performance','security','real-mcp','real-byok','independent-review'}
RELEASE_CLAIMS={'source-release','npm-integrity','site-digest','rollback-verification'}

def _process_group_exists(process_group: int) -> bool:
    try:
        os.killpg(process_group,0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True

def _terminate_process_tree(process: subprocess.Popen[bytes]) -> None:
    if os.name!='posix':
        process.kill(); process.wait(); return
    try: os.killpg(process.pid,signal.SIGTERM)
    except (ProcessLookupError,PermissionError): pass
    deadline=time.monotonic()+2
    while _process_group_exists(process.pid) and time.monotonic()<deadline:
        time.sleep(0.05)
    if _process_group_exists(process.pid):
        try: os.killpg(process.pid,signal.SIGKILL)
        except (ProcessLookupError,PermissionError): pass
    process.wait()

def run_logged_command(argv: list[str], root: Path, log: object, timeout: int | float,
                       environment: dict[str,str] | None=None) -> int:
    process=subprocess.Popen(argv,cwd=root,stdout=log,stderr=subprocess.STDOUT,
                             start_new_session=os.name=='posix',env=environment)
    try: return process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        _terminate_process_tree(process)
        return 124

def run_timed_logged_command(argv: list[str], root: Path, log: object, timeout: int | float,
                             environment: dict[str,str] | None=None) -> tuple[int,float]:
    started=time.monotonic()
    code=run_logged_command(argv,root,log,timeout,environment)
    return code,time.monotonic()-started

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

def performance_deferred(root: Path) -> bool:
    policy=load_json(root/'harness/product-commands.json').get('performanceQualification',{})
    return policy.get('status')=='deferred' and policy.get('ownerDecision')=='2026-09-13'


def command_errors(root: Path) -> tuple[list[str],list[dict]]:
    try: commands=load_json(root/'harness/product-commands.json')['commands']
    except (OSError,ValueError,KeyError) as exc: return [str(exc)],[]
    if not isinstance(commands,list): return ['Command ledger is not a list'],[]
    errors=[]
    kinds={command.get('kind') for command in commands if isinstance(command,dict)}
    required_kinds=KINDS-{'performance'} if performance_deferred(root) else KINDS
    if not required_kinds.issubset(kinds): errors.append('Missing real product commands: '+', '.join(sorted(required_kinds-kinds)))
    for command in commands:
        if not isinstance(command,dict):
            errors.append('Each command must be an object'); continue
        if command.get('kind') not in KINDS:
            errors.append('Unknown command kind')
        argv=command.get('argv')
        if not isinstance(argv,list) or not argv or any(not isinstance(v,str) or not v for v in argv):
            errors.append('Commands require a nonempty argv array (no shell string)')
        if command.get('deferred') is not None and (command.get('deferred') is not True
                or not performance_deferred(root) or argv not in [['pnpm',name] for name in DEFERRED_MEASUREMENT_SCRIPTS]):
            errors.append('Only owner-deferred measurement commands may be deferred')
        timeout=command.get('timeoutSeconds',900)
        if not isinstance(timeout,int) or isinstance(timeout,bool) or not 1<=timeout<=3600:
            errors.append('Command timeout must be 1..3600 seconds')
    return errors,commands

def readiness_errors(root: Path, mode: str) -> list[str]:
    errors,_=validate(root)
    cmd_errors,_=command_errors(root); errors+=cmd_errors
    deferred=performance_deferred(root)
    tasks=load_json(root/'harness/tasks.json')['tasks']
    for task in tasks:
        if deferred and task['id']=='T30': continue
        if mode=='ready' and task['stage']=='release': continue
        if str(task.get('evidenceScope','')).startswith('historical-'):
            errors.append(task['id']+': historical evidence cannot satisfy current readiness')
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
        if str(scenario.get('evidenceScope','')).startswith('historical-'):
            errors.append(scenario['id']+': historical evidence cannot satisfy current readiness')
        if scenario.get('status')!='done': errors.append(scenario['id']+': scenario not passed')
        else: errors+=artifact_errors(root,scenario.get('evidence'),scenario['id'])
    digest=candidate_digest(root)
    configured_ci=os.environ.get('AELIQO_CI_EVIDENCE_PATH')
    ledger_path=safe_file(root,configured_ci) if configured_ci else root/'harness/evidence/ci.json'
    try:
        ci=load_json(ledger_path)
        if ci.get('subjectSha256')!=digest or ci.get('status')!='pass':
            errors.append('CI evidence is absent, failed or stale for this candidate')
        required_kinds=KINDS-{'performance'} if deferred else KINDS
        if deferred and ci.get('performanceQualification',{}).get('status')!='deferred':
            errors.append('CI evidence must disclose owner-deferred performance')
        if not required_kinds.issubset({r.get('kind') for r in ci.get('results',[]) if r.get('exitCode')==0}):
            errors.append('CI evidence does not cover all required command kinds')
        for result in ci.get('results',[]):
            if result.get('status')=='deferred':
                if not deferred or result.get('exitCode') is not None or result.get('argv') not in [['pnpm',name] for name in DEFERRED_MEASUREMENT_SCRIPTS]:
                    errors.append('Invalid deferred CI result')
                continue
            errors+=artifact_errors(root,result.get('artifacts'),'CI '+str(result.get('kind')))
    except (OSError,ValueError): errors.append('No actual CI command evidence')
    try:
        integrated=load_json(root/'harness/evidence/integrated.json')
        if integrated.get('subjectSha256')!=digest:
            errors.append('Integrated evidence does not match candidate source digest')
        claims=integrated.get('claims',[])
        by_name={c.get('name'):c for c in claims}
        required=(READY_CLAIMS-{'performance'} if deferred else READY_CLAIMS) | (RELEASE_CLAIMS if mode=='release' else set())
        if integrated.get('webmcpNativeAdvertised') is True: required=required|{'real-native-webmcp'}
        for name in sorted(required):
            claim=by_name.get(name)
            if not claim or claim.get('status')!='pass': errors.append('Missing passing integrated evidence: '+name); continue
            if name.startswith('real-') and claim.get('provenance')!='live':
                errors.append('Live integration evidence required: '+name)
            errors+=artifact_errors(root,claim.get('artifacts'),name)
    except (OSError,ValueError,TypeError): errors.append('No valid integrated candidate evidence')
    return errors

def write_ci_report(path: Path, subject: str, status: str, source_changed: bool, results: list[dict], qualification: dict | None=None) -> None:
    report={'subjectSha256':subject,'status':status,'sourceChangedDuringRun':source_changed,
            'timestamp':dt.datetime.now(dt.timezone.utc).isoformat(),'results':results}
    if qualification is not None: report['performanceQualification']=qualification
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary: Path | None=None
    try:
        with tempfile.NamedTemporaryFile('w',dir=path.parent,prefix='.ci.',suffix='.tmp',delete=False) as stream:
            temporary=Path(stream.name)
            json.dump(report,stream,indent=2);stream.write('\n');stream.flush();os.fsync(stream.fileno())
        os.replace(temporary,path)
    finally:
        if temporary is not None: temporary.unlink(missing_ok=True)

def run_ci(root: Path) -> int:
    kit_errors,_=validate(root); errors,commands=command_errors(root)
    if kit_errors or errors:
        print('\n'.join(kit_errors+errors),file=sys.stderr); return 1
    before=candidate_digest(root)
    directory=root/'artifacts/product-ci'; directory.mkdir(parents=True,exist_ok=True)
    evidence=root/'harness/evidence/ci.json'
    results=[]
    qualification=load_json(root/'harness/product-commands.json').get('performanceQualification')
    write_ci_report(evidence,before,'running',False,results,qualification)
    with tempfile.TemporaryDirectory(prefix='aeliqo-build-reuse-') as reuse_directory:
        environment={**os.environ,'AELIQO_BUILD_REUSE_DIRECTORY':reuse_directory}
        for index,command in enumerate(commands):
            if command.get('deferred') is True:
                results.append({'kind':command['kind'],'argv':command['argv'],'status':'deferred',
                                'exitCode':None,'reason':'Owner decision 2026-09-13: performance deferred','artifacts':[]})
                write_ci_report(evidence,before,'running',False,results,qualification)
                continue
            output=directory/f'{index:02d}-{command["kind"]}.log'
            started=time.monotonic()
            try:
                with output.open('wb') as log:
                    code,elapsed=run_timed_logged_command(command['argv'],root,log,command.get('timeoutSeconds',900),environment)
            except OSError as exc:
                output.write_text(str(exc)); code=127; elapsed=time.monotonic()-started
            results.append({'kind':command['kind'],'argv':command['argv'],'exitCode':code,
                            'elapsedSeconds':round(elapsed,3),
                            'artifacts':[{'path':output.relative_to(root).as_posix(),'sha256':sha256(output)}]})
            print(f'{command["kind"]}: exit {code} ({elapsed:.3f}s)',flush=True)
            if code!=0:
                after=candidate_digest(root)
                write_ci_report(evidence,after,'fail',before!=after,results,qualification)
                return 1
            write_ci_report(evidence,before,'running',False,results,qualification)
    after=candidate_digest(root)
    passed=all(r.get('status')=='deferred' or r['exitCode']==0 for r in results) and before==after
    write_ci_report(evidence,after,'pass' if passed else 'fail',before!=after,results,qualification)
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
