import {describe, expect, it} from 'vitest';
import {parseWireValue, type OperationGrant, type Outcome} from '../../../packages/core/src/index.js';
import {createAgentCapabilityRegistry} from '../../../packages/agent/src/capabilities/registry.js';
import type {AgentCapabilityManifest} from '../../../packages/agent/src/capabilities/types.js';
import {createAgentToolEndpoint} from '../../../packages/agent/src/protocol/endpoint.js';
import {runToolModel} from '../../../packages/agent/src/model/loop.js';
import {createToolModelContinuation} from '../../../packages/agent/src/model/continuation.js';
import type {ToolModelBudget, ToolModelPort, ToolModelResponse} from '../../../packages/agent/src/model/types.js';

const budget: ToolModelBudget = {maxTurns: 4, maxModelRequests: 8, maxToolCalls: 8, maxMilliseconds: 1000, maxInputTokens: 1000, maxOutputTokens: 100,
  maxTotalTokens: 2000, maxInputBytes: 100_000, maxOutputBytes: 10_000, maxRepeatedCalls: 1};
const proposal = (calls: ToolModelResponse['calls'] = [], text = 'Unverified answer'): ToolModelResponse => ({calls, text, usage: {inputTokens: 10, outputTokens: 5}});
function fixture(model: ToolModelPort, handler: AgentCapabilityManifest['invoke'] = () => ({state: 'data-ready', value: {count: 2}}), operation: OperationGrant = 'catalog.read') {
  let grants: readonly OperationGrant[] = [operation, 'model.egress'];
  let regionId = 'region';
  let calls = 0;
  const registry = createAgentCapabilityRegistry([{ref: {id: 'summary', revision: '1'}, operation, label: 'Summary',
    parse: value => parseWireValue(value) as Outcome<never>, invoke: (input, context) => {calls++; return handler(input, context);}}]);
  if (!registry.ok) throw new Error('registry');
  const endpoint = createAgentToolEndpoint({transport: 'byok', targetRegionId: 'region', goalEpoch: 'goal', principalKey: 'owner', expiresAt: Date.now() + 60_000,
    registry: registry.value, tools: [{name: 'summary', operation, capability: {id: 'summary', revision: '1'}, inputSchema: {type: 'object'}}],
    host: {readContext: () => ({ok: true, value: {principalKey: 'owner', regionId, goalEpoch: 'goal', grants}})}});
  if (!endpoint.ok) throw new Error('endpoint');
  return {options: {requestId: 'run', goal: 'chat' as const, prompt: 'Show the summary', model, endpoint: endpoint.value, budget},
    revoke: () => {grants = [operation];}, region: () => {regionId = 'other';}, calls: () => calls};
}

