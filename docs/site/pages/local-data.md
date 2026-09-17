---
id: "local-data"
path: "/guides/local-data/"
section: "Build"
title: "Local data service"
description: "Evaluate canonical queries over a bounded, application-owned snapshot with no network and no AI."
---

<p class="lead">Use local data for synthetic demos, offline tools, tests, and records the application already has permission to expose.</p>
<h2>Create the service</h2>

**data.ts**

```ts
const data = createLocalDataService({
  snapshot: {
    catalog: people.catalog,
    sourceRevision: 'people-data-1',
    records: {people: permittedRecords},
  },
  functionRegistry,
  sourceLimits: {rows: 1_000, bytes: 1_000_000},
  authorize: ({context}) => authorizePeople(context.principal),
});
```


<h2>Keep it bounded</h2><p>The snapshot is not a client-side database mirror. Limit the records before binding them, paginate large collections, and dispose materialized results when the Region or authority context changes.</p>
<h2>Failure recovery</h2><p>An unsupported query returns a diagnostic without mutating the current Region. A cancelled evaluation releases pending work. A denied request must not retain rows from an earlier principal.</p>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/start/"><span>Complete quickstart</span><small>See this adapter in the compiled People example.</small><b aria-hidden="true">→</b></a><a href="/guides/http-data/"><span>Move execution server-side</span><small>Keep private source records out of the browser.</small><b aria-hidden="true">→</b></a></nav>
