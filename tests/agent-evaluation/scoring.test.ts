import {expect,it} from 'vitest';
import {wilsonInterval} from './scoring.js';
it('does not call an unrun or tiny perfect sample a universal success rate',()=>{expect(wilsonInterval(0,0)).toBeNull();const one=wilsonInterval(1,1);expect(one?.lower).toBeCloseTo(0.20655,4);expect(one?.upper).toBeCloseTo(1);expect(wilsonInterval(95,100)?.lower).toBeGreaterThan(0.88);expect(()=>wilsonInterval(2,1)).toThrow();});

import {createEvaluationHost} from './host.js';
import {developmentCase} from './development.js';
import {scoreData} from './scoring.js';
it('rejects extra fields and repeated output identities even when expected values match',async()=>{
 const host=createEvaluationHost(developmentCase.fixture);
 try {const evaluated=await host.evaluate(developmentCase.explicitTask);expect(evaluated.ok).toBe(true);if(!evaluated.ok)return;const output=evaluated.value[0]!;
 expect(scoreData(evaluated.value,developmentCase.expected,developmentCase.fixture.scopeDigest).dataCorrect).toBe(true);
 const extra={...output,descriptor:{...output.descriptor,fields:[...output.descriptor.fields,{id:'extra',label:'Extra',role:'attribute' as const,type:{value:'text' as const,nullable:false}}]},rows:output.rows.map(row=>({...row,extra:'unexpected'}))};
 expect(scoreData([extra],developmentCase.expected,developmentCase.fixture.scopeDigest)).toMatchObject({dataCorrect:false,findings:['main:fields','main:row-fields']});
 expect(scoreData([output,output],[developmentCase.expected[0]!,developmentCase.expected[0]!],developmentCase.fixture.scopeDigest).dataCorrect).toBe(false);
 } finally {host.dispose();}
});
