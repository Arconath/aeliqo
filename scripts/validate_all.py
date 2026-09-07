#!/usr/bin/env python3
"""Reproduce kit/reference validation. This is NOT the product-ready gate."""
from __future__ import annotations
import datetime,json,platform,subprocess,sys,shutil
from pathlib import Path
from common import ROOT,sha256,candidate_digest
from toolchain import local_tool

def version(tool):
    executable=local_tool(ROOT,tool) if tool=='tsc' else shutil.which(tool)
    if not executable:return 'unavailable'
    try:return subprocess.check_output([executable,'--version'],text=True,timeout=10).strip()
    except (OSError,subprocess.SubprocessError):return 'unavailable'

def main()->int:
    if sys.version_info<(3,11):print('BLOCKED: Python 3.11+ required',file=sys.stderr);return 2
    directory=ROOT/'validation/current';directory.mkdir(parents=True,exist_ok=True)
    commands=[
      ('kit-consistency',[sys.executable,'scripts/kit_check.py'],0),
      ('python-harness',[sys.executable,'-m','unittest','discover','-s','tests/harness','-v'],0),
      ('independent-semantics-composition',[sys.executable,'-m','unittest','discover','-s','tests/semantics_reference','-v'],0),
      ('strict-ts-and-node-guards',[sys.executable,'scripts/test_reference.py'],0),
      ('reference-search-measurements',[sys.executable,'scripts/bench_reference.py'],0),
      ('publisher-dry-run',[sys.executable,'scripts/publish_git.py'],0),
      ('product-ready-expected-block',[sys.executable,'scripts/gate.py','ready'],1),
      ('product-release-expected-block',[sys.executable,'scripts/gate.py','release'],1)]
    results=[];before=candidate_digest(ROOT)
    for label,argv,expected in commands:
        output=directory/(label+'.log')
        try:
            with output.open('wb') as f:r=subprocess.run(argv,cwd=ROOT,stdout=f,stderr=subprocess.STDOUT,timeout=180,check=False)
            code=r.returncode
        except subprocess.TimeoutExpired:code=124
        except OSError as e:output.write_text(str(e));code=127
        observed=code==expected
        if expected==1 and 'BLOCKED:' not in output.read_text(errors='replace'):observed=False
        results.append({'check':label,'argv':argv,'exitCode':code,'expectedExitCode':expected,
          'outcome':'pass' if observed else ('blocked' if code==2 else 'fail'),
          'log':output.relative_to(ROOT).as_posix(),'sha256':sha256(output)})
        print(label+': '+results[-1]['outcome']+f' (exit {code})',flush=True)
    after=candidate_digest(ROOT)
    ok=all(r['outcome']=='pass' for r in results) and before==after
    summary={'kitRevision':json.loads((ROOT/'KIT-REVISION.json').read_text())['kitRevision'],'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),
       'scope':'kit/harness/reference experiments only','productImplemented':False,'productReady':False,
       'candidateDigest':after,'sourceChangedDuringRun':before!=after,
       'environment':{'python':sys.version,'node':version('node'),'typescript':version('tsc'),'pnpm':version('pnpm'),'platform':platform.platform()},
       'status':'pass' if ok else 'incomplete','checks':results,
       'notTested':['production runtime','actual DOM/SSR/hydration','manual assistive technology','actual UI latency/pixels','real model/MCP/native WebMCP','npm publication','deployment']}
    (directory/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    print('Kit/reference validation '+summary['status']+'. Product readiness is not asserted.')
    return 0 if ok else 1
if __name__=='__main__':raise SystemExit(main())
