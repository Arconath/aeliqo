import {parseContract, WIRE_LIMITS} from '@aeliqo/sdk-core';
import type {Diagnostic, Outcome} from '@aeliqo/sdk-core';
import {DataStreamError, readResultStream} from './stream.js';
import type {ResultStreamLimits} from './stream.js';
import {
  parseAcceptedQuery, parseCatalogPage, parseCatalogRequest, parseDataError,
  parseJSON, parsePlanAcceptance, parsePlanRequest,
} from './schema.js';
import type {
  AcceptedQuery, DataErrorPayload, DataHttpHandler, DataHttpServerOptions, DataService,
  HttpDataPaths, HttpDataServiceOptions, QueryBudget, ReadContext, ResultEvent,
} from './types.js';

const DEFAULT_PATHS: HttpDataPaths = Object.freeze({
  describe: '/adc/describe', plan: '/adc/plan', execute: '/adc/execute',
});
const DEFAULT_RESPONSE_LIMITS = Object.freeze({
  bytes: WIRE_LIMITS.bytes, messageBytes: WIRE_LIMITS.bytes, messages: 64, rows: 10_000,
});
const encoder = new TextEncoder();
const failure = (code: string, message: string): Outcome<never> =>
  ({ok: false, diagnostics: [{code, message, retryable: false}]});
function reject(code: string, message: string): never {throw new DataStreamError(code, message);}
function diagnostics(error: unknown): readonly [Diagnostic, ...Diagnostic[]] {
  return [error instanceof DataStreamError ? error.diagnostic :
    {code: 'data.http-network', message: 'The ADC transport failed before completion.', retryable: false}];
}
function positive(value: number, name: string, ceiling = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > ceiling) throw new TypeError(`${name} must be a bounded positive integer.`);
  return value;
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}
const within = (effective: QueryBudget, requested: QueryBudget) =>
  (Object.keys(effective) as (keyof QueryBudget)[]).every(key => effective[key] <= requested[key]);

/** All pending host/transport calls race one deadline; callbacks receive its signal. */
class Lifetime {
  readonly controller = new AbortController();
  readonly signal = this.controller.signal;
  readonly startedAt = performance.now();
  private deadline: number;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private code = 'data.aborted';
  // Request implementations may weakly retain dependent signals. Keep their
  // owning Request reachable until the operation, including abort delivery, ends.
  private readonly requests = new Set<Request>();
  private readonly external: AbortSignal | undefined;
  private readonly forward = () => this.controller.abort();
  constructor(milliseconds: number, signal?: AbortSignal) {
    this.deadline = this.startedAt + milliseconds;
    this.external = signal;
    signal?.addEventListener('abort', this.forward, {once: true});
    if (signal?.aborted) this.forward();
    this.arm();
  }
  private arm() {
    clearTimeout(this.timer);
    const remaining = this.deadline - performance.now();
    if (remaining <= 0) {this.code = 'data.http-timeout'; this.controller.abort();}
    else this.timer = setTimeout(() => {this.code = 'data.http-timeout'; this.controller.abort();}, remaining);
  }
  tighten(milliseconds: number) {
    this.deadline = Math.min(this.deadline, this.startedAt + milliseconds);
    this.arm();
    this.check();
  }
  check() {
    if (performance.now() >= this.deadline && !this.signal.aborted) {
      this.code = 'data.http-timeout'; this.controller.abort();
    }
    if (this.signal.aborted) reject(this.code, this.code === 'data.aborted' ? 'The ADC request was cancelled.' : 'The ADC transport deadline expired.');
  }
  async wait<T>(operation: () => T | PromiseLike<T>): Promise<T> {
    this.check();
    return new Promise<T>((resolve, rejectPromise) => {
      let settled = false;
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        this.signal.removeEventListener('abort', abort);
        action();
      };
      const abort = () => finish(() => {
        try {this.check();} catch (error) {rejectPromise(error);}
      });
      this.signal.addEventListener('abort', abort, {once: true});
      // Invocation itself is guarded, including synchronous throws.
      try {
        Promise.resolve(operation()).then(value => finish(() => {
          try {this.check(); resolve(value);} catch (error) {rejectPromise(error);}
        }), error => finish(() => rejectPromise(error)));
      } catch (error) {finish(() => rejectPromise(error));}
    });
  }
  retainRequest(request: Request) {this.requests.add(request);}
  cancel() {this.controller.abort();}
  dispose() {this.requests.clear(); clearTimeout(this.timer); this.external?.removeEventListener('abort', this.forward);}
}

