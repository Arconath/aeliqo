#!/usr/bin/env python3
"""Verify distributed file hashes. Recompute a new manifest after intentional edits."""
from __future__ import annotations
import sys
from common import ROOT,load_json,safe_file,sha256

def main() -> int:
    manifest=load_json(ROOT/'MANIFEST.json'); errors=[]
    for item in manifest['files']:
        try:
            path=safe_file(ROOT,item['path'])
            if not path.is_file() or sha256(path)!=item['sha256']: errors.append(item['path'])
        except (OSError,ValueError): errors.append(item['path'])
    if errors: print('INTEGRITY MISMATCH:',', '.join(errors),file=sys.stderr); return 1
    print(f'Integrity PASS: {len(manifest["files"])} distributed files')
    return 0
if __name__=='__main__': raise SystemExit(main())
