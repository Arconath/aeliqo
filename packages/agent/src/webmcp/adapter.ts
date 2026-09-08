import {parseWireValue, type Outcome} from '@aeliqo/core';
import type {AgentCapabilityReceipt} from '../capabilities/types.js';
import type {AgentToolDefinition, AgentToolEndpoint, AgentToolInputSchema} from '../protocol/types.js';
import type {
  WebMcpAdapter,
  WebMcpAdapterOptions,
  WebMcpDetection,
  WebMcpExecutionOptions,
  WebMcpModelContext,
  WebMcpRegisterOptions,
  WebMcpRegistration,
  WebMcpTool,
  WebMcpToolAnnotations,
} from './types.js';

const MAX_NAME = 64;
const MAX_REFERENCE = 256;
const MAX_DESCRIPTION = 4096;
const TOOL_NAME = /^[A-Za-z0-9_.-]{1,64}$/u;
const OPERATIONS = new Set([
  'catalog.read', 'result.inspect', 'task.propose', 'task.evaluate',
  'experience.propose', 'experience.commit', 'meaning.propose', 'meaning.activate',
  'action.propose', 'action.execute', 'model.egress',
]);

type Registered = {
  readonly definition: AgentToolDefinition;
  readonly controller: AbortController;
  active: boolean;
};

function failure<T>(code: string, message: string): Outcome<T> {
  return {ok: false, diagnostics: [{code, message, retryable: false}]};
}

function validText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function validToolName(value: unknown): value is string {
  return typeof value === 'string' && TOOL_NAME.test(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isModelContext(value: unknown): value is WebMcpModelContext {
  return isObject(value) && typeof value.registerTool === 'function'
    && (value.getTools === undefined || typeof value.getTools === 'function');
}

function globalDocument(): unknown {
  try {
    return (globalThis as typeof globalThis & {readonly document?: unknown}).document;
  } catch {
    return undefined;
  }
}

function modelContextFromDocument(documentLike: unknown): WebMcpModelContext | undefined {
  if (!isObject(documentLike)) return undefined;
  try {
    const context = documentLike.modelContext;
    return isModelContext(context) ? context : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Detects the actual imperative WebMCP surface. It never installs a shim or
 * treats a browser automation object as native support.
 */
export function detectWebMcp(documentLike?: unknown): WebMcpDetection {
  const explicit = arguments.length > 0;
  const context = modelContextFromDocument(explicit ? documentLike : globalDocument());
  if (context !== undefined) {
    return Object.freeze({evidence: explicit ? 'simulated' : 'native', supported: true, modelContext: context});
  }
  return Object.freeze({
    evidence: explicit ? 'simulated' : 'unavailable',
    supported: false,
    reason: 'The host does not expose document.modelContext.registerTool.',
  });
}

function cloneFrozen(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(cloneFrozen));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneFrozen(child)])));
}

function freezeDefinition(input: AgentToolDefinition): AgentToolDefinition {
  const schema = cloneFrozen(input.inputSchema) as AgentToolInputSchema;
  return Object.freeze({
    name: input.name,
    description: input.description,
    capability: Object.freeze({...input.capability}),
    operation: input.operation,
    inputSchema: schema,
  });
}

function localSchemaReferences(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(localSchemaReferences);
  return Object.entries(value).every(([key, child]) =>
    (key !== '$ref' || (typeof child === 'string' && child.startsWith('#'))) && localSchemaReferences(child));
}

function normalizeDefinitions(input: readonly AgentToolDefinition[]): Outcome<readonly AgentToolDefinition[]> {
  if (!Array.isArray(input) || input.length > 128) return failure('agent.webmcp.discovery', 'Tool discovery returned an invalid list.');
  const names = new Set<string>();
  const definitions: AgentToolDefinition[] = [];
  for (const candidate of input) {
    if (!isObject(candidate) || !validToolName(candidate.name) || names.has(candidate.name)
      || !validText(candidate.description, MAX_DESCRIPTION) || !isObject(candidate.capability)
      || !validText(candidate.capability.id, MAX_REFERENCE) || !validText(candidate.capability.revision, MAX_REFERENCE)
      || typeof candidate.operation !== 'string' || !OPERATIONS.has(candidate.operation) || !isObject(candidate.inputSchema)) {
      return failure('agent.webmcp.discovery', 'Tool discovery returned an invalid definition.');
    }
    const schema = parseWireValue(candidate.inputSchema);
    if (!schema.ok || !isObject(schema.value) || schema.value.type !== 'object' || !localSchemaReferences(schema.value))
      return failure('agent.webmcp.discovery', 'Tool discovery returned an invalid input schema.');
    names.add(candidate.name);
    definitions.push(freezeDefinition({
      name: candidate.name,
      description: candidate.description,
      capability: {id: candidate.capability.id, revision: candidate.capability.revision},
      operation: candidate.operation as AgentToolDefinition['operation'],
      inputSchema: schema.value as AgentToolInputSchema,
    }));
  }
  return {ok: true, value: Object.freeze(definitions)};
}

