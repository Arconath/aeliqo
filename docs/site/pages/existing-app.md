---
id: 'existing-app'
path: '/start/existing-app/'
section: 'Get started'
title: 'Add Aeliqo to an existing application'
description: 'Adopt one Region at a time while keeping the existing backend, router, state, components, and authorization system.'
---

<p class="lead">Start at a boundary where the application already knows the current user and can provide a bounded data adapter. Do not migrate the whole UI at once.</p>
<h2>Integration sequence</h2><ol class="doc-steps"><li><span>1</span><div><h3>Choose one resource</h3><p>Pick a read-only collection or detail surface with stable identity and clear ownership.</p></div></li><li><span>2</span><div><h3>Project the data</h3><p>Map the existing API response into a typed resource shape. Keep credentials and server policy in the existing backend.</p></div></li><li><span>3</span><div><h3>Bridge authority</h3><p>Read the effective principal and grants from trusted application state for every evaluation and commit.</p></div></li><li><span>4</span><div><h3>Mount one Region</h3><p>Use a dedicated container and dispose it with the host view lifecycle.</p></div></li><li><span>5</span><div><h3>Add actions last</h3><p>Reuse the current business command path with preview, confirmation, revision, and idempotency policy.</p></div></li></ol>
<p>A minimal mount needs only the resource binding, the authority adapter, a container element, and one typed intent:</p>

**surface.ts**

```ts
import { createAeliqoApp } from '@aeliqo/web/app';

const app = createAeliqoApp({ resources, authority });
const mounted = app.mount({ target: container, regionId: 'people-main', resourceId: 'people' });
if (!mounted.ok) throw new Error(mounted.diagnostics[0].message);

await app.render({ regionId: 'people-main', intent });

// When the host screen tears down:
app.unmount('people-main');
app.dispose();
```

<aside class="doc-callout" data-tone="warning"><strong>Do not duplicate ownership</strong><p>If your router owns the URL, register a navigation adapter. If your form library owns a draft, keep it as the source of truth or move that entire bounded form into an Aeliqo recipe. Two competing owners create lost state.</p></aside>
<h2>Definition of success</h2><div class="doc-checklist"><ul><li>The existing non-Aeliqo path still works.</li><li>Back/forward navigation and unmount do not leak listeners or stale data.</li><li>The server remains the final authorization boundary.</li><li>Aeliqo can be removed from this surface without changing the domain API.</li></ul></div>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/guides/data/"><span>Data adapters</span><small>Map local and HTTP sources without pretending an arbitrary REST endpoint is universal.</small><b aria-hidden="true">→</b></a><a href="/start/frameworks/"><span>Framework setup</span><small>Choose Vanilla, React, Vue, or SSR integration.</small><b aria-hidden="true">→</b></a></nav>
