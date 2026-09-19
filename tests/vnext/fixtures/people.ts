import { defineDataFeature } from '@aeliqo/core/features';
import { createQueryFunctionRegistry } from '@aeliqo/core/expressions';
import {
  createAeliqoRuntime,
  type AeliqoRuntime,
  type DataSurfaceBindings,
  type LocalSurfaceScope,
} from '@aeliqo/runtime';
import { createLocalDataService, type DataService, type LocalSnapshot } from '@aeliqo/runtime/data';
import { z } from 'zod';

export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  team: z.enum(['Design', 'Engineering']),
});

export type Person = z.infer<typeof PersonSchema>;

export const fixtureRows: readonly Person[] = Object.freeze([
  Object.freeze({ id: 'ada', name: 'Ada Chen', team: 'Design' as const }),
  Object.freeze({ id: 'sam', name: 'Sam Rivera', team: 'Engineering' as const }),
]);

export const updatedRows: readonly Person[] = Object.freeze([
  fixtureRows[0]!,
  Object.freeze({ id: 'sam', name: 'Sam Rivera', team: 'Design' as const }),
]);

export const peopleFeature = defineDataFeature({
  id: 'people',
  schema: PersonSchema,
  identity: ['id'],
  fields: { team: { role: 'dimension' } },
});

export interface PeopleSurfaceState {
  readonly rows: readonly Person[];
  readonly selection: readonly string[];
}

export interface PeopleFixtureContract {
  readonly runtime: AeliqoRuntime;
  readonly runtimeId: string;
  readonly scope: LocalSurfaceScope;
  readonly feature: typeof peopleFeature;
  readonly bindings: DataSurfaceBindings<PeopleSurfaceState>;
  readonly source: DataService;
  readonly updatedSnapshot: LocalSnapshot;
  readonly dispose: () => void | Promise<void>;
}

let nextFixtureId = 1;

export function createPeopleFixture(): PeopleFixtureContract {
  const fixtureId = nextFixtureId++;
  const runtimeId = `people-runtime-${fixtureId}`;
  const snapshot: LocalSnapshot = Object.freeze({
    catalog: peopleFeature.catalog,
    sourceRevision: 'people-source-1',
    records: Object.freeze({ people: fixtureRows }),
  });
  const functionRegistry = createQueryFunctionRegistry({ version: '2' });
  if (!functionRegistry.ok) throw new TypeError(functionRegistry.diagnostics[0].message);
  const source = createLocalDataService({
    snapshot,
    functionRegistry: functionRegistry.value,
    authorize: ({ context }) =>
      context.principal === 'local-user'
        ? { ok: true, value: { scopeDigest: `people-local-${fixtureId}`, policyRevision: 'local-policy-1' } }
        : {
            ok: false,
            diagnostics: [{ code: 'data.denied', message: 'The local read was not authorized.', retryable: false }],
          },
  });
  const runtime = createAeliqoRuntime({
    runtimeId,
    resources: [{ resource: peopleFeature.resource, data: source }],
    authority: {
      read: () => ({
        ok: true,
        value: {
          principalKey: 'local-user',
          scopeDigest: `people-local-${fixtureId}`,
          policyRevision: 'local-policy-1',
          experienceRevision: 'local-experience-1',
          grants: ['catalog.read', 'task.evaluate', 'result.inspect'],
          readContext: { principal: 'local-user' },
        },
      }),
    },
  });
  const scope = runtime.createLocalSurfaceScope({
    id: `people-local-${fixtureId}`,
    allowedFeatures: ['people', 'report'],
  });
  const bindings: DataSurfaceBindings<PeopleSurfaceState> = {
    initialState: Object.freeze({ rows: Object.freeze([]), selection: Object.freeze([]) }),
    source: {
      kind: 'data-service',
      service: source,
      coverage: {
        fields: ['id', 'name', 'team'],
        operators: ['eq', 'contains'],
        pagination: 'keyset',
        stableOrder: ['id'],
        sorting: 'stable-fields-only',
        aggregation: 'unsupported',
        streaming: 'finite',
        updates: 'snapshot-replace',
        unsupported: ['aggregation', 'streaming', 'live-updates'],
      },
      normalize: async (events) => {
        const rows: Person[] = [];
        for await (const event of events) {
          if (event.kind !== 'batch') continue;
          for (const row of event.rows) {
            const parsed = peopleFeature.parseRecord(row);
            if (!parsed.ok) throw new TypeError(parsed.diagnostics[0].message);
            rows.push(parsed.value);
          }
        }
        return { rows: Object.freeze(rows), selection: Object.freeze([]) };
      },
    },
  };
  return {
    runtime,
    runtimeId,
    scope,
    feature: peopleFeature,
    bindings,
    source,
    updatedSnapshot: Object.freeze({
      catalog: peopleFeature.catalog,
      sourceRevision: 'people-source-2',
      records: Object.freeze({ people: updatedRows }),
    }),
    dispose: () => {
      runtime.dispose();
      scope.dispose();
    },
  };
}
