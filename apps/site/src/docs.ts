import {AeliqoDialogElement} from '@aeliqo/web/dialog';
import {AeliqoRecordListElement} from '@aeliqo/web/record-list';
import {syncComponentTheme} from './site.js';

if (!customElements.get('aeliqo-dialog')) customElements.define('aeliqo-dialog', AeliqoDialogElement);
const search = new AeliqoDialogElement(); search.heading = 'Search documentation';
const field = document.createElement('input'); field.type = 'search'; field.setAttribute('aria-label', 'Search documentation'); field.placeholder = 'Component, concept, or integration'; field.className = 'docs-search-field';
const results = document.createElement('ul'); results.className = 'search-results';
const status = document.createElement('p'); status.setAttribute('role','status');
search.append(field,status,results); document.body.append(search);
const trigger = document.createElement('button'); trigger.textContent = 'Search docs ⌘K'; trigger.className = 'search-trigger';
document.querySelector('.docs-sidebar')?.prepend(trigger);
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
  if (!entries) { try { const response=await fetch('/search-index.json');if(!response.ok)throw Error();const data:unknown=await response.json();if(!Array.isArray(data)||!data.every(entry=>entry!==null&&typeof entry==='object'&&typeof entry.path==='string'&&entry.path.startsWith('/')&&!entry.path.startsWith('//')&&typeof entry.title==='string'&&typeof entry.description==='string'))throw Error();entries=data as typeof entries;}catch{status.textContent='Search is unavailable. Use the documentation navigation.';return;} }
  await updateSearch();
}
trigger.addEventListener('click',()=>void openSearch());
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
