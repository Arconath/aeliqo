---
id: 'existing-app'
path: '/start/existing-app/'
section: 'Get started'
title: 'Add Aeliqo to an existing application'
description: 'Adopt one Region at a time while keeping the existing backend, router, state, components, and authorization system.'
---

<p class="lead">Start where your app already knows the signed-in user and can return bounded data. Keep your backend, router, and design system. Do not migrate the whole UI at once.</p>
<h2>Adopt it in five steps</h2><ol class="doc-steps"><li><span>1</span><div><h3>Pick one resource</h3><p>Choose a read-only list or detail screen with stable IDs and a clear owner.</p></div></li><li><span>2</span><div><h3>Map the data</h3><p>Shape your existing API response into a typed resource. Credentials and server policy stay in your backend.</p></div></li><li><span>3</span><div><h3>Bridge permissions</h3><p>Read the signed-in user and their grants from trusted app state on every evaluation.</p></div></li><li><span>4</span><div><h3>Mount one region</h3><p>Give the adaptive region (a mounted view slot) its own container. Dispose of it with the host screen.</p></div></li><li><span>5</span><div><h3>Add actions last</h3><p>Reuse your existing command path with preview, confirmation, and revision checks.</p></div></li></ol>
<p>A minimal mount needs four things: a resource binding, a permission adapter, a container, and one typed request:</p>

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

<aside class="doc-callout" data-tone="warning"><strong>Keep one owner per concern</strong><p>Your router owns the URL? Register a navigation adapter. Your form library owns a draft? Keep it, or move that whole form into a registered view. Two owners for one thing loses state.</p></aside>
<h2>Know it worked</h2><div class="doc-checklist"><ul><li>The old non-Aeliqo path still works.</li><li>Back/forward navigation and unmount leak no listeners or stale data.</li><li>Your server remains the final permission check.</li><li>You can remove Aeliqo from this screen without changing your domain API.</li></ul></div>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/guides/data/"><span>Data adapters</span><small>Map local and HTTP sources into bounded services.</small><b aria-hidden="true">→</b></a><a href="/start/frameworks/"><span>Framework setup</span><small>Choose Vanilla, React, Vue, or SSR integration.</small><b aria-hidden="true">→</b></a></nav>
