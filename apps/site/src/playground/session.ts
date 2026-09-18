import { createQueryFunctionRegistry } from '@aeliqo/core/expressions';
import { type Intent, type Outcome } from '@aeliqo/core';
import type { AgentModelToolEndpoint, AgentToolTransport } from '@aeliqo/agent/protocol';
import { createAeliqoApp, type AeliqoAppActionEvent, type WebRenderReceipt } from '@aeliqo/web/app';
import { STANDARD_RECIPES } from '@aeliqo/web/recipes';
import type { WebMcpEvidence } from '@aeliqo/agent/webmcp';
import { customIntentRecipe, knowledgeArticleView, PLAYGROUND_INTENTS } from './scenarios.js';
import { createPlaygroundData, readPlaygroundFormState } from './session-data.js';
import { createPlaygroundAgentConnections } from './session-agents.js';

const REGION_ID = 'playground-main';
const PRINCIPAL = 'public-demo';
const SCOPE = 'synthetic-local';

export interface PlaygroundSession {
  readonly regionId: string;
  render(target: HTMLElement, intent: Intent, signal?: AbortSignal): Promise<WebRenderReceipt>;
  context(): ReturnType<ReturnType<typeof createAeliqoApp>['runtime']['context']>;
  connectAgent(
    transport: Extract<AgentToolTransport, 'byok' | 'mcp'>,
    goalEpoch?: string,
  ): Promise<Outcome<AgentModelToolEndpoint>>;
  connectWebMcp(): Promise<Outcome<{ readonly registrations: number; readonly evidence: WebMcpEvidence }>>;
  disconnectWebMcp(): void;
  dispose(): void;
}

function createSessionApp(
  data: ReturnType<typeof createPlaygroundData>,
  agentEgress: { enabled: boolean },
  onActionEvent: PlaygroundSessionActionHandler,
) {
  const authority = {
    read: () => ({
      ok: true as const,
      value: {
        principalKey: PRINCIPAL,
        scopeDigest: SCOPE,
        policyRevision: 'policy-1',
        experienceRevision: 'web-1',
        grants: [
          'catalog.read',
          'task.propose',
          'task.evaluate',
          'result.inspect',
          'experience.commit',
          'action.propose',
          'action.execute',
          ...(agentEgress.enabled ? ['model.egress'] : []),
        ],
        readContext: { principal: PRINCIPAL },
      },
    }),
  };
  return createAeliqoApp({
    resources: data.resources.map((resource) => ({ resource, data: data.services.get(resource.id)! })),
    authority,
    intents: PLAYGROUND_INTENTS,
    actionPort: data.actionPort,
    recipes: [...STANDARD_RECIPES, customIntentRecipe],
    views: [knowledgeArticleView],
    onActionEvent,
    formState: {
      read: ({ resource, intent }) => readPlaygroundFormState(data.records, data.revisions, resource, intent),
    },
  });
}

type PlaygroundSessionActionHandler = (event: AeliqoAppActionEvent) => void | Promise<void>;
type SessionApp = ReturnType<typeof createAeliqoApp>;

function createSessionRenderer(app: SessionApp) {
  let mountedResource: string | undefined;
  let mountedTarget: HTMLElement | undefined;
  const render = async (target: HTMLElement, intent: Intent, signal?: AbortSignal): Promise<WebRenderReceipt> => {
    if (mountedResource !== intent.resource || mountedTarget !== target) {
      if (mountedResource !== undefined) app.unmount(REGION_ID);
      const mounted = app.mount({ target, regionId: REGION_ID, resourceId: intent.resource });
      if (!mounted.ok)
        return {
          status: 'failed',
          requestId: 'playground-mount',
          regionId: REGION_ID,
          diagnostics: mounted.diagnostics,
        };
      mounted.value.setAttribute('data-aeliqo-theme', 'light');
      mountedResource = intent.resource;
      mountedTarget = target;
    }
    return app.render({ regionId: REGION_ID, intent, ...(signal === undefined ? {} : { signal }) });
  };
  return {
    render,
    target: () => mountedTarget,
    reset() {
      mountedResource = undefined;
      mountedTarget = undefined;
    },
  };
}

export function createPlaygroundSession(
  onActionEvent: PlaygroundSessionActionHandler,
  onAgentRender?: (intent: Intent, receipt: WebRenderReceipt) => void | Promise<void>,
): PlaygroundSession {
  const functions = createQueryFunctionRegistry({ version: '2' });
  if (!functions.ok) throw new Error(functions.diagnostics[0].message);
  const data = createPlaygroundData(functions.value);
  const agentEgress = { enabled: false, webMcp: undefined, endpoints: new Set<AgentModelToolEndpoint>() };
  const app = createSessionApp(data, agentEgress, onActionEvent);
  const renderer = createSessionRenderer(app);
  const connections = createPlaygroundAgentConnections({
    app,
    regionId: REGION_ID,
    getTarget: renderer.target,
    render: renderer.render,
    ...(onAgentRender === undefined ? {} : { onAgentRender }),
    state: agentEgress,
  });
  return Object.freeze({
    regionId: REGION_ID,
    render: renderer.render,
    context: () => app.runtime.context(REGION_ID),
    connectAgent: connections.connectAgent,
    connectWebMcp: connections.connectWebMcp,
    disconnectWebMcp: connections.disconnectWebMcp,
    dispose() {
      connections.dispose();
      app.dispose();
      data.actionPort.dispose();
      renderer.reset();
    },
  });
}
