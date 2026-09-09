import type {Outcome} from '@aeliqo/core';
import type {AgentCapabilityReceipt, AgentJsonValue} from '../capabilities/types.js';
import type {AgentModelToolEndpoint, AgentToolDefinition} from '../protocol/types.js';

export type ToolModelMessage =
  | {readonly role: 'user'; readonly text: string}
  | {readonly role: 'assistant'; readonly text?: string; readonly calls: readonly ToolModelCall[]}
  | {readonly role: 'tool'; readonly callId: string; readonly output: AgentJsonValue};
export interface ToolModelCall {
  readonly id: string;
  readonly name: string;
  readonly input: AgentJsonValue;
}
export type ToolModelTokenSource = 'provider' | 'estimated';
export interface ToolModelCost {
  readonly currency: string;
  readonly estimatedUSD?: number;
  readonly inputUSDPerMillion?: number;
  readonly outputUSDPerMillion?: number;
  readonly source?: string;
}
export interface ToolModelUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens?: number;
  readonly inputTokenSource?: ToolModelTokenSource;
  readonly outputTokenSource?: ToolModelTokenSource;
  readonly cachedInputTokens?: number;
  readonly reasoningOutputTokens?: number;
  /** This is a host-side estimate unless the provider explicitly reports a charge. */
  readonly cost?: ToolModelCost;
}
export interface ToolModelProviderSnapshot {
  /** Protocol identity, not a vendor name or trust level. */
  readonly protocol: string;
  readonly model?: string;
  readonly responseId?: string;
  readonly usage: ToolModelUsage;
}
export interface ToolModelRequest {
  readonly messages: readonly ToolModelMessage[];
  readonly tools: readonly AgentToolDefinition[];
  readonly maxOutputTokens: number;
}
export interface ToolModelResponse {
  /** Unverified model prose. Hosts must apply their claim/evidence policy before display. */
  readonly text?: string;
  readonly calls: readonly ToolModelCall[];
  readonly usage: ToolModelUsage;
  /** Sanitized provider metadata; credentials and raw responses never belong here. */
  readonly provider?: ToolModelProviderSnapshot;
}
/**
 * Application-owned model I/O. A host can supply authoritative remote counting,
 * or a bounded local estimate. A model transport is never allowed to require an
 * undocumented counting endpoint merely to make a completion request.
 */
export interface ToolModelPort {
  readonly estimateInputTokens?: (request: ToolModelRequest) => number;
  readonly countInputTokens?: (request: ToolModelRequest, options: {readonly signal: AbortSignal}) => Promise<number>;
  readonly complete: (request: ToolModelRequest, options: {readonly signal: AbortSignal}) => Promise<ToolModelResponse>;
}
export interface ToolModelBudget {
  readonly maxTurns: number;
  readonly maxModelRequests: number;
  readonly maxToolCalls: number;
  readonly maxMilliseconds: number;
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly maxTotalTokens: number;
  readonly maxInputBytes: number;
  readonly maxOutputBytes: number;
  readonly maxRepeatedCalls: number;
}
export type ToolModelStop = 'text-ready' | 'renderer-ready' | 'no-commit' | 'no-progress' | 'budget' | 'cancelled' | 'stale' | 'denied' | 'failed';
export interface ToolModelReceipt {
  readonly stop: ToolModelStop;
  readonly turns: number;
  readonly modelRequests: number;
  readonly toolCalls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** This is a draft, never a verified numerical narrative or business fact. */
  readonly textDraft?: string;
  readonly receipts: readonly AgentCapabilityReceipt[];
}
export interface ToolModelLoopOptions {
  readonly requestId: string;
  readonly goal: 'chat' | 'experience';
  /** Host-approved text only. The loop does not automatically read page, catalog or host context. */
  readonly prompt: string;
  readonly endpoint: AgentModelToolEndpoint;
  readonly model: ToolModelPort;
  readonly budget: ToolModelBudget;
  readonly signal?: AbortSignal;
}
export type ToolModelLoopOutcome = Outcome<ToolModelReceipt>;
