import {
  createMcpHandler,
  hostHeaderValidationResponse,
  originValidationResponse,
  type AuthInfo,
  type CreateMcpHandlerOptions,
  type McpHandlerRequestOptions,
  type McpHttpHandler,
  McpServer,
  type McpRequestContext,
  type StandardSchemaWithJSON,
  type Tool,
} from '@modelcontextprotocol/server';
import {serveStdio, StdioServerTransport, type ServeStdioOptions, type StdioServerHandle} from '@modelcontextprotocol/server/stdio';
import {
  Client,
  type AuthProvider,
  type CacheableRequestOptions,
  type CallToolRequestOptions,
  type CallToolResult,
  type ClientOptions,
  type FetchLike,
  type RequestOptions,
  StreamableHTTPClientTransport,
  type StreamableHTTPClientTransportOptions,
  type Transport,
} from '@modelcontextprotocol/client';
import {StdioClientTransport, type StdioServerParameters} from '@modelcontextprotocol/client/stdio';
import {parseContract, parseWireValue, WIRE_LIMITS, type Diagnostic, type OperationGrant, type Outcome, type ResultRef, type VersionRef} from '@aeliqo/core';
import type {
  AgentCapabilityReceipt,
  AgentJsonValue,
} from '../capabilities/types.js';
import type {
  AgentToolCallOptions,
  AgentToolDefinition,
  AgentToolEndpoint,
  AgentToolInputSchema,
} from '../protocol/types.js';

/** The modern MCP revision implemented by the pinned SDK. */
export const AELIQO_MCP_MODERN_REVISION = '2026-07-28' as const;
/** The legacy family used by the pinned SDK's compatibility entry. */
export const AELIQO_MCP_LEGACY_REVISION = '2025-11-25' as const;
/** Metadata key used to carry host-authored binding data with an MCP tool. */
export const AELIQO_MCP_TOOL_META = 'com.aeliqo/agent-tool' as const;

const ADAPTER_VERSION = '1' as const;
const MAX_TEXT_BYTES = 256 * 1024;
const MAX_DEFINITION_COUNT = 256;
const MAX_DESCRIPTION_LENGTH = WIRE_LIMITS.text;
const DEFAULT_SERVER_NAME = 'aeliqo-agent';
const DEFAULT_SERVER_VERSION = '0.1.0';

type ProtocolEra = 'modern' | 'legacy';

/** Context supplied by the trusted host when a server instance is created. */
export interface McpEndpointFactoryContext {
  readonly era: ProtocolEra;
  /** Validated by the application-owned HTTP auth gate; absent for stdio. */
  readonly authInfo?: AuthInfo;
  /** The original HTTP request, when the SDK is serving HTTP. */
  readonly requestInfo?: Request;
}

export type McpEndpointFactory = (
  context: McpEndpointFactoryContext,
) => AgentToolEndpoint | Promise<AgentToolEndpoint>;

export interface McpServerFactoryOptions {
  /** A fresh host endpoint is requested for discovery and for every tool call. */
  readonly createEndpoint: McpEndpointFactory;
  readonly name?: string;
  readonly version?: string;
  /** Optional SDK server options; capabilities are merged with `tools`. */
  readonly serverOptions?: ConstructorParameters<typeof McpServer>[1];
}

export interface McpStdioServerOptions extends McpServerFactoryOptions {
  readonly legacy?: ServeStdioOptions['legacy'];
  readonly maxBufferSize?: number;
  readonly onerror?: (error: Error) => void;
}

export interface McpHttpAuthContext {
  readonly request: Request;
  readonly authInfo: AuthInfo;
}

/**
 * Authentication is deliberately an application hook. The adapter does not
 * parse a principal, mint a token, or turn wire metadata into authority. The
 * official SDK's `requireBearerAuth` can be supplied directly as this gate.
 */
export type McpHttpAuthGate = (
  request: Request,
) => Promise<AuthInfo | Response> | AuthInfo | Response;

export interface McpHttpServerOptions extends McpServerFactoryOptions {
  /** Required trusted authentication gate. */
  readonly authenticate: McpHttpAuthGate;
  /** Optional DNS-rebinding protection, expressed as hostnames without ports. */
  readonly allowedHostnames?: readonly string[];
  /** Optional browser-origin protection, expressed as hostnames without ports. */
  readonly allowedOriginHostnames?: readonly string[];
  /** RFC 8707 resource URI expected in the verified token, when configured. */
  readonly resourceServerUrl?: URL;
  /** Optional issuer value supplied by the host verifier in `AuthInfo.extra`. */
  readonly issuer?: string;
  readonly now?: () => number;
  readonly legacy?: 'stateless' | 'reject';
  readonly responseMode?: CreateMcpHandlerOptions['responseMode'];
  readonly onerror?: (error: Error) => void;
}

