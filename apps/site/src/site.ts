import {AeliqoRecordListElement} from '@aeliqo/web/record-list';

const theme = document.querySelector<HTMLSelectElement>('#theme');
const media = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(value: string) {
  document.documentElement.dataset.theme = value === 'system' ? (media.matches ? 'dark' : 'light') : value;
  void syncComponentTheme(document);
}
export async function syncComponentTheme(root: Document | ShadowRoot | Element): Promise<void> {
  for (const element of root.querySelectorAll<HTMLElement>('*')) {
    if (!element.localName.startsWith('aeliqo-')) continue;
    element.setAttribute('data-aeliqo-theme', document.documentElement.dataset.theme ?? 'light');
    await (element as HTMLElement & {updateComplete?: Promise<unknown>}).updateComplete;
    if (element.shadowRoot) await syncComponentTheme(element.shadowRoot);
  }
}
let preference = 'system';
try { const saved = localStorage.getItem('aeliqo-theme'); if (saved === 'light' || saved === 'dark') preference = saved; } catch {}
if (theme) { theme.value = preference; applyTheme(preference); theme.addEventListener('change', () => { preference = theme.value; applyTheme(preference); try { localStorage.setItem('aeliqo-theme', preference); } catch {} }); }
media.addEventListener('change', () => applyTheme(preference));

const source = `import {AeliqoRecordListElement} from '@aeliqo/web/record-list';
if (!customElements.get('aeliqo-record-list')) {
  customElements.define('aeliqo-record-list', AeliqoRecordListElement);
}
const list = document.createElement('aeliqo-record-list');
list.columns = [{key: 'name', label: 'Name'}, {key: 'team', label: 'Team'}];
list.identity = ['id'];
list.rows = [{id: 'ada', name: 'Ada Chen', team: 'Design'}];
list.scope = {label: 'Synthetic people', kind: 'filtered', loaded: 1, filteredTotal: 1};
document.body.append(list);`;
const demo = document.querySelector('#home-demo');
if (demo) {
  if (!customElements.get('aeliqo-record-list')) customElements.define('aeliqo-record-list', AeliqoRecordListElement);
  const rows = [{id:'ada',name:'Ada Chen',team:'Design',location:'Jakarta'}, {id:'sam',name:'Sam Rivera',team:'Engineering',location:'Lisbon'}, {id:'iman',name:'Iman Putra',team:'Engineering',location:'Bandung'}, {id:'lee',name:'Lee Morgan',team:'Operations',location:'London'}];
  const list = new AeliqoRecordListElement(); list.columns = [{key:'name',label:'Name'}, {key:'team',label:'Team'}, {key:'location',label:'Location'}]; list.identity = ['id']; list.entity = 'person';
  function update() { const team = document.querySelector<HTMLSelectElement>('#team')?.value ?? 'all'; const selected = rows.filter(row => team === 'all' || row.team === team); list.rows = selected; list.scope = {label:team === 'all' ? 'All synthetic people' : `${team} · synthetic people`,kind:'filtered',loaded:selected.length,filteredTotal:selected.length}; document.querySelector('#demo-status')!.textContent = `${selected.length} of ${rows.length} synthetic people shown.`; }
  demo.append(list); update(); void syncComponentTheme(demo); document.querySelector('#team')?.addEventListener('change',update);
  document.querySelector('#demo-source')!.textContent = source;
  document.querySelector('#copy-demo')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(source);document.querySelector('#copy-status')!.textContent='Source copied.';}catch{document.querySelector('#copy-status')!.textContent='Copy unavailable. Select the source above to copy it manually.';}});
}
if (location.pathname.startsWith('/docs/')) void import('./docs.js');
