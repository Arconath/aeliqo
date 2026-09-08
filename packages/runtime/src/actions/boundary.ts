import {parseContract, parseWireValue, WIRE_LIMITS} from '@aeliqo/core';
import type {Contract, Diagnostic, Outcome, Scalar, VersionRef} from '@aeliqo/core';
import {resolveRegisteredAction} from './registry.js';
import type {
  ActionBoundaryOptions,
  ActionDispatchResult,
  ActionEntity,
  ActionFailure,
  ActionHistoryEntry,
  ActionInspection,
  ActionOutcome,
  ActionPayload,
  ActionPort,
  ActionPreview,
  ActionReceipt,
  ActionRegistration,
  ActionRequest,
  ActionExecution,
  ActionGrant,
  TrustedActionContext,
} from './types.js';

const DEFAULTS = Object.freeze({previews: 128, pending: 128, history: 256, idempotency: 512, inputBytes: 256 * 1024, callbackMilliseconds: 30_000, inFlight: 16});
const MAX_CALLBACK_MS = 86_400_000;
const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= WIRE_LIMITS.id && !/[\s\u0000-\u001f\u007f]/u.test(value);
const validText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= WIRE_LIMITS.text;
const validKey = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= WIRE_LIMITS.text;
const validRef = (value: unknown): value is VersionRef => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value as object).length === 2 && validId((value as Record<string, unknown>).id) && validId((value as Record<string, unknown>).revision);
const sameRef = (left: VersionRef, right: VersionRef): boolean => left.id === right.id && left.revision === right.revision;
const failure = <T>(code: string, message: string, path: readonly (string | number)[] = []): ActionOutcome<T> => ({ok: false, diagnostics: [{code, message, path, retryable: false}]});
const diagnostic = (code: string, message: string): ActionFailure => ({code, message, retryable: false});

function frozen<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) { for (const child of value) frozen(child); return Object.freeze(value); }
  for (const child of Object.values(value as Record<string, unknown>)) frozen(child);
  return Object.freeze(value);
}

function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

function bytes(value: string): number { return new TextEncoder().encode(value).byteLength; }

function cloneRef(value: VersionRef): VersionRef { return Object.freeze({id: value.id, revision: value.revision}); }

function scalar(value: unknown): Scalar | undefined {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') return value.length <= WIRE_LIMITS.text ? value : undefined;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || typeof record.decimal !== 'string' ||
      !/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(record.decimal) || record.decimal.length > 512) return undefined;
  return Object.freeze({decimal: record.decimal});
}

function payload(value: unknown, path: readonly (string | number)[] = ['input']): ActionOutcome<ActionPayload> {
  const inspected = parseWireValue(value);
  if (!inspected.ok) return inspected as ActionOutcome<ActionPayload>;
  if (inspected.value === null || typeof inspected.value !== 'object' || Array.isArray(inspected.value)) return failure('action.invalid', 'Action input must be a bounded scalar object.', path);
  const record = inspected.value as Record<string, unknown>;
  const normalized: Record<string, Scalar> = {};
  for (const key of Object.keys(record)) {
    if (!validId(key)) return failure('action.invalid', 'Action input contains an invalid field key.', [...path, key]);
    const value = scalar(record[key]);
    if (value === undefined) return failure('action.invalid', 'Action input fields must be bounded scalar values.', [...path, key]);
    normalized[key] = value;
  }
  return {ok: true, value: frozen(normalized)};
}

function entity(value: unknown): ActionOutcome<ActionEntity | undefined> {
  if (value === undefined) return {ok: true, value: undefined};
  const inspected = parseWireValue(value);
  if (!inspected.ok) return inspected as ActionOutcome<ActionEntity | undefined>;
  if (inspected.value === null || typeof inspected.value !== 'object' || Array.isArray(inspected.value)) return failure('action.invalid', 'The entity binding must be an object.');
  const record = inspected.value as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || !validKey(record.key) || !validId(record.revision)) return failure('action.invalid', 'The entity binding requires a bounded key and revision.');
  return {ok: true, value: frozen({key: record.key, revision: record.revision})};
}

interface ParsedRequest {readonly requestId: string; readonly action: VersionRef; readonly input: ActionPayload; readonly entity?: ActionEntity; readonly idempotencyKey?: string;}

