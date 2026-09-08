#!/usr/bin/env python3
"""Author expected T40 quality metadata from the sealed task and fixture.

This metadata authoring pass does not import Aeliqo or read runtime descriptors.
It is intentionally separate from ``t40-independent-oracle.py``, which recomputes
answer rows and validates this metadata. By default this script writes a provenance
report and leaves the corpus unchanged; pass ``--apply`` only when regenerating a
reviewed corpus copy.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path


def derive(cases):
    authored=[]
    for case in cases:
        fixture=case['fixture']; relationships={(r['id'],r['revision']):r for r in fixture['catalog']['relationships']}
        revisions={entity:fixture['sourceRevision'] for entity in fixture['records']}
        for wanted, task_output in zip(case['expected'], case['explicitTask']['outputs']):
            query=task_output['query']; entities=[query['entity']]
            for ref in query.get('relations',[]):
                rel=relationships[(ref['id'],ref['revision'])]
                for entity in (rel['sourceEntity'],rel['targetEntity']):
                    if entity not in entities: entities.append(entity)
            measures=query.get('measures',[])
            computed=bool(measures or query.get('relations') or query.get('groupBy') or query.get('timeBucket') or query.get('period') or query.get('topK'))
            quality={
                'identity':list(wanted['grain']),
                'populationCount':len(wanted['rows']),
                'precision':'exact',
                'sourceRevisions':{entity:revisions[entity] for entity in entities},
                'evidenceKind':'computed' if computed else 'observed',
                'definitions':[{'id':m['id'],'revision':m['revision']} for m in measures],
            }
            authored.append({'caseId':case['id'],'outputId':wanted['id'],'quality':quality})
    return authored


def main():
    parser=argparse.ArgumentParser(description='Author T40 expected quality metadata independently of the SDK.')
    parser.add_argument('--corpus',type=Path,default=Path(__file__).with_name('t40-data-query-heldout.json'))
    parser.add_argument('--report',type=Path,default=Path(__file__).with_name('t40-quality-oracle-report.json'))
    parser.add_argument('--apply',action='store_true',help='Rewrite the corpus quality fields after review.')
    args=parser.parse_args()
    corpus=args.corpus.resolve(); cases=json.loads(corpus.read_text()); authored=derive(cases)
    if args.apply:
        by_key={(item['caseId'],item['outputId']):item['quality'] for item in authored}
        for case in cases:
            for wanted in case['expected']:
                wanted['quality']=by_key[(case['id'],wanted['id'])]
        corpus.write_text(json.dumps(cases,indent=2,ensure_ascii=False)+'\n')
    repo_root=Path(__file__).resolve().parents[2]
    display_corpus=str(corpus.relative_to(repo_root)) if corpus.is_relative_to(repo_root) else str(corpus)
    manifest=corpus.with_suffix('.manifest.json')
    report={
        'schemaVersion':'1','oracle':'t40-quality-python','independent':True,'sdkImports':[],
        'corpus':display_corpus,'corpusSha256':hashlib.sha256(corpus.read_bytes()).hexdigest(),
        'manifestSha256':hashlib.sha256(manifest.read_bytes()).hexdigest() if manifest.is_file() else None,
        'scriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'caseCount':len(cases),'outputCount':len(authored),'applied':args.apply,
        'quality':authored,
    }
    args.report.parent.mkdir(parents=True,exist_ok=True); args.report.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    print(f"authored {report['outputCount']} independent quality records across {report['caseCount']} cases")


if __name__=='__main__': main()
