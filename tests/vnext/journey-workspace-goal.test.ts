import { expect, it } from 'vitest';
import { z } from 'zod';
import { compileIntent, type Intent, type QuerySpec, type Task } from '@aeliqo/core';
import { createIntentCompilerRegistry } from '@aeliqo/core/app';
import { defineDataFeature } from '@aeliqo/core/features';
import { createQueryFunctionRegistry } from '@aeliqo/core/expressions';
import {
  createPresentationRegistry,
  resolvePresentation,
  type PresentationPatternManifest,
} from '@aeliqo/core/presentation';
import { createAeliqoRuntime, createLocalDataBinding } from '@aeliqo/runtime';
import { createAeliqoPresentationRegistry } from '@aeliqo/web/region';

const REGION = 'attendance-workspace';
const GOAL = { id: 'attendance.overview', revision: '1' } as const;
const PATTERN = { id: 'attendance.overview-pattern', revision: '1' } as const;
const METRIC = { id: 'attendance.present-total', revision: '1' } as const;
const ANALYZE = { id: 'data.analyze', revision: '1' } as const;
const READ = { id: 'data.read', revision: '1' } as const;
const ROLES = ['summary', 'trend', 'breakdown'] as const;
const REF = {
  workspace: { id: 'layout.stack', revision: '1' },
  summary: { id: 'data.metric', revision: '1' },
  trend: { id: 'data.trend', revision: '1' },
  breakdown: { id: 'data.table', revision: '1' },
} as const;

const feature = defineDataFeature({
  id: 'attendance',
  schema: z.object({
    id: z.string(),
    employee: z.string(),
    day: z.iso.date(),
    team: z.string(),
    present: z.number().int(),
  }),
  identity: ['id'],
  fields: {
    employee: { role: 'dimension' },
    day: { role: 'time' },
    team: { role: 'dimension' },
    present: { role: 'measure' },
  },
  meanings: [
    {
      ...METRIC,
      label: 'Present employees',
      explanation: 'Sum of registered present observations.',
      output: { value: 'integer', nullable: false, grain: [] },
      implementation: {
        kind: 'expression',
        expression: {
          kind: 'call',
          function: { id: 'core.aggregate.sum', revision: '1' },
          arguments: [{ kind: 'field', ref: 'present' }],
        },
      },
      dependencies: [],
      functionRegistryDigest: 'core-query-2',
      origin: 'manual',
      lifecycle: 'active',
      scope: 'workspace',
      authority: 'approved',
      aggregation: 'additive',
      aggregationDimensions: [],
      missingPolicy: 'reject',
    },
  ],
});

function query(groupBy: readonly string[]): QuerySpec {
  return {
    entity: feature.entity.id,
    fields: groupBy,
    measures: [METRIC],
    relations: [],
    groupBy,
    population: { kind: 'all-authorized' },
    where: { op: 'compare', field: 'team', comparison: 'eq', value: 'Engineering' },
    order: [],
  };
}

function goalRegistry() {
  const registered = createIntentCompilerRegistry([
    {
      ref: GOAL,
      schema: z.object({ team: z.literal('Engineering') }),
      capabilities: ['data.read', 'data.analyze'],
      compile(_input, context) {
        const output = (role: (typeof ROLES)[number]) => ({
          id: role,
          kind: 'query' as const,
          query: query([role === 'trend' ? 'day' : role === 'breakdown' ? 'employee' : 'team']),
          dependsOn: [],
          delivery: 'eager' as const,
        });
        const task: Task = {
          version: '1',
          id: 'attendance-overview-task',
          revision: context.taskRevision,
          catalogRevision: context.resource.catalog.revision,
          functionRegistryDigest: context.resource.catalog.functionRegistryDigest,
          regionId: context.regionId,
          kind: 'data',
          goal: 'Engineering attendance overview',
          assumptions: [],
          outputs: [output('summary'), output('trend'), output('breakdown')],
          needs: ROLES.map((role) => ({
            id: role,
            operation: role === 'summary' ? READ : ANALYZE,
            outputId: role,
            fields: role === 'summary' ? [METRIC.id] : [role === 'trend' ? 'day' : 'employee', METRIC.id],
            required: true,
            simultaneousGroup: 'overview',
          })),
        };
        return { ok: true as const, value: task };
      },
    },
  ]);
  if (!registered.ok) throw new Error(registered.diagnostics[0].message);
  return registered.value;
}

