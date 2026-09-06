import { createCapabilityDispatcher, type DataPort, type WorkspaceStore } from "@aeliqo/core";
import { requestSchema, pairedSchema } from "./protocol.js";

export interface ConnectionOptions {
  url?: string;
  pairingToken?: string;
  rendererId?: string;
  dispatcher?: ReturnType<typeof createCapabilityDispatcher>;
  onStatus?: (status: "connected" | "disconnected") => void;
}

/** One connection to an app-owned workspace. All outcome semantics live in core. */
export function connectWorkspace(store: WorkspaceStore, _data: DataPort, options: ConnectionOptions = {}): () => void {
  let disposed = false;
  let socket: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let connection: AbortController | undefined;
  const ownsDispatcher = !options.dispatcher;
  const dispatcher = options.dispatcher ?? createCapabilityDispatcher(store);
  const workspaceId = dispatcher.presentation.workspaceId;
  const rendererId = options.rendererId;
  const connect = () => {
    if (disposed || !options.pairingToken || !rendererId) { options.onStatus?.("disconnected"); return; }
    const active = new WebSocket(options.url ?? "ws://127.0.0.1:4318");
    const controller = new AbortController();
    socket = active;
    connection = controller;
    const send = (value: unknown) => {
      if (!disposed && !controller.signal.aborted && active.readyState === WebSocket.OPEN)
        active.send(JSON.stringify(value));
    };
    let paired = false;
    active.onopen = () => send({type:"pair",token:options.pairingToken,workspaceId,rendererId});
    active.onmessage = async event => {
      if (disposed || controller.signal.aborted) return;
      if (!paired) {
        let value: unknown;
        try { value = JSON.parse(String(event.data)); }
        catch { active.close(1008, "Invalid pairing acknowledgement"); return; }
        const result = pairedSchema.safeParse(value);
        if (!result.success || result.data.workspaceId !== workspaceId || result.data.rendererId !== rendererId) {
          active.close(1008, "Invalid pairing acknowledgement"); return;
        }
        paired = true;
        options.onStatus?.("connected");
        return;
      }
      let request;
      try { request = requestSchema.parse(JSON.parse(String(event.data))); }
      catch { active.close(1008, "Invalid semantic request"); return; }
      if (request.target.workspaceId !== workspaceId || request.target.rendererId !== rendererId) {
        active.close(1008, "Workspace target mismatch"); return;
      }
      try {
        const result = await dispatcher.dispatchAsync(request.method, request.params, { source: request.source, requestId: request.id }, { signal: controller.signal });
        send({ id: request.id, ok: true, result });
      } catch (error) {
        send({ id: request.id, ok: false, error: error instanceof Error ? error.message : "Workspace request failed" });
      }
    };
    active.onclose = event => {
      controller.abort();
      if (disposed) return;
      options.onStatus?.("disconnected");
      if (event.code !== 1008) retry = setTimeout(connect, 1500);
    };
    active.onerror = () => active.close();
  };
  connect();
  return () => {
    disposed = true;
    clearTimeout(retry);
    connection?.abort();
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
    }
    if (ownsDispatcher) dispatcher.presentation.dispose();
  };
}
