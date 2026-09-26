---
id: 'adaptive-region'
path: '/guides/adaptive-region/'
section: 'Guides'
title: 'Adaptive Region lifecycle'
description: 'Mount once, render typed intent, observe sanitized state, and dispose all work with the host surface.'
---

<p class="lead">A Region is the unit of evaluation, presentation, supersession, and cleanup. Newer requests replace older requests only within the same Region.</p>
<h2>Lifecycle API</h2>

**region.ts**

```ts
const mounted = app.mount({ target, regionId: 'main', resourceId: 'people' });
if (!mounted.ok) throw new Error(mounted.diagnostics[0].message);

const unsubscribe = app.subscribe('main', (state) => renderStatus(state.phase));
const receipt = await app.render({ regionId: 'main', intent });

unsubscribe();
app.unmount('main');
app.dispose();
```

<h2>Receipt meaning</h2><div class="doc-table"><table><thead><tr><th>Status</th><th>Meaning</th></tr></thead><tbody><tr><th><code>renderer-ready</code></th><td>Runtime evidence committed and the renderer accepted the validated presentation; it is not proof of browser paint or user attention.</td></tr><tr><th><code>needs-input</code></th><td>The request is valid but needs a user choice or form input.</td></tr><tr><th><code>denied</code></th><td>Current trusted authority rejected the operation.</td></tr><tr><th><code>cancelled</code></th><td>A newer render, abort signal, unmount, or disposal superseded the request.</td></tr><tr><th><code>unsupported</code></th><td>No valid registered contract can perform the request.</td></tr><tr><th><code>failed</code></th><td>A bounded internal or adapter failure occurred; inspect diagnostics and recovery.</td></tr></tbody></table></div>
<h2>Failure invariant</h2><p>An invalid presentation preserves the previous view while it remains authorized. Revocation is different: data that may no longer be displayed is cleared. Focused or dirty draft controls defer a resize replacement, and the newest measurement is applied after the guard ends.</p>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/reference/app-api/"><span>App API reference</span><small>Review exact methods, ownership, and lifecycle.</small><b aria-hidden="true">→</b></a><a href="/concepts/safety/"><span>Commit safety</span><small>See revision and read-set validation.</small><b aria-hidden="true">→</b></a></nav>
