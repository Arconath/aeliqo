import {
  parseContract,
  parseWireValue,
  validateCommitReadSet,
  WIRE_LIMITS,
  type Diagnostic,
  type OperationGrant,
  type Outcome,
  type ResultRef,
  type VersionRef,
} from '@aeliqo/core';
import {capabilityRefKey} from './registry.js';
import type {
  AgentCapabilityAuthority,
  AgentCapabilityContext,
  AgentCapabilityDispatcher,
  AgentCapabilityDispatcherOptions,
  AgentJsonValue,
  AgentCapabilityHandlerResult,
  AgentCapabilityManifest,
  AgentCapabilityPort,
  AgentCapabilityReceipt,
  AgentCapabilityRequest,
  AgentCapabilityState,
  AgentCapabilityTransport,
} from './types.js';

const DEADLINE = Symbol('agent-capability-deadline');
const ABORTED = Symbol('agent-capability-aborted');
const FAILED = Symbol('agent-capability-failed');
const DEFAULT_MAX_PENDING = 8;
const DEFAULT_MAX_MILLISECONDS = 30_000;
const MAX_METADATA_BYTES = 64 * 1024;
const EXTERNAL_TRANSPORTS = new Set<AgentCapabilityTransport>(['mcp', 'webmcp', 'byok']);

type BoundaryResult<T> =
  | {readonly kind: 'value'; readonly value: T}
  | {readonly kind: 'deadline'}
  | {readonly kind: 'aborted'}
  | {readonly kind: 'failed'};

function failure<T>(code: string, message: string, path?: readonly (string | number)[]): Outcome<T> {
  return {ok: false, diagnostics: [{code, message, retryable: false, ...(path === undefined ? {} : {path: [...path]})}]};
}

function diagnostic(code: string, message: string, path?: readonly (string | number)[]): Diagnostic {
  return {code, message, retryable: false, ...(path === undefined ? {} : {path: [...path]})};
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= WIRE_LIMITS.id
    && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

function validText(value: unknown, max: number = WIRE_LIMITS.text): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function utf8Bytes(value: unknown): number | undefined {
  try {
    const inspected = parseWireValue(value);
    if (!inspected.ok) return undefined;
    const encoded = JSON.stringify(inspected.value);
    return encoded === undefined ? undefined : new TextEncoder().encode(encoded).byteLength;
  } catch {
    return undefined;
  }
}

function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

const FORBIDDEN_AUTHORITY_KEYS = new Set([
  'actor', 'approved', 'approval', 'grant', 'grants', 'principal', 'principalKey',
  'permission', 'permissions', 'credential', 'credentials', 'authorization', 'token',
]);

/** Wire input is data.  Authority-shaped keys are rejected at ingress so a
 * future generic handler cannot accidentally interpret a caller's assertion. */
function containsAuthorityClaim(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsAuthorityClaim);
  const object = value as Record<string, unknown>;
  return Object.entries(object).some(([key, child]) => FORBIDDEN_AUTHORITY_KEYS.has(key) || containsAuthorityClaim(child));
}

function sameRef(left: VersionRef, right: VersionRef): boolean {
  return left.id === right.id && left.revision === right.revision;
}

function normalizeRef(input: unknown): Outcome<VersionRef> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return failure('agent.capability.invalid', 'The capability reference is malformed.', ['capability']);
  const object = input as Record<string, unknown>;
  if (!validId(object.id) || !validId(object.revision)) return failure('agent.capability.invalid', 'The capability reference is malformed.', ['capability']);
  return {ok: true, value: Object.freeze({id: object.id, revision: object.revision})};
}

function normalizeTransport(input: unknown): AgentCapabilityTransport {
  return input === 'manual' || input === 'mcp' || input === 'webmcp' || input === 'byok' || input === 'direct' ? input : 'direct';
}

