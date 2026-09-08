import {parseContract, scalarIdentity, validateScalar, WIRE_LIMITS} from '@aeliqo/core';
import type {
  Diagnostic,
  Result,
  ResultRef,
} from '@aeliqo/core';
import type {
  ResultBatch,
  ResultBeginInput,
  ResultCacheKey,
  ResultEvent,
  ResultHandle,
  ResultLease,
  ResultRevokeRequest,
  ResultPins,
  ResultSnapshot,
  ResultStatus,
  ResultStore,
  ResultStoreOptions,
  ResultSubscription,
  ResultUpdate,
} from './types.js';

type Outcome<T> =
  | {readonly ok: true; readonly value: T}
  | {readonly ok: false; readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]]};

type ResultRow = ResultBatch['rows'][number];
type ResultCell = ResultRow[string];

const DEFAULT_MAX_ENTRIES = 128;
const DEFAULT_MAX_BYTES = WIRE_LIMITS.bytes;
const DEFAULT_TTL_MS = 5 * 60_000;

function makeDiagnostic(code: string, message: string): Diagnostic {
  return {code, message, retryable: false};
}

function failure<T>(code: string, message: string): Outcome<T> {
  return {ok: false, diagnostics: [makeDiagnostic(code, message)]};
}

function frozen<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const child of value) frozen(child);
    return Object.freeze(value);
  }
  for (const child of Object.values(value as Record<string, unknown>)) frozen(child);
  return Object.freeze(value);
}

/** Parse first, then recursively freeze so callers cannot mutate store state. */
function parseAndFreezeEvent(input: unknown): Outcome<ResultEvent> {
  const parsed = parseContract('result-event', input);
  if (!parsed.ok) return failure('data.result-event-shape', 'The result event does not match the canonical bounded contract.');
  return {ok: true, value: frozen(parsed.value)};
}

function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  if (typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? 'undefined' : encoded;
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

function byteLength(value: unknown): number {
  const encoded = JSON.stringify(value);
  return encoded === undefined ? Number.MAX_SAFE_INTEGER : new TextEncoder().encode(encoded).byteLength;
}

function validKeyPart(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > WIRE_LIMITS.id || /[\s\u0000-\u001f\u007f]/u.test(value))
    throw new TypeError(`${name} must be a bounded identifier.`);
}

function validateBeginInput(input: ResultBeginInput): void {
  if (input === null || typeof input !== 'object') throw new TypeError('A result begin input is required.');
  for (const [name, value] of Object.entries(input)) {
    if (name === 'policyRevision' || name === 'populationDigest') {
      if (value !== undefined) validKeyPart(value, name);
      continue;
    }
    if (name === 'principalKey') {
      if (typeof value !== 'string' || value.length === 0 || value.length > WIRE_LIMITS.id * 4 || /[\u0000-\u001f\u007f]/u.test(value))
        throw new TypeError('principalKey must be a bounded host-owned cache partition key.');
      continue;
    }
    validKeyPart(value, name);
  }
}

function slotKey(input: ResultCacheKey): string {
  return canonical([
    input.principalKey,
    input.scopeDigest,
    input.policyRevision ?? null,
    input.queryDigest,
    input.catalogRevision,
    input.functionRegistryDigest,
    input.sourceRevision,
    input.outputId,
    input.taskId,
  ]);
}

function sameRef(left: ResultRef, right: ResultRef): boolean {
  return left.id === right.id && left.revision === right.revision && left.outputId === right.outputId
    && left.queryDigest === right.queryDigest && left.scopeDigest === right.scopeDigest;
}

function sameRefParts(ref: ResultRef, input: ResultBeginInput): boolean {
  return ref.outputId === input.outputId && ref.queryDigest === input.queryDigest
    && ref.scopeDigest === input.scopeDigest && ref.revision === input.sourceRevision;
}

function statusForError(code: string): ResultStatus {
  if (code === 'data.aborted' || code === 'data.cancelled') return 'cancelled';
  if (code === 'data.denied' || code.startsWith('data.authorization')) return 'denied';
  if (code === 'data.unsupported' || code.startsWith('data.unsupported')) return 'unsupported';
  if (code.startsWith('data.stale')) return 'stale';
  return 'failed';
}

function preserveOnFailure(status: ResultStatus): boolean {
  return status !== 'denied' && status !== 'cancelled';
}

