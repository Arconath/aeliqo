import {AeliqoDialogElement} from '@aeliqo/web/dialog';
import {AeliqoRecordListElement} from '@aeliqo/web/record-list';
import {syncComponentTheme} from './site.js';

if (!customElements.get('aeliqo-dialog')) customElements.define('aeliqo-dialog', AeliqoDialogElement);
const search = new AeliqoDialogElement(); search.heading = 'Search documentation';
const field = document.createElement('input'); field.type = 'search'; field.setAttribute('aria-label', 'Search documentation'); field.placeholder = 'Component, concept, or integration'; field.className = 'docs-search-field';
const results = document.createElement('ul'); results.className = 'search-results';
const status = document.createElement('p'); status.setAttribute('role','status');
search.append(field,status,results); document.body.append(search);
const trigger = document.querySelector<HTMLButtonElement>('.search-trigger');
if (trigger) trigger.disabled = false;
let entries: readonly {path:string;title:string;description:string}[] | undefined;
async function updateSearch() {
  results.replaceChildren();
  const query = field.value.trim().toLocaleLowerCase();
  if (!entries) { status.textContent = 'Loading search index…'; return; }
  const matches = entries.filter(entry => `${entry.title} ${entry.description}`.toLocaleLowerCase().includes(query)).slice(0,20);
  status.textContent = query ? `${matches.length} matching pages${matches.length === 20 ? ' shown' : ''}.` : 'Browse documentation or type to narrow the results.';
  if (matches.length === 0) status.textContent = 'No pages found. Try a component name or a broader term.';
  for (const entry of matches) { const item=document.createElement('li'); const link=document.createElement('a'); link.href=entry.path; const title=document.createElement('strong');title.textContent=entry.title;const description=document.createElement('span');description.textContent=entry.description;link.append(title,description);item.append(link);results.append(item); }
}
async function openSearch() {
  search.open = true; await search.updateComplete; field.focus(); void syncComponentTheme(search);
  if (!entries) { try { const response=await fetch('/search-index.json');if(!response.ok)throw Error();const data:unknown=await response.json();if(!Array.isArray(data)||!data.every(entry=>entry!==null&&typeof entry==='object'&&typeof entry.path==='string'&&entry.path.startsWith('/')&&!entry.path.startsWith('//')&&typeof entry.title==='string'&&typeof entry.description==='string'))throw Error();entries=data as {path:string;title:string;description:string}[];}catch{status.textContent='Search is unavailable. Use the documentation navigation.';return;} }
  await updateSearch();
}
trigger?.addEventListener('click',()=>void openSearch());
field.addEventListener('input',()=>void updateSearch());
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();void openSearch();}});

for (const mount of document.querySelectorAll<HTMLElement>('[data-example="record-list"]')) {
 if(!customElements.get('aeliqo-record-list'))customElements.define('aeliqo-record-list',AeliqoRecordListElement);
 const list=new AeliqoRecordListElement();list.columns=[{key:'name',label:'Name'},{key:'team',label:'Team'}];list.identity=['id'];list.rows=[{id:'ada',name:'Ada Chen',team:'Design'}];list.scope={label:'Synthetic people',kind:'filtered',loaded:1,filteredTotal:1};mount.append(list);void syncComponentTheme(mount);
 const pre=document.createElement('pre');const code=document.createElement('code');code.textContent=`import {AeliqoRecordListElement} from '@aeliqo/web/record-list';
if (!customElements.get('aeliqo-record-list')) customElements.define('aeliqo-record-list', AeliqoRecordListElement);
const list = new AeliqoRecordListElement();
list.columns = [{key:'name', label:'Name'}, {key:'team', label:'Team'}];
list.identity = ['id'];
list.rows = [{id:'ada', name:'Ada Chen', team:'Design'}];
list.scope = {label:'Synthetic people', kind:'filtered', loaded:1, filteredTotal:1};
document.body.append(list);`;pre.append(code);mount.append(pre);
}

const componentMount=document.querySelector<HTMLElement>('[data-component-preview]');
if(componentMount){
 void import('../../../examples/catalog/index.js').then(({catalogExample,CATALOG_EXAMPLE_IDS})=>{
  const full=componentMount.dataset.componentPreview??'';const candidate=full.slice(full.indexOf('.')+1);const id=CATALOG_EXAMPLE_IDS.find(id=>id===candidate);if(!id)throw Error('The component example is unavailable.');
  const previewStatus=componentMount.querySelector<HTMLElement>('[data-preview-status]');
  const cleanup=catalogExample(id,componentMount);window.addEventListener('pagehide',cleanup,{once:true});void syncComponentTheme(componentMount);
  if(previewStatus) previewStatus.textContent='Interactive preview loaded.';
  const code=componentMount.closest('.reading')?.querySelector<HTMLElement>(`[data-example-code="${id}"]`);
  const copy=componentMount.closest('.reading')?.querySelector<HTMLButtonElement>(`[data-copy-example="${id}"]`);
  const copyStatus=componentMount.closest('.reading')?.querySelector<HTMLElement>('[data-copy-status]');
  if(copy&&code){copy.disabled=false;copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(code.textContent??'');if(copyStatus)copyStatus.textContent='Example copied.';}catch{if(copyStatus)copyStatus.textContent='Copy is unavailable. Select the code to copy manually.';}});}
 }).catch(()=>{const previewStatus=componentMount.querySelector<HTMLElement>('[data-preview-status]');if(previewStatus){previewStatus.setAttribute('role','alert');previewStatus.textContent='The interactive example could not load. Use the public API below.';}});
}
