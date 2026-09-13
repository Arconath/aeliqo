import {readFile,writeFile,mkdir,copyFile,rm} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {loadPublicDocs} from '../docs/docs-artifact.mjs';
const root=dirname(new URL(import.meta.url).pathname);
const webRoot=resolve(root,'../web');
const docsRoot=resolve(root,'../docs');
const playgroundRoot=resolve(root,'../playground');
export const generatedRoot=resolve(root,'artifacts/site-source');
export const generatedPublic=resolve(root,'artifacts/site-public');
export const publicDocsManifest=resolve(docsRoot,'vendor/public-docs/manifest.json');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export async function generatePages(){
 await rm(generatedRoot,{recursive:true,force:true});await rm(generatedPublic,{recursive:true,force:true});
 await mkdir(generatedRoot,{recursive:true});await mkdir(generatedPublic,{recursive:true});
 const home=await readFile(join(webRoot,'index.html'),'utf8');
 await writeFile(join(generatedRoot,'index.html'),home);
 await copyFile(join(webRoot,'public/aeliqo.png'),join(generatedPublic,'aeliqo.png'));
 const header=home.slice(home.indexOf('<a class="skip"'),home.indexOf('<main id="main">')).replace(' aria-current="page"','');
 const footer=home.slice(home.indexOf('<footer'),home.indexOf('<script type="module"'));
 const {artifact}=await loadPublicDocs(publicDocsManifest);
 const all=artifact.pages.map(page=>({...page}));
 const sidebarLinks=all.filter(page=>page.path.startsWith('/docs/')&&page.component===undefined&&!['/docs/components/','/docs/search/'].includes(page.path)).map(page=>`<a href="${page.path}">${escape(page.title)}</a>`).join('');
 const sidebar=`<aside class="docs-sidebar"><input class="docs-nav-toggle visually-hidden" id="docs-nav-toggle" type="checkbox"><label class="docs-nav-summary" for="docs-nav-toggle">Browse documentation <span aria-hidden="true">⌄</span></label><div class="docs-sidebar-content"><div class="docs-search-tools"><form class="docs-search-fallback" role="search" aria-label="Search documentation" action="/docs/search/" method="get"><label class="visually-hidden" for="docs-sidebar-search">Search documentation</label><input id="docs-sidebar-search" name="q" type="text" inputmode="search" placeholder="Component or concept"><button type="submit">Search</button></form><button class="search-trigger" type="button" disabled aria-keyshortcuts="Control+K Meta+K" aria-controls="docs-search-dialog">Search docs <span aria-hidden="true">⌘K / Ctrl+K</span></button></div><label>Version <select aria-label="Documentation version"><option>0.1.0 rewrite · preview</option></select></label><p class="caption">Historical npm APIs differ.</p><nav aria-label="Documentation">${sidebarLinks}<a href="/docs/search/">Search all docs</a><a href="/docs/components/">Component catalog</a></nav></div></aside>`;
 const playground=await readFile(join(playgroundRoot,'playground.html'),'utf8');
 all.push({path:'/playground/',title:'Playground',section:'Playground',description:'Evaluate and present synthetic application data with the real Aeliqo runtime.',body:playground});
 all.push({path:'/404/',title:'Page not found',section:'404',description:'This page is unavailable.',body:'<p>The requested page could not be found.</p><p><a href="/docs/">Browse documentation</a> or <a href="/">return home</a>.</p>'});
 const inputs=[join(generatedRoot,'index.html')];
 for(const page of all){const target=join(generatedRoot,page.path,'index.html');await mkdir(dirname(target),{recursive:true});const body=page.path==='/playground/'?page.body:`<article class="reading"><p class="eyebrow">${escape(page.section)}</p><h1>${escape(page.title)}</h1>${page.body}</article>`;const docsNavigation=page.path.startsWith('/docs/')?sidebar:'';await writeFile(target,`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(page.title)} — Aeliqo</title><meta name="description" content="${escape(page.description)}"><link rel="icon" href="/aeliqo.png"><link rel="stylesheet" href="/src/site.css"></head><body${page.component?` data-component="${page.component}"`:''}>${header}<main id="main" class="shell ${page.path.startsWith('/docs/')?'docs-layout':page.path==='/playground/'?'playground-layout':'content-layout'}">${docsNavigation}${body}</main>${footer}<script type="module" src="/src/site.ts"></script></body></html>`);inputs.push(target);}
 await writeFile(join(generatedPublic,'search-index.json'),JSON.stringify(all.map(({path,title,description})=>({path,title,description}))));
 return inputs;
}