function isKnownCoverage(value: Result['coverage']): value is Exclude<Result['coverage'], {readonly kind: 'unknown'}> {
  return value.kind !== 'unknown';
}

interface CarryData {
  readonly descriptor: Result;
  readonly batches: readonly ResultBatch[];
  readonly loadedRows: number;
  readonly lastEvent?: ResultEvent;
  readonly bytes: number;
}

interface MutableState {
  status: ResultStatus;
  descriptor: Result | undefined;
  batches: readonly ResultBatch[];
  loadedRows: number;
  diagnostics: readonly Diagnostic[];
  lastEvent: ResultEvent | undefined;
  nextSequence: number;
  seenIdentity: Set<string>;
  progress: Map<string, number>;
  terminal: boolean;
  bytes: number;
}

interface InternalStore {
  readonly handles: Set<HandleController>;
  readonly slots: Map<string, HandleController>;
  readonly maxEntries: number;
  readonly maxBytes: number;
  readonly ttlMs: number;
  readonly now: () => number;
  totalBytes(): number;
  remove(handle: HandleController): void;
}

function sourceIterator(source: AsyncIterable<unknown> | AsyncIterator<unknown>): AsyncIterator<unknown> {
  const candidate = source as AsyncIterable<unknown>;
  if (typeof candidate[Symbol.asyncIterator] === 'function') return candidate[Symbol.asyncIterator]();
  const sync = source as unknown as Iterable<unknown>;
  if (typeof sync[Symbol.iterator] === 'function') {
    const iterator = sync[Symbol.iterator]();
    const adapted: AsyncIterator<unknown> = {
      next: () => Promise.resolve(iterator.next()),
    };
    if (typeof iterator.return === 'function') adapted.return = () => Promise.resolve(iterator.return!());
    if (typeof iterator.throw === 'function') adapted.throw = (error?: unknown) => Promise.resolve(iterator.throw!(error));
    return adapted;
  }
  return source as AsyncIterator<unknown>;
}

function raceAbort<T>(pending: Promise<T>, signals: readonly (AbortSignal | undefined)[]): Promise<{readonly aborted: true} | {readonly aborted: false; readonly value: T}> {
  const activeSignals = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  if (activeSignals.length === 0) return pending.then((value) => ({aborted: false, value} as const));
  if (activeSignals.some((signal) => signal.aborted)) return Promise.resolve({aborted: true} as const);
  return new Promise((resolve) => {
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      for (const signal of activeSignals) signal.removeEventListener('abort', onAbort);
      resolve({aborted: true});
    };
    for (const signal of activeSignals) signal.addEventListener('abort', onAbort, {once: true});
    pending.then((value) => {
      if (settled) return;
      settled = true;
      for (const signal of activeSignals) signal.removeEventListener('abort', onAbort);
      resolve({aborted: false, value});
    }, () => {
      if (settled) return;
      settled = true;
      for (const signal of activeSignals) signal.removeEventListener('abort', onAbort);
      // Rejections are returned through a fulfilled tagged value so a late
      // source rejection is never left as an unhandled promise.
      resolve({aborted: false, value: undefined as T});
    });
  });
}

class HandleController implements ResultHandle {
  readonly key: ResultCacheKey;
  readonly generation: number;
  private readonly store: InternalStore;
  private readonly requestId: string;
  private readonly populationDigest: string | undefined;
  private state: MutableState;
  private carry: CarryData | undefined;
  private showingCarry: boolean;
  private superseded = false;
  private revoked = false;
  private disposed = false;
  private leases = 1;
  private readonly leaseObjects = new Set<ResultLease>();
  private readonly subscriptions = new Set<ResultSubscriptionImpl>();
  private lastTouched: number;

  constructor(store: InternalStore, input: ResultBeginInput, generation: number, carry: CarryData | undefined) {
    this.store = store;
    this.key = Object.freeze({
      principalKey: input.principalKey,
      scopeDigest: input.scopeDigest,
      ...(input.policyRevision === undefined ? {} : {policyRevision: input.policyRevision}),
      queryDigest: input.queryDigest,
      catalogRevision: input.catalogRevision,
      functionRegistryDigest: input.functionRegistryDigest,
      sourceRevision: input.sourceRevision,
      outputId: input.outputId,
      taskId: input.taskId,
    });
    this.generation = generation;
    this.requestId = input.requestId;
    this.populationDigest = input.populationDigest;
    this.carry = carry;
    this.showingCarry = carry !== undefined;
    this.state = this.emptyState(carry === undefined ? 'loading' : 'refreshing');
    this.lastTouched = store.now();
  }

