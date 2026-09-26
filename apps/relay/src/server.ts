import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Diagnostic, Outcome } from '@aeliqo/core';
import type { McpHttpHandler } from '@aeliqo/agent/mcp';
import { createRelayMcpHandler } from './mcp.js';
import { corsHeaders, browserOriginAllowed, handlePreflight } from './cors.js';
import { bearerToken, clientKey, nodeRequest, readJson, sendJson, writeFetchResponse } from './http.js';
import { isSurface, type BridgeAck } from './protocol.js';
import { PairingRegistry, type RegistryOptions } from './registry.js';
import { RateLimiter, type RateLimiterOptions } from './rate-limit.js';

export interface RelayServerOptions {
  /** Canonical public origin (e.g. https://relay.aeliqo.com) used in minted URLs and MCP issuer pinning. */
  readonly publicOrigin?: string;
  /** Honor x-forwarded-for/x-forwarded-proto for client IPs and derived URLs; set only behind a trusted edge. */
  readonly trustProxy?: boolean;
  /** Optional Host allowlist enforced by the MCP handler; omit in dev. */
  readonly allowedHostnames?: readonly string[];
  readonly revision?: string;
  readonly registry?: PairingRegistry;
  readonly registryOptions?: RegistryOptions;
  readonly rateLimiter?: RateLimiter;
  readonly rateLimitOptions?: RateLimiterOptions;
  /** Lifecycle log sink; only token prefixes ever reach it. */
  readonly logger?: (line: string) => void;
}

export interface RelayServer {
  readonly server: Server;
  readonly registry: PairingRegistry;
  readonly close: () => void;
}

const BROWSER_METHODS = 'GET, POST, OPTIONS';
const HEARTBEAT_MS = 20_000;

interface Context {
  readonly publicOrigin: string | undefined;
  readonly trustProxy: boolean;
  readonly revision: string;
  readonly registry: PairingRegistry;
  readonly rateLimiter: RateLimiter;
  readonly mcp: McpHttpHandler;
  readonly log: (line: string) => void;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const first = raw?.split(',')[0]?.trim();
  return first === undefined || first.length === 0 ? undefined : first;
}

/**
 * Public base URL for minted attach/mcp URLs: the configured canonical origin in
 * production, else the request's own Host (loopback dev). Proto is https only
 * when a trusted edge says so.
 */
function requestOrigin(request: IncomingMessage, context: Context): string {
  if (context.publicOrigin !== undefined) return context.publicOrigin;
  if (!context.trustProxy) return `http://${firstHeader(request.headers.host) ?? 'localhost'}`;
  const host = firstHeader(request.headers['x-forwarded-host']) ?? firstHeader(request.headers.host) ?? 'localhost';
  const proto = firstHeader(request.headers['x-forwarded-proto']) ?? 'https';
  return `${proto}://${host}`;
}

function handlePair(request: IncomingMessage, response: ServerResponse, context: Context): void {
  if (!browserOriginAllowed(request)) {
    sendJson(response, 403, { error: 'forbidden-origin' });
    return;
  }
  const verdict = context.rateLimiter.allow(clientKey(request, context.trustProxy));
  if (!verdict.allowed) {
    sendJson(response, 429, { error: 'rate-limited' }, { 'retry-after': String(verdict.retryAfterSeconds) });
    return;
  }
  readJson(request, 4_000)
    .then((body) => {
      if (!isSurface(body.surface)) {
        sendJson(response, 400, { error: 'unknown-surface' }, corsHeaders(request));
        return;
      }
      const session = context.registry.pair(body.surface);
      if (session === undefined) {
        sendJson(response, 503, { error: 'pairing-capacity' }, corsHeaders(request));
        return;
      }
      const base = requestOrigin(request, context);
      context.log(`paired surface=${session.surface} token=${session.tokenPrefix}…`);
      sendJson(
        response,
        201,
        {
          token: session.token,
          surface: session.surface,
          attachUrl: `${base}/attach?token=${session.token}`,
          mcpUrl: `${base}/mcp`,
          expiresAt: session.expiresAt,
        },
        corsHeaders(request),
      );
    })
    .catch((error: unknown) =>
      sendJson(response, errorStatus(error), { error: 'invalid-request' }, corsHeaders(request)),
    );
}