describe('synthetic model-port boundary contract (not live reasoning evidence)', () => {
  it('runs tool proposals through the real endpoint and marks text as an unverified draft', async () => {
    let turns = 0;
    const f = fixture({countInputTokens: async () => 10, complete: async request => {
      if (++turns === 1) return proposal([{id: 'call1', name: 'summary', input: {}}]);
      expect(request.messages.at(-1)).toMatchObject({role: 'tool', callId: 'call1', output: {ok: true, value: {value: {count: 2}}}});
      return proposal();
    }});
    expect(await runToolModel(f.options)).toMatchObject({ok: true, value: {stop: 'text-ready', turns: 2, modelRequests: 4, toolCalls: 1, textDraft: 'Unverified answer'}});
    expect(f.calls()).toBe(1);
  });
  it('preserves an opaque protocol continuation across a tool turn without serializing its value', async () => {
    const continuation = createToolModelContinuation('fixture-protocol', {privateState: 'reasoning-never-serialized'});
    let turns = 0;
    const f = fixture({estimateInputTokens: () => 10, complete: async request => {
      if (++turns === 1) return {...proposal([{id: 'call1', name: 'summary', input: {}}]), continuation};
      const assistant = request.messages.find(message => message.role === 'assistant');
      expect(assistant?.continuation).toBe(continuation);
      expect(JSON.stringify(assistant)).not.toContain('reasoning-never-serialized');
      return proposal();
    }});
    expect(await runToolModel(f.options)).toMatchObject({ok: true, value: {stop: 'text-ready', turns: 2, toolCalls: 1}});
  });
  it('does not equate model prose with a committed interface', async () => {
    const f = fixture({countInputTokens: async () => 10, complete: async () => proposal([], 'I updated the view')});
    expect(await runToolModel({...f.options, goal: 'experience'})).toMatchObject({ok: true, value: {stop: 'no-commit', receipts: []}});
  });
  it('returns renderer-ready only from the registered committed receipt', async () => {
    const f = fixture({countInputTokens: async () => 10, complete: async () => proposal([{id: 'call1', name: 'summary', input: {}}])},
      () => ({state: 'renderer-ready', regionRevision: 'region-next'}), 'experience.commit');
    expect(await runToolModel({...f.options, goal: 'experience'})).toMatchObject({ok: true, value: {stop: 'renderer-ready', receipts: [{state: 'renderer-ready', regionRevision: 'region-next'}]}});
  });
  it('stops repeated equivalent calls before executing them twice', async () => {
    let n = 0;
    const f = fixture({countInputTokens: async () => 10, complete: async () => proposal([{id: `call${++n}`, name: 'summary', input: {}}])});
    expect(await runToolModel(f.options)).toMatchObject({ok: true, value: {stop: 'no-progress', toolCalls: 1}});
    expect(f.calls()).toBe(1);
  });
  it('refuses egress before counting, and rechecks after counting and generation', async () => {
    for (const stage of ['before', 'count', 'complete']) {
      let counts = 0, generations = 0;
      const f = fixture({countInputTokens: async () => {counts++; if (stage === 'count') f.revoke(); return 10;},
        complete: async () => {generations++; if (stage === 'complete') f.revoke(); return proposal([{id: 'call1', name: 'summary', input: {}}]);}});
      if (stage === 'before') f.revoke();
      expect(await runToolModel(f.options)).toMatchObject({ok: true, value: {stop: 'denied'}});
      expect(counts).toBe(stage === 'before' ? 0 : 1);
      expect(generations).toBe(stage === 'complete' ? 1 : 0);
      expect(f.calls()).toBe(0);
    }
  });
  it('rejects changed regions and malformed authority-bearing tool proposals', async () => {
    const f = fixture({countInputTokens: async () => 10, complete: async () => {f.region(); return proposal([{id: 'call1', name: 'summary', input: {}}]);}});
    expect(await runToolModel(f.options)).toMatchObject({ok: true, value: {stop: 'stale'}});
    expect(f.calls()).toBe(0);
    let n = 0;
    const forged = fixture({countInputTokens: async () => 10, complete: async () => ++n === 1 ? proposal([{id: 'call1', name: 'summary', input: {approved: true}}]) : proposal()});
    await runToolModel(forged.options);
    expect(forged.calls()).toBe(0);
  });
  it('bounds model requests, token reservations, bytes and wall time before tool dispatch', async () => {
    let completions = 0;
    const f = fixture({countInputTokens: async () => 1001, complete: async () => {completions++; return proposal();}});
    expect(await runToolModel(f.options)).toMatchObject({ok: true, value: {stop: 'budget'}});
    expect(completions).toBe(0);
    expect(await runToolModel({...f.options, budget: {...budget, maxModelRequests: 1}})).toMatchObject({ok: true, value: {stop: 'budget', modelRequests: 0}});
    expect(await runToolModel({...f.options, budget: {...budget, maxInputBytes: 1}})).toMatchObject({ok: true, value: {stop: 'budget', modelRequests: 0}});
    const hung = fixture({countInputTokens: () => new Promise(() => {}), complete: async () => proposal()});
    expect(await runToolModel({...hung.options, budget: {...budget, maxMilliseconds: 15}})).toMatchObject({ok: true, value: {stop: 'budget'}});
  });
  it('propagates caller cancellation into an in-flight model request', async () => {
    const controller = new AbortController();
    let entered!: () => void;
    const ready = new Promise<void>(resolve => {entered = resolve;});
    let observed: AbortSignal | undefined;
    const f = fixture({countInputTokens: async () => 10, complete: (_request, {signal}) => {observed = signal; entered(); return new Promise(() => {});}});
    const run = runToolModel({...f.options, signal: controller.signal});
    await ready;
    controller.abort();
    expect(await run).toMatchObject({ok: true, value: {stop: 'cancelled'}});
    expect(observed?.aborted).toBe(true);
    expect(f.calls()).toBe(0);
  });
});
