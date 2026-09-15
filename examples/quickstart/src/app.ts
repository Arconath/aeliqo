import { createQueryFunctionRegistry, defineResource } from '@aeliqo/core';
import { createLocalDataService, type DataRecord } from '@aeliqo/runtime/data';
import { createAeliqoApp } from '@aeliqo/web/app';
import { z } from 'zod';

export const people = defineResource({
  id: 'people',
  revision: 'people-1',
  label: 'People',
  identity: ['id'],
  schema: z.object({ id: z.string(), name: z.string(), team: z.string() }),
  fields: { name: { label: 'Name' }, team: { label: 'Team', role: 'dimension' } },
  presentation: { allowedViews: ['table', 'cards'] },
});

export function mountPeople(target: HTMLElement, records: readonly DataRecord[]) {
  const functions = createQueryFunctionRegistry({ version: '2' });
  if (!functions.ok) throw new Error(functions.diagnostics[0].message);
  const data = createLocalDataService({
    snapshot: { catalog: people.catalog, sourceRevision: 'people-data-1', records: { people: [...records] } },
    functionRegistry: functions.value,
    sourceLimits: { rows: 1_000, bytes: 1_000_000 },
    authorize: ({ context }) =>
      context.principal === 'current-user'
        ? { ok: true, value: { scopeDigest: 'permitted-people', policyRevision: 'policy-1' } }
        : {
            ok: false,
            diagnostics: [{ code: 'people.denied', message: 'People access is denied.', retryable: false }],
          },
  });
  const app = createAeliqoApp({
    resources: [{ resource: people, data }],
    authority: {
      read: () => ({
        ok: true,
        value: {
          principalKey: 'current-user',
          scopeDigest: 'permitted-people',
          policyRevision: 'policy-1',
          experienceRevision: 'web-1',
          grants: ['task.evaluate', 'result.inspect', 'experience.commit'],
          readContext: { principal: 'current-user' },
        },
      }),
    },
  });
  const mounted = app.mount({ target, regionId: 'people-main', resourceId: 'people' });
  if (!mounted.ok) throw new Error(mounted.diagnostics[0].message);

  return {
    render: () =>
      app.render({
        regionId: 'people-main',
        intent: {
          version: '1',
          id: 'browse-people',
          kind: 'browse',
          resource: 'people',
          fields: ['name', 'team'],
        },
      }),
    dispose: () => app.dispose(),
  };
}
