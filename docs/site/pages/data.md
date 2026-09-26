---
id: 'data'
path: '/guides/data/'
section: 'Build'
title: 'Data adapters'
description: 'Connect local records, the Aeliqo HTTP protocol, or an application adapter without leaking credentials or inventing REST semantics.'
---

<p class="lead">Every resource binding supplies a <code>DataService</code>. The runtime plans and evaluates the same query contract regardless of where data lives.</p>
<h2>Choose the correct boundary</h2><div class="decision-grid"><article><h3>Local snapshot</h3><p>Use when rows are already authorized and bounded in the browser or worker.</p><a href="/guides/local-data/">Local guide →</a></article><article><h3>Application server</h3><p>Use the Aeliqo HTTP contract when records or credentials must stay on the server.</p><a href="/guides/http-data/">HTTP guide →</a></article><article><h3>Custom source</h3><p>Implement the small DataService interface and map filtering, sort, pagination, results, errors, and cancellation explicitly.</p></article></div>
<h2>The contract is three methods</h2><p>A custom source implements the same <code>DataService</code> interface the built-in adapters use:</p>

**data-service.ts**

```ts
import type { DataService } from '@aeliqo/runtime/data';

const service: DataService = {
  // Expose only the metadata this principal may see.
  describe: (request, context) => describeAllowedCatalog(request, context),
  // Accept a normalized query or reject it with a structured diagnostic.
  plan: (request, context) => planAuthorized(request, context),
  // Stream bounded Result events; stop when context.signal aborts.
  execute: (request, context) => executeAgainstSource(request, context),
};
```

<p><code>describeAllowedCatalog</code>, <code>planAuthorized</code>, and <code>executeAgainstSource</code> are application functions: <code>describe</code> and <code>plan</code> resolve to an <code>Outcome</code>, while <code>execute</code> returns an async iterable of result events. The <a href="/guides/http-data/">HTTP guide</a> shows a complete loopback implementation.</p>
<h2>No universal REST shortcut</h2><p><code>rest('/api/employees')</code> cannot know an arbitrary API’s pagination, permissions, null semantics, revisions, or error model. Build a deliberate adapter and test each mapping.</p>
<h2>Required behavior</h2><div class="doc-checklist"><ul><li>Validate all remote responses before materializing a Result.</li><li>Preserve source revision, scope digest, identity, grain, precision, and completeness.</li><li>Propagate cancellation to actual source work.</li><li>Enforce row, byte, column, request, and materialization limits.</li><li>Clear no-longer-authorized data after principal or scope changes.</li></ul></div>
<h2>Audit without data leakage</h2><p>The local audit exporter accepts fixed event shapes and bounded numeric observations. Do not include record payloads, prompts, credentials, query strings, or direct identity.</p>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/guides/permissions/"><span>Permissions</span><small>Supply trusted context to every evaluation and commit.</small><b aria-hidden="true">→</b></a><a href="/concepts/safety/"><span>Safety model</span><small>Understand why browser validation does not replace server authorization.</small><b aria-hidden="true">→</b></a></nav>