function request(value: unknown): ActionOutcome<ParsedRequest> {
  const inspected = parseWireValue(value);
  if (!inspected.ok) return inspected as ActionOutcome<ParsedRequest>;
  if (inspected.value === null || typeof inspected.value !== 'object' || Array.isArray(inspected.value)) return failure('action.invalid', 'An action request must be a bounded object.');
  const record = inspected.value as Record<string, unknown>;
  const allowed = ['requestId', 'action', 'input', 'entity', 'idempotencyKey'];
  if (Object.keys(record).some((key) => !allowed.includes(key)) || !validId(record.requestId) || !validRef(record.action)) return failure('action.invalid', 'The action request contains an unknown field or invalid identity.');
  const input = payload(record.input); if (!input.ok) return input;
  const boundEntity = entity(record.entity); if (!boundEntity.ok) return boundEntity;
  if (record.idempotencyKey !== undefined && !validId(record.idempotencyKey)) return failure('action.invalid', 'The idempotency key is not a bounded identifier.', ['idempotencyKey']);
  return {ok: true, value: frozen({requestId: record.requestId, action: cloneRef(record.action), input: input.value,
    ...(boundEntity.value === undefined ? {} : {entity: boundEntity.value}), ...(record.idempotencyKey === undefined ? {} : {idempotencyKey: record.idempotencyKey})})};
}

function grantsInclude(context: TrustedActionContext, grant: ActionGrant): boolean { return context.grants.includes(grant); }

function context(value: unknown): ActionOutcome<TrustedActionContext> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return failure('action.denied', 'The host action context is unavailable.');
  const record = value as Record<string, unknown>;
  const allowed = ['principalKey', 'actorKey', 'scopeDigest', 'policyRevision', 'domainRevision', 'confirmationEpoch', 'grants', 'entityRevisions'];
  if (Object.keys(record).some((key) => !allowed.includes(key)) ||
      !validId(record.principalKey) || !validId(record.actorKey) || !validId(record.scopeDigest) ||
      !validId(record.policyRevision) || !validId(record.domainRevision) || !validId(record.confirmationEpoch) ||
      !Array.isArray(record.grants) || record.grants.some((grant) => grant !== 'action.propose' && grant !== 'action.execute'))
    return failure('action.denied', 'The host action context is malformed.');
  const grants = [...new Set(record.grants as ActionGrant[])];
  let entityRevisions: Readonly<Record<string, string>> | undefined;
  if (record.entityRevisions !== undefined) {
    if (record.entityRevisions === null || typeof record.entityRevisions !== 'object' || Array.isArray(record.entityRevisions)) return failure('action.denied', 'The host entity revision map is malformed.');
    const map = record.entityRevisions as Record<string, unknown>;
    if (Object.keys(map).length > WIRE_LIMITS.properties || Object.keys(map).some((key) => !validKey(key) || !validId(map[key]))) return failure('action.denied', 'The host entity revision map is malformed.');
    entityRevisions = frozen(Object.fromEntries(Object.entries(map).map(([key, revision]) => [key, revision as string])));
  }
  return {ok: true, value: frozen({principalKey: record.principalKey, actorKey: record.actorKey, scopeDigest: record.scopeDigest,
    policyRevision: record.policyRevision, domainRevision: record.domainRevision, confirmationEpoch: record.confirmationEpoch,
    grants, ...(entityRevisions === undefined ? {} : {entityRevisions})})};
}

function sameContext(left: TrustedActionContext, right: TrustedActionContext): boolean {
  if (left.principalKey !== right.principalKey || left.actorKey !== right.actorKey || left.scopeDigest !== right.scopeDigest ||
      left.policyRevision !== right.policyRevision || left.domainRevision !== right.domainRevision || left.confirmationEpoch !== right.confirmationEpoch) return false;
  return true;
}

function normalizeOutcome<T>(value: unknown): Outcome<T> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || typeof (value as Record<string, unknown>).ok !== 'boolean') return undefined;
  const record = value as Record<string, unknown>;
  if (record.ok === true && Object.hasOwn(record, 'value')) return {ok: true, value: record.value as T};
  if (record.ok === false && Array.isArray(record.diagnostics) && record.diagnostics.length > 0) return {ok: false, diagnostics: record.diagnostics as never};
  return undefined;
}

type HostCall<T> = {readonly state: 'completed'; readonly value: T} | {readonly state: 'cancelled' | 'timeout' | 'lifecycle'};

interface ActiveCall {abort(state: 'cancelled' | 'lifecycle'): void;}

interface PreviewRecord {
  readonly id: string;
  readonly requestId: string;
  readonly registration: ActionRegistration;
  readonly preview: ActionPreview;
  input: ActionPayload | undefined;
  readonly inputIdentity: string;
  readonly context: TrustedActionContext;
  consumed: boolean;
  confirming: boolean;
}

interface ReceiptRecord {
  readonly id: string;
  readonly previewId: string;
  readonly registration: ActionRegistration;
  readonly receipt: ActionReceipt;
  input: ActionPayload | undefined;
  readonly inputIdentity: string;
  readonly entity?: ActionEntity;
  readonly idempotencyKey?: string;
  readonly context: TrustedActionContext;
  consumed: boolean;
  executing: boolean;
}