function nativeAnnotations(operation: AgentToolDefinition['operation']): WebMcpToolAnnotations {
  // A proposal is still a write to an application-owned draft boundary, and
  // model egress is a consequential disclosure even when no local state moves.
  const readOnlyHint = operation === 'catalog.read' || operation === 'result.inspect' || operation === 'task.evaluate';
  const consequentialHint = operation === 'experience.commit' || operation === 'meaning.activate'
    || operation === 'action.execute' || operation === 'model.egress';
  // Every endpoint receipt can carry application or source data. Keep the
  // native agent on the defensive; these hints never replace endpoint grants.
  return Object.freeze({readOnlyHint, untrustedContentHint: true, consequentialHint});
}

function safeEndpoint(options: WebMcpAdapterOptions): AgentToolEndpoint {
  if (options === null || typeof options !== 'object' || !isObject(options.endpoint)
    || typeof options.endpoint.discover !== 'function' || typeof options.endpoint.invoke !== 'function'
    || typeof options.endpoint.close !== 'function' || typeof options.endpoint.transport !== 'string') {
    throw new TypeError('A WebMCP adapter requires a host-owned tool endpoint.');
  }
  return options.endpoint;
}

function safeContext(options: WebMcpAdapterOptions): WebMcpDetection {
  if (options.modelContext !== undefined) {
    if (!isModelContext(options.modelContext)) throw new TypeError('The supplied WebMCP modelContext is invalid.');
    return Object.freeze({evidence: 'simulated', supported: true, modelContext: options.modelContext});
  }
  if (Object.hasOwn(options, 'document')) return detectWebMcp(options.document);
  return detectWebMcp();
}

function cancellationFailure<T>(closed: boolean): Outcome<T> {
  return failure(closed ? 'agent.webmcp.closed' : 'agent.webmcp.cancelled', closed
    ? 'The WebMCP adapter has been closed.'
    : 'The WebMCP operation was cancelled.');
}

function linkSignal(primary: AbortSignal | undefined, secondary: AbortSignal): {
  readonly signal: AbortSignal;
  readonly dispose: () => void;
} {
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  if (primary?.aborted || secondary.aborted) controller.abort();
  else {
    primary?.addEventListener('abort', abort, {once: true});
    secondary.addEventListener('abort', abort, {once: true});
  }
  return {
    signal: controller.signal,
    dispose: (): void => {
      primary?.removeEventListener('abort', abort);
      secondary.removeEventListener('abort', abort);
    },
  };
}

function requestId(counter: number): string {
  return `webmcp-${counter}`;
}

async function registerNativeTool(
  context: WebMcpModelContext,
  tool: WebMcpTool,
  controller: AbortController,
): Promise<'registered' | 'cancelled'> {
  if (controller.signal.aborted) return 'cancelled';
  let resolveAbort!: () => void;
  const aborted = new Promise<'cancelled'>(resolve => {
    resolveAbort = () => resolve('cancelled');
    controller.signal.addEventListener('abort', resolveAbort, {once: true});
  });
  const registration = Promise.resolve().then(async () => {
    // Abort can land after the synchronous pre-check but before this native
    // registration microtask runs. Do not expose a tool in that window.
    if (controller.signal.aborted) return 'cancelled' as const;
    await context.registerTool(tool, {signal: controller.signal});
    return controller.signal.aborted ? 'cancelled' as const : 'registered' as const;
  });
  try {
    const result = await Promise.race([registration, aborted]);
    if (result === 'cancelled') void registration.catch(() => undefined);
    return result;
  } finally {
    controller.signal.removeEventListener('abort', resolveAbort);
  }
}

/**
 * Projects one host-owned AgentToolEndpoint into Chrome's imperative WebMCP
 * registration API. The endpoint remains the only executor and owns all
 * authority checks; this module only translates lifecycle and cancellation.
 */