  private emptyState(status: ResultStatus): MutableState {
    return {
      status, descriptor: undefined, batches: [], loadedRows: 0, diagnostics: [], lastEvent: undefined, nextSequence: 0,
      seenIdentity: new Set<string>(), progress: new Map<string, number>(), terminal: false, bytes: 0,
    };
  }

  get active(): boolean { return this.subscriptions.size > 0; }
  get touchedAt(): number { return this.lastTouched; }
  get retainedBytes(): number {
    if (this.showingCarry && this.carry !== undefined) return this.carry.bytes;
    return this.state.bytes;
  }

  private touch(): void { this.lastTouched = this.store.now(); }

  snapshot(): ResultSnapshot {
    this.touch();
    const descriptor = this.showingCarry && this.carry !== undefined ? this.carry.descriptor : this.state.descriptor;
    const batches = this.showingCarry && this.carry !== undefined ? this.carry.batches : this.state.batches;
    const loadedRows = this.showingCarry && this.carry !== undefined ? this.carry.loadedRows : this.state.loadedRows;
    const lastEvent = this.showingCarry && this.carry !== undefined && this.state.lastEvent === undefined
      ? this.carry.lastEvent : this.state.lastEvent;
    const {principalKey: _principalKey, ...pins} = this.key;
    return frozen({
      status: this.state.status,
      generation: this.generation,
      key: pins as ResultPins,
      ...(descriptor === undefined ? {} : {descriptor}),
      batches,
      loadedRows,
      diagnostics: this.state.diagnostics,
      ...(lastEvent === undefined ? {} : {lastEvent}),
    });
  }

  retain(): ResultLease {
    if (this.disposed || this.revoked) return {released: true, release() { /* already unavailable */ }};
    this.leases += 1;
    let released = false;
    const lease: ResultLease = {
      get released() { return released; },
      release: () => {
        if (released) return;
        released = true;
        this.leaseObjects.delete(lease);
        this.release();
      },
    };
    this.leaseObjects.add(lease);
    return lease;
  }

  release(): void {
    if (this.leases > 0) this.leases -= 1;
    this.touch();
  }

  subscribe(source: AsyncIterable<unknown> | AsyncIterator<unknown>, options: {readonly signal?: AbortSignal} = {}): ResultSubscription {
    const subscription = new ResultSubscriptionImpl(this, sourceIterator(source), options.signal);
    if (this.disposed || this.revoked || this.superseded || this.state.terminal) {
      subscription.closeWithoutPull();
      return subscription;
    }
    this.subscriptions.add(subscription);
    this.leases += 1;
    return subscription;
  }

  removeSubscription(subscription: ResultSubscriptionImpl): void {
    if (this.subscriptions.delete(subscription) && this.leases > 0) this.leases -= 1;
    this.touch();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.superseded = false;
    this.revoked = false;
    for (const subscription of [...this.subscriptions]) subscription.closeWithoutPull();
    this.subscriptions.clear();
    for (const lease of [...this.leaseObjects]) lease.release();
    this.leaseObjects.clear();
    this.leases = 0;
    this.carry = undefined;
    this.showingCarry = false;
    this.state = this.emptyState('disposed');
    this.state.diagnostics = Object.freeze([makeDiagnostic('data.disposed', 'The result handle has been disposed.')]);
    this.store.remove(this);
  }

  supersede(): void {
    if (this.disposed || this.revoked) return;
    this.superseded = true;
    if (this.state.status !== 'disposed') this.state.status = 'stale';
    for (const subscription of [...this.subscriptions]) subscription.closeAsSuperseded();
    this.subscriptions.clear();
    this.touch();
  }

  revoke(): void {
    if (this.disposed || this.revoked) return;
    this.revoked = true;
    for (const subscription of [...this.subscriptions]) subscription.closeWithoutPull();
    this.subscriptions.clear();
    for (const lease of [...this.leaseObjects]) lease.release();
    this.leaseObjects.clear();
    this.leases = 0;
    this.carry = undefined;
    this.showingCarry = false;
    this.state = this.emptyState('denied');
    this.state.diagnostics = Object.freeze([makeDiagnostic('data.authorization-revoked', 'Authorization for this result has been revoked.')]);
    this.store.remove(this);
  }

