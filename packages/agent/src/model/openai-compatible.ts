import {parseWireValue, WIRE_LIMITS} from '@aeliqo/core';
import type {AgentJsonValue} from '../capabilities/types.js';
import {
  createToolModelConnection,
  type OpaqueModelSecret,
  type ToolModelAuthScheme,
  type ToolModelConnectionBudget,
  type ToolModelConnectionPolicy,
  type ToolModelCostPolicy,
  type ToolModelFetch,
  type ToolModelProviderObservation,
  type ToolModelRetryPolicy,
} from './connection.js';
import type {ToolModelCapability, ToolModelProtocolAdapter, ToolModelResponseContext} from './protocol.js';
import type {ToolModelCall, ToolModelPort, ToolModelRequest, ToolModelResponse, ToolModelUsage} from './types.js';

export const OPENAI_COMPATIBLE_CHAT_PROTOCOL = 'openai-compatible-chat' as const;

const MAX_RESPONSE_CHOICES = 8;
const MAX_TOOL_CALLS = 8;
const MAX_ID_LENGTH = 256;
const MAX_TEXT_LENGTH = WIRE_LIMITS.text;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value: unknown, maximum: number = MAX_TEXT_LENGTH): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function validInteger(value: unknown, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function json(value: unknown): string {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('The protocol value is not JSON serializable.');
  return encoded;
}

function inputMessage(message: ToolModelRequest['messages'][number]): Record<string, unknown> {
  if (message.role === 'user') return {role: 'user', content: message.text};
  if (message.role === 'tool') return {role: 'tool', tool_call_id: message.callId, content: json(message.output)};
  return {
    role: 'assistant',
    ...(message.text === undefined ? {content: null} : {content: message.text}),
    ...(message.calls.length === 0 ? {} : {
      tool_calls: message.calls.map(call => ({
        id: call.id,
        type: 'function',
        function: {name: call.name, arguments: json(call.input)},
      })),
    }),
  };
}

function functionTool(tool: ToolModelRequest['tools'][number]): Record<string, unknown> {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}

function encodeRequest(input: {readonly request: ToolModelRequest; readonly model: string}): unknown {
  return {
    model: input.model,
    messages: input.request.messages.map(inputMessage),
    tools: input.request.tools.map(functionTool),
    tool_choice: 'auto',
    parallel_tool_calls: false,
    max_tokens: input.request.maxOutputTokens,
    stream: false,
  };
}

function estimateRequestBytes(request: ToolModelRequest): number {
  return new TextEncoder().encode(json(encodeRequest({request, model: 'model'}))).byteLength;
}

function estimateInputTokens(request: ToolModelRequest): number {
  return Math.max(1, Math.min(1_000_000, Math.ceil(estimateRequestBytes(request) / 4)));
}

function malformed(message: string): never {
  // The connection normalizes arbitrary adapter failures. This error message
  // is intentionally generic so provider payloads cannot become diagnostics.
  throw new Error(message);
}

function tokenEstimate(value: unknown, maximum: number): number {
  try {
    return Math.max(1, Math.min(maximum, Math.ceil(new TextEncoder().encode(json(value)).byteLength / 4)));
  } catch {
    return 1;
  }
}

function providerUsage(raw: unknown, context: ToolModelResponseContext, text: string | undefined, calls: readonly ToolModelCall[]): ToolModelUsage {
  const usage = object(raw) ? raw : undefined;
  const inputTokens = usage !== undefined && validInteger(usage.prompt_tokens, 1_000_000) ? usage.prompt_tokens : context.estimatedInputTokens;
  const outputTokens = usage !== undefined && validInteger(usage.completion_tokens, 100_000)
    ? usage.completion_tokens : tokenEstimate({text: text ?? null, calls}, 100_000);
  const cachedInputTokens = usage !== undefined && object(usage.prompt_tokens_details)
    && validInteger(usage.prompt_tokens_details.cached_tokens, inputTokens) ? usage.prompt_tokens_details.cached_tokens : undefined;
  const reasoningOutputTokens = usage !== undefined && object(usage.completion_tokens_details)
    && validInteger(usage.completion_tokens_details.reasoning_tokens, outputTokens) ? usage.completion_tokens_details.reasoning_tokens : undefined;
  const totalTokens = usage !== undefined && validInteger(usage.total_tokens, 1_100_000) ? usage.total_tokens : inputTokens + outputTokens;
  return Object.freeze({
    inputTokens,
    outputTokens,
    totalTokens,
    inputTokenSource: usage !== undefined && validInteger(usage.prompt_tokens, 1_000_000) ? 'provider' as const : 'estimated' as const,
    outputTokenSource: usage !== undefined && validInteger(usage.completion_tokens, 100_000) ? 'provider' as const : 'estimated' as const,
    ...(cachedInputTokens === undefined ? {} : {cachedInputTokens}),
    ...(reasoningOutputTokens === undefined ? {} : {reasoningOutputTokens}),
  });
}

function decodeResponse(input: unknown, context: ToolModelResponseContext): ToolModelResponse {
  if (!object(input) || !Array.isArray(input.choices) || input.choices.length === 0 || input.choices.length > MAX_RESPONSE_CHOICES)
    return malformed('choices');
  const choice = input.choices[0];
  if (!object(choice) || !object(choice.message)) return malformed('message');
  const message = choice.message;
  const text = message.content === null || message.content === undefined || message.content === '' ? undefined
    : boundedText(message.content) ? message.content : malformed('content');
  if (message.tool_calls !== undefined && (!Array.isArray(message.tool_calls) || message.tool_calls.length > MAX_TOOL_CALLS))
    return malformed('tool calls');
  const calls: ToolModelCall[] = [];
  for (const item of (message.tool_calls ?? [])) {
    if (!object(item) || item.type !== 'function' || !boundedText(item.id, MAX_ID_LENGTH) || !object(item.function)
      || !boundedText(item.function.name, MAX_ID_LENGTH) || typeof item.function.arguments !== 'string'
      || new TextEncoder().encode(item.function.arguments).byteLength > WIRE_LIMITS.bytes) return malformed('tool call');
    let parsed: unknown;
    try { parsed = JSON.parse(item.function.arguments); } catch { return malformed('tool arguments'); }
    const checked = parseWireValue(parsed);
    if (!checked.ok) return malformed('tool arguments');
    calls.push({id: item.id, name: item.function.name, input: checked.value as AgentJsonValue});
  }
  const usage = providerUsage(input.usage, context, text, calls);
  const providerModel = boundedText(input.model, MAX_ID_LENGTH) ? input.model : undefined;
  const responseId = boundedText(input.id, MAX_ID_LENGTH) ? input.id : undefined;
  const provider: ToolModelResponse['provider'] = {
    protocol: OPENAI_COMPATIBLE_CHAT_PROTOCOL,
    ...(providerModel === undefined ? {} : {model: providerModel}),
    ...(responseId === undefined ? {} : {responseId}),
    usage,
  };
  return Object.freeze({
    ...(text === undefined ? {} : {text}),
    calls: Object.freeze(calls),
    usage,
    provider: Object.freeze(provider),
  });
}

export const openAICompatibleChatAdapter: ToolModelProtocolAdapter = Object.freeze({
  id: OPENAI_COMPATIBLE_CHAT_PROTOCOL,
  endpointPath: '/chat/completions',
  capabilities: Object.freeze(['tool-calls', 'usage', 'input-token-estimate', 'request-cancellation', 'request-retry'] as const),
  encodeRequest,
  estimateInputTokens,
  decodeResponse,
});

export interface OpenAICompatibleToolModelOptions {
  readonly baseURL: string;
  readonly model: string;
  readonly secret: OpaqueModelSecret;
  readonly auth?: {
    readonly scheme?: ToolModelAuthScheme;
    readonly headerName?: string;
  };
  /** Required endpoint features, declared by the application configuration. */
  readonly capabilities: readonly ToolModelCapability[];
  readonly headers?: Readonly<Record<string, string>>;
  readonly policy: ToolModelConnectionPolicy;
  readonly budget?: ToolModelConnectionBudget;
  readonly timeoutMs?: number;
  readonly retry?: ToolModelRetryPolicy;
  readonly cost?: ToolModelCostPolicy;
  readonly fetch?: ToolModelFetch;
  readonly onResponse?: (observation: ToolModelProviderObservation) => void;
}

/**
 * Generic OpenAI-compatible chat-completions connection. It intentionally does
 * not identify or branch on a vendor; compatible gateways use the same adapter.
 */
export function createOpenAICompatibleToolModel(options: OpenAICompatibleToolModelOptions): ToolModelPort {
  return createToolModelConnection({
    adapter: openAICompatibleChatAdapter,
    baseURL: options.baseURL,
    model: options.model,
    auth: {
      scheme: options.auth?.scheme ?? 'bearer',
      secret: options.secret,
      ...(options.auth?.headerName === undefined ? {} : {headerName: options.auth.headerName}),
    },
    capabilities: options.capabilities,
    ...(options.headers === undefined ? {} : {headers: options.headers}),
    policy: options.policy,
    ...(options.budget === undefined ? {} : {budget: options.budget}),
    ...(options.timeoutMs === undefined ? {} : {timeoutMs: options.timeoutMs}),
    ...(options.retry === undefined ? {} : {retry: options.retry}),
    ...(options.cost === undefined ? {} : {cost: options.cost}),
    ...(options.fetch === undefined ? {} : {fetch: options.fetch}),
    ...(options.onResponse === undefined ? {} : {onResponse: options.onResponse}),
  });
}