export interface McpClientEndpointOptions {
  readonly client: Client;
  readonly targetRegionId: string;
  readonly goalEpoch: string;
  readonly transport?: Transport;
}

export interface McpClientCommonOptions {
  readonly name?: string;
  readonly version?: string;
  readonly targetRegionId: string;
  readonly goalEpoch: string;
  readonly versionNegotiation?: ClientOptions['versionNegotiation'];
  readonly connectOptions?: RequestOptions;
}

export interface McpStdioClientOptions extends McpClientCommonOptions {
  readonly server: StdioServerParameters;
  readonly clientOptions?: Omit<ClientOptions, 'versionNegotiation'>;
}

export interface McpHttpClientOptions extends McpClientCommonOptions {
  readonly url: URL | string;
  readonly authProvider?: AuthProvider;
  readonly requestInit?: RequestInit;
  readonly fetch?: FetchLike;
  readonly transportOptions?: Omit<StreamableHTTPClientTransportOptions, 'authProvider' | 'requestInit' | 'fetch'>;
  readonly clientOptions?: Omit<ClientOptions, 'versionNegotiation'>;
}

interface ToolMetadata {
  readonly version: typeof ADAPTER_VERSION;
  readonly capability: VersionRef;
  readonly operation: OperationGrant;
}

interface AdapterEnvelope<T> {
  readonly version: typeof ADAPTER_VERSION;
  readonly outcome: Outcome<T>;
}

function failure<T>(code: string, message: string, path?: readonly (string | number)[]): Outcome<T> {
  const diagnostic: Diagnostic = {code, message, retryable: false, ...(path === undefined ? {} : {path: [...path]})};
  return {ok: false, diagnostics: [diagnostic]};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeJson(value: unknown): string | undefined {
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined || new TextEncoder().encode(encoded).byteLength > MAX_TEXT_BYTES) return undefined;
    return encoded;
  } catch {
    return undefined;
  }
}

function boundedWire(value: unknown): Outcome<unknown> {
  const checked = parseWireValue(value);
  if (!checked.ok) return checked;
  const encoded = safeJson(checked.value);
  return encoded === undefined ? failure('agent.mcp.bytes', 'The MCP payload exceeds its byte budget.') : checked;
}

function boundedText(value: unknown): Outcome<string> {
  if (typeof value !== 'string') return failure('agent.mcp.result', 'The MCP result text was malformed.');
  if (new TextEncoder().encode(value).byteLength > MAX_TEXT_BYTES) return failure('agent.mcp.bytes', 'The MCP result text exceeds its byte budget.');
  return {ok: true, value};
}

function validText(value: unknown, max: number = MAX_DESCRIPTION_LENGTH): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= WIRE_LIMITS.id && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

function cloneSchema(value: AgentToolInputSchema): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function localSchemaReferences(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(localSchemaReferences);
  return Object.entries(value).every(([key, child]) =>
    (key !== '$ref' || (typeof child === 'string' && child.startsWith('#')))
    && localSchemaReferences(child));
}

/**
 * The MCP SDK accepts Standard Schema objects. Endpoint schemas are already
 * host-authored JSON Schema, so this bridge advertises the schema verbatim and
 * leaves semantic validation to the endpoint's fresh dispatcher admission.
 */
function standardSchema(schema: AgentToolInputSchema): StandardSchemaWithJSON {
  const jsonSchema = cloneSchema(schema);
  return {
    '~standard': {
      version: 1,
      vendor: 'aeliqo',
      validate: (value: unknown) => ({value}),
      jsonSchema: {
        input: () => jsonSchema,
        output: () => jsonSchema,
      },
    },
  } as unknown as StandardSchemaWithJSON;
}

function toolMetadata(definition: AgentToolDefinition): Record<string, unknown> {
  return {
    [AELIQO_MCP_TOOL_META]: {
      version: ADAPTER_VERSION,
      capability: {id: definition.capability.id, revision: definition.capability.revision},
      operation: definition.operation,
    },
  };
}

function normalizeMetadata(value: unknown): Outcome<ToolMetadata> {
  if (!isRecord(value) || value.version !== ADAPTER_VERSION || !isRecord(value.capability)
    || !validId(value.capability.id) || !validId(value.capability.revision)) {
    return failure('agent.mcp.tool-metadata', 'The MCP tool does not carry a valid Aeliqo capability binding.');
  }
  const operation = parseContract('operation-grant', JSON.stringify(value.operation));
  if (!operation.ok) return failure('agent.mcp.tool-metadata', 'The MCP tool carries an unknown capability operation.');
  return {ok: true, value: Object.freeze({
    version: ADAPTER_VERSION,
    capability: Object.freeze({id: value.capability.id, revision: value.capability.revision}),
    operation: operation.value,
  })};
}