type LedgerRecord = {
  readonly key: string;
  readonly identity: string;
  readonly action: VersionRef;
  readonly receiptId: string;
  readonly at: number;
  state: 'in-flight' | 'executed' | 'ambiguous' | 'rejected';
  output?: ActionPayload;
  reason?: string;
  diagnostics?: readonly [ActionFailure, ...ActionFailure[]];
};

function copyDiagnostics(value: readonly Diagnostic[]): readonly [ActionFailure, ...ActionFailure[]] {
  const items = Array.isArray(value) ? value.slice(0, WIRE_LIMITS.diagnostics) : [];
  const normalized = items.map((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return diagnostic('action.callback', 'The host action was rejected.');
    const candidate = item as Record<string, unknown>;
    const code = typeof candidate.code === 'string' && validId(candidate.code) ? candidate.code : 'action.callback';
    const message = typeof candidate.message === 'string' && candidate.message.length > 0 && candidate.message.length <= WIRE_LIMITS.label ? candidate.message : 'The host action was rejected.';
    const path = Array.isArray(candidate.path) ? candidate.path.slice(0, WIRE_LIMITS.depth).filter((part): part is string | number =>
      (typeof part === 'string' && validId(part)) || (typeof part === 'number' && Number.isSafeInteger(part) && part >= 0)) : undefined;
    return {code, message, ...(path === undefined || path.length === 0 ? {} : {path}), retryable: candidate.retryable === true} as ActionFailure;
  });
  return Object.freeze((normalized.length > 0 ? normalized : [diagnostic('action.callback', 'The host action was rejected.')])) as readonly [ActionFailure, ...ActionFailure[]];
}

function normalizeDispatch(value: unknown): ActionDispatchResult | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record.state === 'completed' && Object.hasOwn(record, 'output')) return {state: 'completed', output: record.output};
  if (record.state === 'ambiguous' && validText(record.reason)) return {state: 'ambiguous', reason: record.reason};
  if (record.state === 'rejected' && Array.isArray(record.diagnostics) && record.diagnostics.length > 0)
    return {state: 'rejected', diagnostics: copyDiagnostics(record.diagnostics as Diagnostic[])};
  return undefined;
}

class ActionPortImpl implements ActionPort {
  private readonly host: ActionBoundaryOptions['host'];
  private readonly registry: ActionBoundaryOptions['registry'];
  private readonly maxPreviews: number;
  private readonly maxPending: number;
  private readonly maxHistory: number;
  private readonly maxIdempotencyEntries: number;
  private readonly maxInputBytes: number;
  private readonly maxCallbackMilliseconds: number;
  private readonly maxInFlight: number;
  private readonly now: () => number;
  private readonly previews = new Map<string, PreviewRecord>();
  private readonly receipts = new Map<string, ReceiptRecord>();
  private readonly idempotency = new Map<string, LedgerRecord>();
  private readonly activeCalls = new Set<ActiveCall>();
  private readonly historyEntries: ActionHistoryEntry[] = [];
  private sequence = 0;
  private epoch = 0;
  private status: 'active' | 'revoked' | 'disposed' = 'active';

  constructor(options: ActionBoundaryOptions) {
    this.host = options.host;
    this.registry = options.registry;
    this.maxPreviews = bounded(options.maxPreviews ?? DEFAULTS.previews, 1, WIRE_LIMITS.array, 'maxPreviews');
    this.maxPending = bounded(options.maxPending ?? DEFAULTS.pending, 1, WIRE_LIMITS.array, 'maxPending');
    this.maxHistory = bounded(options.maxHistory ?? DEFAULTS.history, 1, WIRE_LIMITS.array, 'maxHistory');
    this.maxIdempotencyEntries = bounded(options.maxIdempotencyEntries ?? DEFAULTS.idempotency, 1, WIRE_LIMITS.array, 'maxIdempotencyEntries');
    this.maxInputBytes = bounded(options.maxInputBytes ?? DEFAULTS.inputBytes, 1, WIRE_LIMITS.bytes, 'maxInputBytes');
    this.maxCallbackMilliseconds = bounded(options.maxCallbackMilliseconds ?? DEFAULTS.callbackMilliseconds, 1, MAX_CALLBACK_MS, 'maxCallbackMilliseconds');
    this.maxInFlight = bounded(options.maxInFlight ?? DEFAULTS.inFlight, 1, WIRE_LIMITS.array, 'maxInFlight');
    this.now = options.now ?? (() => Date.now());
    if (typeof options.host?.readContext !== 'function') throw new TypeError('An action host context callback is required.');
    if (typeof this.now !== 'function') throw new TypeError('now must be a function.');
  }

