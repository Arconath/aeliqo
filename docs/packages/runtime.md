# `@aeliqo/runtime`

`@aeliqo/runtime` coordinates intent compilation, trusted authority, bounded
data access, Results, Regions, and actions. Its domain code is usable in Node.js
and workers and does not access the DOM.

## Main entry point

```ts
import { createAeliqoRuntime } from '@aeliqo/runtime';
import type { AeliqoRuntimeOptions } from '@aeliqo/runtime';

const runtime = createAeliqoRuntime({ resources, authority });
const mounted = runtime.mount({ regionId: 'people-main', resourceId: 'people' });
if (!mounted.ok) throw new Error(mounted.diagnostics[0].message);
```

The host supplies each resource's data adapter and a fresh authority response.
Identity, grants, policy revisions, and read context stay with the host. An
intent cannot grant itself access.

## Scoped surfaces (vNext candidate)

The unreleased surface API adds live instances without changing the existing
app/Region compatibility path. A host creates an explicit local read-only scope
and may create multiple controllers from one immutable feature definition:

```ts
import { createAeliqoRuntime } from '@aeliqo/runtime';
import type { DataSurfaceBindings } from '@aeliqo/runtime/surfaces';

const runtime = createAeliqoRuntime({ runtimeId: 'app', resources, authority });
const scope = runtime.createLocalSurfaceScope({
  id: 'local-session',
  allowedFeatures: [peopleFeature.id],
});
const bindings: DataSurfaceBindings<PeopleState> = {
  initialState: { rows: [], selection: [] },
  source: {
    kind: 'data-service',
    service: peopleData,
    coverage,
    normalize: normalizePeopleResults,
  },
};
const left = runtime.createSurface({ scope, id: 'left', feature: peopleFeature, bindings });
const right = runtime.createSurface({ scope, id: 'right', feature: peopleFeature, bindings });
```

Construction is inert: it does not subscribe, start a timer, or read data.
`request()` is the explicit headless operation. Each controller owns an
immutable address containing the runtime, scope instance, activation epoch,
surface ID, and generation. Duplicate live IDs fail, remounting advances the
generation, and captured callbacks never resolve another target by feature
name. Generations come from one bounded-memory monotonic runtime sequence, so
disposed surface IDs do not leave per-ID tombstones. Data features continue
through `DataService.describe/plan/execute`; typed capability bindings cover
non-data features. Capability bindings supply a typed `initialIntent`, so the
first snapshot is truthful for both internal and external ownership without
reading an addressed host store during construction. The host can initialize
an external store from the returned controller address before its first read.

Internal ownership commits controller state through the existing runtime,
ResultStore, and Region lifecycle. External ownership reads a stable host store
and emits a correlated proposal. The host publishes acceptance or rejection
with `proposalDecision` containing the proposal ID, address, and expected
revision; firing `onProposal` or changing an unrelated host revision is not
acceptance. `request()` therefore returns `proposed` until the host explicitly
decides. Stale, denied, cancelled, disposed, unsupported, and failed outcomes
are explicit and do not retarget another instance. Pending proposals capture
the scope permission revision and are retired if that authority changes before
acceptance. Denied snapshots expose the binding's copied `initialState` rather
than stale rows or an untyped `undefined` value. Observer exceptions cannot
interrupt request completion or teardown.

`createLocalSurfaceScope` grants only the feature IDs named by the application;
it is not a remote credential or tenant selector. Backend authorization remains
authoritative for every data operation. Dispose controllers, the scope, and
finally the owning runtime; every dispose operation is idempotent.

### Canonical local data binding

For an application-owned snapshot, use the one public convenience adapter so
the surface, `LocalDataService`, ResultStore, and Region lifecycle share one
source and one address:

```ts
import { createLocalDataBinding } from '@aeliqo/runtime/surfaces';

const bindings = createLocalDataBinding({
  feature: peopleFeature,
  snapshot: { catalog: peopleFeature.catalog, sourceRevision: 'people-1', records: { people: rows } },
  initialState: { rows: [], selection: [] },
  coverage,
  normalize: normalizePeopleResults,
});
const surface = runtime.createSurface({
  scope,
  id: 'people-main',
  feature: peopleFeature,
  bindings,
});
```

`bindings.service` is the exact service mounted by the surface. Replacing its
snapshot is explicit: the input is copied and frozen, a new `sourceRevision`
is required for changed records, and equivalent catalog-plus-record content at
the same revision is a no-op that retains plans and registered meanings. A
same-revision conflict, a feature/catalog mismatch, an invalid shape, or a
capacity violation is rejected atomically, leaving the last committed surface
state and address intact. The replacement returns an `Outcome`; use it before
issuing a new request:

```ts
const replaced = bindings.service.replaceSnapshot({
  catalog: peopleFeature.catalog,
  sourceRevision: 'people-2',
  records: { people: nextRows },
});
if (!replaced.ok) throw new Error(replaced.diagnostics[0].message);
await surface.request({ kind: 'browse' });
// surface.address is unchanged; rows now come from people-2.
```

