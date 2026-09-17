---
id: "http-data"
path: "/guides/http-data/"
section: "Build"
title: "HTTP data service"
description: "Keep authenticated identity, credentials, source policy, and private records in the application server."
---

<p class="lead">The browser sends a bounded query. The application service authenticates the request, derives current source policy, and executes against a private source.</p>
<h2>Trust boundary</h2><div class="boundary-diagram" role="img" aria-label="Browser intent reaches an authenticated application service before the private source"><div>Browser Region<small>Intent + cancellation</small></div><span aria-hidden="true">→</span><div>Application service<small>Identity + policy</small></div><span aria-hidden="true">→</span><div>Private source<small>Authorized execution</small></div></div>
<aside class="doc-callout" data-tone="warning"><strong>Never trust wire authority</strong><p>Principal IDs, grants, policies, credentials, or endpoint URLs received from the browser or agent are data—not authority. Derive trusted context inside the host.</p></aside>
<h2>Map the complete protocol</h2><div class="doc-checklist"><ul><li>Discovery exposes only metadata allowed for the authenticated session.</li><li>Filter, sort, pagination, nulls, units, revisions, partial results, and errors have explicit mappings.</li><li>Request abort reaches the database or upstream request.</li><li>Malformed or over-budget messages fail closed.</li><li>Server authorization is checked again before reads and writes.</li></ul></div>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/guides/permissions/"><span>Authority adapter</span><small>Unify evaluator, Region, action, and agent context.</small><b aria-hidden="true">→</b></a><a href="/ship/"><span>Production checks</span><small>Verify source isolation and failure handling.</small><b aria-hidden="true">→</b></a></nav>
