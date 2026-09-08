import {describe, expect, it} from 'vitest';
import {createQueryFunctionRegistry, type Catalog, type Outcome} from '../../packages/core/src/index.js';
import {createQueryPlanner} from '../../packages/core/src/query/planner.js';
import type {LogicalPlan, QuerySource, RelationalQuery} from '../../packages/core/src/query/types.js';
const unwrap = <T>(outcome: Outcome<T>): T => {if (!outcome.ok) throw new Error(JSON.stringify(outcome.diagnostics)); return outcome.value;};
const registry = unwrap(createQueryFunctionRegistry());
const catalog: Catalog = {version: '1', revision: 'catalog-1', functionRegistryDigest: registry.digest,
  entities: [{id: 'facts', label: 'Synthetic facts', identity: ['id'], rowGrain: ['id'], fields: [
    {id: 'id', label: 'ID', role: 'identity', type: {value: 'text', nullable: false}},
    {id: 'value', label: 'Value', role: 'measure', type: {value: 'integer', nullable: true}},
  ]}], relationships: [], meanings: [], capabilities: []};
const pins = {catalogRevision: catalog.revision, functionRegistryDigest: registry.digest,
  sourceRevision: 'source-1', scopeDigest: 'alice', policyRevision: 'policy-1'};
const query: RelationalQuery = {root: 'facts', pins, select: [
  {id: 'id', expression: {kind: 'field', entity: 'facts', ref: 'id'}},
  {id: 'value', expression: {kind: 'field', entity: 'facts', ref: 'value'}},
]};
const source: QuerySource = {revision: 'source-1', catalogRevision: 'catalog-1', scopeDigest: 'alice', policyRevision: 'policy-1',
  relations: {facts: {entity: 'facts', complete: true, rows: [{id: 'a', value: 1}, {id: 'b', value: null}]}}};
const planner = () => unwrap(createQueryPlanner({catalog, registry,
  limits: {maxRows: 100, maxJoinRows: 100, maxBytes: 100_000, maxOperations: 100_000}}));

describe('query plan and execution boundaries', () => {
  it('rejects malformed query input without throwing or invoking accessors', () => {
    const engine = planner();
    for (const input of [null, undefined, {}, {root:'facts'}, {...query, select:[null]}, {...query, pins:null}]) {
      expect(() => engine.plan(input as never)).not.toThrow();
      expect(engine.plan(input as never).ok).toBe(false);
    }
    let invoked = false;
    const input = {...query, get filter() {invoked = true; return undefined;}};
    expect(engine.plan(input as never).ok).toBe(false);
    expect(invoked).toBe(false);
  });
  it('takes an immutable plan snapshot independent of caller input mutation', () => {
    const engine = planner();
    const mutable = structuredClone(query);
    const plan = unwrap(engine.plan(mutable));
    const before = JSON.stringify(plan);
    (mutable.select[0] as {expression: unknown}).expression = {kind: 'field', ref: 'secret'};
    expect(JSON.stringify(plan)).toBe(before);
    expect(Object.isFrozen(plan.nodes)).toBe(true);
    expect(Object.isFrozen(plan.nodes[0]!.output.fields)).toBe(true);
    expect(Object.isFrozen(plan.nodes[0]!.output.fields[0]!.type)).toBe(true);
    expect(unwrap(engine.evaluate(plan, source)).rows).toEqual(source.relations.facts!.rows);
  });
  it('requires actual source and policy pins to match accepted plans', () => {
    const engine = planner(); const plan = unwrap(engine.plan(query));
    for (const changed of [
      {...source, revision: 'source-2'}, {...source, catalogRevision: 'catalog-2'},
      {...source, scopeDigest: 'bob'}, {...source, policyRevision: 'policy-2'},
      {...source, scopeDigest: undefined},
    ]) expect(engine.evaluate(plan, changed as QuerySource).ok).toBe(false);
    expect(engine.evaluate(plan, source, {scopeDigest: 'bob'}).ok).toBe(false);
    expect(engine.evaluate(plan, source, {policyRevision: 'policy-2'}).ok).toBe(false);
  });
  it('rejects tampered plan nodes and forged output metadata instead of trusting planKey', () => {
    const engine = planner(); const plan = unwrap(engine.plan(query));
    for (const mutation of [
      (p: any) => {p.nodes[0].entity = 'secret';},
      (p: any) => {p.nodes[0].inputs = [p.root];},
      (p: any) => {p.output.fields[0].type.value = 'float';},
      (p: any) => {p.root = 'missing-node';},
    ]) {
      const changed = structuredClone(plan); mutation(changed);
      expect(() => engine.evaluate(changed as LogicalPlan, source)).not.toThrow();
      expect(engine.evaluate(changed as LogicalPlan, source).ok).toBe(false);
    }
  });
  it('never turns an incomplete materialization into an exact top-k population', () => {
    const engine = planner();
    const plan = unwrap(engine.plan({...query, orderBy: [{expression: {kind: 'field', ref: 'value'}, direction: 'desc', nulls: 'last'}], topK: 1}));
    const partial = {...source, relations: {facts: {...source.relations.facts!, complete: false}}};
    expect(engine.evaluate(plan, partial).ok).toBe(false);
  });
  it('rejects invalid limits and cancelled evaluation before releasing rows', () => {
    for (const maxOperations of [0, -1, 1.5, Infinity, NaN])
      expect(createQueryPlanner({catalog, registry, limits: {maxOperations}}).ok).toBe(false);
    const engine = planner(); const plan = unwrap(engine.plan(query));
    expect(engine.evaluate(plan, source, {cancellation: {aborted: true}}).ok).toBe(false);
    for (const key of ['maxRows', 'maxBytes', 'maxOperations'] as const)
      for (const value of [0, -1, 1.5, Infinity, NaN])
        expect(engine.evaluate(plan, source, {[key]: value}).ok).toBe(false);
    for (const maxMilliseconds of [0, -1, Infinity, NaN])
      expect(engine.evaluate(plan, source, {clock: () => 0, maxMilliseconds}).ok).toBe(false);
  });
  it('fails malformed source values and duplicate normalized identities explicitly', () => {
    const engine = planner(); const plan = unwrap(engine.plan(query));
    for (const rows of [
      [{id: 'a', value: Number.MAX_SAFE_INTEGER + 1}],
      [{id: 'a', value: undefined}],
      [{id: 'a', value: 1}, {id: 'a', value: 2}],
    ]) expect(engine.evaluate(plan, {...source, relations: {facts: {entity: 'facts', complete: true, rows}}} as QuerySource).ok).toBe(false);
  });
});
