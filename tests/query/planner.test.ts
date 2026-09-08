import {describe, expect, it} from 'vitest';
import {createFunctionRegistry, createQueryFunctionRegistry, queryFunctionSignatures} from '../../packages/core/src/expressions/registry.js';
import {createQueryPlanner} from '../../packages/core/src/query/planner.js';
import type {Catalog, QuerySpec} from '../../packages/core/src/contracts/types.js';
import type {RelationalQuery, QuerySource} from '../../packages/core/src/query/types.js';

const registry = createQueryFunctionRegistry();
if (!registry.ok) throw new Error('query registry fixture failed');
const catalog: Catalog = {
  version: '1', revision: 'query-catalog-1', functionRegistryDigest: registry.value.digest,
  entities: [{id: 'events', label: 'Events', identity: ['id'], rowGrain: ['id'], fields: [
    {id: 'id', label: 'ID', type: {value: 'text', nullable: false}, role: 'identity'},
    {id: 'partition', label: 'Partition', type: {value: 'text', nullable: false}, role: 'attribute'},
    {id: 'sequence', label: 'Sequence', type: {value: 'integer', nullable: false}, role: 'dimension'},
    {id: 'score', label: 'Score', type: {value: 'integer', nullable: false}, role: 'measure'},
    {id: 'value', label: 'Value', type: {value: 'integer', nullable: true}, role: 'measure'},
  ]}], relationships: [], meanings: [], capabilities: [],
};
const field = (ref: string) => ({kind: 'field' as const, entity: 'events', ref});
const source: QuerySource = {revision: 'source-1', catalogRevision: catalog.revision, relations: {events: {entity: 'events', complete: true, rows: [
  {id: 'a1', partition: 'A', sequence: 1, score: 100, value: 10},
  {id: 'a2', partition: 'A', sequence: 2, score: 100, value: null},
  {id: 'a3', partition: 'A', sequence: 3, score: 90, value: 30},
  {id: 'a4', partition: 'A', sequence: 4, score: 80, value: 5},
  {id: 'b1', partition: 'B', sequence: 1, score: 50, value: 7},
]}}};
const pins = {catalogRevision: catalog.revision, functionRegistryDigest: registry.value.digest};

function query(catalogRevision = catalog.revision, functionRegistryDigest = registry.value.digest): RelationalQuery {
  return {root: 'events', pins: {catalogRevision, functionRegistryDigest}, select: [
    {id: 'id', expression: field('id')}, {id: 'windowSum', expression: {kind: 'field', ref: 'windowSum'}}, {id: 'rank', expression: {kind: 'field', ref: 'rank'}},
  ], windows: [
    {id: 'windowSum', function: {id: 'core.window.sum', revision: '1'}, arguments: [field('value')], partitionBy: [field('partition')], orderBy: [
      {expression: field('sequence'), direction: 'asc', nulls: 'last'}, {expression: field('id'), direction: 'asc', nulls: 'last'},
    ], frame: {preceding: 1, following: 1}},
    {id: 'rank', function: {id: 'core.window.rank', revision: '1'}, arguments: [], partitionBy: [field('partition')], orderBy: [
      {expression: field('score'), direction: 'desc', nulls: 'last'}, {expression: field('id'), direction: 'asc', nulls: 'last'},
    ], frame: {preceding: 0, following: 0}},
  ]};
}

