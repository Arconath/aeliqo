# `@aeliqo/react`

`@aeliqo/react` provides React 19 bindings over the shared web implementation.
It does not add another renderer, data layer, or authorization boundary.

The package requires React 19, `react-dom` 19, and the matching
`@aeliqo/runtime` package. The runtime peer provides the public app and region
state types used by the React app API; `@aeliqo/web` is installed as a package
dependency.

## Main entry point

```tsx
import { AeliqoProvider, AeliqoRegion, useAeliqoRender } from '@aeliqo/react';
import type { AeliqoApp } from '@aeliqo/web/app';

export function PeopleRegion({ app }: { app: AeliqoApp }) {
  return (
    <AeliqoProvider app={app}>
      <AeliqoRegion regionId="people-main" resourceId="people" />
    </AeliqoProvider>
  );
}
```

Create the `AeliqoApp` at the application boundary and pass that instance into
the provider. The provider exposes the app to its descendants; the host still
owns the app's data and authority adapters. Call
`registerAeliqoReactElements()` from the client entry point when the page uses
custom elements.

For an advanced, host-created runtime, pass `runtime` instead of `app`. The
provider accepts exactly one of those values and never disposes either one.

## Native React views and headless surfaces

`@aeliqo/react/surface` adapts a real, application-owned
`SurfaceController` into the existing React tree. It does not create a React
root, add a second data engine, or accept view implementations from a wire
payload. A host creates the surface through the runtime, keeps authority and
data bindings at its composition boundary, and registers trusted local React
components explicitly.

```tsx
import { AeliqoScope, ViewSurface, defineReactViews, useSurfaceState } from '@aeliqo/react/surface';
import type { SurfaceController } from '@aeliqo/runtime/surfaces';

const peopleViews = defineReactViews([
  {
    id: 'people.native-table',
    revision: '1',
    render: ({ snapshot }) => <p>{snapshot.phase}</p>,
  },
]);

export function PeopleNativeView({
  scope,
  surface,
}: {
  scope: import('@aeliqo/runtime/scopes').ScopeController;
  surface: SurfaceController<unknown, { readonly rows: readonly unknown[] }>;
}) {
  const rowCount = useSurfaceState(surface, snapshot => snapshot.state.rows.length);
  return (
    <AeliqoScope scope={scope}>
      <p>{rowCount} rows</p>
      <ViewSurface surface={surface} views={peopleViews} view={{ id: 'people.native-table', revision: '1' }} />
    </AeliqoScope>
  );
}
```

`AeliqoScope` attaches and detaches the supplied scope for committed React
lifecycle work, but never disposes it. `useSurfaceState` subscribes to one
controller with a selector, so unrelated controller updates do not rely on a
global React context broadcast. `AdaptiveSurface` selects only from the same
bounded registry (or a host selector); an unknown explicit `ViewSurface` ref
renders an accessible diagnostic instead of silently switching views.

Providerless `useDataSurface` and hook-owned `useSurface` allocation are not
implicit global allocation. Both accept a stable, application-authored
`factory` that returns a real controller. The factory is called only in a
committed effect; the hook returns `undefined` while it is pending, and it
disposes only that created controller on cleanup. This keeps interrupted render
and Strict Mode replay from registering a surface during render. Construct the
factory with `useMemo` (or outside rendering), retain authority/scope binding in
the host factory, and render a loading state until a controller is available.

## Component wrappers

React wrappers are available from family subpaths such as
`@aeliqo/react/foundation`, `@aeliqo/react/inputs`,
`@aeliqo/react/navigation`, `@aeliqo/react/feedback`,
`@aeliqo/react/data`, `@aeliqo/react/plot`,
`@aeliqo/react/visualization`, and `@aeliqo/react/compound`. SSR helpers are
available from `@aeliqo/react/ssr`.

## Lifecycle

Keep one app instance per application security context. Mount Regions under the
provider and let their React lifecycle release their subscriptions on unmount.
Dispose the app from the owner that created it. The root exports provider,
Region, and lifecycle hooks; component wrappers stay on family subpaths.