function normalizeTool(tool: Tool): Outcome<AgentToolDefinition> {
  if (!isRecord(tool) || !validId(tool.name) || !/^[A-Za-z0-9_-]{1,64}$/u.test(tool.name)) return failure('agent.mcp.tool', 'The MCP server returned a malformed tool name.');
  const schema = boundedWire(tool.inputSchema);
  if (!schema.ok || !isRecord(schema.value) || schema.value.type !== 'object' || !localSchemaReferences(schema.value)
    || (safeJson(schema.value) === undefined || new TextEncoder().encode(safeJson(schema.value) as string).byteLength > 65_536)) return failure('agent.mcp.tool', 'The MCP server returned a malformed input schema.');
  const metadata = normalizeMetadata(isRecord(tool._meta) ? tool._meta[AELIQO_MCP_TOOL_META] : undefined);
  if (!metadata.ok) return metadata;
  const description = tool.description === undefined ? tool.name : tool.description;
  if (!validText(description)) return failure('agent.mcp.tool', 'The MCP server returned a malformed tool description.');
  return {ok: true, value: Object.freeze({
    name: tool.name,
    description,
    capability: metadata.value.capability,
    operation: metadata.value.operation,
    inputSchema: Object.freeze(schema.value as AgentToolInputSchema),
  })};
}

function requestIdFromContext(context: {readonly mcpReq: {readonly id: string | number; readonly _meta?: Record<string, unknown>}}): string {
  const supplied = context.mcpReq._meta?.[AELIQO_MCP_TOOL_META];
  if (isRecord(supplied) && validId(supplied.requestId)) return supplied.requestId;
  return String(context.mcpReq.id);
}

function envelope<T>(outcome: Outcome<T>): AdapterEnvelope<T> {
  return {version: ADAPTER_VERSION, outcome};
}

function outcomeToCallToolResult<T>(outcome: Outcome<T>): CallToolResult {
  const body = envelope(outcome);
  const encoded = safeJson(body);
  const bounded = encoded === undefined ? envelope(failure<T>('agent.mcp.bytes', 'The MCP result exceeds its byte budget.')) : body;
  const text = encoded ?? JSON.stringify(bounded);
  return {
    isError: !bounded.outcome.ok,
    content: [{type: 'text', text}],
    structuredContent: bounded,
  };
}

function textFromResult(result: CallToolResult): Outcome<unknown> {
  if (!isRecord(result)) return failure('agent.mcp.result', 'The MCP server returned an invalid result.');
  if (result.structuredContent !== undefined) return boundedWire(result.structuredContent);
  if (!Array.isArray(result.content) || result.content.length > WIRE_LIMITS.array) return failure('agent.mcp.result', 'The MCP server returned malformed content.');
  if (safeJson(result.content) === undefined) return failure('agent.mcp.bytes', 'The MCP result content exceeds its byte budget.');
  const block = result.content.find((candidate) => isRecord(candidate) && candidate.type === 'text');
  if (!isRecord(block) || typeof block.text !== 'string') return failure('agent.mcp.result', 'The MCP server returned no bounded JSON result.');
  const bounded = boundedText(block.text);
  if (!bounded.ok) return bounded;
  try {
    return boundedWire(JSON.parse(bounded.value) as unknown);
  } catch {
    return failure('agent.mcp.result', 'The MCP server returned invalid JSON result text.');
  }
}

function normalizeResultRef(value: unknown): Outcome<ResultRef> {
  const checked = boundedWire(value);
  if (!checked.ok || !isRecord(checked.value)
    || !validId(checked.value.id) || !validId(checked.value.revision)
    || !validId(checked.value.outputId) || !validId(checked.value.queryDigest)
    || !validId(checked.value.scopeDigest)) return failure('agent.mcp.receipt', 'The MCP server returned a malformed result reference.');
  return {ok: true, value: Object.freeze({
    id: checked.value.id,
    revision: checked.value.revision,
    outputId: checked.value.outputId,
    queryDigest: checked.value.queryDigest,
    scopeDigest: checked.value.scopeDigest,
  })};
}

