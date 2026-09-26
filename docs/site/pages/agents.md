---
id: 'agents'
path: '/agents/'
section: 'Connect agents'
title: 'Connect an agent'
description: 'Pair MCP, experimental WebMCP, or a host-supplied model with one authorized application session and Region.'
---

<p class="lead">Aeliqo depends on an agent only when your product wants language-driven UI. The framework itself remains deterministic: application code can send the same intent without any model.</p>
<h2>Three standard tools</h2><div class="doc-table"><table><thead><tr><th>Tool</th><th>Purpose</th><th>Cannot do</th></tr></thead><tbody><tr><th><code>aeliqo_context</code></th><td>Discover resources, fields, meanings, views, and actions visible to this session.</td><td>Read undisclosed rows or acquire grants.</td></tr><tr><th><code>aeliqo_render</code></th><td>Submit an intent through validation, evaluation, recipe selection, and Region commit.</td><td>Send HTML, JavaScript, SQL, or module URLs.</td></tr><tr><th><code>aeliqo_act</code></th><td>Preview or request execution of a registered business action.</td><td>Confirm itself or bypass server authorization.</td></tr></tbody></table></div>
<h2>What a tool call looks like</h2><p><code>aeliqo_render</code> accepts the same intent envelope application code sends. This call asks the paired Region to browse permitted People rows:</p>

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

<p>The tool returns a trusted receipt—for example <code>renderer-ready</code> only after the browser acknowledges the commit, or <code>denied</code> when current authority rejects the request.</p>
<h2>Choose a transport</h2><div class="decision-grid"><article><h3>MCP</h3><p>Connect an external agent over a local stdio or HTTP host.</p><a href="/agents/mcp/">MCP setup →</a></article><article><h3>BYOK</h3><p>Run a bounded model loop in your trusted host process and keep the provider key local.</p><a href="/agents/byok/">BYOK setup →</a></article><article><h3>WebMCP</h3><p>Use native browser capability detection when available, with manual UI as the fallback.</p><a href="/agents/webmcp/">Experimental setup →</a></article></div>
<aside class="doc-callout" data-tone="boundary"><strong>What “AI cannot hallucinate UI” means</strong><p>A model may still misunderstand valid language. Aeliqo guarantees that unknown resources, fields, actions, views, functions, stale proposals, over-budget payloads, and unauthorized operations are rejected before execution. It does not guarantee perfect interpretation.</p></aside>
<p>If discovery shows that a requested concept is unavailable, the host should allow a truthful <code>no-commit</code> response instead of forcing the model to render unrelated data. The public local runner labels model-only prose as a draft and leaves the current Region unchanged.</p>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/agents/quickstart/"><span>Agent quickstart</span><small>Create one paired endpoint and inspect receipts.</small><b aria-hidden="true">→</b></a><a href="/concepts/safety/"><span>Safety model</span><small>Understand validation and proof boundaries.</small><b aria-hidden="true">→</b></a></nav>
