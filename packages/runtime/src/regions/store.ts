import {parseContract, parseInteractionState, parseWireValue, validateCommitReadSet, WIRE_LIMITS} from '@aeliqo/core';
import type {ResultRef} from '@aeliqo/core';
import type {ResultHandle, ResultLease} from '../results/types.js';
import {createSerialQueue, type SerialQueue} from '../scheduling/index.js';
import {exportRegionDocument, parseRegionDocument} from '../persistence/index.js';
import type {RegionDocument} from '../persistence/types.js';
import type {
  AuthorizeRegionCommit,
  ReadAuthority,
  RegionAuthority,
  RegionCommitAuthorizationInput,
  RegionCommitOptions,
  RegionCommitToken,
  RegionCreateInput,
  RegionDataPublication,
  RegionFailure,
  RegionHandle,
  RegionHistoryEntry,
  RegionObserverFunction,
  RegionObserverOptions,
  RegionOutcome,
  RegionReadSet,
  RegionRestoreMaterialization,
  RestoreRegion,
  RegionSnapshot,
  RegionStageInput,
  RegionStore,
  RegionStoreOptions,
  RegionUpdate,
} from './types.js';
import type {RegionContent} from '../tasks/types.js';

const FAILURE = {
  invalid: 'The region command is not a valid bounded runtime document.',
  stale: 'The region proposal is stale against the current task, policy, result or data revision.',
  denied: 'The host did not authorize the region command.',
  revoked: 'The region authorization has been revoked.',
  disposed: 'The region has been disposed.',
  budget: 'The region command exceeds its bounded runtime budget.',
  queue: 'The region command queue is full or closed.',
  authorizationTimeout: 'The host commit authorization exceeded its bounded time budget.',
} as const;

const DEFAULT_COMMIT_AUTHORIZATION_MILLISECONDS = 30_000;
const MAX_COMMIT_AUTHORIZATION_MILLISECONDS = 86_400_000;
let regionIncarnationCounter = 0;
let runtimeRevisionCounter = 0;

function newRegionRevision(): string {
  const crypto = globalThis.crypto;
  if (crypto !== undefined && typeof crypto.randomUUID === 'function') return `r-${crypto.randomUUID()}`;
  regionIncarnationCounter = (regionIncarnationCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `r-${Date.now().toString(36)}-${regionIncarnationCounter.toString(36)}-${Math.floor(Math.random() * 0x1_0000_0000).toString(36)}`.slice(0, WIRE_LIMITS.id);
}

const refKey = (ref: ResultRef): string => JSON.stringify([ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest]);
const logicalRefKey = (ref: ResultRef): string => JSON.stringify([ref.outputId, ref.queryDigest, ref.scopeDigest]);
const failure = <T>(code: RegionFailure['code'], message: string): RegionOutcome<T> => ({ok: false, diagnostics: [{code, message, retryable: false}]});

function normalizeHostOutcome<T>(value: unknown, code: RegionFailure['code'] = 'runtime.region-denied'): RegionOutcome<T> {
  try {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      const keys = Reflect.ownKeys(record);
      if (keys.some((key) => typeof key !== 'string')) return failure(code, FAILURE.denied);
      if (record.ok === true && keys.length === 2 && keys.includes('ok') && keys.includes('value')) return {ok: true, value: record.value as T};
      if (record.ok === false && keys.length === 2 && keys.includes('ok') && keys.includes('diagnostics') && Array.isArray(record.diagnostics) && record.diagnostics.length > 0 && record.diagnostics.length <= WIRE_LIMITS.diagnostics) {
        const diagnostics: RegionFailure[] = [];
        for (const candidate of record.diagnostics) {
          if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return failure(code, FAILURE.denied);
          const diagnostic = candidate as Record<string, unknown>;
          const allowed = ['code', 'message', 'retryable', 'path', 'remedies'];
          if (Object.keys(diagnostic).some((key) => !allowed.includes(key)) || !validId(diagnostic.code) || !validText(diagnostic.message) || typeof diagnostic.retryable !== 'boolean')
            return failure(code, FAILURE.denied);
          if (diagnostic.path !== undefined && (!Array.isArray(diagnostic.path) || diagnostic.path.length > WIRE_LIMITS.array || diagnostic.path.some((part) => !(typeof part === 'string' ? validId(part) : Number.isSafeInteger(part) && part >= 0))))
            return failure(code, FAILURE.denied);
          if (diagnostic.remedies !== undefined && (!Array.isArray(diagnostic.remedies) || diagnostic.remedies.length > WIRE_LIMITS.array || diagnostic.remedies.some((remedy) => !validText(remedy))))
            return failure(code, FAILURE.denied);
          diagnostics.push(frozen({code: diagnostic.code as string, message: diagnostic.message as string, retryable: diagnostic.retryable as boolean, ...(diagnostic.path === undefined ? {} : {path: Object.freeze([...(diagnostic.path as readonly (string | number)[])])}), ...(diagnostic.remedies === undefined ? {} : {remedies: Object.freeze([...(diagnostic.remedies as readonly string[])])})}));
        }
        return {ok: false, diagnostics: diagnostics as [RegionFailure, ...RegionFailure[]]};
      }
    }
  } catch { /* malformed host values fail closed below */ }
  return failure(code, FAILURE.denied);
}

function frozen<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) { for (const child of value) frozen(child); return Object.freeze(value); }
  for (const child of Object.values(value as Record<string, unknown>)) frozen(child);
  return Object.freeze(value);
}

function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  if (typeof value !== 'object') { const encoded = JSON.stringify(value); return encoded === undefined ? 'undefined' : encoded; }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

/** Bounded non-cryptographic digest for metadata and history identity. */
function digest(value: unknown): string {
  let hash = 2166136261;
  for (const character of canonical(value)) {
    hash ^= character.codePointAt(0)!;
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= WIRE_LIMITS.id && !/[\s\u0000-\u001f\u007f]/u.test(value);
}
function validText(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= WIRE_LIMITS.text; }
function validDataRevision(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0; }

function validateResultRef(value: unknown): value is ResultRef {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  if (!parseWireValue(value).ok) return false;
  const record = value as Record<string, unknown>;
  const names = ['id', 'revision', 'outputId', 'queryDigest', 'scopeDigest'];
  return Object.keys(record).length === names.length && names.every((name) => validId(record[name]));
}

function normalizeRefs(value: readonly ResultRef[], scopeDigest: string): RegionOutcome<readonly ResultRef[]> {
  if (!Array.isArray(value) || value.length > WIRE_LIMITS.array) return failure('runtime.region-budget', FAILURE.budget);
  const seen = new Set<string>();
  const refs: ResultRef[] = [];
  for (const ref of value) {
    if (!validateResultRef(ref) || ref.scopeDigest !== scopeDigest) return failure('runtime.region-invalid', 'Every result reference must be bounded and belong to the region authorization scope.');
    const key = refKey(ref);
    if (seen.has(key)) return failure('runtime.region-invalid', 'A region read set cannot contain duplicate result references.');
    seen.add(key);
    refs.push(frozen({...ref}));
  }
  return {ok: true, value: Object.freeze(refs)};
}

function validateState(value: unknown, regionId: string): RegionOutcome<RegionContent> {
  const wire = parseWireValue(value);
  if (!wire.ok || wire.value === null || typeof wire.value !== 'object' || Array.isArray(wire.value)) return failure('runtime.region-invalid', FAILURE.invalid);
  const record = wire.value as Record<string, unknown>;
  if (Object.keys(record).some((field) => field !== 'task' && field !== 'presentation' && field !== 'interaction') || !Object.hasOwn(record, 'task'))
    return failure('runtime.region-invalid', 'A region state requires a Task and may contain a PresentationPlan and typed interaction state.');
  const task = parseContract('task', record.task);
  if (!task.ok) return failure('runtime.region-invalid', 'The region Task is not a valid canonical contract.');
  if (task.value.regionId !== regionId) return failure('runtime.region-invalid', 'The Task regionId must match the owning region.');
  const presentation = record.presentation === undefined ? undefined : parseContract('presentation-plan', record.presentation);
  if (presentation !== undefined && !presentation.ok) return failure('runtime.region-invalid', 'The region PresentationPlan is not a valid canonical contract.');
  const interaction = record.interaction === undefined ? undefined : parseInteractionState(record.interaction);
  if (interaction !== undefined && !interaction.ok) return failure('runtime.region-invalid', 'The interaction state is not a valid canonical contract.');
  return {ok: true, value: frozen({task: task.value,
    ...(presentation === undefined ? {} : {presentation: presentation.value}),
    ...(interaction === undefined ? {} : {interaction: interaction.value}),
  })};
}

function validateAuthority(value: unknown): RegionOutcome<RegionAuthority> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return failure('runtime.region-denied', FAILURE.denied);
  const record = value as Record<string, unknown>;
  const names = ['principalKey', 'scopeDigest', 'policyRevision', 'catalogRevision', 'experienceRevision', 'functionRegistryDigest', 'results'];
  if (Object.keys(record).some((name) => !names.includes(name)) || names.some((name) => !Object.hasOwn(record, name))) return failure('runtime.region-denied', FAILURE.denied);
  if (typeof record.principalKey !== 'string' || record.principalKey.length === 0 || record.principalKey.length > WIRE_LIMITS.id * 4 || /[\u0000-\u001f\u007f]/u.test(record.principalKey)) return failure('runtime.region-denied', FAILURE.denied);
  for (const name of names.slice(1, -1)) if (!validId(record[name])) return failure('runtime.region-denied', FAILURE.denied);
  const refs = normalizeRefs(record.results as readonly ResultRef[], record.scopeDigest as string);
  if (!refs.ok) return refs as RegionOutcome<RegionAuthority>;
  return {ok: true, value: frozen({
    principalKey: record.principalKey as string,
    scopeDigest: record.scopeDigest as string,
    policyRevision: record.policyRevision as string,
    catalogRevision: record.catalogRevision as string,
    experienceRevision: record.experienceRevision as string,
    functionRegistryDigest: record.functionRegistryDigest as string,
    results: refs.value,
  })};
}

