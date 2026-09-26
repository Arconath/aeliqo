import { createQueryFunctionRegistry } from '@aeliqo/core/expressions';
import { defineResource, type Intent, type ResourceDefinition } from '@aeliqo/core';
import { createLocalDataService, type DataRecord, type LocalDataService } from '@aeliqo/runtime/data';
import { createAeliqoApp, type AeliqoApp, type AeliqoAppOptions, type WebRenderReceipt } from '@aeliqo/web/app';
import { z } from 'zod';
import { HEADCOUNT_RECORDS, HEADCOUNT_RESOURCE } from './playground/workforce-scenario.js';

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

const readHomeAuthority: AeliqoAppOptions['authority']['read'] = () => ({
  ok: true,
  value: {
    principalKey: 'home-public',
    scopeDigest: 'home-synthetic',
    policyRevision: 'home-policy-1',
    experienceRevision: 'home-web-1',
    grants: ['task.evaluate', 'result.inspect', 'experience.commit'],
    readContext: { principal: 'home-public' },
  },
});

function homeDataService(
  resource: ResourceDefinition,
  records: Readonly<Record<string, readonly DataRecord[]>>,
): LocalDataService {
  return createLocalDataService({
    snapshot: { catalog: resource.catalog, sourceRevision: 'home-data-1', records },
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
}

function createHomeApp(resources: AeliqoAppOptions['resources']): AeliqoApp {
  return createAeliqoApp({ resources, authority: { read: readHomeAuthority } });
}

function mountRegion(app: AeliqoApp, target: HTMLElement, regionId: string, resourceId: string): void {
  const mounted = app.mount({ target, regionId, resourceId });
  if (!mounted.ok) throw new Error(mounted.diagnostics[0].message);
  mounted.value.setAttribute('data-aeliqo-theme', 'light');
}

export interface HomePeopleExample {
  render(team?: string): Promise<WebRenderReceipt>;
  dispose(): void;
}

/** A small real consumer of the same public app facade used by the playground. */
export function mountPeopleExample(target: HTMLElement): HomePeopleExample {
  const app = createHomeApp([{ resource: people, data: homeDataService(people, { people: PEOPLE }) }]);
  mountRegion(app, target, 'home-demo', 'people');
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

export interface HomeProofExample {
  render(): Promise<void>;
  dispose(): void;
}

/**
 * Three live Regions that prove context-driven view selection: the same browse
 * intent becomes a table in a wide container and cards in a compact one, while
 * an analyze intent becomes a chart.
 */
export function mountProofExample(targets: {
  readonly wide: HTMLElement;
  readonly narrow: HTMLElement;
  readonly trend: HTMLElement;
}): HomeProofExample {
  const app = createHomeApp([
    { resource: people, data: homeDataService(people, { people: PEOPLE }) },
    {
      resource: HEADCOUNT_RESOURCE,
      data: homeDataService(HEADCOUNT_RESOURCE, { 'workforce-headcount': HEADCOUNT_RECORDS }),
    },
  ]);
  mountRegion(app, targets.wide, 'home-proof-wide', 'people');
  mountRegion(app, targets.narrow, 'home-proof-narrow', 'people');
  mountRegion(app, targets.trend, 'home-proof-trend', 'workforce-headcount');
  let request = 0;

  const render = async (): Promise<void> => {
    const browse: Intent = {
      version: '1',
      id: `home-proof-browse-${++request}`,
      kind: 'browse',
      resource: 'people',
      fields: ['name', 'team', 'location'],
    };
    const analyze: Intent = {
      version: '1',
      id: `home-proof-analyze-${request}`,
      kind: 'analyze',
      resource: 'workforce-headcount',
      measures: [{ id: 'month-end-headcount', revision: '1' }],
      time: { field: 'month', grain: 'month', calendar: 'gregorian', timezone: 'UTC' },
      preferredView: 'trend',
      sort: [{ field: 'month', direction: 'asc' }],
    };
    const panes = [targets.wide, targets.narrow, targets.trend];
    const receipts = await Promise.all([
      app.render({ regionId: 'home-proof-wide', intent: browse }),
      app.render({ regionId: 'home-proof-narrow', intent: browse }),
      app.render({ regionId: 'home-proof-trend', intent: analyze }),
    ]);
    for (const [index, receipt] of receipts.entries()) {
      if (receipt.status !== 'renderer-ready')
        panes[index]!.textContent = 'This view could not be rendered in this browser.';
    }
  };

  return Object.freeze({
    render,
    dispose() {
      app.dispose();
    },
  });
}
