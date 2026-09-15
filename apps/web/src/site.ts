import { prepareDeploymentAnalytics } from './analytics.js';
import { startDeploymentTelemetry } from './telemetry.js';

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
  const elements = [...(root instanceof HTMLElement ? [root] : []), ...root.querySelectorAll<HTMLElement>('*')];
  for (const element of elements) {
    if (!element.localName.startsWith('aeliqo-')) continue;
    element.setAttribute('data-aeliqo-theme', document.documentElement.dataset.theme ?? 'light');
    await (element as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
    if (element.shadowRoot) await syncComponentTheme(element.shadowRoot);
  }
}
let preference = 'system';
try {
  const saved = localStorage.getItem('aeliqo-theme');
  if (saved === 'light' || saved === 'dark') preference = saved;
} catch {}
if (theme) {
  theme.value = preference;
  applyTheme(preference);
  theme.addEventListener('change', () => {
    preference = theme.value;
    applyTheme(preference);
    try {
      localStorage.setItem('aeliqo-theme', preference);
    } catch {}
  });
}
media.addEventListener('change', () => applyTheme(preference));

function setNavOpen(open: boolean, restoreFocus = false): void {
  document.documentElement.dataset.navOpen = open ? 'true' : 'false';
  navToggle?.setAttribute('aria-expanded', String(open));
  if (!open && restoreFocus) navToggle?.focus();
}
if (navToggle && primaryNav) {
  navToggle.addEventListener('click', () => setNavOpen(navToggle.getAttribute('aria-expanded') !== 'true'));
  primaryNav.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a')) setNavOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.documentElement.dataset.navOpen === 'true') {
      event.preventDefault();
      setNavOpen(false, true);
    }
  });
  narrowNav.addEventListener('change', (event) => {
    if (!event.matches) setNavOpen(false);
  });
}

// Both files are deployment-owned and ship disabled. They are not requested
// from previews, localhost, SDK examples, or any non-public origin.
void startDeploymentTelemetry();
void prepareDeploymentAnalytics();

document.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
  const path = event.composedPath();
  const viewport = path.find(
    (node) => node instanceof HTMLElement && node.getAttribute('part')?.split(/\s+/u).includes('scroll'),
  );
  if (!(viewport instanceof HTMLElement) || path[0] !== viewport || viewport.scrollWidth <= viewport.clientWidth)
    return;
  event.preventDefault();
  if (event.key === 'Home') {
    viewport.scrollLeft = 0;
    return;
  }
  const rtl = getComputedStyle(viewport).direction === 'rtl';
  const end = viewport.scrollWidth - viewport.clientWidth;
  if (event.key === 'End') {
    viewport.scrollLeft = rtl ? -end : end;
    return;
  }
  const direction = event.key === 'ArrowRight' ? 1 : -1;
  viewport.scrollBy({ left: direction * 40, behavior: 'auto' });
});

const source = `const app = createAeliqoApp({
  resources: [{resource: people, data}],
  authority,
});

app.mount({
  target: document.querySelector('#people'),
  regionId: 'people',
  resourceId: 'people',
});

await app.render({
  regionId: 'people',
  intent: {
    version: '1', id: 'browse-people', kind: 'browse',
    resource: 'people', fields: ['name', 'team', 'location'],
  },
});`;
const demo = document.querySelector<HTMLElement>('#home-demo');
async function setupHomeDemo(demoRoot: HTMLElement): Promise<void> {
  const { mountPeopleExample } = await import('./home-example.js');
  const example = mountPeopleExample(demoRoot);
  const teamControl = document.querySelector<HTMLSelectElement>('#team');
  const status = document.querySelector<HTMLElement>('#demo-status');
  const evaluateButton = document.querySelector<HTMLButtonElement>('#demo-evaluate');
  const manualButton = document.querySelector<HTMLButtonElement>('#demo-manual');
  const flowSteps = [...document.querySelectorAll<HTMLElement>('[data-flow-step]')];
  const setFlow = (current: string): void => {
    for (const step of flowSteps) {
      if (step.dataset.flowStep === current) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    }
  };
  async function renderIntent(): Promise<void> {
    const selectedTeam = teamControl?.value ?? 'all';
    setFlow('request');
    if (status) status.textContent = 'Validating and rendering the intent…';
    if (evaluateButton) evaluateButton.disabled = true;
    try {
      const receipt = await example.render(selectedTeam);
      if (receipt.status !== 'renderer-ready') throw new Error(receipt.diagnostics[0]?.message ?? receipt.status);
      setFlow('view');
      if (status)
        status.textContent = `${selectedTeam === 'all' ? '4' : '2'} of 4 synthetic people in an exact Result · ${receipt.presentation.plan.nodes[0]?.representation.id ?? 'registered view'} · 0 model calls.`;
      void syncComponentTheme(demoRoot);
    } catch {
      if (status) status.textContent = 'The intent failed safely. The previous valid interface remains available.';
    } finally {
      if (evaluateButton) evaluateButton.disabled = false;
    }
  }
  evaluateButton?.addEventListener('click', () => void renderIntent());
  teamControl?.addEventListener('change', () => void renderIntent());
  manualButton?.addEventListener('click', () => {
    if (teamControl) teamControl.value = 'all';
    void renderIntent();
  });
  void renderIntent();
  document.querySelector('#demo-source')!.textContent = source;
  document.querySelector('#copy-demo')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(source);
      document.querySelector('#copy-status')!.textContent = 'Source copied.';
    } catch {
      document.querySelector('#copy-status')!.textContent =
        'Copy unavailable. Select the source above to copy it manually.';
    }
  });
  window.addEventListener('pagehide', () => example.dispose(), { once: true });
}
if (demo) void setupHomeDemo(demo);
if (document.body.dataset.docs === 'true') void import('/docs-src/docs.js');
if (location.pathname.startsWith('/playground/')) void import('/playground-src/playground.js');