export function normalizeAgentCapabilityRequest(input: unknown): Outcome<AgentCapabilityRequest> {
  const wire = parseWireValue(input);
  if (!wire.ok) return wire;
  if (wire.value === null || typeof wire.value !== 'object' || Array.isArray(wire.value)) return failure('agent.capability.invalid', 'A capability request must be an object.');
  const object = wire.value as Record<string, unknown>;
  const allowed = new Set(['version', 'requestId', 'targetRegionId', 'goalEpoch', 'capability', 'operation', 'input', 'metadata', 'transport']);
  if (Object.keys(object).some((key) => !allowed.has(key))) return failure('agent.capability.invalid', 'A capability request contains an unsupported or authority-shaped field.');
  if (object.version !== '1' || !validId(object.requestId) || !validId(object.targetRegionId) || !validId(object.goalEpoch)) return failure('agent.capability.invalid', 'A capability request has invalid identity or version fields.');
  const ref = normalizeRef(object.capability);
  if (!ref.ok) return ref;
  const operation = parseContract('operation-grant', JSON.stringify(object.operation));
  if (!operation.ok) return failure('agent.capability.invalid', 'A capability request names an unknown operation.', ['operation']);
  if (!Object.hasOwn(object, 'input')) return failure('agent.capability.invalid', 'A capability request must include input.', ['input']);
  const payload = parseWireValue(object.input);
  if (!payload.ok) return failure('agent.capability.invalid', 'Capability input is not bounded wire data.', ['input']);
  if (containsAuthorityClaim(payload.value)) return failure('agent.capability.denied', 'Capability input cannot declare actor or approval authority.', ['input']);
  let metadata: unknown;
  if (Object.hasOwn(object, 'metadata')) {
    const checked = parseWireValue(object.metadata);
    if (!checked.ok) return failure('agent.capability.invalid', 'Capability metadata is not bounded wire data.', ['metadata']);
    if (containsAuthorityClaim(checked.value)) return failure('agent.capability.invalid', 'Capability metadata cannot contain authority claims.', ['metadata']);
    const metadataBytes = utf8Bytes(checked.value);
    if (metadataBytes !== undefined && metadataBytes > MAX_METADATA_BYTES) return failure('agent.capability.bytes', 'Capability metadata exceeds its byte budget.', ['metadata']);
    metadata = checked.value;
  }
  const transport = normalizeTransport(object.transport);
  if (object.transport !== undefined && object.transport !== transport) return failure('agent.capability.invalid', 'The requested transport is not supported.');
  return {ok: true, value: Object.freeze({version: '1', requestId: object.requestId, targetRegionId: object.targetRegionId,
    goalEpoch: object.goalEpoch, capability: ref.value, operation: operation.value, input: payload.value,
    ...(metadata === undefined ? {} : {metadata}), ...(object.transport === undefined ? {} : {transport})})};
}

function normalizeHostContext(input: unknown, request: AgentCapabilityRequest): Outcome<AgentCapabilityAuthority> {
  const wire = parseWireValue(input);
  if (!wire.ok) return failure('agent.capability.denied', 'The host authority context is not bounded data.');
  if (wire.value === null || typeof wire.value !== 'object' || Array.isArray(wire.value)) return failure('agent.capability.denied', 'The host authority context is unavailable.');
  const value = wire.value as Record<string, unknown>;
  if (!validId(value.principalKey) || !validId(value.regionId) || !validId(value.goalEpoch)) return failure('agent.capability.denied', 'The host authority context is malformed.');
  if (value.regionId !== request.targetRegionId || value.goalEpoch !== request.goalEpoch) return failure('agent.capability.stale', 'The host goal or region changed before dispatch.');
  if (!Array.isArray(value.grants) || value.grants.length > WIRE_LIMITS.array) return failure('agent.capability.denied', 'The host grant list is malformed.');
  const grants: OperationGrant[] = [];
  for (const raw of value.grants) {
    const parsed = parseContract('operation-grant', JSON.stringify(raw));
    if (!parsed.ok) return failure('agent.capability.denied', 'The host grant list is malformed.');
    if (!grants.includes(parsed.value)) grants.push(parsed.value);
  }
  let current: AgentCapabilityAuthority['current'] | undefined;
  if (value.current !== undefined) {
    const checked = validateCommitReadSet(value.current, value.current);
    if (!checked.ok) return failure('agent.capability.denied', 'The host preconditions are malformed.');
    current = checked.value;
  }
  let context: AgentJsonValue | undefined;
  if (value.context !== undefined) {
    const checked = parseWireValue(value.context);
    if (!checked.ok) return failure('agent.capability.denied', 'The host context is malformed.');
    context = checked.value as AgentJsonValue;
  }
  return {ok: true, value: Object.freeze({principalKey: value.principalKey, regionId: value.regionId, goalEpoch: value.goalEpoch,
    grants: Object.freeze(grants), ...(current === undefined ? {} : {current}), ...(context === undefined ? {} : {context})})};
}

