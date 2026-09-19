import type { Diagnostic } from '@aeliqo/core';
import type { ScopeResolution, ScopeSnapshot } from './types.js';

export function activeSnapshot(
  current: ScopeSnapshot,
  resolution: ScopeResolution,
  activationEpoch: number,
): ScopeSnapshot {
  return Object.freeze({
    runtimeId: current.runtimeId,
    scopeInstanceId: current.scopeInstanceId,
    activationEpoch,
    active: true,
    permissionRevision: resolution.permissionRevision,
    status: 'active',
    selector: resolution.selector,
    policyRevision: resolution.policyRevision,
    revision: String(Number(current.revision) + 1),
  });
}

export function failedActivationSnapshot(current: ScopeSnapshot, diagnostic: Diagnostic): ScopeSnapshot {
  return Object.freeze({
    runtimeId: current.runtimeId,
    scopeInstanceId: current.scopeInstanceId,
    activationEpoch: current.activationEpoch,
    active: false,
    permissionRevision: current.permissionRevision + 1,
    status: 'denied',
    selector: null,
    revision: String(Number(current.revision) + 1),
    diagnostic,
  });
}
