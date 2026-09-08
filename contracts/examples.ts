/** Compilable design examples; no unpublished SDK functions are invoked. */
import type { Environment, Task, TaskBase, QuerySpec, ResultRef, PopulationCount, Expression } from './reference.js';
export const unknownSSR: Environment = {
  inlineSize:{state:'unknown'}, blockSize:{state:'unknown'}, textScale:{state:'unknown'},
  pointer:'unknown', hover:'unknown', keyboard:'unknown', locale:'id-ID', direction:'ltr',
  reducedMotion:false, forcedColors:false,
};
export const knownCount:PopulationCount = {kind:'exact',value:100,populationDigest:'all-visible-employees-v1'};
export const aggregateResult:ResultRef = {id:'r1',revision:'v1',outputId:'ranking',queryDigest:'q1',scopeDigest:'scope1'};
export const scalar:Expression = {kind:'call',function:{id:'math.subtract',revision:'1'},arguments:[
  {kind:'literal',value:3,type:{value:'integer',nullable:false}},
  {kind:'literal',value:1,type:{value:'integer',nullable:false}},
]};
const common:TaskBase = {
  version:'1',id:'t1',revision:'1',catalogRevision:'cat1',functionRegistryDigest:'func1',regionId:'employees',
  goal:'Browse employee absence and inspect its trend',needs:[],assumptions:[],
};
const baseQuery:QuerySpec = {
  entity:'Employee',fields:['Employee.id','Employee.name'],measures:[{id:'absence.rate',revision:'1'}],
  relations:[],groupBy:['Employee.id'],population:{kind:'all-authorized'},
  order:[{field:'absence.rate',direction:'desc',nulls:'last'}],
};
export const dataTask:Task = {...common,kind:'data',outputs:[
  {id:'ranking',kind:'query',query:{...baseQuery,topK:5},dependsOn:[],delivery:'eager'},
  {id:'trend',kind:'query',query:{...baseQuery,groupBy:['Employee.id','week'],
    population:{kind:'live-output',outputId:'ranking',identityKeys:['Employee.id']}},
    dependsOn:['ranking'],delivery:'eager'},
]};
// A later view can explicitly freeze a prior population instead of silently recomputing it.
export const fixedQuery:QuerySpec = {...baseQuery,population:{kind:'fixed',source:aggregateResult,
  identityKeys:['Employee.id'],cohortDigest:'members-r1'}};
export const viewTask:Task = {...common,kind:'presentation',inputs:[aggregateResult],
  viewPreference:{representation:'data.table',strength:'explicit'}};
export const formTask:Task = {...common,kind:'form',schema:{id:'employee.edit.schema',revision:'1'},
  action:{id:'employee.update',revision:'1'}};