  private current(): boolean {
    return !this.disposed && !this.revoked && !this.superseded && this.store.slots.get(slotKey(this.key)) === this;
  }

  private restoreCarry(status: ResultStatus, diagnostic?: Diagnostic, event?: ResultEvent): void {
    const current: CarryData | undefined = this.state.descriptor === undefined ? undefined : {
      descriptor: this.state.descriptor,
      batches: this.state.batches,
      loadedRows: this.state.loadedRows,
      ...(this.state.lastEvent === undefined ? {} : {lastEvent: this.state.lastEvent}),
      bytes: this.state.bytes,
    };
    const retained = this.carry ?? current;
    if (retained !== undefined && preserveOnFailure(status)) {
      this.showingCarry = retained === this.carry;
      this.state.status = this.carry === undefined ? status : 'stale';
      this.state.diagnostics = diagnostic === undefined ? [] : Object.freeze([diagnostic]);
      this.state.lastEvent = event;
      this.state.terminal = true;
      return;
    }
    this.showingCarry = false;
    this.state.status = status;
    this.state.descriptor = undefined;
    this.state.batches = [];
    this.state.loadedRows = 0;
    this.state.bytes = 0;
    this.state.diagnostics = diagnostic === undefined ? [] : Object.freeze([diagnostic]);
    this.state.lastEvent = event;
    this.state.terminal = true;
  }

  private invalid(code: string, message: string): Outcome<ResultEvent> {
    const diag = makeDiagnostic(code, message);
    this.restoreCarry('failed', diag);
    return {ok: false, diagnostics: [diag]};
  }

  private validateDescriptor(descriptor: Result): Outcome<void> {
    if (descriptor.taskId !== this.key.taskId) return failure('data.result-task', 'The result descriptor belongs to another task.');
    if (!sameRefParts(descriptor.ref, this.key as ResultBeginInput)) return failure('data.result-scope', 'The result descriptor does not match the authorized result pins.');
    if (this.populationDigest !== undefined) {
      if (!isKnownCoverage(descriptor.coverage) || descriptor.coverage.populationDigest !== this.populationDigest)
        return failure('data.result-population', 'The result descriptor does not match the accepted population.');
    }
    const fields = new Map<string, Result['fields'][number]>();
    for (const field of descriptor.fields) {
      if (fields.has(field.id)) return failure('data.result-schema', 'The result descriptor contains duplicate field identities.');
      fields.set(field.id, field);
    }
    const checkRefs = (refs: readonly string[], label: string): Outcome<void> => {
      const unique = new Set(refs);
      if (unique.size !== refs.length) return failure('data.result-schema', `The result descriptor contains duplicate ${label} identities.`);
      for (const ref of refs) if (!fields.has(ref)) return failure('data.result-schema', `The result ${label} is not present in the projected fields.`);
      return {ok: true, value: undefined};
    };
    const identity = checkRefs(descriptor.identity, 'identity');
    if (!identity.ok) return identity;
    const grain = checkRefs(descriptor.rowGrain, 'row grain');
    if (!grain.ok) return grain;
    if (descriptor.counts.loaded > WIRE_LIMITS.array) return failure('data.result-budget', 'The result loaded count exceeds the bounded result limit.');
    const count = descriptor.counts.population;
    if (isKnownCoverage(descriptor.coverage)) {
      if (count.kind !== 'unknown' && count.populationDigest !== descriptor.coverage.populationDigest)
        return failure('data.result-population', 'The result population count and coverage refer to different populations.');
    }
    if (descriptor.coverage.kind !== 'unknown' && descriptor.coverage.kind !== 'complete' && descriptor.coverage.kind !== 'partial' && descriptor.coverage.kind !== 'sample')
      return failure('data.result-coverage', 'The result descriptor has an invalid coverage state.');
    if (descriptor.consistency.kind === 'snapshot' && !Object.values(descriptor.consistency.sourceRevisions).includes(this.key.sourceRevision))
      return failure('data.result-consistency', 'The result snapshot does not include the pinned source revision.');
    return {ok: true, value: undefined};
  }