function normalizeDiagnostic(value: unknown): Outcome<Diagnostic> {
  const checked = boundedWire(value);
  if (!checked.ok || !isRecord(checked.value) || !validId(checked.value.code)
    || !validText(checked.value.message, WIRE_LIMITS.label) || typeof checked.value.retryable !== 'boolean') {
    return failure('agent.mcp.receipt', 'The MCP server returned malformed diagnostics.');
  }
  const diagnostic = checked.value;
  const code = diagnostic.code as string;
  const message = diagnostic.message as string;
  const retryable = diagnostic.retryable as boolean;
  if (diagnostic.path !== undefined) {
    if (!Array.isArray(diagnostic.path) || diagnostic.path.length > WIRE_LIMITS.depth
      || diagnostic.path.some((part: unknown) => (typeof part === 'string'
        ? part.length > WIRE_LIMITS.text || /[\u0000-\u001f\u007f]/u.test(part)
        : !(Number.isSafeInteger(part) && (part as number) >= 0)))) {
      return failure('agent.mcp.receipt', 'The MCP server returned malformed diagnostic paths.');
    }
  }
  if (diagnostic.remedies !== undefined
    && (!Array.isArray(diagnostic.remedies) || diagnostic.remedies.length > WIRE_LIMITS.diagnostics
      || diagnostic.remedies.some((remedy: unknown) => !validText(remedy, WIRE_LIMITS.label)))) {
    return failure('agent.mcp.receipt', 'The MCP server returned malformed diagnostic remedies.');
  }
  return {ok: true, value: Object.freeze({
    code,
    message,
    retryable,
    ...(diagnostic.path === undefined ? {} : {path: Object.freeze([...(diagnostic.path as (string | number)[])])}),
    ...(diagnostic.remedies === undefined ? {} : {remedies: Object.freeze([...(diagnostic.remedies as string[])])}),
  })};
}

function normalizeDiagnostics(value: unknown): Outcome<readonly Diagnostic[]> {
  if (!Array.isArray(value) || value.length > WIRE_LIMITS.diagnostics) return failure('agent.mcp.receipt', 'The MCP server returned malformed diagnostics.');
  const diagnostics: Diagnostic[] = [];
  for (const item of value) {
    const normalized = normalizeDiagnostic(item);
    if (!normalized.ok) return normalized;
    diagnostics.push(normalized.value);
  }
  return {ok: true, value: Object.freeze(diagnostics)};
}

function normalizeReceipt(
  value: unknown,
  expected: AgentToolCallOptions,
  expectedTool: AgentToolDefinition,
  targetRegionId: string,
  goalEpoch: string,
): Outcome<AgentCapabilityReceipt> {
  const checked = boundedWire(value);
  if (!checked.ok || !isRecord(checked.value)) return failure('agent.mcp.receipt', 'The MCP server returned a malformed receipt.');
  const receipt = checked.value;
  const states = new Set(['accepted', 'bound', 'data-ready', 'plan-committed', 'renderer-ready', 'partial', 'cancelled', 'failed', 'denied', 'stale', 'unsupported', 'invalid', 'needs-choice', 'needs-meaning']);
  if (receipt.version !== '1' || receipt.requestId !== expected.requestId || receipt.targetRegionId !== targetRegionId
    || receipt.goalEpoch !== goalEpoch || receipt.transport !== 'mcp' || !isRecord(receipt.capability)
    || !validId(receipt.capability.id) || !validId(receipt.capability.revision) || !validText(receipt.state, 32) || !states.has(receipt.state)
    || receipt.status !== receipt.state || receipt.stage !== receipt.state || !Array.isArray(receipt.diagnostics)) {
    return failure('agent.mcp.receipt', 'The MCP server returned an uncorrelated or malformed receipt.');
  }
  const operation = parseContract('operation-grant', JSON.stringify(receipt.operation));
  if (!operation.ok) return failure('agent.mcp.receipt', 'The MCP server returned an unknown receipt operation.');
  if (receipt.capability.id !== expectedTool.capability.id || receipt.capability.revision !== expectedTool.capability.revision
    || operation.value !== expectedTool.operation) return failure('agent.mcp.receipt', 'The MCP server returned a receipt for a different capability.');
  if ((receipt.state === 'plan-committed' || receipt.state === 'renderer-ready') && !validId(receipt.regionRevision))
    return failure('agent.mcp.receipt', 'The MCP server returned a committed receipt without a valid region revision.');
  if (receipt.regionRevision !== undefined && !validId(receipt.regionRevision)) return failure('agent.mcp.receipt', 'The MCP server returned a malformed region revision.');
  if (receipt.reason !== undefined && !validText(receipt.reason, WIRE_LIMITS.label)) return failure('agent.mcp.receipt', 'The MCP server returned a malformed receipt reason.');
  const diagnostics = normalizeDiagnostics(receipt.diagnostics);
  if (!diagnostics.ok) return diagnostics;
  let affectedResults: readonly ResultRef[] | undefined;
  if (receipt.affectedResults !== undefined) {
    if (!Array.isArray(receipt.affectedResults) || receipt.affectedResults.length > WIRE_LIMITS.outputs) return failure('agent.mcp.receipt', 'The MCP server returned malformed result references.');
    const refs: ResultRef[] = [];
    for (const ref of receipt.affectedResults) {
      const normalized = normalizeResultRef(ref);
      if (!normalized.ok) return normalized;
      refs.push(normalized.value);
    }
    affectedResults = Object.freeze(refs);
  }
  const wireOutput = receipt.value === undefined ? undefined : boundedWire(receipt.value);
  if (wireOutput !== undefined && !wireOutput.ok) return failure('agent.mcp.receipt', 'The MCP server returned non-wire receipt output.');
  const metadata = receipt.metadata === undefined ? undefined : boundedWire(receipt.metadata);
  if (metadata !== undefined && !metadata.ok) return failure('agent.mcp.receipt', 'The MCP server returned non-wire receipt metadata.');
  const output: AgentCapabilityReceipt = Object.freeze({
    version: '1',
    requestId: expected.requestId,
    targetRegionId,
    goalEpoch,
    capability: Object.freeze({id: receipt.capability.id, revision: receipt.capability.revision}),
    operation: operation.value,
    transport: 'mcp',
    state: receipt.state as AgentCapabilityReceipt['state'],
    status: receipt.state as AgentCapabilityReceipt['status'],
    stage: receipt.state as AgentCapabilityReceipt['stage'],
    diagnostics: diagnostics.value,
    ...(wireOutput === undefined ? {} : {value: wireOutput.value as AgentJsonValue}),
    ...(affectedResults === undefined ? {} : {affectedResults}),
    ...(receipt.regionRevision === undefined ? {} : {regionRevision: receipt.regionRevision as string}),
    ...(receipt.reason === undefined ? {} : {reason: receipt.reason as string}),
    ...(metadata === undefined ? {} : {metadata: metadata.value as AgentJsonValue}),
  });
  return {ok: true, value: output};
}

