import {
  parseContract,
  parseWireValue,
  type AgentBindingOutcome,
  type AgentLoopBudget,
  type AgentStopReason,
  type Diagnostic,
  type Outcome,
} from '@aeliqo/core';
import type {
  AgentAttempt,
  AgentAttemptProgress,
  AgentContainmentInput,
  AgentContainmentOutcome,
  AgentContainmentReceipt,
  AgentRepairRequest,
} from './loop-types.js';

const DEADLINE = Symbol('agent-deadline');
const ABORTED = Symbol('agent-aborted');
const FAILED = Symbol('agent-failed');

function diagnostic(code: string, message: string): Diagnostic {
  return {code, message, retryable: false};
}

function failure<T>(code: string, message: string): Outcome<T> {
  return {ok: false, diagnostics: [diagnostic(code, message)]};
}

function safeNow(now: () => number): number {
  try {
    const value = now();
    return Number.isFinite(value) ? value : Date.now();
  } catch {
    return Date.now();
  }
}

function bytes(value: unknown): number | undefined {
  if (typeof value === 'string') return new TextEncoder().encode(value).byteLength;
  const parsed = parseWireValue(value);
  // A non-wire object should reach the binder and become `invalid`; treating
  // an unstringifiable value as an enormous payload would misclassify shape
  // failure as a byte-budget stop.  String candidates are measured before
  // parsing so oversized JSON still receives the byte-budget outcome.
  if (!parsed.ok) return undefined;
  try {
    return new TextEncoder().encode(JSON.stringify(parsed.value)).byteLength;
  } catch {
    return undefined;
  }
}

