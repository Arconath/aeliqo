import type { Outcome } from '@aeliqo/core';
import type { AgentCapabilityReceipt } from '../capabilities/types.js';
import type { AgentModelToolEndpoint, AgentToolDefinition, AgentToolTransport } from '../protocol/types.js';
import { runToolModel } from '../model/loop.js';
import type { ToolModelBudget, ToolModelLoopOutcome, ToolModelRunPolicy } from '../model/types.js';
import type { ScopeController, ScopeSnapshot, SurfaceRequest } from '@aeliqo/runtime';
import {
  createScopedSurfaceEndpoint as makeScopedSurfaceEndpoint,
  diagnostic,
  failure,
  MAX_TARGETS,
  validId,
} from './endpoint.js';
import type {
  AgentClient,
  AgentClientHandle,
  AgentClientPairing,
  AgentConnection,
  AgentConnectionSnapshot,
  AgentSurfaceTarget,
} from './types.js';

export { createScopedSurfaceEndpoint } from './endpoint.js';

const DEFAULT_LEASE = 15 * 60_000;
const DEFAULT_BUDGET: ToolModelBudget = Object.freeze({
  maxTurns: 6,
  maxModelRequests: 12,
  maxToolCalls: 12,
  maxMilliseconds: 30_000,
  maxInputTokens: 8_000,
  maxOutputTokens: 2_000,
  maxTotalTokens: 12_000,
  maxInputBytes: 64_000,
  maxOutputBytes: 32_000,
  maxRepeatedCalls: 1,
});
const DEFAULT_POLICY: ToolModelRunPolicy = {
  requiredOperationSequence: [{ operation: 'experience.commit' as const, acceptedStates: ['renderer-ready' as const] }],
  providerToolChoice: 'required',
};

let nextPairingId = 1;

function sameActivation(left: ScopeSnapshot, right: ScopeSnapshot): boolean {
  return (
    left.runtimeId === right.runtimeId &&
    left.scopeInstanceId === right.scopeInstanceId &&
    left.activationEpoch === right.activationEpoch &&
    left.permissionRevision === right.permissionRevision &&
    left.active === right.active &&
    left.status === right.status &&
    left.revision === right.revision &&
    left.policyRevision === right.policyRevision
  );
}

function freshId(prefix: string): string {
  return `aeliqo-${prefix}-${Date.now().toString(36)}-${nextPairingId++}`;
}

interface PairingState {
  readonly endpoint: AgentModelToolEndpoint;
  readonly sessionId: string;
  readonly goalEpoch: string;
  readonly scope: ScopeSnapshot;
  readonly handle: AgentClientHandle | undefined;
}

function resolveTarget(client: AgentClient, targetId: string): AgentSurfaceTarget | undefined {
  try {
    const resolver = client.resolveTarget ?? client.getTarget;
    if (resolver !== undefined) return resolver(targetId);
    return client.registeredTargets?.find((target) => target.id === targetId);
  } catch {
    return undefined;
  }
}

function resolvedTargets(
  client: AgentClient,
  targetIds: readonly string[],
): { readonly targets: readonly AgentSurfaceTarget[]; readonly complete: boolean } {
  const values: AgentSurfaceTarget[] = [];
  for (const id of targetIds) {
    const target = resolveTarget(client, id);
    if (target !== undefined) values.push(target);
  }
  return { targets: Object.freeze(values), complete: values.length === targetIds.length };
}

function connectClient(client: AgentClient, pairing: AgentClientPairing): AgentClientHandle | undefined {
  const hook = client.connect ?? client.onConnect;
  if (hook === undefined) return undefined;
  const handle = hook(pairing);
  if (handle === undefined) return undefined;
  if (typeof handle !== 'object' || handle === null || typeof handle.disconnect !== 'function')
    throw new TypeError('An agent client connection must expose disconnect().');
  return handle;
}

function closePairing(pairing: PairingState | undefined): void {
  if (pairing === undefined) return;
  try {
    pairing.handle?.disconnect();
  } catch {
    // A client cannot keep an old scope pairing alive during a fence.
  }
  pairing.endpoint.close();
}

function noEndpoint<T>(status: AgentConnectionSnapshot['status']): Outcome<T> {
  return failure(`agent.bridge.${status}`, 'The scoped agent connection has no active tool endpoint.');
}

function noLoopOutcome(status: AgentConnectionSnapshot['status']): ToolModelLoopOutcome {
  return failure(`agent.bridge.${status}`, 'The scoped agent connection has no active model endpoint.');
}

function validTargets(targets: readonly string[]): boolean {
  return (
    Array.isArray(targets) &&
    targets.length > 0 &&
    targets.length <= MAX_TARGETS &&
    targets.every(validId) &&
    new Set(targets).size === targets.length
  );
}

function makePairing(
  scope: ScopeController,
  client: AgentClient,
  targetIds: readonly string[],
  transport: AgentToolTransport,
): { readonly pairing?: PairingState; readonly status: AgentConnectionSnapshot['status'] } {
  const current = scope.getSnapshot();
  const resolved = resolvedTargets(client, targetIds);
  const sessionId = freshId('session');
  const goalEpoch = freshId('goal');
  const endpoint = makeScopedSurfaceEndpoint({
    scope,
    sessionId,
    goalEpoch,
    targets: resolved.targets,
    transport,
    expiresAt: Date.now() + DEFAULT_LEASE,
  });
  if (!endpoint.ok) return { status: 'denied' };
  let handle: AgentClientHandle | undefined;
  if (current.active && resolved.complete) {
    try {
      handle = connectClient(client, {
        sessionId,
        goalEpoch,
        scope,
        targets: targetIds,
        endpoint: endpoint.value,
        transport,
      });
    } catch {
      endpoint.value.close();
      return { status: 'denied' };
    }
  }
  return {
    pairing: { endpoint: endpoint.value, sessionId, goalEpoch, scope: current, handle },
    status: !current.active ? 'stale' : resolved.complete ? 'connected' : 'denied',
  };
}

