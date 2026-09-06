import { capabilityContracts, receiptSchema, type WorkspaceReceipt, type CapabilityName } from '@aeliqo/core';
export interface ToolCall { id: string; name: string; arguments: unknown }
export interface ProviderTurn { calls: readonly ToolCall[]; text?: string; state?: unknown }
export interface ToolResult { id: string; result: unknown }
export interface ProviderAdapter {
  readonly name: string;
  next(input: { intent: string; tools: typeof capabilityContracts; state?: unknown; results: readonly ToolResult[]; signal?: AbortSignal }): Promise<ProviderTurn>;
}
export type Dispatch = (name: CapabilityName, input: unknown, options?: { signal?: AbortSignal }) => unknown | Promise<unknown>;
export async function runAgent(provider: ProviderAdapter, intent: string, dispatch: Dispatch, options: { maxTurns?: number; signal?: AbortSignal; output?: 'chat' | 'workspace' } = {}) {
  if (!intent.trim() || intent.length > 4000) throw new Error('Intent must contain 1–4000 characters');
  const start = performance.now();
  let state: unknown, results: ToolResult[] = [], providerMs = 0, toolCalls = 0;
  let receipt: WorkspaceReceipt | undefined;
  let mutationFailed = false;
  let rejectedToolCalls = 0;
  const tools = options.output === 'chat' ? capabilityContracts.filter(contract => contract.id !== 'workspace_apply') : capabilityContracts;
  for (let turn = 0; turn < Math.min(options.maxTurns ?? 8, 12); turn++) {
    options.signal?.throwIfAborted();
    const before = performance.now();
    const response = await provider.next({ intent, tools, state, results, signal: options.signal });
    providerMs += performance.now() - before;
    state = response.state;
    if (!response.calls.length) {
      const metrics = {providerMs,totalMs:performance.now()-start,toolCalls,provider:provider.name,rejectedToolCalls};
      if (options.output === 'workspace') {
        if (!receipt) return {...metrics,outcome:'failed' as const,text:'No workspace change was confirmed. Inspect the workspace before retrying.'};
        if (mutationFailed || receipt.outcome === 'failed') return {...metrics,receipt,outcome:'failed' as const,text:'A workspace operation or its presentation failed. Inspect the workspace before retrying.'};
        if (receipt.outcome !== 'presented') return {...metrics,receipt,outcome:'pending' as const,text:'The workspace change committed, but its presentation is still pending.'};
        return {...metrics,receipt,outcome:'presented' as const,text:response.text ?? ''};
      }
      return {...metrics,text:response.text ?? ''};
    }
    if (response.calls.length > 8 || toolCalls + response.calls.length > 32) throw new Error('Provider tool-call budget exceeded');
    results = [];
    for (const call of response.calls) {
      options.signal?.throwIfAborted();
      toolCalls++;
      try {
        const contract = tools.find(contract => contract.id === call.name);
        if (!contract) throw new Error('Unknown capability');
        const input = contract.inputSchema.parse(call.arguments);
        const result = options.signal
          ? await dispatch(contract.id, input, { signal: options.signal })
          : await dispatch(contract.id, input);
        options.signal?.throwIfAborted();
        if (contract.id === 'workspace_apply' && options.output === 'workspace') {
          receipt = receiptSchema.parse(result);
          mutationFailed = false;
        }
        results.push({ id: call.id, result });
      } catch (error) {
        rejectedToolCalls++;
        if (call.name === 'workspace_apply') mutationFailed = true;
        results.push({ id: call.id, result: { error: error instanceof Error ? error.message : 'Tool failed' } });
      }
    }
  }
  throw new Error('Provider turn budget exhausted; inspect the workspace before retrying');
}
/** Explicit scripted fixture, not a reasoning implementation or live provider proof. */
export function createScriptedProvider(turns: readonly ProviderTurn[]): ProviderAdapter {
  return { name: 'deterministic-test-fixture', next: async ({ state }) => {
    const index = typeof state === 'number' ? state : 0;
    const turn = turns[index];
    if (!turn) throw new Error('Scripted fixture exhausted');
    return { ...turn, state: index + 1 };
  } };
}
