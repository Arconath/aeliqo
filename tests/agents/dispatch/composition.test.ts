import {describe, expect, it} from 'vitest';
import {createAgentCompositionRegistry, validateAgentComposition} from '../../../packages/agent/src/capabilities/composition.js';
import type {CommitPreconditions} from '../../../packages/core/src/index.js';

const current: CommitPreconditions = {
  scopeDigest: 'scope-1', policyRevision: 'policy-1', taskRevision: 'task-1', regionRevision: 'region-1',
  catalogRevision: 'catalog-1', experienceRevision: 'experience-1', functionRegistryDigest: 'functions-1', results: [],
};
const view = {ref: {id: 'table', revision: '1'}, configSchema: {id: 'table.config', revision: '1'}, roles: ['leaf'], result: 'required' as const, children: {min: 0, max: 0}};
const registry = createAgentCompositionRegistry([view]);
const plan = {
  id: 'experience-1', revision: 'experience-1', rootId: 'table-1', preconditions: current,
  nodes: [{id: 'table-1', role: 'leaf', representation: view.ref, result: {id: 'result-1', revision: 'result-1', outputId: 'main', queryDigest: 'query-1', scopeDigest: 'scope-1'}, config: {schema: view.configSchema, values: {fields: ['id'] as const}}, children: []}],
  links: [], coverage: [], stateTransfer: [], diagnostics: [],
};

describe('registered composition capability validation', () => {
  it('accepts an exact registered view graph and rejects unknown schemas', () => {
    expect(registry.ok).toBe(true);
    if (!registry.ok) return;
    expect(validateAgentComposition(plan, registry.value)).toMatchObject({ok: true, value: {plan: {rootId: 'table-1'}}});
    const unknownSchema = {...plan, nodes: [{...plan.nodes[0]!, config: {schema: {id: 'unknown.config', revision: '1'}, values: {fields: ['id']}}}]};
    expect(validateAgentComposition(unknownSchema, registry.value)).toMatchObject({ok: false, diagnostics: [{code: 'agent.composition.schema'}]});
  });

  it('rejects executable config, cycles and orphaned nodes', () => {
    expect(registry.ok).toBe(true);
    if (!registry.ok) return;
    const executable = {...plan, nodes: [{...plan.nodes[0]!, config: {schema: view.configSchema, values: {code: 'document.body.innerHTML'}}}]};
    expect(validateAgentComposition(executable, registry.value)).toMatchObject({ok: false, diagnostics: [{code: 'agent.composition.executable'}]});
    const cyclicView = {...view, ref: {id: 'layout', revision: '1'}, configSchema: {id: 'layout.config', revision: '1'}, roles: ['layout'], result: 'none' as const, children: {min: 1, max: 1}};
    const cycleRegistry = createAgentCompositionRegistry([cyclicView]);
    expect(cycleRegistry.ok).toBe(true);
    if (!cycleRegistry.ok) return;
    const cycle = {...plan, nodes: [{id: 'layout-1', role: 'layout', representation: cyclicView.ref, config: {schema: cyclicView.configSchema, values: {}}, children: ['layout-1']}], rootId: 'layout-1'};
    expect(validateAgentComposition(cycle, cycleRegistry.value)).toMatchObject({ok: false, diagnostics: [{code: 'agent.composition.cycle'}]});
  });
});
