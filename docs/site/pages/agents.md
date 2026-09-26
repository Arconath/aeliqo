---
id: 'agents'
path: '/agents/'
section: 'AI agents'
title: 'Connect an agent'
description: 'Pair MCP, experimental WebMCP, or a host-supplied model with one authorized application session and Region.'
---

<p class="lead">Add an agent only when your product wants language-driven UI. Aeliqo itself stays deterministic: your code can send the same intent with no model.</p>
<h2>Pick a way to connect</h2><div class="decision-grid"><article><h3>Demo agent</h3><p>No setup and no model. The playground runs canned requests through the real tools.</p><a href="/playground/">Open the playground →</a></article><article><h3>MCP client</h3><p>Point Cursor or Claude Desktop at the local runner's HTTP endpoint or stdio bridge.</p><a href="/agents/mcp/">MCP setup →</a></article><article><h3>BYOK model</h3><p>Run a bounded model loop in the local runner. Your provider key stays out of the browser.</p><a href="/agents/byok/">BYOK setup →</a></article><article><h3>WebMCP</h3><p>Let Chrome's experimental in-browser agent call your tools, with a manual fallback.</p><a href="/agents/webmcp/">WebMCP setup →</a></article></div>
<h2>Know the three tools</h2><div class="doc-table"><table><thead><tr><th>Tool</th><th>Purpose</th><th>Cannot do</th></tr></thead><tbody><tr><th><code>aeliqo_context</code></th><td>Discover resources, fields, meanings, views, and actions visible to this session.</td><td>Read undisclosed rows or acquire grants.</td></tr><tr><th><code>aeliqo_render</code></th><td>Submit an intent through validation, evaluation, recipe selection, and Region commit.</td><td>Send HTML, JavaScript, SQL, or module URLs.</td></tr><tr><th><code>aeliqo_act</code></th><td>Preview or request execution of a registered business action.</td><td>Confirm itself or bypass server authorization.</td></tr></tbody></table></div>
<h2>Read a tool call</h2><p><code>aeliqo_render</code> accepts the same intent envelope your code sends. This call asks the paired Region to browse permitted People rows:</p>

**aeliqo_render input**

```json
{
  "version": "1",
  "id": "browse-engineering",
  "kind": "browse",
  "resource": "people",
  "fields": ["name", "team"],
  "filter": { "op": "compare", "field": "team", "comparison": "eq", "value": "Engineering" }
}
```

<p>The tool returns a trusted receipt. <code>renderer-ready</code> means the browser acknowledged the commit. <code>denied</code> means current authority rejected the request.</p>
<h2>Trust the boundary</h2><p>The agent proposes. The runtime validates. The Region commits. Your agent never emits executable UI, and you confirm consequential actions yourself.</p>
<aside class="doc-callout" data-tone="boundary"><strong>What “AI cannot hallucinate UI” means</strong><p>A model may still misunderstand valid language. Aeliqo guarantees that unknown resources, fields, actions, views, functions, stale proposals, over-budget payloads, and unauthorized operations are rejected before execution. It does not guarantee perfect interpretation.</p></aside>
<p>Discovery can show that a requested concept is unavailable. Answer truthfully instead of forcing unrelated data on screen. The local runner labels model-only prose as a draft and leaves the Region unchanged.</p>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/agents/quickstart/"><span>Agent quickstart</span><small>Try the scripted demo, then pair one endpoint.</small><b aria-hidden="true">→</b></a><a href="/concepts/safety/"><span>Safety model</span><small>Understand validation and proof boundaries.</small><b aria-hidden="true">→</b></a></nav>