function runModel(
  endpoint: AgentModelToolEndpoint,
  client: AgentClient,
  prompt: string,
  options: { readonly signal?: AbortSignal; readonly budget?: ToolModelBudget; readonly policy?: ToolModelRunPolicy },
  requestId: string,
): Promise<ToolModelLoopOutcome> {
  if (endpoint.transport !== 'byok')
    return Promise.resolve({
      ok: true,
      value: {
        stop: 'denied',
        turns: 0,
        modelRequests: 0,
        toolCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        receipts: [],
      },
    });
  const model = client.model ?? client.modelPort;
  if (model === undefined)
    return Promise.resolve({
      ok: false,
      diagnostics: [
        diagnostic('agent.bridge.model', 'The host client did not provide a fake or application model port.'),
      ],
    });
  return runToolModel({
    requestId,
    goal: 'experience',
    prompt,
    endpoint,
    model,
    budget: options.budget ?? DEFAULT_BUDGET,
    policy: options.policy ?? DEFAULT_POLICY,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  }).then((result) => {
    if (!result.ok || result.value.stop !== 'required-sequence' || result.value.receipts.length !== 0) return result;
    // This is only a label for the loop's trusted missing-receipt outcome.
    return { ok: true, value: { ...result.value, stop: 'no-commit' as const } };
  });
}

/** Pairs an application-owned client to an explicit scope and target allowlist. */
export function connectAgent(input: {
  readonly scope: ScopeController;
  readonly client: AgentClient;
  readonly targets: readonly string[];
}): AgentConnection {
  if (
    input === null ||
    typeof input !== 'object' ||
    input.scope === undefined ||
    typeof input.scope.getSnapshot !== 'function' ||
    typeof input.scope.subscribe !== 'function' ||
    input.client?.kind !== 'host-agent-client'
  )
    throw new TypeError('connectAgent requires a ScopeController and host-owned agent client.');
  const targetIds = Object.freeze([...(input.targets ?? [])]);
  const initialStatus = validTargets(targetIds) ? undefined : ('denied' as const);
  const transport = input.client.transport ?? 'byok';
  let status: AgentConnectionSnapshot['status'] = initialStatus ?? 'connected';
  let current: PairingState | undefined;
  let requestSequence = 0;
  let closed = false;
  if (initialStatus === undefined) {
    const created = makePairing(input.scope, input.client, targetIds, transport);
    current = created.pairing;
    status = created.status;
  }
  const stopScope = input.scope.subscribe(() => {
    if (closed || current === undefined) return;
    const next = input.scope.getSnapshot();
    if (sameActivation(current.scope, next)) return;
    closePairing(current);
    current = undefined;
    status = 'stale';
    if (!next.active) return;
    const rebound = makePairing(input.scope, input.client, targetIds, transport);
    current = rebound.pairing;
    status = rebound.status;
  });
  const inspect = (): AgentConnectionSnapshot => {
    const scope = input.scope.getSnapshot();
    return Object.freeze({
      status: closed ? 'disconnected' : status,
      ...(current === undefined ? {} : { sessionId: current.sessionId, goalEpoch: current.goalEpoch }),
      scopeInstanceId: scope.scopeInstanceId,
      activationEpoch: scope.activationEpoch,
      targets: targetIds,
    });
  };
  const endpoint = (): AgentModelToolEndpoint | undefined =>
    closed || status !== 'connected' ? undefined : current?.endpoint;
  const discover = (options: { readonly signal?: AbortSignal } = {}) => {
    const value = endpoint();
    return value === undefined
      ? Promise.resolve(noEndpoint<readonly AgentToolDefinition[]>(status))
      : value.discover(options);
  };
  const invoke = (
    name: string,
    value: unknown,
    options: { readonly requestId?: string; readonly signal?: AbortSignal } = {},
  ) => {
    const valueEndpoint = endpoint();
    if (valueEndpoint === undefined) return Promise.resolve(noEndpoint<AgentCapabilityReceipt>(status));
    return valueEndpoint.invoke(name, value, {
      requestId: options.requestId ?? freshId(`request-${++requestSequence}`),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
  };
  const render = (
    targetId: string,
    intent: SurfaceRequest<unknown>,
    options: { readonly requestId?: string; readonly signal?: AbortSignal } = {},
  ) => invoke('aeliqo_surface_render', { targetId, intent }, options);
  const runExperience = (
    prompt: string,
    options: {
      readonly signal?: AbortSignal;
      readonly budget?: ToolModelBudget;
      readonly policy?: ToolModelRunPolicy;
    } = {},
  ) => {
    const valueEndpoint = endpoint();
    if (valueEndpoint === undefined) return Promise.resolve(noLoopOutcome(status));
    return runModel(valueEndpoint, input.client, prompt, options, freshId(`experience-${++requestSequence}`));
  };
  const disconnect = (): void => {
    if (closed) return;
    closed = true;
    stopScope();
    closePairing(current);
    current = undefined;
    status = 'disconnected';
  };
  return Object.freeze({
    disconnect,
    inspect,
    get endpoint() {
      return endpoint();
    },
    discover,
    invoke,
    render,
    runExperience,
  });
}