function authorityReadSet(authority: RegionAuthority, taskRevision: string, regionRevision: string, dataRevision: number): RegionReadSet {
  return frozen({
    scopeDigest: authority.scopeDigest,
    policyRevision: authority.policyRevision,
    taskRevision,
    regionRevision,
    catalogRevision: authority.catalogRevision,
    experienceRevision: authority.experienceRevision,
    functionRegistryDigest: authority.functionRegistryDigest,
    results: authority.results,
    dataRevision,
  });
}

function stripData(readSet: RegionReadSet): Omit<RegionReadSet, 'dataRevision'> {
  const {dataRevision: _dataRevision, ...canonicalReadSet} = readSet;
  return canonicalReadSet;
}

function validateReadSet(value: unknown): RegionOutcome<RegionReadSet> {
  const wire = parseWireValue(value);
  if (!wire.ok || wire.value === null || typeof wire.value !== 'object' || Array.isArray(wire.value)) return failure('runtime.region-invalid', FAILURE.invalid);
  const record = wire.value as Record<string, unknown>;
  const names = ['scopeDigest', 'policyRevision', 'taskRevision', 'regionRevision', 'catalogRevision', 'experienceRevision', 'functionRegistryDigest', 'results', 'dataRevision'];
  if (Object.keys(record).some((name) => !names.includes(name)) || names.some((name) => !Object.hasOwn(record, name))) return failure('runtime.region-invalid', FAILURE.invalid);
  if (!validDataRevision(record.dataRevision) || !Array.isArray(record.results)) return failure('runtime.region-invalid', FAILURE.invalid);
  const canonical = {...record};
  delete canonical.dataRevision;
  const checked = validateCommitReadSet(canonical, canonical);
  if (!checked.ok) return failure('runtime.region-invalid', checked.diagnostics[0]!.message);
  const refs = normalizeRefs(record.results as readonly ResultRef[], checked.value.scopeDigest);
  if (!refs.ok) return refs;
  return {ok: true, value: frozen({...checked.value, results: refs.value, dataRevision: record.dataRevision as number})};
}

function requiredResultReferences(state: RegionContent): readonly ResultRef[] {
  const refs: ResultRef[] = [];
  if (state.task.kind === 'presentation') refs.push(...state.task.inputs);
  if (state.task.kind === 'data') {
    for (const output of state.task.outputs) {
      if (output.kind === 'reuse') refs.push(output.result);
      else if (output.query.population.kind === 'fixed') refs.push(output.query.population.source);
    }
  }
  for (const node of state.presentation?.nodes ?? []) if (node.result !== undefined) refs.push(node.result);
  if (state.presentation !== undefined) refs.push(...state.presentation.preconditions.results);
  for (const entry of state.interaction?.values ?? []) {
    if (entry.payload.kind === 'selection' && entry.payload.selection.mode === 'ids') refs.push(entry.payload.selection.result);
  }
  return refs;
}

function bindCandidateToReadSet(state: RegionContent, expected: RegionReadSet): RegionOutcome<void> {
  if (state.task.catalogRevision !== expected.catalogRevision || state.task.functionRegistryDigest !== expected.functionRegistryDigest)
    return failure('runtime.region-stale', 'The candidate Task is bound to a different catalog or function registry.');
  if (state.presentation !== undefined) {
    const plan = state.presentation.preconditions;
    const checked = validateCommitReadSet(plan, stripData(expected), plan.results);
    if (!checked.ok) return failure('runtime.region-stale', 'The candidate PresentationPlan is bound to a different read set.');
  }
  return {ok: true, value: undefined};
}

function nextRevision(current: string): string {
  if (/^[0-9]+$/u.test(current)) {
    const number = Number(current);
    if (Number.isSafeInteger(number) && number < Number.MAX_SAFE_INTEGER) return String(number + 1);
  }
  for (;;) {
    if (runtimeRevisionCounter >= Number.MAX_SAFE_INTEGER) throw new RangeError('Runtime revision budget exhausted.');
    runtimeRevisionCounter++;
    const suffix = `-${runtimeRevisionCounter.toString(36)}`;
    if (suffix.length >= WIRE_LIMITS.id) throw new RangeError('Runtime revision budget exhausted.');
    const next = `${current.slice(0, WIRE_LIMITS.id - suffix.length)}${suffix}`;
    if (next !== current) return next;
  }
}

function resultRefFromHandle(handle: ResultHandle): RegionOutcome<ResultRef> {
  if (handle === null || typeof handle !== 'object' || typeof handle.snapshot !== 'function') return failure('runtime.region-invalid', 'Region dependencies must be real ResultHandles.');
  try {
    const snapshot = handle.snapshot();
    const ref = snapshot.descriptor?.ref;
    if (ref === undefined || !validateResultRef(ref)) return failure('runtime.region-stale', 'A result handle has no committed descriptor to bind to the region.');
    if (ref.outputId !== handle.key.outputId || ref.queryDigest !== handle.key.queryDigest || ref.scopeDigest !== handle.key.scopeDigest ||
        !['ready', 'partial', 'refreshing'].includes(snapshot.status))
      return failure('runtime.region-stale', 'The result handle is no longer an authorized dependency.');
    return {ok: true, value: frozen({...ref})};
  } catch {
    return failure('runtime.region-stale', 'The result handle is no longer an authorized dependency.');
  }
}

function retainResultHandle(handle: ResultHandle): RegionOutcome<ResultLease> {
  try {
    if (handle === null || typeof handle !== 'object' || typeof handle.retain !== 'function')
      return failure('runtime.region-invalid', 'Region dependencies must be real ResultHandles with a retainable lease.');
    const lease = handle.retain();
    if (lease === null || typeof lease !== 'object' || typeof lease.release !== 'function' || lease.released)
      return failure('runtime.region-stale', 'A result handle is no longer available for a region lease.');
    return {ok: true, value: lease};
  } catch {
    return failure('runtime.region-stale', 'A result handle could not be retained by the region.');
  }
}

function bindResultHandleToAuthority(handle: ResultHandle, authority: RegionAuthority): RegionOutcome<void> {
  try {
    const key = handle.key;
    if (key.principalKey !== authority.principalKey || key.scopeDigest !== authority.scopeDigest ||
        key.policyRevision !== authority.policyRevision || key.catalogRevision !== authority.catalogRevision ||
        key.functionRegistryDigest !== authority.functionRegistryDigest)
      return failure('runtime.region-stale', 'A result handle belongs to a different principal or authorization pin.');
    return {ok: true, value: undefined};
  } catch {
    return failure('runtime.region-stale', 'A result handle has no stable authorization identity.');
  }
}

function resultHandleGeneration(handle: ResultHandle): RegionOutcome<number> {
  try {
    const generation = handle.generation;
    if (!Number.isSafeInteger(generation) || generation < 0) return failure('runtime.region-stale', 'A result handle has no stable generation.');
    return {ok: true, value: generation};
  } catch {
    return failure('runtime.region-stale', 'A result handle has no stable generation.');
  }
}

interface OwnedResultLease {
  readonly ref: ResultRef;
  readonly lease: ResultLease;
}

function releaseLeases(leases: readonly OwnedResultLease[]): void {
  for (const owned of leases) {
    try { owned.lease.release(); } catch { /* a host lease cannot invalidate region state */ }
  }
}

function validateRestoreMaterialization(value: unknown): RegionOutcome<RegionRestoreMaterialization> {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return failure('runtime.region-denied', FAILURE.denied);
    const record = value as Record<string, unknown>;
    if (Object.keys(record).some((key) => key !== 'state' && key !== 'resultHandles') || !Object.hasOwn(record, 'state'))
      return failure('runtime.region-denied', FAILURE.denied);
    if (record.resultHandles !== undefined && (!Array.isArray(record.resultHandles) || record.resultHandles.length > WIRE_LIMITS.array))
      return failure('runtime.region-budget', FAILURE.budget);
    return {ok: true, value: frozen({state: record.state as RegionContent, ...(record.resultHandles === undefined ? {} : {resultHandles: Object.freeze([...record.resultHandles] as ResultHandle[])})})};
  } catch {
    return failure('runtime.region-denied', FAILURE.denied);
  }
}

