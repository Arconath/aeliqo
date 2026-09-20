import { createQueryFunctionRegistry } from '@aeliqo/core/expressions';
import { defineResource, type Intent } from '@aeliqo/core';
import { createAeliqoRuntime } from '@aeliqo/runtime';
import { createLocalDataService } from '@aeliqo/runtime/data';
import { createAeliqoApp, type WebRenderReceipt } from '@aeliqo/web/app';
import { registerAeliqoElements } from '@aeliqo/web/register';
import { z } from 'zod';
import {
  JOB_CANCEL_REF,
  JOB_START_REF,
  JOB_STATUS_REF,
  JobBackend,
  createJobBindings,
  jobFeature,
  type JobIntent,
} from '../job/index.js';

registerAeliqoElements();

const products = Object.freeze([
  Object.freeze({ id: 'p1', name: 'Field notebook', category: 'Stationery', price: 12 }),
  Object.freeze({ id: 'p2', name: 'Signal pen', category: 'Stationery', price: 4 }),
  Object.freeze({ id: 'p3', name: 'Travel mug', category: 'Kitchen', price: 18 }),
]);

const productResource = defineResource({
  id: 'journey-products',
  revision: '1',
  label: 'Journey products',
  identity: ['id'],
  schema: z.object({ id: z.string(), name: z.string(), category: z.string(), price: z.number() }),
  fields: {
    name: { label: 'Name', role: 'attribute' },
    category: { label: 'Category', role: 'dimension' },
    price: { label: 'Price', role: 'measure' },
  },
  presentation: { allowedViews: ['table', 'detail'] },
});

const functions = createQueryFunctionRegistry({ version: '2' });
if (!functions.ok) throw new Error(functions.diagnostics[0]!.message);

interface JourneyApp {
  readonly render: (intent: Intent) => Promise<WebRenderReceipt>;
  readonly setAccess: (allowed: boolean) => void;
  readonly dispose: () => void;
}

function makeJourneyApp(regionId: string, target: HTMLElement, sourceRevision: string): JourneyApp {
  let access = true;
  const authorize = ({ context }: { readonly context: { readonly principal?: string } }) =>
    access && context.principal === 'journey-host'
      ? { ok: true as const, value: { scopeDigest: `${regionId}-scope`, policyRevision: `${regionId}-policy` } }
      : {
          ok: false as const,
          diagnostics: [
            { code: 'journey.access-denied', message: 'Host denied this synthetic remote window.', retryable: false },
          ],
        };
  const app = createAeliqoApp({
    resources: [
      {
        resource: productResource,
        data: createLocalDataService({
          snapshot: {
            catalog: productResource.catalog,
            sourceRevision,
            records: { 'journey-products': products },
          },
          functionRegistry: functions.value,
          sourceLimits: { rows: 3, bytes: 40_000 },
          authorize,
        }),
      },
    ],
    authority: {
      read: () =>
        access
          ? {
              ok: true as const,
              value: {
                principalKey: 'journey-host',
                scopeDigest: `${regionId}-scope`,
                policyRevision: `${regionId}-policy`,
                experienceRevision: 'journey-1',
                grants: ['task.evaluate', 'result.inspect', 'experience.commit'],
                readContext: { principal: 'journey-host' },
              },
            }
          : {
              ok: false as const,
              diagnostics: [{ code: 'journey.access-denied', message: 'Host revoked this surface.', retryable: false }],
            },
    },
  });
  const mount = app.mount({ target, regionId, resourceId: productResource.id });
  if (!mount.ok) throw new Error(mount.diagnostics[0]!.message);
  return Object.freeze({
    render: (intent) => app.render({ regionId, intent }),
    setAccess: (allowed) => {
      access = allowed;
    },
    dispose: () => app.dispose(),
  });
}

function browse(id: string, size = 2): Intent {
  return {
    version: '1',
    id,
    kind: 'browse',
    resource: productResource.id,
    fields: ['id', 'name', 'category', 'price'],
    preferredView: 'table',
    page: { size },
  };
}

