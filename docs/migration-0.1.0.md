# Migrating from the legacy 0.2 packages to the 0.1 rewrite

The Aeliqo 0.1 rewrite is a new, incompatible package lineage. It is not a semver downgrade or an automatic upgrade from the packages published as 0.2.0. Install the rewrite packages at exact versions and migrate deliberately.

## Package identities

| Responsibility | Rewrite package | Legacy package or status |
|---|---|---|
| Contracts, semantics, query, presentation validation | `@aeliqo/core@0.1.0` | Replaces incompatible `@aeliqo/core@0.2.0` |
| Effectful evaluation and task/result lifecycle | `@aeliqo/runtime@0.1.0` | New public lineage |
| Shared Lit/custom-element implementation | `@aeliqo/web@0.1.0` | New public lineage |
| Thin React bindings | `@aeliqo/react@0.1.0` | Replaces incompatible `@aeliqo/react@0.2.0` |
| Protocol and model adapters | `@aeliqo/agent@0.1.0` | Replaces `@aeliqo/mcp`, `@aeliqo/byok`, and `@aeliqo/webmcp-experimental` 0.2.0 packages |
| Local Studio/document tooling | `@aeliqo/devtools@0.1.0` | New public lineage |

`@aeliqo/testkit` remains a private workspace. It is not an npm release dependency or one of the six public artifacts.

## Install exact packages

Use the packages needed by the application, pinned exactly while the API is major-zero. For example:

```sh
npm install --save-exact @aeliqo/core@0.1.0 @aeliqo/runtime@0.1.0 @aeliqo/web@0.1.0
```

Do not use a range such as `^0.1.0` for the initial cutover, and do not expect an existing `^0.2.0` dependency to select the rewrite.

## Change imports

Core and React keep their concise package names, but the 0.1 API is intentionally incompatible with the deprecated 0.2 preview. The other responsibilities use matching concise names:

```ts
import type {Catalog, Task} from '@aeliqo/core';
import {AeliqoInput} from '@aeliqo/react';
```

The former protocol packages are now subpaths of one agent boundary:

```ts
import {createMcpStdioServer} from '@aeliqo/agent/mcp';
import {createOpenAIModel} from '@aeliqo/agent/model/openai';
import {createWebMcpAdapter} from '@aeliqo/agent/webmcp';
```

The 0.2 packages are not forwarding shims. Their APIs, workspace documents, persisted plans, and protocol payloads must not be assumed compatible with the rewrite. Recreate or explicitly migrate saved application state using the 0.1 contracts, and validate identity, grain, scope, meaning versions, permissions, and result lineage before activation.

## Roll back

Keep the previous lockfile, cached package artifacts where lawfully retained, and deployment digest. A deployment rollback restores the previous immutable image; it must not mix 0.2 packages with 0.1 rewrite packages. The owner manually unpublished the public 0.2.0 packages, so a fresh registry install of that historical dependency set is no longer an available rollback path. Do not claim otherwise.

Stable package publication, dist-tag promotion, obsolete-lineage inspection, and production deployment are separate operations. The release operator must verify every exact registry artifact before moving to the next operation. The guarded obsolete-lineage command treats an already-unpublished version as historical state, never as proof that the version was unused. The accidental `@aeliqo/sdk-core@0.1.0-rc.1` package is not a supported alias or migration bridge.