  private validateRow(row: Record<string, unknown>): Outcome<Record<string, ResultCell>> {
    const descriptor = this.state.descriptor;
    if (descriptor === undefined) return failure('data.result-order', 'A result batch arrived before its descriptor.');
    const fields = new Map(descriptor.fields.map((field) => [field.id, field] as const));
    for (const key of Object.keys(row)) if (!fields.has(key)) return failure('data.result-schema', `The result batch contains an unknown field ${key}.`);
    const normalized: Record<string, ResultCell> = {};
    for (const field of descriptor.fields) {
      const value = row[field.id];
      if (value === undefined) {
        if (!field.type.nullable) return failure('data.result-schema', `The result batch is missing non-nullable field ${field.id}.`);
        continue;
      }
      const checked = validateScalar(value, field.type);
      if (!checked.ok) return failure('data.result-value', `The result value for ${field.id} does not match its declared semantic type.`);
      normalized[field.id] = checked.value;
    }
    for (const identity of descriptor.identity) {
      const field = fields.get(identity)!;
      const value = normalized[identity];
      if (value === undefined || value === null) return failure('data.result-identity', 'Result identity fields must be present and non-null.');
      const key = scalarIdentity(value, field.type);
      if (!key.ok) return failure('data.result-identity', 'Result identity value is invalid.');
      // The caller checks duplicate tuples after all fields have been visited.
      normalized[`\u0000identity:${identity}`] = key.value;
    }
    return {ok: true, value: normalized};
  }

  private ingestDescriptor(event: Extract<ResultEvent, {readonly kind: 'descriptor'}>): Outcome<ResultEvent> {
    // A descriptor starts a replacement snapshot. A failed replacement falls
    // back to the previous authorized snapshot rather than exposing partial data.
    const priorCarry = this.carry;
    this.showingCarry = false;
    this.carry = priorCarry;
    this.state = this.emptyState('loading');
    const checked = this.validateDescriptor(event.descriptor);
    if (!checked.ok) {
      this.restoreCarry('failed', checked.diagnostics[0]);
      return {ok: false, diagnostics: checked.diagnostics};
    }
    this.state.descriptor = event.descriptor;
    this.state.bytes = byteLength(event.descriptor);
    if (this.store.totalBytes() > this.store.maxBytes) {
      if (this.carry === undefined) this.state.descriptor = undefined;
      this.restoreCarry('failed', makeDiagnostic('data.result-budget', 'The result descriptor exceeds the bounded store byte budget.'));
      return failure('data.result-budget', 'The result descriptor exceeds the bounded store byte budget.');
    }
    return {ok: true, value: event};
  }

  private ingestBatch(event: ResultBatch): Outcome<ResultEvent> {
    if (this.state.descriptor === undefined) return this.invalid('data.result-order', 'A result batch arrived before its descriptor.');
    if (!sameRef(this.state.descriptor.ref, event.result)) return this.invalid('data.result-lineage', 'The result batch belongs to another result handle.');
    if (event.sequence !== this.state.nextSequence) return this.invalid('data.result-sequence', 'Result batch sequences must be consecutive and start at zero.');
    if (this.state.loadedRows + event.rows.length > this.state.descriptor.counts.loaded)
      return this.invalid('data.result-count', 'Result batches contain more rows than the descriptor loaded count.');
    const identityKeys = new Set<string>();
    const rows: ResultRow[] = [];
    for (const row of event.rows) {
      const checked = this.validateRow(row as Record<string, unknown>);
      if (!checked.ok) return this.invalid(checked.diagnostics[0]!.code, checked.diagnostics[0]!.message);
      const rowValue = checked.value;
      const identity = JSON.stringify(this.state.descriptor.identity.map((field) => rowValue[`\u0000identity:${field}`]));
      if (this.state.descriptor.identity.length > 0) {
        if (identityKeys.has(identity) || this.state.seenIdentity.has(identity)) return this.invalid('data.result-identity', 'Result batches contain duplicate identity tuples.');
        identityKeys.add(identity);
      }
      for (const key of Object.keys(rowValue)) if (key.startsWith('\u0000identity:')) delete rowValue[key];
      rows.push(rowValue);
    }
    const normalized = frozen({...event, rows: frozen(rows)}) as ResultBatch;
    const bytes = byteLength(normalized);
    if (this.state.bytes + bytes > this.store.maxBytes || this.store.totalBytes() + bytes > this.store.maxBytes)
      return this.invalid('data.result-budget', 'Result batches exceed the bounded store byte budget.');
    for (const identity of identityKeys) this.state.seenIdentity.add(identity);
    this.state.nextSequence += 1;
    this.state.loadedRows += rows.length;
    this.state.batches = Object.freeze([...this.state.batches, normalized]);
    this.state.bytes += bytes;
    this.state.status = 'partial';
    return {ok: true, value: normalized};
  }

