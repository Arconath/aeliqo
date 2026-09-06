import { z } from "zod";
import { patchSchema } from "./capabilities";
import { createWorkspace, type DataPort, type WorkspaceStore } from "./model";
import type { ComponentRegistry } from "./registry";

const documentSchema = z.object({
  version: z.literal(1),
  operations: z.array(z.unknown()).max(300),
}).strict();

/** Presentation only: records, credentials, revisions and history are never persisted. */
export function serializeWorkspace(store: WorkspaceStore): string {
  const state = store.getState();
  const operations = [
    ...state.order.map(id => ({ type: "mount", node: state.nodes[id] })),
    ...Object.values(state.bindings).map(binding => ({ type: "connect", binding })),
    ...Object.entries(state.selections).filter(([, recordId]) => recordId !== null).map(([id, recordId]) => ({ type: "select", id, recordId })),
  ];
  documentSchema.parse({ version: 1, operations });
  return JSON.stringify({ version: 1, operations });
}

/** Restore into a new runtime using current application data and registered capabilities. */
export function restoreWorkspace(serialized: string, options: { dataPort: DataPort; registry?: ComponentRegistry }): WorkspaceStore {
  if (serialized.length > 1_000_000) throw new Error("Workspace document exceeds size limit");
  const document = documentSchema.parse(JSON.parse(serialized));
  const temporary = createWorkspace(options);
  for (let offset = 0; offset < document.operations.length; offset += 30) {
    const request = patchSchema.parse({ version: 1, baseRevision: temporary.getState().revision, operations: document.operations.slice(offset, offset + 30) });
    if (request.operations.some(operation => !["mount", "connect", "select"].includes(operation.type))) throw new Error("Invalid persisted operation");
    const result = temporary.apply(request);
    if (!result.ok) throw new Error(result.error);
  }
  const snapshot = temporary.getState();
  return createWorkspace({ ...options, nodes: snapshot.order.map(id => snapshot.nodes[id]!), bindings: Object.values(snapshot.bindings), selections: snapshot.selections });
}
