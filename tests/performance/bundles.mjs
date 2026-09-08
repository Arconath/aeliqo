/** Installed-tarball byte/graph gate only. This is not a timing or full T30 pass. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,writeFile,lstat} from 'node:fs/promises';
import {tmpdir,platform,release,arch} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {build} from 'vite';
const root=resolve(import.meta.dirname,'../..');
function run(argv,cwd=root){const r=spawnSync(argv[0],argv.slice(1),{cwd,encoding:'utf8',timeout:180000,maxBuffer:64*1024*1024});if(r.error||r.status!==0)throw Error(`${argv.join(' ')} failed: ${r.error??''}\n${r.stdout}\n${r.stderr}`);return r.stdout;}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const digest=()=>run(['python3','scripts/gate.py','digest']).trim();
const before=digest();const sourceCommit=run(['git','rev-parse','HEAD']).trim();
await mkdir(join(root,'artifacts/performance-bundles'),{recursive:true});
const output=await mkdtemp(join(root,'artifacts/performance-bundles/run-'));
const consumer=await mkdtemp(join(tmpdir(),'aeliqo-performance-consumer-'));
const packages=[];
for(const name of ['core','runtime','web']){
 const cwd=join(root,'packages',name);run(['pnpm','build'],cwd);
 const tarball=join(output,`aeliqo-${name}-0.1.0.tgz`);run(['pnpm','pack','--out',tarball],cwd);
 const manifest=JSON.parse(run(['tar','-xOf',tarball,'package/package.json']));
 assert.equal(manifest.version,'0.1.0');assert.equal(manifest.name,`@aeliqo/${name}`);
 packages.push({name:manifest.name,path:tarball,sha256:hash(await readFile(tarball))});
}
await writeFile(join(consumer,'package.json'),JSON.stringify({private:true,type:'module',dependencies:Object.fromEntries(packages.map(p=>[p.name,`file:${p.path}`]))}));
run(['npm','install','--ignore-scripts','--no-audit','--no-fund'],consumer);
for(const p of packages)assert.equal((await lstat(join(consumer,'node_modules',p.name))).isSymbolicLink(),false);
const lock=await readFile(join(consumer,'package-lock.json'));await writeFile(join(output,'consumer-package-lock.json'),lock);
const workloads=[
 {id:'button',code:"import {AeliqoButtonElement} from '@aeliqo/web/button'; customElements.define('perf-button',AeliqoButtonElement);",budget:15*1024,incremental:true,direct:true},
 {id:'input',code:"import {AeliqoInputElement} from '@aeliqo/web/input'; customElements.define('perf-input',AeliqoInputElement);",budget:15*1024,incremental:true,direct:true},
 {id:'metric',code:"import {AeliqoMetricElement} from '@aeliqo/web/metric'; customElements.define('perf-metric',AeliqoMetricElement);",budget:15*1024,incremental:true,direct:true},
 {id:'table',code:"import {AeliqoTableElement} from '@aeliqo/web/table'; customElements.define('perf-table',AeliqoTableElement);",budget:40*1024,incremental:true,direct:true},
 {id:'core-planner-validation',code:"import {parseCatalog,parseTask,parseExperience,createQueryPlanner,validatePresentationPlan,composePresentation} from '@aeliqo/core'; globalThis.aeliqoPerformance={parseCatalog,parseTask,parseExperience,createQueryPlanner,validatePresentationPlan,composePresentation};",budget:70*1024},
 {id:'region-table',code:"import {AeliqoRegionElement,createAeliqoPresentationRegistry} from '@aeliqo/web/region'; import {createLocalDataService} from '@aeliqo/runtime/data'; import {createResultStore} from '@aeliqo/runtime/results'; import {parseTask,validatePresentationPlan,createStandardFunctionRegistry} from '@aeliqo/core'; import {AeliqoTableElement} from '@aeliqo/web/table'; import {createRegionStore} from '@aeliqo/runtime/regions'; import {createTaskEvaluator} from '@aeliqo/runtime/evaluation'; customElements.define('perf-region',AeliqoRegionElement); customElements.define('aeliqo-table',AeliqoTableElement); globalThis.aeliqoPerformance={createRegionStore,createTaskEvaluator,createLocalDataService,createResultStore,createAeliqoPresentationRegistry,parseTask,validatePresentationPlan,createStandardFunctionRegistry};",budget:160*1024},
];
const rows=[];
for(const workload of workloads){
 const entry=join(consumer,`${workload.id}.js`);await writeFile(entry,workload.code);
 const modes=workload.incremental?['total','excluding-lit']:['total'];const measurements=[];
 for(const mode of modes){
  const bundled=await build({configFile:false,root:consumer,logLevel:'error',build:{write:false,minify:true,target:'es2022',sourcemap:false,rolldownOptions:{input:entry,external:mode==='excluding-lit'?id=>id==='lit'||id.startsWith('lit/')||id.startsWith('@lit/')||id==='lit-html'||id.startsWith('lit-html/')||id==='lit-element'||id.startsWith('lit-element/'):undefined,output:{format:'es'}}}});
  const outputs=(Array.isArray(bundled)?bundled.flatMap(x=>x.output):bundled.output);const chunks=[];const moduleSet=new Set();
  for(const chunk of outputs){const bytes=Buffer.from(chunk.type==='chunk'?chunk.code:chunk.source);const path=`${workload.id}-${mode}-${chunk.fileName.replaceAll('/','_')}`;await writeFile(join(output,path),bytes);if(chunk.type==='chunk')Object.keys(chunk.modules).forEach(id=>moduleSet.add(id));chunks.push({path,kind:chunk.type,bytes:bytes.length,gzipBytes:gzipSync(bytes).length,sha256:hash(bytes)});}
  const modules=[...moduleSet].sort().map(id=>id.startsWith(consumer)?id.slice(consumer.length+1):id);
  const forbidden=modules.filter(id=>id.includes('@aeliqo/agent/')||id.includes('@aeliqo/devtools/')||id.includes('/apps/studio/')||id.startsWith('node:')||id.includes('__vite-browser-external')||(workload.direct&&(id.includes('@aeliqo/runtime/')||id.includes('@aeliqo/core/dist/query/')||id.includes('@aeliqo/core/dist/presentation/')||id.includes('@aeliqo/web/dist/visualization/'))));
  measurements.push({mode,chunks,modules,forbidden,jsGzipBytes:chunks.filter(c=>c.kind==='chunk').reduce((sum,c)=>sum+c.gzipBytes,0),cssBytes:chunks.filter(c=>c.path.endsWith('.css')).reduce((sum,c)=>sum+c.bytes,0)});
 }
 const measured=measurements.find(m=>m.mode===(workload.incremental?'excluding-lit':'total'));rows.push({id:workload.id,entry:workload.code,budgetBytes:workload.budget,budgetMetric:workload.incremental?'JS gzip with only Lit packages external':'total JS gzip',passed:measured.jsGzipBytes<=workload.budget&&measurements.every(m=>m.forbidden.length===0),measurements});
}
const after=digest();assert.equal(after,before,'Source changed during bundle measurement');
const report={sourceCommit,sourceDigest:before,sourceChangedDuringRun:false,environment:{node:process.version,vite:'8.2.2',os:platform(),release:release(),arch:arch(),target:'es2022',minified:true,gzip:'node:zlib default'},packages,consumerLockSha256:hash(lock),consumerDirectory:consumer,rows,bundleGate:rows.every(r=>r.passed)?'pass':'fail',T30:'blocked',limits:['This proves selected browser export byte sizes and rendered module graphs, not actual interaction correctness or execution/parse latency.','Incremental builds externalize only Lit and retain all Aeliqo shared platform code; total builds include Lit.','Timing, browser traces, large workloads, cleanup/heap and real mobile hardware remain required.']};
await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({report:join(output,'report.json'),gate:report.bundleGate,rows:rows.map(r=>({id:r.id,passed:r.passed,budget:r.budgetBytes,measurements:r.measurements.map(m=>({mode:m.mode,gzip:m.jsGzipBytes,forbidden:m.forbidden}))}))},null,2));
if(report.bundleGate==='fail')process.exitCode=1;
