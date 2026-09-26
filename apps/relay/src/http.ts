import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

async function readBytes(request: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error('payload-too-large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, bytes);
}

/** Bounded JSON object body; throws 'payload-too-large' or 'invalid-json'. */
export async function readJson(request: IncomingMessage, maxBytes = 32_000): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse((await readBytes(request, maxBytes)).toString('utf8'));
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-json');
  return value as Record<string, unknown>;
}

export function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown,
  headers: Record<string, string> = {},
): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  response.end(JSON.stringify(value));
}

export function bearerToken(request: IncomingMessage): string | undefined {
  const authorization = request.headers.authorization;
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
}

function requestHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  return headers;
}

/** Adapt a node request into a fetch `Request` for the MCP handler's `fetch` entrypoint. */
export async function nodeRequest(request: IncomingMessage, origin: string): Promise<Request> {
  const raw = ['GET', 'HEAD'].includes(request.method ?? 'GET') ? undefined : await readBytes(request, 256_000);
  const body = raw === undefined ? undefined : new Uint8Array(raw);
  return new Request(new URL(request.url ?? '/', origin), {
    method: request.method ?? 'GET',
    headers: requestHeaders(request),
    ...(body === undefined ? {} : { body }),
  });
}

export async function writeFetchResponse(result: Response, response: ServerResponse): Promise<void> {
  response.statusCode = result.status;
  for (const [name, value] of result.headers) response.setHeader(name, value);
  if (result.body === null) {
    response.end();
    return;
  }
  Readable.fromWeb(result.body as unknown as import('node:stream/web').ReadableStream).pipe(response);
}

/** Client key for rate limiting: the socket peer, or the first forwarded hop when the proxy is trusted. */
export function clientKey(request: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = request.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
    if (first !== undefined && first.length > 0 && first.length <= 60) return first;
  }
  return request.socket.remoteAddress ?? 'unknown';
}
