import { createQueryFunctionRegistry } from '@aeliqo/core/expressions';
import { defineResource, type Intent } from '@aeliqo/core';
import { createLocalDataService } from '@aeliqo/runtime/data';
import { createAeliqoApp, type WebRenderReceipt } from '@aeliqo/web/app';
import { z } from 'zod';

const PEOPLE = Object.freeze([
  { id: 'p-1', name: 'Ada Chen', team: 'Design', location: 'Jakarta' },
  { id: 'p-2', name: 'Sam Rivera', team: 'Engineering', location: 'Lisbon' },
  { id: 'p-3', name: 'Iman Putra', team: 'Engineering', location: 'Bandung' },
  { id: 'p-4', name: 'Lee Morgan', team: 'Operations', location: 'London' },
]);

const people = defineResource({
  id: 'people',
  revision: 'home-people-1',
  label: 'People',
  identity: ['id'],
  schema: z.object({ id: z.string(), name: z.string(), team: z.string(), location: z.string() }),
  fields: { name: { label: 'Name' }, team: { label: 'Team', role: 'dimension' }, location: { label: 'Location' } },
  presentation: { allowedViews: ['table', 'cards'] },
});

const functions = createQueryFunctionRegistry({ version: '2' });
if (!functions.ok) throw new Error(functions.diagnostics[0].message);
const functionRegistry = functions.value;

export interface HomePeopleExample {
  render(team?: string): Promise<WebRenderReceipt>;
  dispose(): void;
}

/** A small real consumer of the same public app facade used by the playground. */
export function mountPeopleExample(target: HTMLElement): HomePeopleExample {
  const data = createLocalDataService({
    snapshot: { catalog: people.catalog, sourceRevision: 'home-data-1', records: { people: PEOPLE } },
    functionRegistry,
    sourceLimits: { rows: 100, bytes: 250_000 },
    authorize: ({ context }) =>
      context.principal === 'home-public'
        ? { ok: true, value: { scopeDigest: 'home-synthetic', policyRevision: 'home-policy-1' } }
        : {
            ok: false,
            diagnostics: [
              { code: 'home.denied', message: 'The public demo principal is unavailable.', retryable: false },
            ],
          },
  });
  const app = createAeliqoApp({
    resources: [{ resource: people, data }],
    authority: {
      read: () => ({
        ok: true,
        value: {
          principalKey: 'home-public',
          scopeDigest: 'home-synthetic',
          policyRevision: 'home-policy-1',
          experienceRevision: 'home-web-1',
          grants: ['task.evaluate', 'result.inspect', 'experience.commit'],
          readContext: { principal: 'home-public' },
        },
      }),
    },
  });
  const mounted = app.mount({ target, regionId: 'home-demo', resourceId: 'people' });
  if (!mounted.ok) throw new Error(mounted.diagnostics[0].message);
  let request = 0;

  return Object.freeze({
    render(team = 'all') {
      const intent: Intent = {
        version: '1',
        id: `home-browse-${++request}`,
        kind: 'browse',
        resource: 'people',
        fields: ['name', 'team', 'location'],
        ...(team === 'all' ? {} : { filter: { op: 'compare', field: 'team', comparison: 'eq', value: team } }),
      };
      return app.render({ regionId: 'home-demo', intent });
    },
    dispose() {
      app.dispose();
    },
  });
}
