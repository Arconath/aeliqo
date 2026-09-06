import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { receiptSchema } from "@aeliqo/core";
import {
  requestSchema,
  responseSchema,
  pairingSchema,
  type BridgeRequest,
} from "./protocol.js";

const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

export function localOrigins(origins: readonly string[] = defaultOrigins): Set<string> {
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.origin !== origin)
      throw new Error("Only explicit HTTP loopback origins are supported");
  }
  return new Set(origins);
}

/** Single active browser. Never acknowledges a write on behalf of the workspace. */
export class WorkspaceBridge {
  readonly ready: Promise<void>;
  private readonly wss: WebSocketServer;
  private socket: WebSocket | undefined;
  readonly pairingToken = randomBytes(32).toString("hex");
  readonly workspaceId = "workspace";
  private rendererId: string | undefined;
  private revoked = false;

  authorize(token: string | undefined): boolean {
    if (this.revoked || !token) return false;
    const supplied = Buffer.from(token);
    const expected = Buffer.from(this.pairingToken);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }

  revoke(): void {
    this.revoked = true;
    this.rejectPending("Workspace pairing revoked; outcome may be unknown");
    for (const socket of this.wss.clients) socket.close(1008, "Pairing revoked");
  }
  private readonly pending = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
      timer: ReturnType<typeof setTimeout>;
      method: BridgeRequest["method"];
    }
  >();

  constructor(
    port = 4318,
    private readonly timeoutMs = 5000,
    origins?: readonly string[],
  ) {
    const allowedOrigins = localOrigins(origins);
    this.wss = new WebSocketServer({
      host: "127.0.0.1",
      port,
      maxPayload: 1_000_000,
      verifyClient: ({
        origin,
        req,
      }: {
        origin: string;
        req: IncomingMessage;
      }) =>
        allowedOrigins.has(origin) &&
        /^127\.0\.0\.1(?::\d+)?$/.test(req.headers.host ?? ""),
    });
    this.ready = new Promise((resolve, reject) => {
      this.wss.once("listening", resolve);
      this.wss.once("error", reject);
    });
    this.wss.on("connection", (socket) => {
      let paired = false;
      const deadline = setTimeout(() => socket.close(1008, "Pairing required"), 5000);
      socket.on("message", (data) => {
        try {
          if (!paired) {
            const pairing = pairingSchema.parse(JSON.parse(data.toString()));
            if (!this.authorize(pairing.token) || pairing.workspaceId !== this.workspaceId ||
              (this.rendererId !== undefined && this.rendererId !== pairing.rendererId) ||
              this.socket?.readyState === WebSocket.OPEN) {
              socket.close(1008, "Pairing rejected");
              return;
            }
            clearTimeout(deadline);
            this.rendererId = pairing.rendererId;
            this.socket = socket;
            paired = true;
            socket.send(JSON.stringify({type:"paired",workspaceId:this.workspaceId,rendererId:this.rendererId}));
            return;
          }
          if (this.revoked || this.socket !== socket) { socket.close(1008, "Pairing revoked"); return; }
          const response = responseSchema.parse(JSON.parse(data.toString()));
          const pending = this.pending.get(response.id);
          if (!pending) return;
          clearTimeout(pending.timer);
          this.pending.delete(response.id);
          if (response.ok) {
            if (pending.method === "workspace_apply") {
              const receipt = receiptSchema.safeParse(response.result);
              if (!receipt.success || receipt.data.workspaceId !== this.workspaceId ||
                (receipt.data.render.status === "acknowledged" && receipt.data.render.rendererId !== this.rendererId)) {
                pending.reject(new Error("Untrusted workspace receipt target or renderer"));
                socket.close(1008, "Invalid receipt target");
                return;
              }
            }
            pending.resolve(response.result);
          }
          else
            pending.reject(
              new Error(response.error ?? "Workspace rejected the request"),
            );
        } catch {
          socket.close(1008, "Invalid workspace response");
        }
      });
      socket.on("close", () => {
        clearTimeout(deadline);
        if (this.socket === socket) {
          this.socket = undefined;
          this.rejectPending("Workspace disconnected before acknowledgement");
        }
      });
      socket.on("error", () => socket.close());
    });
  }

  get connected(): boolean { return this.socket?.readyState === WebSocket.OPEN; }

  get port(): number {
    const address = this.wss.address();
    if (typeof address !== "object" || address === null)
      throw new Error("Bridge is not listening");
    return address.port;
  }

  async request(
    method: BridgeRequest["method"],
    params: unknown,
    source: "MCP" | "BYOK" = "MCP",
  ): Promise<unknown> {
    const socket = this.socket;
    if (this.revoked || !socket || socket.readyState !== WebSocket.OPEN || !this.rendererId)
      throw new Error(
        "No playground connected to the authorized pairing. Open the companion pairing URL first.",
      );
    const request = requestSchema.parse({ id: randomUUID(), target: {workspaceId:this.workspaceId,rendererId:this.rendererId}, method, params, source });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request.id);
        reject(
          new Error(
            "Workspace acknowledgement timed out; mutation outcome is unknown. Inspect before retrying.",
          ),
        );
      }, this.timeoutMs);
      this.pending.set(request.id, { resolve, reject, timer, method });
      socket.send(JSON.stringify(request), (error) => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(request.id);
          reject(error);
        }
      });
    });
  }

  private rejectPending(message: string): void {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error(message));
    }
    this.pending.clear();
  }

  async close(): Promise<void> {
    this.rejectPending("Bridge closed");
    for (const socket of this.wss.clients) socket.terminate();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }
}