Local snapshots use `pagination: 'snapshot'`: they are complete bounded
application-owned inputs, not remote cursors. Query and page budgets can still
produce explicit partial results: the descriptor carries `coverage.kind` and
`coverage.reason`, `counts.population` is exact when the source is complete,
and a page can carry a continuation cursor. If even one row cannot fit the
response byte budget, execution returns a `data.budget` diagnostic; results
never silently truncate. `maxSourceRevisions` defaults to 256 and is bounded at
10,000; it caps the service lifetime's non-reusable revision history. A cap
failure preserves the current snapshot, and a deliberate rollback uses a
fresh revision.

The binding validates bounded scalar structure before it can emit a result:
empty/no-schema, schema-less all-null fields, nested/accessor/executable rows, invalid identifiers,
ambiguous or duplicate identities, and row/byte source limits are explicit
diagnostics; field count remains bounded by the wire/schema boundary. The
adapter is local and read-only; it does not infer permission,
fetch a missing source, or add another evaluator/cache/authority path. Dispose
the surface and its owning scope when the address ends; source replacement and
pending requests after disposal cannot resurrect it. T10's React lifecycle
adapter remains responsible for mounting and disposing this same controller;
it does not create a second local-data path. The helper is also re-exported
from `@aeliqo/runtime` for root consumers.

## Application scopes (vNext candidate)

`createScope` coordinates a trusted host-owned workspace or account selection.
A selector is only an address presented to the host: it never grants data or
action authority. The host resolves and authorizes it, then returns revisions
that the runtime captures in immutable activation addresses.

```ts
import { createAeliqoRuntime } from '@aeliqo/runtime';
import type { ScopeBinding } from '@aeliqo/runtime/scopes';

const runtime = createAeliqoRuntime({ resources, authority });
const binding: ScopeBinding = {
  resolve: (selector) => host.resolveWorkspace(selector),
  authorize: (resolution) => host.authorizeWorkspace(resolution),
  prepareActivation: (target, context) => host.acceptWorkspaceActivation(target, context),
  activate: (target, context) => host.commitWorkspaceActivation(target, context),
  deactivate: (active, reason) => host.releaseWorkspaceActivation(active, reason),
  readLeaveState: () => drafts.readLeaveState(),
  beforeLeave: (request) => drafts.confirmLeave(request),
  recover: (request) => host.navigateAfterRevocation(request),
};
const workspace = runtime.createScope({
  initial: { kind: 'workspace', id: 'acme' },
  binding,
});
const detach = workspace.attach();
const transition = await workspace.requestChange({ kind: 'workspace', id: 'globex' });
```

Construction is inert. The first `attach()` starts resolution, and the last
detach aborts an unfinished initial resolution so a later attach can restart
it. Voluntary transitions keep the old activation available while the host
chooses Save, Discard, or Stay. A failed or denied target does not replace a
still-authorized old activation. The required synchronous, side-effect-free
`prepareActivation` hook is the trusted host's atomic acceptance boundary. It
receives the target and captured previous permission, policy, activation, and
draft revisions and must revalidate both scopes. Rejection preserves A and its
children. After acceptance, the runtime fences and deactivates A before the
required synchronous `activate` commit hook starts B effects. A commit failure
is irreversible at that point: the runtime compensates B and fails closed.
Epochs only increase, so late A-B-A work cannot commit into the new A.

If activation starts any host-owned resource, `deactivate` is its required,
idempotent compensation boundary. It must clear partial resources before
returning or throwing; the runtime isolates cleanup exceptions so one hook
cannot interrupt the remaining security fence.

Call `invalidate('logout' | 'revoked' | 'expired' | 'external-switch')` for a
forced authority loss. Invalidation synchronously masks the scope and fences
its child surfaces before optional recovery hooks run. Recovery navigation is
therefore host-controlled and cannot delay revocation. Child DataService,
Result, Region, action, cursor, proposal, and subscription work remains bound
to the address that created it and is released when that activation ends.

## Subpaths

| Subpath                        | Responsibility                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `@aeliqo/runtime/data`         | Local and HTTP data services, bounded reads, and materialization                      |
| `@aeliqo/runtime/evaluation`   | Task evaluation                                                                       |
| `@aeliqo/runtime/results`      | Result storage, handles, and leases                                                   |
| `@aeliqo/runtime/regions`      | Region state and atomic commit lifecycle                                              |
| `@aeliqo/runtime/actions`      | Registered application effects and action boundaries                                  |
| `@aeliqo/runtime/interaction`  | Routed interaction state and dispatch                                                 |
| `@aeliqo/runtime/presentation` | Runtime presentation adaptation                                                       |
| `@aeliqo/runtime/persistence`  | Explicit export and restore of runtime documents                                      |
| `@aeliqo/runtime/audit`        | Bounded in-memory audit collection                                                    |
| `@aeliqo/runtime/meaning`      | Host-owned meaning registration and evaluation                                        |
| `@aeliqo/runtime/surfaces`     | Scoped controllers, ownership/address contracts, and the canonical local data binding |
| `@aeliqo/runtime/scopes`       | Host-resolved scope transitions, leave guards, invalidation, and activation contracts |

`@aeliqo/runtime/app` is also available for applications that want to make the
composition boundary explicit.

## Lifecycle

Mount a Region once for its host lifecycle, render through the same Region ID,
and dispose the runtime when its owner is finished. A newer render supersedes
older work within that Region. Failed or denied work returns a typed receipt and
does not commit stale output.
