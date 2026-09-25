---
id: 'ssr'
path: '/ship/ssr/'
section: 'Ship'
title: 'SSR and hydration'
description: 'Render server-safe output without DOM access at module evaluation or cross-request runtime state.'
---

<h2>Server boundary</h2><p>Use <code>@aeliqo/web/server</code> for server rendering and keep browser registration inside a client entry. Serialize initial data as separately escaped JSON, not interpolated HTML.</p>
<p>Render authorized content for the current request before sending HTML. A
placeholder that becomes useful only after a client effect is a client-rendered
surface, not meaningful SSR. The server may render Aeliqo custom elements
through <code>renderAeliqo</code>; a React local data surface also renders
read-only rows on the server when supplied valid initial data.</p>

**server-entry.ts**

```ts
import { html } from 'lit';
import { renderAeliqo } from '@aeliqo/web/server';

// Render a trusted host-authored element tree for this request's data.
const markup = await renderAeliqo(html`<aeliqo-text-field label="Name"></aeliqo-text-field>`);
```

`renderAeliqo` accepts a host-authored Lit `TemplateResult` and returns the
HTML string. Install `lit` alongside the matching Aeliqo packages; keep this
import in a server-only module.

<h2>Run the maintained fixture</h2>
<p>From the repository root, run <code>pnpm test:next-platform</code>. The
Next.js fixture in <code>examples/next-platform</code> renders a text field and
an adaptive People surface, then checks initial DOM and hydration in a real
browser. For the separate request-scoped table fixture, inspect
<code>examples/vnext/src/ssr.ts</code>: it builds the authorized rows per
request, renders a populated table, and escapes the public JSON snapshot before
placing it in an inline script. Both fixtures use synthetic records. The host
must authenticate each real request and apply its own cache policy.</p>
<h2>Request isolation</h2><div class="doc-checklist"><ul><li>Create authority and runtime state per request or explicit application security context.</li><li>Never store principal, ResultStore, Region, or action confirmation in a process-wide singleton.</li><li>Abort downstream source work when the request ends.</li><li>Do not import provider SDKs or browser-only registration into the server-rendered component path.</li></ul></div>
<h2>Hydration order</h2><p>Load <code>@lit-labs/ssr-client/lit-element-hydrate-support.js</code> before dynamically importing <code>@aeliqo/web/app</code> or registering Aeliqo elements. Loading a Lit element class first can cause the declarative shadow tree to be replaced instead of hydrated.</p>

**client-entry.ts**

```ts
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';

const { createAeliqoApp } = await import('@aeliqo/web/app');
// Now create the app, register elements, and mount Regions.
```

<h2>Hydration checks</h2><div class="doc-checklist"><ul><li>With JavaScript disabled, the HTML contains the authorized label, rows, or values that the page promises.</li><li>Declarative shadow roots hydrate without duplicate nodes or listeners.</li><li>Existing input and dirty draft values are not reset.</li><li>Focus order and form association remain correct.</li><li>Initial browser data is reauthorized before reuse; do not serialize credentials, private rows, or executable values.</li><li>A no-JavaScript or failed-hydration fallback stays readable and honest.</li><li>Server and browser packages use the same exact version.</li></ul></div>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/start/frameworks/"><span>Framework setup</span><small>Integrate React, Vue, Vanilla, or custom-element hosts.</small><b aria-hidden="true">→</b></a><a href="/reference/packages/"><span>Entry points</span><small>Keep browser and server dependencies separated.</small><b aria-hidden="true">→</b></a></nav>