async function readText(body: ReadableStream<Uint8Array> | null, limit: number, life: Lifetime): Promise<string> {
  life.check();
  if (body === null) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', {fatal: true});
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await life.wait(() => reader.read());
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limit) reject('data.http-budget', 'The HTTP body exceeds its byte budget.');
      try {text += decoder.decode(chunk.value, {stream: true});}
      catch {reject('data.http-encoding', 'The HTTP body is not valid UTF-8.');}
    }
    try {return text + decoder.decode();}
    catch {return reject('data.http-encoding', 'The HTTP body is not valid UTF-8.');}
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
function unwrap<T>(result: Outcome<T>): T {
  if (!result.ok) {
    const first = result.diagnostics[0];
    reject(first.code, first.message);
  }
  return result.value;
}
function errorPayload(requestId: string, errors: readonly Diagnostic[]): DataErrorPayload {
  return {version: '1', requestId, diagnostics: [errors[0] ?? {code: 'data.http', message: 'The request failed.', retryable: false}, ...errors.slice(1)]};
}
const asError = (requestId: string, errors: readonly Diagnostic[]): ResultEvent =>
  ({kind: 'error', requestId, error: errorPayload(requestId, errors).diagnostics[0]});
function statusFor(errors: readonly Diagnostic[]): number {
  const code = errors[0]?.code ?? '';
  if (/denied|authorization|origin/.test(code)) return 403;
  if (/stale|cursor|expired/.test(code)) return 409;
  if (code.includes('unsupported')) return 422;
  if (code.includes('budget')) return 413;
  if (code.includes('timeout')) return 408;
  return 400;
}
function headers(contentType: string, origin?: string): Headers {
  const result = new Headers({'content-type': contentType, 'cache-control': 'no-store'});
  if (origin !== undefined) {result.set('access-control-allow-origin', origin); result.set('vary', 'Origin');}
  return result;
}
function json(value: unknown, status: number, origin?: string): Response {
  return new Response(JSON.stringify(value), {status, headers: headers('application/json; charset=utf-8', origin)});
}
function originUrl(value: string): URL {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash)
    throw new TypeError('ADC endpoints require an HTTP(S) URL without embedded credentials or a fragment.');
  return url;
}
function serverPaths(configured?: Partial<HttpDataPaths>): HttpDataPaths {
  const paths = {...DEFAULT_PATHS, ...configured};
  if (new Set(Object.values(paths)).size !== 3) throw new TypeError('ADC endpoint paths must be distinct.');
  for (const path of Object.values(paths)) {
    const url = new URL(path, 'https://adc.invalid');
    if (!path.startsWith('/') || path.startsWith('//') || url.origin !== 'https://adc.invalid' || url.pathname !== path || url.search || url.hash)
      throw new TypeError('ADC server paths must be absolute URL paths.');
  }
  return paths;
}
function streamLimits(accepted: AcceptedQuery, limits: ResultStreamLimits = DEFAULT_RESPONSE_LIMITS) {
  return {
    bytes: Math.min(limits.bytes, accepted.effectiveBudget.maxBytes),
    messageBytes: Math.min(limits.messageBytes, accepted.effectiveBudget.maxBytes),
    messages: Math.min(limits.messages, accepted.effectiveBudget.maxMessages),
    rows: Math.min(limits.rows, accepted.effectiveBudget.maxRows),
  };
}
function streamContext(accepted: AcceptedQuery, life: Lifetime, limits: ResultStreamLimits = DEFAULT_RESPONSE_LIMITS) {
  return {
    requestId: accepted.requestId, queryDigest: accepted.queryDigest, scopeDigest: accepted.scopeDigest,
    outputId: accepted.target.outputId, populationDigest: accepted.populationDigest,
    limits: streamLimits(accepted, limits), signal: life.signal,
  };
}

