#!/usr/bin/env python3
"""Compile and test Master consolidation contract prototypes. Does not test Aeliqo's future runtime or UI."""
from __future__ import annotations
import shutil,subprocess,sys,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main()->int:
    missing=[tool for tool in ('node','tsc') if not shutil.which(tool)]
    if missing:
        print('REFERENCE CHECK BLOCKED: required local tools missing: '+', '.join(missing),file=sys.stderr);return 2
    dest=ROOT/'artifacts/reference-build';dest.mkdir(parents=True,exist_ok=True)
    (dest/'package.json').write_text('{"type":"module"}\n')
    args=['tsc','--strict','--exactOptionalPropertyTypes','--noUncheckedIndexedAccess','--target','ES2022','--module','ES2022','--moduleResolution','bundler','--lib','ES2022','--outDir',str(dest)]
    sources=['contracts/reference.ts','contracts/reference-guards.ts','contracts/examples.ts','contracts/negative-tests.ts','contracts/agent-boundary.ts']
    run=subprocess.run(args+sources,cwd=ROOT,check=False,timeout=90)
    if run.returncode:return run.returncode
    run=subprocess.run(['node','--test','tests/reference/guards.test.mjs'],cwd=ROOT,check=False,timeout=90)
    return run.returncode
if __name__=='__main__':raise SystemExit(main())
