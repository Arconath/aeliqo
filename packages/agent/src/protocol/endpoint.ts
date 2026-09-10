import {parseWireValue, WIRE_LIMITS, type Outcome} from '@aeliqo/sdk-core';
import {awaitAgentBoundary, createAgentCapabilityDispatcher, normalizeAgentCapabilityAuthority} from '../capabilities/dispatcher.js';
import type {AgentCapabilityAuthority, AgentCapabilityHost, AgentCapabilityRequest} from '../capabilities/types.js';
import type {AgentModelScope, AgentModelToolEndpoint, AgentToolBinding, AgentToolDefinition, AgentToolEndpointOptions} from './types.js';

const failure = <T>(code: string, message: string): Outcome<T> => ({ok: false, diagnostics: [{code, message, retryable: false}]});
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= WIRE_LIMITS.id && !/[\s\u0000-\u001f\u007f]/u.test(value);
const bound = (value: number, ceiling: number): boolean => Number.isSafeInteger(value) && value > 0 && value <= ceiling;
function freeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freeze)) as T;
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freeze(child)]))) as T;
}
function localSchemaReferences(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(localSchemaReferences);
  return Object.entries(value).every(([key, child]) => (key !== '$ref' || (typeof child === 'string' && child.startsWith('#'))) && localSchemaReferences(child));
}

