import type {
  CapabilityEvent,
  WorkspaceRequest,
  ApplyResult,
} from "@aeliqo/core";
export interface AdaptationEvidence {
  id: string;
  mode: string;
  width: number;
  visibleRecords: number;
  totalRecords: number;
}
interface ProofSnapshot {
  directOperations: readonly {
    source: "direct";
    request: WorkspaceRequest;
    result: ApplyResult;
    timing: string;
  }[];
  events: readonly CapabilityEvent[];
  renders: Readonly<Record<string, number>>;
  adaptations: Readonly<Record<string, AdaptationEvidence>>;
  providerMs: number | null;
  transportMs: number | null;
  plan: null | {
    intent: string;
    semanticNeeds: readonly string[];
    contracts: readonly { need: string; component: string }[];
    datasets: readonly string[];
    relationships: readonly string[];
    operations: readonly string[];
    source: "direct" | "MCP" | "BYOK" | "WebMCP";
    coreMutationMs: number | null;
    reactUpdateMs: number | null;
    updatedComponents: readonly string[];
  };
}
let snapshot: ProofSnapshot = {
  directOperations: [],
  events: [],
  renders: {},
  adaptations: {},
  providerMs: null,
  transportMs: null,
  plan: null,
};
let pendingStartedAt: number | null = null;
let pendingRenders: Readonly<Record<string, number>> = {};
let pendingExplicitPlan = false;
const listeners = new Set<() => void>();
function publish(next: ProofSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}
export const proof = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  operation: (request: WorkspaceRequest, result: ApplyResult) =>
    publish({
      ...snapshot,
      directOperations: [
        ...snapshot.directOperations.slice(-99),
        {
          source: "direct",
          request,
          result,
          timing:
            "Not separately measured; capability calls have validation/execution timing",
        },
      ],
    }),
  event: (event: CapabilityEvent) => {
    const isApply = event.capability === "workspace_apply";
    if (isApply && !pendingExplicitPlan) {
      pendingStartedAt = performance.now();
      pendingRenders = snapshot.renders;
    }
    const externalPlan = isApply && !pendingExplicitPlan ? {
      intent: "External protocol supplied semantic workspace operations",
      semanticNeeds: [] as readonly string[],
      contracts: [] as readonly { need: string; component: string }[],
      datasets: [] as readonly string[],
      relationships: [] as readonly string[],
      operations: event.operations.map((operation) => operation.type),
      source: event.source,
      coreMutationMs: event.executionMs,
      reactUpdateMs: null,
      updatedComponents: [] as readonly string[],
    } : null;
    const planned = isApply && pendingExplicitPlan && snapshot.plan
      ? { ...snapshot.plan, source: event.source, coreMutationMs: event.executionMs }
      : null;
    if (isApply) pendingExplicitPlan = false;
    publish({
      ...snapshot,
      events: [...snapshot.events.slice(-99), event],
      plan: planned ?? externalPlan ?? snapshot.plan,
    });
  },
  render: (id: string) => {
    const renders = { ...snapshot.renders, [id]: (snapshot.renders[id] ?? 0) + 1 };
    const updated = snapshot.plan && (pendingRenders[id] ?? 0) !== renders[id]
      ? [...new Set([...snapshot.plan.updatedComponents, id])]
      : snapshot.plan?.updatedComponents ?? [];
    publish({
      ...snapshot,
      renders,
      plan: snapshot.plan ? {
        ...snapshot.plan,
        updatedComponents: updated,
        reactUpdateMs: pendingStartedAt === null ? snapshot.plan.reactUpdateMs : performance.now() - pendingStartedAt,
      } : null,
    });
  },
  adapt: (event: AdaptationEvidence) =>
    publish({
      ...snapshot,
      adaptations: { ...snapshot.adaptations, [event.id]: event },
    }),
  latency: (providerMs: number, transportMs: number) =>
    publish({ ...snapshot, providerMs, transportMs }),
  beginPlan: (plan: {
    intent: string;
    semanticNeeds: readonly string[];
    contracts: readonly { need: string; component: string }[];
    datasets: readonly string[];
    relationships: readonly string[];
    operations: readonly string[];
    source: "direct" | "MCP" | "BYOK" | "WebMCP";
  }) => {
    pendingStartedAt = performance.now();
    pendingRenders = snapshot.renders;
    pendingExplicitPlan = true;
    publish({ ...snapshot, plan: { ...plan, coreMutationMs: null, reactUpdateMs: null, updatedComponents: [] } });
  },
  completePlan: (coreMutationMs: number) => {
    if (snapshot.plan) publish({ ...snapshot, plan: { ...snapshot.plan, coreMutationMs } });
  },
};
