import type { Intent, Outcome } from '@aeliqo/core';
import type { FeatureDefinition } from '@aeliqo/core/features';
import type { RuntimeRenderReceipt } from '../app/types.js';
import { SurfaceListeners } from './lifecycle.js';
import { ProposalSequencer } from './ownership.js';
import type { SurfaceRegistration } from './registration.js';
import { freezeSnapshot, nextRevision, sameAddress } from './state.js';
import type {
  CapabilitySurfaceBindings,
  DataSurfaceBindings,
  DataSurfaceRequest,
  ExternalOwnership,
  ExternalSurfaceSnapshot,
  RequestOptions,
  RequestResult,
  SurfaceController,
  SurfaceOwnership,
  SurfaceRequest,
  SurfaceScope,
  SurfaceScopeSnapshot,
  SurfaceSnapshot,
} from './types.js';

interface SurfaceControllerConfig<I, S> {
  readonly id: string;
  readonly scope: SurfaceScope;
  readonly feature: FeatureDefinition<I>;
  readonly bindings: DataSurfaceBindings<S> | CapabilitySurfaceBindings<I, S>;
  readonly ownership: SurfaceOwnership<I, S>;
  readonly registration: SurfaceRegistration;
  readonly initialState: S;
  readonly runData?: (
    intent: Intent,
    signal: AbortSignal,
  ) => Promise<{ readonly receipt: RuntimeRenderReceipt; readonly state?: S }>;
  readonly teardown: () => void;
}

interface PendingProposal<I> {
  readonly proposal: ReturnType<ProposalSequencer<I>['create']>;
  readonly scope: SurfaceScopeSnapshot;
}

function failure(status: Exclude<RequestResult['status'], 'committed' | 'proposed'>, diagnosticCode: string) {
  return { status, diagnosticCode } as RequestResult;
}

function phaseFor(status: RuntimeRenderReceipt['status']) {
  if (status === 'committed') return 'ready' as const;
  if (status === 'cancelled') return 'idle' as const;
  return status;
}

function requestWasCancelled(disposed: boolean, expectedSequence: number, sequence: number, signal: AbortSignal) {
  return disposed || expectedSequence !== sequence || signal.aborted;
}

function isCanonicalIntent(input: DataSurfaceRequest): input is Intent {
  return typeof input.version === 'string' && typeof input.id === 'string' && typeof input.resource === 'string';
}

function dataIntent(featureId: string, sequence: number, input: DataSurfaceRequest): Intent {
  if (isCanonicalIntent(input)) return input;
  return {
    kind: 'browse',
    version: input.version ?? '1',
    id: input.id ?? `surface-request-${sequence}`,
    resource: input.resource ?? featureId,
    ...(input.fields === undefined ? {} : { fields: input.fields }),
    ...(input.filter === undefined ? {} : { filter: input.filter }),
    ...(input.search === undefined ? {} : { search: input.search }),
    ...(input.sort === undefined ? {} : { sort: input.sort }),
    ...(input.page === undefined ? {} : { page: input.page }),
  };
}

export class SurfaceControllerImpl<I, S> implements SurfaceController<I, S> {
  readonly id: string;
  readonly address;
  private readonly listeners = new SurfaceListeners();
  private readonly proposals = new ProposalSequencer<I>();
  private readonly ownership: SurfaceOwnership<I, S>;
  private readonly pendingProposals = new Map<string, PendingProposal<I>>();
  private readonly safeState: S;
  private snapshot: SurfaceSnapshot<I, S>;
  private externalSource: ExternalSurfaceSnapshot<I, S> | undefined;
  private externalSnapshot: SurfaceSnapshot<I, S> | undefined;
  private maskedSnapshot: SurfaceSnapshot<I, S> | undefined;
  private active: AbortController | undefined;
  private sequence = 0;
  private disposed = false;

  constructor(private readonly config: SurfaceControllerConfig<I, S>) {
    this.id = config.id;
    this.address = config.registration.address;
    this.ownership = config.ownership;
    const intent = this.defaultIntent();
    this.snapshot = freezeSnapshot({
      id: this.id,
      address: this.address,
      revision: '0',
      phase: 'idle',
      intent,
      state: config.initialState,
    });
    this.safeState = this.snapshot.state;
  }

  getSnapshot(): SurfaceSnapshot<I, S> {
    if (this.disposed) return this.snapshot;
    if (!this.config.scope.authorize(this.config.feature.id).ok) return this.maskDenied(false);
    if (this.ownership.mode !== 'external') return this.snapshot;
    return this.refreshExternal(this.ownership.store.getSnapshot());
  }