function cleanDiagnostics(input: readonly Diagnostic[] | undefined): readonly Diagnostic[] {
  if (input === undefined) return [];
  const output: Diagnostic[] = [];
  for (const item of input) {
    if (output.length >= WIRE_LIMITS.diagnostics) break;
    if (item === null || typeof item !== 'object' || Array.isArray(item) || !validId(item.code) || !validText(item.message, WIRE_LIMITS.label) || typeof item.retryable !== 'boolean') continue;
    const path = item.path;
    if (path !== undefined && (!Array.isArray(path) || path.length > WIRE_LIMITS.depth || path.some((part) => !(typeof part === 'string' ? validId(part) : Number.isSafeInteger(part) && part >= 0)))) continue;
    const remedies = item.remedies;
    if (remedies !== undefined && (!Array.isArray(remedies) || remedies.length > WIRE_LIMITS.array || remedies.some((remedy) => !validText(remedy, WIRE_LIMITS.label)))) continue;
    output.push(Object.freeze({code: item.code, message: item.message, retryable: item.retryable,
      ...(path === undefined ? {} : {path: Object.freeze([...path])}), ...(remedies === undefined ? {} : {remedies: Object.freeze([...remedies])})}));
  }
  return Object.freeze(output);
}

function cleanRefs(input: readonly ResultRef[] | undefined): Outcome<readonly ResultRef[] | undefined> {
  if (input === undefined) return {ok: true, value: undefined};
  if (!Array.isArray(input) || input.length > WIRE_LIMITS.outputs) return failure('agent.capability.output', 'A capability returned too many result references.');
  const refs: ResultRef[] = [];
  for (const ref of input) {
    if (ref === null || typeof ref !== 'object' || Array.isArray(ref) || !validId(ref.id) || !validId(ref.revision) || !validId(ref.outputId) || !validId(ref.queryDigest) || !validId(ref.scopeDigest)) return failure('agent.capability.output', 'A capability returned a malformed result reference.');
    refs.push(Object.freeze({id: ref.id, revision: ref.revision, outputId: ref.outputId, queryDigest: ref.queryDigest, scopeDigest: ref.scopeDigest}));
  }
  return {ok: true, value: Object.freeze(refs)};
}

function hasDataOutput(_operation: OperationGrant, value: AgentJsonValue | undefined, refs: readonly ResultRef[] | undefined): boolean {
  return value !== undefined || (refs !== undefined && refs.length > 0);
}

/**
 * A handler may return an opaque value, but any explicit scope marker in a
 * data-bearing output must agree with the host's current authorization scope.
 * Result references are checked separately because their scope is part of the
 * canonical handle identity.  The dispatcher does not infer authority from
 * arbitrary payload fields; it only rejects a marker that is absent from, or
 * inconsistent with, the trusted host read set.
 */
function outputScopeMatches(value: AgentJsonValue | undefined, refs: readonly ResultRef[] | undefined, authority: AgentCapabilityAuthority): boolean {
  const expected = authority.current?.scopeDigest;
  if(refs!==undefined&&refs.length>0&&(authority.current===undefined||!validateCommitReadSet(authority.current,authority.current,refs).ok))return false;
  let marked = false;
  const visit = (candidate: AgentJsonValue): boolean => {
    if (candidate === null || typeof candidate !== 'object') return true;
    if (Array.isArray(candidate)) return candidate.every(visit);
    const object = candidate as {readonly [key: string]: AgentJsonValue};
    if(['id','revision','outputId','queryDigest','scopeDigest'].every(key=>typeof object[key]==='string')){
      const ref={id:object.id,revision:object.revision,outputId:object.outputId,queryDigest:object.queryDigest,scopeDigest:object.scopeDigest} as ResultRef;
      if(authority.current===undefined||!validateCommitReadSet(authority.current,authority.current,[ref]).ok)return false;
    }
    if (Object.hasOwn(object, 'scopeDigest')) {
      marked = true;
      if (expected === undefined || object.scopeDigest !== expected) return false;
    }
    return Object.values(object).every(visit);
  };
  return (value === undefined || visit(value)) && (!marked || expected !== undefined);
}

