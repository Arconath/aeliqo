import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {
  ResourceDefinitionError,
  compileIntent,
  createIntentCompilerRegistry,
  createQueryFunctionRegistry,
  createQueryPlanner,
  defineResource,
  parseIntent,
  type Task,
} from '../../packages/core/src/index.js';

const people = defineResource({
  id: 'people',
  label: 'People',
  revision: 'people-1',
  identity: ['id'],
  schema: z.object({
    id: z.string(),
    name: z.string(),
    team: z.string(),
    joinedAt: z.iso.date().nullable(),
  }),
  fields: {
    name: {label: 'Name'},
    team: {label: 'Team', role: 'dimension'},
    joinedAt: {label: 'Joined', role: 'time'},
  },
  presentation: {
    allowedViews: ['table', 'cards', 'detail'],
    preferred: {browse: 'table', detail: 'detail'},
  },
});

describe('0.3 resource definitions', () => {
  it('derives a Catalog and retains semantic metadata without treating numbers as measures', () => {
    expect(people.catalog.entities).toHaveLength(1);
    expect(people.entity.identity).toEqual(['id']);
    expect(people.entity.fields.find((field) => field.id === 'team')).toMatchObject({role: 'dimension'});
    expect(people.entity.fields.find((field) => field.id === 'joinedAt')).toMatchObject({
      role: 'time', type: {value: 'date', nullable: true, temporal: {calendar: 'gregorian', grain: 'day'}},
    });
    expect(people.parseRecord({id: 'p1', name: 'Ada', team: 'Core', joinedAt: null}).ok).toBe(true);
    expect(people.parseRecord({id: 'p1', name: 7, team: 'Core', joinedAt: null}).ok).toBe(false);
  });

  it('rejects optional/missing row fields instead of pretending they are nullable', () => {
    expect(() => defineResource({
      id: 'bad', label: 'Bad', revision: '1', identity: ['id'],
      schema: z.object({id: z.string(), name: z.string().optional()}),
      presentation: {allowedViews: ['table']},
    })).toThrow(ResourceDefinitionError);
    try {
      defineResource({
        id: 'bad', label: 'Bad', revision: '1', identity: ['id'],
        schema: z.object({id: z.string(), name: z.string().optional()}),
        presentation: {allowedViews: ['table']},
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ResourceDefinitionError);
      expect((error as ResourceDefinitionError).diagnostics[0].code).toBe('resource.optional-field');
    }
  });
});

describe('0.3 intent compiler', () => {
  it('parses and compiles browse with bounded search into one ordinary Task', () => {
    const intent = {version: '1', id: 'browse-people', resource: 'people', kind: 'browse',
      fields: ['id', 'name', 'team'], search: {text: 'platform', fields: ['name', 'team']},
      sort: [{field: 'name', direction: 'asc'}]} as const;
    expect(parseIntent(intent).ok).toBe(true);
    const compiled = compileIntent(intent, {resource: people, regionId: 'main'});
    expect(compiled.ok).toBe(true);
    if (!compiled.ok || compiled.value.kind !== 'data') return;
    expect(compiled.value.viewPreference).toEqual({representation: 'table', strength: 'preferred'});
    expect(compiled.value.outputs[0]?.kind).toBe('query');
    if (compiled.value.outputs[0]?.kind !== 'query') return;
    expect(compiled.value.outputs[0].query.search).toEqual({text: 'platform', fields: ['name', 'team']});
  });

  it('lowers search through the normal query planner and evaluates case-insensitively', () => {
    const registry = createQueryFunctionRegistry({version: '2'});
    expect(registry.ok).toBe(true);
    if (!registry.ok) return;
    const planner = createQueryPlanner({catalog: people.catalog, registry: registry.value});
    expect(planner.ok).toBe(true);
    if (!planner.ok) return;
    const plan = planner.value.plan({entity: 'people', fields: ['id', 'name', 'team'], measures: [], relations: [], groupBy: [],
      search: {text: 'PLATFORM', fields: ['team']}, population: {kind: 'all-authorized'}, order: []});
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const result = planner.value.evaluate(plan.value, {revision: 'rows-1', relations: {people: {entity: 'people', complete: true, rows: [
      {id: 'p1', name: 'Ada', team: 'Platform', joinedAt: null},
      {id: 'p2', name: 'Grace', team: 'Research', joinedAt: null},
    ]}}});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.rows).toEqual([{id: 'p1', name: 'Ada', team: 'Platform'}]);
  });

  it('rejects unknown resource, identity, view, and custom compiler output pins', () => {
    expect(compileIntent({version: '1', id: 'x', resource: 'other', kind: 'browse'}, {resource: people, regionId: 'main'})).toMatchObject({ok: false});
    expect(compileIntent({version: '1', id: 'x', resource: 'people', kind: 'detail', identity: {wrong: 'p1'}}, {resource: people, regionId: 'main'})).toMatchObject({ok: false});
    expect(compileIntent({version: '1', id: 'x', resource: 'people', kind: 'browse', preferredView: 'raw-html'}, {resource: people, regionId: 'main'})).toMatchObject({ok: false});

    const registry = createIntentCompilerRegistry([{ref: {id: 'example.board', revision: '1'}, schema: z.object({group: z.string()}), capabilities: ['data.browse'],
      compile: (_input, context) => ({ok: true, value: {
        version: '1', id: 'custom', revision: '1', catalogRevision: 'wrong', functionRegistryDigest: context.resource.catalog.functionRegistryDigest,
        regionId: context.regionId, kind: 'presentation', goal: 'Board', needs: [], assumptions: [], inputs: [],
      } satisfies Task})}]);
    expect(registry.ok).toBe(true);
    if (!registry.ok) return;
    expect(compileIntent({version: '1', id: 'x', resource: 'people', kind: 'custom', intent: {id: 'example.board', revision: '1'}, input: {group: 'team'}},
      {resource: people, regionId: 'main', customIntents: registry.value})).toMatchObject({ok: false, diagnostics: [{code: 'intent.compiler-stale'}]});
  });
});
