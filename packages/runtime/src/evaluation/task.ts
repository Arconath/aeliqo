import {validateTaskStructure, WIRE_LIMITS} from '@aeliqo/sdk-core';
import type {
  Diagnostic,
  Outcome,
  QuerySpec,
  ResultRef,
} from '@aeliqo/sdk-core';
import type {
  DataService,
  PlanRequest,
  QueryBudget,
  ReadContext,
} from '../data/types.js';
import type {ResultHandle, ResultLease} from '../results/types.js';
import {createResultCohortResolver} from './cohort.js';
import type {
  CohortRequest,
  CohortResolver,
  CohortResolverContext,
  MaterializedTaskOutput,
  TaskEvaluation,
  TaskEvaluationInput,
  TaskEvaluatorOptions,
  TrustedEvaluationContext,
} from './types.js';

const DEFAULT_BUDGET: QueryBudget = Object.freeze({
  maxRows: 10_000,
  maxBytes: WIRE_LIMITS.bytes,
  maxMessages: 64,
  maxMilliseconds: 30_000,
  maxColumns: 128,
});
const DEFAULT_MAX_PENDING = 4;

function failure<T = never>(code: string, message: string, path?: readonly (string | number)[]): Outcome<T> {
  const diagnostic: Diagnostic = {code, message, retryable: false, ...(path === undefined ? {} : {path: [...path]})};
  return {ok: false, diagnostics: [diagnostic]};
}

type FailureDiagnostic = Extract<Outcome<never>, {readonly ok: false}>;

function failed(code: string, message: string): FailureDiagnostic {
  return {ok: false, diagnostics: [{code, message, retryable: false}]};
}

function sameRef(left: ResultRef, right: ResultRef): boolean {
  return left.id === right.id && left.revision === right.revision && left.outputId === right.outputId
    && left.queryDigest === right.queryDigest && left.scopeDigest === right.scopeDigest;
}

function safeRequestId(counter: number, outputId: string): string {
  const value = `task-evaluation-${counter}-${outputId}`;
  return value.length <= WIRE_LIMITS.id ? value : value.slice(0, WIRE_LIMITS.id);
}

function grant(context: TrustedEvaluationContext, name: string): Outcome<void> {
  return context.grants.includes(name)
    ? {ok: true, value: undefined}
    : failure('runtime.evaluation-denied', `The host did not grant ${name}.`);
}

function budgetFor(context: TrustedEvaluationContext, options: TaskEvaluatorOptions, remaining: number): QueryBudget {
  const configured = context.budget ?? options.budget ?? DEFAULT_BUDGET;
  return Object.freeze({
    maxRows: Math.max(1, Math.min(DEFAULT_BUDGET.maxRows, configured.maxRows)),
    maxBytes: Math.max(1, Math.min(DEFAULT_BUDGET.maxBytes, configured.maxBytes)),
    maxMessages: Math.max(3, Math.min(DEFAULT_BUDGET.maxMessages, configured.maxMessages)),
    maxMilliseconds: Math.max(1, Math.min(DEFAULT_BUDGET.maxMilliseconds, configured.maxMilliseconds, Math.floor(remaining))),
    maxColumns: Math.max(1, Math.min(DEFAULT_BUDGET.maxColumns, configured.maxColumns)),
  });
}

interface Deadline {
  readonly signal: AbortSignal;
  readonly deadlineAt: number;
  cleanup(): void;
}

function deadline(parent: AbortSignal | undefined, milliseconds: number, now: () => number): Deadline {
  const bounded = Math.max(1, Math.min(86_400_000, Math.floor(milliseconds)));
  const controller = new AbortController();
  const deadlineAt = now() + bounded;
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => controller.abort(), bounded);
  const onAbort = (): void => controller.abort();
  parent?.addEventListener('abort', onAbort, {once: true});
  if (parent?.aborted === true) controller.abort();
  return {
    signal: controller.signal,
    deadlineAt,
    cleanup() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      parent?.removeEventListener('abort', onAbort);
    },
  };
}

function remaining(deadlineAt: number, now: () => number): number {
  const value = deadlineAt - now();
  return Number.isFinite(value) ? value : 0;
}

type FailureOutcome = Extract<Outcome<void>, {readonly ok: false}>;

function aborted(signal: AbortSignal, deadlineAt: number, now: () => number): FailureOutcome | undefined {
  if (signal.aborted) return failed('runtime.evaluation-cancelled', 'Task evaluation was cancelled.');
  if (remaining(deadlineAt, now) <= 0) return failed('runtime.evaluation-budget', 'Task evaluation exceeded its deadline.');
  return undefined;
}