export function resultRefForHandle(handle: ResultHandle): RegionOutcome<ResultRef> { return resultRefFromHandle(handle); }

interface StageRecord {
  readonly token: RegionCommitToken;
  readonly state: RegionContent;
  readonly requestId: string;
  readonly capturedReadSet: RegionReadSet;
  readonly requiredResults: readonly ResultRef[];
  readonly resultHandles: readonly ResultHandle[];
  readonly resultLeases: readonly OwnedResultLease[];
  readonly handleGenerations: ReadonlyMap<string, number>;
  readonly baseTaskRevision: string;
  readonly baseRegionRevision: string;
  readonly baseDataRevision: number;
  readonly principalKey: string;
  readonly bytes: number;
  consumed: boolean;
}

function intersects(dependencies: readonly ResultRef[] | undefined, changed: readonly ResultRef[] | undefined): boolean {
  if (dependencies === undefined) return true;
  if (changed === undefined) return true;
  const changedKeys = new Set(changed.map(logicalRefKey));
  return dependencies.some((ref) => changedKeys.has(logicalRefKey(ref)));
}

type ObserverRecord = {readonly listener: (update: RegionUpdate) => void; readonly results?: readonly ResultRef[]; closed: boolean};

const TOKEN_MARKER = Symbol('aeliqo-region-token');

class RegionHandleImpl implements RegionHandle {
  readonly id: string;
  private readonly queue: SerialQueue;
  private readonly now: () => number;
  private readonly readAuthority: ReadAuthority;
  private readonly authorizeCommit: AuthorizeRegionCommit;
  private readonly authorizationConfigured: boolean;
  private readonly observers = new Set<ObserverRecord>();
  private readonly staged = new Map<RegionCommitToken, StageRecord>();
  private stagedBytes = 0;
  private readonly maxHistory: number;
  private readonly maxStagedCommits: number;
  private readonly maxStagedBytes: number;
  private readonly maxCommitAuthorizationMilliseconds: number;
  private taskRevision: string;
  private principalKey: string;
  private regionRevision: string;
  private dataRevision: number;
  private status: 'active' | 'revoked' | 'disposed' = 'active';
  private state: RegionContent | undefined;
  private readSet: RegionReadSet | undefined;
  private entries: RegionHistoryEntry[];
  private epoch = 0;
  private disposed = false;
  private readonly inFlight = new Set<StageRecord>();
  private readonly authorizationControllers = new Set<AbortController>();
  private currentResultLeases: readonly OwnedResultLease[] = Object.freeze([]);

  constructor(
    private readonly store: RegionStoreImpl,
    input: RegionCreateInput,
    options: {readonly maxHistory: number; readonly maxQueuedCommands: number; readonly maxStagedCommits: number; readonly maxStagedBytes: number; readonly maxCommitAuthorizationMilliseconds: number; readonly now: () => number; readonly readAuthority: ReadAuthority; readonly authorizeCommit: AuthorizeRegionCommit; readonly authorizationConfigured: boolean},
    seed?: {readonly taskRevision: string; readonly regionRevision: string; readonly dataRevision: number; readonly authority: RegionAuthority; readonly history: readonly RegionHistoryEntry[]},
  ) {
    this.id = input.id;
    this.queue = createSerialQueue(options.maxQueuedCommands);
    this.maxHistory = input.maxHistory ?? options.maxHistory;
    this.maxStagedCommits = options.maxStagedCommits;
    this.maxStagedBytes = options.maxStagedBytes;
    this.maxCommitAuthorizationMilliseconds = options.maxCommitAuthorizationMilliseconds;
    this.now = options.now;
    this.readAuthority = options.readAuthority;
    this.authorizeCommit = options.authorizeCommit;
    this.authorizationConfigured = options.authorizationConfigured;
    this.taskRevision = seed?.taskRevision ?? input.state.task.revision;
    const authority = seed?.authority;
    this.principalKey = authority?.principalKey ?? '';
    this.regionRevision = seed?.regionRevision ?? '1';
    this.dataRevision = seed?.dataRevision ?? 0;
    this.state = frozen(input.state);
    if (authority === undefined) throw new TypeError('A region requires a current host authority.');
    this.readSet = authorityReadSet(authority, this.taskRevision, this.regionRevision, this.dataRevision);
    this.entries = seed?.history.length ? [...seed.history] : [this.makeHistory('commit')];
    this.trimHistory();
  }

  private makeHistory(kind: 'commit' | 'data' | 'revoke', changedResults?: readonly ResultRef[], requestId?: string, reason?: string, at = this.now()): RegionHistoryEntry {
    return frozen({
      kind,
      taskRevision: this.taskRevision,
      regionRevision: this.regionRevision,
      dataRevision: this.dataRevision,
      ...(this.state === undefined ? {} : {stateDigest: digest(this.state)}),
      ...(changedResults === undefined || changedResults.length === 0 ? {} : {changedResults: frozen([...changedResults])}),
      ...(requestId === undefined ? {} : {requestId}),
      ...(reason === undefined ? {} : {reason}),
      at,
    });
  }

  private trimHistory(): void {
    if (this.entries.length > this.maxHistory) this.entries = this.entries.slice(this.entries.length - this.maxHistory);
    this.entries = Object.freeze(this.entries.slice()) as unknown as RegionHistoryEntry[];
  }

  private snapshotValue(): RegionSnapshot {
    return frozen({
      id: this.id,
      taskRevision: this.taskRevision,
      regionRevision: this.regionRevision,
      dataRevision: this.dataRevision,
      status: this.status,
      ...(this.state === undefined ? {} : {state: this.state}),
      ...(this.readSet === undefined ? {} : {readSet: this.readSet}),
    });
  }

  private notify(update: RegionUpdate, changedResults?: readonly ResultRef[], observers: readonly ObserverRecord[] = [...this.observers]): void {
    for (const observer of observers) {
      if ((update.kind === 'commit' || update.kind === 'data') && this.status !== 'active') return;
      if (observer.closed || (update.kind === 'data' && !intersects(observer.results, changedResults))) continue;
      try {
        const result = observer.listener(update);
        if (result !== undefined && typeof (result as unknown as PromiseLike<void>)?.then === 'function') void Promise.resolve(result).catch(() => {});
      } catch { /* observer exceptions never affect committed state */ }
    }
  }

  private closedOutcome<T>(): RegionOutcome<T> {
    if (this.disposed || this.status === 'disposed') return failure('runtime.region-disposed', FAILURE.disposed);
    if (this.status === 'revoked') return failure('runtime.region-revoked', FAILURE.revoked);
    return failure('runtime.region-invalid', FAILURE.invalid);
  }

  private live(epoch: number): boolean { return epoch === this.epoch && this.status === 'active'; }

  private abortPendingAuthorizations(): void {
    for (const controller of [...this.authorizationControllers]) {
      try { controller.abort(); } catch { /* AbortController implementations should not break revocation. */ }
    }
  }

  private transferResultLeases(next: readonly OwnedResultLease[], expectedEpoch = this.epoch): boolean {
    const byRef = new Map<string, OwnedResultLease>();
    const replaced: OwnedResultLease[] = [];
    for (const owned of next) {
      const key = refKey(owned.ref);
      const previous = byRef.get(key);
      if (previous !== undefined && previous !== owned) replaced.push(previous);
      byRef.set(key, owned);
    }
    const previous = this.currentResultLeases;
    this.currentResultLeases = Object.freeze([...byRef.values()]);
    releaseLeases([...previous, ...replaced]);
    return this.live(expectedEpoch);
  }

  private mergeResultLeases(next: readonly OwnedResultLease[], authorized: readonly ResultRef[], expectedEpoch = this.epoch): boolean {
    if (!this.live(expectedEpoch)) return false;
    const authorizedKeys = new Set(authorized.map(refKey));
    const byRef = new Map<string, OwnedResultLease>();
    const replaced: OwnedResultLease[] = [];
    for (const owned of this.currentResultLeases) {
      const key = refKey(owned.ref);
      if (!authorizedKeys.has(key)) {
        replaced.push(owned);
        continue;
      }
      const previous = byRef.get(key);
      if (previous !== undefined && previous !== owned) replaced.push(previous);
      byRef.set(key, owned);
    }
    for (const owned of next) {
      const key = refKey(owned.ref);
      const previous = byRef.get(key);
      if (previous !== undefined && previous !== owned) replaced.push(previous);
      byRef.set(key, owned);
    }
    this.currentResultLeases = Object.freeze([...byRef.values()]);
    releaseLeases(replaced);
    return this.live(expectedEpoch);
  }

  adoptInitialResultLeases(leases: readonly OwnedResultLease[]): void {
    this.transferResultLeases(leases);
  }