function resultToOutcome(result: CallToolResult, expected: AgentToolCallOptions, expectedTool: AgentToolDefinition, targetRegionId: string, goalEpoch: string): Outcome<AgentCapabilityReceipt> {
  const parsed = textFromResult(result);
  if (!parsed.ok) return parsed;
  const body = parsed.value;
  if (!isRecord(body) || body.version !== ADAPTER_VERSION || !('outcome' in body)) return failure('agent.mcp.result', 'The MCP server returned an unrecognized result envelope.');
  const rawOutcome = body.outcome;
  if (!isRecord(rawOutcome) || typeof rawOutcome.ok !== 'boolean') return failure('agent.mcp.result', 'The MCP server returned an invalid result outcome.');
  if (!rawOutcome.ok) {
    const diagnostics = normalizeDiagnostics(rawOutcome.diagnostics);
    if (!diagnostics.ok || diagnostics.value.length === 0) return failure('agent.mcp.result', 'The MCP server returned malformed failure diagnostics.');
    return {ok: false, diagnostics: diagnostics.value as [Diagnostic, ...Diagnostic[]]};
  }
  return normalizeReceipt(rawOutcome.value, expected, expectedTool, targetRegionId, goalEpoch);
}

function mergeServerOptions(options: McpServerFactoryOptions): ConstructorParameters<typeof McpServer>[1] {
  return {
    ...(options.serverOptions ?? {}),
    capabilities: {
      ...(options.serverOptions?.capabilities ?? {}),
      tools: {
        ...(options.serverOptions?.capabilities?.tools ?? {}),
        listChanged: true,
      },
    },
  };
}

