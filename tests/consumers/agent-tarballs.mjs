/**
 * Build, install and execute the agent boundary from actual package tarballs
 * outside the pnpm workspace. This is a bounded consumer proof for the
 * installed core/runtime/agent graph; it does not certify every adapter or host.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createServer} from "node:http";
import {access, copyFile, mkdir, mkdtemp, readFile, readdir, lstat, realpath, writeFile} from "node:fs/promises";
import {tmpdir, platform, release, arch} from "node:os";
import {extname, join, resolve} from "node:path";
import {spawnSync} from "node:child_process";
import {gzipSync} from "node:zlib";
import {chromium} from "@playwright/test";

const root = resolve(import.meta.dirname, "../..");
const output = join(root, "artifacts/agent-consumers");
await mkdir(output, {recursive: true});
const runDirectory = await mkdtemp(join(output, "run-"));
const consumer = await mkdtemp(join(tmpdir(), "aeliqo-agent-consumer-"));
const consumerReal = await realpath(consumer);


function run(argv, cwd, encoding = "utf8", env = process.env) {
  const result = spawnSync(argv[0], argv.slice(1), {cwd, encoding, env, timeout: 180_000});
  if (result.error || result.status !== 0) {
    throw new Error(`${argv.join(" ")} failed: ${result.error ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return result.stdout;
}

const hash = (bytes, algorithm = "sha256", encoding = "hex") => createHash(algorithm).update(bytes).digest(encoding);
const fileExists = async path => { try { await access(path); return true; } catch (error) { if (error?.code === "ENOENT") return false; throw error; } };
const sourceDigest = () => run(["python3", "scripts/gate.py", "digest"], root).trim();

const before = sourceDigest();
for (const [name, version] of [["core", "0.1.0"], ["runtime", "0.1.0"], ["agent", "0.1.0"]]) {
  const directory = join(root, "packages", name);
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  assert.equal(manifest.name, `@aeliqo/sdk-${name}`);
  assert.equal(manifest.version, version);
  assert.notEqual(manifest.private, true);
  run(["pnpm", "build"], directory);
}

const packages = [];
for (const name of ["core", "runtime", "agent"]) {
  const directory = join(root, "packages", name);
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  const tarball = join(runDirectory, `aeliqo-${name}-0.1.0.tgz`);
  run(["pnpm", "pack", "--out", tarball], directory);
  const bytes = await readFile(tarball);
  const packed = JSON.parse(run(["tar", "-xOf", tarball, "package/package.json"], root));
  assert.equal(packed.name, manifest.name);
  assert.equal(packed.version, manifest.version);
  assert.equal(packed.license, "Apache-2.0");
  for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
    assert(!JSON.stringify(packed[field] ?? {}).includes("workspace:"), `${name} has a workspace alias in ${field}`);
  }
  packages.push({name: packed.name, version: packed.version, path: tarball, bytes,
    sha256: hash(bytes), integrity: `sha512-${hash(bytes, "sha512", "base64")}`});
}

await writeFile(join(consumer, "package.json"), JSON.stringify({private: true, type: "module"}) + "\n");
run(["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact",
  ...packages.map(item => item.path), "typescript@7.0.2", "vite@8.2.2", "@playwright/test@1.63.0", "@types/node@24.13.3"], consumer);
const lockBytes = await readFile(join(consumer, "package-lock.json"));
const lock = JSON.parse(lockBytes);
for (const item of packages) {
  const location = `node_modules/${item.name}`;
  assert.equal(lock.packages[location].version, item.version);
  assert.equal(lock.packages[location].integrity, item.integrity);
  assert.deepEqual(Object.keys(lock.packages).filter(key => key.endsWith(location)), [location], `Duplicate ${item.name}`);
  const entries = run(["tar", "-tzf", item.path], root).trim().split("\n");
  for (const entry of entries) {
    assert(entry.startsWith("package/") && !entry.split("/").includes(".."), `Unsafe archive path ${entry}`);
    if (entry.endsWith("/")) continue;
    const installed = await readFile(join(consumer, location, entry.slice("package/".length)));
    const packed = run(["tar", "-xOf", item.path, entry], root, null);
    assert.equal(hash(installed), hash(packed), `Installed ${item.name} bytes differ for ${entry}`);
  }
}
for (const [name, version] of Object.entries({typescript: "7.0.2", vite: "8.2.2", "@playwright/test": "1.63.0", "@types/node": "24.13.3"})) {
  assert.equal(lock.packages[`node_modules/${name}`].version, version);
  assert.match(lock.packages[`node_modules/${name}`].integrity, /^sha512-/);
}
assert.equal(lock.packages["node_modules/@aeliqo/runtime"].dependencies["@aeliqo/core"], "0.1.0");
assert.equal(lock.packages["node_modules/@aeliqo/agent"].dependencies["@aeliqo/core"], "0.1.0");
assert.deepEqual(Object.keys(lock.packages).filter(key => key.startsWith("node_modules/@aeliqo/runtime/node_modules/")), []);
assert.deepEqual(Object.keys(lock.packages).filter(key => key.startsWith("node_modules/@aeliqo/agent/node_modules/")), []);
await writeFile(join(runDirectory, "consumer-package-lock.json"), lockBytes);

const fixture=await import('../contracts/fixtures.ts');
const compositionFixture={plan:fixture.presentationPlan,task:fixture.presentationTask,result:fixture.result,experience:fixture.experience,environment:fixture.environment};
const probe = `
import {createNarrativeVerifier, createAgentBinder, containAgentProposal,createAgentCapabilityRegistry,createAgentCapabilityDispatcher,createTaskBindingCapability,createAgentSession,createAgentCompositionRegistry,validateAgentComposition} from '@aeliqo/agent';
import {createStandardFunctionRegistry,validatePresentationPlan} from '@aeliqo/core';
import {createLocalDataService} from '@aeliqo/runtime/data';
import {createResultStore} from '@aeliqo/runtime/results';
export async function probe() {
 const check = (value, message) => {if (!value) throw Error(message);};
 const ref={id:'result',revision:'1',outputId:'rows',queryDigest:'query',scopeDigest:'scope'};
 const type={value:'decimal',nullable:false};
 const descriptor={version:'1',ref,taskId:'task',fields:[{id:'id',label:'ID',type:{value:'text',nullable:false},role:'identity'},{id:'value',label:'Value',type,role:'measure'}],identity:['id'],rowGrain:['id'],counts:{loaded:1,population:{kind:'exact',value:1,populationDigest:'population'}},precision:{kind:'exact'},coverage:{kind:'complete',populationDigest:'population'},consistency:{kind:'snapshot',snapshotId:'snapshot',sourceRevisions:{source:'1'}},evidence:{kind:'observed',source:{id:'source',revision:'1'}},filters:[],warnings:[],lineage:[]};
 const store=createResultStore();
 const handle=store.begin({principalKey:'principal',scopeDigest:'scope',policyRevision:'policy',catalogRevision:'catalog',functionRegistryDigest:'functions',queryDigest:'query',sourceRevision:'1',outputId:'rows',taskId:'task',requestId:'request',populationDigest:'population'});
 async function* events(){yield {kind:'descriptor',descriptor};yield {kind:'batch',result:ref,sequence:0,rows:[{id:'a',value:{decimal:'9007199254740993.01'}}]};yield {kind:'complete',result:ref,finalCoverage:descriptor.coverage};}
 for await(const _ of handle.subscribe(events())){}
 const verifier=createNarrativeVerifier({readContext:()=>({ok:true,value:{principalKey:'principal',scopeDigest:'scope',policyRevision:'policy',catalogRevision:'catalog',functionRegistryDigest:'functions',grants:['result.inspect'],resolveResult:()=>handle}})});
 const claim={version:'1',id:'claim',kind:'value',cell:{result:ref,field:'value',identity:{id:'a'},type,populationDigest:'population',filters:[]},value:{decimal:'9007199254740993.01'}};
 const valid=verifier.verify(claim);check(valid.ok&&valid.value.state==='verified','exact evidence');
 const wrong=verifier.verify({...claim,value:{decimal:'9007199254740993.02'}});check(wrong.ok&&wrong.value.state==='unverified','false value');
 const prose=verifier.verify({version:'1',id:'prose',kind:'inference',text:'Therefore causation.',references:[ref]});check(prose.ok&&prose.value.state==='unverified','prose');
 store.revoke({principalKey:'principal'});check(!verifier.verify(claim).ok&&handle.snapshot().batches.length===0,'revocation');
 store.dispose();
 const registry=createStandardFunctionRegistry();check(registry.ok,'registry');
 const definition={id:'total',revision:'7',label:'Total',explanation:'Sum',output:{value:'decimal',nullable:true},implementation:{kind:'expression',expression:{kind:'call',function:{id:'core.aggregate.sum',revision:'1'},arguments:[{kind:'field',ref:'value'}]}},dependencies:[],functionRegistryDigest:registry.value.digest,origin:'system',lifecycle:'active',scope:'workspace',authority:'approved',aggregation:'additive',aggregationDimensions:[],missingPolicy:'exclude-pair'};
 const catalog={version:'1',revision:'catalog',functionRegistryDigest:registry.value.digest,entities:[{id:'rows',label:'Rows',identity:['id'],rowGrain:['id'],fields:descriptor.fields}],relationships:[],meanings:[definition],capabilities:[]};
 const data=createLocalDataService({snapshot:{catalog,sourceRevision:'source',records:{rows:[{id:'a',value:{decimal:'9007199254740993.01'}}]}}});
 const planned=await data.plan({version:'1',requestId:'plan',catalogRevision:'catalog',target:{taskId:'task',outputId:'total'},query:{entity:'rows',fields:['id'],groupBy:['id'],measures:[{id:'total',revision:'7'}],relations:[],population:{kind:'all-authorized'},order:[]},budget:{maxRows:100,maxBytes:500000,maxMessages:8,maxMilliseconds:10000,maxColumns:20}});check(planned.ok,'analytical plan');
 const accepted=planned.value;const computedStore=createResultStore();const computedHandle=computedStore.begin({requestId:'result',principalKey:'principal',scopeDigest:accepted.scopeDigest,...(accepted.policyRevision===undefined?{}:{policyRevision:accepted.policyRevision}),catalogRevision:accepted.catalogRevision,functionRegistryDigest:accepted.functionRegistryDigest,sourceRevision:accepted.sourceRevision,queryDigest:accepted.queryDigest,outputId:'total',taskId:'task',populationDigest:accepted.populationDigest});
 for await(const _ of computedHandle.subscribe(data.execute(accepted))){}
 const computed=computedHandle.snapshot().descriptor;check(computed,'computed descriptor');const field=computed.fields.find(field=>field.id==='total');check(field.derivation?.revision==='7','metric version preserved');
 const computedVerifier=createNarrativeVerifier({readContext:()=>({ok:true,value:{principalKey:'principal',scopeDigest:accepted.scopeDigest,...(accepted.policyRevision===undefined?{}:{policyRevision:accepted.policyRevision}),catalogRevision:accepted.catalogRevision,functionRegistryDigest:accepted.functionRegistryDigest,grants:['result.inspect'],resolveResult:()=>computedHandle}})});
 const computedClaim={...claim,cell:{result:computed.ref,field:'total',identity:{id:'a'},type:field.type,definition:field.derivation,populationDigest:computed.coverage.populationDigest,filters:computed.filters}};
 const checkedComputed=computedVerifier.verify(computedClaim);check(checkedComputed.ok&&checkedComputed.value.state==='verified','computed grounding');
 const {definition:omitted,...unversioned}=computedClaim.cell;check(!computedVerifier.verify({...computedClaim,cell:unversioned}).ok,'omitted metric version rejected');const current={scopeDigest:accepted.scopeDigest,policyRevision:accepted.policyRevision??'policy',taskRevision:'1',regionRevision:'1',catalogRevision:catalog.revision,experienceRevision:'experience',functionRegistryDigest:registry.value.digest,results:[]};
 const task={version:'1',id:'task',revision:'1',regionId:'region',catalogRevision:catalog.revision,functionRegistryDigest:registry.value.digest,goal:'Show approved totals',kind:'data',outputs:[{id:'total',kind:'query',query:accepted.query,dependsOn:[],delivery:'eager'}],needs:[],assumptions:[]};
 const proposal={requestId:'proposal',targetRegionId:'region',effect:'read',preconditions:current,value:task};
 const binder=createAgentBinder({host:{readContext:()=>({ok:true,value:{principalKey:'principal',regionId:'region',goalEpoch:'goal',current,catalog,functionRegistry:registry.value,grants:['task.propose','catalog.read']}})}});
 let repairs=0;const repaired=await containAgentProposal({requestId:'loop',targetRegionId:'region',goalEpoch:'goal',budget:{maxTurns:3,maxRepairs:1,maxMilliseconds:1000,maxProposalBytes:65536},initial:{...proposal,actor:'model'},propose:()=>{repairs++;return proposal;},binder});check(repaired.ok&&repaired.value.stop==='complete'&&repairs===1,'real guarded repair');
 const capability=createTaskBindingCapability({binder});const capabilities=createAgentCapabilityRegistry([capability]);check(capabilities.ok,'capability registry');
 const dispatcher=createAgentCapabilityDispatcher({registry:capabilities.value,host:{readContext:()=>({ok:true,value:{principalKey:'principal',regionId:'region',goalEpoch:'goal',current,grants:['task.propose']}})}});
 const capRequest={version:'1',requestId:'cap',targetRegionId:'region',goalEpoch:'goal',capability:capability.ref,operation:'task.propose',input:proposal};
 const direct=await dispatcher.direct.invoke(capRequest);const manual=await dispatcher.manual.invoke(capRequest);check(direct.ok&&direct.value.state==='bound'&&manual.ok&&JSON.stringify(direct.value.value)===JSON.stringify(manual.value.value),'installed manual/direct binder parity');
 const external=await dispatcher.mcp.invoke({...capRequest,transport:'manual'});check(external.ok&&external.value.state==='denied'&&external.value.value===undefined,'independent external output egress');
 const session=createAgentSession({dispatcher,transport:'mcp'});const sessionResult=await session.run({request:{...capRequest,transport:'manual'},budget:{maxTurns:2,maxRepairs:1,maxMilliseconds:1000,maxProposalBytes:65536}});check(sessionResult.ok&&sessionResult.value.stop==='denied'&&sessionResult.value.transport==='mcp','trusted session transport');session.dispose();check(session.inspect().status==='closed'&&session.inspect().receipt===undefined,'closed session clears retained receipts');
 const fx=${JSON.stringify(compositionFixture)};const read={id:'data.read',revision:'1'};
 const view={ref:{id:'data.table',revision:'1'},configSchema:{id:'data.table.config',revision:'1'},roles:['table'],operations:[read],result:'required',children:{min:0,max:0},visibility:'leaf',extension:false,resolveConfig:(values,result)=>Object.keys(values).length===0&&result?{ok:true,value:{values:{},fields:result.fields.map(field=>field.id),ports:[]}}:{ok:false,diagnostics:[{code:'config.invalid',message:'Invalid config.',retryable:false}]}};
 const viewRegistry=createAgentCompositionRegistry([view]);check(viewRegistry.ok,'canonical view registry');
 const viewContext={task:{...fx.task,needs:[{id:'browse',operation:read,fields:['employee.id'],outputId:'rows',required:true}]},experience:{...fx.experience,mode:'composable',allowedRepresentations:['data.table']},results:[fx.result],current:fx.plan.preconditions,environment:fx.environment,rendererCapabilities:[view.ref]};const viewPlan={...fx.plan,coverage:[{needId:'browse',nodeIds:['table-1'],operations:[read]}]};
 const agentView=validateAgentComposition(viewPlan,viewRegistry.value,viewContext);const manualView=validatePresentationPlan(viewPlan,viewContext,viewRegistry.value);check(agentView.ok&&manualView.ok&&JSON.stringify(agentView.value.plan)===JSON.stringify(manualView.value.plan),'canonical composition parity');check(!validateAgentComposition({...viewPlan,coverage:[]},viewRegistry.value,viewContext).ok,'agent cannot omit required coverage');check(!validateAgentComposition(viewPlan,viewRegistry.value,{...viewContext,results:[]}).ok,'agent cannot invent authorized descriptor');
 const denied=await binder.bind({...proposal,effect:'business-write'});check(denied.ok&&denied.value.state==='unsupported','business write not bound');
 computedStore.dispose();
 return {canonicalCompositionParity:true,capabilityParity:true,trustedSessionTransport:true,externalEgress:true,guardedRepair:true,exact:true,falseValueRejected:true,proseUnverified:true,revokedCleared:true,computedMetricVersion:true};
}
`;
await writeFile(join(consumer,'probe.mjs'),probe);
await writeFile(join(consumer,'node.mjs'),`import {probe} from './probe.mjs'; import {realpath} from 'node:fs/promises'; import {fileURLToPath} from 'node:url';
for(const specifier of ['@aeliqo/core','@aeliqo/runtime/results','@aeliqo/agent']){const path=await realpath(fileURLToPath(import.meta.resolve(specifier)));if(!path.startsWith(${JSON.stringify(consumerReal)}+'/node_modules/'))throw Error('Non-installed resolution');}
console.log(JSON.stringify(await probe()));
`);
const nodeReport=JSON.parse(run(['node','--disallow-code-generation-from-strings','node.mjs'],consumer).trim());
await writeFile(join(consumer,'consumer.ts'),`import {createNarrativeVerifier, createAgentBinder, containAgentProposal, type AgentHost, type AgentBindingDecision, type AgentContainmentReceipt, type NarrativeAuthority, type NarrativeReceipt,createAgentSession,type AgentCapabilityDispatcher,createAgentCompositionRegistry,validateAgentComposition} from '@aeliqo/agent';
import type {OperationGrant, NarrativeClaim} from '@aeliqo/core';
declare const authority: NarrativeAuthority; declare const claim: NarrativeClaim;
const checked=createNarrativeVerifier({readContext:()=>({ok:true,value:authority})}).verify(claim);
if(checked.ok){const receipt:NarrativeReceipt=checked.value;void receipt;}
// @ts-expect-error Model quality does not create an act grant.
const invalid:OperationGrant='act';void invalid;
declare const host:AgentHost;
const binder=createAgentBinder({host});
const result=await containAgentProposal({requestId:'request',targetRegionId:'region',goalEpoch:'goal',budget:{maxTurns:2,maxRepairs:1,maxMilliseconds:1000,maxProposalBytes:4096},propose:()=>({untrusted:true}),binder});
if(result.ok){const receipt:AgentContainmentReceipt=result.value;void receipt;}
declare const dispatcher:AgentCapabilityDispatcher;const session=createAgentSession({dispatcher,transport:'mcp'});void session;
// @ts-expect-error Trust cannot be selected by an arbitrary transport label.
createAgentSession({dispatcher,transport:'trusted-ai'});
const decision:AgentBindingDecision={state:'needs-meaning',scope:'diagnostic',goalEpoch:'goal-1',diagnosticCode:'query.meaning',concept:'Total',authoringRoutes:['manual']};void decision;
`);
await writeFile(join(consumer,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',strict:true,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true,skipLibCheck:false,noEmit:true},include:['consumer.ts']}));
run(['node','node_modules/typescript/bin/tsc','-p','tsconfig.json'],consumer);
await writeFile(join(consumer,'index.html'),'<div id="status">Running</div><script type="module" src="/browser.mjs"></script>');
await writeFile(join(consumer,'browser.mjs'),`import {createOpaqueModelSecret} from '@aeliqo/agent/model';import {probe} from './probe.mjs';let browserCredentialCreationBlocked=false;try{createOpaqueModelSecret('synthetic-browser-value');}catch{browserCredentialCreationBlocked=true;}window.agentReport={...await probe(),browserCredentialCreationBlocked};document.querySelector('#status').textContent='Passed';`);
await writeFile(join(consumer,'vite.config.mjs'),`export default {build:{target:'es2022'}};`);
const browserSecretSentinel='synthetic-browser-bundle-secret-sentinel';
run(['node','node_modules/vite/bin/vite.js','build'],consumer,'utf8',{...process.env,AELIQO_BROWSER_SECRET_SENTINEL:browserSecretSentinel});
for(const relative of await readdir(join(consumer,'dist'),{recursive:true})){
 const path=join(consumer,'dist',relative);if(!(await lstat(path)).isFile())continue;
 assert(!String(await readFile(path)).includes(browserSecretSentinel),'Browser build captured an unrelated host credential value');
}
const server=createServer(async(request,response)=>{try{const pathname=new URL(request.url,'http://localhost').pathname;const path=resolve(consumer,'dist',pathname==='/'?'index.html':'.'+pathname);if(!path.startsWith(join(consumer,'dist')+'/'))throw Error('path');response.setHeader('content-type',extname(path)==='.js'?'text/javascript':'text/html');response.end(await readFile(path));}catch{response.statusCode=404;response.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;let chromiumVersion;let browserReport;
try{browser=await chromium.launch();chromiumVersion=browser.version();const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='Passed');browserReport=await page.evaluate(()=>window.agentReport);const {browserCredentialCreationBlocked,...sharedBrowserReport}=browserReport;assert.equal(browserCredentialCreationBlocked,true);assert.deepEqual(sharedBrowserReport,nodeReport);assert.deepEqual(errors,[]);}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
assert.equal(sourceDigest(),before,'Source changed during consumer proof');
await writeFile(join(runDirectory,'report.json'),JSON.stringify({sourceDigest:before,passed:true,scope:'Installed core/runtime/agent shared capability/manual binding, trusted session transport, external egress rejection, bounded repair and narrative verification; strict declarations, Node without code generation, Chromium, exact decimals, actual local analytical metric versions, false claims, unverified prose and real revoked handles.',artifacts:packages.map(({bytes,...item})=>item),consumerDirectory:consumer,node:nodeReport,browser:browserReport,environment:{node:process.version,chromium:chromiumVersion}},null,2)+'\n');
console.log('Installed agent narrative verification passed. Evidence: '+join(runDirectory,'report.json'));