  private enqueue<T>(command: () => Promise<RegionOutcome<T>> | RegionOutcome<T>): Promise<RegionOutcome<T>> {
    return this.queue.enqueue(command).catch((error: unknown) => {
      if (this.status === 'revoked') return failure<T>('runtime.region-revoked', FAILURE.revoked);
      if (this.disposed || this.status === 'disposed') return failure<T>('runtime.region-disposed', FAILURE.disposed);
      if (error instanceof Error && error.message.includes('queue')) return failure<T>('runtime.region-queue', FAILURE.queue);
      return failure<T>('runtime.region-invalid', error instanceof Error ? error.message : FAILURE.invalid);
    });
  }

  snapshot(): RegionSnapshot { return this.snapshotValue(); }

  discard(token: RegionCommitToken): boolean {
    if (this.status !== 'active' || token === null || typeof token !== 'object') return false;
    const record = this.staged.get(token);
    if (record === undefined || record.consumed) return false;
    record.consumed = true;
    this.staged.delete(token);
    this.stagedBytes = Math.max(0, this.stagedBytes - record.bytes);
    releaseLeases(record.resultLeases);
    return true;
  }

  async stage(input: RegionStageInput): Promise<RegionOutcome<RegionCommitToken>> {
    if (this.status !== 'active') return this.closedOutcome();
    if (!this.authorizationConfigured) return failure('runtime.region-denied', FAILURE.denied);
    const stagedEpoch = this.epoch;
    if (input === null || typeof input !== 'object') return failure('runtime.region-invalid', FAILURE.invalid);
    const allowed = ['requestId', 'expected', 'state', 'resultHandles'];
    if (Object.keys(input).some((key) => !allowed.includes(key)) || !validId(input.requestId)) return failure('runtime.region-invalid', FAILURE.invalid);
    let checkedState = validateState(input.state, this.id);
    if (!checkedState.ok) return checkedState;
    // Layout/Task updates do not implicitly discard semantic controls or drafts.
    // Explicit controller transactions supply the replacement interaction state.
    if (checkedState.value.interaction === undefined && this.state?.interaction !== undefined) {
      checkedState = validateState({...checkedState.value, interaction: this.state.interaction}, this.id);
      if (!checkedState.ok) return checkedState;
    }
    const expected = validateReadSet(input.expected);
    if (!expected.ok) return expected;
    const binding = bindCandidateToReadSet(checkedState.value, expected.value);
    if (!binding.ok) return binding;
    const authorityResult = this.currentAuthority(stagedEpoch);
    if (!authorityResult.ok) return authorityResult as RegionOutcome<RegionCommitToken>;
    if (!this.live(stagedEpoch)) return this.closedOutcome();
    const actual = authorityReadSet(authorityResult.value, this.taskRevision, this.regionRevision, this.dataRevision);
    const required = [...requiredResultReferences(checkedState.value)];
    const handles = input.resultHandles ?? [];
    if (!Array.isArray(handles) || handles.length > WIRE_LIMITS.array) return failure('runtime.region-budget', FAILURE.budget);
    const generations = new Map<string, number>();
    const leases: OwnedResultLease[] = [];
    let retainedForStage = false;
    try {
      for (const handle of handles) {
        const ref = resultRefFromHandle(handle);
        if (!ref.ok) return ref;
        if (!this.live(stagedEpoch)) return this.closedOutcome();
        const handleBinding = bindResultHandleToAuthority(handle, authorityResult.value);
        if (!handleBinding.ok) return handleBinding as RegionOutcome<RegionCommitToken>;
        if (!this.live(stagedEpoch)) return this.closedOutcome();
        const lease = retainResultHandle(handle);
        if (!lease.ok) return lease;
        leases.push({ref: ref.value, lease: lease.value});
        if (!this.live(stagedEpoch)) return this.closedOutcome();
        required.push(ref.value);
        const generation = resultHandleGeneration(handle);
        if (!generation.ok) return generation as RegionOutcome<RegionCommitToken>;
        if (!this.live(stagedEpoch)) return this.closedOutcome();
        generations.set(refKey(ref.value), generation.value);
      }
      if (expected.value.dataRevision !== actual.dataRevision) return failure('runtime.region-stale', FAILURE.stale);
      const checked = validateCommitReadSet(stripData(expected.value), stripData(actual), required);
      if (!checked.ok) return failure('runtime.region-stale', checked.diagnostics[0]!.message);
      const capturedRefs = new Map<string, ResultRef>();
      for (const ref of expected.value.results) capturedRefs.set(refKey(ref), ref);
      for (const ref of required) capturedRefs.set(refKey(ref), ref);
      const capturedResults = normalizeRefs([...capturedRefs.values()], actual.scopeDigest);
      if (!capturedResults.ok) return capturedResults as RegionOutcome<RegionCommitToken>;
      // Preserve the declared read set plus candidate-required dependencies. The
      // host authority may expose unrelated outputs; capturing all of them would
      // make an otherwise disjoint proposal stale when those outputs refresh.
      const capturedReadSet = frozen({...expected.value, results: capturedResults.value});
      const bytes = new TextEncoder().encode(canonical(checkedState.value)).byteLength + new TextEncoder().encode(canonical(capturedReadSet)).byteLength;
      if (this.staged.size >= this.maxStagedCommits || this.stagedBytes + bytes > this.maxStagedBytes)
        return failure('runtime.region-budget', FAILURE.budget);
      const token = Object.freeze({[TOKEN_MARKER]: true}) as unknown as RegionCommitToken;
      const record: StageRecord = {
        token,
        state: checkedState.value,
        requestId: input.requestId,
        capturedReadSet,
        requiredResults: Object.freeze(required.map((ref) => frozen({...ref}))),
        resultHandles: Object.freeze([...handles]),
        resultLeases: Object.freeze([...leases]),
        handleGenerations: generations,
        baseTaskRevision: this.taskRevision,
        baseRegionRevision: this.regionRevision,
        baseDataRevision: this.dataRevision,
        principalKey: authorityResult.value.principalKey,
        bytes,
        consumed: false,
      };
      this.staged.set(token, record);
      this.stagedBytes += bytes;
      retainedForStage = true;
      return {ok: true, value: token};
    } finally {
      if (!retainedForStage) releaseLeases(leases);
    }

  }

  private currentAuthority(expectedEpoch = this.epoch): RegionOutcome<RegionAuthority> {
    if (typeof this.readAuthority !== 'function') return failure('runtime.region-denied', FAILURE.denied);
    try {
      const result = this.readAuthority(this.id);
      if (!this.live(expectedEpoch)) return this.closedOutcome();
      const normalized = normalizeHostOutcome<RegionAuthority>(result);
      if (!this.live(expectedEpoch)) return this.closedOutcome();
      if (!normalized.ok) return normalized as RegionOutcome<RegionAuthority>;
      return validateAuthority(normalized.value);
    } catch {
      if (!this.live(expectedEpoch)) return this.closedOutcome();
      return failure('runtime.region-denied', FAILURE.denied);
    }
  }

  private validateToken(token: RegionCommitToken): RegionOutcome<StageRecord> {
    if (token === null || typeof token !== 'object') return failure('runtime.region-invalid', 'The commit token is not recognized by this region.');
    const record = this.staged.get(token);
    if (record === undefined || record.token !== token) return failure('runtime.region-invalid', 'The commit token is not recognized by this region.');
    if (record.consumed) return failure('runtime.region-stale', 'A region commit token can only be used once.');
    record.consumed = true;
    this.staged.delete(token);
    this.stagedBytes = Math.max(0, this.stagedBytes - record.bytes);
    this.inFlight.add(record);
    return {ok: true, value: record};
  }

  private handleGenerationsCurrent(record: StageRecord, authority: RegionAuthority, expectedEpoch = this.epoch): RegionOutcome<void> {
    for (const handle of record.resultHandles) {
      const ref = resultRefFromHandle(handle);
      if (!ref.ok) return ref;
      if (!this.live(expectedEpoch)) return this.closedOutcome();
      const binding = bindResultHandleToAuthority(handle, authority);
      if (!binding.ok) return binding;
      if (!this.live(expectedEpoch)) return this.closedOutcome();
      const generation = resultHandleGeneration(handle);
      if (!generation.ok) return generation;
      if (record.handleGenerations.get(refKey(ref.value)) !== generation.value) return failure('runtime.region-stale', FAILURE.stale);
    }
    return {ok: true, value: undefined};
  }