function overviewPattern(): PresentationPatternManifest {
  return {
    ref: PATTERN,
    expand(request) {
      const matches = ROLES.map((role) => request.context.results.filter((result) => result.ref.outputId === role));
      if (
        request.context.task.id !== 'attendance-overview-task' ||
        !ROLES.every((role) => request.context.task.needs.some((need) => need.id === role && need.required)) ||
        matches.some((results) => results.length !== 1)
      )
        return {
          ok: false,
          diagnostics: [
            {
              code: 'attendance.pattern-input',
              message: 'The registered goal needs three exact results.',
              retryable: false,
            },
          ],
        };
      return {
        ok: true,
        value: {
          id: request.id,
          revision: request.revision,
          rootId: 'workspace',
          preconditions: request.preconditions,
          nodes: [
            {
              id: 'workspace',
              role: 'structure',
              representation: REF.workspace,
              config: { schema: { id: 'layout.stack.config', revision: '1' }, values: {} },
              children: [...ROLES],
            },
            ...ROLES.map((role, index) => ({
              id: role,
              role: role === 'summary' ? 'metric' : role === 'breakdown' ? 'table' : 'trend',
              representation: REF[role],
              result: matches[index]![0]!.ref,
              config: {
                schema: { id: `${REF[role].id}.config`, revision: '1' },
                values:
                  role === 'summary'
                    ? { field: METRIC.id, identityValues: { team: 'Engineering' } }
                    : role === 'trend'
                      ? { labelField: 'day', series: [{ field: METRIC.id }] }
                      : {},
              },
              children: [],
            })),
          ],
          links: [],
          coverage: ROLES.map((role) => ({
            needId: role,
            nodeIds: [role],
            operations: [role === 'summary' ? READ : ANALYZE],
          })),
          stateTransfer: [],
          diagnostics: [],
        },
      };
    },
    matches(plan, context) {
      return (
        context.task.id === 'attendance-overview-task' &&
        plan.rootId === 'workspace' &&
        plan.nodes.length === 4 &&
        ROLES.every(
          (role, index) =>
            plan.nodes[index + 1]?.representation.id === REF[role].id &&
            plan.nodes[index + 1]?.result?.outputId === role,
        )
      );
    },
  };
}

