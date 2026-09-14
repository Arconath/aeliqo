import {normalizeAgentCapabilityRequest} from '../capabilities/dispatcher.js';
import {parseContract, parseWireValue, type AgentStopReason, type Diagnostic, type Outcome} from '@aeliqo/core';
import type {
  AgentCapabilityReceipt,
  AgentCapabilityRequest,
} from '../capabilities/types.js';
import type {
  AgentRecoveryReceipt,
  AgentSession,
  AgentSessionAttempt,
  AgentSessionOptions,
  AgentSessionReceipt,
  AgentSessionRepairRequest,
  AgentSessionRunInput,
  AgentSessionSnapshot,
} from './types.js';

const DEADLINE = Symbol('agent-session-deadline');
const ABORTED = Symbol('agent-session-aborted');

function failure<T>(code: string, message: string): Outcome<T> {
  return {ok: false, diagnostics: [{code, message, retryable: false}]};
}

function safeNow(now: () => number): number {
  try { const value = now(); return Number.isFinite(value) ? value : Date.now(); } catch { return Date.now(); }
}

function bytes(value: unknown): number {
  const parsed = parseWireValue(value);
  if (!parsed.ok) return 0;
  try { return new TextEncoder().encode(JSON.stringify(parsed.value)).byteLength; } catch { return 0; }
}

function canonical(value: unknown): string {
  const parsed = parseWireValue(value);
  if (!parsed.ok) { try { return `invalid:${String(value)}`; } catch { return 'invalid:candidate'; } }
  const visit = (entry: unknown): string => {
    if (entry === null) return 'null';
    if (typeof entry !== 'object') return JSON.stringify(entry) ?? 'undefined';
    if (Array.isArray(entry)) return `[${entry.map(visit).join(',')}]`;
    const object = entry as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${visit(object[key])}`).join(',')}}`;
  };
  return visit(parsed.value);
}

