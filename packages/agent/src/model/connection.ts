import type {
  ToolModelPort,
  ToolModelRequest,
  ToolModelResponse,
  ToolModelUsage,
} from './types.js';
import type {ToolModelCapability, ToolModelProtocolAdapter} from './protocol.js';

const secretValues = new WeakMap<object, string>();
declare const opaqueSecretBrand: unique symbol;

/** A server-owned credential handle. Its value is intentionally not enumerable or readable by callers. */
export interface OpaqueModelSecret {
  readonly kind: 'opaque';
  readonly [opaqueSecretBrand]: true;
}

export function createOpaqueModelSecret(value: string): OpaqueModelSecret {
  if (typeof window !== 'undefined') throw new Error('Model credentials must be created on a trusted server.');
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096 || value.trim() !== value || /[\u0000-\u001f\u007f]/u.test(value))
    throw new Error('The model credential is not a bounded opaque value.');
  const handle = Object.freeze({kind: 'opaque'}) as OpaqueModelSecret;
  secretValues.set(handle, value);
  return handle;
}

function readSecret(secret: OpaqueModelSecret): string {
  const value = secretValues.get(secret);
  if (value === undefined) throw new Error('The model credential handle is invalid.');
  return value;
}

export type ToolModelAuthScheme = 'bearer' | 'header';

export interface ToolModelAuth {
  readonly scheme: ToolModelAuthScheme;
  readonly secret: OpaqueModelSecret;
  readonly headerName?: string;
}

export interface ToolModelConnectionPolicy {
  /** This is a host grant. A model port never turns it on implicitly. */
  readonly allowExternalEgress: boolean;
  /** Plain HTTP is only accepted for an explicitly trusted local/test endpoint. */
  readonly allowInsecureHttp?: boolean;
  readonly allowedOrigins?: readonly string[];
}

export interface ToolModelConnectionBudget {
  readonly maxRequestBytes?: number;
  readonly maxResponseBytes?: number;
}

export interface ToolModelRetryPolicy {
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
}

export interface ToolModelCostPolicy {
  /** Rates below are expressed in USD. */
  readonly currency?: 'USD';
  readonly inputUSDPerMillion?: number;
  readonly outputUSDPerMillion?: number;
  readonly source?: string;
}

export type ToolModelFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface ToolModelProviderObservation {
  readonly protocol: string;
  readonly configuredModel: string;
  readonly providerModel?: string;
  readonly responseId?: string;
  readonly usage: ToolModelUsage;
}

export interface ToolModelConnectionOptions {
  readonly adapter: ToolModelProtocolAdapter;
  readonly baseURL: string;
  readonly model: string;
  readonly auth: ToolModelAuth;
  readonly policy: ToolModelConnectionPolicy;
  /** Host-declared features for this configured endpoint; never inferred from a vendor/model name. */
  readonly capabilities: readonly ToolModelCapability[];
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  readonly retry?: ToolModelRetryPolicy;
  readonly budget?: ToolModelConnectionBudget;
  readonly cost?: ToolModelCostPolicy;
  readonly fetch?: ToolModelFetch;
  /** Receives sanitized response metadata only; errors and credentials are excluded. */
  readonly onResponse?: (observation: ToolModelProviderObservation) => void;
}

export type ToolModelProviderErrorKind =
  | 'configuration'
  | 'authentication'
  | 'cancelled'
  | 'timeout'
  | 'network'
  | 'http'
  | 'malformed-response'
  | 'request-too-large'
  | 'response-too-large';

export class ToolModelProviderError extends Error {
  readonly kind: ToolModelProviderErrorKind;
  readonly retryable: boolean;
  readonly status?: number;
  readonly providerCode?: string;

  constructor(kind: ToolModelProviderErrorKind, message: string, options?: {readonly retryable?: boolean; readonly status?: number; readonly providerCode?: string}) {
    super(message);
    this.name = 'ToolModelProviderError';
    this.kind = kind;
    this.retryable = options?.retryable ?? false;
    if (options?.status !== undefined) this.status = options.status;
    if (options?.providerCode !== undefined && /^[A-Za-z0-9_.-]{1,128}$/u.test(options.providerCode)) this.providerCode = options.providerCode;
  }
}

export function isToolModelProviderError(value: unknown): value is ToolModelProviderError {
  return value instanceof ToolModelProviderError;
}

const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
const byteLength = (value: string): number => new TextEncoder().encode(value).byteLength;

function configuration(message: string): never {
  throw new ToolModelProviderError('configuration', message);
}