  private authorizeWithDeadline(
    input: Omit<RegionCommitAuthorizationInput, 'signal'>,
    expectedEpoch: number,
    callerSignal?: AbortSignal,
  ): Promise<RegionOutcome<void>> {
    if (!this.live(expectedEpoch)) return Promise.resolve(this.closedOutcome());
    if (callerSignal?.aborted) return Promise.resolve(failure('runtime.region-cancelled', 'The region commit was cancelled before publication.'));
    const controller = new AbortController();
    this.authorizationControllers.add(controller);
    let timedOut = false;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let resolveResult: (result: RegionOutcome<void>) => void = () => {};
    const finish = (result: RegionOutcome<void>): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      controller.signal.removeEventListener('abort', onAbort);
      callerSignal?.removeEventListener('abort', onCallerAbort);
      this.authorizationControllers.delete(controller);
      resolveResult(result);
    };
    const onAbort = (): void => {
      if (!this.live(expectedEpoch)) finish(this.closedOutcome());
      else if (callerSignal?.aborted) finish(failure('runtime.region-cancelled', 'The region commit was cancelled before publication.'));
      else if (timedOut) finish(failure('runtime.region-budget', FAILURE.authorizationTimeout));
      else finish(this.closedOutcome());
    };
    const onCallerAbort = (): void => { controller.abort(); };
    const result = new Promise<RegionOutcome<void>>((resolve) => { resolveResult = resolve; });
    controller.signal.addEventListener('abort', onAbort, {once: true});
    callerSignal?.addEventListener('abort', onCallerAbort, {once: true});
    if (callerSignal?.aborted) { onCallerAbort(); return result; }
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, Math.min(this.maxCommitAuthorizationMilliseconds, 2_147_483_647));
    let pending: Promise<RegionOutcome<void>>;
    try {
      pending = Promise.resolve(this.authorizeCommit({...input, signal: controller.signal}));
    } catch {
      finish(failure('runtime.region-denied', FAILURE.denied));
      return result;
    }
    pending.then((authorized) => {
      try {
        if (timedOut || settled) return;
        if (!this.live(expectedEpoch)) { finish(this.closedOutcome()); return; }
        const normalized = normalizeHostOutcome<void>(authorized);
        if (!this.live(expectedEpoch)) finish(this.closedOutcome());
        else if (callerSignal?.aborted) finish(failure('runtime.region-cancelled', 'The region commit was cancelled before publication.'));
        else finish(normalized);
      } catch {
        finish(failure('runtime.region-denied', FAILURE.denied));
      }
    }, () => finish(failure('runtime.region-denied', FAILURE.denied)));
    return result;
  }

  private settleStageRecord(record: StageRecord, transferred: boolean): void {
    this.inFlight.delete(record);
    if (!transferred) releaseLeases(record.resultLeases);
  }

  async commit(token: RegionCommitToken, options: RegionCommitOptions = {}): Promise<RegionOutcome<RegionSnapshot>> {
    if (this.status !== 'active') return this.closedOutcome();
    const signal = options.signal;
    const recordCheck = this.validateToken(token);
    if (!recordCheck.ok) return recordCheck;
    const record = recordCheck.value;
    const queuedEpoch = this.epoch;
    this.inFlight.add(record);
    const queued: Promise<RegionOutcome<RegionSnapshot>> = this.enqueue<RegionSnapshot>(async () => {
      let transferred = false;
      try {
        if (!this.live(queuedEpoch)) return this.closedOutcome();
        if (signal?.aborted) return failure('runtime.region-cancelled', 'The region commit was cancelled before publication.');
        if (this.taskRevision !== record.baseTaskRevision || this.regionRevision !== record.baseRegionRevision || this.dataRevision !== record.baseDataRevision)
          return failure('runtime.region-stale', FAILURE.stale);
        const beforeAuthority = this.currentAuthority(queuedEpoch);
        if (!beforeAuthority.ok) return beforeAuthority as RegionOutcome<RegionSnapshot>;
        if (!this.live(queuedEpoch)) return this.closedOutcome();
        if (beforeAuthority.value.principalKey !== this.principalKey || beforeAuthority.value.principalKey !== record.principalKey)
          return failure('runtime.region-stale', FAILURE.stale);
        const current = this.snapshotValue();
        if (!this.authorizationConfigured) return failure('runtime.region-denied', FAILURE.denied);
        const authorizationInput: Omit<RegionCommitAuthorizationInput, 'signal'> = {regionId: this.id, token, state: record.state, current, authority: beforeAuthority.value};
        const authorized = await this.authorizeWithDeadline(authorizationInput, queuedEpoch, signal);
        if (!authorized.ok) return authorized as RegionOutcome<RegionSnapshot>;
        if (!this.live(queuedEpoch)) return this.closedOutcome();
        const afterAuthority = this.currentAuthority(queuedEpoch);
        if (!afterAuthority.ok) return afterAuthority as RegionOutcome<RegionSnapshot>;
        // readAuthority is host code and may synchronously revoke/dispose while returning.
        if (!this.live(queuedEpoch)) return this.closedOutcome();
        const fresh = authorityReadSet(afterAuthority.value, this.taskRevision, this.regionRevision, this.dataRevision);
        if (afterAuthority.value.principalKey !== this.principalKey || afterAuthority.value.principalKey !== record.principalKey ||
            record.capturedReadSet.dataRevision !== fresh.dataRevision || !validateCommitReadSet(stripData(record.capturedReadSet), stripData(fresh), record.requiredResults).ok)
          return failure('runtime.region-stale', FAILURE.stale);
        const generationCheck = this.handleGenerationsCurrent(record, afterAuthority.value, queuedEpoch);
        if (!generationCheck.ok) return generationCheck as RegionOutcome<RegionSnapshot>;
        if (!this.live(queuedEpoch)) return this.closedOutcome();
        if (this.taskRevision !== record.baseTaskRevision || this.regionRevision !== record.baseRegionRevision || this.dataRevision !== record.baseDataRevision)
          return failure('runtime.region-stale', FAILURE.stale);
        const nextTaskRevision = nextRevision(this.taskRevision);
        const nextRegionRevision = nextRevision(this.regionRevision);
        const nextTask = frozen({...record.state.task, revision: nextTaskRevision});
        const nextPresentation = record.state.presentation === undefined ? undefined : frozen({
          ...record.state.presentation,
          preconditions: frozen({...record.state.presentation.preconditions, taskRevision: nextTaskRevision, regionRevision: nextRegionRevision}),
        });
        const nextState = validateState({task: nextTask,
          ...(nextPresentation === undefined ? {} : {presentation: nextPresentation}),
          ...(record.state.interaction === undefined ? {} : {interaction: record.state.interaction}),
        }, this.id);
        if (!nextState.ok) return nextState;
        // Obtain host clock metadata before changing state; injected clocks are callbacks too.
        const at = this.now();
        if (!this.live(queuedEpoch)) return this.closedOutcome();
        if (signal?.aborted) return failure('runtime.region-cancelled', 'The region commit was cancelled before publication.');
        const nextReadSet = authorityReadSet(afterAuthority.value, nextTaskRevision, nextRegionRevision, this.dataRevision);
        this.taskRevision = nextTaskRevision;
        this.principalKey = afterAuthority.value.principalKey;
        this.regionRevision = nextRegionRevision;
        this.state = nextState.value;
        this.readSet = nextReadSet;
        this.entries = [...this.entries, this.makeHistory('commit', undefined, record.requestId, undefined, at)];
        this.trimHistory();
        // Reusing an existing view must retain the result leases its committed
        // state still references, even when this command adds no new handles.
        const transferLive = this.mergeResultLeases(record.resultLeases, record.requiredResults, queuedEpoch);
        transferred = true;
        if (!transferLive) return this.closedOutcome();
        const snapshot = this.snapshotValue();
        this.notify(frozen({kind: 'commit', snapshot, requestId: record.requestId}));
        return {ok: true, value: snapshot};
      } finally {
        this.settleStageRecord(record, transferred);
      }
    });
    return queued.then((result) => {
      // A queue that was closed/full can reject before its command gets a turn.
      if (this.inFlight.has(record)) this.settleStageRecord(record, false);
      return result;
    });
  }

  async publishData(publication?: RegionDataPublication): Promise<RegionOutcome<RegionSnapshot>> {
    const queuedEpoch = this.epoch;
    return this.enqueue(async () => {
      let publicationLeases: OwnedResultLease[] = [];
      let transferred = false;
      try {
        if (!this.live(queuedEpoch)) return this.closedOutcome();
        const explicit = publication?.resultHandles !== undefined || publication?.results !== undefined;
        if (publication !== undefined && Object.keys(publication).some((key) => !['resultHandles', 'results', 'reason'].includes(key))) return failure('runtime.region-invalid', FAILURE.invalid);
        if (publication?.reason !== undefined && !validText(publication.reason)) return failure('runtime.region-invalid', 'The publication reason is not bounded.');
        if (publication?.resultHandles !== undefined && publication.results !== undefined) return failure('runtime.region-invalid', 'Publish either ResultHandles or canonical references, not both.');
        const refs: ResultRef[] = [];
        const explicitHandles = publication?.resultHandles;
        if (publication?.resultHandles !== undefined) {
          if (!Array.isArray(publication.resultHandles) || publication.resultHandles.length > WIRE_LIMITS.array) return failure('runtime.region-budget', FAILURE.budget);
          for (const handle of publication.resultHandles) {
            const ref = resultRefFromHandle(handle);
            if (!ref.ok) return ref;
            if (!this.live(queuedEpoch)) return this.closedOutcome();
            const lease = retainResultHandle(handle);
            if (!lease.ok) return lease;
            publicationLeases.push({ref: ref.value, lease: lease.value});
            if (!this.live(queuedEpoch)) return this.closedOutcome();
            refs.push(ref.value);
          }
        } else if (publication?.results !== undefined) {
          if (!Array.isArray(publication.results)) return failure('runtime.region-invalid', FAILURE.invalid);
          refs.push(...publication.results);
        }
        const scope = this.readSet?.scopeDigest;
        if (scope === undefined) return this.closedOutcome();
        const authority = this.currentAuthority(queuedEpoch);
        if (!authority.ok) return authority as RegionOutcome<RegionSnapshot>;
        if (!this.live(queuedEpoch)) return this.closedOutcome();
        if (authority.value.principalKey !== this.principalKey) return failure('runtime.region-stale', FAILURE.stale);
        if (explicitHandles !== undefined) {
          for (const handle of explicitHandles) {
            const binding = bindResultHandleToAuthority(handle, authority.value);
            if (!binding.ok) return binding as RegionOutcome<RegionSnapshot>;
            if (!this.live(queuedEpoch)) return this.closedOutcome();
          }
        }
        const currentPins = this.readSet;
        if (currentPins === undefined || authority.value.scopeDigest !== currentPins.scopeDigest || authority.value.policyRevision !== currentPins.policyRevision ||
            authority.value.catalogRevision !== currentPins.catalogRevision || authority.value.experienceRevision !== currentPins.experienceRevision ||
            authority.value.functionRegistryDigest !== currentPins.functionRegistryDigest)
          return failure('runtime.region-stale', FAILURE.stale);
        const normalized = normalizeRefs(refs, scope);
        if (!normalized.ok) return normalized;
        if (explicit && normalized.value.length === 0) {
          // An explicit no-op is only valid when the authority's materialized refs
          // are still exactly the refs the region observed; otherwise it would
          // silently acknowledge a changed result generation.
          if (authority.value.results.length !== currentPins.results.length || authority.value.results.some((ref, index) => refKey(ref) !== refKey(currentPins.results[index]!)))
            return failure('runtime.region-stale', FAILURE.stale);
          return {ok: true, value: this.snapshotValue()};
        }
        if (this.dataRevision >= Number.MAX_SAFE_INTEGER) return failure('runtime.region-budget', FAILURE.budget);
        const authorityRefs = new Set(authority.value.results.map(refKey));
        if (normalized.value.some((ref) => !authorityRefs.has(refKey(ref)))) return failure('runtime.region-stale', FAILURE.stale);
        const currentRefKeys = new Set(currentPins.results.map(refKey));
        const authorityRefKeys = new Set(authority.value.results.map(refKey));
        // Prefer the fresh authority metadata when a logical output has both a
        // retired and a replacement generation in the symmetric diff.
        const changedByLogical = new Map<string, {readonly ref: ResultRef; readonly priority: number}>();
        for (const ref of normalized.value) changedByLogical.set(logicalRefKey(ref), {ref, priority: 1});
        for (const ref of authority.value.results) {
          if (!currentRefKeys.has(refKey(ref))) changedByLogical.set(logicalRefKey(ref), {ref, priority: 2});
        }
        for (const ref of currentPins.results) {
          if (!authorityRefKeys.has(refKey(ref)) && !changedByLogical.has(logicalRefKey(ref))) changedByLogical.set(logicalRefKey(ref), {ref, priority: 0});
        }
        const effectiveChangedResults = [...changedByLogical.values()].sort((left, right) => right.priority - left.priority).map((entry) => entry.ref);
        if (effectiveChangedResults.length > WIRE_LIMITS.array) return failure('runtime.region-budget', FAILURE.budget);
        // Obtain host clock metadata before changing the materialized revision.
        const at = this.now();
        if (!this.live(queuedEpoch)) return this.closedOutcome();
        this.dataRevision += 1;
        this.readSet = authorityReadSet(authority.value, this.taskRevision, this.regionRevision, this.dataRevision);
        this.entries = [...this.entries, this.makeHistory('data', effectiveChangedResults, undefined, publication?.reason, at)];
        this.trimHistory();
        // Reconcile every publication against the fresh authority set. This
        // releases revoked/retired refs even when no replacement handle was
        // supplied, while retaining unrelated outputs still authorized.
        const transferLive = this.mergeResultLeases(publicationLeases, authority.value.results, queuedEpoch);
        transferred = true;
        if (!transferLive) return this.closedOutcome();
        if (!this.live(queuedEpoch)) return this.closedOutcome();
        const snapshot = this.snapshotValue();
        const update: RegionUpdate = frozen({kind: 'data', snapshot, ...(effectiveChangedResults.length === 0 ? {} : {changedResults: effectiveChangedResults}), ...(publication?.reason === undefined ? {} : {reason: publication.reason})});
        this.notify(update, explicit ? effectiveChangedResults : (effectiveChangedResults.length === 0 ? undefined : effectiveChangedResults));
        return {ok: true, value: snapshot};
      } finally {
        if (!transferred) releaseLeases(publicationLeases);
      }
    });
  }

  observe(listener: (update: RegionUpdate) => void, options: RegionObserverOptions = {}): RegionObserverFunction {
    if (typeof listener !== 'function') throw new TypeError('A region observer must be a function.');
    if (this.status !== 'active') {
      const closed = (() => {}) as unknown as RegionObserverFunction;
      Object.defineProperties(closed, {closed: {value: true, enumerable: true}, unsubscribe: {value: closed, enumerable: true}});
      return closed;
    }
    const observedEpoch = this.epoch;
    let dependencies: readonly ResultRef[] | undefined;
    if (options.results !== undefined) {
      if (!Array.isArray(options.results)) throw new TypeError('Observer result dependencies must be an array.');
      const refs: ResultRef[] = [];
      for (const candidate of options.results) {
        const ref = typeof (candidate as ResultHandle)?.snapshot === 'function' ? resultRefFromHandle(candidate as ResultHandle) : validateResultRef(candidate) ? {ok: true, value: candidate} as const : failure<ResultRef>('runtime.region-invalid', FAILURE.invalid);
        if (!ref.ok) throw new TypeError(ref.diagnostics[0]!.message);
        if (!this.live(observedEpoch)) {
          const closed = (() => {}) as unknown as RegionObserverFunction;
          Object.defineProperties(closed, {closed: {value: true, enumerable: true}, unsubscribe: {value: closed, enumerable: true}});
          return closed;
        }
        if (ref.value.scopeDigest !== this.readSet?.scopeDigest) throw new TypeError('Observer dependencies must belong to the region authorization scope.');
        refs.push(ref.value);
      }
      dependencies = Object.freeze(refs);
    }
    if (!this.live(observedEpoch)) {
      const closed = (() => {}) as unknown as RegionObserverFunction;
      Object.defineProperties(closed, {closed: {value: true, enumerable: true}, unsubscribe: {value: closed, enumerable: true}});
      return closed;
    }
    const record: ObserverRecord = {listener, ...(dependencies === undefined ? {} : {results: dependencies}), closed: false};
    this.observers.add(record);
    const unsubscribe = (() => { if (!record.closed) { record.closed = true; this.observers.delete(record); } }) as unknown as RegionObserverFunction;
    Object.defineProperties(unsubscribe, {closed: {get: () => record.closed, enumerable: true}, unsubscribe: {value: unsubscribe, enumerable: true}});
    return unsubscribe;
  }

  history(): readonly RegionHistoryEntry[] { return this.entries; }
  export(): RegionDocument { return exportRegionDocument(this.snapshotValue(), this.entries); }

  revoke(reason?: string): boolean {
    if (this.status !== 'active') return false;
    if (reason !== undefined && !validText(reason)) throw new TypeError('The revocation reason is not bounded.');
    this.epoch++;
    this.status = 'revoked';
    this.abortPendingAuthorizations();
    this.state = undefined;
    this.readSet = undefined;
    for (const record of this.staged.values()) record.consumed = true;
    for (const record of this.inFlight) record.consumed = true;
    for (const record of this.staged.values()) releaseLeases(record.resultLeases);
    for (const record of this.inFlight) releaseLeases(record.resultLeases);
    this.staged.clear();
    this.inFlight.clear();
    this.stagedBytes = 0;
    releaseLeases(this.currentResultLeases);
    this.currentResultLeases = Object.freeze([]);
    this.entries = Object.freeze([]) as unknown as RegionHistoryEntry[];
    const observers = [...this.observers];
    this.observers.clear();
    this.notify(frozen({kind: 'revoke', snapshot: this.snapshotValue(), ...(reason === undefined ? {} : {reason})}), undefined, observers);
    for (const observer of observers) observer.closed = true;
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.epoch++;
    this.disposed = true;
    this.status = 'disposed';
    this.abortPendingAuthorizations();
    this.state = undefined;
    this.readSet = undefined;
    for (const record of this.staged.values()) record.consumed = true;
    for (const record of this.inFlight) record.consumed = true;
    for (const record of this.staged.values()) releaseLeases(record.resultLeases);
    for (const record of this.inFlight) releaseLeases(record.resultLeases);
    this.staged.clear();
    this.inFlight.clear();
    this.stagedBytes = 0;
    releaseLeases(this.currentResultLeases);
    this.currentResultLeases = Object.freeze([]);
    this.entries = Object.freeze([]) as unknown as RegionHistoryEntry[];
    this.queue.close();
    const observers = [...this.observers];
    this.observers.clear();
    this.notify(frozen({kind: 'dispose', snapshot: this.snapshotValue()}), undefined, observers);
    for (const observer of observers) observer.closed = true;
    this.store.remove(this.id);
  }
}

