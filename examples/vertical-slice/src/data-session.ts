import type {ResultRef, Task} from '@aeliqo/core';
import {createDataHttpHandler, createHttpDataService, createLocalDataService, type DataService, type LocalSnapshot, type QueryBudget} from '@aeliqo/runtime/data';
import {createResultStore, type ResultHandle, type ResultStore} from '@aeliqo/runtime/results';
import {createResultCohortResolver, createTaskEvaluator, type TaskEvaluation, type TrustedEvaluationContext} from '@aeliqo/runtime/evaluation';
import {catalog, functionRegistry, snapshot, sourceLimits} from './hr.js';

export const principalKey = 'synthetic-hr-reader';
export const scopeDigest = 'synthetic-hr-scope';
export const policyRevision = 'synthetic-hr-policy-1';
export const budget: QueryBudget = {maxRows: 1_000, maxBytes: 500_000, maxMessages: 32, maxMilliseconds: 10_000, maxColumns: 32};
export const refKey = (ref: ResultRef): string => JSON.stringify([ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest]);

/** Application-owned fixture host. No HR-specific execution lives in the SDK. */
export function createHrDataSession(transport: 'local' | 'http' = 'local') {
  let permitted = true;
  let queryCount = 0;
  const underlyingStore = createResultStore({maxEntries: 32, maxBytes: 2_000_000});
  const tracked = new Set<ResultHandle>();
  const prune = () => { for (const handle of tracked) if (['disposed', 'denied'].includes(handle.snapshot().status)) tracked.delete(handle); };
  // The application registers its actual store handles, including intermediate named outputs.
  const resultStore: ResultStore = {
    begin(input) { const handle = underlyingStore.begin(input); prune(); tracked.add(handle); return handle; },
    get: input => underlyingStore.get(input),
    revoke(input) { underlyingStore.revoke(input); prune(); },
    dispose() { underlyingStore.dispose(); tracked.clear(); },
  };
  const resolveResult = (ref: ResultRef): ResultHandle | undefined => {
    prune();
    return [...tracked].find(handle => {
      const descriptor = handle.snapshot().descriptor;
      return descriptor !== undefined && refKey(descriptor.ref) === refKey(ref);
    });
  };
  const cohortResolver = createResultCohortResolver();
  const local = createLocalDataService({snapshot: snapshot(), sourceLimits, functionRegistry,
    cohortResolver, cohortContext: () => ({resultStore, resolveResult}),
    authorize: ({context}) => permitted && context.principal === principalKey
      ? {ok: true, value: {scopeDigest, policyRevision}}
      : {ok: false, diagnostics: [{code: 'data.denied', message: 'The fixture reader no longer has access.', retryable: false}]},
  });
  const handler = createDataHttpHandler({service: local, authenticate: () => permitted
    ? {ok: true, value: {principal: principalKey}}
    : {ok: false, diagnostics: [{code: 'data.denied', message: 'Fixture access revoked.', retryable: false}]},
  });
  // This in-process Fetch handler exercises the same serialized HTTP path without a second fixture engine.
  const selected = transport === 'local' ? local : createHttpDataService({baseUrl: 'https://fixture.invalid', fetch: async (input, init) => handler(new Request(input, init))});
  const data: DataService = {
    describe: (request, context) => selected.describe(request, context),
    plan(request, context) { queryCount++; return selected.plan(request, context); },
    execute: (request, context) => selected.execute(request, context),
  };
  const context = (): TrustedEvaluationContext => ({principalKey, scopeDigest, policyRevision, catalogRevision: catalog.revision,
    functionRegistryDigest: functionRegistry.digest, grants: permitted ? ['task.evaluate', 'result.inspect'] : [],
    catalog, data, resultStore, readContext: {principal: principalKey}, cohortResolver, resolveResult, now: () => Date.now(), budget});
  const evaluator = createTaskEvaluator({host: {readContext: () => ({ok: true, value: context()})}});
  return {
    resultStore, resolveResult, context, cohortResolver,
    get queryCount() { return queryCount; },
    get permitted() { return permitted; },
    async evaluate(task: Task, requestedOutputs?: readonly string[]): Promise<TaskEvaluation> {
      const result = await evaluator.evaluate({task, ...(requestedOutputs === undefined ? {} : {requestedOutputs})});
      if (!result.ok) throw new Error(result.diagnostics.map(d => `${d.code}: ${d.message}`).join('; '));
      return result.value;
    },
    replaceSnapshot(next: LocalSnapshot) {
      const result = local.replaceSnapshot(next);
      if (!result.ok) throw new Error(result.diagnostics.map(d => d.message).join('; '));
    },
    revoke() { permitted = false; resultStore.revoke({principalKey}); },
    dispose() { permitted = false; resultStore.dispose(); },
  };
}
export type HrDataSession = ReturnType<typeof createHrDataSession>;