function contextRead(context: TrustedEvaluationContext, signal: AbortSignal, cohort?: ReadContext['cohort']): ReadContext {
  return {...context.readContext, signal, ...(cohort === undefined ? {} : {cohort})};
}

function trustedEquivalent(left: TrustedEvaluationContext, right: TrustedEvaluationContext): boolean {
  return left.principalKey === right.principalKey && left.scopeDigest === right.scopeDigest
    && left.policyRevision === right.policyRevision && left.catalogRevision === right.catalogRevision
    && left.functionRegistryDigest === right.functionRegistryDigest;
}

function localResolver(data: DataService): CohortResolver | undefined {
  const candidate = data as DataService & {readonly cohortResolver?: CohortResolver};
  return candidate.cohortResolver;
}

let evaluationSequence = 0;

export function createTaskEvaluator(options: TaskEvaluatorOptions): {evaluate(input: TaskEvaluationInput): Promise<Outcome<TaskEvaluation>>} {
  if (options.host === null || typeof options.host?.readContext !== 'function') throw new TypeError('A task evaluation host readContext callback is required.');
  const maxPending = DEFAULT_MAX_PENDING;
  let pending = 0;
  return {
    async evaluate(input) {
      if (pending >= maxPending) return failure('runtime.evaluation-budget', 'The task evaluation queue is full.');
      pending++;
      const sequence = ++evaluationSequence;
      const nowFallback = () => Date.now();
      let activeContext: TrustedEvaluationContext | undefined;
      const owned = new Set<ResultHandle>();
      const leases: ResultLease[] = [];
      let released = false;
      let published = false;
      const release = (): void => {
        if (released) return;
        released = true;
        for (const lease of leases.splice(0)) lease.release();
        for (const handle of owned) {
          try { handle.release(); } catch { /* Best-effort ownership release. */ }
        }
        owned.clear();
      };
      const clearOwned = (): void => {
        for (const handle of owned) {
          try { handle.dispose(); } catch { /* Best-effort cleanup after revoked authority. */ }
        }
        owned.clear();
        for (const lease of leases.splice(0)) lease.release();
      };
      const requested = input.task;
      const configuredMs = input.deadlineMs ?? options.maxMilliseconds ?? DEFAULT_BUDGET.maxMilliseconds;
      const parentSignal = input.signal;
      const provisionalNow = nowFallback;
      const outer = deadline(parentSignal, configuredMs, provisionalNow);
      try {
        const structure = validateTaskStructure(requested);
        if (!structure.ok) return structure;
        if (requested.kind !== 'data') return failure('runtime.evaluation-unsupported', 'Only data Tasks have executable output DAGs.');
        const hostResult = await options.host.readContext({signal: outer.signal, task: structure.value.task});
        if (!hostResult.ok) return hostResult;
        activeContext = hostResult.value;
        const context = activeContext;
        const currentNow = context.now;
        const active = aborted(outer.signal, outer.deadlineAt, currentNow);
        if (active !== undefined) return active;
        const evaluateGrant = grant(context, 'task.evaluate');
        if (!evaluateGrant.ok) return evaluateGrant;
        const outputById = new Map(requested.outputs.map((output) => [output.id, output] as const));
        const selected = new Set<string>();
        const explicit = input.requestedOutputs;
        const seeds = explicit === undefined ? requested.outputs.filter((output) => output.kind === 'reuse' || output.delivery === 'eager').map((output) => output.id) : [...explicit];
        for (const id of seeds) {
          if (!outputById.has(id)) return failure('runtime.evaluation-invalid', `Requested output ${id} is absent from the Task.`, ['requestedOutputs']);
          selected.add(id);
        }
        const addDependencies = (id: string): void => {
          const output = outputById.get(id);
          if (output === undefined) return;
          for (const dependency of output.dependsOn) if (!selected.has(dependency)) { selected.add(dependency); addDependencies(dependency); }
        };
        for (const id of [...selected]) addDependencies(id);
        const requiresInspect = [...selected].some((id) => {
          const output = outputById.get(id);
          return output?.kind === 'reuse' || (output?.kind === 'query' && output.query.population.kind !== 'all-authorized');
        });
        if (requiresInspect && !context.grants.includes('result.inspect')) return failure('runtime.evaluation-denied', 'The host did not grant result inspection for the selected cohort or reused output.');
        const materialized = new Map<string, MaterializedTaskOutput>();
        const resolver = context.cohortResolver ?? options.cohortResolver ?? localResolver(context.data) ?? createResultCohortResolver();
        const resolveMaterialized = (ref: ResultRef): ResultHandle | undefined => materialized.get(ref.outputId)?.ref && sameRef(materialized.get(ref.outputId)!.ref, ref) ? materialized.get(ref.outputId)!.handle : context.resolveResult(ref);
        const cohortCapability: NonNullable<ReadContext['cohort']> = {principalKey: context.principalKey, resolver, resultStore: context.resultStore, resolveResult: resolveMaterialized};
        const contextForResolver = (): CohortResolverContext => ({readContext: contextRead(context, outer.signal), principalKey: context.principalKey, scopeDigest: context.scopeDigest, ...(context.policyRevision === undefined ? {} : {policyRevision: context.policyRevision}), catalogRevision: context.catalogRevision, functionRegistryDigest: context.functionRegistryDigest, grants: context.grants, catalog: context.catalog, resultStore: context.resultStore, resolveResult: resolveMaterialized, now: currentNow});
        const bindLivePopulation = async (query: QuerySpec): Promise<Outcome<QuerySpec>> => {
          if (query.population.kind !== 'live-output') return {ok: true, value: query};
          const inspectGrant = grant(context, 'result.inspect');
          if (!inspectGrant.ok) return inspectGrant;
          const upstream = materialized.get(query.population.outputId);
          if (upstream === undefined) return failure('runtime.evaluation-dependency', 'The live cohort upstream output was not materialized.', ['population', 'outputId']);
          const entity = context.catalog.entities.find((candidate) => candidate.id === query.entity);
          const cohortRequest: CohortRequest = {source: upstream.ref, identityKeys: query.population.identityKeys, ...(entity === undefined ? {} : {targetGrain: entity.rowGrain}), scopeDigest: context.scopeDigest, ...(context.policyRevision === undefined ? {} : {policyRevision: context.policyRevision}), catalogRevision: context.catalogRevision, sourceRevision: upstream.ref.revision, deadlineAt: outer.deadlineAt, signal: outer.signal};
          const membership = await resolver.resolve(cohortRequest, contextForResolver());
          if (!membership.ok) return membership;
          return {ok: true, value: {...query, population: {kind: 'fixed' as const, source: membership.value.source, identityKeys: [...membership.value.identityKeys] as [string, ...string[]], cohortDigest: membership.value.tupleDigest}}};
        };
        for (const outputId of structure.value.outputOrder) {
          if (!selected.has(outputId)) continue;
          const activeStep = aborted(outer.signal, outer.deadlineAt, currentNow);
          if (activeStep !== undefined) return activeStep;
          const output = outputById.get(outputId)!;
          if (output.kind === 'reuse') {
            const inspectGrant = grant(context, 'result.inspect');
            if (!inspectGrant.ok) return inspectGrant;
            let handle: ResultHandle | undefined;
            try { handle = context.resolveResult(output.result); } catch { return failure('runtime.evaluation-denied', 'The host result resolver failed for a reused output.'); }
            if (handle === undefined) return failure('runtime.evaluation-denied', 'The reused output is not a host-owned live result.', ['outputs', outputId]);
            let lease: ResultLease;
            try { lease = handle.retain(); } catch { return failure('runtime.evaluation-denied', 'The reused output could not be retained.', ['outputs', outputId]); }
            if (lease.released) return failure('runtime.evaluation-denied', 'The reused output is no longer available.', ['outputs', outputId]);
            leases.push(lease);
            const snapshot = handle.snapshot();
            if (snapshot.descriptor === undefined || !sameRef(snapshot.descriptor.ref, output.result)) return failure('runtime.evaluation-stale', 'The reused result descriptor does not match its immutable reference.', ['outputs', outputId]);
            if (handle.key.principalKey !== context.principalKey || handle.key.scopeDigest !== context.scopeDigest || handle.key.catalogRevision !== context.catalogRevision || handle.key.functionRegistryDigest !== context.functionRegistryDigest || handle.key.policyRevision !== context.policyRevision)
              return failure('runtime.evaluation-denied', 'The reused result is outside the current authority pins.', ['outputs', outputId]);
            materialized.set(outputId, {outputId, kind: 'reuse', ref: snapshot.descriptor.ref, descriptor: snapshot.descriptor, handle, lineage: snapshot.descriptor.lineage.flatMap((entry) => entry.inputs)});
            continue;
          }
          const original = output.query;
          const bound = await bindLivePopulation(original);
          if (!bound.ok) return bound;
          const budget = budgetFor(context, options, remaining(outer.deadlineAt, currentNow));
          const requestId = safeRequestId(sequence, output.id);
          const planRequest: PlanRequest = {version: '1', requestId, catalogRevision: context.catalogRevision,
            target: {taskId: requested.id, outputId: output.id}, query: bound.value, budget};
          const planned = await context.data.plan(planRequest, contextRead(context, outer.signal, cohortCapability));
          if (!planned.ok) return planned;
          const accepted = planned.value;
          if (accepted.catalogRevision !== context.catalogRevision || accepted.scopeDigest !== context.scopeDigest
            || accepted.functionRegistryDigest !== context.functionRegistryDigest || accepted.policyRevision !== context.policyRevision
            || accepted.target.taskId !== requested.id || accepted.target.outputId !== output.id)
            return failure('runtime.evaluation-stale', 'The ADC plan does not match the fresh trusted task authority.');
          const key = {principalKey: context.principalKey, scopeDigest: context.scopeDigest, ...(accepted.policyRevision === undefined ? {} : {policyRevision: accepted.policyRevision}), populationDigest: accepted.populationDigest, queryDigest: accepted.queryDigest, catalogRevision: accepted.catalogRevision, functionRegistryDigest: accepted.functionRegistryDigest, sourceRevision: accepted.sourceRevision, outputId: output.id, taskId: accepted.target.taskId ?? accepted.requestId, requestId};
          let handle: ResultHandle;
          try { handle = context.resultStore.begin(key); } catch { return failure('runtime.evaluation-budget', 'The result store could not allocate the task output.'); }
          owned.add(handle);
          const subscription = handle.subscribe(context.data.execute(accepted, contextRead(context, outer.signal, cohortCapability)), {signal: outer.signal});
          try {
            for await (const update of subscription) {
              const state = aborted(outer.signal, outer.deadlineAt, currentNow);
              if (state !== undefined) { subscription.cancel(); return state; }
              if (update.snapshot.status === 'failed' || update.snapshot.status === 'denied' || update.snapshot.status === 'unsupported' || update.snapshot.status === 'stale' || update.snapshot.status === 'cancelled') {
                const diagnostic = update.snapshot.diagnostics[0];
                subscription.cancel();
                return failure(diagnostic?.code ?? 'runtime.evaluation-failed', diagnostic?.message ?? 'The task output failed.');
              }
            }
          } catch {
            subscription.cancel();
            return failure('runtime.evaluation-failed', 'The ADC result stream could not be materialized.');
          }
          const snapshot = handle.snapshot();
          if ((snapshot.status !== 'ready' && snapshot.status !== 'partial') || snapshot.descriptor === undefined) {
            const diagnostic = snapshot.diagnostics[0];
            return failure(diagnostic?.code ?? 'runtime.evaluation-failed', diagnostic?.message ?? 'The task output did not become a complete result.');
          }
          materialized.set(outputId, {outputId, kind: 'query', ref: snapshot.descriptor.ref, descriptor: snapshot.descriptor, handle, accepted, lineage: snapshot.descriptor.lineage.flatMap((entry) => entry.inputs)});
        }
        const finalHost = await options.host.readContext({signal: outer.signal, task: structure.value.task});
        if (!finalHost.ok) { clearOwned(); return finalHost; }
        if (!trustedEquivalent(context, finalHost.value) || !finalHost.value.grants.includes('task.evaluate') || (requiresInspect && !finalHost.value.grants.includes('result.inspect'))) {
          clearOwned();
          return failure('runtime.evaluation-stale', 'Task authority changed before the evaluation could be published.');
        }
        const outputs = structure.value.outputOrder.filter((id) => materialized.has(id)).map((id) => materialized.get(id)!);
        released = false;
        published = true;
        return {ok: true, value: {task: structure.value.task, outputs: Object.freeze(outputs), get: (id) => materialized.get(id), release}};
      } catch {
        clearOwned();
        return failure('runtime.evaluation-failed', 'The bounded task evaluation failed.');
      } finally {
        if (!published) clearOwned();
        outer.cleanup();
        pending = Math.max(0, pending - 1);
      }
    },
  };
}