  subscribe(listener: () => void): () => void {
    if (this.disposed) return () => undefined;
    const ownership = this.ownership;
    const attach =
      ownership.mode === 'external'
        ? () =>
            ownership.store.subscribe(() => {
              if (this.disposed) return;
              const before = this.externalSnapshot;
              const after = this.refreshExternal(ownership.store.getSnapshot());
              if (after !== before) this.listeners.notify();
            })
        : undefined;
    return this.listeners.subscribe(listener, attach);
  }

  async request(intent: SurfaceRequest<I>, options: RequestOptions = {}): Promise<RequestResult> {
    if (this.disposed) return failure('disposed', 'surface.disposed');
    const invalid = this.validateRequest(options);
    if (invalid !== undefined) return invalid;
    const parsed = this.parseIntent(intent);
    if (!parsed.ok) return failure('unsupported', parsed.diagnostics[0].code);
    if (this.ownership.mode === 'external') return this.propose(parsed.value);
    return this.commitInternal(parsed.value, options.signal);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.active?.abort();
    this.config.teardown();
    this.config.registration.release();
    this.pendingProposals.clear();
    this.snapshot = freezeSnapshot({ ...this.snapshot, phase: 'disposed' });
    this.listeners.notify();
    this.listeners.dispose();
  }

  private defaultIntent(): I {
    if (this.ownership.mode === 'internal' && this.ownership.defaultIntent !== undefined)
      return this.ownership.defaultIntent;
    if (this.config.feature.kind === 'data') return dataIntent(this.config.feature.id, 0, { kind: 'browse' }) as I;
    if (this.ownership.mode === 'external') return this.ownership.store.getSnapshot().intent;
    throw new TypeError('Internally owned capability surfaces require a default intent.');
  }

  private validateRequest(options: RequestOptions): RequestResult | undefined {
    if (options.signal?.aborted === true) return failure('cancelled', 'surface.request-aborted');
    if (options.expectedAddress !== undefined && !sameAddress(options.expectedAddress, this.address))
      return failure('stale', 'surface.target-mismatch');
    const current = this.getSnapshot();
    if (options.expectedRevision !== undefined && options.expectedRevision !== current.revision)
      return failure('stale', 'surface.revision-mismatch');
    const authorized = this.config.scope.authorize(this.config.feature.id);
    if (!authorized.ok) {
      this.maskDenied(true);
      return failure('denied', authorized.diagnostics[0].code);
    }
    return undefined;
  }

  private parseIntent(intent: SurfaceRequest<I>): Outcome<I> {
    const candidate =
      this.config.feature.kind === 'data'
        ? dataIntent(this.config.feature.id, this.sequence + 1, intent as DataSurfaceRequest)
        : intent;
    return this.config.feature.parseIntent(candidate);
  }

  private propose(intent: I): RequestResult {
    const current = this.getSnapshot();
    const proposal = this.proposals.create(this.address, current.revision, intent);
    this.pendingProposals.set(proposal.proposalId, {
      proposal,
      scope: this.config.scope.getSnapshot(),
    });
    if (this.pendingProposals.size > 32) {
      const oldest = this.pendingProposals.keys().next().value;
      if (oldest !== undefined) this.pendingProposals.delete(oldest);
    }
    try {
      (this.ownership as ExternalOwnership<I, S>).onProposal(proposal);
      return { status: 'proposed', proposalId: proposal.proposalId };
    } catch {
      this.pendingProposals.delete(proposal.proposalId);
      return failure('failed', 'surface.proposal-failed');
    }
  }

  private async commitInternal(intent: I, signal: AbortSignal | undefined): Promise<RequestResult> {
    this.active?.abort();
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    this.active = controller;
    const sequence = ++this.sequence;
    const before = this.snapshot;
    const scopeBefore = this.config.scope.getSnapshot();
    this.publish({ ...this.snapshot, phase: 'loading' });
    try {
      const outcome = await this.read(intent, controller.signal);
      if (requestWasCancelled(this.disposed, sequence, this.sequence, controller.signal))
        return failure('cancelled', 'surface.request-cancelled');
      const fenced = this.recheckAfterAsync(before, scopeBefore);
      if (fenced !== undefined) return fenced;
      if (this.config.feature.kind === 'data')
        return this.commitData(
          intent,
          outcome as { readonly receipt: RuntimeRenderReceipt; readonly state?: S },
          before,
        );
      const revision = nextRevision(this.snapshot.revision);
      this.publish({ ...this.snapshot, revision, phase: 'ready', intent, state: outcome as S });
      return { status: 'committed', revision };
    } catch {
      if (this.disposed || controller.signal.aborted) return failure('cancelled', 'surface.request-cancelled');
      this.publish({ ...this.snapshot, phase: 'failed' });
      return failure('failed', 'surface.request-failed');
    } finally {
      signal?.removeEventListener('abort', abort);
      if (this.active === controller) this.active = undefined;
    }
  }

