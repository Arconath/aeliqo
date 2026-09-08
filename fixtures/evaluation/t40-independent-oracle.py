"""Independent arithmetic/population check for every sealed T40 expected output.

No Aeliqo package/runtime code is imported. The implementation below evaluates the
small declared fixture query subset with Python records, Decimal addition, explicit
null propagation, ISO Monday/month buckets, and relation membership.
"""
from __future__ import annotations
import argparse
from datetime import date
from decimal import Decimal
from functools import cmp_to_key
import hashlib
import json
from pathlib import Path
import platform

def value(row, field): return row.get(field)

def compare(left, op, right):
    if left is None or right is None: return None
    if isinstance(left,dict) and isinstance(right,dict): left=Decimal(left['decimal']); right=Decimal(right['decimal'])
    if op=='eq': return left==right
    if op=='ne': return left!=right
    if op=='lt': return left<right
    if op=='lte': return left<=right
    if op=='gt': return left>right
    if op=='gte': return left>=right
    raise AssertionError(op)

def predicate(p,row):
    op=p['op']
    if op=='and':
        vals=[predicate(x,row) for x in p['predicates']]
        return False if False in vals else None if None in vals else True
    if op=='or':
        vals=[predicate(x,row) for x in p['predicates']]
        return True if True in vals else None if None in vals else False
    if op=='not':
        x=predicate(p['predicate'],row); return None if x is None else not x
    x=value(row,p['field'])
    if op=='is-null': return (x is None) != p.get('negate',False)
    if op=='in': return None if x is None else (x in p['values'])
    return compare(x,p['comparison'],p['value'])

def monday(v):
    d=date.fromisoformat(v); return (d).isoformat() if d.weekday()==0 else (d.fromordinal(d.toordinal()-d.weekday())).isoformat()

def bucket(v, spec):
    if v is None:return None
    if spec['grain']=='week':return monday(v)
    if spec['grain']=='month':return v[:7]+'-01'
    raise AssertionError(spec)

def decimal_sum(vals):
    nonnull=[v for v in vals if v is not None]
    if any(v is None for v in vals) or not nonnull:return None
    if len(nonnull)==1:return {'decimal':nonnull[0]['decimal']}
    total=sum((Decimal(v['decimal']) for v in nonnull),Decimal(0)); text=format(total,'f')
    return {'decimal':text.rstrip('0').rstrip('.') if '.' in text else text}

def ratio(vals):
    # The pinned core.ratio-of-sums signature propagates null input before division.
    if any(pair[0] is None or pair[1] is None for pair in vals): return None
    if not vals:return None
    n=sum(pair[0] for pair in vals); d=sum(pair[1] for pair in vals)
    return None if d==0 else n/d

def entity_by_id(cat, entity): return next(x for x in cat['entities'] if x['id']==entity)
def meaning(cat, ref): return next(x for x in cat['meanings'] if x['id']==ref['id'] and x['revision']==ref['revision'])

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))

def digest(value):
    return hashlib.sha256(canonical(value).encode('utf-8')).hexdigest()

def referenced_entities(cat, query):
    entities=[query['entity']]
    for ref in query.get('relations',[]):
        rel=next(x for x in cat['relationships'] if x['id']==ref['id'] and x['revision']==ref['revision'])
        for entity in (rel['sourceEntity'], rel['targetEntity']):
            if entity not in entities: entities.append(entity)
    return entities

def expected_fields(query):
    if query.get('groupBy') or query.get('measures'):
        return list(query.get('groupBy',[]))+[ref['id'] for ref in query.get('measures',[])]
    return list(query['fields'])

def expected_identity(case, query):
    return list(query.get('groupBy',[])) or list(entity_by_id(case['fixture']['catalog'], query['entity'])['identity'])

def expected_evidence(query):
    return 'computed' if any(query.get(key) for key in ('measures','relations','groupBy','timeBucket','period','topK')) else 'observed'

