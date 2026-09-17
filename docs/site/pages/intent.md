---
id: "intent"
path: "/concepts/intent/"
section: "Understand"
title: "Intent"
description: "A small, validated request that application code and agents can both send through the same pipeline."
---

<p class="lead">Intent says what outcome is needed, not how to construct HTML. It may name a registered view preference, but it cannot install or implement that view.</p>
<h2>Standard intents</h2><div class="doc-table"><table><thead><tr><th>Kind</th><th>Purpose</th></tr></thead><tbody><tr><th><code>browse</code></th><td>Collection, search, filter, sort, and pagination.</td></tr><tr><th><code>detail</code></th><td>One identified entity or content item.</td></tr><tr><th><code>create</code></th><td>Open a registered creation form.</td></tr><tr><th><code>edit</code></th><td>Open a registered edit form for current host-supplied state.</td></tr><tr><th><code>compare</code></th><td>Compare identified entities or values.</td></tr><tr><th><code>analyze</code></th><td>Aggregate registered meanings at a valid grain and temporal policy.</td></tr></tbody></table></div>
<h2>Envelope boundary</h2><p>Intent may include resource, fields, filters, sort, page, identities, registered measures, period, and <code>preferredView</code>. It never includes principal, grants, credentials, executable code, SQL, HTML, endpoint URLs, or module paths.</p>
<h2>Custom intent</h2><p>Register a namespaced version, runtime input schema, capability list, and pure synchronous compiler. The produced Task passes the same schema, catalog, Region, and authority validation as a standard intent.</p>
<aside class="doc-callout" data-tone="warning"><strong>Valid does not mean correctly interpreted</strong><p>A model can choose the wrong but schema-valid filter or period. Keep material choices visible and return <code>needs-input</code> when ambiguity changes the outcome.</p></aside>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/reference/intent-schema/"><span>Intent schema</span><small>Inspect fields and validation behavior.</small><b aria-hidden="true">→</b></a><a href="/guides/custom-views/"><span>Extensions</span><small>Add custom behavior without enlarging core.</small><b aria-hidden="true">→</b></a></nav>
