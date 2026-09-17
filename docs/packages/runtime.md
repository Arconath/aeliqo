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

`@aeliqo/runtime/app` is also available for applications that want to make the
composition boundary explicit.

## Lifecycle

Mount a Region once for its host lifecycle, render through the same Region ID,
and dispose the runtime when its owner is finished. A newer render supersedes
older work within that Region. Failed or denied work returns a typed receipt and
does not commit stale output.
