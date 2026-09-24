import { defineResource, type Intent, type QuerySpec } from '@aeliqo/core';
import { createQueryFunctionRegistry } from '@aeliqo/core/expressions';
import { createLocalDataService, type AuthorizeRead } from '@aeliqo/runtime/data';
import { createAeliqoApp, type WebRenderReceipt } from '@aeliqo/web/app';
import { z } from 'zod';
import { attendanceDayFilter } from './period.js';

const visiblePeriod: NonNullable<QuerySpec['period']> = {
  from: '2026-09-01T00:00:00+07:00',
  toExclusive: '2026-10-01T00:00:00+07:00',
  timezone: 'Asia/Jakarta',
  calendar: 'gregorian',
  interpretation: 'September 2026, through the last complete local day as of 6 September',
};
const asOfExclusiveDay = '2026-09-06';

const records = [
  { id: 'ada-01', employee: 'Ada', day: '2026-09-01', present: 1, eligible: 1 },
  { id: 'ben-01', employee: 'Ben', day: '2026-09-01', present: 1, eligible: 1 },
  { id: 'ada-02', employee: 'Ada', day: '2026-09-02', present: 1, eligible: 1 },
  { id: 'ben-02', employee: 'Ben', day: '2026-09-02', present: 0, eligible: 1 },
  { id: 'ada-03', employee: 'Ada', day: '2026-09-03', present: 1, eligible: 1 },
  { id: 'ben-03-leave', employee: 'Ben', day: '2026-09-03', present: 0, eligible: 0 },
  { id: 'ada-06-future', employee: 'Ada', day: '2026-09-06', present: 1, eligible: 1 },
] as const;

const functions = createQueryFunctionRegistry({ version: '2' });
if (!functions.ok) throw new Error(functions.diagnostics[0]!.message);
const ref = (id: string) => ({ id, revision: '1' }) as const;

const generated = defineResource({
  id: 'attendance',
  revision: 'attendance-1',
  label: 'Synthetic attendance',
  identity: ['id'],
  rowGrain: ['id'],
  schema: z.object({
    id: z.string(),
    employee: z.string(),
    day: z.iso.date(),
    present: z.number().int(),
    eligible: z.number().int(),
  }),
  fields: {
    id: { label: 'Observation', hidden: true },
    employee: { label: 'Employee', role: 'dimension' },
    day: { label: 'Local day', role: 'time' },
    present: { label: 'Present eligible employee-days', role: 'measure' },
    eligible: { label: 'Eligible employee-days', role: 'measure' },
  },
  meanings: [
    {
      id: 'attendance.rate',
      revision: '1',
      label: 'Attendance rate',
      explanation: 'Present eligible employee-days divided by eligible employee-days; approved leave is excluded.',
      output: { value: 'float', nullable: true },
      implementation: {
        kind: 'expression',
        expression: {
          kind: 'call',
          function: ref('core.ratio-of-sums.null'),
          arguments: [
            { kind: 'field', ref: 'present' },
            { kind: 'field', ref: 'eligible' },
          ],
        },
      },
      dependencies: [],
      functionRegistryDigest: functions.value.digest,
      origin: 'manual',
      lifecycle: 'active',
      scope: 'workspace',
      authority: 'approved',
      aggregation: 'ratio-of-sums',
      aggregationDimensions: [],
      missingPolicy: 'reject',
    },
    {
      id: 'attendance.present',
      revision: '1',
      label: 'Present employee-days',
      explanation: 'Sum of present eligible employee-days.',
      output: { value: 'integer', nullable: true },
      implementation: {
        kind: 'expression',
        expression: {
          kind: 'call',
          function: ref('core.aggregate.sum'),
          arguments: [{ kind: 'field', ref: 'present' }],
        },
      },
      dependencies: [],
      functionRegistryDigest: functions.value.digest,
      origin: 'manual',
      lifecycle: 'active',
      scope: 'workspace',
      authority: 'approved',
      aggregation: 'additive',
      aggregationDimensions: [],
      missingPolicy: 'reject',
    },
  ],
  presentation: { allowedViews: ['table', 'trend'], preferred: { analyze: 'trend' } },
});