/** One expiring, explicitly paired region uses the same capability dispatcher as manual calls. */
export function createAgentToolEndpoint(input: AgentToolEndpointOptions): Outcome<AgentModelToolEndpoint> {
  if (!input || !['manual', 'mcp', 'webmcp', 'byok'].includes(input.transport) || !id(input.targetRegionId) || !id(input.goalEpoch) || !id(input.principalKey)
    || (input.scopeDigest !== undefined && !id(input.scopeDigest)) || !input.host || typeof input.host.readContext !== 'function'
    || !input.registry || typeof input.registry.get !== 'function') return failure('agent.protocol.invalid', 'A tool endpoint requires a trusted principal and explicit region pairing.');
  const now = input.now ?? Date.now;
  let created: number;
  try { created = now(); } catch { return failure('agent.protocol.clock', 'The pairing clock is unavailable.'); }
  if (!Number.isFinite(created) || !Number.isFinite(input.expiresAt) || input.expiresAt <= created || input.expiresAt - created > 86_400_000)
    return failure('agent.protocol.lease', 'A pairing must expire within one day.');
  const monotonicStart = performance.now();
  const leaseMilliseconds = input.expiresAt - created;
  const maxPending = input.maxPending ?? 8, maxMilliseconds = input.maxMilliseconds ?? 30_000;
  const maxInputBytes = input.maxInputBytes ?? WIRE_LIMITS.bytes, maxOutputBytes = input.maxOutputBytes ?? WIRE_LIMITS.bytes;
  if (!bound(maxPending, 64) || !bound(maxMilliseconds, 300_000) || !bound(maxInputBytes, WIRE_LIMITS.bytes) || !bound(maxOutputBytes, WIRE_LIMITS.bytes))
    return failure('agent.protocol.budget', 'Tool endpoint limits are outside their bounds.');
  const inspected = parseWireValue(input.tools);
  if (!inspected.ok || !Array.isArray(inspected.value) || inspected.value.length > 64) return failure('agent.protocol.tools', 'Tool bindings must be a bounded array.');
  const tools = new Map<string, AgentToolDefinition>();
  for (const raw of inspected.value) {
    const binding = raw as unknown as AgentToolBinding;
    if (!binding || typeof binding !== 'object' || typeof binding.name !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/u.test(binding.name) || tools.has(binding.name)
      || !id(binding.capability?.id) || !id(binding.capability?.revision)) return failure('agent.protocol.tools', 'Tool names and capability references must be unique and bounded.');
    const manifest = input.registry.get(binding.capability);
    if (!manifest || manifest.operation !== binding.operation) return failure('agent.protocol.tools', 'A tool must name an existing capability and its exact operation.');
    if (!binding.inputSchema || Array.isArray(binding.inputSchema) || binding.inputSchema.type !== 'object'
      || !localSchemaReferences(binding.inputSchema) || new TextEncoder().encode(JSON.stringify(binding.inputSchema)).byteLength > 65_536)
      return failure('agent.protocol.schema', 'A tool requires a bounded object schema with local references only.');
    tools.set(binding.name, freeze({...binding, description: manifest.description ?? manifest.label}));
  }
  const target = Object.freeze({targetRegionId: input.targetRegionId, goalEpoch: input.goalEpoch});
  const transport = input.transport, principalKey = input.principalKey, scopeDigest = input.scopeDigest, expiresAt = input.expiresAt;
  const sourceHost = input.host.readContext.bind(input.host), registry = input.registry;
  const lifetime = new AbortController();
  let pending = 0;
  let sequence = 0;
  const remaining = (): number => {
    if (lifetime.signal.aborted) return 0;
    try { const value = now(); return Number.isFinite(value) ? Math.max(0, Math.min(maxMilliseconds, expiresAt - value, leaseMilliseconds - (performance.now() - monotonicStart))) : 0; } catch { return 0; }
  };
  const host: AgentCapabilityHost = {
    async readContext(request) {
      if (remaining() === 0 || request.signal.aborted) return failure('agent.protocol.stale', 'The tool pairing is closed or expired.');
      const result = await sourceHost(request);
      if (remaining() === 0 || request.signal.aborted) return failure('agent.protocol.stale', 'The tool pairing changed while reading authority.');
      if (!result || !result.ok) return failure('agent.protocol.denied', 'The host did not authorize this tool pairing.');
      const checked = normalizeAgentCapabilityAuthority(result.value, target);
      if (!checked.ok) return checked;
      if (checked.value.principalKey !== principalKey || (scopeDigest !== undefined && checked.value.current?.scopeDigest !== scopeDigest))
        return failure('agent.protocol.stale', 'The tool pairing no longer matches its authenticated scope.');
      return checked;
    },
  };
  const dispatcher = createAgentCapabilityDispatcher({host, registry, maxPending, maxMilliseconds, maxInputBytes, maxOutputBytes});
  const within = async <T>(work: (signal: AbortSignal) => Promise<Outcome<T>>, signal?: AbortSignal): Promise<Outcome<T>> => {
    const milliseconds = remaining();
    if (milliseconds === 0) return failure('agent.protocol.stale', 'The tool pairing is closed or expired.');
    if (signal?.aborted) return failure('agent.protocol.cancelled', 'The tool request was cancelled.');
    if (pending >= maxPending) return failure('agent.protocol.budget', 'The tool endpoint is at capacity.');
    pending += 1;
    try {
      const parent = signal === undefined ? lifetime.signal : AbortSignal.any([signal, lifetime.signal]);
      const result = await awaitAgentBoundary(work, parent, milliseconds);
      if (result.kind === 'aborted') return failure('agent.protocol.cancelled', 'The tool request was cancelled.');
      if (result.kind === 'deadline') return failure('agent.protocol.time-budget', 'The tool request exceeded its time budget.');
      if (result.kind === 'failed') return failure('agent.protocol.failed', 'The tool request failed safely.');
      if (remaining() === 0) return failure('agent.protocol.stale', 'The tool pairing expired before delivery.');
      return result.value;
    } finally { pending -= 1; }
  };
  const authority = async (signal: AbortSignal): Promise<Outcome<AgentCapabilityAuthority>> => {
    sequence += 1;
    return host.readContext({...target, requestId: `tool-discovery-${sequence}`, signal});
  };
  const authorizeModel = (options: {readonly signal?: AbortSignal} = {}): Promise<Outcome<AgentModelScope>> => within(async signal => {
    const checked = await authority(signal);
    if (!checked.ok) return checked;
    if (!checked.value.grants.includes('model.egress')) return failure('agent.protocol.egress', 'The host did not permit model egress.');
    return {ok: true, value: freeze({principalKey: checked.value.principalKey, ...(checked.value.current === undefined ? {} : {current: checked.value.current})})};
  }, options?.signal);
  const discover = (options: {readonly signal?: AbortSignal} = {}): Promise<Outcome<readonly AgentToolDefinition[]>> => within(async signal => {
    const checked = await authority(signal);
    if (!checked.ok) return checked;
    if (transport !== 'manual' && !checked.value.grants.includes('model.egress')) return failure('agent.protocol.egress', 'The host did not permit external tool metadata.');
    const available = Object.freeze([...tools.values()].filter(tool => checked.value.grants.includes(tool.operation)));
    if (new TextEncoder().encode(JSON.stringify(available)).byteLength > maxOutputBytes) return failure('agent.protocol.bytes', 'Tool discovery exceeds its output budget.');
    return {ok: true, value: available};
  }, options?.signal);
  const invoke: AgentModelToolEndpoint['invoke'] = (name, payload, options) => within(async signal => {
    if (!options || !id(options.requestId)) return failure('agent.protocol.invalid', 'A tool call requires a bounded request identity.');
    const tool = tools.get(name);
    if (!tool) return failure('agent.protocol.unsupported', 'The requested tool is not registered.');
    const request: AgentCapabilityRequest = {version: '1', requestId: options.requestId, ...target, capability: tool.capability, operation: tool.operation, input: payload};
    return dispatcher.dispatch(request, {signal, transport});
  }, options?.signal);
  return {ok: true, value: Object.freeze({transport, ...target, discover, invoke, authorizeModel, close: () => lifetime.abort()})};
}