export function createDataHttpHandler(options: DataHttpServerOptions): DataHttpHandler {
  const paths = serverPaths(options.paths);
  const service = options.service;
  const authenticate = options.authenticate;
  const maximumBytes = positive(options.maxRequestBytes ?? WIRE_LIMITS.bytes, 'maxRequestBytes', WIRE_LIMITS.bytes);
  const milliseconds = positive(options.maxRequestMilliseconds ?? 30_000, 'maxRequestMilliseconds', 86_400_000);
  const maximumConcurrent = positive(options.maxConcurrentRequests ?? 32, 'maxConcurrentRequests', 10_000);
  const allowedOrigin = options.allowedOrigin;
  if (allowedOrigin !== undefined && originUrl(allowedOrigin).origin !== allowedOrigin)
    throw new TypeError('allowedOrigin must be one exact HTTP(S) origin.');
  let active = 0;
  return async request => {
    const pathname = new URL(request.url).pathname;
    if (!Object.values(paths).includes(pathname)) return json(errorPayload('unknown-request', [{code: 'data.route', message: 'The ADC endpoint was not found.', retryable: false}]), 404);
    const origin = request.headers.get('origin');
    if (allowedOrigin !== undefined && origin !== null && origin !== allowedOrigin)
      return json(errorPayload('unknown-request', [{code: 'data.origin', message: 'The request origin is not allowed.', retryable: false}]), 403);
    if (request.method === 'OPTIONS') {
      const result = headers('text/plain', allowedOrigin);
      result.set('access-control-allow-methods', 'POST, OPTIONS');
      result.set('access-control-allow-headers', 'content-type, authorization');
      return new Response(null, {status: 204, headers: result});
    }
    if (request.method !== 'POST') return json(errorPayload('unknown-request', [{code: 'data.method', message: 'The ADC endpoint requires POST.', retryable: false}]), 405, allowedOrigin);
    if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json')
      return json(errorPayload('unknown-request', [{code: 'data.content-type', message: 'ADC requests require application/json.', retryable: false}]), 415, allowedOrigin);
    if (active >= maximumConcurrent) return json(errorPayload('unknown-request', [{code: 'data.http-busy', message: 'The ADC host has reached its concurrent request limit.', retryable: true}]), 429, allowedOrigin);
    active++;
    const life = new Lifetime(milliseconds, request.signal);
    let finished = false;
    const finish = () => {if (!finished) {finished = true; active--; life.dispose();}};
    let streamed = false;
    let requestId = 'unknown-request';
    try {
      const raw = unwrap(parseJSON(await readText(request.body, maximumBytes, life), 'http-request'));
      const value = pathname === paths.describe ? unwrap(parseCatalogRequest(raw)) : pathname === paths.plan ? unwrap(parsePlanRequest(raw)) : unwrap(parseAcceptedQuery(raw));
      requestId = value.requestId;
      const budget = 'budget' in value ? value.budget : value.effectiveBudget;
      life.tighten(budget.maxMilliseconds);
      let principal: unknown;
      if (authenticate !== undefined) {
        let auth;
        const authRequest = new Request(request.url, {method: request.method, headers: request.headers, signal: life.signal});
        life.retainRequest(authRequest);
        try {auth = await life.wait(() => authenticate(authRequest));}
        catch (error) {
          if (error instanceof DataStreamError) throw error;
          reject('data.authorization', 'The ADC authentication failed.');
        }
        if (!auth.ok) return json(errorPayload(requestId, auth.diagnostics), statusFor(auth.diagnostics), allowedOrigin);
        principal = auth.value.principal;
      }
      const context: ReadContext = {signal: life.signal, ...(principal === undefined ? {} : {principal})};
      if (pathname === paths.describe || pathname === paths.plan) {
        const outcome = pathname === paths.describe
          ? await life.wait(() => service.describe(unwrap(parseCatalogRequest(value)), context))
          : await life.wait(() => service.plan(unwrap(parsePlanRequest(value)), context));
        life.check();
        if (!outcome.ok) return json(errorPayload(requestId, outcome.diagnostics), statusFor(outcome.diagnostics), allowedOrigin);
        const response = pathname === paths.describe ? unwrap(parseCatalogPage(outcome.value)) : unwrap(parsePlanAcceptance(outcome.value));
        if (response.requestId !== requestId || canonical(response.target) !== canonical(value.target) || !within(response.effectiveBudget, budget))
          reject('data.http-correlation', 'The ADC service response does not match its request.');
        const encoded = JSON.stringify(response);
        if (encoder.encode(encoded).byteLength > Math.min(maximumBytes, budget.maxBytes)) reject('data.http-budget', 'The ADC response exceeds its byte budget.');
        life.check();
        return new Response(encoded, {status: 200, headers: headers('application/json; charset=utf-8', allowedOrigin)});
      }
      const accepted = unwrap(parseAcceptedQuery(value));
      const iterator = service.execute(accepted, context)[Symbol.asyncIterator]();
      const cleanup = () => {
        life.cancel();
        // Application-owned iterators may stall during cleanup as well as reads.
        try {void Promise.resolve(iterator.return?.()).catch(() => {});} catch {}
      };
      const rawStream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const next = await life.wait(() => iterator.next());
            if (next.done) {controller.close(); return;}
            const event = unwrap(parseContract('result-event', next.value));
            controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
          } catch (error) {controller.error(error); cleanup();}
        },
        cancel() {cleanup();},
      });
      const events = readResultStream(rawStream, streamContext(accepted, life));
      // The deadline releases admission even if a disconnected consumer never pulls.
      const abort = () => {cleanup(); finish();};
      life.signal.addEventListener('abort', abort, {once: true});
      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const next = await life.wait(() => events.next());
            if (next.done) {controller.close(); life.signal.removeEventListener('abort', abort); finish(); return;}
            controller.enqueue(encoder.encode(JSON.stringify(next.value) + '\n'));
          } catch (error) {
            controller.enqueue(encoder.encode(JSON.stringify(asError(requestId, diagnostics(error))) + '\n'));
            controller.close();
            life.signal.removeEventListener('abort', abort);
            cleanup(); finish();
          }
        },
        cancel() {
          life.signal.removeEventListener('abort', abort);
          cleanup(); void events.return(undefined).catch(() => {}); finish();
        },
      });
      streamed = true;
      return new Response(stream, {status: 200, headers: headers('application/x-ndjson; charset=utf-8', allowedOrigin)});
    } catch (error) {
      const errors = diagnostics(error);
      return json(errorPayload(requestId, errors), statusFor(errors), allowedOrigin);
    } finally {if (!streamed) finish();}
  };
}

