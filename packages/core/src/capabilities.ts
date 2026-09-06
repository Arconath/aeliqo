import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { notifyObserver } from "./observers";
import { createPresentationTracker, type PresentationTracker, type WorkspaceReceipt } from "./presentation";
import { validateSnapshot, snapshotWarnings } from "./semantics";
import {
  compareMetricRecords,
  filterRecords,
  validateFilters,
  type Operation,
  type WorkspaceStore,
  type WorkspaceState,
  type Dataset,
  type Capability,
  type DataRecord,
  type SnapshotMetadata,
} from "./model";
const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/);
export const filterSchema = z
  .object({
    field: id,
    operator: z.enum(["eq", "lt", "lte", "gt", "gte", "in"]),
    value: z.union([
      z.string().max(160),
      z.number().finite(),
      z.array(z.string().max(160)).max(100),
    ]),
  })
  .strict();
function jsonValue(depth: number): z.ZodType<import("./model").JsonValue> {
  const scalar = z.union([z.null(), z.boolean(), z.number().finite(), z.string().max(2000)]);
  return depth === 0 ? scalar : z.union([scalar, z.array(jsonValue(depth - 1)).max(30), z.record(id, jsonValue(depth - 1)).refine(value => Object.keys(value).length <= 30)]);
}
const fields = {
  component: z.string().min(1).max(100).regex(/^[A-Za-z][A-Za-z0-9_.:-]*$/),
  datasetId: id,
  title: z.string().max(160).optional(),
  pinned:z.boolean().optional(),
  metric: id.optional(),
  xMetric: id.optional(),
  dimension: id.optional(),
  timeField: id.optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().min(1).max(10000).optional(),
  columns: z.array(id).min(1).max(20).optional(),
  compareIds: z.array(id).min(2).max(8).optional(),
  seriesBy: id.optional(),
  relationship: id.optional(),
  span: z.number().int().min(1).max(12).optional(),
  height: z.number().int().min(240).max(900).optional(),
  density: z.enum(["comfortable", "compact"]).optional(),
  filters: z.array(filterSchema).max(10).optional(),
  config: z.record(id, jsonValue(3)).refine(value => Object.keys(value).length <= 30).optional(),
};
export const patchSchema = z
  .object({
    version: z.literal(1),
    baseRevision: z.number().int().min(0),
    operations: z
      .array(
        z.discriminatedUnion("type", [
          z.object({ type: z.literal("move"), id, index: z.number().int().min(0) }).strict(),
          z.object({ type: z.literal("pin"), id, pinned:z.boolean() }).strict(),
          z.object({ type: z.literal("undo") }).strict(),
          z.object({ type: z.literal("redo") }).strict(),
          z
            .object({
              type: z.literal("mount"),
              node: z.object({ id, ...fields }).strict(),
            })
            .strict(),
          z.object({ type: z.literal("remove"), id }).strict(),
          z
            .object({
              type: z.literal("configure"),
              id,
              patch: z.object(fields).partial().strict(),
              unset: z.array(z.enum(["title", "metric", "xMetric", "dimension", "timeField", "direction", "limit", "filters", "columns", "compareIds", "seriesBy", "relationship", "span", "height", "density", "config"])).max(17).optional(),
            })
            .strict(),
          z
            .object({
              type: z.literal("connect"),
              binding: z
                .object({
                  id,
                  source: id,
                  target: id,
                  entity: id,
                  relationship: id.optional(),
                  mode:z.enum(["selection","filter"]).optional(),
                })
                .strict(),
            })
            .strict(),
          z.object({ type: z.literal("disconnect"), id }).strict(),
          z
            .object({
              type: z.literal("select"),
              id,
              recordId: z.string().min(1).max(100).nullable(),
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(30),
  })
  .strict();
export const querySchema = z
  .object({
    datasetId: id,
    metric: id.optional(),
    direction: z.enum(["asc", "desc"]).optional(),
    limit: z.number().int().min(1).max(100).default(20),
    filters: z.array(filterSchema).max(10).optional(),
  })
  .strict();
export const searchSchema = z
  .object({ query: z.string().max(100).optional() })
  .strict();
export const inspectSchema = z.object({ requestId: z.string().min(1).max(100).optional() }).strict();
export type CapabilityName =
  "workspace_inspect" | "catalog_search" | "data_query" | "workspace_apply";
export type OperationSource = "direct" | "MCP" | "BYOK" | "WebMCP";
export interface CapabilityEvent {
  capability: CapabilityName;
  source: OperationSource;
  requestId?: string;
  validationMs: number;
  executionMs: number;
  operations: readonly Operation[];
  revision: number;
  ok: boolean;
  error?: string;
  replayed?: boolean;
}
export interface DispatchContext {
  source?: OperationSource;
  requestId?: string;
}
type CapabilitySchemas = {
  workspace_inspect: typeof inspectSchema;
  catalog_search: typeof searchSchema;
  data_query: typeof querySchema;
  workspace_apply: typeof patchSchema;
};
export type CapabilityInputs = {
  [Name in CapabilityName]: z.infer<CapabilitySchemas[Name]>;
};
export interface CapabilityResults {
  workspace_inspect: WorkspaceState & { receipt?: WorkspaceReceipt; receiptStatus?: "unknown-or-expired" };
  catalog_search: {
    datasets: readonly Dataset[];
    components: readonly Capability[];
  };
  data_query: {
    datasetId: string;
    total: number;
    records: readonly DataRecord[];
    metadata?: SnapshotMetadata;
    scope?: import("./model").DataSnapshot["scope"];
    warnings?: readonly string[];
  };
  workspace_apply: WorkspaceReceipt;
}
export interface CapabilityContract<
  Name extends CapabilityName = CapabilityName,
> {
  id: Name;
  description: string;
  inputSchema: CapabilitySchemas[Name];
  jsonSchema: Record<string, unknown>;
  execute(
    store: WorkspaceStore,
    input: CapabilityInputs[Name],
    context?: DispatchContext,
  ): Name extends "workspace_apply" ? { readonly ok: true; readonly revision: number } : CapabilityResults[Name];
}
function defineCapability<Name extends CapabilityName>(
  definition: Omit<CapabilityContract<Name>, "jsonSchema">,
): CapabilityContract<Name> {
  return {
    ...definition,
    jsonSchema: zodToJsonSchema(definition.inputSchema, {
      $refStrategy: "none",
    }) as Record<string, unknown>,
  };
}
export const capabilityContracts = [
  defineCapability({
    id: "workspace_inspect",
    description:
      "Inspect workspace revision, semantic nodes, relationships and selections. Pass requestId to recover the latest bounded operation receipt. Use the revision for workspace_apply.",
    inputSchema: inspectSchema,
    execute: (store) => store.getState(),
  }),
  defineCapability({
    id: "catalog_search",
    description:
      "Discover datasets, fields, relationships and trusted components. Query matches any whitespace-separated keyword. Use an empty query to discover all. No executable UI is accepted.",
    inputSchema: searchSchema,
    execute: (store, { query }) => {
      const terms = query?.toLowerCase().trim().split(/\s+/).filter(Boolean) ?? [];
      const matches = (value: unknown) => !terms.length || terms.some(term => JSON.stringify(value).toLowerCase().includes(term));
      return {
        datasets: store.dataPort
          .listDatasets()
          .filter((dataset) =>
            matches(dataset),
          ),
        components: store.registry.list().filter((component) =>
          matches(component),
        ),
      };
    },
  }),
  defineCapability({
    id: "data_query",
    description:
      "Read up to 100 records; filter declared fields and sort by a metric. Missing measures sort last. This tool does not change the UI; for a requested workspace change apply operations and check the receipt. Chat-only requests may use reads without mutation.",
    inputSchema: querySchema,
    execute: (store, query) => {
      const dataset = store.dataPort.getDataset(query.datasetId);
      if (!dataset) throw new Error(`Unknown dataset: ${query.datasetId}`);
      if (
        query.metric &&
        !dataset.metrics.some((metric) => metric.key === query.metric)
      )
        throw new Error(`Unknown metric: ${query.metric}`);
      validateFilters(dataset, query.filters);
      const snapshot = store.dataPort.getSnapshot(query.datasetId);
      if (snapshot.status !== "ready")
        throw new Error(snapshot.error ?? "Dataset is loading");
      validateSnapshot(dataset, snapshot, store.dataPort);
      const records = [...filterRecords(snapshot.records, query.filters, dataset)];
      if (query.metric)
        records.sort((a, b) =>
          compareMetricRecords(a, b, dataset.metrics.find(metric => metric.key === query.metric)!, query.direction),
        );
      return {
        datasetId: dataset.id,
        total: records.length,
        records: records.slice(0, query.limit),
        metadata: snapshot.metadata ?? dataset.metadata,
        scope: snapshot.scope,
        warnings: snapshotWarnings(snapshot),
      };
    },
  }),
  defineCapability({
    id: "workspace_apply",
    description:
      "Change the visible workspace with an atomic semantic patch. For display intents, follow data_query with this tool and verify with workspace_inspect. Scatter uses xMetric + metric; Distribution uses metric; Matrix uses metric columns; Relationship uses a declared relationship. Configure columns, seriesBy, span (1–12), height, density, filters and limit. Move changes reading order. Bindings carry compatible semantic selections. No executable UI is accepted and unsupported evidence must remain explicit.",
    inputSchema: patchSchema,
    execute: (store, request, context) => {
      const applied = store.apply(request, {actor: context?.source && context.source !== "direct" ? "agent" : "human"});
      if (!applied.ok) throw new Error(applied.error);
      return applied;
    },
  }),
];
export interface CapabilityDispatcher {
  readonly presentation: PresentationTracker;
  dispatch<Name extends CapabilityName>(
    name: Name,
    input: unknown,
    context?: DispatchContext,
  ): CapabilityResults[Name];
  dispatchAsync<Name extends CapabilityName>(name: Name, input: unknown, context?: DispatchContext, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<CapabilityResults[Name]>;
}
/** One executor for every protocol. Request replay is bounded to the most recent 100 successful requests. */
export function createCapabilityDispatcher(
  store: WorkspaceStore,
  options: {
    onEvent?: (event: CapabilityEvent) => void;
    now?: () => number;
    workspaceId?: string;
  } = {},
): CapabilityDispatcher {
  const now = options.now ?? (() => Date.now());
  const emit = (event: CapabilityEvent) => notifyObserver(() => options.onEvent?.(event));
  const completed = new Map<string, { fingerprint: string; result: unknown }>();
  const presentation = createPresentationTracker(store, { workspaceId: options.workspaceId });
  let sequence = 0;
  const inFlight = new Set<string>();
  const dispatcher: CapabilityDispatcher = {
    presentation,
    dispatch<Name extends CapabilityName>(
      name: Name,
      input: unknown,
      context: DispatchContext = {},
    ) {
      const started = now();
      let validated = started;
      let validationComplete = false;
      let operations: readonly Operation[] = [];
      let reservedId: string | undefined;
      try {
        if (presentation.disposed) throw new Error("Capability dispatcher is disposed");
        // The lookup discriminant ties this schema and handler to the requested result type.
        const contract = capabilityContracts.find(
          (item) => item.id === name,
        ) as CapabilityContract<Name> | undefined;
        if (!contract) throw new Error(`Unknown capability: ${String(name)}`);
        const parsed = contract.inputSchema.parse(
          input,
        ) as CapabilityInputs[Name];
        validated = now();
        validationComplete = true;
        const fingerprint = JSON.stringify({ name, input: parsed });
        const cached = context.requestId
          ? completed.get(context.requestId)
          : undefined;
        if (cached) {
          if (cached.fingerprint !== fingerprint)
            throw new Error("Request id was already used with different input");
          emit({
            capability: name,
            source: context.source ?? "direct",
            requestId: context.requestId,
            validationMs: validated - started,
            executionMs: 0,
            operations: [],
            revision: name === "workspace_apply"
              ? (cached.result as CapabilityResults["workspace_apply"]).revision
              : store.getState().revision,
            ok: true,
            replayed: true,
          });
          return (name === "workspace_apply"
            ? presentation.inspect(context.requestId!) ?? cached.result
            : cached.result) as CapabilityResults[Name];
        }
        if (name === "workspace_apply")
          operations = (parsed as CapabilityInputs["workspace_apply"])
            .operations;
        if (name === "workspace_apply") {
          if (context.requestId) {
            if (inFlight.has(context.requestId) || presentation.inspect(context.requestId))
              throw new Error("Request id was already used or is in progress");
            reservedId = context.requestId;
          } else {
            do { reservedId = `local-${++sequence}`; }
            while (completed.has(reservedId) || inFlight.has(reservedId) || presentation.inspect(reservedId));
          }
          inFlight.add(reservedId);
        }
        const before = store.getState();
        const executed = contract.execute(store, parsed, context);
        let result = executed as CapabilityResults[Name];
        if (name === "workspace_apply") {
          const requestId = reservedId!;
          result = presentation.record(requestId, before, (executed as { revision: number }).revision) as CapabilityResults[Name];
        } else if (name === "workspace_inspect") {
          const requestId = (parsed as CapabilityInputs["workspace_inspect"]).requestId;
          if (requestId) {
            const receipt = presentation.inspect(requestId);
            result = { ...store.getState(), ...(receipt ? { receipt } : { receiptStatus: "unknown-or-expired" as const }) } as CapabilityResults[Name];
          }
        }
        const completedId = reservedId ?? context.requestId;
        if (completedId) {
          completed.set(completedId, { fingerprint, result });
          if (completed.size > 100)
            completed.delete(completed.keys().next().value!);
        }
        emit({
          capability: name,
          source: context.source ?? "direct",
          requestId: context.requestId,
          validationMs: validated - started,
          executionMs: now() - validated,
          operations,
          revision: name === "workspace_apply"
            ? (result as CapabilityResults["workspace_apply"]).revision
            : store.getState().revision,
          ok: true,
        });
        return result;
      } catch (error) {
        emit({
          capability: name,
          source: context.source ?? "direct",
          requestId: context.requestId,
          validationMs: validationComplete
            ? validated - started
            : now() - started,
          executionMs: validationComplete ? now() - validated : 0,
          operations,
          revision: store.getState().revision,
          ok: false,
          error: error instanceof Error ? error.message : "Capability failed",
        });
        throw error;
      } finally {
        if (reservedId) inFlight.delete(reservedId);
      }
    },
    async dispatchAsync(name, input, context, waitOptions) {
      waitOptions?.signal?.throwIfAborted();
      const result = dispatcher.dispatch(name, input, context);
      if (name !== "workspace_apply") return result;
      if (presentation.disposed && !presentation.inspect((result as WorkspaceReceipt).requestId)) {
        const receipt = result as WorkspaceReceipt;
        return (receipt.outcome === "presented" ? receipt : {...receipt,render:{status:"disconnected",revision:receipt.revision},outcome:"pending"}) as typeof result;
      }
      return await presentation.wait((result as WorkspaceReceipt).requestId, waitOptions) as typeof result;
    },
  };
  return dispatcher;
}
