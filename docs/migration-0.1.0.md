# Migrating from the legacy 0.2 packages to the 0.1 rewrite

The Aeliqo 0.1 rewrite is a new, incompatible package lineage. It is not a semver downgrade or an automatic upgrade from the packages published as 0.2.0. Install the rewrite packages at exact versions and migrate deliberately.

## Package identities

| Responsibility | Rewrite package | Legacy package or status |
|---|---|---|
| Contracts, semantics, query, presentation validation | `@aeliqo/sdk-core@0.1.0` | Replaces incompatible `@aeliqo/core@0.2.0` |
| Effectful evaluation and task/result lifecycle | `@aeliqo/sdk-runtime@0.1.0` | New public lineage |
| Shared Lit/custom-element implementation | `@aeliqo/sdk-web@0.1.0` | New public lineage |
| Thin React bindings | `@aeliqo/sdk-react@0.1.0` | Replaces incompatible `@aeliqo/react@0.2.0` |
| Protocol and model adapters | `@aeliqo/sdk-agent@0.1.0` | Replaces `@aeliqo/mcp`, `@aeliqo/byok`, and `@aeliqo/webmcp-experimental` 0.2.0 packages |
| Local Studio/document tooling | `@aeliqo/sdk-devtools@0.1.0` | New public lineage |

`@aeliqo/testkit` remains a private workspace. It is not an npm release dependency or one of the six public artifacts.

## Install exact packages

Use the packages needed by the application, pinned exactly while the API is major-zero. For example:

```sh
npm install --save-exact @aeliqo/sdk-core@0.1.0 @aeliqo/sdk-runtime@0.1.0 @aeliqo/sdk-web@0.1.0
```

Do not use a range such as `^0.1.0` for the initial cutover, and do not expect an existing `^0.2.0` dependency to select the rewrite.

## Change imports

Core and React imports gain the uniform `sdk-` package prefix:

```ts
import type {Catalog, Task} from '@aeliqo/sdk-core';
import {AeliqoInput} from '@aeliqo/sdk-react';
```

The former protocol packages are now subpaths of one agent boundary:

```ts
import {createMcpStdioServer} from '@aeliqo/sdk-agent/mcp';
import {createOpenAIModel} from '@aeliqo/sdk-agent/model/openai';
import {createWebMcpAdapter} from '@aeliqo/sdk-agent/webmcp';
```

The 0.2 packages are not forwarding shims. Their APIs, workspace documents, persisted plans, and protocol payloads must not be assumed compatible with the rewrite. Recreate or explicitly migrate saved application state using the 0.1 contracts, and validate identity, grain, scope, meaning versions, permissions, and result lineage before activation.

## Roll back

Keep the previous lockfile and deployment digest. A rollback restores the complete previous dependency set and matching application deployment; it must not mix 0.2 packages with 0.1 rewrite packages. Existing 0.2.0 artifacts remain installable after targeted deprecation, so consumers can roll back while seeing a clear migration warning.

Stable package publication, dist-tag promotion, legacy deprecation, and production deployment are separate operations. The release operator must verify every exact registry artifact before moving to the next operation. The guarded legacy-deprecation command also compares the stable registry integrities with the verified candidate manifest before it can change legacy metadata.