function allowedState(operation: OperationGrant, state: AgentCapabilityState): boolean {
  if(['partial','cancelled','failed','denied','stale','unsupported','invalid','needs-choice','needs-meaning'].includes(state))return true;
  if(operation.endsWith('.propose'))return state==='accepted'||state==='bound';
  if(operation==='experience.commit')return state==='accepted'||state==='plan-committed'||state==='renderer-ready';
  if(operation==='catalog.read'||operation==='result.inspect'||operation==='task.evaluate')return state==='accepted'||state==='data-ready';
  return state==='accepted'||state==='data-ready';
}

function changedAuthority(before: AgentCapabilityAuthority, after: AgentCapabilityAuthority, operation: OperationGrant, result: AgentCapabilityState): 'none' | 'denied' | 'changed' {
  if (before.principalKey !== after.principalKey || before.regionId !== after.regionId || before.goalEpoch !== after.goalEpoch) return 'changed';
  if (!after.grants.includes(operation)) return 'denied';
  const left = before.current;
  const right = after.current;
  if (left === undefined || right === undefined) return left===right?'none':'changed';
  const stablePins = ['scopeDigest', 'policyRevision', 'catalogRevision', 'experienceRevision', 'functionRegistryDigest'] as const;
  if (stablePins.some((pin) => left[pin] !== right[pin])) return 'changed';
  // A successful commit is allowed to advance the task/region/result pins it
  // owns; all other operations must still see the same read set.
  if (operation === 'experience.commit' && (result === 'plan-committed' || result === 'renderer-ready')) return 'none';
  if (!validateCommitReadSet(left,right).ok) return 'changed';
  return 'none';
}

function receipt(
  request: AgentCapabilityRequest,
  transport: AgentCapabilityTransport,
  state: AgentCapabilityState,
  details: Partial<Omit<AgentCapabilityReceipt, 'version' | 'requestId' | 'targetRegionId' | 'goalEpoch' | 'capability' | 'operation' | 'transport' | 'state' | 'status' | 'stage'>> = {},
): AgentCapabilityReceipt {
  return Object.freeze({version: '1' as const, requestId: request.requestId, targetRegionId: request.targetRegionId, goalEpoch: request.goalEpoch,
    capability: Object.freeze({...request.capability}), operation: request.operation, transport, state, status: state, stage: state,
    diagnostics: Object.freeze(details.diagnostics === undefined ? [] : [...details.diagnostics]), ...details});
}

function failureReceipt(request: AgentCapabilityRequest, transport: AgentCapabilityTransport, state: AgentCapabilityState, code: string, message: string): Outcome<AgentCapabilityReceipt> {
  return {ok: true, value: receipt(request, transport, state, {diagnostics: [diagnostic(code, message)]})};
}

async function awaitBoundary<T>(
  work: (signal: AbortSignal) => T | PromiseLike<T>,
  parent: AbortSignal | undefined,
  milliseconds: number,
): Promise<BoundaryResult<T>> {
  if (parent?.aborted) return {kind: 'aborted'};
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let removeParent: (() => void) | undefined;
  let resolveDeadline!: () => void;
  let resolveAbort!: () => void;
  const deadline = new Promise<typeof DEADLINE>((resolve) => {resolveDeadline = () => {controller.abort(); resolve(DEADLINE);};});
  const aborted = new Promise<typeof ABORTED>((resolve) => {resolveAbort = () => {controller.abort(); resolve(ABORTED);};});
  if (parent !== undefined) {
    const onAbort = (): void => resolveAbort();
    if (parent.aborted) {resolveAbort(); return {kind: 'aborted'};}
    parent.addEventListener('abort', onAbort, {once: true});
    removeParent = () => parent.removeEventListener('abort', onAbort);
  }
  timer = setTimeout(resolveDeadline, Math.max(0, milliseconds));
  const promise = Promise.resolve().then(() => work(controller.signal));
  try {
    const value = await Promise.race([promise, deadline, aborted]);
    if (value === DEADLINE) return {kind: 'deadline'};
    if (value === ABORTED) return {kind: 'aborted'};
    return {kind: 'value', value: value as T};
  } catch {
    if (parent?.aborted) return {kind: 'aborted'};
    return {kind: 'failed'};
  } finally {
    controller.abort();
    if (timer !== undefined) clearTimeout(timer);
    removeParent?.();
  }
}

