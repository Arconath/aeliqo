import {
  createStandardFunctionRegistry, parseTask, validatePresentationPlan,
  type Catalog, type Diagnostic, type Experience, type MeaningDefinition, type Outcome,
  type PresentationContext, type PresentationPlan, type QuerySpec, type Result, type ResultRef,
  type Task, type ValidatedPresentation, type VisualizationSpec,
} from '@aeliqo/core';
import {createLocalDataService, type DataRecord, type QueryBudget} from '@aeliqo/runtime/data';
import {createResultStore, type ResultHandle} from '@aeliqo/runtime/results';
import {createResultCohortResolver, createTaskEvaluator, type TrustedEvaluationContext} from '@aeliqo/runtime/evaluation';
import {createMeaningAuthoring} from '@aeliqo/runtime/meaning';
import {createAeliqoPresentationRegistry, AELIQO_OPERATION_REFS} from '@aeliqo/web/region';

export const DEMO_REGION = 'aeliqo-public-demo';
export const DEMO_SCOPE = 'synthetic-public-records';
export const ABSENCE_MEANING = 'absence.days';
export type DemoView = 'table' | 'trend' | 'bar';
export interface DemoOutput {readonly task:Task; readonly descriptor:Result; readonly rows:readonly DataRecord[]; readonly handle:ResultHandle;}
export interface FixedDemoCohort {readonly source:ResultRef;readonly cohortDigest:string;readonly label:string;readonly members:number;}
export interface DemoPresentation {readonly validated:ValidatedPresentation;readonly experience:Experience;readonly plan:PresentationPlan;}
const failure = <T>(code:string,message:string):Outcome<T> => ({ok:false,diagnostics:[{code,message,retryable:false}]});
const text = {value:'text',nullable:false} as const;
const integer = {value:'integer',nullable:false} as const;
const registryResult=createStandardFunctionRegistry();
if(!registryResult.ok)throw Error('The standard function registry is unavailable.');
const functions=registryResult.value;
const employees:readonly DataRecord[]=[
 {employee_id:'ada',name:'Ada Chen',team:'Design',location:'Jakarta'},
 {employee_id:'sam',name:'Sam Rivera',team:'Engineering',location:'Lisbon'},
 {employee_id:'iman',name:'Iman Putra',team:'Engineering',location:'Bandung'},
 {employee_id:'lee',name:'Lee Morgan',team:'Operations',location:'London'},
];
const weeks=['2026-08-03','2026-08-10','2026-08-17','2026-08-24'];
const absenceDays=[[1,0,2,0],[0,1,0,1],[2,0,1,0],[0,0,0,1]];
const absences:readonly DataRecord[]=employees.flatMap((employee,index)=>weeks.map((week,weekIndex)=>({fact_id:`${employee.employee_id}-${week}`,employee_id:employee.employee_id!,name:employee.name!,team:employee.team!,week,days:absenceDays[index]![weekIndex]!})));
const products:readonly DataRecord[]=[
 {product_id:'notebook',name:'Field notebook',category:'Stationery',price:{decimal:'12.00'},stock:18},
 {product_id:'pencil',name:'Graphite pencil set',category:'Stationery',price:{decimal:'8.50'},stock:32},
 {product_id:'lamp',name:'Desk lamp',category:'Workspace',price:{decimal:'48.00'},stock:7},
 {product_id:'stand',name:'Laptop stand',category:'Workspace',price:{decimal:'64.00'},stock:11},
];
const baseCatalog:Catalog={version:'1',revision:'demo-catalog-1',functionRegistryDigest:functions.digest,entities:[
 {id:'employees',label:'Synthetic employees',identity:['employee_id'],rowGrain:['employee_id'],fields:[{id:'employee_id',label:'Employee ID',type:text,role:'identity'},{id:'name',label:'Name',type:text,role:'attribute'},{id:'team',label:'Team',type:text,role:'dimension'},{id:'location',label:'Location',type:text,role:'attribute'}]},
 {id:'absences',label:'Synthetic weekly absence records',identity:['fact_id'],rowGrain:['fact_id'],fields:[{id:'fact_id',label:'Record ID',type:text,role:'identity'},{id:'employee_id',label:'Employee ID',type:text,role:'attribute'},{id:'name',label:'Name',type:text,role:'attribute'},{id:'team',label:'Team',type:text,role:'dimension'},{id:'week',label:'Week starting',type:{value:'date',nullable:false,temporal:{calendar:'gregorian',grain:'day'}},role:'time'},{id:'days',label:'Absence days',type:integer,role:'measure'}]},
 {id:'products',label:'Synthetic products',identity:['product_id'],rowGrain:['product_id'],fields:[{id:'product_id',label:'Product ID',type:text,role:'identity'},{id:'name',label:'Name',type:text,role:'attribute'},{id:'category',label:'Category',type:text,role:'dimension'},{id:'price',label:'Price (USD)',type:{value:'decimal',nullable:false,unit:{dimension:'currency',symbol:'USD'}},role:'measure'},{id:'stock',label:'Stock',type:integer,role:'measure'}]},
],relationships:[],meanings:[],capabilities:[]};
const budget:QueryBudget={maxRows:100,maxBytes:250_000,maxMessages:16,maxMilliseconds:5000,maxColumns:16};

