import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Intent } from '@aeliqo/core';
import {
  createPresentationRegistry,
  type PresentationManifest,
  type PresentationResolverInput,
} from '@aeliqo/core/presentation';
import { AdaptiveSurface, defineReactViews } from '../../../packages/react/src/surface/index.js';
import { createPeopleFixture, type PeopleSurfaceState } from '../../../tests/vnext/fixtures/people.js';
import { reactPresentationFixture, listRef, tableRef } from '../../../tests/vnext/fixtures/react-presentation.js';

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
const inlineSize = (environment: { inlineSize: { state: 'unknown' } | { state: 'known'; value: number } }) =>
  environment.inlineSize.state === 'known' ? environment.inlineSize.value : 0;
const base = reactPresentationFixture();
const tableBase = base.registry.manifests.find((manifest) => manifest.ref.id === tableRef.id);
const listBase = base.registry.manifests.find((manifest) => manifest.ref.id === listRef.id);
if (tableBase === undefined || listBase === undefined) throw new Error('Native fixture manifests are missing.');
const table: PresentationManifest = {
  ...tableBase,
  assess: (_config, _result, environment) => quality(inlineSize(environment) >= 500),
};
const list: PresentationManifest = {
  ...listBase,
  assess: (_config, _result, environment) => quality(inlineSize(environment) < 500),
};
const installed = createPresentationRegistry([table, list]);
if (!installed.ok) throw new Error(installed.diagnostics[0].message);
const views = defineReactViews<Intent, PeopleSurfaceState>([
  { ...tableRef, render: () => <p data-testid="native-choice">wide table</p> },
  { ...listRef, render: () => <p data-testid="native-choice">narrow list</p> },
]);
const evidence = surface.presentationEvidence?.();
if (evidence === undefined) throw new Error('The native fixture needs a committed runtime evaluation.');
const presentation: PresentationResolverInput = {
  ...base,
  registry: installed.value,
  preconditions: evidence.current,
  context: {
    ...base.context,
    task: evidence.task,
    experience: { ...base.context.experience, revision: evidence.current.experienceRevision },
    results: evidence.results,
    current: evidence.current,
  },
  target: evidence.target,
  candidates: base.candidates.map((candidate) => ({
    ...candidate,
    plan: {
      ...candidate.plan,
      preconditions: evidence.current,
      nodes: candidate.plan.nodes.map((node) => ({ ...node, result: evidence.results[0]!.ref })),
      coverage: evidence.task.needs.map((need) => ({
        needId: need.id,
        nodeIds: [candidate.plan.rootId] as const,
        operations: [need.operation] as const,
      })),
    },
  })),
};

createRoot(document.getElementById('root')!).render(
  <AdaptiveSurface surface={surface} views={views} presentation={presentation} />,
);
document.getElementById('narrow')!.addEventListener('click', () => {
  document.getElementById('host')!.style.width = '360px';
});