/** Create the official SDK server factory used by both stdio and HTTP. */
export function createMcpServerFactory(options: McpServerFactoryOptions): (context: McpRequestContext) => Promise<McpServer> {
  if (options === null || typeof options !== 'object' || typeof options.createEndpoint !== 'function') throw new TypeError('MCP endpoint factory is required.');
  const name = options.name ?? DEFAULT_SERVER_NAME;
  const version = options.version ?? DEFAULT_SERVER_VERSION;
  if (!validId(name) || !validId(version)) throw new TypeError('MCP server identity is invalid.');
  return async (context: McpRequestContext): Promise<McpServer> => {
    const endpoint = await options.createEndpoint({era: context.era, ...(context.authInfo === undefined ? {} : {authInfo: context.authInfo}), ...(context.requestInfo === undefined ? {} : {requestInfo: context.requestInfo})});
    if (endpoint.transport !== 'mcp') {
      try { endpoint.close(); } catch { /* close is best effort on malformed host wiring */ }
      throw new TypeError('MCP endpoint factory returned an endpoint with the wrong transport.');
    }
    let discovered: Outcome<readonly AgentToolDefinition[]>;
    try {
      discovered = context.requestInfo?.signal === undefined
        ? await endpoint.discover()
        : await endpoint.discover({signal: context.requestInfo.signal});
    } finally {
      endpoint.close();
    }
    if (!discovered.ok) throw new Error('MCP capability discovery was denied or unavailable.');
    if (discovered.value.length > MAX_DEFINITION_COUNT) throw new Error('MCP capability discovery exceeded its tool budget.');
    const server = new McpServer({name, version}, mergeServerOptions(options));
    const names = new Set<string>();
    for (const definition of discovered.value) {
      if (!validId(definition.name) || names.has(definition.name) || !isRecord(definition.inputSchema)) throw new Error('MCP capability discovery returned duplicate or malformed tools.');
      names.add(definition.name);
      server.registerTool(definition.name, {
        description: definition.description,
        inputSchema: standardSchema(definition.inputSchema),
        _meta: toolMetadata(definition),
      }, async (input: unknown, callContext) => {
        const callEndpoint = await options.createEndpoint({era: context.era, ...(context.authInfo === undefined ? {} : {authInfo: context.authInfo}), ...(context.requestInfo === undefined ? {} : {requestInfo: context.requestInfo})});
        try {
          if (callEndpoint.transport !== 'mcp') return outcomeToCallToolResult(failure<AgentCapabilityReceipt>('agent.mcp.endpoint', 'MCP endpoint transport changed unexpectedly.'));
          const outcome = await callEndpoint.invoke(definition.name, input, {
            requestId: requestIdFromContext(callContext),
            signal: callContext.mcpReq.signal,
          });
          return outcomeToCallToolResult(outcome);
        } finally {
          callEndpoint.close();
        }
      });
    }
    return server;
  };
}

/** Start an official SDK stdio server. Protocol bytes are the only stdout data. */
export function createMcpStdioServer(options: McpStdioServerOptions): StdioServerHandle {
  const factory = createMcpServerFactory(options);
  const stdioOptions: ServeStdioOptions = {
    ...(options.legacy === undefined ? {} : {legacy: options.legacy}),
    ...(options.maxBufferSize === undefined ? {} : {transport: new StdioServerTransport(undefined, undefined, {maxBufferSize: options.maxBufferSize})}),
    ...(options.onerror === undefined ? {} : {onerror: options.onerror}),
  };
  // `maxBufferSize` belongs to the SDK transport constructor, which serveStdio
  // cannot expose without replacing its transport. Keep the option out of the
  // wire API rather than constructing an unowned transport here.
  void options.maxBufferSize;
  return serveStdio(factory, stdioOptions);
}

function canonicalResource(value: unknown): string | undefined {
  if (!isRecord(value) || typeof value.href !== 'string') return undefined;
  try {
    const resource = new URL(value.href);
    resource.hash = '';
    return resource.href;
  } catch {
    return undefined;
  }
}

function validateAuthInfo(authInfo: unknown, options: McpHttpServerOptions): Outcome<AuthInfo> {
  try {
    if (!isRecord(authInfo) || !validText(authInfo.token, WIRE_LIMITS.text) || !validId(authInfo.clientId)
      || !Array.isArray(authInfo.scopes) || authInfo.scopes.some((scope: unknown) => !validId(scope))
      || (authInfo.extra !== undefined && !isRecord(authInfo.extra))) return failure('agent.mcp.auth', 'The authentication gate returned malformed token metadata.');
    const clock = options.now?.() ?? Date.now();
    if (typeof clock !== 'number' || !Number.isFinite(clock)) return failure('agent.mcp.auth-clock', 'The MCP authentication clock is unavailable.');
    const nowSeconds = Math.floor(clock / 1000);
    if (!Number.isSafeInteger(nowSeconds) || typeof authInfo.expiresAt !== 'number' || !Number.isSafeInteger(authInfo.expiresAt)
      || authInfo.expiresAt <= nowSeconds) return failure('agent.mcp.auth-expired', 'The MCP authentication grant is expired.');
    if (authInfo.resource !== undefined && canonicalResource(authInfo.resource) === undefined)
      return failure('agent.mcp.auth-audience', 'The MCP authentication resource is malformed.');
    if (options.resourceServerUrl !== undefined) {
      const expected = canonicalResource(options.resourceServerUrl);
      const actual = canonicalResource(authInfo.resource);
      if (expected === undefined || actual === undefined || actual !== expected) return failure('agent.mcp.auth-audience', 'The MCP authentication audience does not match this resource.');
    }
    if (options.issuer !== undefined && authInfo.extra?.issuer !== options.issuer) return failure('agent.mcp.auth-issuer', 'The MCP authentication issuer is not trusted.');
    return {ok: true, value: authInfo as unknown as AuthInfo};
  } catch {
    return failure('agent.mcp.auth', 'The authentication gate returned malformed token metadata.');
  }
}