/** Application-owned synthetic host. The shared runtime does all query arithmetic. */
export function createDemoEngine(){
 let catalog=baseCatalog;
 let revision=0;
 let active:AbortController|undefined;
 let closed=false;
 const store=createResultStore({maxEntries:32,maxBytes:1_000_000,ttlMs:120_000});
 const handles=new Map<string,ResultHandle>();
 const resolver=createResultCohortResolver();
 let cohort:FixedDemoCohort|undefined;
 const service=createLocalDataService({snapshot:{catalog,sourceRevision:'synthetic-source-1',records:{employees,absences,products}},hostBudget:budget,sourceLimits:{rows:100,bytes:250_000},authorize:()=>closed?failure('demo.closed','The demo session is closed.'):{ok:true,value:{scopeDigest:DEMO_SCOPE,policyRevision:'demo-policy-1'}}});
 const refKey=(ref:ResultRef)=>JSON.stringify([ref.id,ref.revision,ref.outputId,ref.queryDigest,ref.scopeDigest]);
 const resolveResult=(ref:ResultRef)=>{const handle=handles.get(refKey(ref));const actual=handle?.snapshot().descriptor?.ref;return handle&&actual&&refKey(actual)===refKey(ref)?handle:undefined;};
 const context=():TrustedEvaluationContext=>({principalKey:'public-synthetic-demo',scopeDigest:DEMO_SCOPE,policyRevision:'demo-policy-1',catalogRevision:catalog.revision,functionRegistryDigest:functions.digest,grants:['task.evaluate','result.inspect'],catalog,data:service,resultStore:store,readContext:{principal:'public-synthetic-demo'},cohortResolver:resolver,resolveResult,now:()=>Date.now(),budget});
 const evaluator=createTaskEvaluator({host:{readContext:()=>closed?failure('demo.closed','The demo session is closed.'):{ok:true,value:context()}},maxMilliseconds:5000,budget});
 function task(query:QuerySpec,goal:string,outputId='main'):Task{return{version:'1',id:'demo-task',revision:String(++revision),catalogRevision:catalog.revision,functionRegistryDigest:functions.digest,regionId:DEMO_REGION,goal,needs:[],assumptions:['Synthetic demonstration data; no employee or customer records.'],kind:'data',outputs:[{id:outputId,kind:'query',query,dependsOn:[],delivery:'eager'}]};}
 const query=(entity:string,fields:readonly string[],overrides:Partial<QuerySpec>={}):QuerySpec=>({entity,fields,measures:[],relations:[],groupBy:[],population:{kind:'all-authorized'},order:[],...overrides});
 function peopleTask(team='all'):Task{return task(query('employees',['employee_id','name','team','location'],team==='all'?{}:{where:{op:'compare',field:'team',comparison:'eq',value:team}}),'Browse synthetic employees');}
 function productTask():Task{return task(query('products',['product_id','name','category','price','stock']),'Browse synthetic products');}
 function rankingTask(team='all'):Outcome<Task>{const meaning=catalog.meanings.find(item=>item.id===ABSENCE_MEANING);if(!meaning)return failure('demo.needs-meaning','Define the absence-days meaning before ranking.');return{ok:true,value:task(query('absences',['employee_id','name','team'],{groupBy:['employee_id','name','team'],measures:[{id:meaning.id,revision:meaning.revision}],order:[{field:meaning.id,direction:'desc',nulls:'last'}],...(team==='all'?{}:{where:{op:'compare',field:'team',comparison:'eq',value:team}})}),'Rank synthetic employees by absence days')};}
 function trendTask():Outcome<Task>{const meaning=catalog.meanings.find(item=>item.id===ABSENCE_MEANING);if(!meaning)return failure('demo.needs-meaning','Define the absence-days meaning first.');if(!cohort)return failure('demo.needs-cohort','Freeze the current employee collection before evaluating its trend.');return{ok:true,value:task(query('absences',['week'],{groupBy:['week'],measures:[{id:meaning.id,revision:meaning.revision}],order:[{field:'week',direction:'asc',nulls:'last'}],population:{kind:'fixed',source:cohort.source,identityKeys:['employee_id'],cohortDigest:cohort.cohortDigest}}),'Weekly absence days for the fixed synthetic cohort')};}
 function comparisonTask():Outcome<Task>{
  const meaning=catalog.meanings.find(item=>item.id===ABSENCE_MEANING);if(!meaning)return failure('demo.needs-meaning','Define absence days before comparing periods.');
  const periods=[['first-half','2026-08-03','2026-08-17'],['second-half','2026-08-17','2026-08-31']] as const;
  const outputs=periods.map(([id,from,to])=>({id,kind:'query' as const,query:query('absences',['employee_id','name'],{groupBy:['employee_id','name'],measures:[{id:meaning.id,revision:meaning.revision}],where:{op:'and',predicates:[{op:'compare',field:'week',comparison:'gte',value:from},{op:'compare',field:'week',comparison:'lt',value:to}]},order:[{field:'employee_id',direction:'asc',nulls:'last'}]}),dependsOn:[],delivery:'eager' as const}));
  return{ok:true,value:{...task(outputs[0]!.query,'Compare two synthetic fortnight periods'),kind:'data',outputs:[outputs[0]!,outputs[1]!]}};
 }
 function contributorTask(employeeId:string):Task{return task(query('absences',['fact_id','employee_id','name','team','week','days'],{where:{op:'compare',field:'employee_id',comparison:'eq',value:employeeId},order:[{field:'week',direction:'asc',nulls:'last'}]}),'Inspect supplied absence records for one employee');}
 function defineAbsenceMeaning():Outcome<MeaningDefinition>{
  const existing=catalog.meanings.find(item=>item.id===ABSENCE_MEANING);if(existing)return{ok:true,value:existing};
  const authoring=createMeaningAuthoring({catalog,registry:functions,source:{surface:'code',ownership:'code',readOnly:true}});if(!authoring.ok)return authoring;
  const field=authoring.value.field('absences','days');if(!field.ok)return field;
  const expression=authoring.value.call({id:'core.aggregate.sum',revision:'1'},[field]);if(!expression.ok)return expression;
  const defined=authoring.value.defineMeaning({id:ABSENCE_MEANING,revision:'1',label:'Absence days',description:'Sum of the supplied weekly absence-day values. This is not an absence rate or a count of people.',expression,aggregation:'additive',aggregationDimensions:[],missingPolicy:'exclude-pair',origin:'system',lifecycle:'active',authority:'approved',scope:'workspace'});if(!defined.ok)return defined;
  const next={...catalog,revision:'demo-catalog-2',meanings:[defined.value.meaning]};
  const replaced=service.replaceSnapshot({catalog:next,sourceRevision:'synthetic-source-1',records:{employees,absences,products}});if(!replaced.ok)return replaced;
  catalog=next;cohort=undefined;return{ok:true,value:defined.value.meaning};
 }
 async function evaluate(input:unknown,signal?:AbortSignal):Promise<Outcome<readonly DemoOutput[]>>{
  if(closed)return failure('demo.closed','The demo session is closed.');const parsed=parseTask(input);if(!parsed.ok)return parsed;
  if(parsed.value.regionId!==DEMO_REGION||parsed.value.kind!=='data'||parsed.value.outputs.length>4)return failure('demo.task-scope','Use a data Task with at most four outputs in the public demo region.');
  active?.abort();const controller=new AbortController();active=controller;const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
  try{const result=await evaluator.evaluate({task:parsed.value,signal:controller.signal});if(!result.ok)return result;
   try{if(controller.signal.aborted||active!==controller)return failure('demo.cancelled','The evaluation was cancelled or superseded.');const outputs:DemoOutput[]=[];for(const output of result.value.outputs){const snapshot=output.handle.snapshot();if(snapshot.status!=='ready'||!snapshot.descriptor)return failure('demo.incomplete','A complete authorized result is required by this demonstration.');handles.set(refKey(snapshot.descriptor.ref),output.handle);outputs.push({task:parsed.value,descriptor:snapshot.descriptor,rows:snapshot.batches.flatMap(batch=>batch.rows) as readonly DataRecord[],handle:output.handle});}while(handles.size>64){const key=[...handles.keys()].find(id=>cohort===undefined||id!==refKey(cohort.source));if(!key)break;handles.delete(key);}return{ok:true,value:outputs};}finally{result.value.release();}
  }finally{signal?.removeEventListener('abort',abort);if(active===controller)active=undefined;}
 }
 async function freezeCohort(output:DemoOutput,label:string):Promise<Outcome<FixedDemoCohort>>{
  if(!output.descriptor.fields.some(field=>field.id==='employee_id'))return failure('demo.cohort-grain','Choose an employee collection or employee ranking to freeze.');
  const current=context();const resolved=await resolver.resolve({source:output.descriptor.ref,identityKeys:['employee_id'],scopeDigest:DEMO_SCOPE,policyRevision:'demo-policy-1',catalogRevision:catalog.revision,deadlineAt:Date.now()+5000},{readContext:current.readContext,principalKey:current.principalKey,scopeDigest:DEMO_SCOPE,policyRevision:'demo-policy-1',catalogRevision:catalog.revision,functionRegistryDigest:functions.digest,catalog,grants:current.grants,resultStore:store,resolveResult,now:()=>Date.now()});if(!resolved.ok)return resolved;

  cohort={source:output.descriptor.ref,cohortDigest:resolved.value.tupleDigest,label,members:resolved.value.tuples.length};return{ok:true,value:cohort};
 }
 function present(output:DemoOutput,view:DemoView='table'):Outcome<DemoPresentation>{
  if(closed||output.descriptor.ref.scopeDigest!==DEMO_SCOPE||output.task.catalogRevision!==catalog.revision)return failure('demo.stale','Refresh this output before presenting it in the current catalog and scope.');
  const result=output.descriptor;const dependencies:Result[]=[result];
  for(let index=0;index<dependencies.length;index++){if(dependencies.length>64)return failure('demo.lineage-budget','The result lineage exceeds the demo budget.');for(const entry of dependencies[index]!.lineage){for(const ref of entry.inputs){if(dependencies.some(item=>refKey(item.ref)===refKey(ref)))continue;const snapshot=resolveResult(ref)?.snapshot();if(snapshot?.status!=='ready'||!snapshot.descriptor||ref.scopeDigest!==DEMO_SCOPE)return failure('demo.stale-lineage','A required result dependency is unavailable. Refresh the collection and cohort.');dependencies.push(snapshot.descriptor);}}}
  let spec:VisualizationSpec|undefined;
  if(view==='trend'){if(!result.fields.some(field=>field.id==='week')||!result.fields.some(field=>field.id===ABSENCE_MEANING))return failure('demo.unsupported-view','The trend requires a weekly absence result.');spec={version:'1',view:'trend',plot:{version:'1',root:{kind:'unit',mark:'line',result:result.ref,missing:'gap',encoding:{x:{field:'week',scale:'temporal'},y:{field:ABSENCE_MEANING,scale:'linear',zero:true}}}}};}
  if(view==='bar'){if(!result.fields.some(field=>field.id==='name')||!result.fields.some(field=>field.id===ABSENCE_MEANING))return failure('demo.unsupported-view','The bar view requires the employee absence ranking.');spec={version:'1',view:'bar',plot:{version:'1',root:{kind:'unit',mark:'bar',result:result.ref,missing:'gap',encoding:{x:{field:'name',scale:'ordinal'},y:{field:ABSENCE_MEANING,scale:'linear',zero:true}}}}};}
  const representation={id:spec?`visualization.${view}`:'data.table',revision:'1'};
  const exact={id:'data.table',revision:'1'};
  const current={scopeDigest:DEMO_SCOPE,policyRevision:'demo-policy-1',taskRevision:output.task.revision,regionRevision:String(revision),catalogRevision:catalog.revision,experienceRevision:'demo-experience-1',functionRegistryDigest:functions.digest,results:dependencies.map(item=>item.ref)};
  const experience:Experience={version:'1',id:'demo-experience',revision:'demo-experience-1',mode:'adaptive',agentAllowed:false,allowedRepresentations:['layout.stack','data.table','visualization.trend','visualization.bar'],allowedPatterns:[],composition:{allowWithoutPreset:true,maxNodes:4,maxExpansions:8},requiredOperations:[],tokenProfile:{id:'tokens.default',revision:'1'},extensionAllowlist:[],transitionPolicy:'stable'};
  const needs=[{id:'read',operation:AELIQO_OPERATION_REFS.read,fields:result.fields.map(field=>field.id),outputId:result.ref.outputId,required:true}];
  const presentationTask:Task={...output.task,needs};
  const context:PresentationContext={task:presentationTask,experience,results:dependencies,current,environment:{inlineSize:{state:'unknown'},blockSize:{state:'unknown'},textScale:{state:'unknown'},pointer:'unknown',hover:'unknown',keyboard:'unknown',locale:'en-US',direction:'ltr',reducedMotion:false,forcedColors:false},rendererCapabilities:spec?[{id:'layout.stack',revision:'1'},exact,representation]:[{id:'layout.stack',revision:'1'},exact]};
  const installed=createAeliqoPresentationRegistry({data:[{result,rows:output.rows}],visualizations:spec?[{result,context:{results:[result],catalog},datasets:[{result:result.ref,rows:output.rows}]}]:[],resolveEntity:()=>output.task.kind==='data'&&output.task.outputs[0]?.kind==='query'?output.task.outputs[0].query.entity:'record'});if(!installed.ok)return installed;
  const table={id:'exact-values',role:'table',representation:exact,result:result.ref,config:{schema:{id:'data.table.config',revision:'1'},values:{}},children:[]};
  const nodes:PresentationPlan['nodes']=spec?[{id:'root',role:'structure',representation:{id:'layout.stack',revision:'1'},config:{schema:{id:'layout.stack.config',revision:'1'},values:{}},children:['visualization','exact-values']},{id:'visualization',role:'visualization',representation,result:result.ref,config:{schema:{id:`${representation.id}.config`,revision:'1'},values:{visualization:spec}},children:[]},table]:[table];
  const plan:PresentationPlan={id:'demo-presentation',revision:String(revision),preconditions:current,rootId:spec?'root':'exact-values',nodes,links:[],coverage:[{needId:'read',nodeIds:['exact-values'],operations:[AELIQO_OPERATION_REFS.read]}],stateTransfer:[],diagnostics:[]};
  const validated=validatePresentationPlan(plan,context,installed.value);return validated.ok?{ok:true,value:{validated:validated.value,experience,plan:validated.value.plan}}:validated;
 }
 return{get catalog(){return catalog;},get cohort(){return cohort;},budget,peopleTask,productTask,rankingTask,trendTask,comparisonTask,contributorTask,defineAbsenceMeaning,evaluate,freezeCohort,present,cancel(){active?.abort();},dispose(){closed=true;active?.abort();handles.clear();store.dispose();}};
}
