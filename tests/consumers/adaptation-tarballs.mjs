/** Actual published-shape package installation outside the source workspace. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,mkdtemp,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,extname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {chromium,expect} from '@playwright/test';
const root=resolve(import.meta.dirname,'../..');
const output=join(root,'artifacts/adaptation-consumers');await mkdir(output,{recursive:true});
const runDirectory=await mkdtemp(join(output,'run-'));const consumer=await mkdtemp(join(tmpdir(),'aeliqo-adaptation-consumer-'));
const run=(args,cwd=root)=>{const r=spawnSync(args[0],args.slice(1),{cwd,encoding:'utf8',timeout:180000});if(r.error||r.status!==0)throw Error(`${args.join(' ')}\n${r.error??''}\n${r.stdout}\n${r.stderr}`);return r.stdout;};
const digest=()=>run(['python3','scripts/gate.py','digest']).trim();const before=digest();const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
run(['pnpm','build:platform']);
const artifacts=[];
for(const name of ['core','runtime','web']){
 const dir=join(root,'packages',name);const path=join(runDirectory,`${name}.tgz`);run(['pnpm','pack','--out',path],dir);
 const packed=JSON.parse(run(['tar','-xOf',path,'package/package.json']));assert.equal(packed.name,`@aeliqo/sdk-${name}`);assert.equal(packed.version,'0.1.0');assert.equal(packed.license,'Apache-2.0');
 for(const key of ['dependencies','peerDependencies'])assert(!JSON.stringify(packed[key]??{}).includes('workspace:'));
 if(name==='web'){assert.equal(packed.peerDependenciesMeta['@aeliqo/runtime'].optional,true);assert.equal(packed.dependencies['@aeliqo/runtime'],undefined);}
 artifacts.push({name:packed.name,path,sha256:hash(await readFile(path))});
}
await writeFile(join(consumer,'package.json'),JSON.stringify({private:true,type:'module'}));
run(['npm','install','--ignore-scripts','--no-audit','--no-fund','--save-exact',...artifacts.map(a=>a.path),'typescript@7.0.2','vite@8.2.2','@types/node@24.13.3'],consumer);
for(const a of artifacts){const installed=join(consumer,'node_modules',a.name);assert((await realpath(installed)).startsWith(await realpath(consumer)));for(const entry of run(['tar','-tzf',a.path]).trim().split('\n')){
 assert(entry.startsWith('package/')&&!entry.split('/').includes('..'));if(entry.endsWith('/'))continue;
 const original=spawnSync('tar',['-xOf',a.path,entry],{encoding:null});assert.equal(original.status,0);assert.equal(hash(await readFile(join(installed,entry.slice(8)))),hash(original.stdout));
}}
const source=(await readFile(join(root,'tests/adaptation-semantic/browser.ts'),'utf8')).replace("'../contracts/fixtures.js'","'./fixtures.js'");
await writeFile(join(consumer,'browser.ts'),source);await writeFile(join(consumer,'fixtures.ts'),await readFile(join(root,'tests/contracts/fixtures.ts')));
await writeFile(join(consumer,'index.html'),await readFile(join(root,'tests/adaptation-semantic/index.html')));
await writeFile(join(consumer,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'ESNext',moduleResolution:'Bundler',strict:true,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true,skipLibCheck:false,noEmit:true},include:['browser.ts','fixtures.ts']}));
run(['node','node_modules/typescript/bin/tsc','-p','tsconfig.json'],consumer);
run(['node','--disallow-code-generation-from-strings','--input-type=module','-e',`import assert from 'node:assert/strict';import {measureAeliqoRegionEnvironment} from '@aeliqo/web/region/adaptation';import {createPresentationAdaptationController} from '@aeliqo/runtime/presentation';assert.equal(typeof createPresentationAdaptationController,'function');assert.equal(measureAeliqoRegionEnvironment(undefined).keyboard,'unknown');assert.equal(measureAeliqoRegionEnvironment(undefined).inlineSize.state,'unknown');`],consumer);
await writeFile(join(consumer,'vite.config.mjs'),`export default {build:{target:'es2022'}};`);run(['node','node_modules/vite/bin/vite.js','build'],consumer);
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://local');const p=resolve(consumer,'dist',url.pathname==='/'?'index.html':'.'+url.pathname);if(!p.startsWith(join(consumer,'dist')+'/'))throw Error('path');res.setHeader('content-type',extname(p)==='.js'?'text/javascript':extname(p)==='.css'?'text/css':'text/html');res.end(await readFile(p));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;let chromiumVersion;
try{browser=await chromium.launch();chromiumVersion=browser.version();const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ready===true);
 const input=page.getByRole('textbox',{name:'Name',exact:true});await expect(input).toHaveValue('Ada');await input.fill('Installed draft');assert.equal((await page.evaluate(()=>window.proof.request(320))).value.status,'deferred');await expect(input).toBeFocused();await page.locator('#outside').click();await expect.poll(()=>page.locator('aeliqo-stack').evaluate(el=>el.direction)).toBe('column');await expect(input).toHaveValue('Installed draft');assert.equal((await page.evaluate(()=>window.proof.request(900))).value.status,'committed');await expect.poll(()=>page.locator('aeliqo-stack').evaluate(el=>el.direction)).toBe('row');
 assert.equal(await page.evaluate(()=>JSON.stringify(window.proof.element.presentation.plan.preconditions)===JSON.stringify(window.proof.region.snapshot().state.presentation.preconditions)),true);
 await page.screenshot({path:join(runDirectory,'installed.png'),fullPage:true});await page.evaluate(()=>window.proof.region.revoke('revoked'));await expect(input).toHaveCount(0);await expect(page.getByRole('cell',{name:'e-1',exact:true})).toHaveCount(0);assert.deepEqual(errors,[]);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
assert.equal(digest(),before,'Source changed during consumer proof');
await writeFile(join(runDirectory,'report.json'),JSON.stringify({passed:true,sourceDigest:before,artifacts,consumerDirectory:consumer,scope:'Actual core/runtime/web tarballs, optional web runtime peer, strict public declarations, Node SSR measurement without code generation, production-built Chromium default region draft/focus/replay/revoke.',environment:{node:process.version,chromium:chromiumVersion}},null,2)+'\n');console.log('Installed adaptation proof passed: '+join(runDirectory,'report.json'));
