#!/usr/bin/env python3
"""Evaluate a supplied package inventory for the requested 0.1.0 reset.

No network, credential lookup, unpublish or publication. The supplied inventory is
not independently authenticated by this helper; the release job must verify it.
"""
from __future__ import annotations
import argparse,json,re,sys
from pathlib import Path

def inspect_inventory(value:object)->dict:
    output={'target':'0.1.0','publishReady':False,'mutations':False}
    def fail(reason):return output|{'status':'blocked','reason':reason}
    if not isinstance(value,dict):return fail('inventory-must-be-object')
    if value.get('target')!='0.1.0':return fail('owner-target-mismatch')
    if value.get('registryRead')!='verified':return fail('registry-not-verified')
    if value.get('namespaceAuthorized') is not True:return fail('namespace-not-authorized')
    used=value.get('targetEverPublished')
    if used is True:return fail('published-identity-collision')
    if used is not False:return fail('historical-use-unknown')
    versions=value.get('publishedStableVersions')
    if not isinstance(versions,list):return fail('invalid-version-list')
    if any(not isinstance(v,str) or not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)',v) for v in versions):
        return fail('expected-normalized-stable-semvers')
    if '0.1.0' in versions:return fail('published-identity-collision')
    reset=any(tuple(map(int,v.split('.')))>(0,1,0) for v in versions)
    if reset and value.get('resetMigrationApproved') is not True:return fail('lower-semver-migration-required')
    tag=value.get('stagingTag')
    if tag not in {'next','rewrite'}:return fail('non-latest-staging-required')
    return output|{'status':'candidate-inventory-accepted','resetFromHigherVersion':reset,
                  'stagingTag':tag,'reason':'inventory-only-not-publication-proof'}

def main()->int:
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('inventory',type=Path);a=p.parse_args()
    try:r=inspect_inventory(json.loads(a.inventory.read_text()))
    except (OSError,ValueError) as e:print(f'BLOCKED: {e}',file=sys.stderr);return 2
    print(json.dumps(r,indent=2));return 0 if r['status']=='candidate-inventory-accepted' else 1
if __name__=='__main__':raise SystemExit(main())
