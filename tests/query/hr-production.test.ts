import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {createQueryFunctionRegistry} from '../../packages/core/src/expressions/registry.js';
import {createQueryPlanner} from '../../packages/core/src/query/planner.js';
import type {Catalog, Expression, FieldDefinition, SemanticType} from '../../packages/core/src/contracts/types.js';
import type {QueryResult, QuerySource, RelationalQuery} from '../../packages/core/src/query/types.js';

type Employee = {readonly id: string; readonly name: string; readonly department: string};
type Schedule = {readonly employee_id: string; readonly date: string};
type Observation = {readonly id: string; readonly employee_id: string; readonly date: string; readonly status: 'present' | 'absent'};
type Leave = {readonly employee_id: string; readonly date: string; readonly approved: boolean};
type HrRaw = {
  readonly synthetic: boolean;
  readonly policy: {
    readonly period: {readonly from: string; readonly toExclusive: string; readonly timezone: string; readonly calendar: string};
  };
  readonly employees: readonly Employee[];
  readonly schedules: readonly Schedule[];
  readonly observations: readonly Observation[];
  readonly leave: readonly Leave[];
};
type HrExpectedEmployee = {readonly employee_id: string; readonly absent: number; readonly expected: number; readonly unknown: number; readonly rate: string | null};
type HrExpected = {readonly synthetic: boolean; readonly employees: readonly HrExpectedEmployee[]; readonly topFive: readonly string[]; readonly weekly: readonly unknown[]};
type HrBinding = {
  readonly source: string;
  readonly policy: {readonly calendar: string; readonly timezone: string; readonly from: string; readonly toExclusive: string};
  readonly mutations: readonly {
    readonly id: string;
    readonly removeObservation: {readonly employee_id: string; readonly date: string};
    readonly expected: {
      readonly sameAsBaseline?: boolean;
      readonly employee: HrExpectedEmployee;
      readonly topFive: readonly string[];
    };
  }[];
};

const readJson = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;
const raw = readJson<HrRaw>('../../fixtures/hr/raw.json');
const expected = readJson<HrExpected>('../../fixtures/hr/expected.json');
const binding = readJson<HrBinding>('./oracle/hr-binding.json');

const registryOutcome = createQueryFunctionRegistry();
if (!registryOutcome.ok) throw new Error(JSON.stringify(registryOutcome.diagnostics));
const registry = registryOutcome.value;

const text = (nullable = false): SemanticType => ({value: 'text', nullable});
const bool = (nullable = false): SemanticType => ({value: 'boolean', nullable});
const field = (entity: string, ref: string): Expression => ({kind: 'field', entity, ref});
const plainField = (ref: string): Expression => ({kind: 'field', ref});
const literal = (value: string | boolean | null, type: SemanticType): Expression => ({kind: 'literal', value, type});
const version = (id: string) => ({id, revision: '1'} as const);
const queryPins = {catalogRevision: 'hr-production-oracle', functionRegistryDigest: registry.digest};

function entity(id: string, identity: readonly string[], fields: readonly {id: string; type: SemanticType; role: FieldDefinition['role']}[]): Catalog['entities'][number] {
  const first = identity[0];
  if (first === undefined) throw new Error(`Entity ${id} needs an identity.`);
  return {
    id,
    label: id,
    identity: [first, ...identity.slice(1)],
    rowGrain: [first, ...identity.slice(1)],
    fields: fields.map((field) => ({...field, label: field.id})),
  };
}

const relationship = (id: string, targetEntity: string, keys: readonly {sourceField: string; targetField: string}[], cardinality: 'many-to-one' = 'many-to-one') => ({
  id,
  revision: '1',
  sourceEntity: 'schedules',
  targetEntity,
  keys: (() => {
    const first = keys[0];
    if (first === undefined) throw new Error(`Relationship ${id} needs a key.`);
    return [first, ...keys.slice(1)] as [{sourceField: string; targetField: string}, ...{sourceField: string; targetField: string}[]];
  })(),
  cardinality,
  optional: true,
  joinPolicy: 'validated' as const,
});

const catalog: Catalog = {
  version: '1',
  revision: queryPins.catalogRevision,
  functionRegistryDigest: registry.digest,
  entities: [
    entity('schedules', ['employee_id', 'date'], [
      {id: 'employee_id', type: text(), role: 'identity'},
      {id: 'date', type: {value: 'date', nullable: false}, role: 'time'},
    ]),
    entity('observations', ['id'], [
      {id: 'id', type: text(), role: 'identity'},
      {id: 'employee_id', type: text(), role: 'attribute'},
      {id: 'date', type: {value: 'date', nullable: false}, role: 'time'},
      {id: 'status', type: text(), role: 'attribute'},
    ]),
    entity('leave', ['employee_id', 'date'], [
      {id: 'employee_id', type: text(), role: 'identity'},
      {id: 'date', type: {value: 'date', nullable: false}, role: 'time'},
      {id: 'approved', type: bool(), role: 'attribute'},
    ]),
  ],
  relationships: [
    relationship('schedule-observation', 'observations', [
      {sourceField: 'employee_id', targetField: 'employee_id'},
      {sourceField: 'date', targetField: 'date'},
    ]),
    relationship('schedule-leave', 'leave', [
      {sourceField: 'employee_id', targetField: 'employee_id'},
      {sourceField: 'date', targetField: 'date'},
    ]),
  ],
  meanings: [],
  capabilities: [],
};