  private ingestProgress(event: Extract<ResultEvent, {readonly kind: 'progress'}>): Outcome<ResultEvent> {
    if (this.state.descriptor === undefined) return this.invalid('data.result-order', 'A result progress event arrived before its descriptor.');
    if (!sameRef(this.state.descriptor.ref, event.result)) return this.invalid('data.result-lineage', 'The result progress belongs to another result handle.');
    const prior = this.state.progress.get(event.unit) ?? 0;
    if (event.completed < prior || (event.total !== undefined && event.completed > event.total))
      return this.invalid('data.result-progress', 'Result progress is not monotonic.');
    const population = this.state.descriptor.counts.population;
    if (event.unit === 'rows' && event.completed > this.state.descriptor.counts.loaded)
      return this.invalid('data.result-count', 'Result row progress exceeds the descriptor loaded count.');
    if (event.unit === 'rows' && event.total !== undefined && population.kind !== 'unknown' && event.total > population.value)
      return this.invalid('data.result-count', 'Result row progress exceeds the declared population count.');
    this.state.progress.set(event.unit, event.completed);
    return {ok: true, value: event};
  }

  private ingestComplete(event: Extract<ResultEvent, {readonly kind: 'complete'}>): Outcome<ResultEvent> {
    if (this.state.descriptor === undefined) return this.invalid('data.result-order', 'A result completion arrived before its descriptor.');
    if (!sameRef(this.state.descriptor.ref, event.result)) return this.invalid('data.result-lineage', 'The result completion belongs to another result handle.');
    if (this.state.loadedRows !== this.state.descriptor.counts.loaded)
      return this.invalid('data.result-count', 'Result completion does not match the descriptor loaded count.');
    const initialCoverage = this.state.descriptor.coverage;
    if (initialCoverage.kind !== 'unknown' && initialCoverage.kind !== 'complete' && event.finalCoverage.kind === 'complete')
      return this.invalid('data.result-coverage', 'A partial or sampled result cannot be promoted to complete by its terminal event.');
    if (this.populationDigest !== undefined && (event.finalCoverage.kind === 'unknown' || event.finalCoverage.populationDigest !== this.populationDigest))
      return this.invalid('data.result-population', 'The result completion does not match the accepted population.');
    const count = this.state.descriptor.counts.population;
    if (event.finalCoverage.kind !== 'unknown' && count.kind !== 'unknown' && count.populationDigest !== event.finalCoverage.populationDigest)
      return this.invalid('data.result-population', 'The result completion population differs from its count population.');
    this.state.lastEvent = event;
    this.state.terminal = true;
    this.state.status = event.finalCoverage.kind === 'complete' ? 'ready' : 'partial';
    return {ok: true, value: event};
  }

  ingest(raw: unknown): Outcome<ResultEvent> {
    if (!this.current()) return failure('data.stale-result', 'A stale result generation cannot commit events.');
    if (this.state.terminal) return failure('data.result-terminal', 'A result stream continued after its terminal event.');
    this.touch();
    const parsed = parseAndFreezeEvent(raw);
    if (!parsed.ok) {
      this.restoreCarry('failed', parsed.diagnostics[0]);
      return parsed;
    }
    const event = parsed.value;
    let outcome: Outcome<ResultEvent>;
    if (event.kind === 'descriptor') outcome = this.ingestDescriptor(event);
    else if (event.kind === 'batch') outcome = this.ingestBatch(event);
    else if (event.kind === 'progress') outcome = this.ingestProgress(event);
    else if (event.kind === 'complete') outcome = this.ingestComplete(event);
    else {
      if (event.requestId !== this.requestId) {
        outcome = this.invalid('data.result-request', 'The result error belongs to another request.');
      } else {
        const status = statusForError(event.error.code);
        this.state.lastEvent = event;
        this.restoreCarry(status, event.error, event);
        outcome = {ok: true, value: event};
      }
    }
    if (outcome.ok) this.state.lastEvent = outcome.value;
    return outcome;
  }

