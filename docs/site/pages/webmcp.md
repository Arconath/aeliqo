---
id: 'webmcp'
path: '/agents/webmcp/'
section: 'Connect agents'
title: 'WebMCP (experimental)'
description: 'Detect native browser support and register bounded tools only when the current browser exposes the required capability.'
---

<p class="lead">WebMCP availability depends on browser implementation and release channel. Aeliqo reports <em>available</em>, <em>unavailable</em>, or <em>connected</em>; it does not display a mock connection as real.</p>
<h2>Progressive enhancement</h2>

**capability.ts**

```ts
import { detectWebMcp, registerWebMcpTools } from '@aeliqo/agent/webmcp';

const hostDocument = typeof document === 'undefined' ? undefined : document;
const capability =
  hostDocument === undefined ? detectWebMcp() : detectWebMcp({ document: hostDocument, evidence: 'native' });
if (capability.supported) {
  const registration = await registerWebMcpTools({ endpoint, document: hostDocument, evidence: 'native' });
  // Retain registration.value.adapter and close it with the session.
} else {
  showManualControls();
}
```

<h2>Required fallback</h2><p>The same resource must remain fully usable through buttons, filters, forms, and routes. Native registration is an optional communication surface, not a dependency for rendering or authorization.</p>
<aside class="doc-callout" data-tone="warning"><strong>Experimental status</strong><p>Simulated protocol tests and native browser availability are recorded separately. Do not describe simulation as native support or readiness.</p></aside>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/agents/"><span>Agent overview</span><small>Compare MCP, BYOK, and WebMCP.</small><b aria-hidden="true">→</b></a><a href="/guides/adaptive-region/"><span>Manual Region path</span><small>Keep the full interface functional without an agent.</small><b aria-hidden="true">→</b></a></nav>
