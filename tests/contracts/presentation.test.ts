import {describe, expect, it} from 'vitest';
import {composePresentation, createPresentationRegistry, validatePresentationPlan} from '../../packages/core/src/presentation/index.js';
import type {PresentationContext, PresentationManifest, PresentationRegistry} from '../../packages/core/src/presentation/index.js';
import type {PresentationPlan} from '../../packages/core/src/contracts/types.js';
import {environment, experience, presentationPlan, presentationTask, result} from './fixtures.js';

const read = {id: 'data.read', revision: '1'};
const table: PresentationManifest = {
  ref: {id: 'data.table', revision: '1'}, configSchema: {id: 'data.table.config', revision: '1'}, roles: ['table'], operations: [read],
  result: 'required', children: {min: 0, max: 0}, visibility: 'leaf', extension: false,
  resolveConfig: (values, descriptor) => Object.keys(values).length === 0 && descriptor !== undefined
    ? {ok: true, value: {values: {}, fields: descriptor.fields.map(f => f.id), ports: []}}
    : {ok: false, diagnostics: [{code: 'table.config', message: 'Only the registered empty table config is supported here.', retryable: false}]},
  suggestConfig: () => ({ok: true, value: {}}),
};
const stack: PresentationManifest = {
  ref: {id: 'layout.stack', revision: '1'}, configSchema: {id: 'layout.stack.config', revision: '1'}, roles: ['structure'], operations: [],
  result: 'none', children: {min: 0, max: 32}, visibility: 'simultaneous', extension: false,
  resolveConfig: values => Object.keys(values).length === 0 ? {ok: true, value: {values: {}, fields: [], ports: []}}
    : {ok: false, diagnostics: [{code: 'layout.config', message: 'Invalid layout config.', retryable: false}]},
  suggestConfig: () => ({ok: true, value: {}}),
};
function registry(entries: readonly PresentationManifest[] = [table, stack]): PresentationRegistry {
  const r = createPresentationRegistry(entries); if (!r.ok) throw new Error(JSON.stringify(r.diagnostics)); return r.value;
}
const context = (): PresentationContext => ({
  task: {...presentationTask, needs: [{id: 'browse', operation: read, fields: ['employee.id'], outputId: 'rows', required: true}]},
  experience: {...experience, mode: 'composable', allowedRepresentations: ['data.table', 'layout.stack']}, results: [result],
  current: presentationPlan.preconditions, environment, rendererCapabilities: [table.ref, stack.ref],
});
const plan = (): PresentationPlan => ({...presentationPlan, coverage: [{needId: 'browse', nodeIds: ['table-1'], operations: [read]}]});
const checked = (p: unknown, ctx = context(), r = registry()) => validatePresentationPlan(p, ctx, r);

