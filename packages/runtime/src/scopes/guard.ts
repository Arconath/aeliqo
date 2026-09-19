import type { Outcome } from '@aeliqo/core';
import type { ScopeBinding, ScopeLeaveDecision, ScopeSelector, ScopeSnapshot } from './types.js';

export interface GuardCapture {
  readonly selector: ScopeSelector;
  readonly activationEpoch: number;
  readonly permissionRevision: number;
  readonly policyRevision: string;
  readonly leaveRevision: string;
}

export function captureGuard(binding: ScopeBinding, snapshot: ScopeSnapshot): GuardCapture {
  if (snapshot.selector === null || snapshot.policyRevision === undefined)
    throw new TypeError('A leave guard requires an active scope.');
  return Object.freeze({
    selector: snapshot.selector,
    activationEpoch: snapshot.activationEpoch,
    permissionRevision: snapshot.permissionRevision,
    policyRevision: snapshot.policyRevision,
    leaveRevision: binding.readLeaveState?.(snapshot.selector).revision ?? 'clean',
  });
}

export function guardStillCurrent(binding: ScopeBinding, capture: GuardCapture, snapshot: ScopeSnapshot): boolean {
  const currentRevision = binding.readLeaveState?.(capture.selector).revision ?? 'clean';
  return (
    snapshot.active &&
    snapshot.activationEpoch === capture.activationEpoch &&
    snapshot.permissionRevision === capture.permissionRevision &&
    snapshot.policyRevision === capture.policyRevision &&
    currentRevision === capture.leaveRevision
  );
}

export async function runLeaveGuard(
  binding: ScopeBinding,
  capture: GuardCapture,
  requested: ScopeSelector,
  signal: AbortSignal,
): Promise<ScopeLeaveDecision> {
  const state = binding.readLeaveState?.(capture.selector) ?? { dirty: false, revision: 'clean' };
  if (!state.dirty) return { status: 'clean' };
  if (binding.beforeLeave === undefined) return { status: 'needs-input' };
  return binding.beforeLeave({
    active: capture.selector,
    requested,
    activationEpoch: capture.activationEpoch,
    revision: capture.leaveRevision,
    signal,
  });
}

export async function saveGuard(
  decision: Extract<ScopeLeaveDecision, { readonly status: 'save' }>,
  signal: AbortSignal,
): Promise<Outcome<void>> {
  return decision.save({ signal });
}
