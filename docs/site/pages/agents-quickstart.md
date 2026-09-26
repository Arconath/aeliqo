---
id: 'agents-quickstart'
path: '/agents/quickstart/'
section: 'AI agents'
title: 'Agent quickstart'
description: 'Expose the three standard tools for one expiring Region session while the same app remains usable manually.'
---

<p class="lead">Start after your resource and Region already work without AI. The endpoint delegates render calls to the existing app; it does not create a second runtime.</p>

<h2>Try the scripted demo first</h2>

The [public playground](/playground/) ships a demo agent that needs no model,
key, or runner. It answers only the requests listed in its panel.

1. Open the playground and choose **Connect AI**.
2. Select **Demo agent (scripted)**, then choose **Check connection**.
   You should see “Demo agent · scripted, no model calls”.
3. Type one of the listed requests and choose **Send to demo agent**.
   You should see the demo run `aeliqo_context` then `aeliqo_render`
   through the real endpoint, and the view commit.
4. Type a request that is not listed.
   You should see a refusal: nothing is sent and nothing changes.

<h2>Create the endpoint</h2>

The <a href="/start/registered-app/">React tutorial</a> contains the complete
People app used here. Finish it first, then add this file next to the
tutorial's <code>src/app.ts</code>. Call
<code>createPeopleAgentSession(app)</code> only after the host has created the
app and mounted <code>people-main</code>. A model cannot supply the app, Region
ID, transport, or expiry.

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
<a href="/start/registered-app/">tutorial's <code>src/agent.ts</code></a>. Its
endpoint is a bounded tool session, not a model connection; connect a
host-controlled MCP transport separately. Keep <code>app</code> alive for the
session. Dispose it from the application owner after clients disconnect.

<h2>Pair trusted state</h2><p>You choose the Region, expiry, origin, and current authority in host code. These values are never model arguments. A new principal, scope, Region, or goal epoch needs a new pairing. By default, discovery exposes only the mounted resource. A host that routes multiple resources may provide <code>context: {read: () =&gt; app.runtime.contexts('people-main')}</code>. The runtime omits denied resources and rejects cross-principal or cross-scope discovery.</p>
<h2>Verify these cases</h2><div class="doc-checklist"><ul><li>Context reveals only permitted metadata.</li><li>A browse intent changes the real Region and returns runtime evidence.</li><li>Ambiguous language produces a visible choice instead of guessed execution.</li><li>A form request opens the form but does not perform a write.</li><li>A denied or stale action is rejected and leaves a recoverable UI.</li><li>Disconnect, expiry, cancellation, and disposal release pending calls.</li></ul></div>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/agents/mcp/"><span>MCP transport</span><small>Connect stdio or local HTTP.</small><b aria-hidden="true">→</b></a><a href="/agents/byok/"><span>BYOK model loop</span><small>Keep keys and egress policy in the host.</small><b aria-hidden="true">→</b></a></nav>