function sourceFor(removeObservation?: {readonly employee_id: string; readonly date: string}): QuerySource {
  const observations = removeObservation === undefined
    ? raw.observations
    : raw.observations.filter((observation) => observation.employee_id !== removeObservation.employee_id || observation.date !== removeObservation.date);
  return {
    revision: removeObservation === undefined ? 'hr-baseline' : `hr-mutation-${removeObservation.employee_id}-${removeObservation.date}`,
    catalogRevision: catalog.revision,
    relations: {
      schedules: {entity: 'schedules', complete: true, rows: raw.schedules},
      observations: {entity: 'observations', complete: true, rows: observations},
      leave: {entity: 'leave', complete: true, rows: raw.leave},
    },
  };
}

type Predicate = NonNullable<RelationalQuery['filter']>;
const leaveEligible: Predicate = {
  op: 'or',
  predicates: [
    {op: 'is-null', expression: field('leave', 'approved'), negate: false},
    {op: 'compare', left: field('leave', 'approved'), comparison: 'eq', right: literal(false, bool())},
  ],
};

function countQuery(kind: 'absent' | 'expected' | 'unknown'): RelationalQuery {
  const statusFilter: Predicate | undefined = kind === 'absent'
    ? {op: 'compare', left: field('observations', 'status'), comparison: 'eq', right: literal('absent', text())}
    : kind === 'unknown'
      ? {op: 'is-null', expression: field('observations', 'status'), negate: false}
      : undefined;
  const filter: Predicate = {op: 'and', predicates: [
    leaveEligible,
    {op: 'compare', left: field('schedules', 'date'), comparison: 'gte', right: literal(binding.policy.from, {value: 'date', nullable: false})},
    {op: 'compare', left: field('schedules', 'date'), comparison: 'lt', right: literal(binding.policy.toExclusive, {value: 'date', nullable: false})},
    ...(statusFilter === undefined ? [] : [statusFilter]),
  ]};
  return {
    root: 'schedules',
    pins: queryPins,
    joins: [
      {id: 'schedule-observation', rightEntity: 'observations', relationship: version('schedule-observation'), kind: 'left'},
      {id: 'schedule-leave', rightEntity: 'leave', relationship: version('schedule-leave'), kind: 'left'},
    ],
    filter,
    groupBy: [{id: 'employee_id', expression: field('schedules', 'employee_id')}],
    aggregates: [{id: kind, function: version('core.aggregate.count'), arguments: [field('schedules', 'date')]}],
    select: [
      {id: 'employee_id', expression: plainField('employee_id')},
      {id: kind, expression: plainField(kind)},
    ],
  };
}

function execute(query: RelationalQuery, source: QuerySource): QueryResult {
  const plannerOutcome = createQueryPlanner({catalog, registry, limits: {
    maxRows: 1_000,
    maxBytes: 1_000_000,
    maxJoinRows: 10_000,
    maxOperations: 100_000,
  }});
  if (!plannerOutcome.ok) throw new Error(JSON.stringify(plannerOutcome.diagnostics));
  const planned = plannerOutcome.value.plan(query);
  if (!planned.ok) throw new Error(JSON.stringify(planned.diagnostics));
  const evaluated = plannerOutcome.value.evaluate(planned.value, source);
  if (!evaluated.ok) throw new Error(JSON.stringify(evaluated.diagnostics));
  return evaluated.value;
}

// This slice binds counts only. Conditional rates, full-period ranking and fixed
// cohort weekly results in the fixture remain explicit integration obligations.
function assertCounts(source: QuerySource, expectedRows: readonly HrExpectedEmployee[]): void {
  for (const kind of ['absent', 'expected', 'unknown'] as const) {
    const result = execute(countQuery(kind), source);
    const wanted = expectedRows.filter((row) => row[kind] > 0)
      .map((row) => ({employee_id: row.employee_id, [kind]: row[kind]}));
    const ordered = (rows: readonly Record<string, unknown>[]) => [...rows]
      .sort((a, b) => String(a.employee_id).localeCompare(String(b.employee_id)));
    expect(ordered(result.rows)).toEqual(ordered(wanted));
    expect(result.complete).toBe(true);
    expect(result.precision.kind).toBe('exact');
  }
}

describe('production query engine raw HR counts (rates and fixed-cohort trends pending)', () => {
  it('binds generic left joins, approved-leave exclusion and missing observation state', () => {
    expect(raw.synthetic).toBe(true);
    expect(binding.source).toBe('fixtures/hr/raw.json');
    expect(raw.policy.period).toMatchObject(binding.policy);
    assertCounts(sourceFor(), expected.employees);
  });

  it('applies both missing observation mutations without changing unrelated employees', () => {
    for (const mutation of binding.mutations) {
      const employee = mutation.expected.employee;
      const expectedRows = expected.employees.map((row) => row.employee_id === employee.employee_id ? {...row, ...employee} : row);
      assertCounts(sourceFor(mutation.removeObservation), expectedRows);
      if (mutation.expected.sameAsBaseline === true)
        expect(expectedRows).toEqual(expected.employees);
    }
  });

  it('excludes scheduled dates outside the declared half-open period', () => {
    const source = sourceFor();
    const employee_id = raw.employees[0]!.id;
    const outside = {...source, relations: {...source.relations, schedules: {
      ...source.relations.schedules!, rows: [...raw.schedules,
        {employee_id, date: '2026-01-04'}, {employee_id, date: binding.policy.toExclusive}],
    }}};
    assertCounts(outside, expected.employees);
  });

  it('rejects duplicate observation join keys before counting a fanout population', () => {
    const source = sourceFor();
    const duplicate = {...source, relations: {...source.relations, observations: {
      ...source.relations.observations!, rows: [...raw.observations, {...raw.observations[0]!, id: 'synthetic-duplicate-observation'}],
    }}};
    expect(() => execute(countQuery('expected'), duplicate)).toThrow(/query\.cardinality/);
  });
});
