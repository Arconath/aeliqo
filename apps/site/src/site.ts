import {mountPeopleExample} from './home-example.js';
import homeExampleSource from './home-example.ts?raw';

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

const source=homeExampleSource+"\nconst host = document.createElement('div');\ndocument.body.append(host);\nconst demo = mountPeopleExample(host);\n// Optional: demo.filter('Engineering');\n";
const demo = document.querySelector<HTMLElement>('#home-demo');
if (demo) {
  const example=mountPeopleExample(demo);
  function update(){const team=document.querySelector<HTMLSelectElement>('#team')?.value??'all';const count=example.filter(team);document.querySelector('#demo-status')!.textContent=`${count} of 4 synthetic people shown.`;}
  update();void syncComponentTheme(demo);document.querySelector('#team')?.addEventListener('change',update);
  document.querySelector('#demo-source')!.textContent = source;
  document.querySelector('#copy-demo')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(source);document.querySelector('#copy-status')!.textContent='Source copied.';}catch{document.querySelector('#copy-status')!.textContent='Copy unavailable. Select the source above to copy it manually.';}});
}
if (location.pathname.startsWith('/docs/')) void import('./docs.js');
if (location.pathname.startsWith('/playground/')) void import('./playground.js');
