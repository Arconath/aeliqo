# `@aeliqo/core`

`@aeliqo/core` defines Aeliqo's wire contracts and pure domain operations. It
does not read from a browser, access a network, or perform application effects.

## Main entry point

Use the package root for the common resource and contract workflow:

```ts
import { compileIntent, defineResource, parseCatalog } from '@aeliqo/core';
import type { Catalog, Intent, Task } from '@aeliqo/core';
```

The root exports `defineResource`, `compileIntent`, contract parsers and
validators, schema helpers, and the primary wire types. Typed parsers include
`parseCatalog`, `parseTask`, `parseResult`, `parseExperience`, `parseQuery`,
`parseInteraction`, `parsePresentationPlan`, and `parseResultEvent`. Use
`parseContract` when the contract kind is selected dynamically. The root does
not expose query planner or presentation implementation details.

## Reusable feature definitions

Use `@aeliqo/core/features` for immutable vNext feature metadata. A data
feature keeps its schema, identity fields, meanings, and eligible view aliases
separate from live rows, principals, credentials, selection, and subscriptions:

```ts
import { defineDataFeature } from '@aeliqo/core/features';
import { z } from 'zod';

const peopleFeature = defineDataFeature({
  id: 'people',
  schema: z.object({
    id: z.string(),
    name: z.string(),
    team: z.enum(['Design', 'Engineering']),
  }),
  identity: ['id'],
});
```

`peopleFeature.resource` is the compatibility lowering into the existing
`ResourceDefinition` path. It uses the same Catalog, intent compiler, query
planner, and validation behavior as `defineResource`; it does not introduce a
second data or authority engine. The default eligible view aliases are the
currently registered standard recipe aliases: `table`, `cards`, `list`,
`detail`, and `trend`. Supply `presentation` explicitly to narrow that policy.

Non-data features declare typed intents and the capability schemas they may
address without fabricating relational rows or a Catalog:

```ts
import { defineFeature } from '@aeliqo/core/features';
import { z } from 'zod';

const documentJob = defineFeature({
  id: 'document-job',
  capabilities: [
    {
      ref: { id: 'job.status', revision: '1' },
      kind: 'status',
      schema: z.object({ jobId: z.string(), state: z.string() }),
    },
  ],
  intents: [
    {
      ref: { id: 'job.configure', revision: '1' },
      schema: z.object({ template: z.string() }),
      capabilities: [{ id: 'job.status', revision: '1' }],
    },
  ],
});

const parsed = documentJob.parseIntent({
  intent: { id: 'job.configure', revision: '1' },
  input: { template: 'invoice' },
});
```

References must be namespaced and versioned. Intent and view references can
only name capabilities and views declared by the same feature. Capability
`kind` is explicit because a schema shape does not imply read, status, command,
cancel, or output semantics.

## Explicit subpaths

| Subpath                      | Contents                                                       |
| ---------------------------- | -------------------------------------------------------------- |
| `@aeliqo/core/schema`        | JSON schemas for persisted or transported contracts            |
| `@aeliqo/core/contracts`     | Contract parsing, validation, scalar handling, and wire limits |
| `@aeliqo/core/app`           | Custom intent compilers and resource validation                |
| `@aeliqo/core/features`      | Immutable data and non-data feature definitions                |
| `@aeliqo/core/expressions`   | Typed expression builders and function registries              |
| `@aeliqo/core/semantics`     | Catalog indexes and meaning validation or activation           |
| `@aeliqo/core/query`         | Query planning, logical plans, and evaluation                  |
| `@aeliqo/core/interaction`   | Interaction graph and state contracts                          |
| `@aeliqo/core/presentation`  | Presentation validation and composition                        |
| `@aeliqo/core/plot`          | Plot specifications and binding                                |
| `@aeliqo/core/visualization` | Visualization specifications and binding                       |
| `@aeliqo/core/agent`         | Agent proposal and authority wire types                        |

Import a subpath when using its named capability:

```ts
import { createQueryFunctionRegistry } from '@aeliqo/core/expressions';
import { createQueryPlanner } from '@aeliqo/core/query';
```

## Runtime requirements

The package is ESM and targets the supported Node.js and browser toolchains
declared by the repository. It has no runtime dependency on the DOM. The package
uses the contract wire version declared by `CONTRACT_VERSION`; this is separate
from the npm package version.
