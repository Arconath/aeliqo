---
id: 'http-data'
path: '/guides/http-data/'
section: 'Build'
title: 'HTTP data service'
description: 'Keep authenticated identity, credentials, source policy, and private records in the application server.'
---

<p class="lead">The browser sends a bounded query. The application service authenticates the request, derives current source policy, and executes against a private source.</p>
<h2>Trust boundary</h2><div class="boundary-diagram" role="img" aria-label="Browser intent reaches an authenticated application service before the private source"><div>Browser Region<small>Intent + cancellation</small></div><span aria-hidden="true">→</span><div>Application service<small>Identity + policy</small></div><span aria-hidden="true">→</span><div>Private source<small>Authorized execution</small></div></div>
<aside class="doc-callout" data-tone="warning"><strong>Never trust wire authority</strong><p>Principal IDs, grants, policies, credentials, or endpoint URLs received from the browser or agent are data—not authority. Derive trusted context inside the host.</p></aside>
<h2>Map the complete protocol</h2><div class="doc-checklist"><ul><li>Discovery exposes only metadata allowed for the authenticated session.</li><li>Filter, sort, pagination, nulls, units, revisions, partial results, and errors have explicit mappings.</li><li>Request abort reaches the database or upstream request.</li><li>Malformed or over-budget messages fail closed.</li><li>Server authorization is checked again before reads and writes.</li></ul></div>
<h2>Declare remote coverage honestly</h2>

The service catalog declares the supported fields, predicates, relationships,
metrics, stable ordering, page size, and pagination mode. Reject anything
outside that contract with a structured diagnostic. Do not fetch an entire
remote source to emulate a missing operation. A page is partial coverage; an
unknown or estimated population must stay unknown or estimated. A complete
global aggregate additionally needs the accepted plan's trusted aggregate shape
pin; semantic-looking descriptor evidence cannot create that exception.

Continuation cursors are opaque application data. Bind them to the authenticated
principal partition, full target, normalized query and ordering, catalog,
immutable source lineage and current source revision, semantic revisions,
policy revision, consistency mode, and expiry. Snapshot pagination pins one
immutable source revision. Live keyset
pagination continues after the final stable identity value; it is not an offset
with a different name.

<h2>Run the localhost reference</h2>

From the repository root, install its locked workspace dependencies first,
then run the synthetic reference:

```sh
pnpm install --frozen-lockfile
pnpm --filter @aeliqo/reference-host test
```

`examples/reference-host/server.mjs` starts a real Node HTTP server and wraps
`createDataHttpHandler` in the host's HTTP adapter. `verify.mjs` calls it via
`createHttpDataService`, checks local and remote rows plus descriptor fields,
then closes the listener. The executable path includes a `plan`, streamed
`execute` events, and a completion event; a successful HTTP response alone is
not evidence that a query was authorized or complete.

To inspect the server separately, run
`pnpm --filter @aeliqo/reference-host start`. It prints its loopback URL and
uses synthetic commerce data; stop it with Ctrl+C. The test command is the
repeatable check because it also exercises the client and cleanup. The fixture
uses permissive synthetic authentication and makes no paid model calls.
Production hosts must derive the principal and authorization from their own
trusted session, use their own private source adapter, and map failures to
explicit diagnostics. Do not copy the fixture's permissive authentication.
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/guides/permissions/"><span>Authority adapter</span><small>Unify evaluator, Region, action, and agent context.</small><b aria-hidden="true">→</b></a><a href="/ship/"><span>Production checks</span><small>Verify source isolation and failure handling.</small><b aria-hidden="true">→</b></a></nav>
