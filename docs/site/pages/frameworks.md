---
id: "frameworks"
path: "/start/frameworks/"
section: "Start"
title: "Framework setup"
description: "Use the same web implementation from Vanilla, React, Vue, and server-rendered hosts without creating a second renderer."
---

<h2>Vanilla</h2><p>Import <code>createAeliqoApp</code> from <code>@aeliqo/web/app</code>, mount against an <code>HTMLElement</code>, and dispose when the host removes the surface.</p>
<h2>React</h2>

**PeopleRegion.tsx**

```ts
import {AeliqoProvider, AeliqoRegion} from '@aeliqo/react/app';

export function PeopleRegion({app}) {
  return <AeliqoProvider app={app}>
    <AeliqoRegion regionId="people-main" resourceId="people" />
  </AeliqoProvider>;
}
```


<h2>Vue and other custom-element hosts</h2><p>Register the Aeliqo elements once, pass structured properties through element refs, and listen for native custom events. Framework-specific wrappers are unnecessary unless they improve typing or lifecycle ergonomics.</p>
<h2>SSR and hydration</h2><p>Import server-safe entry points during module evaluation. Browser registration belongs in a client boundary. Verify that hydration does not duplicate listeners, reset draft inputs, or share runtime authority between requests.</p>
<div class="doc-checklist"><ul><li>One runtime instance per application security context.</li><li>One mount/dispose pair per Region lifecycle.</li><li>No DOM access from server module evaluation.</li><li>No second compiler or renderer implemented in the framework wrapper.</li></ul></div>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/ship/ssr/"><span>SSR and hydration</span><small>Review request isolation, registration, and fallback behavior.</small><b aria-hidden="true">→</b></a><a href="/reference/app-api/"><span>App API</span><small>Read lifecycle signatures and outcomes.</small><b aria-hidden="true">→</b></a></nav>