function authFailureResponse(): Response {
  return new Response(JSON.stringify({error: 'invalid_token'}), {
    status: 401,
    headers: {'content-type': 'application/json', 'www-authenticate': 'Bearer'},
  });
}

/**
 * Wrap the official fetch handler with application authentication and the SDK's
 * host/origin guards. The handler never derives identity from wire arguments.
 */
export function createMcpHttpHandler(options: McpHttpServerOptions): McpHttpHandler {
  if (options === null || typeof options !== 'object' || typeof options.authenticate !== 'function') throw new TypeError('An application-owned MCP authentication gate is required.');
  const factory = createMcpServerFactory(options);
  const inner = createMcpHandler(factory, {
    ...(options.legacy === undefined ? {} : {legacy: options.legacy}),
    ...(options.responseMode === undefined ? {} : {responseMode: options.responseMode}),
    ...(options.onerror === undefined ? {} : {onerror: options.onerror}),
  });
  return {
    fetch: async (request: Request, requestOptions?: McpHandlerRequestOptions): Promise<Response> => {
      if (options.allowedHostnames !== undefined) {
        const rejected = hostHeaderValidationResponse(request, [...options.allowedHostnames]);
        if (rejected !== undefined) return rejected;
      }
      if (options.allowedOriginHostnames !== undefined) {
        const rejected = originValidationResponse(request, [...options.allowedOriginHostnames]);
        if (rejected !== undefined) return rejected;
      }
      let auth: AuthInfo | Response;
      try {
        auth = await options.authenticate(request);
      } catch {
        return authFailureResponse();
      }
      if (auth instanceof Response) return auth;
      const checked = validateAuthInfo(auth, options);
      if (!checked.ok) return authFailureResponse();
      return inner.fetch(request, {...(requestOptions ?? {}), authInfo: checked.value});
    },
    close: inner.close,
    notify: inner.notify,
    bus: inner.bus,
  };
}

function clientOptions(options: McpClientCommonOptions & {readonly clientOptions?: Omit<ClientOptions, 'versionNegotiation'>}): ClientOptions {
  return {
    ...(options.clientOptions ?? {}),
    versionNegotiation: options.versionNegotiation ?? {mode: 'auto'},
  };
}

