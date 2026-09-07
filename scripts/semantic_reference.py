"""Independent numerical counterexamples. Not the production query executor."""
from __future__ import annotations
from fractions import Fraction
from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo
import sqlite3
import random

def pooled(pairs):
    usable=[(a,b) for a,b in pairs if a is not None and b is not None]
    n=sum(a for a,b in usable);d=sum(b for a,b in usable)
    return Fraction(n,d) if d else None

def rate_mean(pairs):
    xs=[Fraction(a,b) for a,b in pairs if a is not None and b not in (None,0)]
    return sum(xs,Fraction())/len(xs) if xs else None

def simpson():
    return {'before':pooled([(80,100),(2,10)]),'after':pooled([(9,10),(30,100)]),
            'groupsBefore':[Fraction(80,100),Fraction(2,10)],'groupsAfter':[Fraction(9,10),Fraction(30,100)]}

def fanout():
    with sqlite3.connect(':memory:') as db:
        db.executescript('CREATE TABLE employee(id INTEGER);CREATE TABLE sale(emp INTEGER,cents INTEGER);CREATE TABLE tag(emp INTEGER,label TEXT);'
                         'INSERT INTO employee VALUES(1);INSERT INTO sale VALUES(1,100),(1,200);INSERT INTO tag VALUES(1,"a"),(1,"b");')
        wrong=db.execute('SELECT SUM(s.cents) FROM employee e JOIN sale s ON s.emp=e.id JOIN tag t ON t.emp=e.id').fetchone()[0]
        correct=db.execute('SELECT SUM(s.cents) FROM sale s WHERE EXISTS (SELECT 1 FROM tag t WHERE t.emp=s.emp)').fetchone()[0]
        return wrong,correct

def grouped_sql_matches(seed):
    rng=random.Random(seed)
    rows=[(rng.randrange(6), rng.randrange(10), rng.randrange(1,20)) for _ in range(rng.randrange(1,200))]
    expected=defaultdict(lambda:[0,0])
    for group,n,d in rows:expected[group][0]+=n;expected[group][1]+=d
    with sqlite3.connect(':memory:') as db:
        db.execute('CREATE TABLE observations(g INTEGER,n INTEGER,d INTEGER)')
        db.executemany('INSERT INTO observations VALUES(?,?,?)',rows)
        result={g:Fraction(n,d) for g,n,d in db.execute('SELECT g,SUM(n),SUM(d) FROM observations GROUP BY g')}
    return result=={g:Fraction(n,d) for g,(n,d) in expected.items()}

def fixed_and_live():
    values={'A':[10,0],'B':[4,5]}
    fixed=sorted(values,key=lambda k:(-sum(values[k]),k))[0]
    live=[sorted(values,key=lambda k:(-values[k][i],k))[0] for i in range(2)]
    return fixed,live

def dst_duration_hours():
    zone=ZoneInfo('America/New_York')
    start=datetime(2026,3,8,0,tzinfo=zone);end=datetime(2026,3,9,0,tzinfo=zone)
    return (end.timestamp()-start.timestamp())/3600
