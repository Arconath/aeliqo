---
id: 'agents-quickstart'
path: '/agents/quickstart/'
section: 'AI agents'
title: 'Agent quickstart'
description: 'Expose the three standard tools for one expiring Region session while the same app remains usable manually.'
---

<p class="lead">Start after the resource and Region work without AI. The endpoint delegates render calls to the existing app; it does not create a second runtime. The <a href="/start/registered-app/">React tutorial</a> contains the complete People app used here.</p>
<h2>Create the endpoint</h2>

Create this file alongside the tutorial's <code>src/app.ts</code>. The host calls
<code>createPeopleAgentSession(app)</code> only after it has created the app and
mounted <code>people-main</code>. A model cannot supply the app, Region ID,
transport, or expiry.

**agent.ts**

```ts
import { createAppToolEndpoint } from '@aeliqo/agent/app';
import type { createTutorialApp } from './app.js';

type TutorialApp = ReturnType<typeof createTutorialApp>;

export function createPeopleAgentSession(app: TutorialApp) {
  const endpoint = createAppToolEndpoint({
    runtime: app.runtime,
    render: app,
    regionId: 'people-main',
    goalEpoch: crypto.randomUUID(),
    transport: 'mcp',
    expiresAt: Date.now() + 15 * 60_000,
    maxPending: 2,
    maxMilliseconds: 15_000,
    maxInputBytes: 32_000,
    maxOutputBytes: 64_000,
  });
  if (!endpoint.ok) throw new Error(endpoint.diagnostics[0].message);
  return endpoint.value;
}
```

The code matches the maintained
<a href="/start/registered-app/">tutorial's <code>src/agent.ts</code></a>. Its endpoint is a
bounded tool session, not a model connection; connect a host-controlled MCP
transport separately. Keep <code>app</code> alive for the session and dispose
it from the application owner after disconnecting clients.

<h2>Pair trusted state</h2><p>The host chooses the Region, expiry, origin, and current authority. These values are not model arguments. New principal, scope, Region, or goal epochs require a new pairing. By default, discovery exposes only the mounted resource. A host that can route multiple resources may provide <code>context: {read: () =&gt; app.runtime.contexts('people-main')}</code>; the runtime omits denied resources and rejects cross-principal or cross-scope discovery.</p>
<h2>Verify these cases</h2><div class="doc-checklist"><ul><li>Context reveals only permitted metadata.</li><li>A browse intent changes the real Region and returns runtime evidence.</li><li>Ambiguous language produces a visible choice instead of guessed execution.</li><li>A form request opens the form but does not perform a write.</li><li>A denied or stale action is rejected and leaves a recoverable UI.</li><li>Disconnect, expiry, cancellation, and disposal release pending calls.</li></ul></div>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/agents/mcp/"><span>MCP transport</span><small>Connect stdio or local HTTP.</small><b aria-hidden="true">→</b></a><a href="/agents/byok/"><span>BYOK model loop</span><small>Keep keys and egress policy in the host.</small><b aria-hidden="true">→</b></a></nav>
