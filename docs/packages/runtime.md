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
authoritative for every data operation. Workspace transitions, dirty guards,
and forced invalidation are later scope-controller behavior and are not implied
by this local kernel. Dispose controllers, the scope, and finally the owning
runtime; every dispose operation is idempotent.

## Subpaths

| Subpath | Responsibility |
| --- | --- |
| `@aeliqo/runtime/data` | Local and HTTP data services, bounded reads, and materialization |
| `@aeliqo/runtime/evaluation` | Task evaluation |
| `@aeliqo/runtime/results` | Result storage, handles, and leases |
| `@aeliqo/runtime/regions` | Region state and atomic commit lifecycle |
| `@aeliqo/runtime/actions` | Registered application effects and action boundaries |
| `@aeliqo/runtime/interaction` | Routed interaction state and dispatch |
| `@aeliqo/runtime/presentation` | Runtime presentation adaptation |
| `@aeliqo/runtime/persistence` | Explicit export and restore of runtime documents |
| `@aeliqo/runtime/audit` | Bounded in-memory audit collection |
| `@aeliqo/runtime/meaning` | Host-owned meaning registration and evaluation |
| `@aeliqo/runtime/surfaces` | Scoped surface controller, ownership, address, and binding contracts |

`@aeliqo/runtime/app` is also available for applications that want to make the
composition boundary explicit.

## Lifecycle

Mount a Region once for its host lifecycle, render through the same Region ID,
and dispose the runtime when its owner is finished. A newer render supersedes
older work within that Region. Failed or denied work returns a typed receipt and
does not commit stale output.
