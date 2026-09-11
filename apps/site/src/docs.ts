import {AeliqoDialogElement} from '@aeliqo/web/dialog';
import {AeliqoRecordListElement} from '@aeliqo/web/record-list';
import {catalogExample, CATALOG_EXAMPLE_IDS} from '@aeliqo/catalog-examples';
import {syncComponentTheme} from './site.js';

type SearchEntry = {readonly path:string;readonly title:string;readonly description:string};

// Full-document docs navigation should start at the heading, including when a
// browser restores the previous long component page before hydration.
window.scrollTo(0, 0);

if (!customElements.get('aeliqo-dialog')) customElements.define('aeliqo-dialog', AeliqoDialogElement);
const search = new AeliqoDialogElement();
search.id = 'docs-search-dialog';
search.heading = 'Search documentation';
const form = document.createElement('form');
form.setAttribute('role', 'search');
const field = document.createElement('input');
field.type = 'search';
field.name = 'q';
field.setAttribute('aria-label', 'Search documentation');
field.placeholder = 'Component, concept, or integration';
field.className = 'docs-search-field';
const results = document.createElement('ul');
results.className = 'search-results';
const status = document.createElement('p');
status.setAttribute('role', 'status');
status.setAttribute('aria-live', 'polite');
form.append(field);
search.append(form, status, results);
const main = document.querySelector<HTMLElement>('main');
if (main === null) throw Error('Documentation main landmark is unavailable.');
(main.querySelector<HTMLElement>('.reading') ?? main).append(search);

const trigger = document.querySelector<HTMLButtonElement>('.search-trigger');
if (trigger) {
  trigger.disabled = false;
  trigger.closest<HTMLElement>('.docs-search-tools')?.setAttribute('data-enhanced', 'true');
}
let entries: readonly SearchEntry[] | undefined;
const initialQuery = new URL(location.href).searchParams.get('q')?.trim() ?? '';
field.value = initialQuery;

function setQuery(query:string):void {
  const url = new URL(location.href);
  if (query.length > 0) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function validSearchIndex(data:unknown): data is SearchEntry[] {
  return Array.isArray(data) && data.every(entry => entry !== null && typeof entry === 'object' && typeof (entry as {path?:unknown}).path === 'string' && (entry as {path:string}).path.startsWith('/') && !(entry as {path:string}).path.startsWith('//') && typeof (entry as {title?:unknown}).title === 'string' && typeof (entry as {description?:unknown}).description === 'string');
}

async function loadSearchIndex():Promise<readonly SearchEntry[]> {
  if (entries !== undefined) return entries;
  const response = await fetch('/search-index.json', {headers: {accept: 'application/json'}});
  if (!response.ok) throw Error(`Search index request failed (${response.status}).`);
  const data:unknown = await response.json();
  if (!validSearchIndex(data)) throw Error('Search index has an invalid shape.');
  entries = data;
  return entries;
}

const words = (value:string):readonly string[] => value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

function searchScore(entry:SearchEntry, query:string):number | undefined {
  const queryWords = words(query);
  if (queryWords.length === 0) return 5;
  const titleWords = words(entry.title);
  const descriptionWords = words(entry.description);
  if (titleWords.join(' ') === queryWords.join(' ')) return 0;
  if (queryWords.every(word => titleWords.includes(word))) return 1;
  if (queryWords.every(word => titleWords.some(candidate => candidate.startsWith(word)))) return 2;
  const allWords = [...titleWords, ...descriptionWords];
  if (queryWords.every(word => allWords.includes(word))) return 3;
  if (queryWords.every(word => allWords.some(candidate => candidate.startsWith(word)))) return 4;
  return undefined;
}

async function updateSearch():Promise<void> {
  results.replaceChildren();
  const query = field.value.trim();
  if (entries === undefined) { status.textContent = 'Loading search index…'; return; }
  const ranked = entries.map((entry, index) => ({entry, index, score: searchScore(entry, query)}))
    .filter((match): match is {entry:SearchEntry;index:number;score:number} => match.score !== undefined)
    .sort((left, right) => left.score - right.score || left.index - right.index);
  const matches = ranked.slice(0, 20);
  status.textContent = query ? `${ranked.length} matching pages${ranked.length > matches.length ? `; first ${matches.length} shown` : ''}.` : 'Browse documentation or type to narrow the results.';
  if (matches.length === 0) status.textContent = 'No pages found. Try a component name or a broader term.';
  for (const {entry} of matches) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = entry.path;
    const title = document.createElement('strong');
    title.textContent = entry.title;
    const description = document.createElement('span');
    description.textContent = entry.description;
    link.append(title, description);
    item.append(link);
    results.append(item);
  }
}

