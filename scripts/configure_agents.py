#!/usr/bin/env python3
"""Generate project-local model config only from explicitly verified local capabilities."""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path
from common import ROOT,load_json

KEYS={'model','model_reasoning_effort','agents.enabled','agents.max_concurrent_threads_per_session',
      'agents.default_subagent_model','agents.default_subagent_reasoning_effort',
      'name','description','developer_instructions','sandbox_mode'}

def configuration(cap: dict) -> dict[str,str]:
    if cap.get('verified') is not True or not cap.get('runtimeVersion') or not cap.get('verifiedAt'):
        raise ValueError('Local runtime capability discovery is not verified')
    for key in ('orchestratorModelId','subagentModelId'):
        value=cap.get(key)
        if not isinstance(value,str) or not value or any(c in value.lower() for c in ('placeholder','todo','verify','<','>')):
            raise ValueError('Actual model IDs are required; do not guess from display names')
    if 'medium' not in cap.get('orchestratorEfforts',[]):
        raise ValueError('Requested Astra medium is not verified as supported')
    if 'max' not in cap.get('subagentEfforts',[]):
        raise ValueError('Requested Luna max is not verified; no silent xhigh/other substitution')
    if not KEYS.issubset(set(cap.get('supportedConfigKeys',[]))):
        raise ValueError('Actual client does not verify all supported config keys; adapt generator explicitly to its schema')
    values=[cap.get('runtimeThreadLimit'),cap.get('resourceThreadLimit')]
    if any(not isinstance(v,int) or isinstance(v,bool) or v<1 or v>256 for v in values):
        raise ValueError('Verify positive thread/resource ceilings (1..256); do not invent unlimited spawning')
    limit=min(values)
    q=lambda value:json.dumps(value,ensure_ascii=False)
    config=(f'model = {q(cap["orchestratorModelId"])}\nmodel_reasoning_effort = "medium"\n\n'
            f'[agents]\nenabled = true\nmax_concurrent_threads_per_session = {limit}\n'
            f'default_subagent_model = {q(cap["subagentModelId"])}\n'
            'default_subagent_reasoning_effort = "max"\n')
    files={'.codex/config.toml':config}
    for role,description,sandbox,instruction in [
        ('aeliqo_worker','One scoped implementation task in an assigned worktree','workspace-write',
         'Read AGENTS.md and your assigned task. Own only leased paths. Implement behavior, tests and docs; run focused validation. Return concise evidence and risks. Do not publish, deploy, alter global skills or spawn competing writers.'),
        ('aeliqo_reviewer','Independent read-only correctness, performance and accessibility review','read-only',
         'Read AGENTS.md and the narrow changed contract. Review independently; cite concrete files and failures. Do not modify code or manufacture execution evidence. Parent performs integration and release decisions.')]:
        files[f'.codex/agents/{role}.toml']=(f'name = {q(role)}\ndescription = {q(description)}\n'
          f'model = {q(cap["subagentModelId"])}\nmodel_reasoning_effort = "max"\nsandbox_mode = {q(sandbox)}\n'
          f'developer_instructions = {q(instruction)}\n')
    return files

def write_configuration(root: Path, files: dict[str,str], apply: bool=False) -> None:
    destinations=[]
    for relative,text in files.items():
        path=root/relative
        if path.exists() or path.is_symlink(): raise ValueError('Refusing to overwrite existing config: '+relative)
        for parent in path.parents:
            if parent==root: break
            if parent.is_symlink(): raise ValueError('Symlinked config directory is not allowed')
        destinations.append((path,text))
    if not apply:
        print(json.dumps(files,indent=2)); return
    for path,text in destinations:
        path.parent.mkdir(parents=True,exist_ok=True)
        with path.open('x',encoding='utf-8') as output: output.write(text)
    print('Local files written. Verify actual client acceptance and delegation; this does not configure ChatGPT cloud.')

def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capabilities',required=True,type=Path)
    parser.add_argument('--apply',action='store_true'); args=parser.parse_args()
    try: write_configuration(ROOT,configuration(load_json(args.capabilities)),args.apply); return 0
    except (OSError,ValueError,KeyError) as exc: print('CONFIG REFUSED:',exc,file=sys.stderr); return 1
if __name__=='__main__': raise SystemExit(main())