function openEventStream(request: IncomingMessage, response: ServerResponse): void {
  response.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-store',
    'x-accel-buffering': 'no',
    ...corsHeaders(request),
  });
  response.write(': connected\n\n');
}

function handleAttach(request: IncomingMessage, response: ServerResponse, context: Context, url: URL): void {
  if (!browserOriginAllowed(request)) {
    sendJson(response, 403, { error: 'forbidden-origin' });
    return;
  }
  const session = context.registry.resolve(url.searchParams.get('token'));
  if (session === undefined) {
    sendJson(response, 401, { error: 'invalid_token' }, corsHeaders(request));
    return;
  }
  openEventStream(request, response);
  const heartbeat = setInterval(() => {
    if (response.writableEnded) {
      clearInterval(heartbeat);
      return;
    }
    response.write(': keepalive\n\n');
  }, HEARTBEAT_MS);
  const attachment = session.broker.attach(
    (event, value) => response.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`),
    () => response.end(),
  );
  if (attachment === undefined) {
    clearInterval(heartbeat);
    response.end();
    return;
  }
  context.log(`attached surface=${session.surface} token=${session.tokenPrefix}…`);
  request.once('close', () => {
    clearInterval(heartbeat);
    session.broker.detach(attachment);
    context.log(`detached surface=${session.surface} token=${session.tokenPrefix}…`);
  });
}

function errorDiagnostic(error: unknown): Diagnostic {
  if (error !== null && typeof error === 'object' && !Array.isArray(error)) {
    const record = error as Record<string, unknown>;
    return {
      code: typeof record.code === 'string' ? record.code.slice(0, 160) : 'aeliqo.remote-error',
      message: typeof record.message === 'string' ? record.message.slice(0, 4_096) : 'The tab reported an error.',
      retryable: false,
    };
  }
  return {
    code: 'aeliqo.remote-error',
    message: typeof error === 'string' ? error.slice(0, 4_096) : 'The tab reported an error.',
    retryable: false,
  };
}

/** Flat `{ok:false, error}` → a non-empty diagnostic list. */
function failureOutcome(error: unknown): Outcome<never> {
  const items = Array.isArray(error) ? error : [error];
  const mapped = items.slice(0, 16).map(errorDiagnostic);
  const diagnostics: [Diagnostic, ...Diagnostic[]] = [mapped[0] ?? errorDiagnostic(undefined), ...mapped.slice(1)];
  return { ok: false, diagnostics };
}

/**
 * Accept both the local-bridge shape `{id, outcome}` (so the playground client
 * code stays identical) and the flat hosted form `{id, ok, result|error}`.
 */
function normalizeAck(body: unknown): BridgeAck | undefined {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const record = body as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.length === 0 || record.id.length > 80) return undefined;
  if (typeof record.outcome === 'object' && record.outcome !== null)
    return { id: record.id, outcome: record.outcome as Outcome<unknown> };
  if (record.ok === true) return { id: record.id, outcome: { ok: true, value: record.result } };
  if (record.ok !== false) return undefined;
  return { id: record.id, outcome: failureOutcome(record.error) };
}

function handleAck(request: IncomingMessage, response: ServerResponse, context: Context): void {
  if (!browserOriginAllowed(request)) {
    sendJson(response, 403, { error: 'forbidden-origin' });
    return;
  }
  const session = context.registry.resolve(bearerToken(request));
  if (session === undefined) {
    sendJson(response, 401, { error: 'invalid_token' }, corsHeaders(request));
    return;
  }
  readJson(request, 70_000)
    .then((body) => {
      const ack = normalizeAck(body);
      if (ack === undefined) {
        sendJson(response, 400, { error: 'invalid-ack' }, corsHeaders(request));
        return;
      }
      const accepted = session.broker.acknowledge(ack.id, ack.outcome);
      sendJson(
        response,
        accepted ? 204 : 400,
        accepted ? {} : { error: 'unknown-or-stale-call' },
        corsHeaders(request),
      );
    })
    .catch((error: unknown) =>
      sendJson(response, errorStatus(error), { error: 'invalid-request' }, corsHeaders(request)),
    );
}

function errorStatus(error: unknown): number {
  return error instanceof Error && error.message === 'payload-too-large' ? 413 : 400;
}

async function handleMcp(request: IncomingMessage, response: ServerResponse, context: Context): Promise<void> {
  const compatible = await nodeRequest(request, requestOrigin(request, context));
  const result = await context.mcp.fetch(compatible);
  await writeFetchResponse(result, response);
}

type Route = {
  readonly method: 'GET' | 'POST';
  readonly pathname: string;
  readonly handle: (request: IncomingMessage, response: ServerResponse, context: Context, url: URL) => void;
};

const BROWSER_ROUTES: readonly Route[] = [
  { method: 'POST', pathname: '/pair', handle: handlePair },
  { method: 'GET', pathname: '/attach', handle: handleAttach },
  { method: 'POST', pathname: '/ack', handle: handleAck },
];

function dispatch(request: IncomingMessage, response: ServerResponse, context: Context): Promise<void> | void {
  const url = new URL(request.url ?? '/', 'http://relay.internal');
  if (request.method === 'OPTIONS' && BROWSER_ROUTES.some((route) => route.pathname === url.pathname)) {
    handlePreflight(request, response, BROWSER_METHODS);
    return;
  }
  for (const route of BROWSER_ROUTES) {
    if (url.pathname === route.pathname && request.method === route.method) {
      route.handle(request, response, context, url);
      return;
    }
  }
  if (url.pathname === '/mcp') return handleMcp(request, response, context);
  if (url.pathname === '/healthz' && request.method === 'GET') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }
  if (url.pathname === '/version' && request.method === 'GET') {
    sendJson(response, 200, { product: 'aeliqo-relay', revision: context.revision });
    return;
  }
  sendJson(response, 404, { error: 'not-found' });
}

async function dispatchSafely(request: IncomingMessage, response: ServerResponse, context: Context): Promise<void> {
  try {
    await dispatch(request, response, context);
  } catch (error) {
    if (response.headersSent) {
      response.end();
      return;
    }
    sendJson(response, errorStatus(error), { error: 'invalid-request' });
  }
}

/** Build the relay HTTP server: pairing, tab attach, ack, and the streamable-HTTP MCP boundary. */
export function createRelayServer(options: RelayServerOptions = {}): RelayServer {
  const log = options.logger ?? (() => {});
  const registryOptions = options.registryOptions ?? {};
  const registry =
    options.registry ??
    new PairingRegistry({
      ...registryOptions,
      onExpire: (session) => {
        registryOptions.onExpire?.(session);
        log(`expired surface=${session.surface} token=${session.tokenPrefix}…`);
      },
    });
  const context: Context = {
    publicOrigin: options.publicOrigin,
    trustProxy: options.trustProxy ?? false,
    revision: options.revision ?? 'dev',
    registry,
    rateLimiter: options.rateLimiter ?? new RateLimiter(options.rateLimitOptions ?? {}),
    mcp: createRelayMcpHandler({
      registry,
      publicOrigin: options.publicOrigin,
      allowedHostnames: options.allowedHostnames,
      version: options.revision ?? 'dev',
      onerror: (error) => log(`mcp-error ${error.message}`),
    }),
    log,
  };
  const server = createServer((request, response) => void dispatchSafely(request, response, context));
  return {
    server,
    registry,
    close() {
      registry.dispose();
      context.mcp.close();
      server.close();
      server.closeAllConnections();
    },
  };
}