  private read(
    intent: I,
    signal: AbortSignal,
  ): Promise<S | { readonly receipt: RuntimeRenderReceipt; readonly state?: S }> {
    if (this.config.feature.kind === 'data') return this.config.runData!(intent as Intent, signal);
    const bindings = this.config.bindings as CapabilitySurfaceBindings<I, S>;
    return bindings.source.read(intent, { scope: this.config.scope.getSnapshot(), signal });
  }

  private commitData(
    intent: I,
    result: { readonly receipt: RuntimeRenderReceipt; readonly state?: S },
    before: SurfaceSnapshot<I, S>,
  ): RequestResult {
    const { receipt } = result;
    if (receipt.status !== 'committed') {
      this.publish({ ...before, phase: phaseFor(receipt.status) });
      return failure(receipt.status, receipt.diagnostics[0]?.code ?? `surface.${receipt.status}`);
    }
    if (result.state === undefined) {
      this.publish({ ...before, phase: 'failed' });
      return failure('failed', 'surface.state-normalization');
    }
    const revision = nextRevision(this.snapshot.revision);
    this.publish({ ...this.snapshot, revision, phase: 'ready', intent, state: result.state });
    return { status: 'committed', revision };
  }

  private recheckAfterAsync(
    before: SurfaceSnapshot<I, S>,
    scopeBefore: ReturnType<SurfaceScope['getSnapshot']>,
  ): RequestResult | undefined {
    const scope = this.config.scope.getSnapshot();
    const authorized = this.config.scope.authorize(this.config.feature.id);
    if (!authorized.ok) {
      this.maskDenied(true);
      return failure('denied', authorized.diagnostics[0].code);
    }
    if (
      scope.runtimeId !== this.address.runtimeId ||
      scope.scopeInstanceId !== this.address.scopeInstanceId ||
      scope.activationEpoch !== this.address.activationEpoch ||
      scope.permissionRevision !== scopeBefore.permissionRevision ||
      this.snapshot.revision !== before.revision
    ) {
      this.publish(before);
      return failure('stale', 'surface.request-stale');
    }
    return undefined;
  }

  private refreshExternal(candidate: ExternalSurfaceSnapshot<I, S>): SurfaceSnapshot<I, S> {
    if (candidate === this.externalSource && this.externalSnapshot !== undefined) return this.externalSnapshot;
    if (candidate.id !== this.id || !sameAddress(candidate.address, this.address))
      return this.externalSnapshot ?? this.snapshot;
    const decision = candidate.proposalDecision;
    const decisionResult = decision === undefined ? 'accepted' : this.acceptDecision(decision);
    if (decisionResult === 'denied') {
      this.externalSource = candidate;
      return this.maskDenied(true);
    }
    if (decisionResult === 'ignored') return this.externalSnapshot ?? this.snapshot;
    this.externalSource = candidate;
    this.externalSnapshot = freezeSnapshot(candidate);
    this.maskedSnapshot = undefined;
    return this.externalSnapshot;
  }

  private acceptDecision(
    decision: NonNullable<ExternalSurfaceSnapshot<I, S>['proposalDecision']>,
  ): 'accepted' | 'denied' | 'ignored' {
    const pending = this.pendingProposals.get(decision.proposalId);
    if (pending === undefined) return 'ignored';
    const { proposal } = pending;
    if (
      proposal.expectedRevision !== decision.expectedRevision ||
      !sameAddress(proposal.address, decision.address) ||
      proposal.expectedRevision !== (this.externalSnapshot ?? this.snapshot).revision
    )
      return 'ignored';
    this.pendingProposals.delete(decision.proposalId);
    if (decision.status === 'rejected') return 'ignored';
    if (!this.scopeStillValid(pending.scope)) return 'denied';
    return 'accepted';
  }

  private scopeStillValid(expected: SurfaceScopeSnapshot): boolean {
    const current = this.config.scope.getSnapshot();
    return (
      current.active &&
      current.runtimeId === this.address.runtimeId &&
      current.scopeInstanceId === this.address.scopeInstanceId &&
      current.activationEpoch === this.address.activationEpoch &&
      current.permissionRevision === expected.permissionRevision &&
      this.config.scope.authorize(this.config.feature.id).ok
    );
  }

  private maskDenied(notify: boolean): SurfaceSnapshot<I, S> {
    const current = this.externalSnapshot ?? this.snapshot;
    this.pendingProposals.clear();
    if (current === this.maskedSnapshot) return current;
    const masked = freezeSnapshot({ ...current, phase: 'denied', state: this.safeState });
    this.maskedSnapshot = masked;
    this.snapshot = masked;
    if (this.ownership.mode === 'external') this.externalSnapshot = masked;
    if (notify) this.listeners.notify();
    return masked;
  }

  private publish(input: SurfaceSnapshot<I, S>): void {
    this.snapshot = freezeSnapshot(input);
    this.maskedSnapshot = undefined;
    this.listeners.notify();
  }
}