export function createWebMcpAdapter(options: WebMcpAdapterOptions): WebMcpAdapter {
  const endpoint = safeEndpoint(options);
  const detection = safeContext(options);
  let closed = false;
  let callCounter = 0;
  let registrationPromise: Promise<Outcome<readonly WebMcpRegistration[]>> | undefined;
  const registrations = new Map<string, Registered>();
  const pendingControllers = new Set<AbortController>();

  const disposeRegistrations = (): void => {
    for (const controller of pendingControllers) controller.abort();
    pendingControllers.clear();
    for (const registration of registrations.values()) {
      registration.active = false;
      registration.controller.abort();
    }
    registrations.clear();
  };

  const discover = async (discoverOptions: {readonly signal?: AbortSignal} = {}): Promise<Outcome<readonly AgentToolDefinition[]>> => {
    if (closed) return cancellationFailure(true);
    if (!detection.supported || detection.modelContext === undefined)
      return failure('agent.webmcp.unavailable', detection.reason ?? 'The native WebMCP host is unavailable.');
    if (discoverOptions.signal?.aborted) return cancellationFailure(false);
    if (endpoint.transport !== 'webmcp') return failure('agent.webmcp.transport', 'The endpoint is not bound to the WebMCP transport.');
    try {
      const result = discoverOptions.signal === undefined
        ? await endpoint.discover()
        : await endpoint.discover({signal: discoverOptions.signal});
      if (closed) return cancellationFailure(true);
      if (discoverOptions.signal?.aborted) return cancellationFailure(false);
      if (!result.ok) return failure('agent.webmcp.discovery', 'Authorized tool discovery was unavailable.');
      return normalizeDefinitions(result.value);
    } catch {
      return failure('agent.webmcp.discovery', 'Authorized tool discovery failed safely.');
    }
  };

  const register = (registerOptions: WebMcpRegisterOptions = {}): Promise<Outcome<readonly WebMcpRegistration[]>> => {
    if (registrationPromise !== undefined) return registrationPromise;
    const work = (async (): Promise<Outcome<readonly WebMcpRegistration[]>> => {
      if (closed) return cancellationFailure(true);
      if (!detection.supported || detection.modelContext === undefined) return failure('agent.webmcp.unavailable', detection.reason ?? 'The native WebMCP host is unavailable.');
      if (registerOptions.signal?.aborted) return cancellationFailure(false);
      const discovered = registerOptions.signal === undefined
        ? await discover()
        : await discover({signal: registerOptions.signal});
      if (!discovered.ok) return discovered;
      disposeRegistrations();
      const created: WebMcpRegistration[] = [];
      try {
        for (const definition of discovered.value) {
          if (closed || registerOptions.signal?.aborted) {
            disposeRegistrations();
            return cancellationFailure(closed);
          }
          const controller = new AbortController();
          pendingControllers.add(controller);
          const abortRegistration = (): void => controller.abort();
          registerOptions.signal?.addEventListener('abort', abortRegistration, {once: true});
          const registered: Registered = {definition, controller, active: true};
          controller.signal.addEventListener('abort', () => {registered.active = false;}, {once: true});
          const tool: WebMcpTool = Object.freeze({
            name: definition.name,
            description: definition.description,
            inputSchema: definition.inputSchema,
            annotations: nativeAnnotations(definition.operation),
            execute: async (input: unknown, executionOptions?: WebMcpExecutionOptions): Promise<Outcome<AgentCapabilityReceipt>> => {
              if (closed) return cancellationFailure(true);
              if (!registered.active || controller.signal.aborted) return cancellationFailure(false);
              if (executionOptions?.signal?.aborted) return cancellationFailure(false);
              const linked = linkSignal(executionOptions?.signal, controller.signal);
              try {
                if (linked.signal.aborted) return cancellationFailure(closed);
                const result = await endpoint.invoke(definition.name, input, {requestId: requestId(++callCounter), signal: linked.signal});
                if (closed) return cancellationFailure(true);
                if (!registered.active || linked.signal.aborted) return cancellationFailure(false);
                return result;
              } catch {
                if (closed) return cancellationFailure(true);
                if (!registered.active || linked.signal.aborted) return cancellationFailure(false);
                return failure('agent.webmcp.invoke', 'WebMCP capability execution failed safely.');
              } finally {
                linked.dispose();
              }
            },
          });
          try {
            const registeredResult = await registerNativeTool(detection.modelContext, tool, controller);
            if (registeredResult === 'cancelled') {
              disposeRegistrations();
              return cancellationFailure(closed);
            }
          } finally {
            pendingControllers.delete(controller);
            registerOptions.signal?.removeEventListener('abort', abortRegistration);
          }
          if (closed || registerOptions.signal?.aborted || controller.signal.aborted) {
            registered.active = false;
            controller.abort();
            disposeRegistrations();
            return cancellationFailure(closed);
          }
          registrations.set(definition.name, registered);
          created.push(Object.freeze({name: definition.name, capability: Object.freeze({...definition.capability}), operation: definition.operation, evidence: detection.evidence}));
        }
        return {ok: true, value: Object.freeze(created)};
      } catch {
        disposeRegistrations();
        return failure('agent.webmcp.registration', 'WebMCP tool registration failed safely.');
      }
    })();
    registrationPromise = work.finally(() => {registrationPromise = undefined;});
    return registrationPromise;
  };

  const close = (): void => {
    if (closed) return;
    closed = true;
    disposeRegistrations();
    try { endpoint.close(); } catch { /* disposal remains closed even if the host cleanup throws */ }
  };

  return Object.freeze({evidence: detection.evidence, supported: detection.supported, discover, register, close});
}

/** Register a host endpoint in one call while retaining the adapter for disposal. */
export async function registerWebMcpTools(options: WebMcpAdapterOptions & WebMcpRegisterOptions): Promise<Outcome<{
  readonly adapter: WebMcpAdapter;
  readonly registrations: readonly WebMcpRegistration[];
}>> {
  const adapter = createWebMcpAdapter(options);
  const result = await adapter.register(options);
  if (!result.ok) {
    adapter.close();
    return result;
  }
  return {ok: true, value: Object.freeze({adapter, registrations: result.value})};
}