function normalizeBaseURL(value: string, policy: ToolModelConnectionPolicy): string {
  if (!text(value, 2048)) configuration('The model endpoint requires a bounded absolute URL.');
  let parsed: URL;
  try {parsed = new URL(value);} catch {configuration('The model endpoint URL is invalid.');}
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash)
    configuration('The model endpoint URL must not contain credentials, query parameters, or fragments.');
  if (parsed.protocol === 'http:' && policy.allowInsecureHttp !== true)
    configuration('The model endpoint requires explicit insecure-HTTP permission.');
  if (policy.allowedOrigins !== undefined) {
    if (policy.allowedOrigins.length === 0 || !policy.allowedOrigins.includes(parsed.origin)) configuration('The model endpoint origin is not allowlisted.');
    for (const origin of policy.allowedOrigins) {
      try {if (new URL(origin).origin !== origin) configuration('The model origin allowlist contains an invalid origin.');}
      catch {configuration('The model origin allowlist contains an invalid origin.');}
    }
  }
  return parsed.toString().replace(/\/$/u, '');
}

function endpointURL(baseURL: string, path: string): string {
  if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/u.test(path)) configuration('The model adapter endpoint path is invalid.');
  const value = new URL(`${baseURL}/`);
  return new URL(path.slice(1), value).toString();
}

function normalizeHeaders(headers: Readonly<Record<string, string>> | undefined, secret: string): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  if (headers === undefined) return result;
  for (const [name, value] of Object.entries(headers)) {
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/u.test(name) || !text(value, 4096) || value.includes(secret))
      configuration('The model connection contains an invalid or credential-bearing header.');
    const lower = name.toLowerCase();
    if (['authorization', 'cookie', 'proxy-authorization', 'set-cookie', 'content-length', 'content-type'].includes(lower))
      configuration('The model connection cannot override a protected HTTP header.');
    result[name] = value;
  }
  return Object.freeze(result);
}

function normalizeOptions(options: ToolModelConnectionOptions): Readonly<{
  adapter: ToolModelProtocolAdapter;
  baseURL: string;
  url: string;
  model: string;
  auth: ToolModelAuth;
  headers: Readonly<Record<string, string>>;
  timeoutMs: number;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  maxRequestBytes: number;
  maxResponseBytes: number;
  cost?: ToolModelCostPolicy;
  fetch: ToolModelFetch;
  onResponse?: (observation: ToolModelProviderObservation) => void;
}> {
  if (typeof window !== 'undefined') configuration('The model connection requires a trusted server.');
  if (!options || !options.adapter || !text(options.adapter.id, 128) || !text(options.adapter.endpointPath, 256)
    || typeof options.adapter.encodeRequest !== 'function' || typeof options.adapter.estimateInputTokens !== 'function' || typeof options.adapter.decodeResponse !== 'function')
    configuration('The model connection requires a complete protocol adapter.');
  if (options.policy?.allowExternalEgress !== true) configuration('The model connection requires an explicit egress grant.');
  if (!text(options.model, 160)) configuration('The model connection requires a bounded model identifier.');
  if (!options.auth || (options.auth.scheme !== 'bearer' && options.auth.scheme !== 'header'))
    configuration('The model connection requires an explicit authentication scheme.');
  const secret = readSecret(options.auth.secret);
  if (options.auth.scheme === 'header' && (!text(options.auth.headerName, 128) || ['authorization', 'cookie', 'proxy-authorization'].includes(options.auth.headerName.toLowerCase())))
    configuration('The model connection requires a safe authentication header.');
  const baseURL = normalizeBaseURL(options.baseURL, options.policy);
  const url = endpointURL(baseURL, options.adapter.endpointPath);
  const adapterCapabilities = new Set(options.adapter.capabilities);
  for (const capability of adapterCapabilities) if (!['tool-calls', 'usage', 'request-cancellation', 'input-token-estimate', 'request-retry'].includes(capability)) configuration('The model adapter declares an unknown capability.');
  if (!Array.isArray(options.capabilities) || options.capabilities.length === 0 || !options.capabilities.includes('tool-calls'))
    configuration('The model connection requires an explicit tool-calls capability declaration.');
  for (const capability of options.capabilities) if (!adapterCapabilities.has(capability)) configuration('The requested model capability is not supported by the adapter.');
  const timeoutMs = options.timeoutMs ?? 60_000;
  const maxAttempts = options.retry?.maxAttempts ?? 1;
  const baseDelayMs = options.retry?.baseDelayMs ?? 100;
  const maxDelayMs = options.retry?.maxDelayMs ?? 2_000;
  const maxRequestBytes = options.budget?.maxRequestBytes ?? 512 * 1024;
  const maxResponseBytes = options.budget?.maxResponseBytes ?? 2 * 1024 * 1024;
  if (!integer(timeoutMs, 1, 300_000) || !integer(maxAttempts, 1, 4) || !integer(baseDelayMs, 0, 5_000) || !integer(maxDelayMs, baseDelayMs, 30_000)
    || !integer(maxRequestBytes, 1, 8 * 1024 * 1024) || !integer(maxResponseBytes, 1, 8 * 1024 * 1024))
    configuration('The model connection limits are outside the supported bounds.');
  if (options.cost !== undefined && ((options.cost.currency !== undefined && options.cost.currency !== 'USD')
    || (options.cost.inputUSDPerMillion !== undefined && !number(options.cost.inputUSDPerMillion, 0, 1_000_000))
    || (options.cost.outputUSDPerMillion !== undefined && !number(options.cost.outputUSDPerMillion, 0, 1_000_000))
    || (options.cost.source !== undefined && !text(options.cost.source, 512)))) configuration('The model cost policy is invalid.');
  const fetch = options.fetch ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined);
  if (fetch === undefined) configuration('The model connection requires a fetch implementation.');
  const headers = normalizeHeaders(options.headers, secret);
  return Object.freeze({adapter: options.adapter, baseURL, url, model: options.model, auth: options.auth, headers, timeoutMs, maxAttempts, baseDelayMs, maxDelayMs, maxRequestBytes, maxResponseBytes, ...(options.cost === undefined ? {} : {cost: options.cost}), fetch,
    ...(options.onResponse === undefined ? {} : {onResponse: options.onResponse})});
}