it('commits a registered summary, daily trend, and employee breakdown workspace without inventing anomaly', async () => {
  const functions = createQueryFunctionRegistry({ version: '2' });
  if (!functions.ok) throw new Error(functions.diagnostics[0].message);
  const binding = createLocalDataBinding({
    feature,
    snapshot: {
      catalog: feature.catalog,
      sourceRevision: 'attendance-1',
      records: {
        attendance: [
          { id: 'a', employee: 'Ada', day: '2026-09-01', team: 'Engineering', present: 1 },
          { id: 'b', employee: 'Sam', day: '2026-09-02', team: 'Engineering', present: 1 },
          { id: 'c', employee: 'Lee', day: '2026-09-02', team: 'Design', present: 1 },
        ],
      },
    },
    initialState: { rows: [] },
    coverage: {
      fields: ['id', 'employee', 'day', 'team', 'present'],
      metrics: [METRIC],
      operators: ['eq'],
      pagination: 'snapshot',
      stableOrder: ['id'],
      sorting: 'stable-fields-only',
      aggregation: 'registered-only',
      streaming: 'finite',
      updates: 'snapshot-replace',
      unsupported: ['streaming', 'live-updates'],
    },
    normalize: async () => ({ rows: [] }),
    serviceOptions: {
      functionRegistry: functions.value,
      authorize: () => ({ ok: true, value: { scopeDigest: 'attendance-scope', policyRevision: '1' } }),
    },
  });
  const intents = goalRegistry();
  const runtime = createAeliqoRuntime({
    runtimeId: 'attendance-runtime',
    resources: [{ resource: feature.resource, data: binding.service }],
    intents,
    authority: {
      read: () => ({
        ok: true,
        value: {
          principalKey: 'attendance-user',
          scopeDigest: 'attendance-scope',
          policyRevision: '1',
          experienceRevision: '1',
          grants: ['catalog.read', 'task.evaluate', 'result.inspect'],
          readContext: { principal: 'attendance-user' },
        },
      }),
    },
  });
  try {
    const mounted = runtime.mount({ regionId: REGION, resourceId: feature.id });
    expect(mounted.ok).toBe(true);
    const intent: Intent = {
      version: '1',
      id: 'attendance-overview',
      resource: feature.id,
      kind: 'custom',
      intent: GOAL,
      input: { team: 'Engineering' },
    };
    const lowered = compileIntent(intent, { resource: feature.resource, regionId: REGION, customIntents: intents });
    expect(lowered.ok).toBe(true);
    if (!lowered.ok) return;
    expect(lowered.value.needs.map((need) => need.id)).toEqual([...ROLES]);
    expect(lowered.value.needs).toHaveLength(3);
    expect(lowered.value.needs.every((need) => need.required && need.simultaneousGroup === 'overview')).toBe(true);
    expect(lowered.value.kind).toBe('data');
    if (lowered.value.kind !== 'data') return;
    expect(lowered.value.outputs).toHaveLength(3);

    const receipt = await runtime.render({ regionId: REGION, intent });
    expect(receipt.status, JSON.stringify(receipt.diagnostics)).toBe('committed');
    if (receipt.status !== 'committed') return;
    expect(receipt.outputs).toHaveLength(3);
    expect(receipt.outputs.map((output) => output.outputId)).toEqual([...ROLES]);
    const rows = Object.fromEntries(
      receipt.outputs.map((output) => [
        output.outputId,
        output.handle.snapshot().batches.flatMap((batch) => batch.rows),
      ]),
    );
    expect(rows.summary).toHaveLength(1);
    expect(rows.trend).toHaveLength(2);
    expect(rows.breakdown).toHaveLength(2);
    expect(rows.summary?.map((row) => row[METRIC.id])).toEqual([2]);
    expect(rows.trend?.map((row) => row[METRIC.id])).toEqual([1, 1]);
    expect(rows.breakdown?.map((row) => row[METRIC.id])).toEqual([1, 1]);
    expect(JSON.stringify(rows)).not.toContain('Lee');
    const results = receipt.outputs.map((output) => output.handle.snapshot().descriptor);
    expect(results.every((result) => result !== undefined)).toBe(true);
    if (results.some((result) => result === undefined)) return;
    const descriptors = results as NonNullable<(typeof results)[number]>[];
    const current = receipt.region.readSet;
    expect(current).toBeDefined();
    if (current === undefined) return;
    const { dataRevision: _dataRevision, ...preconditions } = current;
    const registered = createAeliqoPresentationRegistry({
      data: receipt.outputs.map((output, index) => ({
        result: descriptors[index]!,
        rows: output.handle.snapshot().batches.flatMap((batch) => batch.rows),
        columns: descriptors[index]!.fields.map((field) => ({ key: field.id, label: field.label })),
      })),
      visualizations: receipt.outputs.map((output, index) => ({
        result: descriptors[index]!,
        context: { results: [descriptors[index]!] },
        datasets: [
          { result: descriptors[index]!.ref, rows: output.handle.snapshot().batches.flatMap((batch) => batch.rows) },
        ],
      })),
      resolveEntity: () => feature.id,
    });
    expect(registered.ok, JSON.stringify(registered)).toBe(true);
    if (!registered.ok) return;
    const withPattern = createPresentationRegistry(registered.value.manifests, registered.value.mappings, [
      overviewPattern(),
    ]);
    expect(withPattern.ok, JSON.stringify(withPattern)).toBe(true);
    if (!withPattern.ok) return;
    const decision = resolvePresentation({
      id: 'attendance-resolve',
      revision: '1',
      preconditions,
      context: {
        task: receipt.task,
        experience: {
          version: '1',
          id: 'attendance-experience',
          revision: preconditions.experienceRevision,
          mode: 'composable',
          agentAllowed: false,
          allowedRepresentations: Object.values(REF).map((ref) => ref.id),
          allowedPatterns: [PATTERN.id],
          composition: { allowWithoutPreset: true, maxNodes: 4, maxExpansions: 8 },
          requiredOperations: [],
          tokenProfile: { id: 'tokens.default', revision: '1' },
          extensionAllowlist: [],
          transitionPolicy: 'stable',
        },
        results: descriptors,
        current: preconditions,
        environment: {
          inlineSize: { state: 'known', value: 1024 },
          blockSize: { state: 'known', value: 720 },
          textScale: { state: 'unknown' },
          pointer: 'fine',
          hover: 'available',
          keyboard: 'available',
          locale: 'en-US',
          direction: 'ltr',
          reducedMotion: false,
          forcedColors: false,
        },
        rendererCapabilities: Object.values(REF),
      },
      registry: withPattern.value,
      target: {
        address: {
          runtimeId: 'attendance-runtime',
          scopeInstanceId: 'attendance-scope',
          activationEpoch: 1,
          surfaceId: REGION,
          surfaceGeneration: 1,
        },
        state: 'active',
      },
      // The pattern candidate contract currently requires a plan field. This
      // inert placeholder is ignored; the registered expander builds the plan.
      candidates: [
        {
          id: 'registered-overview',
          source: 'pattern',
          pattern: PATTERN,
          plan: {
            id: 'unused-pattern-plan',
            revision: '1',
            rootId: 'unused',
            preconditions,
            nodes: [],
            links: [],
            coverage: [],
            stateTransfer: [],
            diagnostics: [],
          },
        },
      ],
    });
    expect(decision.status, JSON.stringify(decision)).toBe('ready');
    if (decision.status !== 'ready') return;
    expect(decision.receipt.selectedCandidate).toBe('registered-overview');
    expect(decision.plan.plan.id).toBe('attendance-resolve');
    expect(decision.plan.plan.nodes).toHaveLength(4);
    expect(decision.plan.plan.coverage.map((entry) => entry.needId)).toEqual([...ROLES]);
    const committed = await runtime.commitPresentation({
      regionId: REGION,
      requestId: receipt.requestId,
      task: receipt.task,
      presentation: decision.plan.plan,
    });
    expect(committed.ok).toBe(true);
    expect(runtime.snapshot(REGION)?.region?.state?.presentation?.nodes.map((node) => node.role)).toEqual([
      'structure',
      'metric',
      'trend',
      'table',
    ]);
    const committedPresentation = runtime.snapshot(REGION)?.region?.state?.presentation;

    for (const unknown of ['attendance.unknown', 'attendance.anomaly']) {
      const attempt = await runtime.render({
        regionId: REGION,
        intent: { ...intent, id: `reject-${unknown}`, intent: { id: unknown, revision: '1' } },
      });
      expect(attempt.status).toBe('unsupported');
      expect(attempt.diagnostics[0]?.code).toBe('intent.unknown-custom');
      expect(runtime.snapshot(REGION)?.region?.state?.presentation).toEqual(committedPresentation);
    }
  } finally {
    runtime.dispose();
  }
});
