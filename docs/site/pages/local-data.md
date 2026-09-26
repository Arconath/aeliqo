---
id: 'local-data'
path: '/guides/local-data/'
section: 'Guides'
title: 'Local data service'
description: 'Evaluate canonical queries over a bounded, application-owned snapshot with no network and no AI.'
---

<p class="lead">Use local data for synthetic demos, offline tools, tests, and records the application already has permission to expose.</p>
<h2>Start with React</h2>

The 0.5.0 release line supports this API; the historical `0.5.0-rc.1` came
from an earlier revision and does not include it. For a small complete dataset already owned by your
application, no model, factory, catalog, or remote grant is needed. The
[React quickstart](/start/) gives all four files for a copyable app; its central
component is:

```tsx
import { AdaptiveSurface, useDataSurface } from '@aeliqo/react/surface';

type Person = { id: string; name: string; team: string };

export function People({ rows }: { rows: readonly Person[] }) {
  const surface = useDataSurface({ data: rows, getRowId: row => row.id });
  return <AdaptiveSurface surface={surface} />;
}
```

Use a new array reference when data changes. If the application mutates the
same array reference, change the hook's `version` option explicitly. For an
initially empty array, add a Zod `schema` and the real `identity` field name.
The server-rendered browse view includes useful read-only cells; the client
starts its source-backed controller after commit. Invalid updates report a
diagnostic and retain the last authorized result.
<h2>Use an owned local surface</h2>

The 0.5.0 source includes a providerless path for a bounded
array already supplied by the application. `createLocalDataSurface` owns its
local runtime and scope; call it only from committed UI lifecycle or from an
imperative application owner. The `getRowId` callback must select one actual
scalar field from each record.

```ts
import { createLocalDataSurface } from '@aeliqo/runtime/surfaces';

const owned = createLocalDataSurface({ data: rows, getRowId: row => row.id });
await owned.surface.request({ kind: 'browse' });
const update = owned.replaceData(nextRows);
if (update.ok) await owned.surface.request({ kind: 'browse' });
owned.dispose();
```

Rows must have a consistent, bounded scalar shape and unique identities. For
an initially empty array, supply both a declared schema and the identity field
name (for example, `identity: 'id'`); a callback cannot reveal its field until
there is a row. Empty rows without a usable identity return a diagnostic; callers should show
an honest empty state. Invalid replacements retain the last committed result.
The local scope grants no server authority and does not fetch remote data.
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
Trusted sources with canonical increasing numeric revisions can opt into
`revisionMode: { kind: 'monotonic', prefix: 'people-' }` to keep
only a high-water mark. Changed content at a repeated revision, stale revisions,
and malformed revisions are rejected; an exactly equivalent current revision
remains a no-op. The default history limit remains in force for arbitrary IDs.
<h2>Keep it bounded</h2><p>The snapshot is not a client-side database mirror. The binding performs bounded structural inference: empty input needs a declared schema, scalar fields must have consistent keys and types, and nested, accessor, executable, schema-less all-null, ambiguous, duplicate, or invalid-identity rows return explicit diagnostics. Configure row and source-byte limits; field count remains bounded by the wire/schema boundary, while query and result budgets bound each request. Page and row budgets return explicit partial coverage with a reason, population when known, and a continuation cursor when available; a byte budget that cannot fit a response returns <code>data.budget</code> instead of silently truncating. Declared nullable schemas accept null values. Dispose materialized results when the Region or authority context changes.</p>
<h2>Failure recovery</h2><p>An unsupported query returns a diagnostic without mutating the current Region. A cancelled evaluation releases pending work. A denied request or failed replacement preserves the last committed rows only while the same authorized surface address remains active; disposal and scope transitions fence late updates.</p>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/start/"><span>Complete quickstart</span><small>See this adapter in the compiled People example.</small><b aria-hidden="true">→</b></a><a href="/guides/http-data/"><span>Move execution server-side</span><small>Keep private source records out of the browser.</small><b aria-hidden="true">→</b></a></nav>
