import type { Intent, Result } from '@aeliqo/core';
import { createQueryFunctionRegistry } from '@aeliqo/core/expressions';
import { createPresentationRegistry, resolvePresentation, type PresentationRegistry } from '@aeliqo/core/presentation';
import { createAeliqoRuntime, createLocalDataBinding, type RuntimeCommittedReceipt } from '@aeliqo/runtime';
import { registerAeliqoElements } from '@aeliqo/web';
import {
  createAeliqoPresentationRegistry,
  type AeliqoRegionElement,
  type AeliqoRegionResult,
} from '@aeliqo/web/region';
import { REGION, GOAL, PATTERN, METRIC, REF, feature, goalRegistry, overviewPattern } from '../workspace/goal.js';

const functions = createQueryFunctionRegistry({ version: '2' });
if (!functions.ok) throw new Error(functions.diagnostics[0]!.message);
let failBreakdown = false;
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
const execute = binding.service.execute;
binding.service.execute = (request, context) =>
  failBreakdown && request.target.outputId === 'breakdown'
    ? (async function* () {
        yield {
          kind: 'error' as const,
          requestId: request.requestId,
          error: {
            code: 'attendance.breakdown-failed',
            message: 'Synthetic breakdown execution failed.',
            retryable: false,
          },
        };
      })()
    : execute(request, context);
const runtime = createAeliqoRuntime({
  runtimeId: 'attendance-runtime',
  resources: [{ resource: feature.resource, data: binding.service }],
  intents: goalRegistry(),
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
const mounted = runtime.mount({ regionId: REGION, resourceId: feature.id });
if (!mounted.ok) throw new Error(mounted.diagnostics[0]!.message);
registerAeliqoElements();
const workspace = document.querySelector<HTMLElement>('#workspace')!;
const status = document.querySelector<HTMLElement>('[data-testid="goal-status"]')!;
const element = document.createElement('aeliqo-region') as AeliqoRegionElement;
workspace.append(element);

const intent: Intent = {
  version: '1',
  id: 'attendance-overview',
  resource: feature.id,
  kind: 'custom',
  intent: GOAL,
  input: { team: 'Engineering' },
};

function bindingsFor(receipt: RuntimeCommittedReceipt): {
  readonly descriptors: Result[];
  readonly results: AeliqoRegionResult[];
} {
  const descriptors = receipt.outputs.map((output) => output.handle.snapshot().descriptor);
  if (descriptors.some((descriptor) => descriptor === undefined)) throw new Error('goal.result-missing');
  const results: AeliqoRegionResult[] = receipt.outputs.map((output, index) => ({
    ref: descriptors[index]!.ref,
    rows: output.handle.snapshot().batches.flatMap((batch) => batch.rows),
    columns: descriptors[index]!.fields.map((field) => ({ key: field.id, label: field.label })),
  }));
  return { descriptors: descriptors as Result[], results };
}

function registryForResults(
  descriptors: readonly Result[],
  results: readonly AeliqoRegionResult[],
): PresentationRegistry {
  const registered = createAeliqoPresentationRegistry({
    data: results.map((result, index) => ({ result: descriptors[index]!, rows: result.rows, columns: result.columns })),
    visualizations: results.map((result, index) => ({
      result: descriptors[index]!,
      context: { results: [descriptors[index]!] },
      datasets: [{ result: result.ref, rows: result.rows }],
    })),
    resolveEntity: () => feature.id,
  });
  if (!registered.ok) throw new Error(registered.diagnostics[0]!.message);
  const registry = createPresentationRegistry(registered.value.manifests, registered.value.mappings, [
    overviewPattern(),
  ]);
  if (!registry.ok) throw new Error(registry.diagnostics[0]!.message);
  return registry.value;
}

function resolveOverview(
  receipt: RuntimeCommittedReceipt,
  descriptors: readonly Result[],
  registry: PresentationRegistry,
) {
  const current = receipt.region.readSet;
  if (current === undefined) throw new Error('goal.read-set-missing');
  const { dataRevision: _dataRevision, ...preconditions } = current;
  const environment = {
    inlineSize: { state: 'known' as const, value: workspace.clientWidth },
    blockSize: { state: 'known' as const, value: 720 },
    textScale: { state: 'unknown' as const },
    pointer: 'fine' as const,
    hover: 'available' as const,
    keyboard: 'available' as const,
    locale: 'en-US',
    direction: 'ltr' as const,
    reducedMotion: false,
    forcedColors: false,
  };
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
      environment,
      rendererCapabilities: Object.values(REF),
    },
    registry,
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
  if (decision.status !== 'ready') throw new Error(decision.diagnostic.code);
  return { decision, preconditions };
}

async function showOverview(): Promise<void> {
  const receipt = await runtime.render({ regionId: REGION, intent });
  if (receipt.status !== 'committed') throw new Error(receipt.diagnostics[0]?.code ?? receipt.status);
  const { descriptors, results } = bindingsFor(receipt);
  const registry = registryForResults(descriptors, results);
  const { decision, preconditions } = resolveOverview(receipt, descriptors, registry);
  const committed = await runtime.commitPresentation({
    regionId: REGION,
    requestId: receipt.requestId,
    task: receipt.task,
    presentation: decision.plan.plan,
  });
  if (!committed.ok) throw new Error(committed.diagnostics[0]!.code);
  element.results = results;
  element.presentation = decision.plan;
  await element.updateComplete;
  workspace.dataset.taskId = receipt.task.id;
  workspace.dataset.needs = receipt.task.needs.map((need) => need.id).join(',');
  workspace.dataset.outputs = receipt.outputs.map((output) => output.outputId).join(',');
  workspace.dataset.selectedCandidate = decision.receipt.selectedCandidate;
  workspace.dataset.planNodes = decision.plan.plan.nodes.map((node) => node.id).join(',');
  workspace.dataset.nodeResults = decision.plan.plan.nodes
    .filter((node) => node.result !== undefined)
    .map((node) => `${node.id}:${node.result!.outputId}`)
    .join(',');
  workspace.dataset.scope = preconditions.scopeDigest;
  status.textContent = 'renderer-ready';
}

document.querySelector('#request-anomaly')!.addEventListener('click', () => {
  void runtime
    .render({
      regionId: REGION,
      intent: { ...intent, id: 'attendance-anomaly', intent: { id: 'attendance.anomaly', revision: '1' } },
    })
    .then((receipt) => {
      status.textContent = `${receipt.status}:${receipt.diagnostics[0]?.code ?? 'unknown'}`;
    });
});
document.querySelector('#fail-breakdown')!.addEventListener('click', () => {
  failBreakdown = true;
  void runtime
    .render({ regionId: REGION, intent: { ...intent, id: 'attendance-overview-failing-update' } })
    .then((receipt) => {
      status.textContent = `${receipt.status}:${receipt.diagnostics[0]?.code ?? 'unknown'}`;
    })
    .finally(() => {
      failBreakdown = false;
    });
});
void showOverview().catch((error: unknown) => {
  status.textContent = `failed:${error instanceof Error ? error.message : String(error)}`;
});