function normalizeHandlerResult<T>(raw: AgentCapabilityHandlerResult<T> | Outcome<AgentCapabilityHandlerResult<T>>): Outcome<AgentCapabilityHandlerResult<T>> {
  if (raw === null || typeof raw !== 'object') return failure('agent.capability.handler', 'The capability handler returned no result.');
  let candidate: AgentCapabilityHandlerResult<T> | undefined;
  if (Object.hasOwn(raw, 'ok') && typeof (raw as {ok?: unknown}).ok === 'boolean') {
    const outcome = raw as Outcome<AgentCapabilityHandlerResult<T>>;
    if (!outcome.ok) return failure('agent.capability.handler', outcome.diagnostics[0]?.message ?? 'The capability handler reported failure.');
    candidate = outcome.value;
  } else candidate = raw as AgentCapabilityHandlerResult<T>;
  if (candidate === undefined || candidate === null || typeof candidate !== 'object' || !validText(candidate.state, 32)) return failure('agent.capability.handler', 'The capability handler returned an invalid stage.');
  const allowed: readonly AgentCapabilityState[] = ['accepted', 'bound', 'data-ready', 'plan-committed', 'renderer-ready', 'partial', 'cancelled', 'failed', 'denied', 'stale', 'unsupported', 'invalid', 'needs-choice', 'needs-meaning'];
  if (!allowed.includes(candidate.state)) return failure('agent.capability.handler', 'The capability handler returned an unknown stage.');
  const value = candidate.value === undefined ? undefined : parseWireValue(candidate.value);
  if (value !== undefined && !value.ok) return failure('agent.capability.output', 'The capability handler returned non-wire output.');
  const diagnostics = cleanDiagnostics(candidate.diagnostics);
  if (candidate.diagnostics !== undefined && candidate.diagnostics.length > 0 && diagnostics.length === 0) return failure('agent.capability.output', 'The capability handler returned malformed diagnostics.');
  const failureStates: readonly AgentCapabilityState[] = ['failed', 'denied', 'stale', 'unsupported', 'invalid', 'cancelled', 'needs-choice', 'needs-meaning'];
  const effectiveDiagnostics = failureStates.includes(candidate.state) && diagnostics.length === 0
    ? [diagnostic(`agent.capability.${candidate.state}`, `The capability returned ${candidate.state} without a diagnostic.`)]
    : diagnostics;
  const refs = cleanRefs(candidate.affectedResults);
  if (!refs.ok) return refs;
  if (candidate.regionRevision !== undefined && !validId(candidate.regionRevision)) return failure('agent.capability.output', 'The capability handler returned a malformed region revision.');
  if (candidate.reason !== undefined && !validText(candidate.reason, WIRE_LIMITS.label)) return failure('agent.capability.output', 'The capability handler returned an unbounded reason.');
  return {ok: true, value: Object.freeze({state: candidate.state, ...(value === undefined ? {} : {value: value.value as T}),
    ...(effectiveDiagnostics.length === 0 ? {} : {diagnostics: effectiveDiagnostics}), ...(refs.value === undefined ? {} : {affectedResults: refs.value}),
    ...(candidate.regionRevision === undefined ? {} : {regionRevision: candidate.regionRevision}), ...(candidate.reason === undefined ? {} : {reason: candidate.reason})})};
}

/** One authority-checked dispatcher is shared by manual calls and all protocol
 * adapters. Protocols may alter transport metadata, never semantics or grants. */
