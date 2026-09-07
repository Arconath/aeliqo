#!/usr/bin/env python3
"""Compile and test Master consolidation contract prototypes. Does not test Aeliqo's future runtime or UI."""
from __future__ import annotations
import shutil,subprocess,sys,json
from pathlib import Path
from toolchain import local_tool
ROOT=Path(__file__).resolve().parents[1]
def main()->int:
    tsc=local_tool(ROOT,'tsc')
    missing=[tool for tool,available in (('node',shutil.which('node')),('tsc',tsc)) if not available]
    if missing:
        print('REFERENCE CHECK BLOCKED: required local tools missing: '+', '.join(missing),file=sys.stderr);return 2
    dest=ROOT/'artifacts/reference-build';dest.mkdir(parents=True,exist_ok=True)
    (dest/'package.json').write_text('{"type":"module"}\n')
    run=subprocess.run([tsc,'--project','tsconfig.reference.json'],cwd=ROOT,check=False,timeout=90)
    if run.returncode:return run.returncode
    run=subprocess.run(['node','--test','tests/reference/guards.test.mjs'],cwd=ROOT,check=False,timeout=90)
    return run.returncode
if __name__=='__main__':raise SystemExit(main())
