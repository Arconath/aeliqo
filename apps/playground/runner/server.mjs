import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {createReadStream, existsSync, statSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, resolve, sep} from 'node:path';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {createMcpHttpHandler} from '@aeliqo/agent/mcp';
import {createOpaqueModelSecret, createOpenAICompatibleToolModel, runToolModel} from '@aeliqo/agent/model';
import {RELEASE_VERSION} from '../../../scripts/release/metadata.mjs';
import {BrowserSessionBroker} from './broker.mjs';

const runnerRoot = fileURLToPath(new URL('..', import.meta.url));
const siteRoot = resolve(runnerRoot, '../site/dist');
const host = '127.0.0.1';
const port = Number(process.env.AELIQO_PLAYGROUND_PORT ?? '4174');
if (!Number.isSafeInteger(port) || port < 1024 || port > 65_535) throw new Error('AELIQO_PLAYGROUND_PORT must be an unprivileged TCP port.');
const origin = `http://${host}:${port}`;
const mcpToken = process.env.AELIQO_MCP_TOKEN ?? randomBytes(24).toString('base64url');
const sessionCookie = 'aeliqo_local_session';
const sessionLifetime = 15 * 60_000;
let session;
let activePrompt;

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.svg', 'image/svg+xml'], ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json'], ['.xml', 'application/xml; charset=utf-8'],
]);

function tokenMatches(candidate) {
  if (typeof candidate !== 'string') return false;
  const expected = createHash('sha256').update(mcpToken).digest();
  const received = createHash('sha256').update(candidate).digest();
  return timingSafeEqual(expected, received);
}

function requestToken(request) {
  const authorization = request.headers.authorization;
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
}

function cookieValue(request, name) {
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return undefined;
}

function allowedRequest(request) {
  const hostHeader = request.headers.host;
  if (hostHeader !== `${host}:${port}` && hostHeader !== `localhost:${port}`) return false;
  const requestOrigin = request.headers.origin;
  return requestOrigin === undefined || requestOrigin === origin || requestOrigin === `http://localhost:${port}`;
}

function currentSession(request, create = false) {
  const now = Date.now();
  if (session !== undefined && session.broker.expiresAt <= now) {
    session.broker.dispose();
    session = undefined;
  }
  const supplied = cookieValue(request, sessionCookie);
  if (session !== undefined && supplied === session.id) return session;
  if (!create) return undefined;
  session?.broker.dispose();
  const id = randomBytes(24).toString('base64url');
  session = {id, broker: new BrowserSessionBroker({expiresAt: now + sessionLifetime})};
  return session;
}

function sendJson(response, status, value, headers = {}) {
  response.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers});
  response.end(JSON.stringify(value));
}

async function readJson(request, maxBytes = 32_000) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error('payload-too-large');
    chunks.push(chunk);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-json');
  return value;
}

function modelConfiguration() {
  const apiKey = process.env.AELIQO_MODEL_API_KEY;
  const modelName = process.env.AELIQO_MODEL;
  const baseURL = process.env.AELIQO_MODEL_BASE_URL;
  if (apiKey === undefined && modelName === undefined && baseURL === undefined) return undefined;
  if (apiKey === undefined || modelName === undefined || baseURL === undefined) throw new Error('AELIQO_MODEL_API_KEY, AELIQO_MODEL, and AELIQO_MODEL_BASE_URL must be configured together.');
  const endpoint = new URL(baseURL);
  const insecure = endpoint.protocol === 'http:';
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(endpoint.hostname);
  if (endpoint.username !== '' || endpoint.password !== '') throw new Error('Model endpoint credentials must be supplied through AELIQO_MODEL_API_KEY, not the URL.');
  if (endpoint.protocol !== 'https:' && !insecure) throw new Error('Model endpoints must use HTTPS, or explicitly enabled HTTP on loopback.');
  if (insecure && (!loopback || process.env.AELIQO_ALLOW_INSECURE_MODEL_HTTP !== '1')) throw new Error('Plain HTTP model endpoints require an explicit loopback-only opt-in.');
  return createOpenAICompatibleToolModel({
    baseURL: endpoint.href,
    model: modelName,
    secret: createOpaqueModelSecret(apiKey),
    capabilities: ['tool-calls'],
    policy: {allowExternalEgress: true, allowedOrigins: [endpoint.origin], ...(insecure ? {allowInsecureHttp: true} : {})},
    budget: {maxRequestBytes: 128_000, maxResponseBytes: 128_000},
    timeoutMs: 30_000,
    retry: {maxAttempts: 1},
  });
}

