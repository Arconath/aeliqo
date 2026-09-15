import {createQueryFunctionRegistry, parseIntent, parseWireValue, type Diagnostic, type Intent, type Outcome, type ReadonlyJsonValue, type ResourceDefinition} from '@aeliqo/core';
import type {AgentModelToolEndpoint, AgentToolTransport} from '@aeliqo/agent/protocol';
import {createActionPort, ActionRegistry, type ActionPayload, type ActionRegistration, type ActionSchema} from '@aeliqo/runtime/actions';
import {createLocalDataService, type DataRecord, type DataValue, type LocalDataService} from '@aeliqo/runtime/data';
import {createAeliqoApp, type AeliqoAppActionEvent, type WebRenderReceipt} from '@aeliqo/web/app';
import {STANDARD_RECIPES} from '@aeliqo/web/recipes';
import type {WebMcpAdapter, WebMcpEvidence} from '@aeliqo/agent/webmcp';
import {customIntentRecipe, knowledgeArticleView, PLAYGROUND_INTENTS, PLAYGROUND_RECORDS, PLAYGROUND_RESOURCES} from './scenarios.js';

const REGION_ID = 'playground-main';
const PRINCIPAL = 'public-demo';
const SCOPE = 'synthetic-local';

type Records = Record<string, DataRecord[]>;

function failure<T>(code: string, message: string): Outcome<T> {
  const diagnostic: Diagnostic = {code, message, retryable: false};
  return {ok: false, diagnostics: [diagnostic]};
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is ReadonlyJsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return value !== null && typeof value === 'object'
    && Object.values(value).every(isJsonValue);
}

function isActionPayload(value: unknown): value is ActionPayload {
  return isRecord(value)
    && Object.values(value).every(isJsonValue);
}

function isDataValue(value: unknown): value is DataValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  return isRecord(value)
    && Object.keys(value).length === 1 && Object.hasOwn(value, 'decimal') && typeof value.decimal === 'string';
}

function isDataRecord(value: unknown): value is DataRecord {
  return isRecord(value)
    && Object.values(value).every(isDataValue);
}

function cloneRecords(): Records {
  const result: Records = {};
  for (const [resource, rows] of Object.entries(PLAYGROUND_RECORDS)) {
    result[resource] = rows.map((row) => {
      const cloned: unknown = structuredClone(row);
      if (!isDataRecord(cloned)) throw new TypeError(`Playground fixture ${resource} must contain scalar data records.`);
      return cloned;
    });
  }
  return result;
}

function outputSchema(id: string): ActionSchema {
  return {ref: {id: `${id}.output`, revision: '1'}, parse(input) {
    const parsed = parseWireValue(input);
    if (!parsed.ok || !isActionPayload(parsed.value) || parsed.value.saved !== true)
      return failure('playground.action-output', 'The local action returned an invalid output.');
    return {ok: true, value: parsed.value};
  }};
}

function inputSchema(id: string, resource: ResourceDefinition): ActionSchema<DataRecord> {
  return {ref: {id: `${id}.input`, revision: '1'}, parse(input) {
    const parsed = resource.parseRecord(input);
    if (!parsed.ok) return parsed;
    return isDataRecord(parsed.value)
      ? {ok: true, value: parsed.value}
      : failure('playground.action-input', 'The local data adapter accepts scalar records only.');
  }};
}

function recordKey(value: DataRecord): string {
  return JSON.stringify({id: value.id});
}

export interface PlaygroundSession {
  readonly regionId: string;
  render(target: HTMLElement, intent: Intent, signal?: AbortSignal): Promise<WebRenderReceipt>;
  context(): ReturnType<ReturnType<typeof createAeliqoApp>['runtime']['context']>;
  connectAgent(transport: Extract<AgentToolTransport, 'byok' | 'mcp'>, goalEpoch?: string): Promise<Outcome<AgentModelToolEndpoint>>;
  connectWebMcp(): Promise<Outcome<{readonly registrations: number; readonly evidence: WebMcpEvidence}>>;
  dispose(): void;
}

