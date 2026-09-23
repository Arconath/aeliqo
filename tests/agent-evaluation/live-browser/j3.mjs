import { createQueryFunctionRegistry } from '@aeliqo/core/expressions';
import { createPresentationRegistry, resolvePresentation } from '@aeliqo/core/presentation';
import { createAeliqoRuntime, createLocalDataBinding } from '@aeliqo/runtime';
import { createAeliqoPresentationRegistry } from '@aeliqo/web/region';
import { createAppToolEndpoint } from '@aeliqo/agent/app';
import {
  REGION,
  GOAL,
  PATTERN,
  METRIC,
  REF,
  feature,
  goalRegistry,
  overviewPattern,
} from '../../../examples/vnext/workspace/goal.ts';

const records = [
  { id: 'a', employee: 'Ada', day: '2026-09-01', team: 'Engineering', present: 1 },
  { id: 'b', employee: 'Sam', day: '2026-09-02', team: 'Engineering', present: 1 },
  { id: 'c', employee: 'Lee', day: '2026-09-02', team: 'Design', present: 1 },
];

function resultBindings(receipt) {
  const descriptors = receipt.outputs.map((output) => output.handle.snapshot().descriptor);
  if (descriptors.some((item) => item === undefined)) throw new Error('The registered J3 result is incomplete.');
  const results = receipt.outputs.map((output, index) => ({
    ref: descriptors[index].ref,
    rows: output.handle.snapshot().batches.flatMap((batch) => batch.rows),
    columns: descriptors[index].fields.map((field) => ({ key: field.id, label: field.label })),
  }));
  return { descriptors, results };
}

function presentationRegistry(descriptors, results) {
  const registered = createAeliqoPresentationRegistry({
    data: results.map((result, index) => ({ result: descriptors[index], rows: result.rows, columns: result.columns })),
    visualizations: results.map((result, index) => ({
      result: descriptors[index],
      context: { results: [descriptors[index]] },
      datasets: [{ result: result.ref, rows: result.rows }],
    })),
    resolveEntity: () => feature.id,
  });
  if (!registered.ok) throw new Error(registered.diagnostics[0]?.message ?? 'J3 presentation registry failed.');
  const registry = createPresentationRegistry(registered.value.manifests, registered.value.mappings, [
    overviewPattern(),
  ]);
  if (!registry.ok) throw new Error(registry.diagnostics[0]?.message ?? 'J3 pattern registry failed.');
  return registry.value;
}

function resolveOverview(receipt, descriptors, registry, target) {
  const current = receipt.region.readSet;
  if (current === undefined) throw new Error('J3 read set is missing.');
  const { dataRevision: _dataRevision, ...preconditions } = current;
  const decision = resolvePresentation({
    id: 'live-j3-resolve',
    revision: '1',
    preconditions,
    context: {
      task: receipt.task,
      experience: {
        version: '1',
        id: 'live-j3-experience',
        revision: preconditions.experienceRevision,
        mode: 'composable',
        agentAllowed: true,
        allowedRepresentations: Object.values(REF).map((ref) => ref.id),
        allowedPatterns: [PATTERN.id],
        composition: { allowWithoutPreset: false, maxNodes: 4, maxExpansions: 16 },
        requiredOperations: [],
        tokenProfile: { id: 'tokens.default', revision: '1' },
        extensionAllowlist: [],
        transitionPolicy: 'stable',
      },
      results: descriptors,
      current: preconditions,
      environment: {
        inlineSize: { state: 'known', value: target.clientWidth || 800 },
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
    registry,
    target: {
      address: {
        runtimeId: 'live-j3-runtime',
        scopeInstanceId: 'attendance-scope',
        activationEpoch: 1,
        surfaceId: REGION,
        surfaceGeneration: 1,
      },
      state: 'active',
    },
    candidates: [],
  });
  if (decision.status !== 'ready') throw new Error(decision.diagnostic.code);
  return decision;
}

export async function openJ3(target) {
  const functions = createQueryFunctionRegistry({ version: '2' });
  if (!functions.ok) throw new Error(functions.diagnostics[0]?.message ?? 'No query registry.');
  const binding = createLocalDataBinding({
    feature,
    snapshot: { catalog: feature.catalog, sourceRevision: 'live-j3-1', records: { attendance: records } },
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
  const runtime = createAeliqoRuntime({
    runtimeId: 'live-j3-runtime',
    resources: [{ resource: feature.resource, data: binding.service }],
    intents: goalRegistry(),
    authority: {
      read: () => ({
        ok: true,
        value: {
          principalKey: 'live-j3-user',
          scopeDigest: 'attendance-scope',
          policyRevision: '1',
          experienceRevision: '1',
          grants: [
            'catalog.read',
            'task.propose',
            'task.evaluate',
            'result.inspect',
            'experience.commit',
            'model.egress',
          ],
          readContext: { principal: 'live-j3-user' },
        },
      }),
    },
  });
  const mounted = runtime.mount({ regionId: REGION, resourceId: feature.id });
  if (!mounted.ok) throw new Error(mounted.diagnostics[0]?.message ?? 'J3 mount failed.');
  const element = document.createElement('aeliqo-region');
  target.append(element);
  const render = async ({ intent, signal }) => {
    if (
      intent.kind !== 'custom' ||
      intent.resource !== feature.id ||
      intent.intent.id !== GOAL.id ||
      intent.intent.revision !== GOAL.revision ||
      intent.input?.team !== 'Engineering'
    )
      return {
        status: 'failed',
        requestId: 'live-j3-invalid',
        regionId: REGION,
        diagnostics: [
          { code: 'live.j3-invalid', message: 'Only the registered Engineering goal is supported.', retryable: false },
        ],
      };
    const receipt = await runtime.render({ regionId: REGION, intent, signal });
    if (receipt.status !== 'committed') return receipt;
    const { descriptors, results } = resultBindings(receipt);
    const registry = presentationRegistry(descriptors, results);
    const decision = resolveOverview(receipt, descriptors, registry, target);
    const committed = await runtime.commitPresentation({
      regionId: REGION,
      requestId: receipt.requestId,
      task: receipt.task,
      presentation: decision.plan.plan,
    });
    if (!committed.ok) throw new Error(committed.diagnostics[0]?.message ?? 'J3 plan did not commit.');
    element.results = results;
    element.presentation = decision.plan;
    await element.updateComplete;
    target.dataset.needs = receipt.task.needs.map((need) => need.id).join(',');
    target.dataset.presentation = decision.receipt.selectedCandidate;
    return {
      status: 'renderer-ready',
      requestId: receipt.requestId,
      regionId: REGION,
      runtime: receipt,
      diagnostics: [],
    };
  };
  const connected = createAppToolEndpoint({
    runtime,
    regionId: REGION,
    goalEpoch: 'live-j3',
    transport: 'byok',
    expiresAt: Date.now() + 300_000,
    render: { render },
    context: { read: () => runtime.contexts(REGION) },
  });
  if (!connected.ok) throw new Error(connected.diagnostics[0]?.message ?? 'J3 pairing failed.');
  return {
    endpoint: connected.value,
    close() {
      connected.value.close();
      runtime.dispose();
    },
  };
}
