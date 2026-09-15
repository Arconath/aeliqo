import {
  contractJsonSchema,
  parseContract,
  parseIntent,
  parseWireValue,
  type Diagnostic,
  type OperationGrant,
  type Outcome,
} from '@aeliqo/core';
import type { ActionPreview, ActionReceipt, ActionRequest } from '@aeliqo/runtime/actions';
import type { RuntimeRenderReceipt } from '@aeliqo/runtime/app';
import { createAgentCapabilityRegistry } from '../capabilities/registry.js';
import type { AgentCapabilityHandlerResult, AgentCapabilityManifest, AgentJsonValue } from '../capabilities/types.js';
import { createAgentToolEndpoint } from '../protocol/endpoint.js';
import type { AgentToolBinding } from '../protocol/types.js';
import type { AeliqoAppToolEndpoint, AppToolEndpointOptions } from './types.js';

const refs = Object.freeze({
  context: { id: 'aeliqo.app.context', revision: '1' },
  render: { id: 'aeliqo.app.render', revision: '1' },
  action: { id: 'aeliqo.app.action', revision: '1' },
});

const failure = <T>(code: string, message: string): Outcome<T> => ({
  ok: false,
  diagnostics: [{ code, message, retryable: false }],
});
const record = (value: unknown): value is Readonly<Record<string, AgentJsonValue>> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const bounded = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 160 && !/[\s\u0000-\u001f\u007f]/u.test(value);

function grants(values: readonly string[]): readonly OperationGrant[] {
  return values.flatMap((value) => {
    const parsed = parseContract('operation-grant', JSON.stringify(value));
    return parsed.ok ? [parsed.value] : [];
  });
}

function isAgentJson(value: unknown): value is AgentJsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isAgentJson);
  return record(value) && Object.values(value).every(isAgentJson);
}

function wire(value: AgentJsonValue): Outcome<AgentJsonValue> {
  const parsed = parseWireValue(value);
  if (!parsed.ok) return parsed;
  return isAgentJson(parsed.value)
    ? { ok: true, value: parsed.value }
    : failure('agent.app.output', 'The application produced an invalid agent JSON value.');
}

function toolSchema(value: unknown): Readonly<Record<string, AgentJsonValue>> {
  const parsed = parseWireValue(value);
  if (!parsed.ok || !record(parsed.value))
    throw new TypeError('A standard agent tool schema must be a bounded JSON object.');
  return parsed.value;
}

function renderValue(
  receipt:
    | RuntimeRenderReceipt
    | {
        readonly status: 'renderer-ready' | 'unsupported' | 'failed' | 'cancelled' | 'needs-input';
        readonly requestId: string;
        readonly regionId: string;
        readonly runtime: Extract<RuntimeRenderReceipt, { readonly status: 'committed' }>;
        readonly diagnostics: readonly Diagnostic[];
      },
): AgentJsonValue {
  const committed = 'runtime' in receipt ? receipt.runtime : receipt.status === 'committed' ? receipt : undefined;
  return {
    status: receipt.status,
    requestId: receipt.requestId,
    regionId: receipt.regionId,
    ...(committed === undefined
      ? {}
      : {
          intent: { id: committed.intent.id, kind: committed.intent.kind, resource: committed.intent.resource },
          task: { id: committed.task.id, revision: committed.task.revision, kind: committed.task.kind },
          results: committed.outputs.map((output) => {
            const descriptor = output.handle.snapshot().descriptor;
            return descriptor === undefined
              ? { outputId: output.outputId, status: 'unavailable' }
              : {
                  outputId: output.outputId,
                  status: output.handle.snapshot().status,
                  fields: descriptor.fields.map((field) => field.id),
                  loaded: descriptor.counts.loaded,
                  precision: descriptor.precision.kind,
                  coverage: descriptor.coverage.kind,
                };
          }),
        }),
    diagnostics: receipt.diagnostics.map((item) => ({
      code: item.code,
      message: item.message,
      retryable: item.retryable,
    })),
  };
}

