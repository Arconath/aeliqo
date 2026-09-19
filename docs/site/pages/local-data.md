---
id: 'local-data'
path: '/guides/local-data/'
section: 'Build'
title: 'Local data service'
description: 'Evaluate canonical queries over a bounded, application-owned snapshot with no network and no AI.'
---

<p class="lead">Use local data for synthetic demos, offline tools, tests, and records the application already has permission to expose.</p>
<h2>Create the service</h2>

**data.ts**

```ts
const data = createLocalDataService({
  snapshot: {
    catalog: people.catalog,
    sourceRevision: 'people-data-1',
    records: { people: permittedRecords },
  },
  functionRegistry,
  sourceLimits: { rows: 1_000, bytes: 1_000_000 },
  authorize: ({ context }) => authorizePeople(context.principal),
});
```

<h2>Mount one canonical local binding</h2>

For a scoped surface, construct the binding once. Its `service` is the exact
`LocalDataService` mounted by the controller, so source revisions and Result
events stay on one path:

```ts
import { createLocalDataBinding } from '@aeliqo/runtime/surfaces';

const bindings = createLocalDataBinding({
  feature: peopleFeature,
  snapshot: { catalog: peopleFeature.catalog, sourceRevision: 'people-1', records: { people: permittedRecords } },
  initialState: { rows: [], selection: [] },
  coverage,
  normalize: normalizePeopleResults,
});
const people = runtime.createSurface({ scope, id: 'people', feature: peopleFeature, bindings });
await people.request({ kind: 'browse' });
```

The surrounding application supplies `peopleFeature`, `runtime`, `scope`,
`coverage`, `permittedRecords`, and `normalizePeopleResults`; the installed
runtime consumer exercises the same binding and update path.

The binding copies and freezes each snapshot. Call `bindings.service.replaceSnapshot`
with an explicit new source revision, then issue a new request; the controller
and address remain stable. Equivalent catalog-and-record content at the same
revision is a no-op, while a same-revision conflict, catalog mismatch, invalid
shape, or capacity violation is rejected atomically and the last committed rows
remain visible. Source revisions are non-reusable for the service lifetime;
configure `maxSourceRevisions` (default 256, maximum 10,000) when a bounded
revision history is needed. A cap failure preserves the current revision; a
rollback uses a fresh revision with the old rows.
<h2>Keep it bounded</h2><p>The snapshot is not a client-side database mirror. The binding performs bounded structural inference: empty input needs a declared schema, scalar fields must have consistent keys and types, and nested, accessor, executable, schema-less all-null, ambiguous, duplicate, or invalid-identity rows return explicit diagnostics. Configure row and source-byte limits; field count remains bounded by the wire/schema boundary, while query and result budgets bound each request. Page and row budgets return explicit partial coverage with a reason, population when known, and a continuation cursor when available; a byte budget that cannot fit a response returns <code>data.budget</code> instead of silently truncating. Declared nullable schemas accept null values. Dispose materialized results when the Region or authority context changes.</p>
<h2>Failure recovery</h2><p>An unsupported query returns a diagnostic without mutating the current Region. A cancelled evaluation releases pending work. A denied request or failed replacement preserves the last committed rows only while the same authorized surface address remains active; disposal and scope transitions fence late updates.</p>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/start/"><span>Complete quickstart</span><small>See this adapter in the compiled People example.</small><b aria-hidden="true">→</b></a><a href="/guides/http-data/"><span>Move execution server-side</span><small>Keep private source records out of the browser.</small><b aria-hidden="true">→</b></a></nav>
