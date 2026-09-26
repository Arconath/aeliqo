---
id: "frameworks"
path: "/start/frameworks/"
section: "Get started"
title: "Framework setup"
description: "Use the same web implementation from Vanilla, React, Vue, and server-rendered hosts without creating a second renderer."
---

## Vanilla

Create one application instance for one security context, mount each Region
once, render typed intents, and release both the Region and application when
the host removes the surface.

```ts
import { createAeliqoApp } from '@aeliqo/web/app';

const app = createAeliqoApp({ resources, authority });
const mounted = app.mount({ target, regionId: 'people-main', resourceId: 'people' });
if (!mounted.ok) throw new Error(mounted.diagnostics[0].message);

await app.render({ regionId: 'people-main', intent, signal });
app.unmount('people-main');
app.dispose();
```

Use `unmount` when one Region leaves while the application continues. Use
`dispose` once for the whole application; it cancels owned work and releases
all remaining Regions.

## React

Create the app outside render or behind a stable memoized factory. The Provider
shares that application-owned instance and deliberately does not dispose it.
`AeliqoRegion` mounts and unmounts its Region, aborts an outdated render when
the `intent` prop changes, and reports the trusted receipt through `onReceipt`.

**PeopleRegion.tsx**

```tsx
import { AeliqoProvider, AeliqoRegion } from '@aeliqo/react/app';

export function PeopleRegion({ app, intent }) {
  return (
    <AeliqoProvider app={app}>
      <AeliqoRegion
        regionId="people-main"
        resourceId={intent.resource}
        intent={intent}
        onReceipt={(receipt) => {
          if (receipt.status !== 'renderer-ready') report(receipt.diagnostics);
        }}
      />
    </AeliqoProvider>
  );
}
```

When an intent switches to another resource, use a stable key such as
`key={intent.resource}` so React closes the old Region before mounting the new
resource. Dispose the app from the owner that created it, such as the route or
application shell cleanup.

## Vue and other custom element hosts

Call `registerAeliqoElements()` once in the client entry. Set arrays, objects,
and functions as DOM properties through a template ref rather than serializing
them into attributes. Subscribe to native custom events on mount and remove the
same listeners on unmount. Keep the app instance and authority in the host; a
framework wrapper should not create another compiler or renderer.

## SSR and hydration

Use server-safe entry points during module evaluation. Do not register custom
elements, read `document`, or share principal, ResultStore, Region, or action
confirmation state between requests. Load Lit hydration support before the
client imports `@aeliqo/web/app`, then register elements inside the client
boundary. Keep the server and browser packages on the same exact version.

Hydration acceptance checks should prove that declarative shadow roots are
reused, event listeners are not duplicated, dirty inputs keep their values,
focus order remains correct, and a readable fallback remains when JavaScript
does not run.

<div class="doc-checklist"><ul><li>One runtime instance per application security context.</li><li>One mount/dispose pair per Region lifecycle.</li><li>No DOM access from server module evaluation.</li><li>No second compiler or renderer implemented in the framework wrapper.</li></ul></div>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/ship/ssr/"><span>SSR and hydration</span><small>Review request isolation, registration, and fallback behavior.</small><b aria-hidden="true">→</b></a><a href="/reference/app-api/"><span>App API</span><small>Read lifecycle signatures and outcomes.</small><b aria-hidden="true">→</b></a></nav>
