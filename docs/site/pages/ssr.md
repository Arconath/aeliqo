---
id: "ssr"
path: "/ship/ssr/"
section: "Ship"
title: "SSR and hydration"
description: "Render server-safe output without DOM access at module evaluation or cross-request runtime state."
---

<h2>Server boundary</h2><p>Use <code>@aeliqo/web/server</code> for server rendering and keep browser registration inside a client entry. Serialize initial data as separately escaped JSON, not interpolated HTML.</p>
<h2>Request isolation</h2><div class="doc-checklist"><ul><li>Create authority and runtime state per request or explicit application security context.</li><li>Never store principal, ResultStore, Region, or action confirmation in a process-wide singleton.</li><li>Abort downstream source work when the request ends.</li><li>Do not import provider SDKs or browser-only registration into the server-rendered component path.</li></ul></div>
<h2>Hydration order</h2><p>Load <code>@lit-labs/ssr-client/lit-element-hydrate-support.js</code> before dynamically importing <code>@aeliqo/web/app</code> or registering Aeliqo elements. Loading a Lit element class first can cause the declarative shadow tree to be replaced instead of hydrated.</p>
<h2>Hydration checks</h2><div class="doc-checklist"><ul><li>Declarative shadow roots hydrate without duplicate nodes or listeners.</li><li>Existing input and dirty draft values are not reset.</li><li>Focus order and form association remain correct.</li><li>A no-JavaScript or failed-hydration fallback stays readable and honest.</li><li>Server and browser packages use the same exact version.</li></ul></div>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/start/frameworks/"><span>Framework setup</span><small>Integrate React, Vue, Vanilla, or custom-element hosts.</small><b aria-hidden="true">→</b></a><a href="/reference/packages/"><span>Entry points</span><small>Keep browser and server dependencies separated.</small><b aria-hidden="true">→</b></a></nav>
