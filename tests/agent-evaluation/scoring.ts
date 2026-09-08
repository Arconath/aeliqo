import type {EvaluatedOutput} from './host.js';
export interface ExpectedOutput{readonly id:string;readonly fields:readonly string[];readonly grain:readonly string[];readonly rows:readonly Readonly<Record<string,unknown>>[];readonly orderMatters:boolean;readonly coverage:'complete'|'partial'|'sample'|'unknown';}
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item!==null&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([left],[right])=>left.localeCompare(right))):item);
export function scoreData(outputs:readonly EvaluatedOutput[],expected:readonly ExpectedOutput[],scopeDigest:string){
 const findings:string[]=[];
 if(outputs.length!==expected.length)findings.push('output-count');
 for(const wanted of expected){const output=outputs.find(item=>item.descriptor.ref.outputId===wanted.id);if(!output){findings.push(`${wanted.id}:missing-output`);continue;}if(output.descriptor.ref.scopeDigest!==scopeDigest)findings.push(`${wanted.id}:scope`);if(canonical([...output.descriptor.rowGrain].sort())!==canonical([...wanted.grain].sort()))findings.push(`${wanted.id}:grain`);if(output.descriptor.coverage.kind!==wanted.coverage)findings.push(`${wanted.id}:coverage`);
  const project=(row:Readonly<Record<string,unknown>>)=>Object.fromEntries(wanted.fields.map(field=>[field,Object.hasOwn(row,field)?row[field]:{missing:true}]));
  const actual=output.rows.map(project).map(canonical);const truth=wanted.rows.map(project).map(canonical);if(!wanted.orderMatters){actual.sort();truth.sort();}if(canonical(actual)!==canonical(truth))findings.push(`${wanted.id}:values-or-order`);
 }
 return{dataCorrect:findings.length===0,findings,uiTaskCompletion:null,narrativeGrounding:null};
}
export function wilsonInterval(successes:number,trials:number){if(!Number.isSafeInteger(trials)||!Number.isSafeInteger(successes)||trials<0||successes<0||successes>trials)throw Error('Invalid trial counts.');if(trials===0)return null;const z=1.959963984540054,p=successes/trials,denominator=1+z*z/trials,center=(p+z*z/(2*trials))/denominator,margin=z*Math.sqrt((p*(1-p)+z*z/(4*trials))/trials)/denominator;return{lower:Math.max(0,center-margin),upper:Math.min(1,center+margin),confidence:0.95,trials};}