function number(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function withToolModelCost(usage: ToolModelUsage, cost: ToolModelCostPolicy | undefined): ToolModelUsage {
  if (cost === undefined || (cost.inputUSDPerMillion === undefined && cost.outputUSDPerMillion === undefined)) return usage;
  const inputRate = cost.inputUSDPerMillion ?? 0;
  const outputRate = cost.outputUSDPerMillion ?? 0;
  const estimatedUSD = (usage.inputTokens * inputRate + usage.outputTokens * outputRate) / 1_000_000;
  return {...usage, cost: {currency: cost.currency ?? 'USD', estimatedUSD, ...(cost.inputUSDPerMillion === undefined ? {} : {inputUSDPerMillion: cost.inputUSDPerMillion}),
    ...(cost.outputUSDPerMillion === undefined ? {} : {outputUSDPerMillion: cost.outputUSDPerMillion}), ...(cost.source === undefined ? {} : {source: cost.source})}};
}

function linkAbort(parent: AbortSignal, controller: AbortController): () => void {
  const abort = () => controller.abort();
  if (parent.aborted) controller.abort();
  else parent.addEventListener('abort', abort, {once: true});
  return () => parent.removeEventListener('abort', abort);
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {reject(new ToolModelProviderError('cancelled', 'The model request was cancelled.')); return;}
    const timer = setTimeout(() => {signal.removeEventListener('abort', abort); resolve();}, milliseconds);
    const abort = () => {clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new ToolModelProviderError('cancelled', 'The model request was cancelled.'));};
    signal.addEventListener('abort', abort, {once: true});
  });
}

async function boundedText(response: Response, limit: number): Promise<string> {
  if (response.body === null) {
    const value = await response.text();
    if (byteLength(value) > limit) throw new ToolModelProviderError('response-too-large', 'The model response exceeded its byte limit.');
    return value;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let output = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) {output += decoder.decode(); break;}
      bytes += chunk.value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new ToolModelProviderError('response-too-large', 'The model response exceeded its byte limit.');
      }
      output += decoder.decode(chunk.value, {stream: true});
    }
  } finally {reader.releaseLock();}
  return output;
}

function providerCode(value: string): string | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    const source = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as {error?: unknown}).error : undefined;
    const code = source !== null && typeof source === 'object' && !Array.isArray(source)
      ? (source as {code?: unknown}).code : undefined;
    return typeof code === 'string' && /^[A-Za-z0-9_.-]{1,128}$/u.test(code) ? code : undefined;
  } catch {return undefined;}
}

async function httpError(response: Response): Promise<ToolModelProviderError> {
  const status = response.status;
  const retryable = status === 408 || status === 425 || status === 429 || status >= 500;
  let code: string | undefined;
  try {code = providerCode(await boundedText(response, 64 * 1024));} catch {/* Error bodies are never surfaced. */}
  return new ToolModelProviderError(status === 401 || status === 403 ? 'authentication' : 'http', `The model endpoint returned HTTP ${status}.`, {status, retryable: status === 401 || status === 403 ? false : retryable,
    ...(code === undefined ? {} : {providerCode: code})});
}

