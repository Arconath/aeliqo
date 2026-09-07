/** Bounded reference guards for Master consolidation counterexamples. Not a complete production validator. */
import type { Measurement, PopulationCount, Precision, Uncertainty, ResultRef, CommitPreconditions,
  TaskOutput, PresentationNode, OperationNeed, VersionRef } from './reference.js';
export class ContractFault extends Error {
  constructor(readonly code:string,message:string) { super(message); this.name='ContractFault'; }
}
function demand(condition:unknown,code:string,message:string):asserts condition {
  if (!condition) throw new ContractFault(code,message);
}
function object(value:unknown):Record<string,unknown> {
  demand(value!==null && typeof value==='object' && !Array.isArray(value),'SHAPE','Expected object');
  const prototype=Object.getPrototypeOf(value);
  demand(prototype===Object.prototype || prototype===null,'SHAPE','Expected plain object');
  return value as Record<string,unknown>;
}
function keys(value:Record<string,unknown>,allowed:readonly string[]):void {
  for(const key of Object.keys(value)) demand(allowed.includes(key),'UNKNOWN_FIELD',`Unknown field: ${key}`);
}
function text(value:unknown,max=240):string {
  demand(typeof value==='string' && value.trim().length>0 && value.length<=max,'TEXT','Expected bounded text');
  return value;
}
function numeric(value:unknown):number {
  demand(typeof value==='number' && Number.isFinite(value),'NUMBER','Expected finite number'); return value;
}
function count(value:unknown):number {
  const n=numeric(value); demand(Number.isSafeInteger(n)&&n>=0,'COUNT','Expected nonnegative safe integer'); return n;
}
export function measurement(input:unknown):Measurement {
  const o=object(input);
  if(o.state==='unknown') { keys(o,['state']); return {state:'unknown'}; }
  keys(o,['state','value']); demand(o.state==='known','MEASUREMENT','Unknown measurement state');
  const n=numeric(o.value); demand(n>=0,'MEASUREMENT','Measurement cannot be negative');
  return {state:'known',value:n};
}
export function uncertainty(input:unknown):Uncertainty {
  const o=object(input);
  if(o.kind==='unquantified') {keys(o,['kind','reason']);return {kind:'unquantified',reason:text(o.reason)};}
  keys(o,['kind','lower','upper','interpretation']);demand(o.kind==='quantified','UNCERTAINTY','Unknown uncertainty kind');
  const lower=numeric(o.lower),upper=numeric(o.upper);demand(lower<=upper,'UNCERTAINTY','Inverted uncertainty interval');
  return {kind:'quantified',lower,upper,interpretation:text(o.interpretation)};
}
export function populationCount(input:unknown):PopulationCount {
  const o=object(input);
  if(o.kind==='unknown') {keys(o,['kind']);return {kind:'unknown'};}
  if(o.kind==='exact') {keys(o,['kind','value','populationDigest']);return {kind:'exact',value:count(o.value),populationDigest:text(o.populationDigest)};}
  keys(o,['kind','value','populationDigest','method','uncertainty']);demand(o.kind==='estimated','COUNT','Unknown count kind');
  const n=numeric(o.value);demand(n>=0 && n<=Number.MAX_SAFE_INTEGER,'COUNT','Invalid estimated count');
  return {kind:'estimated',value:n,populationDigest:text(o.populationDigest),method:text(o.method),uncertainty:uncertainty(o.uncertainty)};
}
export function precision(input:unknown):Precision {
  const o=object(input);
  if(o.kind==='exact') {keys(o,['kind']);return {kind:'exact'};}
  keys(o,['kind','method','uncertainty']);demand(o.kind==='approximate','PRECISION','Unknown precision kind');
  return {kind:'approximate',method:text(o.method),uncertainty:uncertainty(o.uncertainty)};
}
export function resultRef(input:unknown):ResultRef {
  const o=object(input);keys(o,['id','revision','outputId','queryDigest','scopeDigest']);
  return {id:text(o.id),revision:text(o.revision),outputId:text(o.outputId),queryDigest:text(o.queryDigest),scopeDigest:text(o.scopeDigest)};
}
function versionRef(input:unknown):VersionRef {
  const o=object(input);keys(o,['id','revision']);return {id:text(o.id),revision:text(o.revision)};
}
/** Validate builtin selection shape; contextual entity/policy validation is separate. */
export function validateSelection(input:unknown):void {
  const o=object(input);keys(o,['kind','selection']);demand(o.kind==='selection','EVENT','Expected selection payload');
  const s=object(o.selection);
  if(s.mode==='clear') {keys(s,['mode']);return;}
  // The prototype guard tests explicit-ID selection. Predicate-selection uses its own
  // canonical schema at production ingress and is intentionally not accepted here.
  keys(s,['mode','entity','keys','result']);demand(s.mode==='ids','EVENT','Expected explicit IDs or clear');
  text(s.entity);demand(Array.isArray(s.keys)&&s.keys.length>0&&s.keys.length<=1000,'EVENT','Invalid selection size');
  const ids=s.keys.map(value=>text(value));demand(new Set(ids).size===ids.length,'EVENT','Duplicate selected identity');
  resultRef(s.result);
}
/** Structural expression validation is bounded; semantic type/grain validation is additional. */
export function validateExpression(input:unknown,maxNodes=256,maxDepth=32):void {
  demand(Number.isSafeInteger(maxNodes)&&maxNodes>0&&Number.isSafeInteger(maxDepth)&&maxDepth>0,'BUDGET','Invalid budget');
  const stack:Array<{value:unknown;depth:number}>=[{value:input,depth:1}];let visited=0;
  while(stack.length) {
    const current=stack.pop()!;demand(++visited<=maxNodes&&current.depth<=maxDepth,'BUDGET','Expression budget exceeded');
    const o=object(current.value);
    if(o.kind==='field') {keys(o,['kind','ref']);text(o.ref);}
    else if(o.kind==='definition') {keys(o,['kind','ref']);versionRef(o.ref);}
    else if(o.kind==='literal') {
      keys(o,['kind','value','type']); const t=object(o.type);
      demand(['text','boolean','integer','float','decimal','date','instant'].includes(String(t.value)),'TYPE','Unknown literal type');
      demand(typeof t.nullable==='boolean','TYPE','Nullable flag missing');
      const v=o.value;demand(v!==undefined,'TYPE','Missing literal');
      if(v===null) demand(t.nullable,'TYPE','Nonnullable null');
      else if(t.value==='integer') demand(typeof v==='number'&&Number.isSafeInteger(v),'TYPE','Expected exact safe integer');
      else if(t.value==='float') numeric(v);
      else if(t.value==='boolean') demand(typeof v==='boolean','TYPE','Expected boolean');
      else if(t.value==='decimal') {const d=object(v);keys(d,['decimal']);demand(typeof d.decimal==='string'&&/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(d.decimal),'TYPE','Invalid decimal');}
      else demand(typeof v==='string','TYPE','Expected string/date/instant literal');
    }
    else if(o.kind==='call') {
      keys(o,['kind','function','arguments']);versionRef(o.function);
      demand(Array.isArray(o.arguments)&&o.arguments.length<=maxNodes,'SHAPE','Invalid function arguments');
      for(const arg of o.arguments) stack.push({value:arg,depth:current.depth+1});
    } else throw new ContractFault('EXPRESSION','Unknown executable expression');
  }
}
/** Semantic graph check after wire validation. Uses O(V+E) iterative topological traversal. */
export function outputOrder(outputs:readonly TaskOutput[],maximum=128):readonly string[] {
  demand(outputs.length>0&&outputs.length<=maximum,'BUDGET','Invalid output count');
  const byId=new Map(outputs.map(o=>[o.id,o]));demand(byId.size===outputs.length,'DUPLICATE','Duplicate output ID');
  const indegree=new Map<string,number>(), dependents=new Map<string,string[]>();
  for(const o of outputs) {
    text(o.id);demand(new Set(o.dependsOn).size===o.dependsOn.length,'DUPLICATE','Duplicate output dependency');
    indegree.set(o.id,o.dependsOn.length);
    for(const dep of o.dependsOn) {demand(byId.has(dep),'DEPENDENCY','Missing output dependency');
      const list=dependents.get(dep)??[];list.push(o.id);dependents.set(dep,list);}
    if(o.kind==='query'&&o.query.population.kind==='live-output')
      demand(o.dependsOn.includes(o.query.population.outputId),'DEPENDENCY','Live cohort requires explicit upstream dependency');
  }
  const queue=outputs.filter(o=>indegree.get(o.id)===0).map(o=>o.id),result:string[]=[];
  for(let i=0;i<queue.length;i++) {
    const id=queue[i]!;result.push(id);
    for(const next of dependents.get(id)??[]) {const n=indegree.get(next)!-1;indegree.set(next,n);if(n===0)queue.push(next);}
  }
  demand(result.length===outputs.length,'CYCLE','Output dependency cycle');return result;
}
/** Containment tree is NOT the interaction graph. */
export function validateTree(rootId:string,nodes:readonly PresentationNode[],maximum=256):void {
  demand(nodes.length>0&&nodes.length<=maximum,'BUDGET','Invalid node count');
  const map=new Map(nodes.map(n=>[n.id,n]));demand(map.size===nodes.length,'DUPLICATE','Duplicate node');
  demand(map.has(rootId),'ROOT','Missing root');
  const parents=new Map<string,number>();
  for(const n of nodes) for(const child of n.children) {
    demand(map.has(child),'CHILD','Missing child');parents.set(child,(parents.get(child)??0)+1);
    demand(parents.get(child)===1,'PARENT','Multiple containment parents');
  }
  demand(!parents.has(rootId),'CYCLE','Root has a parent');
  const queue=[rootId],seen=new Set<string>();
  for(let i=0;i<queue.length;i++) {const id=queue[i]!;demand(!seen.has(id),'CYCLE','Containment cycle');seen.add(id);queue.push(...map.get(id)!.children);}
  demand(seen.size===nodes.length,'ORPHAN','Unreachable/cyclic containment node');
}
const refKey=(r:ResultRef)=>JSON.stringify([r.id,r.revision,r.outputId,r.queryDigest,r.scopeDigest]);
/** A conservative read-set check; no implicit rebase or grant of permission. */
export function canCommit(expected:CommitPreconditions,current:CommitPreconditions):boolean {
  for(const key of ['scopeDigest','policyRevision','taskRevision','regionRevision','catalogRevision','experienceRevision','functionRegistryDigest'] as const)
    if(expected[key]!==current[key]) return false;
  const refs=new Set(current.results.map(refKey));
  return expected.results.every(r=>r.scopeDigest===expected.scopeDigest && refs.has(refKey(r)));
}
export interface CoverageRow { readonly needId:string; readonly nodeIds:readonly string[]; readonly operations:readonly VersionRef[] }
/** This reference checks capability witnesses, not a proof of human usability. */
export function validateCoverage(needs:readonly OperationNeed[],rows:readonly CoverageRow[],nodes:readonly PresentationNode[],
  trusted:ReadonlyMap<string,readonly VersionRef[]>):void {
  const nodeMap=new Map(nodes.map(n=>[n.id,n]));
  for(const need of needs.filter(n=>n.required)) {
    const row=rows.find(r=>r.needId===need.id);demand(row&&row.nodeIds.length>0,'COVERAGE','Missing coverage witness');
    demand(row.operations.some(op=>op.id===need.operation.id&&op.revision===need.operation.revision),'COVERAGE','Unreported required operation');
    let witnessed=false;
    for(const id of row.nodeIds) {
      const node=nodeMap.get(id);demand(node,'COVERAGE','Unknown witness node');
      if(need.outputId && node.result?.outputId!==need.outputId)continue;
      const ops=trusted.get(`${node.representation.id}@${node.representation.revision}`)??[];
      if(ops.some(op=>op.id===need.operation.id&&op.revision===need.operation.revision))witnessed=true;
    }
    demand(witnessed,'COVERAGE','Self-reported coverage is not registered capability');
  }
}