def evaluate(case, out):
    fixture=case['fixture']; cat=fixture['catalog']; q=out['query']; entity=q['entity']
    rows=[dict(x) for x in fixture['records'][entity]]
    # Apply each declared semijoin using the independent relation keys and usage predicate.
    for relref, usage in zip(q.get('relations',[]),q.get('relationUsage',[])):
        assert usage['kind']=='semi'
        rel=next(x for x in cat['relationships'] if x['id']==relref['id'] and x['revision']==relref['revision'])
        right=[dict(x) for x in fixture['records'][rel['targetEntity']]]
        if usage.get('where') is not None:right=[x for x in right if predicate(usage['where'],x) is True]
        keys=rel['keys']; eligible={tuple(x[k['targetField']] for k in keys) for x in right}
        rows=[x for x in rows if tuple(x[k['sourceField']] for k in keys) in eligible]
    if q.get('where') is not None: rows=[x for x in rows if predicate(q['where'],x) is True]
    time=q.get('timeBucket')
    if time is not None:
        for row in rows: row['__bucket__']=bucket(row[time['field']],time)
    groups=None
    if q.get('groupBy') or q.get('measures'):
        groups={}
        for row in rows:
            key=tuple(row['__bucket__'] if time is not None and field==time['field'] else row[field] for field in q.get('groupBy',[]))
            groups.setdefault(key,[]).append(row)
        if not groups: groups={():[]}
        result=[]
        for key, members in groups.items():
            outrow={field:key[i] for i,field in enumerate(q.get('groupBy',[]))}
            for ref in q.get('measures',[]):
                m=meaning(cat,ref); expr=m['implementation']['expression']; fn=expr['function']['id']; args=expr['arguments']
                vals=[[member[a['ref']] for member in members] for a in args]
                if fn=='core.aggregate.sum': computed=decimal_sum(vals[0]) if vals[0] and isinstance(next((v for v in vals[0] if v is not None),None),dict) else (None if any(v is None for v in vals[0]) or not vals[0] else sum(vals[0]))
                elif fn=='core.aggregate.count': computed=sum(v is not None for v in vals[0])
                elif fn=='core.ratio-of-sums': computed=ratio(list(zip(vals[0],vals[1])))
                else: raise AssertionError(fn)
                outrow[ref['id']]=computed
            result.append(outrow)
    else:
        result=[{field:row[field] for field in q['fields']} for row in rows]
    def sort_key(row, spec):
        x=row.get(spec['field']); return (x is None, x)
    # Stable bounded sort matching each corpus query's explicit null-last ordering.
    for spec in reversed(q.get('order',[])):
        field=spec['field']; nulls=spec.get('nulls','last'); direction=spec['direction']
        def compare_rows(left,right):
            a,b=left.get(field),right.get(field)
            if isinstance(a,dict):a=Decimal(a['decimal'])
            if isinstance(b,dict):b=Decimal(b['decimal'])
            if a is None or b is None:
                if a is None and b is None:return 0
                if a is None:return -1 if nulls=='first' else 1
                return 1 if nulls=='first' else -1
            if a==b:return 0
            compared=-1 if a<b else 1
            return -compared if direction=='desc' else compared
        result.sort(key=cmp_to_key(compare_rows))
    if q.get('topK') is not None: result=result[:q['topK']]
    return result

def main():
    parser=argparse.ArgumentParser(description='Verify T40 expected outputs with a dependency-free Python oracle.')
    parser.add_argument('--corpus',type=Path,default=Path(__file__).with_name('t40-data-query-heldout.json'))
    parser.add_argument('--report',type=Path,default=Path(__file__).with_name('t40-independent-oracle-report.json'))
    args=parser.parse_args()
    corpus=args.corpus.resolve(); cases=json.loads(corpus.read_text())
    failures=[]; outputs=[]
    for case in cases:
        if len(case['explicitTask']['outputs'])!=len(case['expected']):
            failures.append({'caseId':case['id'],'reason':'output-count'})
            continue
        for task_output, wanted in zip(case['explicitTask']['outputs'],case['expected']):
            actual=evaluate(case,task_output); quality=wanted['quality']; query=task_output['query']
            expected_rows=wanted['rows']; reasons=[]
            if actual!=expected_rows: reasons.append('rows')
            if list(wanted['fields'])!=expected_fields(query): reasons.append('fields')
            if list(wanted['grain'])!=expected_identity(case,query): reasons.append('grain')
            if quality['identity']!=expected_identity(case,query): reasons.append('quality.identity')
            if quality['populationCount']!=len(actual): reasons.append('quality.populationCount')
            if quality['precision']!='exact': reasons.append('quality.precision')
            if quality['evidenceKind']!=expected_evidence(query): reasons.append('quality.evidenceKind')
            definitions=[{'id':ref['id'],'revision':ref['revision']} for ref in query.get('measures',[])]
            if quality['definitions']!=definitions: reasons.append('quality.definitions')
            revisions={entity:case['fixture']['sourceRevision'] for entity in referenced_entities(case['fixture']['catalog'],query)}
            if quality['sourceRevisions']!=revisions: reasons.append('quality.sourceRevisions')
            record={'caseId':case['id'],'outputId':wanted['id'],'actualRows':len(actual),'expectedRows':len(expected_rows),'actualDigest':digest(actual),'expectedDigest':digest(expected_rows),'reasons':reasons,'passed':not reasons}
            outputs.append(record)
            if reasons: failures.append(record)
    repo_root=Path(__file__).resolve().parents[2]
    display_corpus=str(corpus.relative_to(repo_root)) if corpus.is_relative_to(repo_root) else str(corpus)
    manifest=corpus.with_suffix('.manifest.json')
    report={'schemaVersion':'1','oracle':'t40-independent-python','independent':True,'sdkImports':[],'corpus':display_corpus,'corpusSha256':hashlib.sha256(corpus.read_bytes()).hexdigest(),'manifestSha256':hashlib.sha256(manifest.read_bytes()).hexdigest() if manifest.is_file() else None,'scriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'python':platform.python_version(),'caseCount':len(cases),'outputCount':len(outputs),'verifiedOutputCount':sum(1 for item in outputs if item['passed']),'failedOutputCount':len(failures),'failures':failures,'outputs':outputs}
    args.report.parent.mkdir(parents=True,exist_ok=True); args.report.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    print(f"verified {report['verifiedOutputCount']}/{report['outputCount']} outputs across {report['caseCount']} cases with independent Python oracle")
    if failures: raise SystemExit(1)

if __name__=='__main__': main()
