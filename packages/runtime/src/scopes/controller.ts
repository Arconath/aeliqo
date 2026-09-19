import type { Diagnostic, Outcome } from '@aeliqo/core';
import { activeSnapshot } from './activation.js';
import { freezeResolution, freezeSelector, sameSelector } from './address.js';
import type { SurfaceAddress } from '../surfaces/types.js';
import { captureGuard, guardStillCurrent, runLeaveGuard, saveGuard } from './guard.js';
import { ScopeLifecycle } from './teardown.js';
import { firstDiagnosticCode, needsInput, transitionFailure } from './transition.js';
import type {
  CreateScopeInput,
  ScopeController,
  ScopeInvalidationReason,
  ScopeRequestOptions,
  ScopeResolution,
  ScopeSelector,
  ScopeSnapshot,
  ScopeTransitionResult,
} from './types.js';

let nextScopeId = 1;

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message, retryable: false });
}

export class ScopeControllerImpl implements ScopeController {
  private readonly lifecycle = new ScopeLifecycle();
  private readonly initial: ScopeSelector;
  private snapshot: ScopeSnapshot;
  private resolution: ScopeResolution | undefined;
  private activeTransition: AbortController | undefined;
  private transitionId = 0;
  private attachCount = 0;
  private disposed = false;
  private readonly targets = new Map<number, Set<() => void>>();

  constructor(
    runtimeId: string,
    private readonly input: CreateScopeInput,
    private readonly onDispose: () => void,
  ) {
    this.initial = freezeSelector(input.initial);
    this.snapshot = Object.freeze({
      runtimeId,
      scopeInstanceId: input.id ?? `scope-${nextScopeId++}`,
      activationEpoch: 0,
      active: false,
      permissionRevision: 0,
      status: 'idle',
      selector: null,
      revision: '0',
    });
  }

  getSnapshot(): ScopeSnapshot {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    if (this.disposed) return () => undefined;
    return this.lifecycle.subscribe(listener);
  }

  subscribeFence(listener: () => void): () => void {
    if (this.disposed) return () => undefined;
    return this.lifecycle.subscribeFence(listener);
  }

  registerTarget(address: SurfaceAddress, fence: () => void): () => void {
    if (
      !this.snapshot.active ||
      address.runtimeId !== this.snapshot.runtimeId ||
      address.scopeInstanceId !== this.snapshot.scopeInstanceId ||
      address.activationEpoch !== this.snapshot.activationEpoch
    )
      throw new TypeError('A surface target must belong to the current active scope activation.');
    const targets = this.targets.get(address.activationEpoch) ?? new Set<() => void>();
    targets.add(fence);
    this.targets.set(address.activationEpoch, targets);
    let registered = true;
    return () => {
      if (!registered) return;
      registered = false;
      targets.delete(fence);
      if (targets.size === 0) this.targets.delete(address.activationEpoch);
    };
  }

  attach(): () => void {
    if (this.disposed) return () => undefined;
    this.attachCount += 1;
    if (this.attachCount === 1 && this.snapshot.status === 'idle') void this.activateInitial();
    let attached = true;
    return () => {
      if (!attached) return;
      attached = false;
      this.attachCount -= 1;
      if (this.attachCount === 0 && this.snapshot.status === 'resolving' && this.snapshot.selector === null) {
        this.activeTransition?.abort();
        this.transitionId += 1;
        this.snapshot = Object.freeze({
          ...this.snapshot,
          status: 'idle',
          revision: String(Number(this.snapshot.revision) + 1),
        });
        this.lifecycle.notify();
      }
    };
  }

  async requestChange(selector: ScopeSelector, options: ScopeRequestOptions = {}): Promise<ScopeTransitionResult> {
    if (this.disposed) return transitionFailure('disposed', 'scope.disposed');
    if (!this.snapshot.active || this.resolution === undefined) return transitionFailure('denied', 'scope.inactive');
    const requested = freezeSelector(selector);
    if (sameSelector(requested, this.snapshot.selector))
      return Object.freeze({
        status: 'active',
        selector: this.snapshot.selector!,
        activationEpoch: this.snapshot.activationEpoch,
      });
    const transition = this.beginTransition(requested, options.signal);
    const capture = captureGuard(this.input.binding, this.snapshot);
    try {
      return await this.runTransition(transition.id, capture, requested, transition.controller.signal);
    } catch {
      return await this.handleTransitionException(transition.id, capture, transition.controller.signal);
    } finally {
      transition.cleanup();
      this.clearPending(transition.id);
    }
  }