describe('registered presentation feasibility', () => {
  it('resolves actual field coverage, freezes owned values and preserves unknown SSR measurements', () => {
    const p = plan(); const c = context(); const parsed = checked(p, c);
    expect(parsed).toMatchObject({ok: true, value: {environment: {inlineSize: {state: 'unknown'}}, nodes: [{config: {fields: ['employee.id']}}]}});
    if (!parsed.ok) return;
    expect(parsed.value.plan).not.toBe(p);
    expect(Object.isFrozen(parsed.value.plan.nodes[0]!.config.values)).toBe(true);
    expect(parsed.value.nodes[0]!.result).not.toBe(c.results[0]);
  });
  it('rejects arbitrary configuration, unknown renderer versions, and forged approval', () => {
    expect(checked({...plan(), approved: true}).ok).toBe(false);
    expect(checked({...plan(), nodes: [{...plan().nodes[0]!, config: {...plan().nodes[0]!.config, values: {html: '<script>bad</script>'}}}]}).ok).toBe(false);
    expect(checked({...plan(), nodes: [{...plan().nodes[0]!, representation: {...table.ref, revision: '2'}}]})).toMatchObject({ok: false, diagnostics: [{code: 'presentation.renderer'}]});
    expect(checked(plan(), {...context(), rendererCapabilities: []}).ok).toBe(false);
  });
  it('rejects descriptor, read-set and task/profile staleness', () => {
    expect(checked(plan(), {...context(), results: []}).ok).toBe(false);
    expect(checked(plan(), {...context(), current: {...context().current, regionRevision: 'new'}})).toMatchObject({ok: false, diagnostics: [{code: 'commit.stale'}]});
    expect(checked(plan(), {...context(), task: {...context().task, revision: 'new'}}).ok).toBe(false);
    expect(checked({...plan(), preconditions: {...plan().preconditions, results: []}}).ok).toBe(false);
  });
  it('enforces actual operations and information coverage rather than trusting the coverage annotation', () => {
    expect(checked({...plan(), coverage: []})).toMatchObject({ok: false, diagnostics: [{code: 'presentation.coverage'}]});
    expect(checked(plan(), {...context(), task: {...context().task, needs: [{...context().task.needs[0]!, fields: ['not-displayed']}]}}).ok).toBe(false);
    expect(checked(plan(), context(), registry([{...table, operations: []}, stack])).ok).toBe(false);
    expect(checked({...plan(), coverage: [{...plan().coverage[0]!, nodeIds: ['missing']}]}).ok).toBe(false);
    expect(checked({...plan(), coverage: [...plan().coverage, ...plan().coverage]}).ok).toBe(false);
  });
  it('rejects cycles, unreachable nodes, duplicated child ownership and wrong root', () => {
    const child = {...plan().nodes[0]!, id: 'child'};
    for (const p of [
      {...plan(), rootId: 'missing'},
      {...plan(), nodes: [plan().nodes[0]!, child]},
      {...plan(), nodes: [{...plan().nodes[0]!, children: ['child', 'child']}, child]},
      {...plan(), nodes: [{...plan().nodes[0]!, children: ['child']}, {...child, children: ['table-1']}]},
    ]) expect(checked(p).ok).toBe(false);
  });
  it('requires the claimed operation to be enabled by the resolved configuration', () => {
    const configured = (operations: readonly {id: string; revision: string}[]): PresentationManifest => ({...table,
      resolveConfig: (values, descriptor) => ({ok: true, value: {values, fields: descriptor!.fields.map(f => f.id), ports: [], operations}})});
    expect(checked(plan(), context(), registry([configured([]), stack]))).toMatchObject({ok: false, diagnostics: [{code: 'presentation.coverage'}]});
    expect(checked(plan(), context(), registry([configured([read]), stack])).ok).toBe(true);
    expect(checked(plan(), context(), registry([configured([{id: 'undeclared', revision: '1'}]), stack]))).toMatchObject({ok: false, diagnostics: [{code: 'presentation.configuration'}]});
    expect(checked(plan(), context(), registry([configured([read, read]), stack]))).toMatchObject({ok: false, diagnostics: [{code: 'presentation.configuration'}]});
    const composed = composePresentation({id: 'disabled-read', revision: '1', preconditions: plan().preconditions, context: context()}, registry([configured([]), stack]));
    expect(composed).toMatchObject({ok: true, value: {status: 'search-exhausted'}});
  });
  it('intersects profile and explicit restrictions, including no-preset prohibition', () => {
    expect(checked(plan(), {...context(), experience: {...context().experience, allowedRepresentations: []}}).ok).toBe(false);
    expect(checked(plan(), {...context(), restrictions: [{id: 'deny-read', allowedOperations: []}]}).ok).toBe(false);
    expect(checked(plan(), {...context(), experience: {...context().experience, composition: {...context().experience.composition, allowWithoutPreset: false}}})).toMatchObject({ok: false, diagnostics: [{code: 'presentation.pattern-required'}]});
  });
  it('does not let exclusive panels conceal a required simultaneous comparison', () => {
    const second = {...plan().nodes[0]!, id: 'second'};
    const p: PresentationPlan = {...plan(), rootId: 'layout', nodes: [{id: 'layout', role: 'structure', representation: stack.ref, config: {schema: stack.configSchema, values: {}}, children: ['table-1', 'second']}, ...plan().nodes, second],
      coverage: [...plan().coverage, {needId: 'compare', nodeIds: ['second'], operations: [read]}]};
    const c: PresentationContext = {...context(), task: {...context().task, needs: [{...context().task.needs[0]!, simultaneousGroup: 'comparison'}, {...context().task.needs[0]!, id: 'compare', simultaneousGroup: 'comparison'}]}};
    expect(checked(p, c).ok).toBe(true);
    expect(checked(p, c, registry([table, {...stack, visibility: 'exclusive'}]))).toMatchObject({ok: false, diagnostics: [{code: 'presentation.simultaneous'}]});
  });
  it('keeps fixed layouts and active focus/draft transitions stable', () => {
    const p: PresentationPlan = {...plan(), nodes: [{...plan().nodes[0]!, id: 'new'}], rootId: 'new', coverage: [{...plan().coverage[0]!, nodeIds: ['new']}]};
    expect(checked(p, {...context(), incumbent: plan(), experience: {...context().experience, mode: 'fixed'}}).ok).toBe(false);
    expect(checked(p, {...context(), incumbent: plan(), transitionBlocked: true}).ok).toBe(false);
    expect(checked(p, {...context(), incumbent: plan(), experience: {...context().experience, transitionPolicy: 'explicit-only'}}).ok).toBe(false);
    expect(checked(p, {...context(), incumbent: plan(), experience: {...context().experience, transitionPolicy: 'explicit-only'}, explicitTransition: true}).ok).toBe(false);
  });
  it('retains installed mappings and validates real linked selection ports', () => {
    const shape = {payload: 'selection' as const, entity: 'employees', identity: ['employee.id'], grain: ['employee.id']};
    const mapped = createPresentationRegistry([{...table, resolveConfig: (values, descriptor) => ({ok: true, value: {values, fields: descriptor!.fields.map(f => f.id), ports: [{...shape, id: 'selection', direction: 'inout'}]}})}, stack],
      [{ref: {id: 'selection.identity', revision: '1'}, source: shape, target: shape, kind: 'identity'}]);
    expect(mapped.ok).toBe(true); if (!mapped.ok) return;
    expect(mapped.value.mappings).toHaveLength(1);
    const p: PresentationPlan = {...plan(), rootId: 'layout', nodes: [{id: 'layout', role: 'structure', representation: stack.ref, config: {schema: stack.configSchema, values: {}}, children: ['table-1', 'second']}, ...plan().nodes, {...plan().nodes[0]!, id: 'second'}],
      links: [{id: 'linked', source: {node: 'table-1', port: 'selection'}, target: {node: 'second', port: 'selection'}, mapping: {id: 'selection.identity', revision: '1'}, propagation: 'identity-equivalence'}]};
    expect(checked(p, context(), mapped.value)).toMatchObject({ok: true, value: {graph: {links: [{id: 'linked'}]}}});
  });
  it('requires explicit identity transfers while adding a layout around a stable view', () => {
    const p: PresentationPlan = {...plan(), rootId: 'layout', nodes: [{id: 'layout', role: 'structure', representation: stack.ref, config: {schema: stack.configSchema, values: {}}, children: ['table-1']}, ...plan().nodes]};
    const c = {...context(), incumbent: plan()};
    expect(checked(p, c)).toMatchObject({ok: false, diagnostics: [{code: 'presentation.state-transfer'}]});
    const transfer = {fromNode: 'table-1', toNode: 'table-1', mapping: {id: 'aeliqo.state.identity', revision: '1'}};
    expect(checked({...p, stateTransfer: [transfer]}, c).ok).toBe(true);
    expect(checked({...p, stateTransfer: [transfer, transfer]}, c).ok).toBe(false);
  });
  it('rejects unsupported state transfers and asynchronous/malformed configuration validators', () => {
    expect(checked({...plan(), stateTransfer: [{fromNode: 'table-1', toNode: 'table-1', mapping: {id: 'fake', revision: '1'}}]}, {...context(), incumbent: plan()}).ok).toBe(false);
    expect(checked(plan(), context(), registry([{...table, resolveConfig: (() => Promise.resolve({ok: true, value: {values: {}, fields: [], ports: []}})) as never}])).ok).toBe(false);
    expect(checked(plan(), context(), registry([{...table, resolveConfig: () => ({ok: true, value: {values: {}, fields: ['invented'], ports: []}})}])).ok).toBe(false);
  });
  it('constructs a complete no-preset candidate within a one-expansion budget', () => {
    const c: PresentationContext = {...context(), experience: {...context().experience, composition: {...context().experience.composition, maxExpansions: 1}}};
    const composed = composePresentation({id: 'composed', revision: '1', preconditions: c.current, context: c}, registry());
    expect(composed).toMatchObject({ok: true, value: {status: 'composed', expansions: 1, presentation: {plan: {rootId: 'layout'}}}});
    if (!composed.ok || composed.value.presentation === undefined) return;
    expect(checked(composed.value.presentation.plan, c).ok).toBe(true);
    expect(composed.value.presentation.plan.coverage).toEqual([{needId: 'browse', nodeIds: ['view.browse'], operations: [read]}]);
  });
  it('uses the same validator for explicit candidates and retains a feasible incumbent', () => {
    const r = registry(); const c = {...context(), incumbent: plan()};
    expect(composePresentation({id: 'compose', revision: '1', context: c, preconditions: c.current}, r)).toMatchObject({ok: true, value: {status: 'composed', expansions: 1, presentation: {plan: {id: 'compose'}}}});
    const explicit = composePresentation({id: 'compose', revision: '1', context: context(), preconditions: c.current, candidates: [{source: 'explicit', plan: {...plan(), coverage: []}}]}, r);
    expect(explicit).toMatchObject({ok: true, value: {status: 'composed', expansions: 2, rejected: [{candidate: 'plan-1'}]}});
  });
  it('rejects stale or invalid composition requests even with a feasible incumbent', () => {
    const c = {...context(), incumbent: plan()};
    expect(composePresentation({id: 'compose', revision: '1', context: c, preconditions: {...c.current, regionRevision: 'stale'}}, registry()).ok).toBe(false);
    expect(composePresentation({id: '', revision: '1', context: c, preconditions: c.current}, registry()).ok).toBe(false);
  });
  it('refuses ambiguous generated output revisions and results outside the Task inputs', () => {
    const other = {...result, ref: {...result.ref, revision: 'other'}};
    const c: PresentationContext = {...context(), results: [other, result], current: {...context().current, results: [other.ref, result.ref]}};
    expect(composePresentation({id: 'compose', revision: '1', context: c, preconditions: c.current}, registry())).toMatchObject({ok: false, diagnostics: [{code: 'presentation.ambiguous-result'}]});
    expect(checked({...plan(), preconditions: c.current, nodes: [{...plan().nodes[0]!, result: other.ref}]}, c)).toMatchObject({ok: false, diagnostics: [{code: 'presentation.binding'}]});
  });
  it('guards changes to operation coverage while an interaction owns the active view', () => {
    const c = {...context(), incumbent: plan(), transitionBlocked: true};
    const p = {...plan(), coverage: [{...plan().coverage[0]!, operations: [read, {id: 'other', revision: '1'}]}]};
    expect(checked(p, c, registry([{...table, operations: [read, {id: 'other', revision: '1'}]}, stack]))).toMatchObject({ok: false, diagnostics: [{code: 'presentation.transition'}]});
  });
  it('reports exhausted search separately from impossibility and does not exceed its bound', () => {
    const r = registry([{...table, suggestConfig: () => ({ok: true, value: {bad: 'config'}})}, stack]);
    const c = context();
    expect(composePresentation({id: 'compose', revision: '1', context: c, preconditions: c.current}, r)).toMatchObject({ok: true, value: {status: 'search-exhausted', expansions: 1}});
    expect(createPresentationRegistry([table, table]).ok).toBe(false);
  });
});
