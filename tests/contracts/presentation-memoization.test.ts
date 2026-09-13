import {describe, expect, it} from 'vitest';
import {composePresentation, createPresentationRegistry, validatePresentationPlan} from '../../packages/core/src/presentation/index.js';
import {canonicalJSON, parseContract} from '../../packages/core/src/contracts/parse.js';
import {preparePresentationContext, preparePresentationValidationCache, validatePreparedPresentationPlan} from '../../packages/core/src/presentation/validate.js';
import type {PresentationContext, PresentationManifest, PresentationRegistry} from '../../packages/core/src/presentation/index.js';
import type {PresentationPlan, ResultRef} from '../../packages/core/src/contracts/types.js';
import {environment, experience, field, presentationPlan, presentationTask, ref, result} from './fixtures.js';

const read = {id: 'data.read', revision: '1'} as const;

function tableManifest(resolveConfig: PresentationManifest['resolveConfig']): PresentationManifest {
  return {
    ref: {id: 'data.memo-table', revision: '1'}, configSchema: {id: 'data.memo-table.config', revision: '1'},
    roles: ['table'], operations: [read], result: 'required', children: {min: 0, max: 0}, visibility: 'leaf', extension: false,
    resolveConfig, suggestConfig: () => ({ok: true, value: {}}),
  };
}

function layoutManifest(resolveConfig: PresentationManifest['resolveConfig']): PresentationManifest {
  return {
    ref: {id: 'layout.memo-stack', revision: '1'}, configSchema: {id: 'layout.memo-stack.config', revision: '1'},
    roles: ['structure'], operations: [], result: 'none', children: {min: 1, max: 32}, visibility: 'simultaneous', extension: false,
    resolveConfig, suggestConfig: () => ({ok: true, value: {}}),
  };
}

function registry(entries: readonly PresentationManifest[]): PresentationRegistry {
  const installed = createPresentationRegistry(entries);
  if (!installed.ok) throw new Error(JSON.stringify(installed.diagnostics));
  return installed.value;
}

function context(overrides: Partial<PresentationContext> = {}): PresentationContext {
  const current = presentationPlan.preconditions;
  return {
    task: {...presentationTask, needs: [{id: 'browse', operation: read, fields: [field.id], outputId: 'rows', required: true}]},
    experience: {...experience, mode: 'composable', allowedRepresentations: ['data.memo-table', 'layout.memo-stack'],
      composition: {...experience.composition, maxExpansions: 64}},
    results: [result], current, environment, rendererCapabilities: [
      {id: 'data.memo-table', revision: '1'}, {id: 'layout.memo-stack', revision: '1'},
    ],
    ...overrides,
  };
}

function basePlan(rootId = 'layout-0', leafId = 'leaf-0', values: Record<string, unknown> = {}, resultRef: ResultRef = ref): PresentationPlan {
  const leaf = {
    id: leafId, role: 'table', representation: {id: 'data.memo-table', revision: '1'}, result: resultRef,
    config: {schema: {id: 'data.memo-table.config', revision: '1'}, values}, children: [],
  };
  const root = {
    id: rootId, role: 'structure', representation: {id: 'layout.memo-stack', revision: '1'},
    config: {schema: {id: 'layout.memo-stack.config', revision: '1'}, values: {}}, children: [leafId],
  };
  return {...presentationPlan, rootId, nodes: [root, leaf], coverage: [{needId: 'browse', nodeIds: [leafId], operations: [read]}]};
}

function request(
  plan: PresentationPlan,
  activeContext: PresentationContext,
  candidates?: readonly {readonly source: 'explicit'; readonly plan: PresentationPlan}[],
) {
  return {id: 'memo-compose', revision: '1', preconditions: activeContext.current, context: activeContext, ...(candidates === undefined ? {} : {candidates})};
}

