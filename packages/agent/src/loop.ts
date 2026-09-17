import { parseContract, parseWireValue, type Diagnostic, type Outcome } from '@aeliqo/core';
import type { AgentBindingOutcome, AgentLoopBudget, AgentStopReason } from '@aeliqo/core/agent';
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
  return { code, message, retryable: false };
}

function failure<T>(code: string, message: string): Outcome<T> {
  return { ok: false, diagnostics: [diagnostic(code, message)] };
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
      return `{${Object.keys(object)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
        .join(',')}}`;
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
    try {
      return `invalid:${String(value)}`;
    } catch {
      return 'invalid:candidate';
    }
  }
  const canonical = (entry: unknown): string => {
    if (entry === null) return 'null';
    if (typeof entry !== 'object') return JSON.stringify(entry) ?? 'undefined';
    if (Array.isArray(entry)) return `[${entry.map(canonical).join(',')}]`;
    const object = entry as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
      .join(',')}}`;
  };
  return canonical(parsed.value);
}

function stopOutcome(
  state: AgentBindingOutcome['state'],
  diagnostics?: readonly Diagnostic[],
): AgentBindingOutcome | undefined {
  if (state === 'bound' || state === 'needs-choice' || state === 'needs-meaning') return undefined;
  const checked = parseContract('binding-outcome', {
    state,
    diagnostics:
      diagnostics === undefined || diagnostics.length === 0
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
    ...(outcome === undefined ? {} : { outcome }),
  });
  return { ok: true, value };
}

function elapsed(start: number, now: () => number): number {
  return Math.max(0, safeNow(now) - start);
}

type BoundedResult<T> =
  | { readonly kind: 'value'; readonly value: T }
  | { readonly kind: 'deadline' }
  | { readonly kind: 'aborted' }
  | { readonly kind: 'failed' };

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
  if (parent?.aborted) return { kind: 'aborted' };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let removeParent: (() => void) | undefined;
  let resolveDeadline!: () => void;
  let resolveAborted!: () => void;
  const deadline = new Promise<typeof DEADLINE>((resolve) => {
    resolveDeadline = () => {
      controller.abort();
      resolve(DEADLINE);
    };
  });
  const aborted = new Promise<typeof ABORTED>((resolve) => {
    resolveAborted = () => {
      controller.abort();
      resolve(ABORTED);
    };
  });
  if (parent !== undefined) {
    const onAbort = (): void => resolveAborted();
    if (registerParentAbort(parent, onAbort, resolveAborted)) return { kind: 'aborted' };
    removeParent = () => parent.removeEventListener('abort', onAbort);
  }
  if (!controller.signal.aborted) {
    timer = setTimeout(resolveDeadline, Math.max(0, milliseconds));
  }
  const work = Promise.resolve().then(() => producer(controller.signal));
  try {
    return await raceBoundary(work, deadline, aborted, parent);
  } finally {
    releaseBoundary(controller, timer, removeParent);
  }
}

async function raceBoundary<T>(
  work: Promise<T>,
  deadline: Promise<typeof DEADLINE>,
  aborted: Promise<typeof ABORTED>,
  parent: AbortSignal | undefined,
): Promise<BoundedResult<T>> {
  try {
    const result = await Promise.race([work, deadline, aborted]);
    if (result === DEADLINE) return { kind: 'deadline' };
    if (result === ABORTED) return { kind: 'aborted' };
    return { kind: 'value', value: result as T };
  } catch {
    if (parent?.aborted) return { kind: 'aborted' };
    return { kind: 'failed' };
  }
}

function releaseBoundary(
  controller: AbortController,
  timer: ReturnType<typeof setTimeout> | undefined,
  removeParent: (() => void) | undefined,
): void {
  controller.abort();
  if (timer !== undefined) clearTimeout(timer);
  removeParent?.();
}

function registerParentAbort(parent: AbortSignal, onAbort: () => void, abort: () => void): boolean {
  if (parent.aborted) {
    abort();
    return true;
  }
  parent.addEventListener('abort', onAbort, { once: true });
  return false;
}

async function proposeWithBudget(
  callback: (input: AgentRepairRequest) => unknown | Promise<unknown>,
  request: AgentRepairRequest,
  milliseconds: number,
): Promise<unknown | typeof DEADLINE | typeof ABORTED | typeof FAILED> {
  const result = await awaitBounded((signal) => callback({ ...request, signal }), request.signal, milliseconds);
  if (result.kind === 'deadline') return DEADLINE;
  if (result.kind === 'aborted') return ABORTED;
  if (result.kind === 'failed') return FAILED;
  return result.value;
}

interface ContainmentBudget {
  readonly maxTurns: number;
  readonly maxRepairs: number;
  readonly maxMilliseconds: number;
  readonly maxProposalBytes: number;
}

function normalizeBudget(input: AgentLoopBudget): Outcome<ContainmentBudget> {
  const checked = parseContract('agent-loop-budget', input);
  if (!checked.ok) return { ok: false, diagnostics: checked.diagnostics };
  return { ok: true, value: checked.value as unknown as ContainmentBudget };
}

interface ContainmentRun {
  readonly input: AgentContainmentInput;
  readonly budget: ContainmentBudget;
  readonly now: () => number;
  readonly start: number;
  readonly attempts: AgentAttempt[];
  candidate: unknown;
  hasCandidate: boolean;
  repairs: number;
  previousFingerprint: string | undefined;
  previousCanonical: string | undefined;
  previousState: AgentBindingOutcome['state'] | undefined;
  lastOutcome: AgentBindingOutcome | undefined;
}

function createRun(input: AgentContainmentInput, budget: ContainmentBudget): ContainmentRun {
  return {
    input,
    budget,
    now: input.now ?? Date.now,
    start: safeNow(input.now ?? Date.now),
    attempts: [],
    candidate: input.initial,
    hasCandidate: input.initial !== undefined,
    repairs: 0,
    previousFingerprint: undefined,
    previousCanonical: undefined,
    previousState: undefined,
    lastOutcome: undefined,
  };
}

function loopStop(run: ContainmentRun): AgentContainmentOutcome | undefined {
  if (run.input.signal?.aborted) return receipt('cancelled', run.attempts, run.lastOutcome);
  if (elapsed(run.start, run.now) >= run.budget.maxMilliseconds)
    return receipt('time-budget', run.attempts, run.lastOutcome);
  return undefined;
}

function proposalDiagnostics(run: ContainmentRun): readonly Diagnostic[] {
  const state = run.lastOutcome?.state;
  if (state === 'invalid' || state === 'stale' || state === 'unsupported' || state === 'denied')
    return run.lastOutcome?.diagnostics ?? [];
  return [];
}

function requestLimitStop(run: ContainmentRun): AgentContainmentOutcome | undefined {
  if (run.attempts.length > 0 && run.repairs >= run.budget.maxRepairs)
    return receipt('repair-budget', run.attempts, run.lastOutcome);
  if (run.attempts.length >= run.budget.maxTurns) return receipt('turn-budget', run.attempts, run.lastOutcome);
  return undefined;
}

function proposalStop(
  run: ContainmentRun,
  proposed: unknown | typeof DEADLINE | typeof ABORTED | typeof FAILED,
): AgentContainmentOutcome | undefined {
  if (proposed === DEADLINE) return receipt('time-budget', run.attempts, run.lastOutcome);
  if (proposed === ABORTED || run.input.signal?.aborted) return receipt('cancelled', run.attempts, run.lastOutcome);
  if (proposed === FAILED) return receipt('unavailable', run.attempts, run.lastOutcome);
  return undefined;
}

async function requestCandidate(run: ContainmentRun): Promise<AgentContainmentOutcome | undefined> {
  if (run.hasCandidate) return undefined;
  const limitStop = requestLimitStop(run);
  if (limitStop !== undefined) return limitStop;
  const request: AgentRepairRequest = {
    turn: run.attempts.length + 1,
    previous: Object.freeze([...run.attempts]),
    diagnostics: proposalDiagnostics(run),
    signal: run.input.signal ?? new AbortController().signal,
  };
  let proposed: unknown | typeof DEADLINE | typeof ABORTED | typeof FAILED;
  try {
    proposed = await proposeWithBudget(
      run.input.propose,
      request,
      run.budget.maxMilliseconds - elapsed(run.start, run.now),
    );
  } catch {
    return receipt('unavailable', run.attempts, run.lastOutcome);
  }
  const stop = proposalStop(run, proposed);
  if (stop !== undefined) return stop;
  run.candidate = proposed;
  run.hasCandidate = true;
  if (run.attempts.length > 0) run.repairs += 1;
  return undefined;
}

interface PreparedCandidate {
  readonly fingerprint: string;
  readonly canonical: string;
  readonly proposalBytes: number;
  readonly exceedsByteBudget: boolean;
}

type PreparationResult =
  | { readonly kind: 'ready'; readonly value: PreparedCandidate }
  | { readonly kind: 'stopped'; readonly value: AgentContainmentOutcome };

async function prepareCandidate(run: ContainmentRun): Promise<PreparationResult> {
  const measuredBytes = bytes(run.candidate);
  const canonicalValue = candidateCanonical(run.candidate);
  if (measuredBytes !== undefined && measuredBytes > run.budget.maxProposalBytes)
    return {
      kind: 'ready',
      value: {
        fingerprint: localFingerprint(run.candidate),
        canonical: canonicalValue,
        proposalBytes: measuredBytes,
        exceedsByteBudget: true,
      },
    };
  const result = await awaitBounded(
    (signal) => run.input.binder.fingerprint(run.candidate, { signal, goalEpoch: run.input.goalEpoch }),
    run.input.signal,
    Math.max(0, run.budget.maxMilliseconds - elapsed(run.start, run.now)),
  );
  if (result.kind === 'deadline')
    return { kind: 'stopped', value: receipt('time-budget', run.attempts, run.lastOutcome) };
  if (result.kind === 'aborted' || run.input.signal?.aborted)
    return { kind: 'stopped', value: receipt('cancelled', run.attempts, run.lastOutcome) };
  if (result.kind === 'failed')
    return { kind: 'stopped', value: receipt('unavailable', run.attempts, run.lastOutcome) };
  return {
    kind: 'ready',
    value: {
      fingerprint: result.value.ok ? result.value.value : localFingerprint(run.candidate),
      canonical: canonicalValue,
      proposalBytes: measuredBytes ?? 0,
      exceedsByteBudget: false,
    },
  };
}

function stopForCandidateBudget(run: ContainmentRun, prepared: PreparedCandidate): AgentContainmentOutcome | undefined {
  if (prepared.exceedsByteBudget) {
    const outcome = stopOutcome('invalid', [
      diagnostic('agent.byte-budget', 'The proposal exceeds the configured byte budget.'),
    ]);
    run.attempts.push({
      turn: run.attempts.length + 1,
      state: 'invalid',
      fingerprint: prepared.fingerprint,
      proposalBytes: prepared.proposalBytes,
      progress: 'none',
    });
    return receipt('byte-budget', run.attempts, outcome);
  }
  if (
    run.previousFingerprint !== undefined &&
    run.previousFingerprint === prepared.fingerprint &&
    run.previousCanonical === prepared.canonical
  ) {
    run.attempts.push({
      turn: run.attempts.length + 1,
      state: run.lastOutcome?.state ?? 'invalid',
      fingerprint: prepared.fingerprint,
      proposalBytes: prepared.proposalBytes,
      progress: 'none',
    });
    return receipt('no-progress', run.attempts, run.lastOutcome);
  }
  return undefined;
}

function progressFor(
  run: ContainmentRun,
  state: AgentBindingOutcome['state'],
  fingerprint: string,
): AgentAttemptProgress {
  if (run.previousFingerprint === undefined) return 'new';
  if (run.previousState !== state || run.previousFingerprint !== fingerprint) return 'gap-closed';
  return 'none';
}

function terminalBinding(
  state: AgentBindingOutcome['state'],
  outcome: AgentBindingOutcome | undefined,
  attempts: readonly AgentAttempt[],
): AgentContainmentOutcome | undefined {
  if (outcome === undefined) return undefined;
  switch (state) {
    case 'bound':
      return receipt('complete', attempts, outcome);
    case 'needs-choice':
      return receipt('needs-choice', attempts, outcome);
    case 'needs-meaning':
      return receipt('needs-meaning', attempts, outcome);
    case 'unsupported':
      return receipt('unsupported', attempts, outcome);
    case 'denied':
      return receipt('denied', attempts, outcome);
    case 'stale':
      return receipt('stale', attempts, outcome);
    default:
      return undefined;
  }
}

function bindingBoundaryStop(
  run: ContainmentRun,
  result: BoundedResult<Outcome<AgentBindingOutcome>>,
): AgentContainmentOutcome | undefined {
  if (result.kind === 'deadline') return receipt('time-budget', run.attempts, run.lastOutcome);
  if (result.kind === 'aborted' || run.input.signal?.aborted)
    return receipt('cancelled', run.attempts, run.lastOutcome);
  if (result.kind === 'failed') return receipt('unavailable', run.attempts, run.lastOutcome);
  if (run.input.signal?.aborted) return receipt('cancelled', run.attempts, run.lastOutcome);
  if (elapsed(run.start, run.now) >= run.budget.maxMilliseconds)
    return receipt('time-budget', run.attempts, run.lastOutcome);
  return undefined;
}

async function bindCandidate(
  run: ContainmentRun,
  prepared: PreparedCandidate,
): Promise<AgentContainmentOutcome | undefined> {
  const result = await awaitBounded(
    (signal) =>
      run.input.binder.bind(run.candidate, {
        signal,
        goalEpoch: run.input.goalEpoch,
      }),
    run.input.signal,
    Math.max(0, run.budget.maxMilliseconds - elapsed(run.start, run.now)),
  );
  const stop = bindingBoundaryStop(run, result);
  if (stop !== undefined) return stop;
  if (result.kind !== 'value') return receipt('unavailable', run.attempts, run.lastOutcome);
  const bound = result.value;
  const outcome = bound.ok ? bound.value : stopOutcome('invalid', bound.diagnostics);
  const state = bound.ok ? bound.value.state : 'invalid';
  run.attempts.push({
    turn: run.attempts.length + 1,
    state,
    fingerprint: prepared.fingerprint,
    proposalBytes: prepared.proposalBytes,
    progress: progressFor(run, state, prepared.fingerprint),
  });
  run.previousFingerprint = prepared.fingerprint;
  run.previousCanonical = prepared.canonical;
  run.previousState = state;
  run.lastOutcome = outcome;
  run.hasCandidate = false;
  const terminal = terminalBinding(state, outcome, run.attempts);
  if (terminal !== undefined) return terminal;
  if (run.repairs >= run.budget.maxRepairs) return receipt('repair-budget', run.attempts, run.lastOutcome);
  if (run.attempts.length >= run.budget.maxTurns) return receipt('turn-budget', run.attempts, run.lastOutcome);
  return undefined;
}

function validContainmentInput(input: AgentContainmentInput): boolean {
  return (
    input !== null &&
    typeof input === 'object' &&
    typeof input.propose === 'function' &&
    input.binder !== null &&
    typeof input.binder.bind === 'function' &&
    typeof input.binder.fingerprint === 'function'
  );
}

/**
 * Run model repair as a bounded proposal loop.  This function only binds
 * accepted proposals; it never executes a query, presentation commit, or
 * business effect.
 */
export async function containAgentProposal(input: AgentContainmentInput): Promise<AgentContainmentOutcome> {
  if (!validContainmentInput(input)) return failure('agent.invalid-input', 'The containment loop input is malformed.');

  const budget = normalizeBudget(input.budget);
  if (!budget.ok) return budget;
  const run = createRun(input, budget.value);
  for (;;) {
    const stop = loopStop(run);
    if (stop !== undefined) return stop;
    const proposalStop = await requestCandidate(run);
    if (proposalStop !== undefined) return proposalStop;
    if (run.attempts.length >= run.budget.maxTurns) return receipt('turn-budget', run.attempts, run.lastOutcome);
    const prepared = await prepareCandidate(run);
    if (prepared.kind === 'stopped') return prepared.value;
    const budgetStop = stopForCandidateBudget(run, prepared.value);
    if (budgetStop !== undefined) return budgetStop;
    const bindingStop = await bindCandidate(run, prepared.value);
    if (bindingStop !== undefined) return bindingStop;
  }
}
