#!/usr/bin/env python3
"""Measure ONLY the Python reference candidate experiment; not Aeliqo/Lit/browser speed."""
import json,time,statistics,platform,sys,math
from presentation_reference import Candidate,choose

def main():
    observations=[]
    req=frozenset(['browse','trend','detail','edit'])
    for count in (71,710,7100):
        roles=sorted(req)
        cs=[Candidate(f'c{i:05}',frozenset([roles[i%4]]),'view') for i in range(count)]
        for _ in range(3):choose(req,cs)
        samples=[];expansions=[]
        for _ in range(25):
            start=time.perf_counter_ns();result=choose(req,cs);samples.append((time.perf_counter_ns()-start)/1e6);expansions.append(result['expansions'])
            if result['status']!='valid' or len(result['ids'])!=4:raise RuntimeError('Reference composition regression')
        ordered=sorted(samples)
        observations.append({'candidates':count,'requiredOperations':4,'runs':25,'warmups':3,'samplesMs':samples,
            'medianMs':statistics.median(samples),'p95Ms':ordered[math.ceil(.95*len(ordered))-1],'maxPlanExpansions':max(expansions)})
    print(json.dumps({'scope':'Python reference monotone operation-coverage search only; NOT product or paint benchmark',
      'environment':{'python':sys.version,'platform':platform.platform(),'processor':platform.processor()},
      'includes':'validation/filtering/sorting of candidate list plus greedy selection; excludes registry construction',
      'limitations':'No browser, rendering, semantic queries, graph binding, pixels, mobile hardware or real model. No threshold derived for production.',
      'observations':observations},indent=2))
if __name__=='__main__':main()