  authorize(featureId: string): Outcome<void> {
    if (!this.snapshot.active || this.resolution === undefined)
      return denied(this.disposed ? 'scope.disposed' : 'scope.inactive');
    if (this.resolution.allowedFeatures !== undefined && !this.resolution.allowedFeatures.includes(featureId))
      return denied('scope.feature-denied');
    return { ok: true, value: undefined };
  }

  invalidate(reason: ScopeInvalidationReason): void {
    if (this.disposed || this.snapshot.status === 'denied') return;
    const before = this.snapshot;
    const resolution = this.resolution;
    this.activeTransition?.abort();
    this.resolution = undefined;
    this.snapshot = Object.freeze({
      runtimeId: before.runtimeId,
      scopeInstanceId: before.scopeInstanceId,
      activationEpoch: before.activationEpoch,
      active: false,
      permissionRevision: before.permissionRevision + 1,
      status: 'denied',
      selector: null,
      revision: String(Number(before.revision) + 1),
      invalidationReason: reason,
    });
    this.fenceTargets(before.activationEpoch);
    this.lifecycle.fence();
    this.lifecycle.notify();
    if (before.selector !== null && before.policyRevision !== undefined)
      this.isolateHost(() =>
        this.input.binding.recover?.({
          selector: before.selector!,
          policyRevision: before.policyRevision!,
          activationEpoch: before.activationEpoch,
          reason,
        }),
      );
    if (resolution !== undefined) this.isolateHost(() => this.input.binding.deactivate?.(resolution, reason));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.activeTransition?.abort();
    const before = this.snapshot;
    const resolution = this.resolution;
    this.resolution = undefined;
    this.snapshot = Object.freeze({
      runtimeId: before.runtimeId,
      scopeInstanceId: before.scopeInstanceId,
      activationEpoch: before.activationEpoch,
      active: false,
      permissionRevision: before.permissionRevision + 1,
      status: 'disposed',
      selector: null,
      revision: String(Number(before.revision) + 1),
    });
    this.fenceTargets(before.activationEpoch);
    this.lifecycle.dispose();
    if (resolution !== undefined) this.isolateHost(() => this.input.binding.deactivate?.(resolution, 'dispose'));
    this.onDispose();
  }

  private async activateInitial(): Promise<void> {
    const transition = this.beginTransition(this.initial);
    this.snapshot = Object.freeze({
      ...this.snapshot,
      status: 'resolving',
      revision: String(Number(this.snapshot.revision) + 1),
    });
    this.lifecycle.notify();
    try {
      const resolved = await this.input.binding.resolve(this.initial, { signal: transition.controller.signal });
      if (transition.controller.signal.aborted || transition.id !== this.transitionId) return;
      const checked = this.validateResolution(resolved, this.initial);
      if (!checked.ok) {
        this.publishInitialFailure(checked.diagnostics[0]);
        return;
      }
      await this.activateResolvedInitial(transition.id, checked.value, transition.controller.signal);
    } catch {
      if (!transition.controller.signal.aborted)
        this.publishInitialFailure(diagnostic('scope.resolve-failed', 'The initial scope could not be resolved.'));
    } finally {
      transition.cleanup();
    }
  }

  private beginTransition(selector: ScopeSelector, parent?: AbortSignal) {
    this.activeTransition?.abort();
    const controller = new AbortController();
    const abort = () => controller.abort();
    parent?.addEventListener('abort', abort, { once: true });
    const id = ++this.transitionId;
    this.activeTransition = controller;
    if (this.snapshot.active) this.publishPending(id, selector, 'guard');
    return {
      id,
      controller,
      cleanup: () => {
        parent?.removeEventListener('abort', abort);
        if (this.activeTransition === controller) this.activeTransition = undefined;
      },
    };
  }

  private async guard(
    capture: ReturnType<typeof captureGuard>,
    requested: ScopeSelector,
    signal: AbortSignal,
  ): Promise<ScopeTransitionResult | undefined> {
    const decision = await runLeaveGuard(this.input.binding, capture, requested, signal);
    if (signal.aborted) return transitionFailure('cancelled', 'scope.transition-cancelled');
    if (decision.status === 'stay') return this.keepActive('cancelled', 'scope.guard-stay');
    if (decision.status === 'needs-input')
      return this.keepActive('needs-input', decision.diagnostic?.code ?? 'scope.guard-required');
    if (decision.status !== 'save') return undefined;
    const saved = await saveGuard(decision, signal);
    if (signal.aborted) return transitionFailure('cancelled', 'scope.transition-cancelled');
    if (!saved.ok) return this.keepActive('needs-input', firstDiagnosticCode(saved.diagnostics, 'scope.save-failed'));
    return undefined;
  }

