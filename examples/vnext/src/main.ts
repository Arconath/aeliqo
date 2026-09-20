import { createQueryFunctionRegistry } from '@aeliqo/core/expressions';
import { defineResource, type Intent } from '@aeliqo/core';
import { createLocalDataService } from '@aeliqo/runtime/data';
import { createAeliqoApp, type WebRenderReceipt } from '@aeliqo/web/app';
import { z } from 'zod';

const PEOPLE = Object.freeze([
  { id: 'p-1', name: 'Ada Chen', team: 'Design', location: 'Jakarta' },
  { id: 'p-2', name: 'Sam Rivera', team: 'Engineering', location: 'Lisbon' },
  { id: 'p-3', name: 'Iman Putra', team: 'Engineering', location: 'Bandung' },
  { id: 'p-4', name: 'Lee Morgan', team: 'Operations', location: 'London' },
]);

const HEADCOUNT = Object.freeze([
  { id: '2026-03', month: '2026-03-01', headcount: 118 },
  { id: '2026-04', month: '2026-04-01', headcount: 121 },
  { id: '2026-05', month: '2026-05-01', headcount: 124 },
  { id: '2026-06', month: '2026-06-01', headcount: 127 },
  { id: '2026-07', month: '2026-07-01', headcount: 126 },
  { id: '2026-08', month: '2026-08-01', headcount: 130 },
]);

const people = defineResource({
  id: 'people',
  revision: 'vnext-people-1',
  label: 'People',
  identity: ['id'],
  schema: z.object({ id: z.string(), name: z.string(), team: z.string(), location: z.string() }),
  fields: {
    name: { label: 'Name', role: 'attribute' },
    team: { label: 'Team', role: 'dimension' },
    location: { label: 'Location', role: 'attribute' },
  },
  presentation: { allowedViews: ['table', 'cards'] },
});

const workforce = defineResource({
  id: 'workforce',
  revision: 'vnext-workforce-1',
  label: 'Monthly workforce headcount',
  identity: ['id'],
  rowGrain: ['month'],
  schema: z.object({ id: z.string(), month: z.iso.date(), headcount: z.number().int() }),
  fields: {
    id: { label: 'Snapshot ID', hidden: true },
    month: { label: 'Month', role: 'time' },
    headcount: { label: 'Headcount', role: 'measure' },
  },
  meanings: [
    {
      id: 'month-headcount',
      revision: '1',
      label: 'Month end headcount',
      explanation: 'Employees active at the end of each month.',
      output: { value: 'integer', nullable: false, grain: ['month'] },
      implementation: {
        kind: 'expression',
        expression: {
          kind: 'call',
          function: { id: 'core.aggregate.sum', revision: '1' },
          arguments: [{ kind: 'field', ref: 'headcount' }],
        },
      },
      dependencies: [],
      functionRegistryDigest: 'core-query-2',
      origin: 'manual',
      lifecycle: 'active',
      scope: 'workspace',
      authority: 'approved',
      aggregation: 'semi-additive',
      aggregationDimensions: ['month'],
      missingPolicy: 'reject',
    },
  ],
  presentation: { allowedViews: ['table', 'trend', 'bar'], preferred: { analyze: 'bar' } },
});

const functions = createQueryFunctionRegistry({ version: '2' });
if (!functions.ok) throw new Error(functions.diagnostics[0]!.message);

function authority() {
  return {
    ok: true as const,
    value: {
      principalKey: 'vnext-browser',
      scopeDigest: 'vnext-scope',
      policyRevision: 'vnext-policy-1',
      experienceRevision: 'vnext-experience-1',
      grants: ['task.evaluate', 'result.inspect', 'experience.commit'],
      readContext: { principal: 'vnext-browser' },
    },
  };
}

const authorize = ({ context }: { readonly context: { readonly principal?: string } }) =>
  context.principal === 'vnext-browser'
    ? { ok: true as const, value: { scopeDigest: 'vnext-scope', policyRevision: 'vnext-policy-1' } }
    : {
        ok: false as const,
        diagnostics: [{ code: 'vnext.denied', message: 'Browser fixture access denied.', retryable: false }],
      };