// z.iso.date() establishes a civil day. The host declares its actual calendar
// timezone explicitly; generated resource fields otherwise default to UTC.
const resource = defineResource({
  id: generated.id,
  label: generated.label,
  schema: generated.schema,
  fields: generated.fieldMetadata,
  presentation: generated.presentation,
  catalog: {
    ...generated.catalog,
    entities: generated.catalog.entities.map((entity) => ({
      ...entity,
      fields: entity.fields.map((field) =>
        field.id === 'day'
          ? {
              ...field,
              type: {
                ...field.type,
                temporal: { calendar: 'gregorian' as const, timezone: 'Asia/Jakarta', grain: 'day' as const },
              },
            }
          : field,
      ),
    })),
  },
});

const authorize: AuthorizeRead = async ({ context }) =>
  context.principal === 'attendance-host'
    ? { ok: true, value: { scopeDigest: 'attendance-scope', policyRevision: 'attendance-policy-1' } }
    : {
        ok: false,
        diagnostics: [{ code: 'attendance.denied', message: 'The host denied this read.', retryable: false }],
      };

const app = createAeliqoApp({
  resources: [
    {
      resource,
      data: createLocalDataService({
        snapshot: {
          catalog: resource.catalog,
          sourceRevision: 'attendance-source-1',
          records: { attendance: records },
        },
        functionRegistry: functions.value,
        sourceLimits: { rows: 100, bytes: 100_000 },
        authorize,
      }),
    },
  ],
  authority: {
    read: () => ({
      ok: true,
      value: {
        principalKey: 'attendance-host',
        scopeDigest: 'attendance-scope',
        policyRevision: 'attendance-policy-1',
        experienceRevision: 'attendance-experience-1',
        grants: ['task.evaluate', 'result.inspect', 'experience.commit'],
        readContext: { principal: 'attendance-host' },
      },
    }),
  },
});

const mounted = app.mount({
  target: document.querySelector<HTMLElement>('#attendance-host')!,
  regionId: 'attendance',
  resourceId: 'attendance',
});
if (!mounted.ok) throw new Error(mounted.diagnostics[0]!.message);
const status = document.querySelector<HTMLElement>('[data-testid="attendance-status"]')!;
const values = document.querySelector<HTMLElement>('[data-testid="daily-values"]')!;
const choice = document.querySelector<HTMLElement>('#metric-choice')!;
let sequence = 0;

async function show(
  measures: readonly [
    { readonly id: string; readonly revision: string },
    ...{ readonly id: string; readonly revision: string }[],
  ],
): Promise<void> {
  const requestSequence = ++sequence;
  const intent: Intent = {
    version: '1',
    id: `attendance-${requestSequence}`,
    kind: 'analyze',
    resource: 'attendance',
    measures,
    time: { field: 'day', grain: 'day', calendar: 'gregorian', timezone: 'Asia/Jakarta' },
    filter: attendanceDayFilter(visiblePeriod, asOfExclusiveDay),
    preferredView: 'trend',
  };
  const receipt: WebRenderReceipt = await app.render({ regionId: 'attendance', intent });
  if (requestSequence !== sequence) return;
  status.textContent =
    receipt.status === 'renderer-ready'
      ? `renderer-ready:${receipt.presentation.plan.nodes.find((node) => node.id === receipt.presentation.plan.rootId)?.representation.id}`
      : `${receipt.status}:${receipt.diagnostics[0]?.code ?? 'unknown'}`;
  status.dataset.diagnostic = JSON.stringify(receipt.diagnostics);
  choice.hidden = receipt.status !== 'needs-input';
  if (receipt.status !== 'renderer-ready') return;
  values.replaceChildren();
  const rows = receipt.runtime.outputs[0]?.handle.snapshot().batches.flatMap((batch) => batch.rows) ?? [];
  for (const row of rows) {
    const item = document.createElement('li');
    item.textContent = `${row.day}: ${row[measures[0].id]}`;
    values.append(item);
  }
}

document
  .querySelector('#compare-metrics')!
  .addEventListener('click', () => void show([ref('attendance.rate'), ref('attendance.present')]));
document.querySelector('#apply-metric')!.addEventListener('click', () => {
  const selected = document.querySelector<HTMLSelectElement>('#attendance-metric')!.value;
  if (selected === 'attendance.rate' || selected === 'attendance.present') void show([ref(selected)]);
});
export function restartAttendanceJourney(): void {
  choice.hidden = true;
  status.textContent = 'Loading';
  void show([ref('attendance.rate')]);
}
restartAttendanceJourney();