  private outcome<T>(code: string, message: string, path: readonly (string | number)[] = []): ActionOutcome<T> { return failure(code, message, path); }
  private lifecycle<T>(): ActionOutcome<T> { return this.status === 'disposed' ? this.outcome('action.disposed', 'The action port has been disposed.') : this.outcome('action.revoked', 'The action port has been revoked.'); }
  private live(): boolean { return this.status === 'active'; }

  private addHistory(entry: ActionHistoryEntry): void {
    this.historyEntries.push(frozen(entry));
    if (this.historyEntries.length > this.maxHistory) this.historyEntries.splice(0, this.historyEntries.length - this.maxHistory);
  }

  private nextId(prefix: string): string { this.sequence = this.sequence >= Number.MAX_SAFE_INTEGER ? 1 : this.sequence + 1; return `${prefix}-${this.sequence}`.slice(0, WIRE_LIMITS.id); }

  private async callHost<T>(callback: (signal: AbortSignal) => T | Promise<T>, signal: AbortSignal | undefined): Promise<HostCall<T>> {
    if (!this.live()) return {state: 'lifecycle'};
    if (signal?.aborted) return {state: 'cancelled'};
    const controller = new AbortController();
    let finished = false;
    let stop: (state: 'cancelled' | 'timeout' | 'lifecycle') => void = () => {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    const call = new Promise<HostCall<T>>((resolve) => {
      const finish = (result: HostCall<T>): void => {
        if (finished) return;
        finished = true;
        if (timer !== undefined) clearTimeout(timer);
        signal?.removeEventListener('abort', onCallerAbort);
        this.activeCalls.delete(active);
        resolve(result);
      };
      const onCallerAbort = (): void => { stop('cancelled'); };
      const active: ActiveCall = {abort: (state) => stop(state)};
      stop = (state): void => { if (finished) return; controller.abort(); finish({state}); };
      this.activeCalls.add(active);
      signal?.addEventListener('abort', onCallerAbort, {once: true});
      timer = setTimeout(() => stop('timeout'), this.maxCallbackMilliseconds);
      let pending: Promise<T>;
      try { pending = Promise.resolve(callback(controller.signal)); }
      catch { finish({state: 'completed', value: undefined as unknown as T}); return; }
      pending.then((value) => { if (!finished) finish({state: 'completed', value}); }, () => { if (!finished) finish({state: 'completed', value: undefined as unknown as T}); });
    });
    return call;
  }

  private async readContext(signal: AbortSignal | undefined): Promise<ActionOutcome<TrustedActionContext>> {
    const host = await this.callHost((hostSignal) => this.host.readContext({signal: hostSignal}), signal);
    if (host.state !== 'completed') {
      if (host.state === 'lifecycle') return this.lifecycle();
      if (host.state === 'cancelled') return this.outcome('action.cancelled', 'The action context read was cancelled.');
      return this.outcome('action.budget', 'The action context read exceeded its bounded time budget.');
    }
    const outcome = normalizeOutcome<unknown>(host.value);
    if (outcome === undefined || !outcome.ok) return this.outcome('action.denied', 'The host action context could not be authenticated.');
    return context(outcome.value);
  }

  private normalizedInput(registration: ActionRegistration, input: ActionPayload): ActionOutcome<ActionPayload> {
    let parsed: Outcome<unknown> | undefined;
    try { parsed = registration.inputSchema.parse(input); } catch { return this.outcome('action.invalid', 'The action input does not satisfy its registered schema.'); }
    const outcome = normalizeOutcome<unknown>(parsed);
    if (outcome === undefined || !outcome.ok) return this.outcome('action.invalid', 'The action input does not satisfy its registered schema.');
    const checked = payload(outcome.value);
    if (!checked.ok) return checked;
    if (bytes(canonical(checked.value)) > this.maxInputBytes) return this.outcome('action.budget', 'The action input exceeds its bounded resource budget.');
    return checked;
  }

  private idempotencyIdentity(registration: ActionRegistration, input: ActionPayload, entityValue: ActionEntity | undefined, key: string): string {
    return canonical({key, action: registration.descriptor.ref, input, ...(entityValue === undefined ? {} : {entity: entityValue}), inputSchema: registration.descriptor.input, outputSchema: registration.descriptor.output});
  }

  async preview(raw: unknown, options: {readonly signal?: AbortSignal} = {}): Promise<ActionOutcome<ActionPreview>> {
    if (!this.live()) return this.lifecycle();
    if (this.previews.size >= this.maxPreviews || this.previews.size + this.receipts.size >= this.maxPending) return this.outcome('action.budget', 'The action preview budget is full.');
    const parsed = request(raw); if (!parsed.ok) return parsed;
    const registration = resolveRegisteredAction(this.registry, parsed.value.action);
    if (registration === undefined) return this.outcome('action.unknown', 'The requested action version is not registered.');
    if (registration.descriptor.idempotency === 'required' && parsed.value.idempotencyKey === undefined) return this.outcome('action.invalid', 'This action requires an idempotency key.');
    if (registration.descriptor.entityRevision === 'required' && parsed.value.entity === undefined) return this.outcome('action.invalid', 'This action requires an entity revision.');
    const hostContext = await this.readContext(options.signal);
    if (!hostContext.ok) return hostContext;
    if (!grantsInclude(hostContext.value, 'action.propose')) return this.outcome('action.denied', 'The host did not grant action proposal.');
    if (!this.live()) return this.lifecycle();
    const input = this.normalizedInput(registration, parsed.value.input); if (!input.ok) return input;
    const identity = parsed.value.idempotencyKey === undefined ? undefined : this.idempotencyIdentity(registration, input.value, parsed.value.entity, parsed.value.idempotencyKey);
    const id = this.nextId('preview');
    const preview = frozen({state: 'preview' as const, id, requestId: parsed.value.requestId, action: cloneRef(registration.descriptor.ref),
      descriptor: registration.descriptor, input: input.value, ...(parsed.value.entity === undefined ? {} : {entity: parsed.value.entity}),
      ...(parsed.value.idempotencyKey === undefined ? {} : {idempotencyKey: parsed.value.idempotencyKey}), sideEffect: registration.descriptor.sideEffect,
      confirmation: registration.descriptor.confirmation});
    const record: PreviewRecord = {id, requestId: parsed.value.requestId, registration, preview, input: input.value, inputIdentity: identity ?? '', context: hostContext.value, consumed: false, confirming: false};
    this.previews.set(id, record);
    this.addHistory({state: 'preview', action: cloneRef(registration.descriptor.ref), previewId: id, at: this.now()});
    return {ok: true, value: preview};
  }

  async previewInteraction(input: unknown, options: {readonly signal?: AbortSignal; readonly entity?: ActionEntity; readonly idempotencyKey?: string} = {}): Promise<ActionOutcome<ActionPreview>> {
    const parsed = parseContract('interaction', input);
    if (!parsed.ok) return parsed as ActionOutcome<ActionPreview>;
    const payloadValue = parsed.value.payload;
    if (payloadValue.kind !== 'action-request') return this.outcome('action.invalid', 'The interaction does not contain an action request.');
    return this.preview({requestId: parsed.value.eventId, action: payloadValue.action, input: payloadValue.input, ...(options.entity === undefined ? {} : {entity: options.entity}), ...(options.idempotencyKey === undefined ? {} : {idempotencyKey: options.idempotencyKey})}, options);
  }

  async confirm(preview: ActionPreview, options: {readonly signal?: AbortSignal} = {}): Promise<ActionOutcome<ActionReceipt>> {
    if (!this.live()) return this.lifecycle();
    // Object identity is required. A structurally forged preview is not a proposal token.
    const matched = [...this.previews.values()].find((candidate) => candidate.preview === preview);
    if (matched === undefined || matched.consumed) return this.outcome('action.invalid', 'The action preview token is not recognized.');
    if (matched.confirming) return this.outcome('action.in-flight', 'The action preview is already being confirmed.');
    matched.confirming = true;
    const retry = <T>(result: ActionOutcome<T>): ActionOutcome<T> => {
      if (!matched.consumed) matched.confirming = false;
      return result;
    };
    const current = await this.readContext(options.signal);
    if (!current.ok) return retry(current);
    if (!grantsInclude(current.value, 'action.propose') || !grantsInclude(current.value, 'action.execute')) return retry(this.outcome('action.denied', 'The host did not grant both proposal and execution for confirmation.'));
    if (!sameContext(matched.context, current.value) || resolveRegisteredAction(this.registry, matched.registration.descriptor.ref) !== matched.registration) {
      matched.consumed = true; matched.input = undefined;
      this.previews.delete(matched.id);
      this.addHistory({state: 'rejected', action: cloneRef(matched.registration.descriptor.ref), previewId: matched.id, reasonCode: 'action.stale', at: this.now()});
      return this.outcome('action.stale', 'The action preview is stale against the current host context.');
    }
    if (matched.registration.descriptor.confirmation === 'required') {
      if (this.host.issueConfirmation === undefined) return retry(this.outcome('action.confirmation', 'This action requires a trusted confirmation callback.'));
      const issued = await this.callHost((signal) => this.host.issueConfirmation!({preview: matched.preview, context: current.value, signal}), options.signal);
      if (issued.state !== 'completed') {
        if (issued.state === 'lifecycle') return retry(this.lifecycle());
        if (issued.state === 'cancelled') return retry(this.outcome('action.cancelled', 'The action confirmation was cancelled.'));
        return retry(this.outcome('action.budget', 'The action confirmation exceeded its bounded time budget.'));
      }
      const outcome = normalizeOutcome<unknown>(issued.value);
      if (outcome === undefined || !outcome.ok) return retry(this.outcome('action.confirmation', 'The trusted host did not confirm this action.'));
    }
    const rechecked = await this.readContext(options.signal);
    if (!rechecked.ok) {
      matched.consumed = true;
      matched.input = undefined;
      this.previews.delete(matched.id);
      this.addHistory({state: 'rejected', action: cloneRef(matched.registration.descriptor.ref), previewId: matched.id, reasonCode: 'action.stale', at: this.now()});
      return rechecked;
    }
    if (!grantsInclude(rechecked.value, 'action.execute') || !sameContext(current.value, rechecked.value)) {
      matched.consumed = true;
      matched.input = undefined;
      this.previews.delete(matched.id);
      this.addHistory({state: 'rejected', action: cloneRef(matched.registration.descriptor.ref), previewId: matched.id, reasonCode: 'action.stale', at: this.now()});
      return this.outcome('action.stale', 'The action confirmation context changed before a receipt was issued.');
    }
    if (this.receipts.size >= this.maxPending) return retry(this.outcome('action.budget', 'The pending action receipt budget is full.'));
    matched.consumed = true;
    matched.confirming = false;
    this.previews.delete(matched.id);
    const id = this.nextId('receipt');
    const receipt = frozen({state: 'confirmed' as const, id, previewId: matched.id, action: cloneRef(matched.registration.descriptor.ref), sideEffect: matched.registration.descriptor.sideEffect, confirmation: matched.registration.descriptor.confirmation});
    const receiptRecord: ReceiptRecord = {id, previewId: matched.id, registration: matched.registration, receipt, input: matched.input, inputIdentity: matched.inputIdentity,
      ...(matched.preview.entity === undefined ? {} : {entity: matched.preview.entity}), ...(matched.preview.idempotencyKey === undefined ? {} : {idempotencyKey: matched.preview.idempotencyKey}), context: rechecked.value, consumed: false, executing: false};
    this.receipts.set(id, receiptRecord);
    this.addHistory({state: 'confirmed', action: cloneRef(matched.registration.descriptor.ref), previewId: matched.id, receiptId: id, at: this.now()});
    return {ok: true, value: receipt};
  }

  async execute(receipt: ActionReceipt, options: {readonly signal?: AbortSignal} = {}): Promise<ActionOutcome<ActionExecution>> {
    if (!this.live()) return this.lifecycle();
    const matched = [...this.receipts.values()].find((candidate) => candidate.receipt === receipt);
    if (matched === undefined || matched.consumed || matched.input === undefined) return this.outcome('action.replay', 'The action receipt is unknown or has already been used.');
    if (matched.executing) return this.outcome('action.in-flight', 'The action receipt is already executing.');
    // Consume the one-use execution right before the first asynchronous recheck.
    matched.executing = true;
    const current = await this.readContext(options.signal);
    if (!current.ok) { this.consumeReceipt(matched); return current; }
    if (!grantsInclude(current.value, 'action.execute') || !sameContext(matched.context, current.value) ||
        resolveRegisteredAction(this.registry, matched.registration.descriptor.ref) !== matched.registration || !this.entityCurrent(matched, current.value)) {
      this.consumeReceipt(matched);
      this.addHistory({state: 'rejected', action: cloneRef(matched.registration.descriptor.ref), receiptId: matched.id, reasonCode: 'action.stale', at: this.now()});
      return this.outcome('action.stale', 'The action receipt is stale against current authority or entity revision.');
    }
    if (options.signal?.aborted) { this.consumeReceipt(matched); return this.outcome('action.cancelled', 'The action execution was cancelled before dispatch.'); }
    const key = matched.idempotencyKey;
    const identity = matched.inputIdentity;
    const ledgerKey = key === undefined ? undefined : this.idempotencyKey(current.value, key);
    if (key !== undefined) {
      const existing = this.idempotency.get(ledgerKey!);
      if (existing !== undefined) {
        this.consumeReceipt(matched);
        if (existing.identity !== identity) return this.outcome('action.idempotency', 'The idempotency key was reused with different action identity or input.');
        if (existing.state === 'in-flight') return this.outcome('action.in-flight', 'An action with this idempotency key is already executing.');
        if (existing.state === 'ambiguous') return {ok: true, value: {state: 'ambiguous', receiptId: matched.id, action: cloneRef(existing.action), reason: existing.reason ?? 'The prior action execution is uncertain.'}};
        if (existing.state === 'rejected') return {ok: false, diagnostics: existing.diagnostics ?? [diagnostic('action.callback', 'The prior action execution was rejected.')]};
        if (existing.output === undefined) return this.outcome('action.ambiguous', 'The completed action output is unavailable for safe replay.');
        return {ok: true, value: {state: 'executed', receiptId: matched.id, action: cloneRef(existing.action), output: existing.output}};
      }
      if (this.idempotency.size >= this.maxIdempotencyEntries) { this.consumeReceipt(matched); return this.outcome('action.budget', 'The idempotency ledger is full; no new action is admitted.'); }
      // Reserve synchronously immediately before dispatch; no asynchronous host call occurs after this point.
      this.idempotency.set(ledgerKey!, {key, identity, action: cloneRef(matched.registration.descriptor.ref), receiptId: matched.id, at: this.now(), state: 'in-flight'});
    }
    // A host clock or lifecycle callback may have revoked the port while the reservation was made.
    // Never invoke the domain callback after that synchronous barrier.
    if (!this.live() || matched.input === undefined) {
      this.consumeReceipt(matched);
      return this.lifecycle();
    }
    if (this.activeCalls.size >= this.maxInFlight) {
      if (ledgerKey !== undefined) this.idempotency.delete(ledgerKey);
      this.consumeReceipt(matched);
      return this.outcome('action.budget', 'The action callback budget is full.');
    }
    const input = matched.input;
    const dispatchCall = await this.callHost((signal) => matched.registration.dispatch({descriptor: matched.registration.descriptor, input: input!,
      ...(matched.entity === undefined ? {} : {entity: matched.entity}), ...(matched.idempotencyKey === undefined ? {} : {idempotencyKey: matched.idempotencyKey}), context: current.value, signal}), options.signal);
    if (dispatchCall.state !== 'completed') {
      const reason = dispatchCall.state === 'timeout' ? 'The action callback exceeded its bounded time budget.' : dispatchCall.state === 'cancelled' ? 'The action callback was cancelled after dispatch.' : 'The action port was revoked or disposed during dispatch.';
      if (ledgerKey !== undefined) { const entry = this.idempotency.get(ledgerKey); if (entry !== undefined) { entry.state = 'ambiguous'; entry.reason = reason; } }
      this.consumeReceipt(matched);
      this.addHistory({state: 'ambiguous', action: cloneRef(matched.registration.descriptor.ref), receiptId: matched.id, reasonCode: 'action.ambiguous', at: this.now()});
      return {ok: true, value: {state: 'ambiguous', receiptId: matched.id, action: cloneRef(matched.registration.descriptor.ref), reason}};
    }
    const dispatch = normalizeDispatch(dispatchCall.value);
    if (dispatch === undefined) {
      const reason = 'The host action returned an invalid result after dispatch.';
      if (ledgerKey !== undefined) { const entry = this.idempotency.get(ledgerKey); if (entry !== undefined) { entry.state = 'ambiguous'; entry.reason = reason; } }
      this.consumeReceipt(matched);
      this.addHistory({state: 'ambiguous', action: cloneRef(matched.registration.descriptor.ref), receiptId: matched.id, reasonCode: 'action.ambiguous', at: this.now()});
      return {ok: true, value: {state: 'ambiguous', receiptId: matched.id, action: cloneRef(matched.registration.descriptor.ref), reason}};
    }
    if (dispatch.state === 'ambiguous') {
      if (ledgerKey !== undefined) { const entry = this.idempotency.get(ledgerKey); if (entry !== undefined) { entry.state = 'ambiguous'; entry.reason = dispatch.reason; } }
      this.consumeReceipt(matched);
      this.addHistory({state: 'ambiguous', action: cloneRef(matched.registration.descriptor.ref), receiptId: matched.id, reasonCode: 'action.ambiguous', at: this.now()});
      return {ok: true, value: {state: 'ambiguous', receiptId: matched.id, action: cloneRef(matched.registration.descriptor.ref), reason: dispatch.reason}};
    }
    if (dispatch.state === 'rejected') {
      const diagnostics = copyDiagnostics(dispatch.diagnostics);
      if (ledgerKey !== undefined) { const entry = this.idempotency.get(ledgerKey); if (entry !== undefined) { entry.state = 'rejected'; entry.diagnostics = diagnostics; } }
      this.consumeReceipt(matched);
      this.addHistory({state: 'rejected', action: cloneRef(matched.registration.descriptor.ref), receiptId: matched.id, reasonCode: 'action.callback', at: this.now()});
      return {ok: false, diagnostics};
    }
    let parsedOutput: Outcome<unknown> | undefined;
    try { parsedOutput = matched.registration.outputSchema.parse(dispatch.output); } catch { parsedOutput = undefined; }
    const output = parsedOutput === undefined ? undefined : normalizeOutcome<unknown>(parsedOutput);
    const checkedOutput = output?.ok ? payload(output.value) : undefined;
    if (checkedOutput === undefined || !checkedOutput.ok) {
      const reason = 'The host action returned an invalid output after dispatch.';
      if (ledgerKey !== undefined) { const entry = this.idempotency.get(ledgerKey); if (entry !== undefined) { entry.state = 'ambiguous'; entry.reason = reason; } }
      this.consumeReceipt(matched);
      this.addHistory({state: 'ambiguous', action: cloneRef(matched.registration.descriptor.ref), receiptId: matched.id, reasonCode: 'action.ambiguous', at: this.now()});
      return {ok: true, value: {state: 'ambiguous', receiptId: matched.id, action: cloneRef(matched.registration.descriptor.ref), reason}};
    }
    if (ledgerKey !== undefined) { const entry = this.idempotency.get(ledgerKey); if (entry !== undefined) { entry.state = 'executed'; entry.output = checkedOutput.value; } }
    this.consumeReceipt(matched);
    this.addHistory({state: 'executed', action: cloneRef(matched.registration.descriptor.ref), receiptId: matched.id, at: this.now()});
    return {ok: true, value: {state: 'executed', receiptId: matched.id, action: cloneRef(matched.registration.descriptor.ref), output: checkedOutput.value}};
  }

  private entityCurrent(record: ReceiptRecord, current: TrustedActionContext): boolean {
    if (record.registration.descriptor.entityRevision === 'none') return true;
    if (record.entity === undefined || current.entityRevisions === undefined) return false;
    return current.entityRevisions[record.entity.key] === record.entity.revision;
  }

  private idempotencyKey(context: TrustedActionContext, key: string): string {
    return canonical({principalKey: context.principalKey, actorKey: context.actorKey, scopeDigest: context.scopeDigest,
      policyRevision: context.policyRevision, domainRevision: context.domainRevision, key});
  }

  private consumeReceipt(record: ReceiptRecord): void {
    if (record.consumed) return;
    record.consumed = true;
    record.executing = false;
    record.input = undefined;
    this.receipts.delete(record.id);
  }

  inspect(idempotencyKey: string): ActionInspection | undefined {
    if (!validId(idempotencyKey)) return undefined;
    let record: LedgerRecord | undefined;
    for (const candidate of this.idempotency.values()) {
      if (candidate.key === idempotencyKey && (record === undefined || candidate.at >= record.at)) record = candidate;
    }
    if (record === undefined) return undefined;
    return frozen({state: record.state, action: cloneRef(record.action), receiptId: record.receiptId, outputAvailable: record.output !== undefined, at: record.at});
  }

  history(): readonly ActionHistoryEntry[] { return Object.freeze(this.historyEntries.slice()); }

  revoke(reason?: string): boolean {
    if (!this.live()) return false;
    if (reason !== undefined && !validText(reason)) throw new TypeError('The revocation reason is not bounded.');
    this.epoch++;
    this.status = 'revoked';
    for (const call of [...this.activeCalls]) call.abort('lifecycle');
    for (const receipt of this.receipts.values()) { receipt.input = undefined; receipt.consumed = true; receipt.executing = false; }
    this.receipts.clear();
    for (const preview of this.previews.values()) { preview.input = undefined; preview.consumed = true; }
    this.previews.clear();
    for (const entry of this.idempotency.values()) if (entry.state === 'in-flight') { entry.state = 'ambiguous'; entry.reason = reason ?? 'The action port was revoked during dispatch.'; }
    return true;
  }

  dispose(): void {
    if (!this.live()) return;
    this.epoch++;
    this.status = 'disposed';
    for (const call of [...this.activeCalls]) call.abort('lifecycle');
    for (const receipt of this.receipts.values()) { receipt.input = undefined; receipt.consumed = true; receipt.executing = false; }
    this.receipts.clear();
    for (const preview of this.previews.values()) { preview.input = undefined; preview.consumed = true; }
    this.previews.clear();
    for (const entry of this.idempotency.values()) if (entry.state === 'in-flight') { entry.state = 'ambiguous'; entry.reason = 'The action port was disposed during dispatch.'; }
  }
}

function bounded(value: number, minimum: number, maximum: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new TypeError(`${name} must be a bounded positive safe integer.`);
  return value;
}

export function createActionPort(options: ActionBoundaryOptions): ActionPort { return new ActionPortImpl(options); }