function normalizeFailure(error: unknown, timedOut: boolean, signal: AbortSignal): ToolModelProviderError {
  if (error instanceof ToolModelProviderError) return error;
  if (timedOut) return new ToolModelProviderError('timeout', 'The model request exceeded its timeout.', {retryable: true});
  if (signal.aborted) return new ToolModelProviderError('cancelled', 'The model request was cancelled.');
  return new ToolModelProviderError('network', 'The model endpoint could not be reached.', {retryable: true});
}

function requestHeaders(config: ReturnType<typeof normalizeOptions>): Record<string, string> {
  const result: Record<string, string> = {...config.headers, accept: 'application/json', 'content-type': 'application/json'};
  const secret = readSecret(config.auth.secret);
  if (config.auth.scheme === 'bearer') result.authorization = `Bearer ${secret}`;
  else result[config.auth.headerName!] = secret;
  return result;
}

function encodedRequest(config: ReturnType<typeof normalizeOptions>, request: ToolModelRequest): string {
  let value: unknown;
  try {value = config.adapter.encodeRequest({request, model: config.model});} catch {throw new ToolModelProviderError('malformed-response', 'The model request could not be encoded.');}
  let body: string;
  try {body = JSON.stringify(value);} catch {throw new ToolModelProviderError('malformed-response', 'The model request could not be encoded.');}
  if (typeof body !== 'string' || byteLength(body) > config.maxRequestBytes) throw new ToolModelProviderError('request-too-large', 'The model request exceeded its byte limit.');
  return body;
}

/** Build a server-only transport around any validated protocol adapter. */
export function createToolModelConnection(options: ToolModelConnectionOptions): ToolModelPort {
  const config = normalizeOptions(options);
  const complete = async (request: ToolModelRequest, {signal}: {readonly signal: AbortSignal}): Promise<ToolModelResponse> => {
    if (signal.aborted) throw new ToolModelProviderError('cancelled', 'The model request was cancelled.');
    const body = encodedRequest(config, request);
    const estimatedInputTokens = config.adapter.estimateInputTokens(request);
    if (!integer(estimatedInputTokens, 1, 1_000_000)) throw new ToolModelProviderError('malformed-response', 'The model adapter returned an invalid token estimate.');
    let last: ToolModelProviderError | undefined;
    for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
      const controller = new AbortController();
      const unlink = linkAbort(signal, controller);
      let timedOut = false;
      const timer = setTimeout(() => {timedOut = true; controller.abort();}, config.timeoutMs);
      try {
        const response = await config.fetch(config.url, {method: 'POST', redirect: 'error', headers: requestHeaders(config), body, signal: controller.signal});
        if (!response.ok) throw await httpError(response);
        let decoded: unknown;
        try {decoded = JSON.parse(await boundedText(response, config.maxResponseBytes)) as unknown;}
        catch (error) {
          if (error instanceof ToolModelProviderError) throw error;
          throw new ToolModelProviderError('malformed-response', 'The model endpoint returned invalid JSON.');
        }
        let result: ToolModelResponse;
        try {result = config.adapter.decodeResponse(decoded, {model: config.model, estimatedInputTokens});}
        catch {throw new ToolModelProviderError('malformed-response', 'The model endpoint returned a malformed response.');}
        const usage = withToolModelCost(result.usage, config.cost);
        const normalized = usage === result.usage ? result : {...result, usage, ...(result.provider === undefined ? {} : {provider: {...result.provider, usage}})};
        if (config.onResponse !== undefined) {
          try {
            config.onResponse(Object.freeze({protocol: config.adapter.id, configuredModel: config.model,
              ...(normalized.provider?.model === undefined ? {} : {providerModel: normalized.provider.model}),
              ...(normalized.provider?.responseId === undefined ? {} : {responseId: normalized.provider.responseId}), usage: normalized.usage}));
          } catch {/* Observability cannot change an accepted model response. */}
        }
        return normalized;
      } catch (error) {
        const normalized = normalizeFailure(error, timedOut, signal);
        last = normalized;
        if (!normalized.retryable || attempt + 1 >= config.maxAttempts) throw normalized;
        const backoff = Math.min(config.maxDelayMs, config.baseDelayMs * 2 ** attempt);
        await wait(backoff, signal);
      } finally {
        clearTimeout(timer);
        unlink();
      }
    }
    throw last ?? new ToolModelProviderError('network', 'The model endpoint could not be reached.', {retryable: true});
  };
  return Object.freeze({
    estimateInputTokens: (request: ToolModelRequest) => {
      const value = config.adapter.estimateInputTokens(request);
      if (!integer(value, 1, 1_000_000)) throw new ToolModelProviderError('malformed-response', 'The model adapter returned an invalid token estimate.');
      return value;
    },
    complete,
  });
}
