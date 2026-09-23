import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Intent } from '@aeliqo/core';
import { AdaptiveSurface, defineReactViews } from '../../../packages/react/src/surface/index.js';
import { createPeopleFixture, type PeopleSurfaceState } from '../../../tests/vnext/fixtures/people.js';
import {
  candidate,
  fixture as presentationFixture,
  listRef,
  manifest,
  registry,
  tableRef,
} from '../../../tests/vnext/fixtures/presentation.js';

const fixture = createPeopleFixture();
const surface = fixture.runtime.createSurface({
  scope: fixture.scope,
  id: 'region-1',
  feature: fixture.feature,
  bindings: fixture.bindings,
});
await surface.request({ kind: 'browse' });

const quality = (wide: boolean) => ({
  ok: true as const,
  value: { taskFit: wide ? 90 : 20, informationDensity: 0, interactionEffort: 0, legibilityPenalty: 0 },
});
const table = {
  ...manifest(tableRef),
  assess: (_config: unknown, _result: unknown, environment: { inlineSize: { state: string; value?: number } }) =>
    quality((environment.inlineSize.value ?? 0) >= 500),
};
const list = {
  ...manifest(listRef),
  assess: (_config: unknown, _result: unknown, environment: { inlineSize: { state: string; value?: number } }) =>
    quality((environment.inlineSize.value ?? 0) < 500),
};
const views = defineReactViews<Intent, PeopleSurfaceState>([
  { ...tableRef, render: () => <p data-testid="native-choice">wide table</p> },
  { ...listRef, render: () => <p data-testid="native-choice">narrow list</p> },
]);
const presentation = presentationFixture({
  registry: registry([table, list]),
  candidates: [candidate('table', tableRef), candidate('list', listRef)],
});

createRoot(document.getElementById('root')!).render(
  <AdaptiveSurface surface={surface} views={views} presentation={presentation} />,
);
document.getElementById('narrow')!.addEventListener('click', () => {
  document.getElementById('host')!.style.width = '360px';
});