const app = createAeliqoApp({
  resources: [
    {
      resource: people,
      data: createLocalDataService({
        snapshot: { catalog: people.catalog, sourceRevision: 'vnext-people-data-1', records: { people: PEOPLE } },
        functionRegistry: functions.value,
        sourceLimits: { rows: 100, bytes: 250_000 },
        authorize,
      }),
    },
    {
      resource: workforce,
      data: createLocalDataService({
        snapshot: {
          catalog: workforce.catalog,
          sourceRevision: 'vnext-workforce-data-1',
          records: { workforce: HEADCOUNT },
        },
        functionRegistry: functions.value,
        sourceLimits: { rows: 100, bytes: 250_000 },
        authorize,
      }),
    },
  ],
  authority: { read: authority },
});

const peopleMount = app.mount({
  target: document.querySelector<HTMLElement>('#people-host')!,
  regionId: 'people',
  resourceId: 'people',
});
const analysisMount = app.mount({
  target: document.querySelector<HTMLElement>('#analysis-host')!,
  regionId: 'analysis',
  resourceId: 'workforce',
});
const compareMount = app.mount({
  target: document.querySelector<HTMLElement>('#compare-host')!,
  regionId: 'compare',
  resourceId: 'people',
});
if (!peopleMount.ok || !analysisMount.ok || !compareMount.ok)
  throw new Error('The vNext example regions could not be mounted.');

const draft = document.querySelector<HTMLInputElement>('#people-draft')!;

const statusFor = (id: string): HTMLElement => document.querySelector<HTMLElement>(`#${id}-status`)!;
const statusText = (receipt: WebRenderReceipt): string => {
  if (receipt.status !== 'renderer-ready') return `${receipt.status}:${receipt.diagnostics[0]?.code ?? 'unknown'}`;
  const root = receipt.presentation.plan.nodes.find((node) => node.id === receipt.presentation.plan.rootId);
  return `renderer-ready:${root?.representation.id ?? 'unknown'}`;
};

async function render(regionId: string, statusId: string, intent: Intent): Promise<WebRenderReceipt> {
  const receipt = await app.render({ regionId, intent });
  statusFor(statusId).textContent = statusText(receipt);
  return receipt;
}

let sequence = 0;
const renderPeople = (preferredView?: string) =>
  render('people', 'people', {
    version: '1',
    id: `browse-people-${++sequence}`,
    kind: 'browse',
    resource: 'people',
    fields: ['id', 'name', 'team', 'location'],
    ...(preferredView === undefined ? {} : { preferredView }),
  });

const renderAnalysis = (preferredView: 'bar' | 'trend') =>
  render('analysis', 'analysis', {
    version: '1',
    id: `analyze-workforce-${++sequence}`,
    kind: 'analyze',
    resource: 'workforce',
    measures: [{ id: 'month-headcount', revision: '1' }],
    dimensions: ['month'],
    time: { field: 'month', grain: 'month', calendar: 'gregorian', timezone: 'UTC' },
    preferredView,
  });

const renderCompare = () =>
  render('compare', 'compare', {
    version: '1',
    id: `compare-people-${++sequence}`,
    kind: 'compare',
    resource: 'people',
    identities: [{ id: 'p-1' }, { id: 'p-2' }],
    fields: ['id', 'name', 'team', 'location'],
  });

document.querySelector('[data-action="people-table"]')!.addEventListener('click', () => void renderPeople('table'));
document.querySelector('[data-action="people-cards"]')!.addEventListener('click', () => void renderPeople('cards'));
document.querySelector('[data-action="people-invalid"]')!.addEventListener('click', () => void renderPeople('trend'));
document.querySelector('[data-action="analysis-bar"]')!.addEventListener('click', () => void renderAnalysis('bar'));
document.querySelector('[data-action="analysis-trend"]')!.addEventListener('click', () => void renderAnalysis('trend'));
document.querySelector('[data-action="compare"]')!.addEventListener('click', () => void renderCompare());

void Promise.all([renderPeople('table'), renderAnalysis('trend')]).then(() => {
  const pageStatus = document.querySelector<HTMLElement>('#page-status');
  if (pageStatus !== null) pageStatus.textContent = 'Ready';
});

Object.assign(window, { app, renderPeople, renderAnalysis, renderCompare, draft });
