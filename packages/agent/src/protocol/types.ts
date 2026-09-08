import type {OperationGrant, Outcome, VersionRef} from '@aeliqo/core';
import type {AgentCapabilityReceipt, AgentJsonValue} from '../capabilities/types.js';

/** Host-authored JSON Schema for the registered capability's input, not an authority grant. */
export type AgentToolInputSchema = Readonly<Record<string, AgentJsonValue>>;
export interface AgentToolBinding {
  readonly name: string;
  readonly capability: VersionRef;
  readonly operation: OperationGrant;
  readonly inputSchema: AgentToolInputSchema;
}
export interface AgentToolDefinition extends AgentToolBinding {
  readonly description: string;
}
export type AgentToolTransport = 'manual' | 'mcp' | 'webmcp' | 'byok';
export interface AgentToolCallOptions {
  /** Stable across a protocol retry, never an actor or permission token. */
  readonly requestId: string;
  readonly signal?: AbortSignal;
}
/**
 * One host-owned, expiring workspace/region/goal pairing. Transport adapters only
 * translate their protocol around this port; the production endpoint re-enters
 * the existing capability dispatcher and performs fresh scoped discovery.
 */
export interface AgentToolEndpoint {
  readonly transport: AgentToolTransport;
  readonly targetRegionId: string;
  readonly goalEpoch: string;
  readonly discover: (options?: {readonly signal?: AbortSignal}) => Promise<Outcome<readonly AgentToolDefinition[]>>;
  readonly invoke: (name: string, input: unknown, options: AgentToolCallOptions) => Promise<Outcome<AgentCapabilityReceipt>>;
  readonly close: () => void;
}