  private async runTransition(
    id: number,
    capture: ReturnType<typeof captureGuard>,
    requested: ScopeSelector,
    signal: AbortSignal,
  ): Promise<ScopeTransitionResult> {
    const guarded = await this.guard(capture, requested, signal);
    if (guarded !== undefined) return guarded;
    const afterGuard = await this.recheckActive(id, capture, signal);
    if (afterGuard !== undefined) return afterGuard;
    this.publishPending(id, requested, 'resolving');
    const resolved = await this.input.binding.resolve(requested, { signal });
    return this.finishResolvedTransition(id, capture, requested, resolved, signal);
  }

  private async finishResolvedTransition(
    id: number,
    capture: ReturnType<typeof captureGuard>,
    requested: ScopeSelector,
    resolved: Outcome<ScopeResolution>,
    signal: AbortSignal,
  ): Promise<ScopeTransitionResult> {
    if (signal.aborted) return transitionFailure('cancelled', 'scope.transition-cancelled');
    const checked = this.validateResolution(resolved, requested);
    if (!checked.ok) return this.retainOrDeny(id, capture, checked, 'scope.resolve-failed', signal);
    const afterResolve = await this.recheckActive(id, capture, signal);
    if (afterResolve !== undefined) return afterResolve;
    const target = await this.input.binding.authorize(checked.value, { signal });
    if (!target.ok) return this.retainOrDeny(id, capture, target, 'scope.permission-denied', signal);
    const afterTarget = await this.recheckActive(id, capture, signal);
    if (afterTarget !== undefined) return afterTarget;
    return this.activate(id, checked.value);
  }

  private validateResolution(outcome: Outcome<ScopeResolution>, requested: ScopeSelector): Outcome<ScopeResolution> {
    if (!outcome.ok) return outcome;
    let resolution: ScopeResolution;
    try {
      resolution = freezeResolution(outcome.value);
    } catch {
      return denied('scope.resolve-invalid');
    }
    return sameSelector(resolution.selector, requested)
      ? { ok: true, value: resolution }
      : denied('scope.selector-mismatch');
  }

  private async activateResolvedInitial(id: number, resolution: ScopeResolution, signal: AbortSignal): Promise<void> {
    const authorized = await this.input.binding.authorize(resolution, { signal });
    if (!authorized.ok) return this.publishInitialFailure(authorized.diagnostics[0]);
    if (signal.aborted || id !== this.transitionId) return;
    const activated = this.input.binding.activate?.(resolution);
    if (activated !== undefined && !activated.ok) return this.publishInitialFailure(activated.diagnostics[0]);
    this.resolution = resolution;
    this.snapshot = activeSnapshot(this.snapshot, resolution, 1);
    this.lifecycle.notify();
  }

  private async handleTransitionException(
    id: number,
    capture: ReturnType<typeof captureGuard>,
    signal: AbortSignal,
  ): Promise<ScopeTransitionResult> {
    if (signal.aborted) return transitionFailure('cancelled', 'scope.transition-cancelled');
    return this.retainOrDeny(id, capture, denied('scope.transition-failed'), 'scope.transition-failed', signal);
  }

  private isCurrent(id: number, capture: ReturnType<typeof captureGuard>): boolean {
    if (id !== this.transitionId || this.disposed) return false;
    return guardStillCurrent(this.input.binding, capture, this.snapshot);
  }

  private activate(id: number, resolution: ScopeResolution): ScopeTransitionResult {
    if (id !== this.transitionId) return transitionFailure('stale', 'scope.transition-stale');
    const oldResolution = this.resolution;
    const before = this.snapshot;
    const epoch = this.snapshot.activationEpoch + 1;
    this.snapshot = Object.freeze({ ...this.snapshot, active: false });
    this.fenceTargets(before.activationEpoch);
    this.lifecycle.fence();
    if (oldResolution !== undefined)
      this.isolateHost(() => this.input.binding.deactivate?.(oldResolution, 'transition'));
    let activated: Outcome<void> | void;
    try {
      activated = this.input.binding.activate?.(resolution);
    } catch {
      return this.failClosed(before, 'scope.activation-failed');
    }
    if (activated !== undefined && !activated.ok) return this.failClosed(before, activated.diagnostics[0].code);
    this.resolution = resolution;
    this.snapshot = activeSnapshot(before, resolution, epoch);
    this.lifecycle.notify();
    return Object.freeze({ status: 'active', selector: resolution.selector, activationEpoch: epoch });
  }