function compare(id: string): Intent {
  return {
    version: '1',
    id,
    kind: 'compare',
    resource: productResource.id,
    identities: [{ id: 'p1' }, { id: 'p2' }],
    fields: ['id', 'name', 'category', 'price'],
  };
}

function receiptText(receipt: WebRenderReceipt): string {
  if (receipt.status === 'renderer-ready') return 'renderer-ready';
  return `${receipt.status}:${receipt.diagnostics[0]?.code ?? 'unknown'}`;
}

const publicView = document.querySelector<HTMLElement>('#public-view')!;
const publicStatus = document.querySelector<HTMLElement>('#public-status')!;
document.querySelector('[data-action="public-filter"]')!.addEventListener('click', () => {
  publicView.textContent = 'Filtered public detail: static release note for the optional island.';
  publicStatus.textContent = 'Public detail filtered without a model request';
});

const catalogStatus = document.querySelector<HTMLElement>('#catalog-status')!;
const catalogIntent = document.querySelector<HTMLOutputElement>('#catalog-intent')!;
const catalog = makeJourneyApp('catalog', document.querySelector<HTMLElement>('#catalog-view')!, 'catalog-remote-r1');
let catalogSequence = 0;

async function commitCatalog(source: 'manual' | 'fixture-agent'): Promise<void> {
  const intent = compare(`catalog-compare-${++catalogSequence}`);
  const receipt = await catalog.render(intent);
  catalogStatus.textContent = `${source} comparison ${receiptText(receipt)}`;
  catalogIntent.value = JSON.stringify({ normalizedIntent: intent.kind, selectedIds: ['p1', 'p2'], source });
  catalogIntent.dataset.normalizedIntent = intent.kind;
  catalogIntent.dataset.selectedIds = 'p1,p2';
}

document.querySelector('[data-action="catalog-manual"]')!.addEventListener('click', () => void commitCatalog('manual'));
document
  .querySelector('[data-action="catalog-agent"]')!
  .addEventListener('click', () => void commitCatalog('fixture-agent'));
document.querySelector('[data-action="catalog-reset"]')!.addEventListener('click', () => {
  catalogIntent.value = '';
  delete catalogIntent.dataset.normalizedIntent;
  delete catalogIntent.dataset.selectedIds;
  catalogStatus.textContent = 'Host reset the comparison; no selection committed';
});

const enterpriseStatus = document.querySelector<HTMLElement>('#enterprise-status')!;
const enterpriseAudit = document.querySelector<HTMLOutputElement>('#enterprise-audit')!;
const leftEnterprise = makeJourneyApp(
  'enterprise-left',
  document.querySelector<HTMLElement>('#enterprise-left-view')!,
  'remote-left-r1',
);
const rightEnterprise = makeJourneyApp(
  'enterprise-right',
  document.querySelector<HTMLElement>('#enterprise-right-view')!,
  'remote-right-r1',
);
const approve = document.querySelector<HTMLButtonElement>('[data-action="enterprise-approve"]')!;
let auditSequence = 0;

async function loadEnterprise(side: 'left' | 'right'): Promise<void> {
  const app = side === 'left' ? leftEnterprise : rightEnterprise;
  const receipt = await app.render(browse(`enterprise-${side}-${++auditSequence}`));
  enterpriseStatus.textContent = `${side} remote window ${receiptText(receipt)}; unknown total, page size 2`;
}

document.querySelector('[data-action="enterprise-left"]')!.addEventListener('click', () => void loadEnterprise('left'));
document
  .querySelector('[data-action="enterprise-right"]')!
  .addEventListener('click', () => void loadEnterprise('right'));
document.querySelector('[data-action="enterprise-review"]')!.addEventListener('click', () => {
  approve.disabled = false;
  enterpriseStatus.textContent = 'Host review required before the action can execute';
});
approve.addEventListener('click', () => {
  approve.disabled = true;
  auditSequence += 1;
  enterpriseAudit.value = `audit-${auditSequence}: host approved synthetic product review`;
  enterpriseStatus.textContent = 'Host approved action; audit trace recorded';
});
document.querySelector('[data-action="enterprise-revoke"]')!.addEventListener('click', () => {
  rightEnterprise.setAccess(false);
  void loadEnterprise('right');
});

