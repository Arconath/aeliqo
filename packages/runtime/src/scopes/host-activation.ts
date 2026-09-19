import type { Outcome } from '@aeliqo/core';
import { runtimeDiagnostic } from './diagnostic.js';
import { normalizeVoidOutcome } from './outcome.js';
import type { ScopeBinding, ScopeResolution } from './types.js';

interface TransitionActivationInput {
  readonly previous: ScopeResolution;
  readonly activationEpoch: number;
  readonly leaveRevision: string;
}

export function activateInitialHost(binding: ScopeBinding, resolution: ScopeResolution): Outcome<void> {
  return invokeActivation(binding, resolution, Object.freeze({ kind: 'initial' }));
}

export function activateTransitionHost(
  binding: ScopeBinding,
  resolution: ScopeResolution,
  input: TransitionActivationInput,
): Outcome<void> {
  return invokeActivation(binding, resolution, Object.freeze({ kind: 'transition', ...input }));
}

function invokeActivation(
  binding: ScopeBinding,
  resolution: ScopeResolution,
  context: Parameters<ScopeBinding['activate']>[1],
): Outcome<void> {
  const fallback = runtimeDiagnostic(
    'scope.activation-failed',
    'The host could not atomically accept the scope activation.',
  );
  try {
    return normalizeVoidOutcome(binding.activate(resolution, context), fallback, true);
  } catch {
    return { ok: false, diagnostics: [fallback] };
  }
}

export function isolateHost(callback: () => void): void {
  try {
    callback();
  } catch {
    // Security fencing and disposal do not depend on optional host cleanup hooks.
  }
}