/** Adapt an already-connected official client into the shared endpoint port. */
export function createMcpClientEndpoint(options: McpClientEndpointOptions): AgentToolEndpoint {
  if (options === null || typeof options !== 'object' || !(options.client instanceof Client)) throw new TypeError('A connected MCP client is required.');
  if (!validId(options.targetRegionId) || !validId(options.goalEpoch)) throw new TypeError('MCP target binding is invalid.');
  let closed = false;
  let discoveredTools = new Map<string, AgentToolDefinition>();
  const endpoint: AgentToolEndpoint = {
    transport: 'mcp',
    targetRegionId: options.targetRegionId,
    goalEpoch: options.goalEpoch,
    discover: async (discoverOptions = {}) => {
      if (closed) return failure('agent.mcp.closed', 'The MCP client endpoint is closed.');
      if (discoverOptions.signal?.aborted) return failure('agent.mcp.cancelled', 'MCP capability discovery was cancelled.');
      discoveredTools = new Map();
      try {
        const listOptions: CacheableRequestOptions = {cacheMode: 'bypass'};
        if (discoverOptions.signal !== undefined) listOptions.signal = discoverOptions.signal;
        const result = await options.client.listTools({}, listOptions);
        if (closed) return failure('agent.mcp.closed', 'The MCP client endpoint is closed.');
        if (discoverOptions.signal?.aborted) return failure('agent.mcp.cancelled', 'MCP capability discovery was cancelled.');
        const definitions: AgentToolDefinition[] = [];
        const names = new Set<string>();
        if (result.tools.length > MAX_DEFINITION_COUNT) return failure('agent.mcp.discovery', 'MCP capability discovery exceeded its tool budget.');
        for (const tool of result.tools) {
          const normalized = normalizeTool(tool);
          if (!normalized.ok) return normalized;
          if (names.has(normalized.value.name)) return failure('agent.mcp.tool', 'The MCP server returned duplicate tool names.');
          names.add(normalized.value.name);
          definitions.push(normalized.value);
        }
        discoveredTools = new Map(definitions.map(definition => [definition.name, definition]));
        return {ok: true, value: Object.freeze(definitions)};
      } catch {
        discoveredTools = new Map();
        if (closed) return failure('agent.mcp.closed', 'The MCP client endpoint is closed.');
        if (discoverOptions.signal?.aborted) return failure('agent.mcp.cancelled', 'MCP capability discovery was cancelled.');
        return failure('agent.mcp.discovery', 'MCP capability discovery failed.');
      }
    },
    invoke: async (name: string, input: unknown, callOptions: AgentToolCallOptions) => {
      if (closed) return failure('agent.mcp.closed', 'The MCP client endpoint is closed.');
      if (!validId(name) || !validId(callOptions.requestId)) return failure('agent.mcp.call', 'MCP tool identity is invalid.');
      if (callOptions.signal?.aborted) return failure('agent.mcp.cancelled', 'MCP tool invocation was cancelled.');
      const definition = discoveredTools.get(name);
      if (definition === undefined) return failure('agent.mcp.discovery', 'MCP tool invocation requires a current discovered tool.');
      if (!isRecord(input)) return failure('agent.mcp.input', 'MCP tool arguments must be an object.');
      if (!boundedWire(input).ok) return failure('agent.mcp.bytes', 'MCP tool arguments exceed the wire budget.');
      try {
        const callRequestOptions: CallToolRequestOptions = {};
        if (callOptions.signal !== undefined) {
          callRequestOptions.signal = callOptions.signal;
          callRequestOptions.requestSignal = callOptions.signal;
        }
        const result = await options.client.callTool({
          name,
          arguments: input,
          _meta: {[AELIQO_MCP_TOOL_META]: {version: ADAPTER_VERSION, requestId: callOptions.requestId}},
        }, callRequestOptions);
        if (closed) return failure('agent.mcp.closed', 'The MCP client endpoint is closed.');
        if (callOptions.signal?.aborted) return failure('agent.mcp.cancelled', 'MCP tool invocation was cancelled.');
        return resultToOutcome(result, callOptions, definition, options.targetRegionId, options.goalEpoch);
      } catch (error) {
        if (closed) return failure('agent.mcp.closed', 'The MCP client endpoint is closed.');
        if (callOptions.signal?.aborted) return failure('agent.mcp.cancelled', 'MCP tool invocation was cancelled.');
        void error;
        return failure('agent.mcp.call', 'MCP tool invocation failed.');
      }
    },
    close: () => {
      if (closed) return;
      closed = true;
      void options.client.close().catch(() => undefined);
    },
  };
  return endpoint;
}

export async function connectMcpStdioClient(options: McpStdioClientOptions): Promise<AgentToolEndpoint> {
  const client = new Client({
    name: options.name ?? DEFAULT_SERVER_NAME,
    version: options.version ?? DEFAULT_SERVER_VERSION,
    ...clientOptions(options),
  });
  const transport = new StdioClientTransport(options.server);
  try {
    await client.connect(transport, options.connectOptions);
  } catch (error) {
    await Promise.allSettled([client.close(), transport.close()]);
    throw error;
  }
  try {
    return createMcpClientEndpoint({client, targetRegionId: options.targetRegionId, goalEpoch: options.goalEpoch, transport});
  } catch (error) {
    await Promise.allSettled([client.close(), transport.close()]);
    throw error;
  }
}

export async function connectMcpHttpClient(options: McpHttpClientOptions): Promise<AgentToolEndpoint> {
  const url = options.url instanceof URL ? options.url : new URL(options.url);
  const transportOptions: StreamableHTTPClientTransportOptions = {
    ...(options.transportOptions ?? {}),
    ...(options.authProvider === undefined ? {} : {authProvider: options.authProvider}),
    ...(options.requestInit === undefined ? {} : {requestInit: options.requestInit}),
    ...(options.fetch === undefined ? {} : {fetch: options.fetch}),
  };
  const transport = new StreamableHTTPClientTransport(url, transportOptions);
  const client = new Client({
    name: options.name ?? DEFAULT_SERVER_NAME,
    version: options.version ?? DEFAULT_SERVER_VERSION,
    ...clientOptions(options),
  });
  try {
    await client.connect(transport, options.connectOptions);
  } catch (error) {
    await Promise.allSettled([client.close(), transport.close()]);
    throw error;
  }
  try {
    return createMcpClientEndpoint({client, targetRegionId: options.targetRegionId, goalEpoch: options.goalEpoch, transport});
  } catch (error) {
    await Promise.allSettled([client.close(), transport.close()]);
    throw error;
  }
}

export type {AuthInfo, CallToolResult, McpHttpHandler, McpRequestContext, StdioServerHandle, StdioServerParameters, Tool, Transport};
