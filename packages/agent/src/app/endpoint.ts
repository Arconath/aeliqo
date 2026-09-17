import { contractJsonSchema, type Outcome } from '@aeliqo/core';
import type {
  AgentCapabilityHost,
  AgentCapabilityHostContext,
  AgentCapabilityManifest,
  AgentCapabilityRegistry,
} from '../capabilities/types.js';
import { createAgentCapabilityRegistry } from '../capabilities/registry.js';
import { createAgentToolEndpoint } from '../protocol/endpoint.js';
import type { AgentModelToolEndpoint, AgentToolBinding } from '../protocol/types.js';
import {
  createActionCapability,
  closeActionState,
  confirmAction,
  createActionCapabilityState,
} from './action-capability.js';
import { createContextCapability } from './context-capability.js';
import { createRenderCapability } from './render-capability.js';
import type { AeliqoAppToolEndpoint, AppToolEndpointOptions } from './types.js';
import { bounded, failure, grants, toolSchema } from './values.js';

const refs = Object.freeze({
  context: { id: 'aeliqo.app.context', revision: '1' },
  render: { id: 'aeliqo.app.render', revision: '1' },
  action: { id: 'aeliqo.app.action', revision: '1' },
});

const contextSchema = toolSchema({ type: 'object', properties: {}, additionalProperties: false });
const actionSchema = toolSchema({
  type: 'object',
  oneOf: [
    {
      required: ['mode', 'action', 'input'],
      properties: {
        mode: { const: 'preview' },
        action: { type: 'object', required: ['id', 'revision'] },
        input: { type: 'object' },
        entity: { type: 'object' },
        idempotencyKey: { type: 'string' },
      },
    },
    { required: ['mode', 'previewId'], properties: { mode: { const: 'execute' }, previewId: { type: 'string' } } },
  ],
});

function createRegistry(): Outcome<AgentCapabilityRegistry> {
  return createAgentCapabilityRegistry();
}

function registerCapabilities(
  registry: AgentCapabilityRegistry,
  options: AppToolEndpointOptions,
  actionState: ReturnType<typeof createActionCapabilityState>,
): Outcome<void> {
  const context = registerOne(registry, createContextCapability(options));
  if (!context.ok) return context;
  const render = registerOne(registry, createRenderCapability(options, options.render ?? options.runtime));
  if (!render.ok) return render;
  return registerOne(registry, createActionCapability(actionState));
}

function registerOne<TInput, TOutput>(
  registry: AgentCapabilityRegistry,
  capability: AgentCapabilityManifest<TInput, TOutput>,
): Outcome<void> {
  return registry.register(capability);
}

function standardTools(): readonly AgentToolBinding[] {
  return [
    { name: 'aeliqo_context', capability: refs.context, operation: 'catalog.read', inputSchema: contextSchema },
    {
      name: 'aeliqo_render',
      capability: refs.render,
      operation: 'task.evaluate',
      inputSchema: toolSchema({ ...contractJsonSchema('intent'), type: 'object' }),
    },
    { name: 'aeliqo_act', capability: refs.action, operation: 'action.propose', inputSchema: actionSchema },
  ];
}

function pairedHost(options: AppToolEndpointOptions, initialScopeDigest: string): AgentCapabilityHost {
  return {
    readContext: (): Outcome<AgentCapabilityHostContext> => {
      const current = options.runtime.context(options.regionId);
      if (!current.ok) return current;
      if (current.value.authority.scopeDigest !== initialScopeDigest)
        return failure('agent.app.stale', 'The paired Region scope changed. Create a new tool pairing.');
      return {
        ok: true as const,
        value: {
          principalKey: current.value.authority.principalKey,
          regionId: options.regionId,
          goalEpoch: options.goalEpoch,
          grants: grants(current.value.authority.grants),
        },
      };
    },
  };
}

type OptionalEndpointLimits = Pick<
  AppToolEndpointOptions,
  'now' | 'maxPending' | 'maxMilliseconds' | 'maxInputBytes' | 'maxOutputBytes'
>;

function endpointLimits(options: AppToolEndpointOptions): OptionalEndpointLimits {
  return {
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.maxPending === undefined ? {} : { maxPending: options.maxPending }),
    ...(options.maxMilliseconds === undefined ? {} : { maxMilliseconds: options.maxMilliseconds }),
    ...(options.maxInputBytes === undefined ? {} : { maxInputBytes: options.maxInputBytes }),
    ...(options.maxOutputBytes === undefined ? {} : { maxOutputBytes: options.maxOutputBytes }),
  };
}

function validateOptions(options: AppToolEndpointOptions): Outcome<AeliqoAppToolEndpoint> | undefined {
  if (options === null || typeof options !== 'object' || !bounded(options.regionId) || !bounded(options.goalEpoch))
    return failure<AeliqoAppToolEndpoint>(
      'agent.app.invalid',
      'A standard tool endpoint requires one mounted Region and goal epoch.',
    );
  if (options.context !== undefined && (options.context === null || typeof options.context.read !== 'function'))
    return failure<AeliqoAppToolEndpoint>(
      'agent.app.invalid-context',
      'A custom discovery port requires a trusted read function.',
    );
  return undefined;
}

function wrapEndpoint(
  inner: AgentModelToolEndpoint,
  actionState: ReturnType<typeof createActionCapabilityState>,
): AeliqoAppToolEndpoint {
  return Object.freeze({
    ...inner,
    confirmAction: (previewId: string, input: { readonly signal?: AbortSignal } = {}) =>
      confirmAction(actionState, previewId, input),
    close: () => {
      closeActionState(actionState);
      inner.close();
    },
  });
}

/** Creates the three standard tools around one expiring, freshly-authorized Region pairing. */
export function createAppToolEndpoint(options: AppToolEndpointOptions): Outcome<AeliqoAppToolEndpoint> {
  const invalid = validateOptions(options);
  if (invalid !== undefined) return invalid;
  const initial = options.runtime.context(options.regionId);
  if (!initial.ok) return initial;
  const registry = createRegistry();
  if (!registry.ok) return registry;
  const actionState = createActionCapabilityState(options);
  const registered = registerCapabilities(registry.value, options, actionState);
  if (!registered.ok) return registered;
  const endpoint = createAgentToolEndpoint({
    transport: options.transport,
    targetRegionId: options.regionId,
    goalEpoch: options.goalEpoch,
    principalKey: initial.value.authority.principalKey,
    expiresAt: options.expiresAt,
    registry: registry.value,
    tools: standardTools(),
    host: pairedHost(options, initial.value.authority.scopeDigest),
    ...endpointLimits(options),
  });
  if (!endpoint.ok) return endpoint;
  return { ok: true, value: wrapEndpoint(endpoint.value, actionState) };
}