function fingerprint(value: unknown): string {
  let hash = 2166136261;
  for (const character of canonical(value)) { hash ^= character.codePointAt(0)!; hash = Math.imul(hash, 16777619); }
  return `session-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function elapsed(start: number, now: () => number): number { return Math.max(0, safeNow(now) - start); }

type BoundaryResult<T> =
  | {readonly kind: 'value'; readonly value: T}
  | {readonly kind: 'deadline'}
  | {readonly kind: 'aborted'}
  | {readonly kind: 'failed'};

async function awaitBoundary<T>(work: (signal: AbortSignal) => T | PromiseLike<T>, parent: AbortSignal, milliseconds: number): Promise<BoundaryResult<T>> {
  if (parent.aborted) return {kind: 'aborted'};
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let removeParent: (() => void) | undefined;
  let resolveDeadline!: () => void;
  let resolveAbort!: () => void;
  const deadline = new Promise<typeof DEADLINE>((resolve) => {resolveDeadline = () => {controller.abort(); resolve(DEADLINE);};});
  const aborted = new Promise<typeof ABORTED>((resolve) => {resolveAbort = () => {controller.abort(); resolve(ABORTED);};});
  const onAbort = (): void => resolveAbort();
  parent.addEventListener('abort', onAbort, {once: true});
  removeParent = () => parent.removeEventListener('abort', onAbort);
  timer = setTimeout(resolveDeadline, Math.max(0, milliseconds));
  const pending = Promise.resolve().then(() => work(controller.signal));
  try {
    const result = await Promise.race([pending, deadline, aborted]);
    if (result === DEADLINE) return {kind: 'deadline'};
    if (result === ABORTED) return {kind: 'aborted'};
    return {kind: 'value', value: result as T};
  } catch { return parent.aborted ? {kind: 'aborted'} : {kind: 'failed'}; }
  finally { controller.abort(); if (timer !== undefined) clearTimeout(timer); removeParent(); }
}

function stopFor(state: AgentCapabilityReceipt['state'] | undefined): AgentStopReason {
  if (state === 'bound' || state === 'data-ready' || state === 'plan-committed' || state === 'renderer-ready' || state === 'accepted') return 'complete';
  if (state === 'needs-choice') return 'needs-choice';
  if (state === 'needs-meaning') return 'needs-meaning';
  if (state === 'denied') return 'denied';
  if (state === 'stale') return 'stale';
  if (state === 'unsupported') return 'unsupported';
  if (state === 'invalid') return 'invalid';
  if (state === 'cancelled') return 'cancelled';
  if (state === 'partial') return 'unavailable';
  return 'unavailable';
}

function recoverable(state: AgentCapabilityReceipt['state']): boolean {
  return state === 'invalid' || state === 'unsupported' || state === 'failed';
}

function failedReceipt(request: AgentCapabilityRequest, diagnostics: readonly Diagnostic[]): AgentCapabilityReceipt {
  return Object.freeze({version: '1' as const, requestId: request.requestId, targetRegionId: request.targetRegionId, goalEpoch: request.goalEpoch,
    capability: Object.freeze({...request.capability}), operation: request.operation, transport: request.transport ?? 'direct', state: 'failed' as const,
    status: 'failed' as const, stage: 'failed' as const, diagnostics: Object.freeze([...diagnostics])});
}

function defaultRecovery(): AgentRecoveryReceipt {
  return Object.freeze({state: 'manual-required' as const, reason: 'No host recovery receipt was provided; retain only host-authorized state and offer manual controls.', safeToRetry: false});
}

function normalizeRecovery(value: AgentRecoveryReceipt): AgentRecoveryReceipt | undefined {
  if (value === null || typeof value !== 'object' || (value.state !== 'preserved-incumbent' && value.state !== 'cleared-revoked' && value.state !== 'manual-required')
    || typeof value.reason !== 'string' || value.reason.length === 0 || value.reason.length > 4096 || typeof value.safeToRetry !== 'boolean') return undefined;
  if (value.regionRevision !== undefined && (typeof value.regionRevision !== 'string' || value.regionRevision.length === 0 || value.regionRevision.length > 160)) return undefined;
  if (value.results !== undefined && (!Array.isArray(value.results) || value.results.length > 128 || value.results.some((ref) => ref === null || typeof ref !== 'object' || Array.isArray(ref)
    || typeof ref.id !== 'string' || typeof ref.revision !== 'string' || typeof ref.outputId !== 'string' || typeof ref.queryDigest !== 'string' || typeof ref.scopeDigest !== 'string'))) return undefined;
  return Object.freeze({...value, ...(value.results === undefined ? {} : {results: Object.freeze([...value.results])})});
}

/** Session orchestration is deliberately transport-neutral. It dispatches one
 * explicit operation at a time; evaluating data never implicitly presents or
 * commits a view. */
export function createAgentSession(options: AgentSessionOptions): AgentSession {
  if (options === null || typeof options !== 'object' || options.dispatcher === null || typeof options.dispatcher?.dispatch !== 'function') throw new TypeError('A capability dispatcher is required.');
  let status: AgentSessionSnapshot['status'] = 'idle';
  let active: AbortController | undefined;
  let snapshotAttempts: readonly AgentSessionAttempt[] = Object.freeze([]);
  let snapshotReceipt: AgentSessionReceipt | undefined;
  let currentRequestId: string | undefined;
  let closed = false;
  const now = options.now ?? Date.now;
  const transport=options.transport??'direct';
  if(!['direct','manual','mcp','webmcp','byok'].includes(transport))throw new TypeError('A valid trusted session transport is required.');

  const inspect = (): AgentSessionSnapshot => Object.freeze({status, ...(currentRequestId === undefined ? {} : {requestId: currentRequestId}), attempts: Object.freeze([...snapshotAttempts]), ...(snapshotReceipt === undefined ? {} : {receipt: snapshotReceipt})});

  const run = async (input: AgentSessionRunInput): Promise<Outcome<AgentSessionReceipt>> => {
    if (closed) return failure('agent.session.closed', 'The agent session is closed.');
    if (active !== undefined) return failure('agent.session.busy', 'The agent session already has a running request.');
    const budget = parseContract('agent-loop-budget', input?.budget);
    if (!budget.ok) return budget;
    if (input === null || typeof input !== 'object' || input.request === null || typeof input.request !== 'object' || typeof input.request.requestId !== 'string') return failure('agent.session.invalid', 'The session request is malformed.');
    const checkedRequest=normalizeAgentCapabilityRequest(input.request);
    if(!checkedRequest.ok)return checkedRequest;
    const request=Object.freeze({...checkedRequest.value,transport});
    const controller = new AbortController();
    active = controller;
    currentRequestId = request.requestId;
    status = 'running';
    snapshotAttempts = Object.freeze([]);
    snapshotReceipt = undefined;
    const parent = input.signal;
    const onParentAbort = (): void => controller.abort();
    parent?.addEventListener('abort', onParentAbort, {once: true});
    const start = safeNow(now);
    const attempts: AgentSessionAttempt[] = [];
    let candidate: unknown = request.input;
    let previousFingerprint: string | undefined;
    let last: AgentCapabilityReceipt | undefined;
    let stop: AgentStopReason = 'unavailable';
    let lastDiagnostics: readonly Diagnostic[] = [];
    let repairs = 0;
    const finalize = async (reason: AgentStopReason): Promise<Outcome<AgentSessionReceipt>> => {
      stop = reason;
      let recovery: AgentRecoveryReceipt | undefined;
      if (reason !== 'complete' && reason !== 'needs-choice' && reason !== 'needs-meaning') {
        if (options.recover !== undefined) {
          const remaining = Math.max(1, budget.value.maxMilliseconds - elapsed(start, now));
          const recovered = await awaitBoundary((signal) => options.recover!({receipt: last, incumbent: input.incumbent, signal}), controller.signal, remaining);
          if (recovered.kind === 'value' && recovered.value.ok) recovery = normalizeRecovery(recovered.value.value) ?? defaultRecovery();
          else recovery = defaultRecovery();
        } else recovery = defaultRecovery();
      }
      const value: AgentSessionReceipt = Object.freeze({version: '1', requestId: request.requestId, targetRegionId: request.targetRegionId,
        goalEpoch: request.goalEpoch, capability: Object.freeze({...request.capability}), operation: request.operation, transport: request.transport ?? 'direct', stop,
        attempts: Object.freeze([...attempts]), ...(last === undefined ? {} : {last}), ...(recovery === undefined ? {} : {recovery})});
      snapshotAttempts = closed ? Object.freeze([]) : value.attempts;
      snapshotReceipt = closed ? undefined : value;
      status = closed ? 'closed' : reason === 'cancelled' ? 'cancelled' : reason === 'complete' ? 'completed' : 'idle';
      return {ok: true, value};
    };
    try {
      while (true) {
        if (controller.signal.aborted || parent?.aborted) return finalize('cancelled');
        if (elapsed(start, now) >= budget.value.maxMilliseconds) return finalize('time-budget');
        if (attempts.length >= budget.value.maxTurns) return finalize('turn-budget');
        const proposalBytes = bytes(candidate);
        const candidateFingerprint = fingerprint(candidate);
        if (proposalBytes > budget.value.maxProposalBytes) {
          const attempt: AgentSessionAttempt = Object.freeze({turn: attempts.length + 1, state: 'invalid', fingerprint: candidateFingerprint, proposalBytes, progress: 'none'});
          attempts.push(attempt); snapshotAttempts = Object.freeze([...attempts]);
          lastDiagnostics = [{code: 'agent.session.byte-budget', message: 'The candidate exceeds its configured byte budget.', retryable: false}];
          last = failedReceipt(request, lastDiagnostics);
          return finalize('byte-budget');
        }
        if (previousFingerprint !== undefined && previousFingerprint === candidateFingerprint) {
          const attempt: AgentSessionAttempt = Object.freeze({turn: attempts.length + 1, state: last?.state ?? 'invalid', fingerprint: candidateFingerprint, proposalBytes, progress: 'none', ...(last === undefined ? {} : {receipt: last})});
          attempts.push(attempt); snapshotAttempts = Object.freeze([...attempts]);
          return finalize('no-progress');
        }
        const dispatchInput = Object.freeze({...request, input: candidate});
        const remaining = Math.max(1, budget.value.maxMilliseconds - elapsed(start, now));
        const dispatched = await awaitBoundary((signal) => options.dispatcher.dispatch(dispatchInput, {signal, transport: request.transport ?? 'direct'}), controller.signal, remaining);
        if (dispatched.kind === 'deadline') return finalize('time-budget');
        if (dispatched.kind === 'aborted') return finalize('cancelled');
        if (dispatched.kind === 'failed') {
          lastDiagnostics = [{code: 'agent.session.dispatch', message: 'Capability dispatch failed safely.', retryable: true}];
          last = failedReceipt(request, lastDiagnostics);
        } else if (!dispatched.value.ok) {
          lastDiagnostics = dispatched.value.diagnostics;
          last = failedReceipt(request, lastDiagnostics);
        } else {
          last = dispatched.value.value;
          lastDiagnostics = last.diagnostics;
        }
        const state = last.state;
        const progress = previousFingerprint === undefined ? 'new' : previousFingerprint !== candidateFingerprint || last.state !== (attempts.at(-1)?.state) ? 'gap-closed' : 'none';
        const attempt: AgentSessionAttempt = Object.freeze({turn: attempts.length + 1, state, fingerprint: candidateFingerprint, proposalBytes, progress, receipt: last});
        attempts.push(attempt); snapshotAttempts = Object.freeze([...attempts]);
        previousFingerprint = candidateFingerprint;
        if (stopFor(state) === 'complete' || state === 'needs-choice' || state === 'needs-meaning' || state === 'partial' || state === 'denied' || state === 'stale' || state === 'cancelled') return finalize(stopFor(state));
        if (input.propose === undefined || !recoverable(state)) return finalize(stopFor(state));
        if (repairs >= budget.value.maxRepairs) return finalize('repair-budget');
        repairs++;
        if (attempts.length >= budget.value.maxTurns) return finalize('turn-budget');
        const repairRequest: AgentSessionRepairRequest = Object.freeze({turn: attempts.length + 1, previous: Object.freeze(attempts.map(({turn,state,fingerprint,proposalBytes,progress})=>Object.freeze({turn,state,fingerprint,proposalBytes,progress}))), diagnostics: Object.freeze([...lastDiagnostics]), signal: controller.signal});
        const next = await awaitBoundary((signal) => input.propose!({...repairRequest, signal}), controller.signal, Math.max(1, budget.value.maxMilliseconds - elapsed(start, now)));
        if (next.kind === 'deadline') return finalize('time-budget');
        if (next.kind === 'aborted') return finalize('cancelled');
        if (next.kind === 'failed') return finalize('unavailable');
        candidate = next.value;
      }
    } catch {
      return finalize('unavailable');
    } finally {
      parent?.removeEventListener('abort', onParentAbort);
      active = undefined;
      if (status === 'running') status = 'idle';
    }
  };

  return Object.freeze({
    run,
    cancel(reason?: string): boolean {
      if (active === undefined) return false;
      active.abort(reason);
      return true;
    },
    inspect,
    dispose(): void {
      if (closed) return;
      closed = true;
      active?.abort('disposed');
      active = undefined;
      status = 'closed';
      snapshotAttempts=Object.freeze([]);snapshotReceipt=undefined;currentRequestId=undefined;
    },
  });
}

export const runAgentSession = (session: AgentSession, input: AgentSessionRunInput): Promise<Outcome<AgentSessionReceipt>> => session.run(input);
