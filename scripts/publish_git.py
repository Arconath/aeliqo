#!/usr/bin/env python3
"""Publish a clean kit tree as ONE commit on a NEW GitHub branch. Never touches main/live/npm."""
from __future__ import annotations
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from common import ROOT,export_files

def validate_target(repo: str, branch: str) -> None:
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repo):
        raise ValueError('Expected an owner/repository identifier, not a URL or option')
    if not branch.startswith('rewrite/') or not re.fullmatch(r'[A-Za-z0-9._/-]+',branch):
        raise ValueError('Use a new rewrite/... branch')
    if any(part in {'','.', '..'} or part.endswith('.lock') or part.endswith('.') for part in branch.split('/')) or '..' in branch:
        raise ValueError('Invalid or unsafe branch name')

def run(argv: list[str], cwd: Path|None=None, stdin: str|None=None, env: dict|None=None) -> str:
    result=subprocess.run(argv,cwd=cwd,input=stdin,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                          timeout=180,check=False,env=env)
    if result.returncode:
        raise RuntimeError(f'{argv[0]} failed ({result.returncode}): {result.stderr.strip()}')
    return result.stdout.strip()

def publish(root: Path, repo: str, branch: str, apply: bool=False) -> dict:
    validate_target(repo,branch)
    files=export_files(root)
    plan={'operation':'new-branch-one-clean-tree-commit','repo':repo,'branch':branch,
          'files':len(files),'mutatesMain':False,'publishesNpm':False,'deploys':False,'applied':False}
    if not apply: return plan # No network and no local writes in dry-run.
    if not shutil.which('git') or not shutil.which('gh'):
        raise RuntimeError('Install git and authenticated GitHub CLI (gh) before --apply')
    run(['gh','auth','status'])
    metadata=json.loads(run(['gh','api',f'repos/{repo}']))
    if metadata.get('archived'): raise RuntimeError('Target repository is archived')
    base=metadata['default_branch']
    if branch==base: raise ValueError('Never publish kit over default branch')
    name=run(['git','config','--get','user.name'])
    email=run(['git','config','--get','user.email'])
    if not name or not email: raise RuntimeError('Configure your real git author identity first')
    url=f'https://github.com/{repo}.git'
    # Temporary credential-helper override; no global git config mutation or token extraction.
    prefix=['git','-c','credential.helper=','-c','credential.helper=!gh auth git-credential']
    if run(prefix+['ls-remote','--heads',url,f'refs/heads/{branch}']):
        raise RuntimeError('Target branch already exists; choose a new rewrite/... branch')
    env=dict(os.environ,GIT_AUTHOR_NAME=name,GIT_AUTHOR_EMAIL=email,GIT_COMMITTER_NAME=name,GIT_COMMITTER_EMAIL=email)
    with tempfile.TemporaryDirectory(prefix='aeliqo-publish-') as tmp:
        tree=Path(tmp)
        run(['git','init','--quiet'],tree)
        run(['git','remote','add','origin',url],tree)
        run(prefix+['fetch','--no-tags','--depth=1','origin',f'refs/heads/{base}'],tree)
        parent=run(['git','rev-parse','FETCH_HEAD'],tree)
        # No legacy checkout: the index contains only the kit, while the commit retains history.
        for file in files:
            destination=tree/file.relative_to(root)
            destination.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(file,destination)
        run(['git','add','--all','--','.'],tree)
        sha=run(['git','write-tree'],tree)
        commit=run(['git','commit-tree',sha,'-p',parent],tree,
                   'docs(harness): define Aeliqo 0.1.0 clean rewrite and fail-closed execution kit\n',env)
        # Empty lease requires branch to remain absent even if another publisher races us.
        run(prefix+['push','--atomic',f'--force-with-lease=refs/heads/{branch}:','origin',f'{commit}:refs/heads/{branch}'],tree)
        remote=run(prefix+['ls-remote','--heads','origin',f'refs/heads/{branch}'],tree)
        if remote.split()[0]!=commit:
            raise RuntimeError('Push returned but branch identity verification failed; inspect remote before retrying')
    return dict(plan,applied=True,parent=parent,commit=commit,url=f'https://github.com/{repo}/tree/{branch}')

def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo',default='Arconath/aeliqo')
    parser.add_argument('--branch',default='rewrite/v0.1.0-master-foundation')
    parser.add_argument('--apply',action='store_true'); args=parser.parse_args()
    try: print(json.dumps(publish(ROOT,args.repo,args.branch,args.apply),indent=2)); return 0
    except (ValueError,OSError,RuntimeError,subprocess.TimeoutExpired) as exc:
        print('GITHUB PUBLICATION FAILED/REFUSED:',exc,file=sys.stderr); return 1
if __name__=='__main__': raise SystemExit(main())