describe('bounded query planner/evaluator', () => {
  it('executes window null propagation and competition rank', () => {
    const planner = createQueryPlanner({catalog, registry: registry.value});
    expect(planner.ok).toBe(true);
    if (!planner.ok) return;
    const plan = planner.value.plan(query());
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const result = planner.value.evaluate(plan.value, source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows.map((row) => row.rank)).toEqual([1, 1, 3, 4, 1]);
    expect(result.value.rows.map((row) => row.windowSum)).toEqual([null, null, null, 35, 7]);
  });

  it('rejects an altered plan even when its canonical strings are retained', () => {
    const planner = createQueryPlanner({catalog, registry: registry.value});
    expect(planner.ok).toBe(true);
    if (!planner.ok) return;
    const plan = planner.value.plan(query());
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const altered = {...plan.value, nodes: plan.value.nodes.map((node, index) => index === 0 && node.op === 'scan' ? {...node, entity: 'forged'} : node)};
    const result = planner.value.evaluate(altered, source);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0]?.code).toBe('query.plan');
  });

  it('does not execute a redefined trusted function reference', () => {
    const redefined = createFunctionRegistry({digest: 'redefined-query', signatures: queryFunctionSignatures.map((signature) => signature.ref.id === 'core.add' ? {...signature, operation: 'divide' as const, zeroDenominator: 'null' as const} : signature)});
    expect(redefined.ok).toBe(true);
    if (!redefined.ok) return;
    const redefinedCatalog = {...catalog, functionRegistryDigest: redefined.value.digest};
    const planner = createQueryPlanner({catalog: redefinedCatalog, registry: redefined.value});
    expect(planner.ok).toBe(true);
    if (!planner.ok) return;
    const plan = planner.value.plan(query(redefinedCatalog.revision, redefined.value.digest));
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const result = planner.value.evaluate(plan.value, source);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0]?.code).toBe('query.unsupported');
  });

  it('evaluates approved aggregate expression trees at group grain', () => {
    const aggregateQuery: RelationalQuery = {
      root: 'events', pins, groupBy: [{id: 'partition', expression: field('partition')}], select: [
        {id: 'partition', expression: field('partition')}, {id: 'net', expression: {kind: 'field', ref: 'net'}},
      ], aggregates: [{id: 'net', function: {id: 'core.subtract', revision: '1'}, arguments: [
        {kind: 'call', function: {id: 'core.aggregate.sum', revision: '1'}, arguments: [field('score')]},
        {kind: 'call', function: {id: 'core.aggregate.sum', revision: '1'}, arguments: [field('sequence')]},
      ]}],
    };
    const planner = createQueryPlanner({catalog, registry: registry.value});
    expect(planner.ok).toBe(true);
    if (!planner.ok) return;
    const plan = planner.value.plan(aggregateQuery);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const result = planner.value.evaluate(plan.value, source);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.rows.map((row) => [row.partition, row.net])).toEqual([['A', 360], ['B', 49]]);
  });

  it('lowers QuerySpec meanings without discarding aggregate expression trees', () => {
    const meaningCatalog: Catalog = {...catalog, meanings: [{
      id: 'net', revision: '1', label: 'Net', explanation: 'Revenue minus cost',
      output: {value: 'integer', nullable: false}, implementation: {kind: 'expression', expression: {
        kind: 'call', function: {id: 'core.subtract', revision: '1'}, arguments: [
          {kind: 'call', function: {id: 'core.aggregate.sum', revision: '1'}, arguments: [field('score')]},
          {kind: 'call', function: {id: 'core.aggregate.sum', revision: '1'}, arguments: [field('sequence')]},
        ],
      }}, dependencies: [], functionRegistryDigest: registry.value.digest, origin: 'manual', lifecycle: 'active', scope: 'organization', authority: 'approved', aggregation: 'additive', aggregationDimensions: [], missingPolicy: 'propagate',
    }]};
    const querySpec: QuerySpec = {entity: 'events', fields: ['partition'], measures: [{id: 'net', revision: '1'}], relations: [], groupBy: ['partition'], population: {kind: 'all-authorized'}, order: []};
    const planner = createQueryPlanner({catalog: meaningCatalog, registry: registry.value});
    expect(planner.ok).toBe(true);
    if (!planner.ok) return;
    const plan = planner.value.plan(querySpec);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const result = planner.value.evaluate(plan.value, source);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.rows.map((row) => [row.partition, row.net])).toEqual([['A', 360], ['B', 49]]);
  });
});
