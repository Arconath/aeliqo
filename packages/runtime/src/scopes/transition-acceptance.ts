import type { Diagnostic } from '@aeliqo/core';
import { ScopeTransitionHostError } from './authority.js';
import type { GuardCapture } from './guard.js';
import { transitionGuardCurrent } from './guard.js';
import { prepareTransitionHost } from './host-activation.js';
import { transitionFailure } from './transition.js';
import type { ScopeBinding, ScopeResolution, ScopeSnapshot, ScopeTransitionResult } from './types.js';

interface AcceptanceState {
  readonly snapshot: ScopeSnapshot;
  readonly transitionId: number;
  readonly disposed: boolean;
  readonly resolution: ScopeResolution | undefined;
}

interface TransitionAcceptanceInput {
  readonly binding: ScopeBinding;
  readonly capture: GuardCapture;
  readonly id: number;
  readonly resolution: ScopeResolution;
  readonly signal: AbortSignal;
  readState(): AcceptanceState;
  retain(outcome: {
    readonly ok: false;
    readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]];
  }): Promise<ScopeTransitionResult>;
  activate(): ScopeTransitionResult;
}

export async function prepareAcceptedTransition(input: TransitionAcceptanceInput): Promise<ScopeTransitionResult> {
  const state = input.readState();
  let current: boolean;
  try {
    current = transitionGuardCurrent(
      input.binding,
      input.capture,
      state.snapshot,
      input.id,
      state.transitionId,
      state.disposed,
    );
  } catch (error) {
    throw new ScopeTransitionHostError('guard', error);
  }
  if (!current || state.resolution === undefined) return transitionFailure('stale', 'scope.transition-stale');
  if (input.signal.aborted) return transitionFailure('cancelled', 'scope.transition-cancelled');
  const prepared = prepareTransitionHost(input.binding, input.resolution, {
    previous: state.resolution,
    activationEpoch: input.capture.activationEpoch,
    leaveRevision: input.capture.leaveRevision,
  });
  return prepared.ok ? input.activate() : input.retain(prepared);
}