const model = modelConfiguration();

async function runPrompt(prompt, broker, signal) {
  const result = await runToolModel({
    requestId: randomBytes(12).toString('hex'),
    goal: 'experience',
    prompt,
    instructions: 'Use aeliqo_context first. Then call aeliqo_render with one valid intent grounded only in discovered resources and fields. Never invent HTML, code, permissions, endpoints, or data. Do not claim success without the renderer receipt.',
    policy: {providerToolChoice: 'required', requiredOperationSequence: [
      {operation: 'catalog.read', acceptedStates: ['accepted']},
      {operation: 'task.evaluate', acceptedStates: ['renderer-ready']},
    ]},
    endpoint: broker.endpoint('byok'),
    model,
    budget: {maxTurns: 4, maxModelRequests: 4, maxToolCalls: 4, maxMilliseconds: 45_000, maxInputTokens: 32_000,
      maxOutputTokens: 2_000, maxTotalTokens: 36_000, maxInputBytes: 128_000, maxOutputBytes: 128_000, maxRepeatedCalls: 2},
    signal,
  });
  if (!result.ok) throw new Error(result.diagnostics[0]?.message ?? 'The model loop failed.');
  return {stop: result.value.stop, modelRequests: result.value.modelRequests, toolCalls: result.value.toolCalls};
}

const mcpResource = new URL('/mcp', origin);
const mcpHandler = createMcpHttpHandler({
  name: 'aeliqo-local-playground',
  version: RELEASE_VERSION,
  allowedHostnames: [host, 'localhost'],
  allowedOriginHostnames: [host, 'localhost'],
  resourceServerUrl: mcpResource,
  issuer: origin,
  authenticate(request) {
    const token = request.headers.get('authorization')?.replace(/^Bearer /u, '');
    if (!tokenMatches(token) || session === undefined || !session.broker.connected) return new Response(JSON.stringify({error: 'invalid_token'}), {status: 401});
    return {token, clientId: 'aeliqo-local-agent', scopes: ['mcp'], expiresAt: Math.floor(session.broker.expiresAt / 1000), resource: mcpResource, extra: {issuer: origin}};
  },
  createEndpoint() {
    if (session === undefined) throw new Error('No browser Region is paired.');
    return session.broker.endpoint('mcp');
  },
});

async function readBytes(request, maxBytes) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error('payload-too-large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, bytes);
}

async function nodeRequest(request) {
  const body = ['GET', 'HEAD'].includes(request.method ?? 'GET') ? undefined : await readBytes(request, 256_000);
  return new Request(new URL(request.url ?? '/', origin), {method: request.method, headers: request.headers, ...(body === undefined ? {} : {body})});
}

async function writeFetchResponse(result, response) {
  response.statusCode = result.status;
  for (const [name, value] of result.headers) response.setHeader(name, value);
  if (result.body === null) { response.end(); return; }
  Readable.fromWeb(result.body).pipe(response);
}

function serveStatic(pathname, response) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return false; }
  const relative = decoded.replace(/^\/+/, '');
  let path = resolve(siteRoot, relative);
  if (path !== siteRoot && !path.startsWith(`${siteRoot}${sep}`)) return false;
  if (existsSync(path) && statSync(path).isDirectory()) path = resolve(path, 'index.html');
  if (!existsSync(path) || !statSync(path).isFile()) return false;
  response.writeHead(200, {'content-type': contentTypes.get(extname(path)) ?? 'application/octet-stream', 'x-content-type-options': 'nosniff'});
  createReadStream(path).pipe(response);
  return true;
}

