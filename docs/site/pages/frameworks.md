---
id: "frameworks"
path: "/start/frameworks/"
section: "Get started"
title: "Framework setup"
description: "Use the same web implementation from Vanilla, React, Vue, and server-rendered hosts without creating a second renderer."
---

<p class="lead">Every framework uses the same web implementation. You never write a second renderer — you wire lifecycle and trusted state.</p>

## Use it in plain TypeScript

Create one app per security context. Mount each region once. Dispose of both when the host removes the surface.

```ts
import { createAeliqoApp } from '@aeliqo/web/app';

const app = createAeliqoApp({ resources, authority });
const mounted = app.mount({ target, regionId: 'people-main', resourceId: 'people' });
if (!mounted.ok) throw new Error(mounted.diagnostics[0].message);

await app.render({ regionId: 'people-main', intent, signal });
app.unmount('people-main');
app.dispose();
```

Call `unmount` when one region leaves while the app lives on. Call `dispose` once for the whole app — it cancels work and releases every region.

## Use it in React

Create the app outside render, or behind a stable memoized factory. `AeliqoProvider` shares that instance and does not dispose it. `AeliqoRegion` mounts and unmounts its region, aborts a stale render when `intent` changes, and reports each result through `onReceipt`.

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

When a request switches resources, set `key={intent.resource}` so React closes the old region before opening the new one. Dispose the app from whoever created it — route cleanup or app shell.

## Use it in Vue or another custom-element host

Call `registerAeliqoElements()` once in your client entry:

```ts
import { registerAeliqoElements } from '@aeliqo/web/register';
```

Pass arrays, objects, and functions as DOM properties through a template ref — not serialized attributes. Add native event listeners on mount and remove them on unmount. Keep the app instance and permissions in the host; a wrapper must not create a second compiler or renderer.

## Render on the server

Use the server-safe entry points while modules evaluate. Do not register elements, touch `document`, or share the signed-in user, results, regions, or action state between requests. Load Lit hydration support before the client imports `@aeliqo/web/app`. Keep server and browser packages on the same exact version.

Hydration is correct when shadow roots are reused and listeners stay single. Dirty inputs keep their values and focus order holds. A readable fallback remains without JavaScript.

<div class="doc-checklist"><ul><li>One app instance per security context.</li><li>One mount/dispose pair per region.</li><li>No DOM access during server module evaluation.</li><li>No second compiler or renderer inside a framework wrapper.</li></ul></div>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/ship/ssr/"><span>SSR and hydration</span><small>Review request isolation, registration, and fallback behavior.</small><b aria-hidden="true">→</b></a><a href="/reference/app-api/"><span>App API</span><small>Read lifecycle signatures and outcomes.</small><b aria-hidden="true">→</b></a></nav>
