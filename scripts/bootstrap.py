#!/usr/bin/env python3
"""Copy this kit into a new/empty directory. Default is a no-write dry-run."""
from __future__ import annotations
import argparse
import shutil
import sys
from pathlib import Path
from common import ROOT,export_files

def copy_kit(root: Path, destination: Path, apply: bool=False) -> int:
    raw=destination.expanduser().absolute()
    for ancestor in [raw,*raw.parents]:
        if ancestor.is_symlink(): raise ValueError('Destination or parent is a symlink')
    target=raw.resolve(); source=root.resolve()
    if target==source or target.is_relative_to(source) or source.is_relative_to(target):
        raise ValueError('Source and destination cannot contain each other')
    if target.exists() and (not target.is_dir() or any(target.iterdir())):
        raise ValueError('Destination must be absent or an empty directory; no files are overwritten')
    files=export_files(source)
    print(f'{"APPLY" if apply else "DRY RUN"}: {len(files)} files -> {target}')
    if not apply: return len(files)
    target.mkdir(parents=True,exist_ok=True)
    for file in files:
        new=target/file.relative_to(source); new.parent.mkdir(parents=True,exist_ok=True)
        # Exclusive create catches an unexpected file appearing after the initial check.
        with new.open('xb') as out, file.open('rb') as inp: shutil.copyfileobj(inp,out)
    return len(files)

def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('destination',type=Path)
    parser.add_argument('--apply',action='store_true'); args=parser.parse_args()
    try: copy_kit(ROOT,args.destination,args.apply); return 0
    except (OSError,ValueError) as exc: print('BOOTSTRAP REFUSED:',exc,file=sys.stderr); return 1
if __name__=='__main__': raise SystemExit(main())
