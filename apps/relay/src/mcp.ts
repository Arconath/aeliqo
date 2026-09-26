import { createMcpHttpHandler, type McpHttpHandler, type McpHttpServerOptions } from '@aeliqo/agent/mcp';
import type { PairingRegistry } from './registry.js';

export interface RelayMcpOptions {
  readonly registry: PairingRegistry;
  /** Canonical public origin (e.g. https://relay.aeliqo.com); enables audience+issuer pinning when set. */
  readonly publicOrigin: string | undefined;
  /** Optional Host allowlist for the MCP endpoint; omitted in dev so loopback works. */
  readonly allowedHostnames: readonly string[] | undefined;
  readonly version: string;
  readonly onerror?: (error: Error) => void;
}

const invalidToken = () =>
  new Response(JSON.stringify({ error: 'invalid_token' }), {
    status: 401,
    headers: { 'content-type': 'application/json', 'www-authenticate': 'Bearer' },
  });

function requestToken(request: Request): string | undefined {
  const authorization = request.headers.get('authorization');
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
}

/**
 * The streamable-HTTP MCP boundary: bearer token → live tab session. A token
 * that is unknown, expired, or has no attached tab is `401 invalid_token`;
 * each MCP request then resolves the tab's pending `call` via POST /ack.
 */
export function createRelayMcpHandler(options: RelayMcpOptions): McpHttpHandler {
  const { registry, publicOrigin } = options;
  const mcpResource = publicOrigin === undefined ? undefined : new URL('/mcp', publicOrigin);
  const config: McpHttpServerOptions = {
    name: 'aeliqo-relay',
    version: options.version,
    ...(options.allowedHostnames === undefined ? {} : { allowedHostnames: options.allowedHostnames }),
    ...(publicOrigin === undefined ? {} : { issuer: publicOrigin }),
    ...(mcpResource === undefined ? {} : { resourceServerUrl: mcpResource }),
    ...(options.onerror === undefined ? {} : { onerror: options.onerror }),
    authenticate(request) {
      const token = requestToken(request);
      if (token === undefined) return invalidToken();
      const session = registry.resolve(token);
      if (session === undefined || !session.broker.connected) return invalidToken();
      return {
        token,
        clientId: 'aeliqo-relay-agent',
        scopes: ['mcp'],
        expiresAt: Math.floor(session.expiresAt / 1000),
        ...(mcpResource === undefined ? {} : { resource: mcpResource }),
        ...(publicOrigin === undefined ? {} : { extra: { issuer: publicOrigin } }),
      };
    },
    createEndpoint(context) {
      const token = context.authInfo?.token;
      const session = token === undefined ? undefined : registry.resolve(token);
      if (session === undefined) throw new Error('No browser tab is paired for this token.');
      return session.broker.endpoint();
    },
  };
  return createMcpHttpHandler(config);
}
