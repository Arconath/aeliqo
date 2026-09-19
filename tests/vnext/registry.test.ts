import { defineDataFeature, defineFeature } from '@aeliqo/core/features';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { createPeopleFixture, PersonSchema } from './fixtures/people.js';

it('fails duplicate surface IDs and advances generation after disposal', () => {
  const f = createPeopleFixture();
  const first = f.runtime.createSurface({ scope: f.scope, id: 'people', feature: f.feature, bindings: f.bindings });
  expect(() =>
    f.runtime.createSurface({ scope: f.scope, id: 'people', feature: f.feature, bindings: f.bindings }),
  ).toThrow(/already registered/u);
  const firstGeneration = first.address.surfaceGeneration;
  first.dispose();
  const second = f.runtime.createSurface({ scope: f.scope, id: 'people', feature: f.feature, bindings: f.bindings });
  expect(second.address.surfaceGeneration).toBe(firstGeneration + 1);
  f.dispose();
});

it('reference-counts identical feature registration and rejects an active incompatible revision', () => {
  const f = createPeopleFixture();
  const left = f.runtime.createSurface({ scope: f.scope, id: 'left', feature: f.feature, bindings: f.bindings });
  const right = f.runtime.createSurface({ scope: f.scope, id: 'right', feature: f.feature, bindings: f.bindings });
  const incompatible = defineDataFeature({
    id: 'people',
    revision: '2',
    schema: PersonSchema,
    identity: ['id'],
  });

  left.dispose();
  expect(() =>
    f.runtime.createSurface({ scope: f.scope, id: 'replacement', feature: incompatible, bindings: f.bindings }),
  ).toThrow(/incompatible revision/u);
  right.dispose();
  expect(() =>
    f.runtime.createSurface({ scope: f.scope, id: 'replacement', feature: incompatible, bindings: f.bindings }),
  ).not.toThrow();
  f.dispose();
});

it('unregisters and cancels a pending capability request on dispose', async () => {
  const f = createPeopleFixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const feature = defineFeature({
    id: 'report',
    capabilities: [{ ref: { id: 'report.read', revision: '1' }, kind: 'read', schema: z.object({}) }],
    intents: [
      {
        ref: { id: 'report.open', revision: '1' },
        schema: z.object({}),
        capabilities: [{ id: 'report.read', revision: '1' }],
      },
    ],
  });
  const surface = f.runtime.createSurface({
    scope: f.scope,
    id: 'report',
    feature,
    bindings: {
      initialState: { value: 'initial' },
      source: {
        kind: 'capability',
        read: async () => {
          await gate;
          return { value: 'late' };
        },
      },
    },
  });
  const pending = surface.request({ intent: { id: 'report.open', revision: '1' }, input: {} });
  await Promise.resolve();
  surface.dispose();
  const replacement = f.runtime.createSurface({
    scope: f.scope,
    id: 'report',
    feature,
    bindings: {
      initialState: { value: 'replacement' },
      source: { kind: 'capability', read: async () => ({ value: 'replacement-read' }) },
    },
  });
  const replacementBefore = replacement.getSnapshot();
  release();

  await expect(pending).resolves.toMatchObject({ status: 'cancelled' });
  expect(surface.getSnapshot().phase).toBe('disposed');
  expect(replacement.getSnapshot()).toBe(replacementBefore);
  expect(replacement.address.surfaceGeneration).toBe(surface.address.surfaceGeneration + 1);
  f.dispose();
});

it('refuses a capability result when permission changes across its async boundary', async () => {
  const f = createPeopleFixture();
  f.scope.setFeaturePermission('report', true);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const feature = defineFeature({
    id: 'report',
    capabilities: [{ ref: { id: 'report.read', revision: '1' }, kind: 'read', schema: z.object({}) }],
    intents: [
      {
        ref: { id: 'report.open', revision: '1' },
        schema: z.object({}),
        capabilities: [{ id: 'report.read', revision: '1' }],
      },
    ],
  });
  const surface = f.runtime.createSurface({
    scope: f.scope,
    id: 'permission-race',
    feature,
    bindings: {
      initialState: { value: 'authorized' },
      source: { kind: 'capability', read: async () => (await gate, { value: 'late' }) },
    },
  });
  const pending = surface.request({ intent: { id: 'report.open', revision: '1' }, input: {} });
  await Promise.resolve();
  f.scope.setFeaturePermission('report', false);
  release();
  await expect(pending).resolves.toMatchObject({ status: 'denied' });
  expect(surface.getSnapshot()).toMatchObject({ phase: 'denied', state: undefined });
  f.dispose();
});

it('keeps the latest revision when an older capability read resolves late', async () => {
  const f = createPeopleFixture();
  f.scope.setFeaturePermission('report', true);
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const feature = defineFeature({
    id: 'report',
    capabilities: [{ ref: { id: 'report.read', revision: '1' }, kind: 'read', schema: z.object({}) }],
    intents: [
      {
        ref: { id: 'report.open', revision: '1' },
        schema: z.object({ value: z.string() }),
        capabilities: [{ id: 'report.read', revision: '1' }],
      },
    ],
  });
  const surface = f.runtime.createSurface({
    scope: f.scope,
    id: 'revision-race',
    feature,
    bindings: {
      initialState: { value: 'initial' },
      source: {
        kind: 'capability',
        read: async (intent) => {
          if (intent.input.value === 'first') await firstGate;
          return { value: intent.input.value };
        },
      },
    },
  });
  const first = surface.request({ intent: { id: 'report.open', revision: '1' }, input: { value: 'first' } });
  await Promise.resolve();
  await expect(
    surface.request({ intent: { id: 'report.open', revision: '1' }, input: { value: 'second' } }),
  ).resolves.toMatchObject({ status: 'committed' });
  const latest = surface.getSnapshot();
  releaseFirst();

  await expect(first).resolves.toMatchObject({ status: 'cancelled' });
  expect(surface.getSnapshot()).toBe(latest);
  expect(latest.state).toEqual({ value: 'second' });
  f.dispose();
});