  private publishPending(id: number, selector: ScopeSelector, phase: 'guard' | 'resolving'): void {
    this.snapshot = Object.freeze({
      ...this.snapshot,
      pending: Object.freeze({ selector, phase: phase === 'guard' ? 'guarding' : phase, requestId: `scope-${id}` }),
      revision: String(Number(this.snapshot.revision) + 1),
    });
    this.lifecycle.notify();
  }

  private keepActive(status: 'needs-input' | 'cancelled', diagnosticCode: string): ScopeTransitionResult {
    if (this.snapshot.pending !== undefined) {
      const { pending: _pending, ...active } = this.snapshot;
      this.snapshot = Object.freeze({ ...active, revision: String(Number(active.revision) + 1) });
      this.lifecycle.notify();
    }
    return status === 'needs-input' ? needsInput(diagnosticCode) : transitionFailure(status, diagnosticCode);
  }

  private finishFailure(
    id: number,
    outcome: { readonly ok: false; readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]] },
    fallback: string,
  ): ScopeTransitionResult {
    if (id !== this.transitionId) return transitionFailure('stale', 'scope.transition-stale');
    const code = firstDiagnosticCode(outcome.diagnostics, fallback);
    this.keepActive('cancelled', code);
    return transitionFailure(code.includes('denied') || code.includes('permission') ? 'denied' : 'failed', code);
  }

  private async recheckActive(
    id: number,
    capture: ReturnType<typeof captureGuard>,
    signal: AbortSignal,
  ): Promise<ScopeTransitionResult | undefined> {
    if (signal.aborted) return transitionFailure('cancelled', 'scope.transition-cancelled');
    if (!this.isCurrent(id, capture) || this.resolution === undefined)
      return transitionFailure('stale', 'scope.transition-stale');
    const authorized = await this.input.binding.authorize(this.resolution, { signal });
    if (signal.aborted) return transitionFailure('cancelled', 'scope.transition-cancelled');
    if (!authorized.ok) {
      this.invalidate('revoked');
      return transitionFailure('denied', firstDiagnosticCode(authorized.diagnostics, 'scope.permission-denied'));
    }
    if (!this.isCurrent(id, capture)) return transitionFailure('stale', 'scope.transition-stale');
    return undefined;
  }

  private async retainOrDeny(
    id: number,
    capture: ReturnType<typeof captureGuard>,
    outcome: { readonly ok: false; readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]] },
    fallback: string,
    signal: AbortSignal,
  ): Promise<ScopeTransitionResult> {
    const current = await this.recheckActive(id, capture, signal);
    if (current !== undefined) return current;
    return this.finishFailure(id, outcome, fallback);
  }

  private clearPending(id: number): void {
    if (this.snapshot.pending?.requestId !== `scope-${id}`) return;
    const { pending: _pending, ...current } = this.snapshot;
    this.snapshot = Object.freeze({ ...current, revision: String(Number(current.revision) + 1) });
    this.lifecycle.notify();
  }

  private failClosed(before: ScopeSnapshot, diagnosticCode: string): ScopeTransitionResult {
    this.resolution = undefined;
    this.snapshot = Object.freeze({
      runtimeId: before.runtimeId,
      scopeInstanceId: before.scopeInstanceId,
      activationEpoch: before.activationEpoch,
      active: false,
      permissionRevision: before.permissionRevision + 1,
      status: 'denied',
      selector: null,
      revision: String(Number(before.revision) + 1),
      diagnostic: diagnostic(diagnosticCode, 'The host could not activate the authorized scope.'),
    });
    this.lifecycle.notify();
    return transitionFailure('failed', diagnosticCode);
  }

  private isolateHost(callback: () => void): void {
    try {
      callback();
    } catch {
      // Security fencing and disposal do not depend on optional host cleanup hooks.
    }
  }

  private fenceTargets(epoch: number): void {
    const targets = this.targets.get(epoch);
    if (targets === undefined) return;
    this.targets.delete(epoch);
    for (const fence of [...targets]) {
      try {
        fence();
      } catch {
        // One target cannot prevent the remaining activation from being fenced.
      }
    }
  }

  private publishInitialFailure(reason: Diagnostic): void {
    this.snapshot = Object.freeze({
      ...this.snapshot,
      status: 'denied',
      selector: null,
      revision: String(Number(this.snapshot.revision) + 1),
      diagnostic: reason,
    });
    this.lifecycle.notify();
  }
}

function denied(code: string): { readonly ok: false; readonly diagnostics: readonly [Diagnostic] } {
  return { ok: false, diagnostics: [diagnostic(code, 'The trusted host rejected the scope operation.')] };
}