export function createAgentCapabilityDispatcher(options: AgentCapabilityDispatcherOptions): AgentCapabilityDispatcher {
  if (options === null || typeof options !== 'object' || options.host === null || typeof options.host?.readContext !== 'function' || options.registry === null || typeof options.registry?.get !== 'function') throw new TypeError('A capability host and registry are required.');
  const maxPending = typeof options.maxPending === 'number' && Number.isSafeInteger(options.maxPending) && options.maxPending > 0 ? Math.min(64, options.maxPending) : DEFAULT_MAX_PENDING;
  const maxMilliseconds = typeof options.maxMilliseconds === 'number' && Number.isSafeInteger(options.maxMilliseconds) && options.maxMilliseconds > 0 ? Math.min(300_000, options.maxMilliseconds) : DEFAULT_MAX_MILLISECONDS;
  const maxInputBytes = typeof options.maxInputBytes === 'number' && Number.isSafeInteger(options.maxInputBytes) && options.maxInputBytes > 0 ? Math.min(WIRE_LIMITS.bytes, options.maxInputBytes) : WIRE_LIMITS.bytes;
  const maxOutputBytes = typeof options.maxOutputBytes === 'number' && Number.isSafeInteger(options.maxOutputBytes) && options.maxOutputBytes > 0 ? Math.min(WIRE_LIMITS.bytes, options.maxOutputBytes) : WIRE_LIMITS.bytes;
  let pending = 0;

  const dispatch = async (input: AgentCapabilityRequest | unknown, dispatchOptions: {readonly signal?: AbortSignal; readonly transport?: AgentCapabilityTransport} = {}): Promise<Outcome<AgentCapabilityReceipt>> => {
    const request = normalizeAgentCapabilityRequest(input);
    if (!request.ok) return request;
    // `request.transport` is wire data and cannot select a less restricted
    // boundary.  Only a port or an explicit trusted dispatch option may set
    // the transport; generic dispatch is always local/direct.
    const transport = dispatchOptions.transport ?? 'direct';
    if(normalizeTransport(transport)!==transport)return failure('agent.capability.transport','The trusted dispatch transport is invalid.');
    if (!EXTERNAL_TRANSPORTS.has(transport) && transport !== 'direct' && transport !== 'manual')
      return failureReceipt(request.value, 'direct', 'invalid', 'agent.capability.transport', 'The trusted dispatch transport is unsupported.');
    if (dispatchOptions.signal?.aborted) return failureReceipt(request.value, transport, 'cancelled', 'agent.capability.cancelled', 'Capability dispatch was cancelled before authority inspection.');
    const payloadBytes = utf8Bytes(request.value.input);
    const manifest = options.registry.get(request.value.capability);
    if (manifest === undefined) return failureReceipt(request.value, transport, 'unsupported', 'agent.capability.unknown', 'The requested capability is not registered.');
    if (!sameRef(manifest.ref, request.value.capability) || manifest.operation !== request.value.operation) return failureReceipt(request.value, transport, 'invalid', 'agent.capability.operation', 'The capability reference and operation do not match.');
    const inputLimit = Math.min(maxInputBytes, manifest.limits?.maxInputBytes ?? maxInputBytes);
    if (payloadBytes !== undefined && payloadBytes > inputLimit) return failureReceipt(request.value, transport, 'invalid', 'agent.capability.bytes', 'Capability input exceeds its configured byte budget.');
    if (pending >= maxPending) return failureReceipt(request.value, transport, 'failed', 'agent.capability.budget', 'The capability dispatch queue is full.');
    pending++;
    const start = Date.now();
    try {
      const hostBoundary = await awaitBoundary((signal) => options.host.readContext({requestId: request.value.requestId, targetRegionId: request.value.targetRegionId, goalEpoch: request.value.goalEpoch, signal}), dispatchOptions.signal, maxMilliseconds);
      if (hostBoundary.kind === 'deadline') return failureReceipt(request.value, transport, 'failed', 'agent.capability.time-budget', 'Authority inspection exceeded its time budget.');
      if (hostBoundary.kind === 'aborted') return failureReceipt(request.value, transport, 'cancelled', 'agent.capability.cancelled', 'Capability dispatch was cancelled.');
      if (hostBoundary.kind === 'failed') return failureReceipt(request.value, transport, 'denied', 'agent.capability.denied', 'The host authority context could not be read safely.');
      const hostResult = hostBoundary.value;
      if (!hostResult.ok) return failureReceipt(request.value, transport, 'denied', EXTERNAL_TRANSPORTS.has(transport) ? 'agent.capability.denied' : hostResult.diagnostics[0]?.code ?? 'agent.capability.denied', EXTERNAL_TRANSPORTS.has(transport) ? 'The host did not authorize capability inspection.' : hostResult.diagnostics[0]?.message ?? 'The host did not authorize capability inspection.');
      const authority = normalizeHostContext(hostResult.value, request.value);
      if (!authority.ok) {
        const first = authority.diagnostics[0];
        const state: AgentCapabilityState = first?.code === 'agent.capability.stale' ? 'stale' : 'denied';
        return failureReceipt(request.value, transport, state, first?.code ?? 'agent.capability.denied', first?.message ?? 'The host authority context is unavailable.');
      }
      if (!authority.value.grants.includes(request.value.operation)) return failureReceipt(request.value, transport, 'denied', 'agent.capability.grant', 'The host did not grant this capability operation.');
      const parsed = (() => {try { return manifest.parse(request.value.input); } catch { return failure('agent.capability.input', 'The capability input could not be parsed safely.'); }})();
      if (!parsed.ok) {
        const first = parsed.diagnostics[0];
        return failureReceipt(request.value, transport, 'invalid', EXTERNAL_TRANSPORTS.has(transport) ? 'agent.capability.input' : first?.code ?? 'agent.capability.input', EXTERNAL_TRANSPORTS.has(transport) ? 'The capability input is invalid.' : first?.message ?? 'The capability input is invalid.');
      }
      const context: AgentCapabilityContext = Object.freeze({requestId: request.value.requestId, targetRegionId: request.value.targetRegionId, goalEpoch: request.value.goalEpoch,
        signal: dispatchOptions.signal ?? new AbortController().signal, transport, authority: authority.value});
      const remaining = Math.max(1, maxMilliseconds - (Date.now() - start));
      const invocation = await awaitBoundary((signal) => manifest.invoke(parsed.value, {...context, signal}), dispatchOptions.signal, remaining);
      if (invocation.kind === 'deadline') return failureReceipt(request.value, transport, 'failed', 'agent.capability.time-budget', 'Capability execution exceeded its time budget.');
      if (invocation.kind === 'aborted') return failureReceipt(request.value, transport, 'cancelled', 'agent.capability.cancelled', 'Capability execution was cancelled.');
      if (invocation.kind === 'failed') return failureReceipt(request.value, transport, 'failed', 'agent.capability.handler', 'The capability handler failed safely.');
      const normalized = normalizeHandlerResult(invocation.value);
      if (!normalized.ok) return failureReceipt(request.value, transport, 'failed', EXTERNAL_TRANSPORTS.has(transport) ? 'agent.capability.output' : normalized.diagnostics[0]?.code ?? 'agent.capability.output', EXTERNAL_TRANSPORTS.has(transport) ? 'The capability output was invalid.' : normalized.diagnostics[0]?.message ?? 'The capability output was invalid.');
      const result = normalized.value;
      if (!allowedState(request.value.operation, result.state)) return failureReceipt(request.value, transport, 'invalid', 'agent.capability.stage', 'The capability returned a stage that its operation cannot produce.');
      if ((result.state === 'renderer-ready' || result.state === 'plan-committed') && result.regionRevision === undefined) return failureReceipt(request.value, transport, 'invalid', 'agent.capability.stage', 'A committed presentation receipt must identify the committed region revision.');
      // Read/effect handlers own their lower-level transaction, but the
      // dispatcher still checks that the goal, scope and operation grant did
      // not change while an untrusted boundary was in flight. A changed
      // authority produces an ambiguous recovery stage rather than a false
      // success, since the handler may already have crossed an effect edge.
      const finalHost = await awaitBoundary((signal) => options.host.readContext({requestId: request.value.requestId, targetRegionId: request.value.targetRegionId, goalEpoch: request.value.goalEpoch, signal}), dispatchOptions.signal, Math.max(1, maxMilliseconds - (Date.now() - start)));
      if (finalHost.kind === 'deadline') return failureReceipt(request.value, transport, 'partial', 'agent.capability.time-budget', 'Authority recheck exceeded its time budget after the capability boundary.');
      if (finalHost.kind === 'aborted') return failureReceipt(request.value, transport, 'cancelled', 'agent.capability.cancelled', 'Capability dispatch was cancelled during authority recheck.');
      if (finalHost.kind === 'failed' || !finalHost.value.ok) return failureReceipt(request.value, transport, 'partial', 'agent.capability.recovery', 'The capability completed across an unavailable authority recheck; inspect the recovery receipt.');
      const finalAuthority = normalizeHostContext(finalHost.value.value, request.value);
      if (!finalAuthority.ok) return failureReceipt(request.value, transport, 'partial', 'agent.capability.recovery', 'The capability completed across a changed authority; inspect the recovery receipt.');
      const authorityState = changedAuthority(authority.value, finalAuthority.value, request.value.operation, result.state);
      if (authorityState === 'denied') return failureReceipt(request.value, transport, 'partial', 'agent.capability.recovery', 'The capability completed while its grant was revoked; inspect the recovery receipt.');
      if (authorityState === 'changed') return failureReceipt(request.value, transport, 'partial', 'agent.capability.recovery', 'The capability completed while its authority pins changed; inspect the recovery receipt.');
      const output = result.value === undefined ? undefined : parseWireValue(result.value);
      if (output !== undefined && !output.ok) return failureReceipt(request.value, transport, 'failed', 'agent.capability.output', 'The capability output is not wire data.');
      const outputBytes = output === undefined ? 0 : utf8Bytes(output.value as AgentJsonValue);
      const outputLimit = Math.min(maxOutputBytes, manifest.limits?.maxOutputBytes ?? maxOutputBytes);
      if (outputBytes !== undefined && outputBytes > outputLimit) return failureReceipt(request.value, transport, 'failed', 'agent.capability.bytes', 'Capability output exceeds its configured byte budget.');
      const outputValue = output === undefined ? undefined : output.value as AgentJsonValue;
      const dataOutput = hasDataOutput(request.value.operation, outputValue, result.affectedResults);
      if (dataOutput && !outputScopeMatches(outputValue, result.affectedResults, finalAuthority.value))
        return failureReceipt(request.value, transport, 'denied', 'agent.capability.scope', 'The capability output is outside the current authorization scope.');
      if (dataOutput && EXTERNAL_TRANSPORTS.has(transport) && !finalAuthority.value.grants.includes('model.egress'))
        return failureReceipt(request.value, transport, 'denied', 'agent.capability.egress', 'The host did not grant model egress for this result.');
      // Handler prose, paths, revisions and metadata can contain private data
      // just like values. Keep only the bounded stage without current egress.
      if (EXTERNAL_TRANSPORTS.has(transport) && !finalAuthority.value.grants.includes('model.egress')) {
        return {ok: true, value: receipt(request.value, transport, result.state, {
          diagnostics: result.diagnostics?.length || result.reason !== undefined
            ? [diagnostic(`agent.capability.${result.state}`, `The capability returned ${result.state}; details require model egress.`)] : [],
        })};
      }
      const metadata = request.value.metadata === undefined ? undefined : parseWireValue(request.value.metadata);
      return {ok: true, value: receipt(request.value, transport, result.state, {
        ...(output === undefined ? {} : {value: output.value as AgentJsonValue}), diagnostics: cleanDiagnostics(result.diagnostics),
        ...(result.affectedResults === undefined ? {} : {affectedResults: result.affectedResults}),
        ...(result.regionRevision === undefined ? {} : {regionRevision: result.regionRevision}), ...(result.reason === undefined ? {} : {reason: result.reason}),
        ...(metadata === undefined || !metadata.ok ? {} : {metadata: metadata.value as AgentJsonValue}),
      })};
    } catch {
      return failureReceipt(request.value, transport, 'failed', 'agent.capability.failed', 'Capability dispatch failed safely.');
    } finally {
      pending = Math.max(0, pending - 1);
    }
  };
  const port = (transport: AgentCapabilityTransport): AgentCapabilityPort => Object.freeze({transport, invoke(input: AgentCapabilityRequest | unknown, invokeOptions: {readonly signal?: AbortSignal} = {}) {return dispatch(input, {...invokeOptions, transport});}});
  const direct = port('direct');
  const manual = port('manual');
  const mcp = port('mcp');
  const webmcp = port('webmcp');
  const byok = port('byok');
  return Object.freeze({dispatch, port, manual, tool: mcp, direct, mcp, webmcp, byok, pending: () => pending});
}

export function dispatchAgentCapability(
  input: AgentCapabilityRequest | unknown,
  options: AgentCapabilityDispatcherOptions,
  dispatchOptions?: {readonly signal?: AbortSignal; readonly transport?: AgentCapabilityTransport},
): Promise<Outcome<AgentCapabilityReceipt>> {
  return createAgentCapabilityDispatcher(options).dispatch(input, dispatchOptions);
}

export {canonical as capabilityCanonical};
export {capabilityRefKey};