export function createHttpDataService(options: HttpDataServiceOptions): DataService {
  const base = originUrl(options.baseUrl);
  const configured = {...DEFAULT_PATHS, ...options.paths};
  const paths = Object.fromEntries(Object.entries(configured).map(([key, path]) => {
    const url = originUrl(new URL(path, base).href);
    if (url.origin !== base.origin) throw new TypeError('ADC endpoint overrides must stay on the configured origin.');
    return [key, url.href];
  })) as unknown as HttpDataPaths;
  const fetcher = options.fetch ?? globalThis.fetch;
  if (typeof fetcher !== 'function') throw new TypeError('An HTTP fetch implementation is required.');
  const customHeaders = new Headers(options.headers);
  customHeaders.set('content-type', 'application/json');
  const milliseconds = positive(options.maxRequestMilliseconds ?? 30_000, 'maxRequestMilliseconds', 86_400_000);
  const limits = {...DEFAULT_RESPONSE_LIMITS, ...options.responseLimits};
  for (const [name, value] of Object.entries(limits)) positive(value, name, name === 'messageBytes' ? WIRE_LIMITS.bytes : Number.MAX_SAFE_INTEGER);
  async function send(path: string, value: unknown, accept: string, life: Lifetime): Promise<Response> {
    const outgoingHeaders = new Headers(customHeaders);
    outgoingHeaders.set('accept', accept);
    const response = await life.wait(async () => {
      const received = await fetcher(path, {
        method: 'POST', headers: outgoingHeaders, body: JSON.stringify(value), redirect: 'error', signal: life.signal,
      });
      if (life.signal.aborted) {void received.body?.cancel().catch(() => {}); life.check();}
      if (received.body === null || received.url === '') return received;
      // Keep native streaming completion independent of the reader's cleanup.
      // Chromium can report a completed direct body read as ERR_ABORTED. A
      // synthetic in-process Response has no URL or native network loader. Tee
      // through Response.clone and immediately discard the unused branch, so
      // only the consumed branch can queue bytes. Never await the discard:
      // its cancellation promise may wait for the consumed branch to finish.
      const readable = received.clone();
      void received.body.cancel().catch(() => {});
      return readable;
    });
    if (response.redirected || (response.url && new URL(response.url).origin !== base.origin)) {
      void response.body?.cancel().catch(() => {});
      reject('data.http-origin', 'The ADC response came from an unexpected redirect or origin.');
    }
    return response;
  }
  async function errorResponse(response: Response, requestId: string, maximumBytes: number, life: Lifetime): Promise<Outcome<never>> {
    const error = unwrap(parseDataError(unwrap(parseJSON(await readText(response.body, maximumBytes, life), 'http-error'))));
    if (error.requestId !== requestId && error.requestId !== 'unknown-request') return failure('data.http-correlation', 'The ADC error response belongs to another request.');
    return {ok: false, diagnostics: error.diagnostics};
  }
  async function requestJSON<T>(path: string, value: {requestId: string; budget: QueryBudget}, parse: (input: unknown) => Outcome<T>, context: ReadContext): Promise<Outcome<T>> {
    const life = new Lifetime(Math.min(milliseconds, value.budget.maxMilliseconds), context.signal);
    try {
      const response = await send(path, value, 'application/json', life);
      const bytes = Math.min(limits.bytes, value.budget.maxBytes);
      if (!response.ok) return await errorResponse(response, value.requestId, bytes, life);
      if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        void response.body?.cancel().catch(() => {});
        return failure('data.http-content-type', 'The ADC host returned an unexpected response format.');
      }
      const result = parse(unwrap(parseJSON(await readText(response.body, bytes, life), 'http-response')));
      life.check();
      return result;
    } catch (error) {return {ok: false, diagnostics: diagnostics(error)};}
    finally {life.dispose();}
  }
  return {
    async describe(request, context = {}) {
      const parsed = parseCatalogRequest(request);
      if (!parsed.ok) return parsed;
      const result = await requestJSON(paths.describe, parsed.value, parseCatalogPage, context);
      if (!result.ok) return result;
      if (result.value.requestId !== parsed.value.requestId || canonical(result.value.target) !== canonical(parsed.value.target) ||
          (parsed.value.catalogRevision !== null && result.value.catalogRevision !== parsed.value.catalogRevision) ||
          result.value.catalog.revision !== result.value.catalogRevision || !within(result.value.effectiveBudget, parsed.value.budget))
        return failure('data.http-correlation', 'The ADC discovery response does not match its request, revision or budget.');
      return result;
    },
    async plan(request, context = {}) {
      const parsed = parsePlanRequest(request);
      if (!parsed.ok) return parsed;
      const result = await requestJSON(paths.plan, parsed.value, parsePlanAcceptance, context);
      if (!result.ok) return result;
      if (result.value.requestId !== parsed.value.requestId || result.value.catalogRevision !== parsed.value.catalogRevision ||
          canonical(result.value.target) !== canonical(parsed.value.target) || canonical(result.value.query) !== canonical(parsed.value.query) ||
          !within(result.value.effectiveBudget, parsed.value.budget))
        return failure('data.http-correlation', 'The ADC plan response does not match its request, query or budget.');
      return result;
    },
    async *execute(request, context = {}) {
      const parsed = parseAcceptedQuery(request);
      if (!parsed.ok) {yield asError('unknown-request', parsed.diagnostics); return;}
      const accepted = parsed.value;
      const life = new Lifetime(Math.min(milliseconds, accepted.effectiveBudget.maxMilliseconds), context.signal);
      let transportComplete = false;
      try {
        const response = await send(paths.execute, accepted, 'application/x-ndjson', life);
        if (!response.ok) {
          const error = await errorResponse(response, accepted.requestId, Math.min(limits.bytes, accepted.effectiveBudget.maxBytes), life);
          if (!error.ok) yield asError(accepted.requestId, error.diagnostics);
          return;
        }
        if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/x-ndjson')) {
          void response.body?.cancel().catch(() => {});
          reject('data.http-content-type', 'The ADC host returned an unexpected stream format.');
        }
        if (response.body === null) reject('data.http-body', 'The ADC host returned no result stream.');
        for await (const event of readResultStream(response.body, streamContext(accepted, life, limits))) {
          life.check();
          // readResultStream withholds terminal events until EOF is validated.
          // Mark completion before yielding: a handle may stop at that event.
          if (event.kind === 'complete' || event.kind === 'error') transportComplete = true;
          yield event;
        }
      } catch (error) {
        let errors = diagnostics(error);
        try {life.check();} catch (reason) {errors = diagnostics(reason);}
        yield asError(accepted.requestId, errors);
      }
      finally {if (!transportComplete) life.cancel(); life.dispose();}
    },
  };
}
export {DEFAULT_PATHS};