const server = createServer(async (request, response) => {
  try {
    if (!allowedRequest(request)) { sendJson(response, 403, {error: 'forbidden-origin'}); return; }
    const url = new URL(request.url ?? '/', origin);
    if (url.pathname === '/api/aeliqo/session' && request.method === 'GET') {
      if (!(request.headers.accept ?? '').split(',').some((value) => value.trim().startsWith('application/json'))) {
        sendJson(response, 406, {error: 'json-accept-required'});
        return;
      }
      const current = currentSession(request, true);
      sendJson(response, 200, {status: 'ready', modelConfigured: model !== undefined, expiresAt: current.broker.expiresAt},
        {'set-cookie': `${sessionCookie}=${current.id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=900`});
      return;
    }
    if (url.pathname === '/api/aeliqo/events' && request.method === 'GET') {
      const current = currentSession(request);
      if (current === undefined) { sendJson(response, 401, {error: 'session-required'}); return; }
      response.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no'});
      response.write(': connected\n\n');
      const heartbeat = setInterval(() => response.write(': keepalive\n\n'), 20_000);
      const attachment = current.broker.attach((event, value) => response.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`), () => response.end());
      if (attachment === undefined) { clearInterval(heartbeat); response.end(); return; }
      request.once('close', () => { clearInterval(heartbeat); if (session === current) current.broker.detach(attachment); });
      return;
    }
    if (url.pathname === '/api/aeliqo/ack' && request.method === 'POST') {
      const current = currentSession(request);
      if (current === undefined) { sendJson(response, 401, {error: 'session-required'}); return; }
      const body = await readJson(request, 70_000);
      sendJson(response, current.broker.acknowledge(body.id, body.outcome) ? 204 : 400, {});
      return;
    }
    if (url.pathname === '/api/aeliqo/prompt' && request.method === 'POST') {
      const current = currentSession(request);
      if (current === undefined || !current.broker.connected) { sendJson(response, 409, {error: 'browser-region-not-connected'}); return; }
      if (model === undefined) { sendJson(response, 503, {error: 'model-not-configured'}); return; }
      if (activePrompt !== undefined) { sendJson(response, 429, {error: 'prompt-already-running'}); return; }
      const body = await readJson(request, 8_000);
      if (typeof body.prompt !== 'string' || body.prompt.trim().length === 0 || body.prompt.length > 4_000) { sendJson(response, 400, {error: 'invalid-prompt'}); return; }
      const controller = new AbortController();
      activePrompt = controller;
      try { sendJson(response, 200, await runPrompt(body.prompt.trim(), current.broker, controller.signal)); }
      catch (error) { sendJson(response, 502, {error: 'model-run-failed', message: error instanceof Error ? error.message : 'The model run failed.'}); }
      finally { if (activePrompt === controller) activePrompt = undefined; }
      return;
    }
    if (url.pathname === '/api/aeliqo/disconnect' && request.method === 'POST') {
      const current = currentSession(request);
      activePrompt?.abort();
      if (current !== undefined) { current.broker.dispose(); if (session === current) session = undefined; }
      sendJson(response, 204, {}, {'set-cookie': `${sessionCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`});
      return;
    }
    if (url.pathname === '/api/aeliqo/bridge' && request.method === 'POST') {
      if (!tokenMatches(requestToken(request)) || session === undefined) { sendJson(response, 401, {error: 'invalid-token'}); return; }
      const body = await readJson(request);
      const endpoint = session.broker.endpoint('mcp');
      const outcome = body.operation === 'discover'
        ? await endpoint.discover()
        : body.operation === 'invoke' && typeof body.name === 'string' && typeof body.requestId === 'string'
          ? await endpoint.invoke(body.name, body.input, {requestId: body.requestId})
          : {ok: false, diagnostics: [{code: 'playground.local-bridge', message: 'The bridge operation is invalid.', retryable: false}]};
      sendJson(response, 200, outcome);
      return;
    }
    if (url.pathname === '/mcp') { await writeFetchResponse(await mcpHandler.fetch(await nodeRequest(request)), response); return; }
    if (request.method === 'GET' || request.method === 'HEAD') {
      if (serveStatic(url.pathname, response)) return;
      const notFound = resolve(siteRoot, '404.html');
      response.writeHead(404, {'content-type': 'text/html; charset=utf-8'});
      response.end(await readFile(notFound));
      return;
    }
    sendJson(response, 404, {error: 'not-found'});
  } catch (error) {
    sendJson(response, error instanceof Error && error.message === 'payload-too-large' ? 413 : 400, {error: 'invalid-request'});
  }
});

if (!existsSync(resolve(siteRoot, 'playground/index.html'))) throw new Error('Build the site before starting the local playground runner.');
server.listen(port, host, () => {
  process.stderr.write(`Aeliqo local playground: ${origin}/playground/\n`);
  process.stderr.write(`MCP HTTP: ${origin}/mcp (Bearer ${mcpToken})\n`);
  process.stderr.write(`MCP stdio: AELIQO_LOCAL_URL=${origin} AELIQO_MCP_TOKEN=${mcpToken} pnpm --dir apps/playground mcp:stdio\n`);
});

function shutdown() {
  activePrompt?.abort();
  session?.broker.dispose();
  mcpHandler.close();
  server.close();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
