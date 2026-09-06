import { z } from "zod";
import type { DataSnapshot, WorkspaceState, WorkspaceStore } from "./model";
import { validateSnapshot } from "./semantics";
import { notifyObserver } from "./observers";
import { nodeDatasetIds } from "./node-validation";

/** Runtime receipt schema shared by every adapter. Acknowledgement is not proof of human attention. */
export const receiptSchema = z.object({
  contractVersion: z.literal("0.2"),
  requestId: z.string().min(1).max(100),
  workspaceId: z.string().min(1).max(100),
  ok: z.boolean(),
  revision: z.number().int().nonnegative(),
  operation: z.enum(["committed", "rejected", "conflict"]),
  render: z.object({
    status: z.enum(["pending", "acknowledged", "failed", "disconnected"]),
    rendererId: z.string().optional(),
    revision: z.number().int().nonnegative().optional(),
    evidence: z.literal("renderer-ack").optional(),
    visible: z.boolean().optional(),
    reason: z.string().optional(),
  }).strict(),
  data: z.object({ status: z.enum(["not-required", "pending", "ready", "partial", "failed"]) }).strict(),
  outcome: z.enum(["pending", "presented", "failed"]),
  changedNodeIds: z.array(z.string()),
}).strict().superRefine((value, context) => {
  if (value.render.status === "acknowledged" && (!value.render.rendererId || value.render.revision !== value.revision || value.render.evidence !== "renderer-ack"))
    context.addIssue({ code: "custom", message: "Acknowledgement must identify the renderer and exact revision" });
  if (value.outcome === "presented" && (value.operation !== "committed" || !value.ok || value.render.status !== "acknowledged" || value.render.visible !== true || !["ready", "not-required"].includes(value.data.status)))
    context.addIssue({ code: "custom", message: "Presented requires a visible acknowledged commit and ready data" });
});
export type WorkspaceReceipt = z.infer<typeof receiptSchema>;
export interface RendererConnection {
  acknowledge(revision: number, options?: { visible?: boolean }): void;
  fail(revision: number, reason: string): void;
  disconnect(): void;
}
export interface PresentationTracker {
  readonly workspaceId: string;
  readonly disposed: boolean;
  connect(rendererId: string): RendererConnection;
  record(requestId: string, before: WorkspaceState, revision: number): WorkspaceReceipt;
  inspect(requestId: string): WorkspaceReceipt | undefined;
  wait(requestId: string, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<WorkspaceReceipt>;
  dispose(): void;
}
type Entry = {
  receipt: WorkspaceReceipt;
  datasets: readonly string[];
  presentedSnapshots?: readonly DataSnapshot[];
  observationFailed?: boolean;
};
function freezeReceipt(receipt: WorkspaceReceipt): WorkspaceReceipt {
  return Object.freeze({ ...receipt, render: Object.freeze(receipt.render), data: Object.freeze(receipt.data), changedNodeIds: Object.freeze([...receipt.changedNodeIds]) as unknown as string[] });
}

export function createPresentationTracker(store: WorkspaceStore, options: { workspaceId?: string; retention?: number } = {}): PresentationTracker {
  const workspaceId = options.workspaceId ?? "workspace";
  const retention = Math.max(1, Math.min(options.retention ?? 100, 100));
  const entries = new Map<string, Entry>();
  const waiters = new Map<string, Set<() => void>>();
  let disposed = false;
  let renderer: { id: string; token: object; revision?: number; visible?: boolean } | undefined;

  const dataStatus = (entry: Entry): WorkspaceReceipt["data"]["status"] => {
    if (entry.observationFailed) return "failed";
    if (!entry.datasets.length) return "not-required";
    let snapshots: readonly DataSnapshot[];
    try {
      snapshots = entry.datasets.map(id => {
        const dataset = store.dataPort.getDataset(id);
        if (!dataset) throw new Error("Dataset is unavailable");
        const snapshot = store.dataPort.getSnapshot(id);
        validateSnapshot(dataset, snapshot);
        return snapshot;
      });
    } catch { return "failed"; }
    if (snapshots.some(snapshot => snapshot.status === "error")) return "failed";
    if (snapshots.some(snapshot => snapshot.status === "loading")) return "pending";
    // Scope/quality are optional compatibility metadata; unknown adapter support is never inferred from row count.
    if (snapshots.some(snapshot => snapshot.stale || ["loaded-page", "sample"].includes(snapshot.scope ?? "") || (snapshot.totalCount !== undefined && snapshot.totalCount > snapshot.records.length))) return "partial";
    if (entry.presentedSnapshots && snapshots.some((snapshot, index) => snapshot !== entry.presentedSnapshots?.[index])) return "pending";
    return "ready";
  };
  const refresh = (entry: Entry): WorkspaceReceipt => {
    const data = { status: dataStatus(entry) };
    const render = entry.receipt.render;
    const outcome = render.status === "failed" || data.status === "failed" ? "failed" :
      render.status === "acknowledged" && render.visible === true && ["ready", "not-required"].includes(data.status) ? "presented" : "pending";
    entry.receipt = freezeReceipt({ ...entry.receipt, data, outcome });
    return entry.receipt;
  };
  const notify = () => { for (const group of [...waiters.values()]) for (const listener of [...group]) listener(); };
  const tracker: PresentationTracker = {
    workspaceId,
    get disposed() { return disposed; },
    connect(rendererId) {
      if (disposed) throw new Error("Presentation tracker is disposed");
      if (renderer) throw new Error("A renderer is already attached to this workspace");
      const token = {};
      renderer = { id: rendererId, token };
      return {
        acknowledge(revision, { visible = true } = {}) {
          if (renderer?.token !== token || revision !== store.getState().revision) return;
          renderer = { id: rendererId, token, revision, visible };
          for (const entry of entries.values()) {
            if (entry.receipt.revision !== revision || entry.receipt.operation !== "committed") continue;
            try { entry.presentedSnapshots = entry.datasets.map(id => store.dataPort.getSnapshot(id)); }
            catch { entry.presentedSnapshots = undefined; }
            entry.receipt = freezeReceipt({ ...entry.receipt, render: { status: "acknowledged", rendererId, revision, evidence: "renderer-ack", visible } });
            refresh(entry);
          }
          notify();
        },
        fail(revision, reason) {
          if (renderer?.token !== token) return;
          for (const entry of entries.values()) if (entry.receipt.revision === revision) {
            entry.receipt = freezeReceipt({ ...entry.receipt, render: { status: "failed", rendererId, revision, reason: reason.slice(0, 200) } });
            refresh(entry);
          }
          notify();
        },
        disconnect() {
          if (renderer?.token !== token) return;
          renderer = undefined;
          for (const entry of entries.values()) if (entry.receipt.outcome !== "presented") {
            entry.receipt = freezeReceipt({ ...entry.receipt, render: { status: "disconnected", rendererId, revision: entry.receipt.revision } });
            refresh(entry);
          }
          notify();
        },
      };
    },
    record(requestId, before, revision) {
      const existing = entries.get(requestId);
      if (existing) return refresh(existing);
      const after = store.getState();
      const ids = new Set([...before.order, ...after.order].filter(id => before.nodes[id] !== after.nodes[id] || before.order.indexOf(id) !== after.order.indexOf(id) || before.selections[id] !== after.selections[id] || before.interactions[id] !== after.interactions[id]));
      for (const id of new Set([...Object.keys(before.bindings), ...Object.keys(after.bindings)])) {
        if (before.bindings[id] === after.bindings[id]) continue;
        for (const binding of [before.bindings[id], after.bindings[id]]) if (binding) { ids.add(binding.source); ids.add(binding.target); }
      }
      for (const bindings of [before.bindings, after.bindings]) {
        let size = -1;
        while (size !== ids.size) {
          size = ids.size;
          for (const binding of Object.values(bindings)) if (ids.has(binding.source)) ids.add(binding.target);
        }
      }
      const datasets = [...new Set([...ids].flatMap(id => after.nodes[id] ? nodeDatasetIds(after.nodes[id]!) : []))];
      const entry: Entry = { datasets, receipt: freezeReceipt({ contractVersion: "0.2", requestId, workspaceId, ok: true, revision, operation: "committed", render: { status: renderer ? "pending" : "disconnected", revision }, data: { status: "pending" }, outcome: "pending", changedNodeIds: [...ids] }) };
      entries.set(requestId, entry);
      if (after.revision !== revision) entry.receipt = freezeReceipt({ ...entry.receipt, render: { status: "failed", revision, reason: "Revision superseded before renderer acknowledgement" } });
      while (entries.size > retention) {
        const oldest = entries.keys().next().value!;
        entries.delete(oldest);
        for (const check of [...(waiters.get(oldest) ?? [])]) check();
      }
      return refresh(entry);
    },
    inspect(requestId) { const entry = entries.get(requestId); return entry ? refresh(entry) : undefined; },
    wait(requestId, { timeoutMs = 250, signal } = {}) {
      const entry = entries.get(requestId);
      if (!entry) return Promise.reject(new Error("Unknown or expired receipt"));
      const current = refresh(entry);
      if (signal?.aborted || disposed || current.outcome !== "pending" || current.render.status === "disconnected") return Promise.resolve(current);
      return new Promise(resolve => {
        let finished = false;
        const cleanup: (() => void)[] = [];
        const finish = () => {
          if (finished) return;
          finished = true;
          for (const stop of cleanup) notifyObserver(stop);
          resolve(refresh(entry));
        };
        const check = () => { if (disposed || !entries.has(requestId) || refresh(entry).outcome !== "pending" || entry.receipt.render.status === "disconnected") finish(); };
        const group = waiters.get(requestId) ?? new Set<() => void>();
        waiters.set(requestId, group);
        group.add(check);
        cleanup.push(() => { group.delete(check); if (!group.size) waiters.delete(requestId); });
        const timer = setTimeout(finish, Math.max(0, Math.min(timeoutMs, 2000)));
        cleanup.push(() => clearTimeout(timer));
        if (signal) { signal.addEventListener("abort", finish, { once: true }); cleanup.push(() => signal.removeEventListener("abort", finish)); }
        try {
          for (const datasetId of entry.datasets) {
            if (finished) break;
            const stop = store.dataPort.subscribe(datasetId, check);
            // An adapter may notify synchronously while registering.
            if (finished) notifyObserver(stop);
            else cleanup.push(stop);
          }
        } catch {
          entry.observationFailed = true;
          finish();
        }
        check();
      });
    },
    dispose() { disposed = true; renderer = undefined; notify(); entries.clear(); },
  };
  return tracker;
}
