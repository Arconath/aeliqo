import {readFile,writeFile,mkdir,readdir,copyFile,unlink} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {resolve,dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {pages} from './src/content.mjs';
import {loadComponentSources,componentApi} from './component-api.mjs';
const root=dirname(new URL(import.meta.url).pathname);
const execFileAsync=promisify(execFile);
export const generatedRoot=resolve(root,'../../artifacts/site-source');
export const generatedPublic=resolve(root,'../../artifacts/site-public');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
async function loadCanonicalExamples(){
 const moduleUrl=pathToFileURL(resolve(root,'../../examples/catalog/index.ts')).href;
 const script=`import(${JSON.stringify(moduleUrl)}).then(({catalogExamples})=>process.stdout.write(JSON.stringify(catalogExamples)))`;
 const loaderPath=join(tmpdir(),`aeliqo-catalog-loader-${process.pid}.mjs`);
 await writeFile(loaderPath,`export async function resolve(specifier,context,nextResolve){if(context.parentURL?.includes('/examples/catalog/')&&specifier.startsWith('.')&&specifier.endsWith('.js'))return nextResolve(specifier.slice(0,-3)+'.ts',context);return nextResolve(specifier,context);}\n`,'utf8');
 let stdout;
 try{({stdout}=await execFileAsync(process.execPath,['--experimental-strip-types','--experimental-loader',loaderPath,'--input-type=module','-e',script],{cwd:resolve(root,'../..'),maxBuffer:32*1024*1024}));}finally{await unlink(loaderPath).catch(()=>{});}
 const value=JSON.parse(stdout);
 if(!Array.isArray(value)||value.some(entry=>entry===null||typeof entry!=='object'||typeof entry.id!=='string'||typeof entry.source!=='string'))throw Error('Canonical catalog example metadata is unavailable.');
 return value;
}
function exampleMarkup(metadata){
 const list=value=>value.map(item=>escape(item)).join(', ');
 return `<div class="component-preview" data-component-preview="${escape(metadata.family)}.${escape(metadata.id)}" data-preview-family="${escape(metadata.family)}" data-preview-id="${escape(metadata.id)}"><h2>Preview</h2><p class="component-preview-status" data-preview-status>Interactive preview requires JavaScript.</p></div><details class="component-example"><summary>Code and required setup</summary><pre><code data-example-code="${escape(metadata.id)}">${escape(metadata.source)}</code></pre><button type="button" data-copy-example="${escape(metadata.id)}" disabled>Copy example</button><p class="component-copy-status" data-copy-status role="status"></p></details><h2>Input fixture</h2><p>${escape(metadata.fixture)}</p><h2>Expected result</h2><p>${escape(metadata.expectedOutcome)}</p><h2>Properties and host ownership</h2><p>${list(metadata.props)}. ${escape(metadata.propsNotes)}</p><h2>States</h2><p>${list(metadata.states)}</p><h2>Keyboard behavior</h2><p>${list(metadata.keyboard)}</p><h2>Events</h2><p>${list(metadata.events)}</p>`;
}
async function filesAt(path){const result=[];for(const item of await readdir(path,{withFileTypes:true})){const p=join(path,item.name);if(item.isDirectory())result.push(...await filesAt(p));else if(p.endsWith('.d.ts'))result.push(p);}return result;}
function classDeclaration(text,name){const start=text.indexOf(`export declare class ${name} `);if(start<0)return;const open=text.indexOf('{',start);let depth=0;for(let i=open;i<text.length;i++){if(text[i]==='{')depth++;if(text[i]==='}'&&--depth===0)return text.slice(start,i+1);}throw Error(`Unclosed declaration ${name}`);}
export async function generatePages(){
 await mkdir(generatedRoot,{recursive:true});await mkdir(generatedPublic,{recursive:true});
 const home=await readFile(join(root,'index.html'),'utf8');
 await writeFile(join(generatedRoot,'index.html'),home);
 await copyFile(join(root,'public/aeliqo.png'),join(generatedPublic,'aeliqo.png'));
 const header=home.slice(home.indexOf('<a class="skip"'),home.indexOf('<main id="main">'));
 const footer=home.slice(home.indexOf('<footer'),home.indexOf('<script type="module"'));
 const catalog=JSON.parse(await readFile(resolve(root,'../../harness/components.json'),'utf8')).components;
 const declarations=await Promise.all((await filesAt(resolve(root,'../../packages/web/dist'))).map(async path=>({path,text:await readFile(path,'utf8')})));
 const componentSources=await loadComponentSources(resolve(root,'../../packages/web/src'));
 const canonicalExamples=await loadCanonicalExamples();
 const canonicalById=new Map(canonicalExamples.map(example=>[`${example.family}.${example.id}`,example]));
 const all=[...pages];
 all.push({path:'/docs/components/',title:'Component catalog',section:'Components',description:'71 owned components, grouped by purpose.',body:`<p class="lead">Start with the component that serves the task. Each entry links to the actual generated public declaration.</p>${[...new Set(catalog.map(c=>c.family))].map(family=>`<h2 id="${family}">${family[0].toUpperCase()+family.slice(1)}</h2><ul class="component-links">${catalog.filter(c=>c.family===family).map(c=>`<li><a href="/docs/components/${c.id}/">${c.name}</a></li>`).join('')}</ul>`).join('')}`});
 for(const component of catalog){const name=`Aeliqo${component.name}Element`;let api;for(const source of declarations){api=classDeclaration(source.text,name);if(api)break;}if(!api)throw Error('Missing built public declaration '+name);const metadata=componentApi(componentSources,name);if(!metadata.properties.length)throw Error('Missing component source '+name);const example=canonicalById.get(component.id);if(example===undefined)throw Error('Missing canonical catalog example '+component.id);all.push({path:`/docs/components/${component.id}/`,title:component.name,section:`Components / ${component.family}`,description:component.contract,component:component.id,body:`<p class="lead">${escape(component.contract)}</p>${exampleMarkup(example)}<h2>Properties and defaults</h2><p>Includes inherited public fields. Defaults below are read from the same source that builds this component. For unions and imported types, consult the generated declaration.</p><div class="api-table"><table><thead><tr><th>Property</th><th>Declared type</th><th>Initial value</th></tr></thead><tbody>${metadata.properties.map(prop=>`<tr><th scope="row"><code>${escape(prop.name)}</code></th><td><code>${escape(prop.type)}</code></td><td><code>${escape(prop.default)}</code></td></tr>`).join('')}</tbody></table></div><h2>Parts and theme tokens</h2><p>Statically named shadow parts in the component and its base classes: ${metadata.parts.length?metadata.parts.map(part=>`<code>${escape(part)}</code>`).join(', '):'none declared in this class chain'}. Child components expose their own parts.</p><details><summary>Referenced theme tokens</summary><p>${metadata.tokens.length?metadata.tokens.map(token=>`<code>${escape(token)}</code>`).join(', '):'Uses the shared Aeliqo theme; no additional token references in this class chain.'}</p></details><h2>Public API</h2><p>Generated from the built 0.1.0 declaration. Structured values are JavaScript properties; attribute forms are listed in the element’s property metadata.</p><pre><code>${escape(api)}</code></pre><h2>Semantics and states</h2><p>${escape(component.contract)}</p><p>Use explicit host data and current scope. The standalone component, canonical semantic binding, and adaptive region are separate embedding surfaces. Consult the example for the selected surface rather than treating a component attribute as authorization.</p><h2>Verification status</h2><p>Implementation and focused package/browser checks are recorded for this component family. Full release visual, device, and manual assistive technology verification remains pending.</p><p><a href="/docs/production/">Accessibility, performance, and production considerations</a></p>`});}
 const sidebar=`<aside class="docs-sidebar"><button class="search-trigger" type="button" disabled>Search docs ⌘K</button><label>Version <select aria-label="Documentation version"><option>0.1.0 rewrite · preview</option></select></label><p class="caption">Historical npm APIs differ.</p><nav aria-label="Documentation">${pages.filter(p=>p.path.startsWith('/docs/')).map(p=>`<a href="${p.path}">${escape(p.title)}</a>`).join('')}<a href="/docs/components/">Component catalog</a></nav></aside>`;
 const playground=await readFile(join(root,'playground.html'),'utf8');
 all.push({path:'/playground/',title:'Playground',section:'Playground',description:'Evaluate and present synthetic application data with the real Aeliqo runtime.',body:playground});
 all.push({path:'/404/',title:'Page not found',section:'404',description:'This page is unavailable.',body:'<p>The requested page could not be found.</p><p><a href="/docs/">Browse documentation</a> or <a href="/">return home</a>.</p>'});
 const inputs=[join(generatedRoot,'index.html')];
 for(const page of all){const target=join(generatedRoot,page.path,'index.html');await mkdir(dirname(target),{recursive:true});const body=page.path==='/playground/'?page.body:`<article class="reading"><p class="eyebrow">${escape(page.section)}</p><h1>${escape(page.title)}</h1>${page.body}</article>`;await writeFile(target,`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(page.title)} — Aeliqo</title><meta name="description" content="${escape(page.description)}"><link rel="icon" href="/aeliqo.png"><link rel="stylesheet" href="/src/site.css"></head><body${page.component?` data-component="${page.component}"`:''}>${header}<main id="main" class="shell ${page.path.startsWith('/docs/')?'docs-layout':page.path==='/playground/'?'playground-layout':'content-layout'}">${page.path.startsWith('/docs/')?sidebar:''}${body}</main>${footer}<script type="module" src="/src/site.ts"></script></body></html>`);inputs.push(target);}
 await writeFile(join(generatedPublic,'search-index.json'),JSON.stringify(all.map(({path,title,description})=>({path,title,description}))));
 return inputs;
}
