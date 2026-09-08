import {describe, expect, it} from 'vitest';
import {parseWireValue, type Outcome} from '../../../packages/core/src/index.js';
import {createAgentCapabilityDispatcher} from '../../../packages/agent/src/capabilities/dispatcher.js';
import {createAgentCapabilityRegistry} from '../../../packages/agent/src/capabilities/registry.js';
import type {AgentCapabilityManifest, AgentCapabilityRequest} from '../../../packages/agent/src/capabilities/types.js';
import {createAgentSession} from '../../../packages/agent/src/session/session.js';

const budget = (overrides: Partial<{maxTurns: number; maxRepairs: number; maxMilliseconds: number; maxProposalBytes: number}> = {}) => ({
  maxTurns: 4, maxRepairs: 2, maxMilliseconds: 1_000, maxProposalBytes: 4_096, ...overrides,
});
const base: AgentCapabilityRequest = {version: '1', requestId: 'session-request', targetRegionId: 'region-1', goalEpoch: 'goal-1', capability: {id: 'task.propose', revision: '1'}, operation: 'task.propose', input: {valid: false}};
const host = {readContext: () => ({ok: true as const, value: {principalKey: 'principal-1', regionId: 'region-1', goalEpoch: 'goal-1', grants: ['task.propose' as const]}})};

const manifest: AgentCapabilityManifest = {
  ref: {id: 'task.propose', revision: '1'}, operation: 'task.propose', label: 'Task proposal',
  parse: (input) => parseWireValue(input) as Outcome<never>,
  invoke: (input) => ({state: (input as {valid?: boolean}).valid === true ? 'bound' as const : 'invalid' as const,
    ...(input as {valid?: boolean}).valid === true ? {value: {accepted: true}} : {diagnostics: [{code: 'task.invalid', message: 'Repair the candidate.', retryable: true}]}}),
};

function dispatcher() {
  const registry = createAgentCapabilityRegistry([manifest]);
  if (!registry.ok) throw new Error('registry failed');
  return createAgentCapabilityDispatcher({registry: registry.value, host});
}

describe('bounded agent sessions', () => {
  it('repairs through the shared dispatcher and returns an inspectable recovery receipt', async () => {
    const session = createAgentSession({dispatcher: dispatcher()});
    const result = await session.run({request: base, budget: budget(), propose: () => ({valid: true}), incumbent: {regionRevision: 'region-1'}});
    expect(result).toMatchObject({ok: true, value: {stop: 'complete', attempts: [{state: 'invalid'}, {state: 'bound'}]}});
    expect(session.inspect()).toMatchObject({status: 'completed', requestId: 'session-request'});
  });

  it('stops repeated candidates without treating search exhaustion as success', async () => {
    const session = createAgentSession({dispatcher: dispatcher(), recover: () => ({ok: true, value: {state: 'manual-required', reason: 'No progress.', safeToRetry: true}})});
    const result = await session.run({request: base, budget: budget(), propose: () => ({valid: false})});
    expect(result).toMatchObject({ok: true, value: {stop: 'no-progress', recovery: {state: 'manual-required'}}});
  });

  it('propagates cancellation and does not invoke a late repair', async () => {
    const controller = new AbortController();
    let called = 0;
    const session = createAgentSession({dispatcher: dispatcher()});
    const pending = session.run({request: base, budget: budget(), propose: () => { called++; return new Promise(() => {}); }, signal: controller.signal});
    setTimeout(() => controller.abort(), 10);
    const result = await pending;
    expect(result).toMatchObject({ok: true, value: {stop: 'cancelled'}});
    expect(called).toBe(1);
  });
});
