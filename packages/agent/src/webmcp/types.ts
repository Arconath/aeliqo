import type {Outcome} from '@aeliqo/core';
import type {AgentCapabilityReceipt} from '../capabilities/types.js';
import type {AgentToolDefinition, AgentToolEndpoint, AgentToolInputSchema} from '../protocol/types.js';

/** The execution context supplied by the native WebMCP host. */
export interface WebMcpExecutionOptions {
  readonly signal?: AbortSignal;
}

/** Native WebMCP safety hints derived from the canonical operation grant. */
export interface WebMcpToolAnnotations {
  readonly readOnlyHint: boolean;
  readonly untrustedContentHint: boolean;
  readonly consequentialHint: boolean;
}

/** The subset of Chrome's imperative modelContext API used by this adapter. */
export interface WebMcpModelContext {
  readonly registerTool: (
    tool: WebMcpTool,
    options?: {readonly signal?: AbortSignal},
  ) => void | Promise<void>;
  readonly getTools?: () => Promise<readonly unknown[]>;
}

/** A tool shape accepted by the imperative WebMCP registration API. */
export interface WebMcpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: AgentToolInputSchema;
  readonly annotations: WebMcpToolAnnotations;
  readonly execute: (input: unknown, options?: WebMcpExecutionOptions) => unknown | Promise<unknown>;
}

/** Whether the host came from the browser or was explicitly supplied by a test/app. */
export type WebMcpEvidence = 'native' | 'simulated' | 'unavailable';

export interface WebMcpDetection {
  readonly evidence: WebMcpEvidence;
  readonly supported: boolean;
  readonly modelContext?: WebMcpModelContext;
  readonly reason?: string;
}

export interface WebMcpAdapterOptions {
  /** The host-owned endpoint; its transport must be `webmcp`. */
  readonly endpoint: AgentToolEndpoint;
  /** Explicit modelContext injection is for tests or an app-owned host and is simulated evidence. */
  readonly modelContext?: WebMcpModelContext;
  /** Explicit document injection is also simulated evidence. Omit it to inspect the real global document. */
  readonly document?: unknown;
}

export interface WebMcpRegisterOptions {
  readonly signal?: AbortSignal;
}

export interface WebMcpRegistration {
  readonly name: string;
  readonly capability: AgentToolDefinition['capability'];
  readonly operation: AgentToolDefinition['operation'];
  readonly evidence: WebMcpEvidence;
}

export interface WebMcpAdapter {
  readonly evidence: WebMcpEvidence;
  readonly supported: boolean;
  readonly discover: (options?: {readonly signal?: AbortSignal}) => Promise<Outcome<readonly AgentToolDefinition[]>>;
  readonly register: (options?: WebMcpRegisterOptions) => Promise<Outcome<readonly WebMcpRegistration[]>>;
  readonly close: () => void;
}

export type {AgentToolDefinition, AgentToolEndpoint, AgentToolInputSchema, AgentCapabilityReceipt};