export class RegionStoreImpl implements RegionStore {
  private readonly regions = new Map<string, RegionHandleImpl>();
  private readonly maxRegions: number;
  private readonly maxHistory: number;
  private readonly maxQueuedCommands: number;
  private readonly maxStagedCommits: number;
  private readonly maxStagedBytes: number;
  private readonly maxCommitAuthorizationMilliseconds: number;
  private readonly maxRestoreMilliseconds: number;
  private readonly now: () => number;
  private readonly readAuthority: ReadAuthority;
  private readonly authorizeCommit: AuthorizeRegionCommit;
  private readonly restoreRegion: RestoreRegion | undefined;
  private readonly authorityConfigured: boolean;
  private readonly authorizationConfigured: boolean;
  private disposed = false;
  private epoch = 0;
  private readonly restoreControllers = new Set<AbortController>();
  private pendingRestores = 0;

  constructor(options: RegionStoreOptions) {
    this.maxRegions = options?.maxRegions ?? 128;
    this.maxHistory = options?.maxHistory ?? 64;
    this.maxQueuedCommands = options?.maxQueuedCommands ?? 64;
    this.maxStagedCommits = options?.maxStagedCommits ?? 128;
    this.maxStagedBytes = options?.maxStagedBytes ?? WIRE_LIMITS.bytes;
    this.maxCommitAuthorizationMilliseconds = options?.maxCommitAuthorizationMilliseconds ?? DEFAULT_COMMIT_AUTHORIZATION_MILLISECONDS;
    this.maxRestoreMilliseconds = options?.maxRestoreMilliseconds ?? DEFAULT_COMMIT_AUTHORIZATION_MILLISECONDS;
    this.now = options?.now ?? (() => Date.now());
    this.authorityConfigured = typeof options?.readAuthority === 'function';
    this.authorizationConfigured = typeof options?.authorizeCommit === 'function';
    this.restoreRegion = typeof options?.restoreRegion === 'function' ? options.restoreRegion : undefined;
    this.readAuthority = this.authorityConfigured ? options.readAuthority : (() => failure('runtime.region-denied', FAILURE.denied));
    this.authorizeCommit = this.authorizationConfigured ? options.authorizeCommit : (() => failure('runtime.region-denied', FAILURE.denied));
    if (!Number.isSafeInteger(this.maxRegions) || this.maxRegions < 1 || this.maxRegions > 10_000) throw new TypeError('maxRegions must be a bounded positive safe integer.');
    if (!Number.isSafeInteger(this.maxHistory) || this.maxHistory < 1 || this.maxHistory > WIRE_LIMITS.array) throw new TypeError('maxHistory must be a bounded positive safe integer.');
    if (!Number.isSafeInteger(this.maxQueuedCommands) || this.maxQueuedCommands < 1 || this.maxQueuedCommands > 10_000) throw new TypeError('maxQueuedCommands must be a bounded positive safe integer.');
    if (!Number.isSafeInteger(this.maxStagedCommits) || this.maxStagedCommits < 1 || this.maxStagedCommits > 10_000) throw new TypeError('maxStagedCommits must be a bounded positive safe integer.');
    if (!Number.isSafeInteger(this.maxStagedBytes) || this.maxStagedBytes < 1 || this.maxStagedBytes > WIRE_LIMITS.bytes) throw new TypeError('maxStagedBytes must be a bounded positive safe integer.');
    if (!Number.isSafeInteger(this.maxCommitAuthorizationMilliseconds) || this.maxCommitAuthorizationMilliseconds < 1 || this.maxCommitAuthorizationMilliseconds > MAX_COMMIT_AUTHORIZATION_MILLISECONDS)
      throw new TypeError('maxCommitAuthorizationMilliseconds must be a bounded positive duration.');
    if (!Number.isSafeInteger(this.maxRestoreMilliseconds) || this.maxRestoreMilliseconds < 1 || this.maxRestoreMilliseconds > MAX_COMMIT_AUTHORIZATION_MILLISECONDS)
      throw new TypeError('maxRestoreMilliseconds must be a bounded positive duration.');
  }