async function openSearch():Promise<void> {
  search.open = true;
  await search.updateComplete;
  field.focus();
  void syncComponentTheme(search);
  try { await loadSearchIndex(); await updateSearch(); }
  catch { status.textContent = 'Search is unavailable. Use the documentation navigation or the no-JavaScript search page.'; }
}

trigger?.addEventListener('click', () => void openSearch());
form.addEventListener('submit', event => { event.preventDefault(); setQuery(field.value.trim()); void updateSearch(); });
field.addEventListener('input', () => { setQuery(field.value.trim()); void updateSearch(); });
document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); void openSearch(); } });
if (initialQuery.length > 0) void openSearch();

for (const mount of document.querySelectorAll<HTMLElement>('[data-example="record-list"]')) {
 if (!customElements.get('aeliqo-record-list')) customElements.define('aeliqo-record-list', AeliqoRecordListElement);
 const list = new AeliqoRecordListElement(); list.columns = [{key:'name',label:'Name'},{key:'team',label:'Team'}]; list.identity = ['id']; list.rows = [{id:'ada',name:'Ada Chen',team:'Design'}]; list.scope = {label:'Synthetic people',kind:'filtered',loaded:1,filteredTotal:1}; mount.append(list); void syncComponentTheme(mount);
 const pre = document.createElement('pre'); pre.tabIndex = 0; const code = document.createElement('code'); code.textContent = `import {AeliqoRecordListElement} from '@aeliqo/web/record-list';
if (!customElements.get('aeliqo-record-list')) customElements.define('aeliqo-record-list', AeliqoRecordListElement);
const list = new AeliqoRecordListElement();
list.columns = [{key:'name', label:'Name'}, {key:'team', label:'Team'}];
list.identity = ['id'];
list.rows = [{id:'ada', name:'Ada Chen', team:'Design'}];
list.scope = {label:'Synthetic people', kind:'filtered', loaded:1, filteredTotal:1};
document.body.append(list);`; pre.append(code); mount.append(pre);
}

const componentMount = document.querySelector<HTMLElement>('[data-component-preview]');
if (componentMount) {
 void Promise.resolve().then(() => {
  const full = componentMount.dataset.componentPreview ?? ''; const candidate = full.slice(full.indexOf('.') + 1); const id = CATALOG_EXAMPLE_IDS.find(item => item === candidate); if (!id) throw Error('The component example is unavailable.');
  const previewMount = componentMount.querySelector<HTMLElement>('[data-preview-mount]'); if (!previewMount) throw Error('The component preview mount is unavailable.');
  const previewStatus = previewMount.querySelector<HTMLElement>('[data-preview-status]'); const cleanup = catalogExample(id, previewMount); window.addEventListener('pagehide', cleanup, {once:true}); void syncComponentTheme(previewMount); if (previewStatus) previewStatus.textContent = 'Interactive preview loaded.';
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, 0)));
  const code = componentMount.closest('.reading')?.querySelector<HTMLElement>(`[data-example-code="${id}"]`); const copy = componentMount.closest('.reading')?.querySelector<HTMLButtonElement>(`[data-copy-example="${id}"]`); const copyStatus = componentMount.closest('.reading')?.querySelector<HTMLElement>('[data-copy-status]');
  if (copy && code) copy.disabled = false;
  copy?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(code?.textContent ?? ''); if (copyStatus) copyStatus.textContent = 'Example copied.'; } catch { if (copyStatus) copyStatus.textContent = 'Copy is unavailable. Select the code to copy manually.'; } });
 }).catch(() => { const previewStatus = componentMount.querySelector<HTMLElement>('[data-preview-status]'); if (previewStatus) { previewStatus.setAttribute('role', 'alert'); previewStatus.textContent = 'The interactive example could not load. Use the public API below.'; } });
}
