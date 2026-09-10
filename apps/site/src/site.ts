import {mountPeopleExample} from './home-example.js';
import homeExampleSource from './home-example.ts?raw';
import {prepareDeploymentAnalytics} from './analytics.js';
import {startDeploymentTelemetry} from './telemetry.js';

const theme = document.querySelector<HTMLSelectElement>('#theme');
const media = matchMedia('(prefers-color-scheme: dark)');
const navToggle = document.querySelector<HTMLButtonElement>('#nav-toggle');
const primaryNav = document.querySelector<HTMLElement>('#site-nav');
const narrowNav = matchMedia('(max-width: 760px)');
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

function setNavOpen(open: boolean, restoreFocus = false): void {
  document.documentElement.dataset.navOpen = open ? 'true' : 'false';
  navToggle?.setAttribute('aria-expanded', String(open));
  if (!open && restoreFocus) navToggle?.focus();
}
if (navToggle && primaryNav) {
  navToggle.addEventListener('click', () => setNavOpen(navToggle.getAttribute('aria-expanded') !== 'true'));
  primaryNav.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('a')) setNavOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.documentElement.dataset.navOpen === 'true') {
      event.preventDefault();
      setNavOpen(false, true);
    }
  });
  narrowNav.addEventListener('change', event => {
    if (!event.matches) setNavOpen(false);
  });
}

// Both files are deployment-owned and ship disabled. They are not requested
// from previews, localhost, SDK examples, or any non-public origin.
void startDeploymentTelemetry();
void prepareDeploymentAnalytics();

const source=homeExampleSource+"\nconst records = mountPeopleExample(document.querySelector('#home-demo')!, document.querySelector('#demo-result')!);\nrecords.filter('Engineering');\nconst result = records.evaluate('Engineering');\nrecords.showResult(result);\n// Manual path: records.showRecords();\n";
const demo = document.querySelector<HTMLElement>('#home-demo');
if (demo) {
  const resultContainer = document.querySelector<HTMLElement>('#demo-result');
  const resultRoot: HTMLElement = resultContainer ?? demo;
  const example=mountPeopleExample(demo, resultContainer ?? undefined);
  const teamControl = document.querySelector<HTMLSelectElement>('#team');
  const status = document.querySelector<HTMLElement>('#demo-status');
  const evaluateButton = document.querySelector<HTMLButtonElement>('#demo-evaluate');
  const manualButton = document.querySelector<HTMLButtonElement>('#demo-manual');
  const resultRef = document.querySelector<HTMLElement>('#demo-result-ref');
  const flowSteps = [...document.querySelectorAll<HTMLElement>('[data-flow-step]')];
  const setFlow = (current: string): void => {
    for (const step of flowSteps) {
      if (step.dataset.flowStep === current) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    }
  };
  let showingResult = false;
  function showManual(message = ''): void {
    showingResult = false;
    example.showRecords();
    setFlow('records');
    if (status) status.textContent = message || `${example.filter(teamControl?.value ?? 'all')} of 4 synthetic people shown. Manual component path; choose a team, then request a local result.`;
    if (resultRef) resultRef.textContent = '';
  }
  function update(): void {
    const count = example.filter(teamControl?.value ?? 'all');
    if (showingResult) showManual('Selection changed. The previous result was cleared; request a new local result.');
    else if (status) status.textContent = `${count} of 4 synthetic people shown. Manual component path; choose a team, then request a local result.`;
  }
  async function evaluate(): Promise<void> {
    const selectedTeam = teamControl?.value ?? 'all';
    showingResult = true;
    setFlow('request');
    if (status) status.textContent = 'Requesting a bounded local result…';
    if (evaluateButton) evaluateButton.disabled = true;
    await Promise.resolve();
    const result = example.evaluate(selectedTeam);
    example.showResult(result);
    if (resultRef) resultRef.textContent = `Result · revision ${result.result.ref.revision} · ${result.result.ref.scopeDigest.replace('home-people-scope-', '')} scope · exact`;
    setFlow('view');
    if (status) status.textContent = `${result.rows.length} of 4 synthetic people in the exact Result. Local only; no model or network request.`;
    if (evaluateButton) evaluateButton.disabled = false;
    void syncComponentTheme(resultRoot);
  }
  showManual();
  void syncComponentTheme(demo);
  teamControl?.addEventListener('change', update);
  evaluateButton?.addEventListener('click', () => void evaluate());
  manualButton?.addEventListener('click', () => showManual('Manual component path restored. The record list is mounted directly; no Result or model call was made.'));
  document.querySelector('#demo-source')!.textContent = source;
  document.querySelector('#copy-demo')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(source);document.querySelector('#copy-status')!.textContent='Source copied.';}catch{document.querySelector('#copy-status')!.textContent='Copy unavailable. Select the source above to copy it manually.';}});
}
if (location.pathname.startsWith('/docs/')) void import('./docs.js');
if (location.pathname.startsWith('/playground/')) void import('./playground.js');
