import { notifyObserver } from "./observers";
import { createComponentRegistry, deltaConfigSchema, timeInvestigationConfigSchema, type ComponentRegistry } from "./registry";
import type { DataPort, WorkspaceNode, Binding, WorkspaceState, WorkspaceStore, WorkspaceInteraction, Operation, WorkspaceRequest, ApplyResult, Filter, Listener } from "./contracts";
import { catalog } from "./catalog";
import { assert, safeId, freezeNode } from "./config-validation";
import { validateNode } from "./node-validation";
import { filterRecords } from "./filters";
export * from "./contracts";
export * from "./data-model";
export * from "./catalog";
export * from "./filters";

export function createWorkspace(options: {
  dataPort: DataPort;
  registry?: ComponentRegistry;
  nodes?: readonly WorkspaceNode[];
  bindings?: readonly Binding[];
  selections?: Readonly<Record<string, string | null>>;
  interactions?: Readonly<Record<string, WorkspaceInteraction | null>>;
}): WorkspaceStore {
  const { dataPort } = options;
  const registry =
    options.registry ??
    createComponentRegistry(
      catalog.map((capability) => ({
        capability,
        ...(capability.component === "Delta"
          ? { configSchema: deltaConfigSchema }
          : capability.component === "TimeInvestigation"
            ? { configSchema: timeInvestigationConfigSchema }
            : {}),
      })),
    );
  let state: WorkspaceState = {
    revision: 0,
    nodes: {},
    order: [],
    bindings: {},
    selections: {},
    interactions: {},
  };
  const operationListeners = new Set<
    (event: { request: WorkspaceRequest; result: ApplyResult }) => void
  >();
  const past: WorkspaceState[] = [],
    future: WorkspaceState[] = [];
  const emptyFilters: readonly Filter[] = Object.freeze([]);
  const filterCache = new Map<string, readonly Filter[]>();
  const filtersFor = (
    snapshot: WorkspaceState,
    id: string,
  ): readonly Filter[] => {
    const result: Filter[] = [],
      pending = [id],
      visited = new Set<string>();
    while (pending.length) {
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      result.push(...(snapshot.nodes[current]?.filters ?? emptyFilters));
      for (const binding of Object.values(snapshot.bindings))
        if (binding.mode === "filter" && binding.target === current)
          pending.push(binding.source);
    }
    return result.length ? result : emptyFilters;
  };
  const getFilters = (id: string): readonly Filter[] => {
    const next = filtersFor(state, id),
      cached = filterCache.get(id);
    if (
      cached &&
      cached.length === next.length &&
      cached.every((filter, index) => filter === next[index])
    )
      return cached;
    if (!state.nodes[id]) {
      filterCache.delete(id);
      return emptyFilters;
    }
    const value = Object.freeze([...next]);
    filterCache.set(id, value);
    return value;
  };
  const listeners = new Map<string, Set<Listener>>();
  const subscribe = (key: string, listener: Listener): (() => void) => {
    let group = listeners.get(key);
    if (!group) {
      group = new Set();
      listeners.set(key, group);
    }
    group.add(listener);
    return () => {
      group.delete(listener);
      if (!group.size) listeners.delete(key);
    };
  };
  const apply = (
    request: WorkspaceRequest,
    control: { actor?: "human" | "agent" } = {},
  ): ApplyResult => {
    if (request.version !== 1)
      return {
        ok: false,
        revision: state.revision,
        error: "Unsupported operation version",
      };
    if (request.baseRevision !== state.revision)
      return {
        ok: false,
        revision: state.revision,
        error: "Revision conflict; inspect and retry",
      };
    const previous = state;
    let nodes = state.nodes,
      order = state.order,
      bindings = state.bindings,
      selections = state.selections,
      interactions = state.interactions;
    try {
      assert(
        request.operations.length > 0 && request.operations.length <= 100,
        "Expected 1–100 operations",
      );
      for (const operation of request.operations) {
        if (control.actor === "agent") {
          assert(
            !["pin", "undo", "redo"].includes(operation.type),
            "Human-only workspace control",
          );
          if (operation.type === "mount")
            assert(!operation.node.pinned, "Only humans can pin content");
          if (operation.type === "configure")
            assert(
              operation.patch.pinned === undefined,
              "Only humans can change pins",
            );
          if (
            ["move", "remove", "configure"].includes(operation.type) &&
            "id" in operation
          )
            assert(
              !nodes[operation.id]?.pinned,
              "Pinned content requires a human to unpin it",
            );
          if (
            operation.type === "remove" ||
            operation.type === "configure" ||
            operation.type === "connect" ||
            operation.type === "disconnect"
          ) {
            const affected =
              operation.type === "connect"
                ? operation.binding.target
                : operation.type === "disconnect"
                  ? bindings[operation.id]?.target
                  : operation.id;
            const pending = affected ? [affected] : [],
              visited = new Set<string>();
            while (pending.length) {
              const current = pending.pop()!;
              if (visited.has(current)) continue;
              visited.add(current);
              for (const binding of Object.values(bindings))
                if (binding.source === current) {
                  assert(
                    !nodes[binding.target]?.pinned,
                    "Pinned content depends on this source",
                  );
                  pending.push(binding.target);
                }
            }
          }
          if (operation.type === "connect")
            assert(
              !nodes[operation.binding.target]?.pinned,
              "Pinned content cannot be rebound by an agent",
            );
          if (operation.type === "disconnect")
            assert(
              !nodes[bindings[operation.id]?.target ?? ""]?.pinned,
              "Pinned content cannot be disconnected by an agent",
            );
        }
        switch (operation.type) {
          case "undo":
          case "redo": {
            assert(
              request.operations.length === 1,
              "History operations must run alone",
            );
            const history = operation.type === "undo" ? past : future;
            const restored = history.at(-1);
            assert(restored, "No workspace history available");
            nodes = restored.nodes;
            order = restored.order;
            bindings = restored.bindings;
            selections = restored.selections;
            interactions = restored.interactions;
            break;
          }
          case "pin": {
            assert(Object.hasOwn(nodes, operation.id), "Unknown node");
            assert(
              typeof operation.pinned === "boolean",
              "Pinned must be a boolean",
            );
            nodes = {
              ...nodes,
              [operation.id]: freezeNode({
                ...nodes[operation.id]!,
                pinned: operation.pinned,
              }),
            };
            break;
          }
          case "move": {
            assert(Object.hasOwn(nodes, operation.id), "Unknown node");
            assert(
              Number.isInteger(operation.index) &&
                operation.index >= 0 &&
                operation.index < order.length,
              "Invalid move index",
            );
            const reordered = order.filter((id) => id !== operation.id);
            reordered.splice(operation.index, 0, operation.id);
            order = reordered;
            break;
          }
          case "mount": {
            validateNode(operation.node, dataPort, registry);
            assert(
              !Object.hasOwn(nodes, operation.node.id),
              "Node already exists",
            );
            nodes = {
              ...nodes,
              [operation.node.id]: freezeNode(operation.node),
            };
            order = [...order, operation.node.id];
            break;
          }
          case "remove": {
            assert(Object.hasOwn(nodes, operation.id), "Unknown node");
            nodes = Object.fromEntries(
              Object.entries(nodes).filter(([id]) => id !== operation.id),
            );
            order = order.filter((id) => id !== operation.id);
            bindings = Object.fromEntries(
              Object.entries(bindings).filter(
                ([, binding]) =>
                  binding.source !== operation.id &&
                  binding.target !== operation.id,
              ),
            );
            selections = Object.fromEntries(
              Object.entries(selections).filter(([id]) => id !== operation.id),
            );
            interactions = Object.fromEntries(
              Object.entries(interactions).filter(
                ([id]) => id !== operation.id,
              ),
            );
            break;
          }
          case "configure": {
            assert(Object.hasOwn(nodes, operation.id), "Unknown node");
            const node = {
              ...nodes[operation.id],
              ...operation.patch,
              id: operation.id,
            } as WorkspaceNode;
            for (const field of operation.unset ?? []) {
              assert(
                [
                  "title",
                  "metric",
                  "xMetric",
                  "dimension",
                  "timeField",
                  "direction",
                  "limit",
                  "filters",
                  "columns",
                  "compareIds",
                  "seriesBy",
                  "relationship",
                  "span",
                  "height",
                  "density",
                  "config",
                ].includes(field),
                "Cannot unset required or unknown field",
              );
              delete (node as unknown as Record<string, unknown>)[field];
            }
            validateNode(node, dataPort, registry);
            const previousNode = nodes[operation.id];
            const canSelect = registry
              .get(node.component)
              ?.interactions.includes("select");
            const dataset = dataPort.getDataset(node.datasetId)!;
            const selected = selections[operation.id];
            const filteredOut =
              selected != null &&
              node.filters?.length &&
              !filterRecords(
                dataPort.getSnapshot(node.datasetId).records,
                node.filters,
                dataset,
              ).some((record) => String(record[dataset.identity]) === selected);
            if (
              (previousNode?.datasetId !== node.datasetId ||
                !canSelect ||
                filteredOut) &&
              selections[operation.id] != null
            ) {
              selections = { ...selections, [operation.id]: null };
            }
            const currentInteraction = interactions[operation.id];
            const canKeepInteraction =
              currentInteraction == null ||
              (previousNode?.datasetId === node.datasetId &&
                (currentInteraction.kind === "range"
                  ? currentInteraction.field === node.timeField &&
                    registry
                      .get(node.component)
                      ?.interactions.includes("select-range")
                  : currentInteraction.field === node.dimension &&
                    registry
                      .get(node.component)
                      ?.interactions.includes("select-group")));
            if (!canKeepInteraction)
              interactions = { ...interactions, [operation.id]: null };
            nodes = { ...nodes, [operation.id]: freezeNode(node) };
            break;
          }
          case "connect": {
            assert(safeId(operation.binding.id), "Invalid binding id");
            assert(
              !Object.hasOwn(bindings, operation.binding.id),
              "Binding already exists",
            );
            assert(
              !Object.values(bindings).some(
                (binding) =>
                  binding.target === operation.binding.target &&
                  (binding.mode ?? "selection") ===
                    (operation.binding.mode ?? "selection") &&
                  binding.mode !== "filter",
              ),
              "Target already has this interaction binding",
            );
            bindings = {
              ...bindings,
              [operation.binding.id]: Object.freeze({ ...operation.binding }),
            };
            break;
          }
          case "disconnect": {
            assert(Object.hasOwn(bindings, operation.id), "Unknown binding");
            bindings = Object.fromEntries(
              Object.entries(bindings).filter(([id]) => id !== operation.id),
            );
            break;
          }
          case "select": {
            const node = nodes[operation.id];
            assert(
              node && Object.hasOwn(nodes, operation.id),
              "Unknown selection source",
            );
            assert(
              registry.get(node.component)?.interactions.includes("select"),
              "Component cannot produce selection",
            );
            const dataset = dataPort.getDataset(node.datasetId);
            assert(dataset, "Unknown dataset");
            if (operation.recordId !== null)
              assert(
                dataPort
                  .getSnapshot(node.datasetId)
                  .records.some(
                    (record) =>
                      String(record[dataset.identity]) === operation.recordId,
                  ),
                "Unknown record identity",
              );
            if (selections[operation.id] !== operation.recordId)
              selections = {
                ...selections,
                [operation.id]: operation.recordId,
              };
            break;
          }
          case "interact": {
            const node = nodes[operation.id];
            assert(node, "Unknown interaction source");
            const capability = registry.get(node.component);
            if (operation.payload.kind === "range") {
              assert(
                capability?.interactions.includes("select-range"),
                "Component cannot produce a range",
              );
              assert(
                node.timeField === operation.payload.field,
                "Range field must match the node time field",
              );
              const range = operation.payload.range;
              if (range)
                assert(
                  Number.isFinite(range.start) &&
                    Number.isFinite(range.end) &&
                    range.start <= range.end,
                  "Invalid temporal range",
                );
            } else {
              assert(
                capability?.interactions.includes("select-group"),
                "Component cannot produce a group",
              );
              assert(
                node.dimension === operation.payload.field,
                "Group field must match the node dimension",
              );
              assert(
                operation.payload.value === null ||
                  typeof operation.payload.value === "string" ||
                  Number.isFinite(operation.payload.value),
                "Invalid group value",
              );
              if (operation.payload.valueType !== undefined)
                assert(
                  operation.payload.valueType === (operation.payload.value === null ? "null" : typeof operation.payload.value),
                  "Group value type mismatch",
                );
            }
            interactions = {
              ...interactions,
              [operation.id]: Object.freeze({
                ...operation.payload,
                ...(operation.payload.kind === "range" &&
                operation.payload.range
                  ? { range: Object.freeze({ ...operation.payload.range }) }
                  : {}),
              }) as WorkspaceInteraction,
            };
            break;
          }
          default:
            throw new Error("Unknown operation");
        }
      }
      assert(
        Object.keys(nodes).length <= 100 && Object.keys(bindings).length <= 100,
        "Workspace supports at most 100 nodes and bindings",
      );
      for (const binding of Object.values(bindings)) {
        const source = nodes[binding.source],
          target = nodes[binding.target];
        assert(
          source && target && source.id !== target.id,
          "Binding requires distinct existing nodes",
        );
        assert(
          binding.mode === undefined ||
            ["selection", "filter", "range", "group"].includes(binding.mode),
          "Unknown binding mode",
        );
        if (binding.mode === "filter") {
          assert(
            registry.get(source.component)?.interactions.includes("filter"),
            "Binding source cannot filter",
          );
          assert(
            source.datasetId === target.datasetId && !binding.relationship,
            "Filter bindings require the same dataset",
          );
          assert(
            dataPort.getDataset(source.datasetId)?.entity === binding.entity,
            "Filter entity mismatch",
          );
        } else if (binding.mode === "range" || binding.mode === "group") {
          const kind = binding.mode;
          assert(
            registry
              .get(source.component)
              ?.interactions.includes(
                kind === "range" ? "select-range" : "select-group",
              ),
            `Binding source cannot produce ${kind}`,
          );
          assert(
            registry
              .get(target.component)
              ?.interactions.includes(
                kind === "range" ? "receive-range" : "receive-group",
              ),
            `Binding target cannot receive ${kind}`,
          );
          assert(
            source.datasetId === target.datasetId && !binding.relationship,
            `${kind} bindings require the same dataset`,
          );
          assert(
            dataPort.getDataset(source.datasetId)?.entity === binding.entity,
            `${kind} binding entity mismatch`,
          );
          assert(
            kind === "range"
              ? source.timeField === target.timeField
              : source.dimension === target.dimension,
            `${kind} binding field mismatch`,
          );
        } else {
          assert(
            registry
              .get(source.component)
              ?.interactions.some(
                (interaction) =>
                  interaction === "select" ||
                  interaction === "forward-selection",
              ),
            "Binding source cannot select or forward selection",
          );
          assert(
            registry
              .get(target.component)
              ?.interactions.includes("receive-selection"),
            "Binding target cannot receive selection",
          );
          const sourceDataset = dataPort.getDataset(source.datasetId);
          const targetDataset = dataPort.getDataset(target.datasetId);
          assert(sourceDataset && targetDataset, "Unknown binding dataset");
          if (binding.relationship) {
            const relation = sourceDataset.relationships?.find(
              (item) => item.id === binding.relationship,
            );
            assert(
              relation && relation.targetDatasetId === target.datasetId,
              "Unknown or incompatible relationship",
            );
            assert(
              targetDataset.entity === binding.entity,
              "Binding target entity mismatch",
            );
            const targetField = relation.targetField ?? targetDataset.identity;
            assert(
              targetField === targetDataset.identity ||
                [
                  ...targetDataset.dimensions,
                  ...targetDataset.metrics,
                  ...targetDataset.timeFields,
                ].some((field) => field.key === targetField),
              "Unknown relationship target field",
            );
          } else {
            assert(
              source.datasetId === target.datasetId,
              "Cross-dataset binding requires an explicit relationship",
            );
            assert(
              sourceDataset.entity === binding.entity &&
                targetDataset.entity === binding.entity,
              "Binding entity mismatch",
            );
          }
        }
        const visit = (id: string, path: ReadonlySet<string>) => {
          assert(!path.has(id), "Selection bindings cannot contain cycles");
          const next = new Set([...path, id]);
          for (const incoming of Object.values(bindings).filter(
            (candidate) => candidate.target === id,
          ))
            visit(incoming.source, next);
        };
        visit(binding.source, new Set([binding.target]));
      }
      for (const [id, selected] of Object.entries(selections)) {
        const node = nodes[id];
        if (!node || selected == null) continue;
        const dataset = dataPort.getDataset(node.datasetId)!;
        const effective = filtersFor({ ...state, nodes, bindings }, id);
        if (
          effective.length &&
          !filterRecords(
            dataPort.getSnapshot(node.datasetId).records,
            effective,
            dataset,
          ).some((record) => String(record[dataset.identity]) === selected)
        )
          selections = { ...selections, [id]: null };
      }
    } catch (error) {
      return {
        ok: false,
        revision: state.revision,
        error: error instanceof Error ? error.message : "Invalid operation",
      };
    }
    const historyOperation = request.operations[0]?.type;
    if (historyOperation === "undo") {
      past.pop();
      future.push(previous);
    } else if (historyOperation === "redo") {
      future.pop();
      past.push(previous);
    } else {
      past.push(previous);
      if (past.length > 50) past.shift();
      future.length = 0;
    }
    state = Object.freeze({
      revision: state.revision + 1,
      nodes: Object.freeze(nodes),
      order: Object.freeze(order),
      bindings: Object.freeze(bindings),
      selections: Object.freeze(selections),
      interactions: Object.freeze(interactions),
    });
    for (const id of filterCache.keys())
      if (!state.nodes[id]) filterCache.delete(id);
    const changed = new Set<Listener>();
    for (const [key, group] of listeners) {
      const id = key.slice(key.indexOf(":") + 1);
      if (
        key === "all" ||
        (key === "order" && previous.order !== state.order) ||
        (key.startsWith("node:") && previous.nodes[id] !== state.nodes[id])
      ) {
        for (const listener of group) changed.add(listener);
      }
    }
    const result = { ok: true as const, revision: state.revision };
    for (const listener of changed) notifyObserver(listener);
    return result;
  };
  const selection = (snapshot: WorkspaceState, id: string): string | null => {
    const incoming = Object.values(snapshot.bindings).find(
      (binding) =>
        binding.target === id &&
        (binding.mode === undefined || binding.mode === "selection"),
    );
    if (!incoming) {
      const selected = snapshot.selections[id] ?? null;
      const node = snapshot.nodes[id];
      const dataset = node && dataPort.getDataset(node.datasetId);
      if (selected === null || !dataset || !node) return null;
      const data = dataPort.getSnapshot(node.datasetId);
      // Absence from a partial page is not evidence that an entity was deleted.
      if (data.status === "ready" && data.scope === "entire-dataset" && !data.records.some(record => String(record[dataset.identity]) === selected)) return null;
      return selected;
    }
    const selected = selection(snapshot, incoming.source);
    if (!incoming.relationship || selected === null) return selected;
    const source = snapshot.nodes[incoming.source],
      target = snapshot.nodes[id];
    const sourceDataset = source && dataPort.getDataset(source.datasetId);
    const targetDataset = target && dataPort.getDataset(target.datasetId);
    const relation = sourceDataset?.relationships?.find(
      (item) => item.id === incoming.relationship,
    );
    if (!source || !target || !sourceDataset || !targetDataset || !relation)
      return null;
    const sourceMatches = dataPort
      .getSnapshot(source.datasetId)
      .records.filter(
        (record) => String(record[sourceDataset.identity]) === selected,
      );
    if (sourceMatches.length !== 1) return null;
    const sourceRecord = sourceMatches[0];
    const foreignKey = sourceRecord?.[relation.field];
    if (foreignKey == null) return null;
    const targetMatches = dataPort
      .getSnapshot(target.datasetId)
      .records.filter(
        (record) =>
          record[relation.targetField ?? targetDataset.identity] === foreignKey,
      );
    const targetRecord =
      targetMatches.length === 1 ? targetMatches[0] : undefined;
    return targetRecord ? String(targetRecord[targetDataset.identity]) : null;
  };
  const subscribeSelection = (id: string, listener: Listener): (() => void) => {
    let selected = selection(state, id);
    let active = true;
    const dataSubscriptions = new Map<string, () => void>();
    const check = () => {
      if (!active) return;
      const next = selection(state, id);
      if (next !== selected) {
        selected = next;
        notifyObserver(listener);
      }
    };
    const reconcile = () => {
      if (!active) return;
      const datasets = new Set<string>();
      let cursor: string | undefined = id;
      while (cursor) {
        const node = state.nodes[cursor];
        if (node) datasets.add(node.datasetId);
        cursor = Object.values(state.bindings).find(
          (binding) =>
            binding.target === cursor &&
            (binding.mode === undefined || binding.mode === "selection"),
        )?.source;
      }
      for (const [datasetId, stop] of dataSubscriptions) {
        if (!datasets.has(datasetId)) {
          stop();
          dataSubscriptions.delete(datasetId);
        }
      }
      for (const datasetId of datasets) {
        if (!dataSubscriptions.has(datasetId))
          dataSubscriptions.set(
            datasetId,
            dataPort.subscribe(datasetId, check),
          );
      }
      check();
    };
    // Observe the linked datasets only while a consumer is subscribed. Store
    // changes can rewire this chain; application snapshots never enter state.
    const stopStore = subscribe("all", reconcile);
    reconcile();
    return () => {
      active = false;
      stopStore();
      for (const stop of dataSubscriptions.values()) stop();
      dataSubscriptions.clear();
    };
  };
  const interaction = (
    snapshot: WorkspaceState,
    id: string,
    kind: WorkspaceInteraction["kind"],
    visited = new Set<string>(),
  ): WorkspaceInteraction | null => {
    if (visited.has(id)) return null;
    visited.add(id);
    const incoming = Object.values(snapshot.bindings).find(
      (binding) => binding.target === id && binding.mode === kind,
    );
    return incoming
      ? interaction(snapshot, incoming.source, kind, visited)
      : snapshot.interactions[id]?.kind === kind
        ? snapshot.interactions[id]!
        : null;
  };
  const inputInteraction = (snapshot: WorkspaceState, id: string, kind: WorkspaceInteraction["kind"]): WorkspaceInteraction | null => {
    const link = Object.values(snapshot.bindings).find(binding => binding.target === id && binding.mode === kind);
    return link ? interaction(snapshot, link.source, kind) : null;
  };
  if (
    options.nodes?.length ||
    options.bindings?.length ||
    Object.keys(options.selections ?? {}).length ||
    Object.keys(options.interactions ?? {}).length
  ) {
    const initial: Operation[] = [
      ...(options.nodes ?? []).map((node) => ({
        type: "mount" as const,
        node,
      })),
      ...(options.bindings ?? []).map((binding) => ({
        type: "connect" as const,
        binding,
      })),
      ...Object.entries(options.selections ?? {}).map(([id, recordId]) => ({
        type: "select" as const,
        id,
        recordId,
      })),
      ...Object.entries(options.interactions ?? {}).flatMap(([id, payload]) =>
        payload ? [{ type: "interact" as const, id, payload }] : [],
      ),
    ];
    for (let offset = 0; offset < initial.length; offset += 100) {
      const result = apply({
        version: 1,
        baseRevision: state.revision,
        operations: initial.slice(offset, offset + 100),
      });
      if (!result.ok) throw new Error(result.error);
    }
    state = Object.freeze({ ...state, revision: 0 });
    past.length = 0;
    future.length = 0;
  }
  return {
    dataPort,
    registry,
    getState: () => state,
    getNode: (id) => state.nodes[id],
    getSelection: (id) => selection(state, id),
    getInteraction: (id, kind) => interaction(state, id, kind),
    getInputInteraction: (id, kind) => inputInteraction(state, id, kind),
    subscribeInputInteraction: (id, kind, listener) => {
      let current = inputInteraction(state, id, kind);
      return subscribe("all", () => {
        const next = inputInteraction(state, id, kind);
        if (JSON.stringify(next) !== JSON.stringify(current)) {
          current = next;
          notifyObserver(listener);
        }
      });
    },
    getFilters,
    subscribeFilters: (id, listener) => {
      let current = getFilters(id);
      return subscribe("all", () => {
        const next = getFilters(id);
        if (next !== current) {
          current = next;
          notifyObserver(listener);
        }
      });
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    subscribe: (listener) => subscribe("all", listener),
    subscribeNode: (id, listener) => subscribe(`node:${id}`, listener),
    subscribeOrder: (listener) => subscribe("order", listener),
    subscribeSelection,
    subscribeInteraction: (id, kind, listener) => {
      let current = interaction(state, id, kind);
      return subscribe("all", () => {
        const next = interaction(state, id, kind);
        if (JSON.stringify(next) !== JSON.stringify(current)) {
          current = next;
          notifyObserver(listener);
        }
      });
    },
    subscribeOperations: (listener) => {
      operationListeners.add(listener);
      return () => {
        operationListeners.delete(listener);
      };
    },
    apply: (request, control) => {
      const result = apply(request, control);
      for (const listener of [...operationListeners])
        notifyObserver(() => listener({ request, result }));
      return result;
    },
  };
}
