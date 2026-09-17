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
