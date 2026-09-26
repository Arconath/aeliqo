import { createRelayServer } from './server.js';

/**
 * Hosted MCP relay entrypoint. Configuration is env-only so the container image
 * stays a pure broker: no storage, no model calls, no secrets beyond the pair
 * tokens it mints.
 *
 *   PORT                      listen port (default 8080)
 *   HOST                      bind address (default 0.0.0.0)
 *   AELIQO_RELAY_PUBLIC_URL   canonical origin, e.g. https://relay.aeliqo.com —
 *                             required in production; pins MCP issuer/audience
 *   AELIQO_RELAY_HOSTNAMES    optional comma list of Host values /mcp accepts
 *   AELIQO_RELAY_TRUST_PROXY  '1' honors x-forwarded-for/proto behind an edge
 *   SOURCE_REVISION           reported by GET /version
 */
const port = Number(process.env.PORT ?? '8080');
if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) throw new Error('PORT must be a valid TCP port.');
const host = process.env.HOST ?? '0.0.0.0';
const publicOrigin = normalizeOrigin(process.env.AELIQO_RELAY_PUBLIC_URL);
const allowedHostnames = process.env.AELIQO_RELAY_HOSTNAMES?.split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0);
const revision = process.env.SOURCE_REVISION ?? 'dev';

const logger = (line: string): void => {
  process.stderr.write(`aeliqo-relay ${line}\n`);
};

function normalizeOrigin(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error('AELIQO_RELAY_PUBLIC_URL must be an http(s) origin.');
  return url.origin;
}

const relay = createRelayServer({
  ...(publicOrigin === undefined ? {} : { publicOrigin }),
  trustProxy: process.env.AELIQO_RELAY_TRUST_PROXY === '1',
  ...(allowedHostnames === undefined || allowedHostnames.length === 0 ? {} : { allowedHostnames }),
  revision,
  logger,
});

relay.server.listen(port, host, () => {
  const bound = relay.server.address();
  const shown = typeof bound === 'object' && bound !== null ? `${bound.address}:${bound.port}` : `${host}:${port}`;
  logger(`listening ${shown} public=${publicOrigin ?? 'request-host'} revision=${revision}`);
});

function shutdown(): void {
  relay.close();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