interface ParsedActionPreview {
  readonly mode: 'preview';
  readonly action: ActionRequest['action'];
  readonly input: ActionRequest['input'];
  readonly entity?: ActionRequest['entity'];
  readonly idempotencyKey?: string;
}
interface ParsedActionExecute {
  readonly mode: 'execute';
  readonly previewId: string;
}
type ParsedAction = ParsedActionPreview | ParsedActionExecute;

function parseAction(input: unknown): Outcome<ParsedAction> {
  const inspected = parseWireValue(input);
  if (!inspected.ok) return inspected;
  const value = inspected.value;
  if (!record(value) || (value.mode !== 'preview' && value.mode !== 'execute'))
    return failure('agent.app.action-input', 'Action input must request preview or execute.');
  if (value.mode === 'execute') {
    if (Object.keys(value).some((key) => key !== 'mode' && key !== 'previewId') || !bounded(value.previewId))
      return failure('agent.app.action-input', 'Execute requires one bounded previewId.');
    return { ok: true, value: { mode: 'execute', previewId: value.previewId } };
  }
  if (Object.keys(value).some((key) => !['mode', 'action', 'input', 'entity', 'idempotencyKey'].includes(key)))
    return failure('agent.app.action-input', 'Preview contains an unknown field.');
  const action = value.action;
  const payload = value.input;
  if (
    !record(action) ||
    !bounded(action.id) ||
    !bounded(action.revision) ||
    Object.keys(action).length !== 2 ||
    !record(payload)
  )
    return failure('agent.app.action-input', 'Preview requires a registered action reference and object input.');
  const entity = value.entity;
  let parsedEntity: ActionRequest['entity'];
  if (entity !== undefined) {
    if (!record(entity) || !bounded(entity.key) || !bounded(entity.revision) || Object.keys(entity).length !== 2)
      return failure('agent.app.action-input', 'Action entity identity is malformed.');
    parsedEntity = { key: entity.key, revision: entity.revision };
  }
  if (value.idempotencyKey !== undefined && !bounded(value.idempotencyKey))
    return failure('agent.app.action-input', 'Idempotency key is malformed.');
  return {
    ok: true,
    value: {
      mode: 'preview',
      action: { id: action.id, revision: action.revision },
      input: payload,
      ...(parsedEntity === undefined ? {} : { entity: parsedEntity }),
      ...(value.idempotencyKey === undefined ? {} : { idempotencyKey: value.idempotencyKey }),
    },
  };
}

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

