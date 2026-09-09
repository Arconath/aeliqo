import {composePresentation} from './dist/presentation/compose.js';
import {mediumPlan} from '/Users/nino/WORKS/Personal/Idea/Project/products/aeliqo/tests/performance/workloads.mjs';
const raw=[];
for(let i=0;i<8;i++){const w=mediumPlan(); globalThis.__ingressDiagnostic=Object.create(null); globalThis.__functionDiagnostic=Object.create(null); const start=performance.now();const result=composePresentation({id:'performance-medium-composition',revision:'performance-composition-1',preconditions:w.context.current,context:w.context,candidates:w.candidates},w.registry);const ms=performance.now()-start;if(!result.ok)throw Error('composition failed'); raw.push({sample:i,totalMs:ms,inspections:globalThis.__ingressDiagnostic,functions:globalThis.__functionDiagnostic});}
console.log(JSON.stringify({diagnostic:true,instrumentationOverhead:true,node:process.version,source:'b28f627',raw},null,2));