export function createPlaygroundSession(
  onActionEvent: (event: AeliqoAppActionEvent) => void | Promise<void>,
  onAgentRender?: (intent: Intent, receipt: WebRenderReceipt) => void | Promise<void>,
): PlaygroundSession {
  const functions = createQueryFunctionRegistry({version: '2'});
  if (!functions.ok) throw new Error(functions.diagnostics[0].message);
  const records = cloneRecords();
  const revisions = new Map<string, string>();
  let agentEgress = false;
  let webMcp: WebMcpAdapter | undefined;
  const agentEndpoints = new Set<AgentModelToolEndpoint>();
  const syncAgentEgress = (): void => { agentEgress = webMcp !== undefined || agentEndpoints.size > 0; };
  let sourceRevision = 1;
  for (const rows of Object.values(records)) for (const row of rows) revisions.set(recordKey(row), '1');

  const resources = Object.values(PLAYGROUND_RESOURCES);
  const services = new Map<string, LocalDataService>();
  for (const resource of resources) {
    services.set(resource.id, createLocalDataService({
      snapshot: {catalog: resource.catalog, sourceRevision: `demo-${sourceRevision}`, records: {[resource.entity.id]: records[resource.id] ?? []}},
      functionRegistry: functions.value,
      sourceLimits: {rows: 1_000, bytes: 1_000_000},
      authorize: ({context}) => context.principal === PRINCIPAL
        ? {ok: true, value: {scopeDigest: SCOPE, policyRevision: 'policy-1'}}
        : failure('playground.denied', 'The synthetic session principal is unavailable.'),
    }));
  }

  const registry = new ActionRegistry();
  const install = (id: string, resource: ResourceDefinition, mode: 'create' | 'update'): void => {
    const registration: ActionRegistration<DataRecord> = {
      descriptor: {ref: {id, revision: '1'}, input: {id: `${id}.input`, revision: '1'}, output: {id: `${id}.output`, revision: '1'},
        sideEffect: 'domain-write', confirmation: 'required', idempotency: 'required', entityRevision: mode === 'update' ? 'required' : 'none'},
      inputSchema: inputSchema(id, resource), outputSchema: outputSchema(id),
      dispatch: ({input}) => {
        const rows = records[resource.id];
        if (rows === undefined) return {state: 'rejected', diagnostics: [{code: 'playground.resource', message: 'The local resource is unavailable.', retryable: false}]};
        const key = recordKey(input);
        const index = rows.findIndex((row) => recordKey(row) === key);
        if (mode === 'create' && index >= 0) return {state: 'rejected', diagnostics: [{code: 'playground.duplicate', message: 'That ID already exists.', retryable: false}]};
        if (mode === 'update' && index < 0) return {state: 'rejected', diagnostics: [{code: 'playground.missing', message: 'The record no longer exists.', retryable: false}]};
        const next = structuredClone(input);
        if (mode === 'create') rows.push(next); else rows[index] = next;
        const revision = String(Number(revisions.get(key) ?? '0') + 1);
        revisions.set(key, revision);
        const service = services.get(resource.id)!;
        const replaced = service.replaceSnapshot({catalog: resource.catalog, sourceRevision: `demo-${++sourceRevision}`, records: {[resource.entity.id]: rows}});
        if (!replaced.ok) return {state: 'rejected', diagnostics: replaced.diagnostics};
        return {state: 'completed', output: {saved: true, id: input.id, revision}};
      },
    };
    const registered = registry.register(registration);
    if (!registered.ok) throw new Error(registered.diagnostics[0].message);
  };
  install('products.create', PLAYGROUND_RESOURCES.products, 'create');
  install('products.update', PLAYGROUND_RESOURCES.products, 'update');
  install('tickets.update', PLAYGROUND_RESOURCES.tickets, 'update');

  const actionPort = createActionPort({registry, host: {
    readContext: () => ({ok: true, value: {principalKey: PRINCIPAL, actorKey: PRINCIPAL, scopeDigest: SCOPE, policyRevision: 'policy-1',
      domainRevision: `demo-${sourceRevision}`, confirmationEpoch: 'user-preview', grants: ['action.propose', 'action.execute'],
      entityRevisions: Object.fromEntries(revisions)}}),
    // `confirm` is invoked only by the explicit preview UI supplied below.
    issueConfirmation: () => ({ok: true, value: undefined}),
  }});

  const authority = {read: () => ({ok: true as const, value: {principalKey: PRINCIPAL, scopeDigest: SCOPE, policyRevision: 'policy-1',
    experienceRevision: 'web-1', grants: ['catalog.read', 'task.propose', 'task.evaluate', 'result.inspect', 'experience.commit', 'action.propose', 'action.execute', ...(agentEgress ? ['model.egress'] : [])],
    readContext: {principal: PRINCIPAL}}})};
  const app = createAeliqoApp({
    resources: resources.map((resource) => ({resource, data: services.get(resource.id)!})), authority, intents: PLAYGROUND_INTENTS,
    actionPort, recipes: [...STANDARD_RECIPES, customIntentRecipe], views: [knowledgeArticleView], onActionEvent,
    formState: {read: ({resource, intent}) => {
      if (intent.kind === 'create') return {ok: true, value: {values: {}, entityRevision: 'new'}};
      const rows = records[resource.id] ?? [];
      const selected = rows.find((row) => Object.entries(intent.identity).every(([field, value]) => row[field] === value));
      if (selected === undefined) return failure('playground.form-missing', 'The selected record is no longer available.');
      return {ok: true, value: {values: structuredClone(selected), entityRevision: revisions.get(recordKey(selected)) ?? '1'}};
    }},
  });
  let mountedResource: string | undefined;
  let mountedTarget: HTMLElement | undefined;

  const render = async (target: HTMLElement, intent: Intent, signal?: AbortSignal): Promise<WebRenderReceipt> => {
    if (mountedResource !== intent.resource || mountedTarget !== target) {
      if (mountedResource !== undefined) app.unmount(REGION_ID);
      const mounted = app.mount({target, regionId: REGION_ID, resourceId: intent.resource});
      if (!mounted.ok) return {status: 'failed', requestId: 'playground-mount', regionId: REGION_ID, diagnostics: mounted.diagnostics};
      mountedResource = intent.resource;
      mountedTarget = target;
    }
    return app.render({regionId: REGION_ID, intent, ...(signal === undefined ? {} : {signal})});
  };

  const connectAgent = async (transport: Extract<AgentToolTransport, 'byok' | 'mcp'>, goalEpoch = crypto.randomUUID()): Promise<Outcome<AgentModelToolEndpoint>> => {
    const target = mountedTarget;
    if (target === undefined) return failure('playground.agent-region', 'Render a scenario before connecting an agent.');
    agentEgress = true;
    const {createAppToolEndpoint} = await import('@aeliqo/agent/app');
    const endpoint = createAppToolEndpoint({runtime: app.runtime, regionId: REGION_ID,
      render: {async render(input) {
        const parsed = parseIntent(input.intent);
        if (!parsed.ok) return {status: 'failed', requestId: 'playground-agent-intent', regionId: REGION_ID, diagnostics: parsed.diagnostics};
        const receipt = await render(target, parsed.value, input.signal);
        await onAgentRender?.(parsed.value, receipt);
        return receipt;
      }},
      goalEpoch, transport, expiresAt: Date.now() + 15 * 60_000,
      maxPending: 2, maxMilliseconds: 15_000, maxInputBytes: 32_000, maxOutputBytes: 64_000});
    if (!endpoint.ok) { syncAgentEgress(); return {ok: false, diagnostics: endpoint.diagnostics}; }
    const inner = endpoint.value;
    let tracked: AgentModelToolEndpoint;
    let closed = false;
    tracked = Object.freeze({...inner, close() {
      if (closed) return;
      closed = true;
      inner.close();
      agentEndpoints.delete(tracked);
      syncAgentEgress();
    }});
    agentEndpoints.add(tracked);
    syncAgentEgress();
    return {ok: true, value: tracked};
  };

  return Object.freeze({
    regionId: REGION_ID,
    render,
    context: () => app.runtime.context(REGION_ID),
    connectAgent,
    async connectWebMcp(): Promise<Outcome<{readonly registrations: number; readonly evidence: WebMcpEvidence}>> {
      const target = mountedTarget;
      if (target === undefined) return failure<{readonly registrations: number; readonly evidence: WebMcpEvidence}>('playground.webmcp-region', 'Render a scenario before connecting WebMCP.');
      webMcp?.close();
      webMcp = undefined;
      syncAgentEgress();
      agentEgress = true;
      const [{createAppToolEndpoint}, {registerWebMcpTools}] = await Promise.all([import('@aeliqo/agent/app'), import('@aeliqo/agent/webmcp')]);
      const endpoint = createAppToolEndpoint({runtime: app.runtime, render: {async render(input) {
        const parsed = parseIntent(input.intent);
        if (!parsed.ok) return {status: 'failed', requestId: 'playground-webmcp-intent', regionId: REGION_ID, diagnostics: parsed.diagnostics};
        const receipt = await render(target, parsed.value, input.signal);
        await onAgentRender?.(parsed.value, receipt);
        return receipt;
      }}, regionId: REGION_ID, goalEpoch: crypto.randomUUID(), transport: 'webmcp', expiresAt: Date.now() + 15 * 60_000,
        maxPending: 2, maxMilliseconds: 15_000, maxInputBytes: 32_000, maxOutputBytes: 64_000});
      if (!endpoint.ok) { syncAgentEgress(); return {ok: false, diagnostics: endpoint.diagnostics}; }
      const registered = await registerWebMcpTools({endpoint: endpoint.value});
      if (!registered.ok) { endpoint.value.close(); syncAgentEgress(); return {ok: false, diagnostics: registered.diagnostics}; }
      webMcp = registered.value.adapter;
      syncAgentEgress();
      return {ok: true, value: {registrations: registered.value.registrations.length, evidence: webMcp.evidence}};
    },
    dispose() { webMcp?.close(); webMcp = undefined; for (const endpoint of [...agentEndpoints]) endpoint.close(); agentEndpoints.clear(); syncAgentEgress(); app.dispose(); actionPort.dispose(); mountedResource = undefined; mountedTarget = undefined; },
  });
}