/** Creates the three standard tools around one expiring, freshly-authorized Region pairing. */
export function createAppToolEndpoint(options: AppToolEndpointOptions): Outcome<AeliqoAppToolEndpoint> {
  if (options === null || typeof options !== 'object' || !bounded(options.regionId) || !bounded(options.goalEpoch))
    return failure('agent.app.invalid', 'A standard tool endpoint requires one mounted Region and goal epoch.');
  if (options.context !== undefined && (options.context === null || typeof options.context.read !== 'function'))
    return failure('agent.app.invalid-context', 'A custom discovery port requires a trusted read function.');
  const initial = options.runtime.context(options.regionId);
  if (!initial.ok) return initial;
  const actionPort = options.runtime.actionPort;
  const previews = new Map<string, ActionPreview>();
  const confirmations = new Map<string, ActionReceipt>();
  const renderPort = options.render ?? options.runtime;

  const contextCapability: AgentCapabilityManifest<Record<string, never>, AgentJsonValue> = {
    ref: refs.context,
    operation: 'catalog.read',
    label: 'Inspect the current Aeliqo context',
    description:
      'Lists the active resource and every resource, field, meaning, view, intent, and action the trusted host allows this paired Region to route. Returns metadata, never records or credentials.',
    parse(input) {
      return record(input) && Object.keys(input).length === 0
        ? { ok: true, value: {} }
        : failure('agent.app.context-input', 'Context accepts an empty object.');
    },
    invoke() {
      const active = options.runtime.context(options.regionId);
      if (!active.ok) return { state: 'denied', diagnostics: active.diagnostics };
      const current = options.context?.read() ?? { ok: true as const, value: [active.value] };
      if (!current.ok) return { state: 'denied', diagnostics: current.diagnostics };
      const resources = current.value.map(({ resource, intents, fields, meanings, views, actions }) => ({
        resource,
        intents,
        fields,
        meanings,
        views,
        actions,
      }));
      const value = wire({ activeResource: active.value.resource.id, resources });
      return value.ok ? { state: 'accepted', value: value.value } : { state: 'failed', diagnostics: value.diagnostics };
    },
  };

  const renderCapability: AgentCapabilityManifest<
    ReturnType<typeof parseIntent> extends Outcome<infer T> ? T : never,
    AgentJsonValue
  > = {
    ref: refs.render,
    operation: 'task.evaluate',
    label: 'Render a registered Aeliqo intent',
    description:
      'Validates and renders an intent through the same compiler, data, authority, adaptive policy, and Region lifecycle used by application code.',
    parse: parseIntent,
    async invoke(intent, context): Promise<AgentCapabilityHandlerResult<AgentJsonValue>> {
      if (!context.authority.grants.includes('task.propose') || !context.authority.grants.includes('experience.commit'))
        return {
          state: 'denied',
          diagnostics: [
            {
              code: 'agent.app.denied',
              message: 'Intent compilation and presentation commit are not both permitted.',
              retryable: false,
            },
          ],
        };
      const receipt = await renderPort.render({ regionId: options.regionId, intent, signal: context.signal });
      const value = renderValue(receipt);
      if (receipt.status === 'renderer-ready')
        return { state: 'renderer-ready', value, regionRevision: receipt.runtime.region.regionRevision };
      if (receipt.status === 'committed')
        return { state: 'plan-committed', value, regionRevision: receipt.region.regionRevision };
      const state = receipt.status === 'needs-input' ? 'needs-choice' : receipt.status;
      return { state, value, diagnostics: receipt.diagnostics };
    },
  };

  const actionCapability: AgentCapabilityManifest<ParsedAction, AgentJsonValue> = {
    ref: refs.action,
    operation: 'action.propose',
    label: 'Preview or execute a registered Aeliqo action',
    description:
      'Previews a registered action. Execution requires a separate execute grant and any required confirmation must come from the host UI.',
    parse: parseAction,
    async invoke(input, context): Promise<AgentCapabilityHandlerResult<AgentJsonValue>> {
      if (actionPort === undefined)
        return {
          state: 'unsupported',
          diagnostics: [
            {
              code: 'agent.app.actions-unavailable',
              message: 'This application did not register an action boundary.',
              retryable: false,
            },
          ],
        };
      if (input.mode === 'preview') {
        const preview = await actionPort.preview(
          {
            requestId: context.requestId,
            action: input.action,
            input: input.input,
            ...(input.entity === undefined ? {} : { entity: input.entity }),
            ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey }),
          },
          { signal: context.signal },
        );
        if (!preview.ok) return { state: 'failed', diagnostics: preview.diagnostics };
        previews.set(preview.value.id, preview.value);
        return {
          state: preview.value.confirmation === 'required' ? 'needs-choice' : 'accepted',
          value: {
            state: 'preview',
            previewId: preview.value.id,
            action: preview.value.action,
            sideEffect: preview.value.sideEffect,
            confirmation: preview.value.confirmation,
          },
        };
      }
      if (!context.authority.grants.includes('action.execute'))
        return {
          state: 'denied',
          diagnostics: [{ code: 'agent.app.denied', message: 'Action execution is not permitted.', retryable: false }],
        };
      const preview = previews.get(input.previewId);
      if (preview === undefined)
        return {
          state: 'stale',
          diagnostics: [
            {
              code: 'agent.app.preview-stale',
              message: 'The action preview is missing, expired, or already consumed.',
              retryable: false,
            },
          ],
        };
      let receipt = confirmations.get(input.previewId);
      if (receipt === undefined && preview.confirmation === 'required')
        return { state: 'needs-choice', value: { state: 'confirmation-required', previewId: input.previewId } };
      if (receipt === undefined) {
        const confirmed = await actionPort.confirm(preview, { signal: context.signal });
        if (!confirmed.ok) {
          previews.delete(input.previewId);
          confirmations.delete(input.previewId);
          return { state: 'failed', diagnostics: confirmed.diagnostics };
        }
        receipt = confirmed.value;
      }
      const execution = await actionPort.execute(receipt, { signal: context.signal });
      previews.delete(input.previewId);
      confirmations.delete(input.previewId);
      if (!execution.ok)
        return {
          state: execution.diagnostics[0]?.code === 'action.ambiguous' ? 'partial' : 'failed',
          diagnostics: execution.diagnostics,
        };
      return execution.value.state === 'ambiguous'
        ? {
            state: 'partial',
            reason: execution.value.reason,
            value: { state: 'ambiguous', receiptId: execution.value.receiptId, action: execution.value.action },
          }
        : {
            state: 'accepted',
            value: {
              state: 'executed',
              receiptId: execution.value.receiptId,
              action: execution.value.action,
              output: execution.value.output,
            },
          };
    },
  };

  const registry = createAgentCapabilityRegistry();
  if (!registry.ok) return registry;
  for (const capability of [
    () => registry.value.register(contextCapability),
    () => registry.value.register(renderCapability),
    () => registry.value.register(actionCapability),
  ]) {
    const registered = capability();
    if (!registered.ok) return registered;
  }
  const tools: readonly AgentToolBinding[] = [
    { name: 'aeliqo_context', capability: refs.context, operation: 'catalog.read', inputSchema: contextSchema },
    {
      name: 'aeliqo_render',
      capability: refs.render,
      operation: 'task.evaluate',
      inputSchema: toolSchema({ ...contractJsonSchema('intent'), type: 'object' }),
    },
    { name: 'aeliqo_act', capability: refs.action, operation: 'action.propose', inputSchema: actionSchema },
  ];
  const endpoint = createAgentToolEndpoint({
    transport: options.transport,
    targetRegionId: options.regionId,
    goalEpoch: options.goalEpoch,
    principalKey: initial.value.authority.principalKey,
    expiresAt: options.expiresAt,
    registry: registry.value,
    tools,
    host: {
      readContext: () => {
        const current = options.runtime.context(options.regionId);
        if (!current.ok) return current;
        if (current.value.authority.scopeDigest !== initial.value.authority.scopeDigest)
          return failure('agent.app.stale', 'The paired Region scope changed. Create a new tool pairing.');
        return {
          ok: true,
          value: {
            principalKey: current.value.authority.principalKey,
            regionId: options.regionId,
            goalEpoch: options.goalEpoch,
            grants: grants(current.value.authority.grants),
          },
        };
      },
    },
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.maxPending === undefined ? {} : { maxPending: options.maxPending }),
    ...(options.maxMilliseconds === undefined ? {} : { maxMilliseconds: options.maxMilliseconds }),
    ...(options.maxInputBytes === undefined ? {} : { maxInputBytes: options.maxInputBytes }),
    ...(options.maxOutputBytes === undefined ? {} : { maxOutputBytes: options.maxOutputBytes }),
  });
  if (!endpoint.ok) return endpoint;
  const inner = endpoint.value;
  return {
    ok: true,
    value: Object.freeze({
      ...inner,
      async confirmAction(previewId: string, input: { readonly signal?: AbortSignal } = {}) {
        const preview = previews.get(previewId);
        if (preview === undefined || actionPort === undefined)
          return failure<ActionReceipt>(
            'agent.app.preview-stale',
            'The action preview is missing, expired, or already consumed.',
          );
        const confirmed = await actionPort.confirm(preview, input);
        if (confirmed.ok) confirmations.set(previewId, confirmed.value);
        else {
          previews.delete(previewId);
          confirmations.delete(previewId);
        }
        return confirmed;
      },
      close() {
        for (const preview of previews.values()) actionPort?.cancel(preview);
        previews.clear();
        confirmations.clear();
        inner.close();
      },
    }),
  };
}
