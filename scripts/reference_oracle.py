#!/usr/bin/env python3
"""Independent exact numerical oracle for the explicit synthetic HR policy; not runtime code."""
from __future__ import annotations
from collections import defaultdict
from datetime import date,timedelta
from fractions import Fraction
import json
from common import ROOT,load_json

def calculate(raw: dict) -> dict:
    employees={e['id']:e for e in raw['employees']}
    if len(employees)!=len(raw['employees']): raise ValueError('Duplicate employee identity')
    schedule_keys=[(s['employee_id'],s['date']) for s in raw['schedules']]
    if len(set(schedule_keys))!=len(schedule_keys): raise ValueError('Duplicate schedule grain')
    observations={}
    for row in raw['observations']:
        key=(row['employee_id'],row['date'])
        if key in observations: raise ValueError('Duplicate observation grain needs an explicit source policy')
        if key not in set(schedule_keys): raise ValueError('Observation outside declared work schedule')
        if row['status'] not in ('present','absent'): raise ValueError('Unknown observation status')
        observations[key]=row['status']
    leave={(row['employee_id'],row['date']) for row in raw['leave'] if row['approved']}
    classified=[]
    for eid,day in schedule_keys:
        if eid not in employees: raise ValueError('Unknown scheduled employee')
        if (eid,day) in leave: continue
        current=date.fromisoformat(day)
        week=(current-timedelta(days=current.weekday())).isoformat()
        status=observations.get((eid,day))
        classified.append({'employee_id':eid,'department':employees[eid]['department'],'week':week,
                           'absent':int(status=='absent'),'expected':1,'unknown':int(status is None)})
    def aggregate(keys: tuple[str,...], rows: list[dict]) -> list[dict]:
        buckets=defaultdict(lambda:{'absent':0,'expected':0,'unknown':0})
        for row in rows:
            bucket=buckets[tuple(row[k] for k in keys)]
            for measure in ('absent','expected','unknown'): bucket[measure]+=row[measure]
        result=[]
        for identity,values in sorted(buckets.items()):
            result.append(dict(zip(keys,identity),**values,rate=(str(Fraction(values['absent'],values['expected'])) if values['expected'] and not values['unknown'] else None)))
        return result
    per_employee=aggregate(('employee_id','department'),classified)
    ranked=sorted([r for r in per_employee if r['rate'] is not None],key=lambda r:(-Fraction(r['rate']),r['employee_id']))
    top=[r['employee_id'] for r in ranked[:5]]
    weekly=aggregate(('employee_id','week'),[row for row in classified if row['employee_id'] in top])
    # Preserve fixed top-population order before temporal order.
    weekly.sort(key=lambda row:(top.index(row['employee_id']),row['week']))
    return {'synthetic':True,'employees':per_employee,'topFive':top,'weekly':weekly,
            'departments':aggregate(('department',),classified)}

if __name__=='__main__':
    result=calculate(load_json(ROOT/'fixtures/hr/raw.json'))
    expected=load_json(ROOT/'fixtures/hr/expected.json')
    if result!=expected: raise SystemExit('Independent HR oracle mismatch')
    print('Independent exact HR oracle PASS:',result['topFive'])
