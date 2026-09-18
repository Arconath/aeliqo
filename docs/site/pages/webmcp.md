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
<h2>Read the evidence correctly</h2>

| Evidence | What it proves | What it does not prove |
| --- | --- | --- |
| Native | A real supported browser registered, discovered, executed, cancelled, unregistered, and rejected a late Aeliqo tool in an isolated profile | Support in every browser channel or enterprise policy |
| Simulated | The adapter maps discovery, annotations, cancellation, receipts, and lifecycle to an injected test host | Browser implementation availability |
| Unavailable | The current document exposes no supported `modelContext` host | A failure in buttons, forms, MCP, or BYOK |

The opt-in native probe is `pnpm test:protocol-webmcp:native`. It opens an
isolated headed Chrome profile and runs once with the default browser state and
once with Chrome's local WebMCP testing flag. The normal automated suite uses
`pnpm test:protocol-webmcp:simulated` and never reports that result as native.

Chrome's [imperative API guidance](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
defines tool registration, discovery, execution cancellation, and disposal.
As of Chrome 153, unregistering a tool does not cancel work already in flight,
so Aeliqo also checks the endpoint lifecycle after execution and rejects late
results. Cross-origin tools additionally require the browser `tools`
Permissions Policy and explicit origin exposure.
<aside class="doc-callout" data-tone="warning"><strong>Experimental status</strong><p>WebMCP is still experimental and its browser API can change. Keep native, simulated, and unavailable evidence separate in test reports and product copy.</p></aside>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/agents/"><span>Agent overview</span><small>Compare MCP, BYOK, and WebMCP.</small><b aria-hidden="true">→</b></a><a href="/guides/adaptive-region/"><span>Manual Region path</span><small>Keep the full interface functional without an agent.</small><b aria-hidden="true">→</b></a></nav>
