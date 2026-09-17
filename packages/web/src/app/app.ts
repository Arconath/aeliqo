import type { VersionRef } from '@aeliqo/core';
import { createAeliqoRuntime } from '@aeliqo/runtime/app';
import { STANDARD_RECIPES } from '../recipes/standard.js';
import type { AeliqoApp, AeliqoAppOptions } from './types.js';
import { createInteractionHandler } from './interaction.js';
import { createMountHandler } from './mount.js';
import { disposeApp, subscribeRegion, unmountRegion } from './lifecycle.js';
import { adaptRegion, renderRequest } from './render.js';
import type { WebAppContext } from './context.js';

function assertUniqueRegistrations(values: readonly { readonly ref: VersionRef }[], kind: 'Recipe' | 'View'): void {
  const keys = values.map((value) => JSON.stringify([value.ref.id, value.ref.revision]));
  if (new Set(keys).size !== values.length) throw new TypeError(kind + ' registrations must be unique.');
}

function createContext(options: AeliqoAppOptions): WebAppContext {
  const runtime = createAeliqoRuntime(options);
  const recipes = Object.freeze([...(options.recipes ?? STANDARD_RECIPES)]);
  const views = Object.freeze([...(options.views ?? [])]);
  if (recipes.length === 0) throw new TypeError('createAeliqoApp requires at least one recipe.');
  assertUniqueRegistrations(recipes, 'Recipe');
  assertUniqueRegistrations(views, 'View');
  return {
    options,
    runtime,
    resources: new Map(options.resources.map((binding) => [binding.resource.id, binding.resource])),
    recipes,
    views,
    regions: new Map(),
    stateListeners: new Map(),
    disposed: false,
  };
}

export function createAeliqoApp(options: AeliqoAppOptions): AeliqoApp {
  const context = createContext(options);
  const handleInteraction = createInteractionHandler(context);
  const adapt = (region: Parameters<typeof adaptRegion>[1]) => adaptRegion(context, region);
  const mount = createMountHandler(context, handleInteraction, adapt);
  return Object.freeze({
    runtime: context.runtime,
    mount,
    render: (input) => renderRequest(context, input),
    snapshot: (regionId) => context.runtime.snapshot(regionId),
    subscribe: (regionId, listener) => subscribeRegion(context, regionId, listener),
    unmount: (regionId) => unmountRegion(context, regionId),
    dispose: () => disposeApp(context),
  } satisfies AeliqoApp);
}