function localFingerprint(value: unknown): string {
  const parsed = parseWireValue(value);
  if (!parsed.ok) return 'invalid-candidate';
  try {
    const canonical = (entry: unknown): string => {
      if (entry === null) return 'null';
      if (typeof entry !== 'object') return JSON.stringify(entry) ?? 'undefined';
      if (Array.isArray(entry)) return `[${entry.map(canonical).join(',')}]`;
      const object = entry as Record<string, unknown>;
      return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
    };
    const wire = canonical(parsed.value);
    let hash = 2166136261;
    for (const character of wire) {
      hash ^= character.codePointAt(0)!;
      hash = Math.imul(hash, 16777619);
    }
    return `candidate-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  } catch {
    return 'invalid-candidate';
  }
}

function candidateCanonical(value: unknown): string {
  const parsed = parseWireValue(value);
  if (!parsed.ok) {
    try { return `invalid:${String(value)}`; }
    catch { return 'invalid:candidate'; }
  }
  const canonical = (entry: unknown): string => {
    if (entry === null) return 'null';
    if (typeof entry !== 'object') return JSON.stringify(entry) ?? 'undefined';
    if (Array.isArray(entry)) return `[${entry.map(canonical).join(',')}]`;
    const object = entry as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
  };
  return canonical(parsed.value);
}

function stopOutcome(state: AgentBindingOutcome['state'], diagnostics?: readonly Diagnostic[]): AgentBindingOutcome | undefined {
  if (state === 'bound' || state === 'needs-choice' || state === 'needs-meaning') return undefined;
  const checked = parseContract('binding-outcome', {
    state,
    diagnostics: diagnostics === undefined || diagnostics.length === 0
      ? [diagnostic('agent.stop', 'The containment loop stopped before accepting a proposal.')]
      : diagnostics,
  });
  return checked.ok ? checked.value : undefined;
}

function receipt(
  stop: AgentStopReason,
  attempts: readonly AgentAttempt[],
  outcome?: AgentBindingOutcome,
): AgentContainmentOutcome {
  const value: AgentContainmentReceipt = Object.freeze({
    stop,
    attempts: Object.freeze([...attempts]),
    ...(outcome === undefined ? {} : {outcome}),
  });
  return {ok: true, value};
}

function elapsed(start: number, now: () => number): number {
  return Math.max(0, safeNow(now) - start);
}

type BoundedResult<T> =
  | {readonly kind: 'value'; readonly value: T}
  | {readonly kind: 'deadline'}
  | {readonly kind: 'aborted'}
  | {readonly kind: 'failed'};

/** Await an untrusted provider/host boundary without allowing a late result
 * to continue the containment run. The child signal is always aborted when
 * this wait ends, including the successful case. */
async function awaitBounded<T>(
  producer: (signal: AbortSignal) => T | PromiseLike<T>,
  parent: AbortSignal | undefined,
  milliseconds: number,
): Promise<BoundedResult<T>> {
  // Do not even schedule untrusted work after the containment run has been
  // cancelled.  Scheduling through Promise.resolve().then() here would call
  // a producer once more despite an already-aborted parent signal.
  if (parent?.aborted) return {kind: 'aborted'};
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let removeParent: (() => void) | undefined;
  let resolveDeadline!: () => void;
  let resolveAborted!: () => void;
  const deadline = new Promise<typeof DEADLINE>((resolve) => {
    resolveDeadline = () => { controller.abort(); resolve(DEADLINE); };
  });
  const aborted = new Promise<typeof ABORTED>((resolve) => {
    resolveAborted = () => { controller.abort(); resolve(ABORTED); };
  });
  if (parent !== undefined) {
    const onAbort = (): void => resolveAborted();
    if (parent.aborted) {
      resolveAborted();
      return {kind: 'aborted'};
    }
    else {
      parent.addEventListener('abort', onAbort, {once: true});
      removeParent = () => parent.removeEventListener('abort', onAbort);
    }
  }
  if (!controller.signal.aborted) {
    timer = setTimeout(resolveDeadline, Math.max(0, milliseconds));
  }
  const work = Promise.resolve().then(() => producer(controller.signal));
  try {
    const result = await Promise.race([work, deadline, aborted]);
    if (result === DEADLINE) return {kind: 'deadline'};
    if (result === ABORTED) return {kind: 'aborted'};
    return {kind: 'value', value: result as T};
  } catch {
    if (parent?.aborted) return {kind: 'aborted'};
    return {kind: 'failed'};
  } finally {
    controller.abort();
    if (timer !== undefined) clearTimeout(timer);
    removeParent?.();
  }
}

async function proposeWithBudget(
  callback: (input: AgentRepairRequest) => unknown | Promise<unknown>,
  request: AgentRepairRequest,
  milliseconds: number,
): Promise<unknown | typeof DEADLINE | typeof ABORTED | typeof FAILED> {
  const result = await awaitBounded((signal) => callback({...request, signal}), request.signal, milliseconds);
  if (result.kind === 'deadline') return DEADLINE;
  if (result.kind === 'aborted') return ABORTED;
  if (result.kind === 'failed') return FAILED;
  return result.value;
}

function normalizeBudget(input: AgentLoopBudget): Outcome<AgentLoopBudget> {
  const checked = parseContract('agent-loop-budget', input);
  if (!checked.ok) return checked;
  return checked;
}

/**
 * Run model repair as a bounded proposal loop.  This function only binds
 * accepted proposals; it never executes a query, presentation commit, or
 * business effect.
 */
export async function containAgentProposal(input: AgentContainmentInput): Promise<AgentContainmentOutcome> {
  if (input === null || typeof input !== 'object' || typeof input.propose !== 'function' ||
      input.binder === null || typeof input.binder.bind !== 'function' || typeof input.binder.fingerprint !== 'function')
    return failure('agent.invalid-input', 'The containment loop input is malformed.');

  const budget = normalizeBudget(input.budget);
  if (!budget.ok) return budget;
  const now = input.now ?? Date.now;
  const start = safeNow(now);
  const attempts: AgentAttempt[] = [];
  let candidate: unknown = input.initial;
  let hasCandidate = input.initial !== undefined;
  let repairs = 0;
  let previousFingerprint: string | undefined;
  let previousCanonical: string | undefined;
  let previousState: AgentBindingOutcome['state'] | undefined;
  let lastOutcome: AgentBindingOutcome | undefined;

  while (true) {
    if (input.signal?.aborted) return receipt('cancelled', attempts, lastOutcome);
    if (elapsed(start, now) >= budget.value.maxMilliseconds) return receipt('time-budget', attempts, lastOutcome);
    if (!hasCandidate) {
      if (attempts.length > 0 && repairs >= budget.value.maxRepairs) return receipt('repair-budget', attempts, lastOutcome);
      if (attempts.length >= budget.value.maxTurns) return receipt('turn-budget', attempts, lastOutcome);
      const request: AgentRepairRequest = {
        turn: attempts.length + 1,
        previous: Object.freeze([...attempts]),
        diagnostics: lastOutcome?.state === 'invalid' || lastOutcome?.state === 'stale' || lastOutcome?.state === 'unsupported' || lastOutcome?.state === 'denied'
          ? lastOutcome.diagnostics : [],
        signal: input.signal ?? new AbortController().signal,
      };
      let proposed: unknown | typeof DEADLINE | typeof ABORTED;
      try {
        proposed = await proposeWithBudget(input.propose, request, budget.value.maxMilliseconds - elapsed(start, now));
      } catch {
        return receipt('unavailable', attempts, lastOutcome);
      }
      if (proposed === DEADLINE) return receipt('time-budget', attempts, lastOutcome);
      if (proposed === ABORTED || input.signal?.aborted) return receipt('cancelled', attempts, lastOutcome);
      if (proposed === FAILED) return receipt('unavailable', attempts, lastOutcome);
      candidate = proposed;
      hasCandidate = true;
      if (attempts.length > 0) repairs++;
    }

    if (attempts.length >= budget.value.maxTurns) return receipt('turn-budget', attempts, lastOutcome);
    const measuredBytes = bytes(candidate);
    const proposalBytes = measuredBytes ?? 0;
    const candidateKey = candidateCanonical(candidate);
    let fingerprint: string;
    if (measuredBytes !== undefined && measuredBytes > budget.value.maxProposalBytes) {
      fingerprint = localFingerprint(candidate);
    } else {
      const remaining = Math.max(0, budget.value.maxMilliseconds - elapsed(start, now));
      const fingerprintResult = await awaitBounded((signal) => input.binder.fingerprint(candidate, {
        signal,
        goalEpoch: input.goalEpoch,
      }), input.signal, remaining);
      if (fingerprintResult.kind === 'deadline') return receipt('time-budget', attempts, lastOutcome);
      if (fingerprintResult.kind === 'aborted' || input.signal?.aborted) return receipt('cancelled', attempts, lastOutcome);
      if (fingerprintResult.kind === 'failed') return receipt('unavailable', attempts, lastOutcome);
      fingerprint = fingerprintResult.value.ok ? fingerprintResult.value.value : localFingerprint(candidate);
    }
    if (measuredBytes !== undefined && measuredBytes > budget.value.maxProposalBytes) {
      const outcome = stopOutcome('invalid', [diagnostic('agent.byte-budget', 'The proposal exceeds the configured byte budget.')]);
      const attempt: AgentAttempt = {turn: attempts.length + 1, state: 'invalid', fingerprint, proposalBytes, progress: 'none'};
      attempts.push(attempt);
      return receipt('byte-budget', attempts, outcome);
    }
    if (previousFingerprint !== undefined && previousFingerprint === fingerprint && previousCanonical === candidateKey) {
      const outcome = lastOutcome;
      const attempt: AgentAttempt = {
        turn: attempts.length + 1,
        state: outcome?.state ?? 'invalid',
        fingerprint,
        proposalBytes,
        progress: 'none',
      };
      attempts.push(attempt);
      return receipt('no-progress', attempts, outcome);
    }
    const remaining = Math.max(0, budget.value.maxMilliseconds - elapsed(start, now));
    const boundResult = await awaitBounded((signal) => input.binder.bind(candidate, {
      signal,
      goalEpoch: input.goalEpoch,
    }), input.signal, remaining);
    if (boundResult.kind === 'deadline') return receipt('time-budget', attempts, lastOutcome);
    if (boundResult.kind === 'aborted' || input.signal?.aborted) return receipt('cancelled', attempts, lastOutcome);
    if (boundResult.kind === 'failed') return receipt('unavailable', attempts, lastOutcome);
    const bound = boundResult.value;
    if (input.signal?.aborted) return receipt('cancelled', attempts, lastOutcome);
    if (elapsed(start, now) >= budget.value.maxMilliseconds) return receipt('time-budget', attempts, lastOutcome);
    const outcome = bound.ok ? bound.value : stopOutcome('invalid', bound.diagnostics);
    const state = bound.ok ? bound.value.state : 'invalid';
    const progress: AgentAttemptProgress = previousFingerprint === undefined
      ? 'new'
      : previousState !== state || previousFingerprint !== fingerprint ? 'gap-closed' : 'none';
    attempts.push({turn: attempts.length + 1, state, fingerprint, proposalBytes, progress});
    previousFingerprint = fingerprint;
    previousCanonical = candidateKey;
    previousState = state;
    lastOutcome = outcome;
    hasCandidate = false;
    if (bound.ok) {
      if (bound.value.state === 'bound') return receipt('complete', attempts, bound.value);
      if (bound.value.state === 'needs-choice') return receipt('needs-choice', attempts, bound.value);
      if (bound.value.state === 'needs-meaning') return receipt('needs-meaning', attempts, bound.value);
      if (bound.value.state === 'unsupported') return receipt('unsupported', attempts, bound.value);
      if (bound.value.state === 'denied') return receipt('denied', attempts, bound.value);
      if (bound.value.state === 'stale') return receipt('stale', attempts, bound.value);
    }
    if (repairs >= budget.value.maxRepairs) return receipt('repair-budget', attempts, lastOutcome);
    if (attempts.length >= budget.value.maxTurns) return receipt('turn-budget', attempts, lastOutcome);
  }
}

export const runAgentContainment = containAgentProposal;