  remove(id: string): void { this.regions.delete(id); }

  private authority(id: string, expectedEpoch = this.epoch): RegionOutcome<RegionAuthority> {
    if (!this.authorityConfigured) return failure('runtime.region-denied', FAILURE.denied);
    try {
      const result = this.readAuthority(id);
      if (expectedEpoch !== this.epoch || this.disposed) return failure('runtime.region-disposed', FAILURE.disposed);
      const normalized = normalizeHostOutcome<RegionAuthority>(result);
      if (expectedEpoch !== this.epoch || this.disposed) return failure('runtime.region-disposed', FAILURE.disposed);
      if (!normalized.ok) return normalized as RegionOutcome<RegionAuthority>;
      return validateAuthority(normalized.value);
    } catch {
      if (expectedEpoch !== this.epoch || this.disposed) return failure('runtime.region-disposed', FAILURE.disposed);
      return failure('runtime.region-denied', FAILURE.denied);
    }
  }

  private restoreWithDeadline(
    document: RegionDocument,
    authority: RegionAuthority,
    expectedEpoch: number,
  ): Promise<RegionOutcome<RegionRestoreMaterialization>> {
    const restoreRegion = this.restoreRegion;
    if (restoreRegion === undefined) return Promise.resolve(failure('runtime.region-denied', 'Restoring a region requires a host requery callback.'));
    if (expectedEpoch !== this.epoch || this.disposed) return Promise.resolve(failure('runtime.region-disposed', FAILURE.disposed));
    const controller = new AbortController();
    this.restoreControllers.add(controller);
    let timedOut = false;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let resolveResult: (result: RegionOutcome<RegionRestoreMaterialization>) => void = () => {};
    const finish = (result: RegionOutcome<RegionRestoreMaterialization>): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      controller.signal.removeEventListener('abort', onAbort);
      this.restoreControllers.delete(controller);
      resolveResult(result);
    };
    const onAbort = (): void => {
      finish(timedOut ? failure('runtime.region-budget', 'The host restore/requery exceeded its bounded time budget.') : failure('runtime.region-disposed', FAILURE.disposed));
    };
    const result = new Promise<RegionOutcome<RegionRestoreMaterialization>>((resolve) => { resolveResult = resolve; });
    controller.signal.addEventListener('abort', onAbort, {once: true});
    timer = setTimeout(() => { timedOut = true; controller.abort(); }, Math.min(this.maxRestoreMilliseconds, 2_147_483_647));
    let pending: Promise<RegionOutcome<RegionRestoreMaterialization>>;
    try {
      pending = Promise.resolve(restoreRegion({regionId: document.id, document, authority, signal: controller.signal}));
    } catch {
      finish(failure('runtime.region-denied', FAILURE.denied));
      return result;
    }
    pending.then((value) => {
      try {
        if (timedOut || settled) return;
        if (expectedEpoch !== this.epoch || this.disposed) { finish(failure('runtime.region-disposed', FAILURE.disposed)); return; }
        const normalized = normalizeHostOutcome<RegionRestoreMaterialization>(value);
        if (expectedEpoch !== this.epoch || this.disposed) { finish(failure('runtime.region-disposed', FAILURE.disposed)); return; }
        if (!normalized.ok) { finish(normalized); return; }
        finish(validateRestoreMaterialization(normalized.value));
      } catch {
        finish(failure('runtime.region-denied', FAILURE.denied));
      }
    }, () => finish(failure('runtime.region-denied', FAILURE.denied)));
    return result;
  }

  private abortPendingRestores(): void {
    for (const controller of [...this.restoreControllers]) {
      try { controller.abort(); } catch { /* cancellation is best effort for host code */ }
    }
  }

  private createInternal(input: RegionCreateInput, authority: RegionAuthority, seed?: {readonly taskRevision: string; readonly regionRevision: string; readonly dataRevision: number; readonly history: readonly RegionHistoryEntry[]}, initialResultLeases: readonly OwnedResultLease[] = [], reservedRestore = false): RegionOutcome<RegionHandle> {
    if (this.disposed) return failure('runtime.region-disposed', FAILURE.disposed);
    if (this.regions.has(input.id)) return failure('runtime.region-invalid', 'A region with this stable ID already exists.');
    const otherPendingRestores = this.pendingRestores - (reservedRestore ? 1 : 0);
    if (this.regions.size + otherPendingRestores >= this.maxRegions) return failure('runtime.region-budget', FAILURE.budget);
    const maxHistory = input.maxHistory ?? this.maxHistory;
    if (!Number.isSafeInteger(maxHistory) || maxHistory < 1 || maxHistory > WIRE_LIMITS.array) return failure('runtime.region-budget', FAILURE.budget);
    try {
      const options = {maxHistory, maxQueuedCommands: this.maxQueuedCommands, maxStagedCommits: this.maxStagedCommits, maxStagedBytes: this.maxStagedBytes, maxCommitAuthorizationMilliseconds: this.maxCommitAuthorizationMilliseconds, now: this.now, readAuthority: this.readAuthority, authorizeCommit: this.authorizeCommit, authorizationConfigured: this.authorizationConfigured};
      const handle = new RegionHandleImpl(this, input, options, {authority, taskRevision: seed?.taskRevision ?? input.state.task.revision, regionRevision: seed?.regionRevision ?? newRegionRevision(), dataRevision: seed?.dataRevision ?? 0, history: seed?.history ?? []});
      // Construction can invoke the injected clock, so recheck admission before
      // transferring caller-owned leases into the handle.
      if (this.disposed) { handle.dispose(); return failure('runtime.region-disposed', FAILURE.disposed); }
      const duplicate = this.regions.has(input.id);
      const otherPendingRestoresAfterConstruction = this.pendingRestores - (reservedRestore ? 1 : 0);
      if (duplicate || this.regions.size + otherPendingRestoresAfterConstruction >= this.maxRegions) {
        handle.dispose();
        return failure(duplicate ? 'runtime.region-invalid' : 'runtime.region-budget', duplicate ? 'A region with this stable ID already exists.' : FAILURE.budget);
      }
      handle.adoptInitialResultLeases(initialResultLeases);
      this.regions.set(input.id, handle);
      return {ok: true, value: handle};
    } catch (error) { return failure('runtime.region-invalid', error instanceof Error ? error.message : FAILURE.invalid); }
  }

  create(input: RegionCreateInput): RegionOutcome<RegionHandle> {
    if (this.disposed) return failure('runtime.region-disposed', FAILURE.disposed);
    if (!this.authorizationConfigured) return failure('runtime.region-denied', FAILURE.denied);
    if (input === null || typeof input !== 'object' || !validId(input.id)) return failure('runtime.region-invalid', FAILURE.invalid);
    if (!Object.hasOwn(input, 'state')) return failure('runtime.region-invalid', 'A region requires canonical initial state.');
    if (this.regions.has(input.id)) return failure('runtime.region-invalid', 'A region with this stable ID already exists.');
    if (this.regions.size + this.pendingRestores >= this.maxRegions) return failure('runtime.region-budget', FAILURE.budget);
    const state = validateState(input.state, input.id);
    if (!state.ok) return state;
    const authority = this.authority(input.id);
    if (!authority.ok) return authority as RegionOutcome<RegionHandle>;
    if (state.value.task.catalogRevision !== authority.value.catalogRevision || state.value.task.functionRegistryDigest !== authority.value.functionRegistryDigest)
      return failure('runtime.region-stale', 'The initial Task is bound to a different catalog or function registry.');
    const incarnation = newRegionRevision();
    const initialReadSet = authorityReadSet(authority.value, state.value.task.revision, incarnation, 0);
    const binding = bindCandidateToReadSet(state.value, initialReadSet);
    if (!binding.ok) return binding as RegionOutcome<RegionHandle>;
    const required = validateCommitReadSet(stripData(initialReadSet), stripData(initialReadSet), requiredResultReferences(state.value));
    if (!required.ok) return failure('runtime.region-stale', required.diagnostics[0]!.message);
    return this.createInternal({...input, state: state.value}, authority.value, {
      taskRevision: state.value.task.revision,
      regionRevision: incarnation,
      dataRevision: 0,
      history: [],
    });
  }

  async restore(documentInput: unknown): Promise<RegionOutcome<RegionHandle>> {
    const restoreEpoch = this.epoch;
    if (this.disposed) return failure('runtime.region-disposed', FAILURE.disposed);
    if (!this.authorizationConfigured) return failure('runtime.region-denied', FAILURE.denied);
    if (this.restoreRegion === undefined) return failure('runtime.region-denied', 'Restoring a region requires a host requery callback.');
    const document = parseRegionDocument(documentInput as RegionDocument | string);
    if (!document.ok) return document;
    if (this.regions.has(document.value.id)) return failure('runtime.region-invalid', 'A region with this stable ID already exists.');
    if (this.regions.size + this.pendingRestores >= this.maxRegions) return failure('runtime.region-budget', FAILURE.budget);
    this.pendingRestores++;
    try {
      const authority = this.authority(document.value.id, restoreEpoch);
      if (!authority.ok) return authority as RegionOutcome<RegionHandle>;
      if (document.value.task.catalogRevision !== authority.value.catalogRevision || document.value.task.functionRegistryDigest !== authority.value.functionRegistryDigest)
        return failure('runtime.region-stale', 'The persisted Task is bound to a different catalog or function registry.');
      const materialization = await this.restoreWithDeadline(document.value, authority.value, restoreEpoch);
      if (!materialization.ok) return materialization as RegionOutcome<RegionHandle>;
      if (restoreEpoch !== this.epoch || this.disposed) return failure('runtime.region-disposed', FAILURE.disposed);
      const checked = validateState(materialization.value.state, document.value.id);
      if (!checked.ok) return checked;
      if (checked.value.task.id !== document.value.task.id) return failure('runtime.region-stale', 'The restored Task does not match the persisted Task identity.');
      const freshAuthority = this.authority(document.value.id, restoreEpoch);
      if (!freshAuthority.ok) return freshAuthority as RegionOutcome<RegionHandle>;
      if (freshAuthority.value.principalKey !== authority.value.principalKey || freshAuthority.value.scopeDigest !== authority.value.scopeDigest ||
          freshAuthority.value.policyRevision !== authority.value.policyRevision || freshAuthority.value.catalogRevision !== authority.value.catalogRevision ||
          freshAuthority.value.experienceRevision !== authority.value.experienceRevision || freshAuthority.value.functionRegistryDigest !== authority.value.functionRegistryDigest)
        return failure('runtime.region-stale', 'The host authorization changed while restoring the region.');
      if (checked.value.task.catalogRevision !== freshAuthority.value.catalogRevision || checked.value.task.functionRegistryDigest !== freshAuthority.value.functionRegistryDigest)
        return failure('runtime.region-stale', 'The restored Task is bound to a different catalog or function registry.');
      const incarnation = newRegionRevision();
      const freshReadSet = authorityReadSet(freshAuthority.value, checked.value.task.revision, incarnation, 0);
      const binding = bindCandidateToReadSet(checked.value, freshReadSet);
      if (!binding.ok) return binding as RegionOutcome<RegionHandle>;
      const handles = materialization.value.resultHandles ?? [];
      if (!Array.isArray(handles) || handles.length > WIRE_LIMITS.array) return failure('runtime.region-budget', FAILURE.budget);
      const leases: OwnedResultLease[] = [];
      const required = [...requiredResultReferences(checked.value)];
      for (const handle of handles) {
        const ref = resultRefFromHandle(handle);
        if (!ref.ok) { releaseLeases(leases); return ref as RegionOutcome<RegionHandle>; }
        if (restoreEpoch !== this.epoch || this.disposed) { releaseLeases(leases); return failure('runtime.region-disposed', FAILURE.disposed); }
        const bindingForHandle = bindResultHandleToAuthority(handle, freshAuthority.value);
        if (!bindingForHandle.ok) { releaseLeases(leases); return bindingForHandle as RegionOutcome<RegionHandle>; }
        const lease = retainResultHandle(handle);
        if (!lease.ok) { releaseLeases(leases); return lease as RegionOutcome<RegionHandle>; }
        leases.push({ref: ref.value, lease: lease.value});
        required.push(ref.value);
      }
      const actual = authorityReadSet(freshAuthority.value, checked.value.task.revision, incarnation, 0);
      const readCheck = validateCommitReadSet(stripData(freshReadSet), stripData(actual), required);
      if (!readCheck.ok) { releaseLeases(leases); return failure('runtime.region-stale', readCheck.diagnostics[0]!.message); }
      const finalState = validateState(checked.value, document.value.id);
      if (!finalState.ok) { releaseLeases(leases); return finalState; }
      if (restoreEpoch !== this.epoch || this.disposed) { releaseLeases(leases); return failure('runtime.region-disposed', FAILURE.disposed); }
      if (this.regions.has(document.value.id)) { releaseLeases(leases); return failure('runtime.region-invalid', 'A region with this stable ID already exists.'); }
      // A restored session starts with a fresh materialization and a fresh history;
      // persisted history remains metadata for the document, never live state.
      const created = this.createInternal({id: document.value.id, state: finalState.value}, freshAuthority.value, {
        taskRevision: finalState.value.task.revision,
        regionRevision: incarnation,
        dataRevision: 0,
        history: [],
      }, leases, true);
      if (!created.ok) releaseLeases(leases);
      return created;
    } finally {
      this.pendingRestores--;
    }
  }

  get(id: string): RegionHandle | undefined { return this.regions.get(id); }
  revoke(id: string, reason?: string): boolean { return this.regions.get(id)?.revoke(reason) ?? false; }
  dispose(): void {
    if (this.disposed) return;
    this.epoch++;
    this.disposed = true;
    this.abortPendingRestores();
    for (const region of [...this.regions.values()]) region.dispose();
    this.regions.clear();
  }
}

export function createRegionStore(options: RegionStoreOptions): RegionStore { return new RegionStoreImpl(options); }
