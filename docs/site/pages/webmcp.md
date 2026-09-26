---
id: 'webmcp'
path: '/agents/webmcp/'
section: 'AI agents'
title: 'WebMCP (experimental)'
description: 'Detect native browser support and register bounded tools only when the current browser exposes the required capability.'
---

<p class="lead">WebMCP is a Chrome experiment. It lets an agent built into the browser call your tools without a separate client. Aeliqo reports <em>available</em>, <em>unavailable</em>, or <em>connected</em>; it never shows a mock connection as real.</p>

<h2>Enable support in Chrome</h2>

You need Chrome 146 or newer. Then do one of the following:

1. Open `chrome://flags/#enable-webmcp-testing`, set the flag to **Enabled**,
   and restart Chrome; or
2. Serve your site with a WebMCP origin-trial token.

<h2>Try it in the playground</h2>

1. Open the [playground](/playground/) in that Chrome.
2. Choose **Connect AI**, select **WebMCP (experimental)**, then choose
   **Check connection**.
   You should see “Native WebMCP registered _n_ tools (experimental)”.
3. If the browser lacks support, the status says WebMCP is unavailable. The
   demo agent and the manual controls still work.

<h2>Detect support in your app</h2>

Call `detectWebMcp` with the real `document`. It reports support when the
document exposes `modelContext.registerTool`. The adapter never reads globals
itself; you pass the document in. Mark the evidence `native` only when the
browser supplied the capability.

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

<h2>Keep a manual fallback</h2><p>The same resource must remain fully usable through buttons, filters, forms, and routes. Native registration is an optional communication surface, not a dependency for rendering or authorization.</p>
<h2>Read the evidence correctly</h2>

| Evidence    | What it proves                                                                                                 | What it does not prove                                |
| ----------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Native      | A supported browser registered, discovered, executed, cancelled, unregistered, and rejected a late Aeliqo tool | Support in every browser channel or enterprise policy |
| Simulated   | The adapter maps discovery, annotations, cancellation, receipts, and lifecycle to an injected test host        | Browser implementation availability                   |
| Unavailable | The current document exposes no supported `modelContext` host                                                  | A failure in buttons, forms, MCP, or BYOK             |

Chrome's [imperative API guidance](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
defines tool registration, discovery, execution cancellation, and disposal.
As of Chrome 153, unregistering a tool does not cancel work already in flight,
so Aeliqo also checks the endpoint lifecycle after execution and rejects late
results. Cross-origin tools additionally require the browser `tools`
Permissions Policy and explicit origin exposure.
<aside class="doc-callout" data-tone="warning"><strong>Experimental status</strong><p>WebMCP is still experimental and its browser API can change. Keep native, simulated, and unavailable evidence separate in test reports and product copy.</p></aside>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/agents/"><span>Agent overview</span><small>Compare MCP, BYOK, and WebMCP.</small><b aria-hidden="true">→</b></a><a href="/guides/adaptive-region/"><span>Manual Region path</span><small>Keep the full interface functional without an agent.</small><b aria-hidden="true">→</b></a></nav>
