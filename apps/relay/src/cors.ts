import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Browser-facing CORS for /pair, /attach, and /ack. Only the public surfaces and
 * loopback origins may read responses; /mcp is server-to-server and emits none.
 * A request without an Origin header is not a browser CORS request and passes.
 */
const ALLOWED_SITE_ORIGINS = new Set(['https://aeliqo.com', 'https://docs.aeliqo.com']);
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isAllowedBrowserOrigin(origin: unknown): boolean {
  if (typeof origin !== 'string' || origin.length > 200) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol === 'https:' && ALLOWED_SITE_ORIGINS.has(url.origin)) return true;
  return (url.protocol === 'http:' || url.protocol === 'https:') && LOOPBACK_HOSTNAMES.has(url.hostname);
}

/** Origin gate for browser routes: absent Origin passes, a disallowed one is rejected outright. */
export function browserOriginAllowed(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  return origin === undefined || isAllowedBrowserOrigin(origin);
}

export function corsHeaders(request: IncomingMessage): Record<string, string> {
  const origin = request.headers.origin;
  if (origin === undefined || !isAllowedBrowserOrigin(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    vary: 'origin',
  };
}

/** Answer a CORS preflight for a browser route; writes no ACAO when the origin is not allowed. */
export function handlePreflight(request: IncomingMessage, response: ServerResponse, methods: string): void {
  const headers: Record<string, string> = {
    'cache-control': 'no-store',
    'access-control-max-age': '7200',
    ...corsHeaders(request),
  };
  if ('access-control-allow-origin' in headers) {
    headers['access-control-allow-methods'] = methods;
    headers['access-control-allow-headers'] = 'authorization, content-type';
  }
  response.writeHead(204, headers);
  response.end();
}