  truncated(): void {
    if (this.state.terminal || this.disposed || this.revoked || this.superseded) return;
    this.restoreCarry('failed', makeDiagnostic('data.result-truncated', 'The result source ended without a terminal event.'));
  }

  streamFailure(): void {
    if (this.state.terminal || this.disposed || this.revoked || this.superseded) return;
    this.restoreCarry('failed', makeDiagnostic('data.stream-network', 'The result source failed before producing a terminal event.'));
  }

  cancel(): void {
    if (this.state.terminal || this.disposed || this.revoked || this.superseded) return;
    this.restoreCarry('cancelled', makeDiagnostic('data.aborted', 'The result subscription was cancelled.'));
  }

  subscriptionClosed(subscription: ResultSubscriptionImpl): void { this.removeSubscription(subscription); }

  isTerminal(): boolean { return this.state.terminal || this.disposed || this.revoked || this.superseded; }
  isSuperseded(): boolean { return this.superseded; }
}

class ResultSubscriptionImpl implements ResultSubscription {
  private readonly controller: HandleController;
  private readonly iterator: AsyncIterator<unknown>;
  private readonly signal: AbortSignal | undefined;
  private readonly localAbort = new AbortController();
  private pending: Promise<IteratorResult<ResultUpdate>> | undefined;
  private closed = false;
  private finalUpdateReturned = false;

  constructor(controller: HandleController, iterator: AsyncIterator<unknown>, signal: AbortSignal | undefined) {
    this.controller = controller;
    this.iterator = iterator;
    this.signal = signal;
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<ResultUpdate> { return this; }

  private finish(): void {
    if (this.closed) return;
    this.closed = true;
    this.localAbort.abort();
    try {
      const cleanup = this.iterator.return?.();
      if (cleanup !== undefined) void Promise.resolve(cleanup).catch(() => {});
    } catch { /* cleanup is deliberately nonblocking */ }
    this.controller.subscriptionClosed(this);
  }

  closeWithoutPull(): void { this.finish(); }

  closeAsSuperseded(): void {
    this.closed = true;
    this.localAbort.abort();
    try {
      const cleanup = this.iterator.return?.();
      if (cleanup !== undefined) void Promise.resolve(cleanup).catch(() => {});
    } catch { /* cleanup is deliberately nonblocking */ }
    this.controller.subscriptionClosed(this);
  }

  cancel(): void {
    if (this.closed) return;
    if (!this.controller.isSuperseded()) this.controller.cancel();
    this.finish();
  }

  private terminalUpdate(): IteratorResult<ResultUpdate> {
    if (this.finalUpdateReturned) return {done: true, value: undefined};
    this.finalUpdateReturned = true;
    return {done: false, value: {snapshot: this.controller.snapshot()}};
  }

  private async pull(): Promise<IteratorResult<ResultUpdate>> {
    if (this.closed) return {done: true, value: undefined};
    if (this.signal?.aborted) {
      this.cancel();
      return this.terminalUpdate();
    }
    if (this.controller.isTerminal()) {
      this.finish();
      return this.terminalUpdate();
    }
    let pending: Promise<IteratorResult<unknown>>;
    try { pending = Promise.resolve(this.iterator.next()); }
    catch {
      this.controller.streamFailure();
      this.finish();
      return this.terminalUpdate();
    }
    const raced = await raceAbort(pending, [this.signal, this.localAbort.signal]);
    if (raced.aborted) {
      if (this.closed) return {done: true, value: undefined};
      this.cancel();
      return this.terminalUpdate();
    }
    if (this.closed) return {done: true, value: undefined};
    const result = raced.value;
    if (result === undefined) {
      this.controller.streamFailure();
      this.finish();
      return this.terminalUpdate();
    }
    if (result.done) {
      if (!this.controller.isTerminal()) this.controller.truncated();
      this.finish();
      return this.terminalUpdate();
    }
    const event = this.controller.ingest(result.value);
    if (!event.ok) {
      this.finish();
      return this.terminalUpdate();
    }
    const update: ResultUpdate = {snapshot: this.controller.snapshot(), event: event.value};
    if (this.controller.isTerminal()) this.finish();
    return {done: false, value: update};
  }

  next(): Promise<IteratorResult<ResultUpdate>> {
    if (this.pending !== undefined) return this.pending;
    const pending = this.pull();
    this.pending = pending.finally(() => { this.pending = undefined; });
    return this.pending;
  }

  return(): Promise<IteratorResult<ResultUpdate>> {
    this.cancel();
    return Promise.resolve({done: true, value: undefined});
  }

  throw(error?: unknown): Promise<IteratorResult<ResultUpdate>> {
    this.cancel();
    return Promise.reject(error);
  }
}

class ResultStoreImpl implements ResultStore, InternalStore {
  readonly handles = new Set<HandleController>();
  readonly slots = new Map<string, HandleController>();
  readonly maxEntries: number;
  readonly maxBytes: number;
  readonly ttlMs: number;
  readonly now: () => number;
  private disposed = false;
  private generation = 0;

