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

For a small complete array already supplied by the application, the unreleased
0.5.0 candidate has a providerless path with no factory or explicit runtime:

```tsx
import { AdaptiveSurface, useDataSurface } from '@aeliqo/react/surface';

type Person = { id: string; name: string; team: string };

export function People({ rows }: { rows: readonly Person[] }) {
  const surface = useDataSurface({ data: rows, getRowId: row => row.id });
  return <AdaptiveSurface surface={surface} />;
}
```

The hook creates its local runtime and default browse request after React
commits. Server rendering exposes meaningful read-only rows before hydration;
the client then reads through the same runtime source/evaluator path. Rows
must have a bounded consistent scalar shape and one real unique identity field.
An initially empty array needs an explicit Zod schema and `identity` field;
without them, the component shows empty-data guidance. This local path never
grants remote access. Replace the data prop with a new array to refresh while
retaining the controller address; mutate-in-place callers must change the
`version` option to request a fresh snapshot. Unsupported or invalid updates retain the last
committed rows and show a diagnostic.

For an advanced host-controlled surface, `@aeliqo/react/surface` adapts a real,
application-owned `SurfaceController` into the existing React tree. It does not
create a React root, add a second data engine, or accept view implementations
from a wire payload. The host creates the surface at its runtime boundary and
registers trusted local React components explicitly.

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
global React context broadcast. Advanced `AdaptiveSurface` requires trusted
presentation evidence to make an automatic choice from registered native
views. A host selector is treated as a pin through shared eligibility checks;
plain registration does not qualify a view. An unknown explicit `ViewSurface`
ref renders an accessible diagnostic instead of silently switching views.

The advanced `useSurface` and factory overload of `useDataSurface` accept a
stable application-authored factory. The factory is called only in a committed
effect; that overload returns `undefined` while pending and disposes only its
own controller on cleanup. Construct the factory with `useMemo` or outside
rendering, and keep authority/scope binding at the host boundary. A providerless
local hook nested inside an application-owned scope fails visibly instead of
creating a parallel authority context.

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
