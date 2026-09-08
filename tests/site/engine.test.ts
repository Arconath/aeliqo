import {expect,it} from 'vitest';
import {createDemoEngine,ABSENCE_MEANING,type DemoOutput} from '../../apps/site/src/playground-engine.js';
import type {Outcome} from '@aeliqo/core';
function value<T>(outcome:Outcome<T>):T{if(!outcome.ok)throw Error(JSON.stringify(outcome.diagnostics));return outcome.value;}
function first(outputs:readonly DemoOutput[]):DemoOutput{if(!outputs[0])throw Error('missing output');return outputs[0];}
it('evaluates employee filters and validates the real table presentation',async()=>{
 const engine=createDemoEngine();try{const output=first(value(await engine.evaluate(engine.peopleTask('Engineering'))));expect(output.rows.map(row=>row.name)).toEqual(['Sam Rivera','Iman Putra']);expect(output.descriptor.coverage.kind).toBe('complete');const presented=value(engine.present(output));expect(presented.plan.nodes[0]?.representation.id).toBe('data.table');}finally{engine.dispose();}
});
it('defines the typed meaning and evaluates fixed-cohort trend arithmetic and lineage',async()=>{
 const engine=createDemoEngine();try{expect(engine.rankingTask()).toMatchObject({ok:false,diagnostics:[{code:'demo.needs-meaning'}]});value(engine.defineAbsenceMeaning());const people=first(value(await engine.evaluate(engine.peopleTask('Engineering'))));const cohort=value(await engine.freezeCohort(people,'Engineering at freeze time'));expect(cohort.members).toBe(2);const trend=first(value(await engine.evaluate(value(engine.trendTask()))));expect(trend.rows.map(row=>row[ABSENCE_MEANING])).toEqual([2,1,1,1]);expect(trend.descriptor.lineage[0]?.inputs).toEqual([people.descriptor.ref]);value(engine.present(trend,'trend'));const ranking=first(value(await engine.evaluate(value(engine.rankingTask()))));expect(ranking.rows.map(row=>row[ABSENCE_MEANING])).toEqual([3,3,2,1]);value(engine.present(ranking,'bar'));}finally{engine.dispose();}
});
it('retains authorized results on cancellation and rejects stale catalog presentations',async()=>{
 const engine=createDemoEngine();try{const people=first(value(await engine.evaluate(engine.peopleTask())));const pending=engine.evaluate(engine.peopleTask('Design'));engine.cancel();expect((await pending).ok).toBe(false);expect(people.handle.snapshot().status).toBe('ready');value(engine.defineAbsenceMeaning());expect(engine.present(people)).toMatchObject({ok:false,diagnostics:[{code:'demo.stale'}]});}finally{engine.dispose();}
});
it('rejects malformed and cross-region tasks and evaluates decimal product values without a model',async()=>{
 const engine=createDemoEngine();try{expect((await engine.evaluate({})).ok).toBe(false);expect((await engine.evaluate({...engine.peopleTask(),regionId:'another-region'})).ok).toBe(false);const products=first(value(await engine.evaluate(engine.productTask())));expect(products.rows[0]?.price).toEqual({decimal:'12.00'});value(engine.present(products));}finally{engine.dispose();}
});
it('evaluates named period outputs and drills into supplied contributor facts',async()=>{
 const engine=createDemoEngine();try{value(engine.defineAbsenceMeaning());const comparison=value(await engine.evaluate(value(engine.comparisonTask())));expect(comparison.map(output=>output.descriptor.ref.outputId)).toEqual(['first-half','second-half']);expect(comparison.map(output=>output.rows.map(row=>row[ABSENCE_MEANING]))).toEqual([[1,2,0,1],[2,1,1,1]]);for(const output of comparison)value(engine.present(output));const contributor=first(value(await engine.evaluate(engine.contributorTask('sam'))));expect(contributor.rows.map(row=>row.days)).toEqual([0,1,0,1]);expect(contributor.rows.every(row=>row.employee_id==='sam')).toBe(true);}finally{engine.dispose();}
});
