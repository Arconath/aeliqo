import React, { createContext, useContext } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import {
  AdaptiveSurface,
  AeliqoScope,
  ViewSurface,
  defineReactViews,
  useDataSurface,
  useSurface,
  type ReactViewProps,
} from '../../packages/react/src/surface/index.js';
import { AeliqoProvider, useAeliqoRuntime } from '../../packages/react/src/index.js';
import { createPeopleFixture, type PeopleSurfaceState } from './fixtures/people.js';
import { createScopeFixture } from './fixtures/scope.js';
import type { Intent } from '@aeliqo/core';

const HostContext = createContext('missing-host-context');

function PeopleNativeView({ snapshot }: ReactViewProps<Intent, PeopleSurfaceState>): React.JSX.Element {
  const hostValue = useContext(HostContext);
  return (
    <section data-host-context={hostValue}>
      {snapshot.state.rows.map((person) => (
        <label key={person.id}>
          {person.team}
          <input aria-label={person.id} value={person.name} readOnly />
        </label>
      ))}
    </section>
  );
}

it('renders a registered native React view from a real headless surface snapshot', async () => {
  const fixture = createPeopleFixture();
  const surface = fixture.runtime.createSurface({
    scope: fixture.scope,
    id: 'react-native-people',
    feature: fixture.feature,
    bindings: fixture.bindings,
  });
  const request = await surface.request({ kind: 'browse' });
  expect(request).toEqual({ status: 'committed', revision: '1' });
  const views = defineReactViews<Intent, PeopleSurfaceState>([
    { id: 'people.native', revision: '1', render: PeopleNativeView },
  ]);

  const html = renderToStaticMarkup(
    <HostContext.Provider value="existing-host">
      <ViewSurface surface={surface} views={views} view={{ id: 'people.native', revision: '1' }} />
    </HostContext.Provider>,
  );

  expect(html).toContain('data-host-context="existing-host"');
  expect(html).toContain('aria-label="ada"');
  expect(html).toContain('value="Ada Chen"');
  expect(html).toContain('aria-label="sam"');
  fixture.dispose();
});

it('selects only a host-registered native view and reports an unknown view explicitly', async () => {
  const fixture = createPeopleFixture();
  const surface = fixture.runtime.createSurface({
    scope: fixture.scope,
    id: 'react-adaptive-people',
    feature: fixture.feature,
    bindings: fixture.bindings,
  });
  await surface.request({ kind: 'browse' });
  const views = defineReactViews<Intent, PeopleSurfaceState>([
    { id: 'people.native', revision: '1', render: PeopleNativeView },
  ]);

  const adaptive = renderToStaticMarkup(
    <AdaptiveSurface
      surface={surface}
      views={views}
      selectView={(snapshot, available) => {
        expect(snapshot).toBe(surface.getSnapshot());
        expect(available).toHaveLength(1);
        return available[0]?.ref;
      }}
    />,
  );
  const missing = renderToStaticMarkup(
    <ViewSurface surface={surface} views={views} view={{ id: 'unknown.native', revision: '1' }} />,
  );

  expect(adaptive).toContain('Ada Chen');
  expect(missing).toContain('requested native React view is not registered');
  expect(() =>
    defineReactViews([
      { id: 'people.native', revision: '1', render: PeopleNativeView },
      { id: 'people.native', revision: '1', render: PeopleNativeView },
    ]),
  ).toThrow('already registered');
  fixture.dispose();
});

it('keeps an injected scope inert during server rendering and never disposes it', async () => {
  const fixture = await createScopeFixture();
  expect(fixture.scope.getSnapshot()).toMatchObject({ status: 'idle', active: false });

  const html = renderToStaticMarkup(
    <AeliqoScope scope={fixture.scope}>
      <span>host child</span>
    </AeliqoScope>,
  );

  expect(html).toBe('<span>host child</span>');
  expect(fixture.scope.getSnapshot()).toMatchObject({ status: 'idle', active: false });
  await fixture.dispose();
});

it('exposes an injected runtime without taking ownership of it', () => {
  const fixture = createPeopleFixture();
  function RuntimeProbe(): React.JSX.Element {
    const runtime = useAeliqoRuntime();
    return <p>{runtime === fixture.runtime ? 'same-runtime' : 'wrong-runtime'}</p>;
  }

  expect(
    renderToStaticMarkup(
      <AeliqoProvider runtime={fixture.runtime}>
        <RuntimeProbe />
      </AeliqoProvider>,
    ),
  ).toBe('<p>same-runtime</p>');
  expect(fixture.runtime.snapshot('missing-region')).toBeUndefined();
  fixture.dispose();
});

it('defers injected controller creation and initial data requests until committed lifecycle', () => {
  const fixture = createPeopleFixture();
  let creations = 0;
  const factory = {
    create: () => {
      creations += 1;
      return fixture.runtime.createSurface({
        scope: fixture.scope,
        id: 'react-effect-owned-people',
        feature: fixture.feature,
        bindings: fixture.bindings,
      });
    },
  };
  const dataFactory = {
    create: () => {
      creations += 1;
      return fixture.runtime.createSurface({
        scope: fixture.scope,
        id: 'react-effect-owned-data',
        feature: fixture.feature,
        bindings: fixture.bindings,
      });
    },
  };

  function SurfaceProbe(): React.JSX.Element {
    const surface = useSurface({ factory, initialRequest: { kind: 'browse' } });
    return <p>{surface === undefined ? 'pending' : 'ready'}</p>;
  }

  function DataSurfaceProbe(): React.JSX.Element {
    const surface = useDataSurface({ factory: dataFactory, initialRequest: { kind: 'browse' } });
    return <p>{surface === undefined ? 'pending-data' : 'ready-data'}</p>;
  }

  expect(
    renderToStaticMarkup(
      <>
        <SurfaceProbe />
        <DataSurfaceProbe />
      </>,
    ),
  ).toBe('<p>pending</p><p>pending-data</p>');
  expect(creations).toBe(0);
  expect(fixture.source.sourceRevision).toBe('people-source-1');
  fixture.dispose();
});