  constructor(options: ResultStoreOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.now = options.now ?? (() => Date.now());
    if (!Number.isSafeInteger(this.maxEntries) || this.maxEntries < 1 || this.maxEntries > 10_000) throw new TypeError('maxEntries must be a bounded positive safe integer.');
    if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes < 1 || this.maxBytes > WIRE_LIMITS.bytes) throw new TypeError('maxBytes must be a bounded positive safe integer.');
    if (!Number.isSafeInteger(this.ttlMs) || this.ttlMs < 1 || this.ttlMs > 86_400_000) throw new TypeError('ttlMs must be a bounded positive duration.');
  }

  totalBytes(): number { let total = 0; for (const handle of this.handles) total += handle.retainedBytes; return total; }

  remove(handle: HandleController): void {
    this.handles.delete(handle);
    const key = slotKey(handle.key);
    if (this.slots.get(key) === handle) this.slots.delete(key);
  }

  private expire(): void {
    const now = this.now();
    for (const handle of [...this.handles]) {
      if (!handle.active && now - handle.touchedAt >= this.ttlMs) handle.dispose();
    }
  }

  private evict(): void {
    this.expire();
    while (this.handles.size >= this.maxEntries) {
      const candidate = [...this.handles].filter((handle) => !handle.active).sort((left, right) => left.touchedAt - right.touchedAt)[0];
      if (candidate === undefined) break;
      candidate.dispose();
    }
  }

  begin(input: ResultBeginInput): ResultHandle {
    if (this.disposed) throw new Error('The result store has been disposed.');
    validateBeginInput(input);
    this.evict();
    const key = slotKey(input);
    const previous = this.slots.get(key);
    const carrySnapshot = previous === undefined ? undefined : previous.snapshot();
    const carry = carrySnapshot?.descriptor === undefined ? undefined : {
      descriptor: carrySnapshot.descriptor,
      batches: carrySnapshot.batches,
      loadedRows: carrySnapshot.loadedRows,
      ...(carrySnapshot.lastEvent === undefined ? {} : {lastEvent: carrySnapshot.lastEvent}),
      bytes: byteLength(carrySnapshot.descriptor) + carrySnapshot.batches.reduce((sum, batch) => sum + byteLength(batch), 0),
    } satisfies CarryData;
    const handle = new HandleController(this, input, ++this.generation, carry);
    this.handles.add(handle);
    this.slots.set(key, handle);
    previous?.supersede();
    return handle;
  }

  get(input: ResultCacheKey): ResultHandle | undefined {
    if (this.disposed) return undefined;
    validateBeginInput({...input, requestId: 'lookup'});
    this.expire();
    const handle = this.slots.get(slotKey(input));
    return handle === undefined ? undefined : handle;
  }

  revoke(request: ResultRevokeRequest): void {
    if (this.disposed) return;
    if (typeof request.principalKey !== 'string' || request.principalKey.length === 0) throw new TypeError('principalKey is required for result revocation.');
    for (const handle of [...this.handles]) {
      if (handle.key.principalKey !== request.principalKey) continue;
      if (request.scopeDigest !== undefined && handle.key.scopeDigest !== request.scopeDigest) continue;
      if (request.policyRevision !== undefined && handle.key.policyRevision !== request.policyRevision) continue;
      handle.revoke();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const handle of [...this.handles]) handle.dispose();
    this.handles.clear();
    this.slots.clear();
  }
}

export function createResultStore(options: ResultStoreOptions = {}): ResultStore {
  return new ResultStoreImpl(options);
}

export {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_TTL_MS,
};