const jobStatus = document.querySelector<HTMLElement>('#job-status')!;
const jobOutput = document.querySelector<HTMLOutputElement>('#job-output')!;
const startJob = document.querySelector<HTMLButtonElement>('[data-action="job-start"]')!;
const progressJob = document.querySelector<HTMLButtonElement>('[data-action="job-progress"]')!;
const cancelJob = document.querySelector<HTMLButtonElement>('[data-action="job-cancel"]')!;
const jobBackend = new JobBackend();
const jobRuntime = createAeliqoRuntime({
  runtimeId: 'journey-job-runtime',
  resources: [
    {
      resource: productResource,
      data: createLocalDataService({
        snapshot: {
          catalog: productResource.catalog,
          sourceRevision: 'job-host-reference-r1',
          records: { 'journey-products': products },
        },
        functionRegistry: functions.value,
        sourceLimits: { rows: 3, bytes: 40_000 },
        authorize: () => ({
          ok: true as const,
          value: { scopeDigest: 'journey-job-scope', policyRevision: 'journey-job-policy' },
        }),
      }),
    },
  ],
  authority: {
    read: () => ({
      ok: true as const,
      value: {
        principalKey: 'journey-host',
        scopeDigest: 'journey-job-scope',
        policyRevision: 'journey-job-policy',
        experienceRevision: 'journey-job-experience',
        grants: ['task.evaluate', 'result.inspect'],
        readContext: { principal: 'journey-host' },
      },
    }),
  },
});
const jobScope = jobRuntime.createLocalSurfaceScope({ id: 'journey-job-scope', allowedFeatures: [jobFeature.id] });
const jobSurface = jobRuntime.createSurface({
  scope: jobScope,
  id: 'document-job',
  feature: jobFeature,
  bindings: createJobBindings({ backend: jobBackend }),
});

function jobIntent(
  ref: typeof JOB_START_REF | typeof JOB_STATUS_REF | typeof JOB_CANCEL_REF,
  input: object,
): JobIntent {
  return { intent: ref, input } as JobIntent;
}

function reportJob(): void {
  const state = jobSurface.getSnapshot().state;
  jobStatus.textContent = `Job ${state.phase}; progress ${state.progress}%`;
  jobOutput.textContent = state.output?.ref ?? '';
  startJob.disabled = state.phase === 'running';
  progressJob.disabled = state.phase !== 'running';
  cancelJob.disabled = state.phase !== 'running';
}

startJob.addEventListener('click', () => {
  const title = document.querySelector<HTMLInputElement>('#job-draft')!.value.trim() || 'Untitled document';
  void jobSurface.request(jobIntent(JOB_START_REF, { template: title, copies: 1 })).then(reportJob);
});
progressJob.addEventListener('click', () => {
  const jobId = jobSurface.getSnapshot().state.jobId;
  if (jobId === undefined) return;
  const next = Math.min(100, jobSurface.getSnapshot().state.progress + 50);
  jobBackend.progress(jobId, next);
  void jobSurface.request(jobIntent(JOB_STATUS_REF, { jobId })).then(reportJob);
});
cancelJob.addEventListener('click', () => {
  const jobId = jobSurface.getSnapshot().state.jobId;
  if (jobId === undefined) return;
  void jobSurface.request(jobIntent(JOB_CANCEL_REF, { jobId })).then(reportJob);
});

document.querySelector<HTMLElement>('#journey-status')!.textContent =
  'Reference journeys hydrated with synthetic data and no model request.';
addEventListener('pagehide', () => {
  catalog.dispose();
  leftEnterprise.dispose();
  rightEnterprise.dispose();
  jobSurface.dispose();
  jobScope.dispose();
  jobRuntime.dispose();
});