describe('presentation validation memoization', () => {
  it('reuses an owned link-free graph only while ordered node identities and resolved ports remain identical', () => {
    const leaf = tableManifest((values, descriptor) => ({ok: true, value: {
      values, fields: descriptor!.fields.map(item => item.id),
      ports: values.selectable === true ? [{id: 'selection', direction: 'output', payload: 'selection', entity: 'employees', identity: [field.id], grain: [field.id]}] : [],
    }}));
    const root = layoutManifest(values => ({ok: true, value: {values, fields: [], ports: []}}));
    const installed = registry([leaf, root]);
    const activeContext = context();
    const prepared = preparePresentationContext(activeContext);
    expect(prepared.ok).toBe(true); if (!prepared.ok) return;
    const cache = preparePresentationValidationCache(prepared.value, installed);
    expect(cache.ok).toBe(true); if (!cache.ok) return;
    const check = (plan: PresentationPlan) => {
      const parsed = parseContract('presentation-plan', plan);
      expect(parsed.ok).toBe(true); if (!parsed.ok) throw new Error('fixture did not parse');
      const checked = validatePreparedPresentationPlan(parsed.value, activeContext, installed, prepared.value, {}, undefined, undefined, undefined, cache.value);
      expect(checked.ok).toBe(true); if (!checked.ok) throw new Error(JSON.stringify(checked.diagnostics));
      return checked.value.graph;
    };
    const first = check(basePlan('layout', 'leaf', {density: 'compact'}));
    const samePorts = check(basePlan('layout', 'leaf', {density: 'roomy'}));
    expect(samePorts).toBe(first);
    const changedPorts = check(basePlan('layout', 'leaf', {selectable: true}));
    expect(changedPorts).not.toBe(first);
    expect(changedPorts.nodes[1]!.ports).toHaveLength(1);
    expect(first.nodes[1]!.ports).toHaveLength(0);
    const renamed = check(basePlan('layout', 'different-leaf'));
    expect(renamed).not.toBe(first);
    expect(renamed.nodes[1]!.id).toBe('different-leaf');
    const originalOrder = basePlan('layout', 'leaf');
    const reordered = check({...originalOrder, nodes: [...originalOrder.nodes].reverse()});
    expect(reordered).not.toBe(first);
    expect(reordered.nodes[0]!.id).toBe('leaf');
    const nested = basePlan('layout', 'leaf');
    const secondLeaf = {...nested.nodes[1]!, id: 'second-leaf'};
    const nestedLayout = {...nested.nodes[0]!, id: 'nested-layout', children: ['leaf', 'second-leaf']};
    const firstTopology = check({...nested, nodes: [
      {...nested.nodes[0]!, children: ['nested-layout']}, nestedLayout, nested.nodes[1]!, secondLeaf,
    ]});
    const changedTopology = check({...nested, nodes: [
      {...nested.nodes[0]!, children: ['nested-layout', 'second-leaf']},
      {...nestedLayout, children: ['leaf']}, nested.nodes[1]!, secondLeaf,
    ]});
    expect(changedTopology).not.toBe(firstTopology);
    expect(Object.isFrozen(first.nodes[1]!.ports)).toBe(true);
    expect(check(basePlan('layout', 'leaf'))).toBe(first);
  });

  it('reuses structurally identical leaves across all 64 complete candidate plans while validating each distinct root', () => {
    let leafCalls = 0;
    let rootCalls = 0;
    const leaf = tableManifest((values, descriptor) => {
      leafCalls++;
      return {ok: true, value: {values, fields: descriptor!.fields.map(item => item.id), ports: []}};
    });
    const root = layoutManifest((values) => {
      rootCalls++;
      return {ok: true, value: {values, fields: [], ports: []}};
    });
    const activeContext = context();
    const candidates = Array.from({length: 64}, (_, index) => ({source: 'explicit' as const, plan: basePlan(`layout-${index}`, 'shared-leaf')}));
    const composed = composePresentation(request(basePlan(), activeContext, candidates), registry([leaf, root]));

    expect(composed).toMatchObject({ok: true, value: {status: 'search-exhausted', expansions: 64}});
    expect(leafCalls).toBe(1);
    expect(rootCalls).toBe(64);
  });

  it('invokes a pure resolver once for each identical node/result/config key within one compose call', () => {
    let leafCalls = 0;
    let rootCalls = 0;
    const leaf = tableManifest((values, descriptor) => {
      leafCalls++;
      return {ok: true, value: {values, fields: descriptor!.fields.map(item => item.id), ports: []}};
    });
    const root = layoutManifest((values) => {
      rootCalls++;
      return {ok: true, value: {values, fields: [], ports: []}};
    });
    const activeContext = {...context(), experience: {...context().experience,
      composition: {...context().experience.composition, maxExpansions: 2}}};
    const candidate = basePlan('same-root', 'same-leaf');
    const composed = composePresentation(request(candidate, activeContext, [
      {source: 'explicit', plan: candidate}, {source: 'explicit', plan: candidate},
    ]), registry([leaf, root]));

    expect(composed).toMatchObject({ok: true, value: {status: 'search-exhausted', expansions: 2}});
    expect(leafCalls).toBe(1);
    expect(rootCalls).toBe(1);
  });

  it('reevaluates when node identity, configuration, or result reference changes', () => {
    const alternateRef = {...ref, outputId: 'alternate' as const};
    const alternateResult = {...result, ref: alternateRef};
    let leafCalls = 0;
    let rootCalls = 0;
    const leaf = tableManifest((values, descriptor) => {
      leafCalls++;
      return {ok: true, value: {values, fields: descriptor!.fields.map(item => item.id), ports: []}};
    });
    const root = layoutManifest((values) => {
      rootCalls++;
      return {ok: true, value: {values, fields: [], ports: []}};
    });
    const activeContext: PresentationContext = {
      ...context(),
      experience: {...context().experience, composition: {...context().experience.composition, maxExpansions: 4}},
      task: {...presentationTask, inputs: [ref, alternateRef], needs: [{id: 'browse', operation: read, fields: [field.id], required: true}]},
      results: [result, alternateResult],
      current: {...presentationPlan.preconditions, results: [ref, alternateRef]},
    };
    const candidates = [
      {source: 'explicit' as const, plan: basePlan('same-root', 'same-leaf', {})},
      {source: 'explicit' as const, plan: basePlan('same-root', 'same-leaf', {density: 'compact'})},
      {source: 'explicit' as const, plan: basePlan('same-root', 'renamed-leaf', {})},
      {source: 'explicit' as const, plan: basePlan('same-root', 'renamed-leaf', {}, alternateRef)},
      {source: 'explicit' as const, plan: basePlan('same-root', 'renamed-leaf', {}, alternateRef)},
    ];
    const composed = composePresentation(request(candidates[0]!.plan, activeContext, candidates), registry([leaf, root]));

    expect(composed).toMatchObject({ok: true, value: {status: 'search-exhausted', expansions: 4}});
    expect(leafCalls).toBe(4);
    expect(rootCalls).toBe(2);
  });

  it('keeps signed-zero configuration values distinct and ranks the correctly resolved candidate', () => {
    let leafCalls = 0;
    const leaf = tableManifest((values, descriptor) => {
      leafCalls++;
      return {ok: true, value: {values, fields: descriptor!.fields.map(item => item.id), ports: []}};
    });
    const assessedLeaf: PresentationManifest = {
      ...leaf,
      assess: (config) => ({ok: true, value: {
        taskFit: Object.is(config.values.signedZero, 0) && !Object.is(config.values.signedZero, -0) ? 100 : 0,
        informationDensity: 0, interactionEffort: 0, legibilityPenalty: 0,
      }}),
    };
    const root = layoutManifest((values) => ({ok: true, value: {values, fields: [], ports: []}}));
    const activeContext = {...context(), experience: {...context().experience,
      composition: {...context().experience.composition, maxExpansions: 2}}};
    const negative = basePlan('signed-root', 'signed-leaf', {signedZero: -0});
    const positive = basePlan('signed-root', 'signed-leaf', {signedZero: 0});
    const composed = composePresentation(request(negative, activeContext, [
      {source: 'explicit', plan: negative}, {source: 'explicit', plan: positive},
    ]), registry([assessedLeaf, root]));

    expect(composed).toMatchObject({ok: true, value: {status: 'search-exhausted', expansions: 2,
      presentation: {plan: {nodes: [{id: 'signed-root'}, {id: 'signed-leaf', config: {values: {signedZero: 0}}}]}}}});
    expect(leafCalls).toBe(2);
    if (!composed.ok || composed.value.presentation === undefined) return;
    const resolved = composed.value.presentation.nodes.find(node => node.node.id === 'signed-leaf');
    expect(resolved).toBeDefined();
    expect(Object.is(resolved?.config.values.signedZero, 0)).toBe(true);
    expect(Object.is(resolved?.config.values.signedZero, -0)).toBe(false);
  });

  it('keeps canonical equal-score tie ordering for shared candidate plans', () => {
    const leaf = tableManifest((values, descriptor) => ({ok: true, value: {values, fields: descriptor!.fields.map(item => item.id), ports: []}}));
    const root = layoutManifest((values) => ({ok: true, value: {values, fields: [], ports: []}}));
    const activeContext = {...context(), experience: {...context().experience,
      composition: {...context().experience.composition, maxExpansions: 2}}};
    const shorter = basePlan('same-root', 'same-leaf', {order: [1]});
    const longer = basePlan('same-root', 'same-leaf', {order: [1, 2]});
    const composed = composePresentation(request(shorter, activeContext, [
      {source: 'explicit', plan: shorter}, {source: 'explicit', plan: longer},
    ]), registry([leaf, root]));

    expect(composed).toMatchObject({ok: true, value: {status: 'search-exhausted',
      presentation: {plan: {nodes: [{id: 'same-root'}, {id: 'same-leaf', config: {values: {order: [1, 2]}}}]}}}});
  });

  it('matches canonical ordering across nested JSON value and prefix boundaries', () => {
    const leaf = tableManifest((values, descriptor) => ({ok: true, value: {values, fields: descriptor!.fields.map(item => item.id), ports: []}}));
    const root = layoutManifest((values) => ({ok: true, value: {values, fields: [], ports: []}}));
    const activeContext = {...context(), experience: {...context().experience, composition: {...context().experience.composition, maxExpansions: 2}}};
    const values: unknown[] = [[], [{}], [1], [10], [1, 2], {}, {a: 1}, {a: 1, b: 2}, '', 'a', false, true, null, -1, -10, 0];
    for (let left = 0; left < values.length; left++) for (let right = left + 1; right < values.length; right++) {
      const first = basePlan('same-root', 'same-leaf', {order: values[left]}); const second = basePlan('same-root', 'same-leaf', {order: values[right]});
      const composed = composePresentation(request(first, activeContext, [{source: 'explicit', plan: first}, {source: 'explicit', plan: second}]), registry([leaf, root]));
      expect(composed.ok).toBe(true); if (!composed.ok || composed.value.presentation === undefined) continue;
      const expected = canonicalJSON(first) < canonicalJSON(second) ? values[left] : values[right];
      expect(composed.value.presentation.plan.nodes[1]!.config.values).toEqual({order: expected});
    }
  });

  it('does not carry acceptance across compose calls when policy, result fields, or experience changes', () => {
    let leafCalls = 0;
    const leaf = tableManifest((values, descriptor) => {
      leafCalls++;
      return {ok: true, value: {values, fields: descriptor!.fields.map(item => item.id), ports: []}};
    });
    const root = layoutManifest((values) => ({ok: true, value: {values, fields: [], ports: []}}));
    const installed = registry([leaf, root]);
    const candidate = basePlan();
    const firstContext = {...context(), experience: {...context().experience,
      composition: {...context().experience.composition, maxExpansions: 1}}};
    const first = composePresentation(request(candidate, firstContext, [{source: 'explicit', plan: candidate}]), installed);
    expect(first).toMatchObject({ok: true, value: {status: 'search-exhausted', presentation: expect.any(Object)}});

    const denied = {...firstContext, restrictions: [{id: 'preset-policy', allowWithoutPreset: false as const}]};
    const policyChanged = composePresentation(request(candidate, denied, [{source: 'explicit', plan: candidate}]), installed);
    expect(policyChanged).toMatchObject({ok: true, value: {status: 'search-exhausted', rejected: [{diagnostics: [{code: 'presentation.pattern-required'}]}]}});
    if (policyChanged.ok) expect(policyChanged.value.presentation).toBeUndefined();

    const missingFieldResult = {...result, fields: [{...field, id: 'employee.name', label: 'Employee name', role: 'attribute' as const}]};
    const resultChanged: PresentationContext = {
      ...firstContext,
      results: [missingFieldResult],
      current: {...firstContext.current, results: [missingFieldResult.ref]},
    };
    const resultFieldsChanged = composePresentation(request(candidate, resultChanged, [{source: 'explicit', plan: candidate}]), installed);
    expect(resultFieldsChanged).toMatchObject({ok: true, value: {status: 'search-exhausted', rejected: [{diagnostics: [{code: 'presentation.coverage'}]}]}});
    if (resultFieldsChanged.ok) expect(resultFieldsChanged.value.presentation).toBeUndefined();

    const experienceChanged: PresentationContext = {
      ...firstContext,
      experience: {...firstContext.experience, composition: {...firstContext.experience.composition, allowWithoutPreset: false}},
    };
    const experienceChangedResult = composePresentation(request(candidate, experienceChanged, [{source: 'explicit', plan: candidate}]), installed);
    expect(experienceChangedResult).toMatchObject({ok: true, value: {status: 'search-exhausted', rejected: [{diagnostics: [{code: 'presentation.pattern-required'}]}]}});
    if (experienceChangedResult.ok) expect(experienceChangedResult.value.presentation).toBeUndefined();
    expect(leafCalls).toBe(4);
  });

  it('parses every public raw plan before memo lookup and exposes frozen parsed descendants', () => {
    const leaf = tableManifest((values, descriptor) => ({ok: true, value: {values, fields: descriptor!.fields.map(item => item.id), ports: []}}));
    const root = layoutManifest((values) => ({ok: true, value: {values, fields: [], ports: []}}));
    const activeContext = context();
    const installed = registry([leaf, root]);
    const valid = basePlan();
    const accepted = validatePresentationPlan(valid, activeContext, installed);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(Object.isFrozen(accepted.value.plan)).toBe(true);
    expect(Object.isFrozen(accepted.value.plan.nodes)).toBe(true);
    expect(Object.isFrozen(accepted.value.plan.nodes[0])).toBe(true);
    expect(Object.isFrozen(accepted.value.plan.nodes[0]!.config)).toBe(true);
    expect(Object.isFrozen(accepted.value.plan.nodes[0]!.config.values)).toBe(true);

    const malformed = {...valid, unexpected: true, nodes: valid.nodes.map(node => ({...node}))} as unknown;
    expect(validatePresentationPlan(malformed, activeContext, installed).ok).toBe(false);
    expect(validatePresentationPlan(malformed, activeContext, installed).ok).toBe(false);

    const malformedNode = {...valid, nodes: valid.nodes.map(node => ({...node, unexpected: 'raw'}))} as unknown;
    expect(validatePresentationPlan(malformedNode, activeContext, installed).ok).toBe(false);
    expect(validatePresentationPlan(malformedNode, activeContext, installed).ok).toBe(false);
  });
});
