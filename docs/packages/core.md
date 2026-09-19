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

## Bounded local shape inference

`inferLocalDataShape` is the bounded structural check used by the runtime local
binding. It accepts a complete row array and an optional declared Zod object
schema, validates field names and scalar values against the existing resource
schema semantics, and returns either a ready shape or an explicit diagnostic.
It never invents a field or a business identity. Empty input therefore needs a
declared schema; schema-less all-null or nested values, inconsistent row keys, duplicate
canonical identities, and values that exceed the configured row/field/byte
bounds are rejected with `data.*` diagnostics. Use an explicit `identity` field
list or a callback that resolves to exactly one real scalar field:
Declared nullable schema fields may contain `null`; the schema-less all-null
case is the ambiguous case.

```ts
import { inferLocalDataShape } from '@aeliqo/core/features';

const shape = inferLocalDataShape({
  id: 'people',
  rows: [{ id: 'ada', name: 'Ada' }],
  identity: ['id'],
  limits: { rows: 1_000, fields: 32, bytes: 1_000_000 },
});
if (!shape.ok) throw new Error(shape.diagnostics[0].message);
```

An empty collection can still report its declared fields:

```ts
const empty = inferLocalDataShape({
  id: 'people',
  rows: [],
  schema: peopleFeature.schema,
  identity: ['id'],
});
```

The result reports field kind and nullability and is safe to use as a
diagnostic/coverage input. It is not a second resource definition or query
planner; data features still own the canonical Catalog and schema lowering.
Structural inference supports `text`, `boolean`, `integer`, `float`, and
`decimal`; a declared schema additionally reports its resource-compatible
`date` and `instant` kinds. The helper does not infer permissions, units,
currency, metrics, relationships, pagination/coverage, or business IDs; those
remain explicit host/resource and binding contracts. The same helper is
re-exported from `@aeliqo/core` for root consumers.

## Remote capability and analytics semantics

A remote Catalog declares only operations the source can execute. A capability
may name registered metrics and one pagination contract:

```ts
const capability = {
  ref: { id: 'people.remote', revision: '1' },
  entity: 'people',
  operators: [{ id: 'eq', revision: '1' }],
  fields: ['id', 'name', 'team'],
  relations: [],
  metrics: [{ id: 'people.global-count', revision: '1' }],
  pagination: {
    mode: 'snapshot',
    stableOrder: [{ field: 'id', direction: 'asc', nulls: 'last' }],
    identity: ['id'],
  },
  maxOutputRows: 10_000,
} satisfies Catalog['capabilities'][number];
```

Catalog validation resolves every capability field, relation, and metric.
Pagination identity must match the entity identity, and the stable order must
end with that identity as its deterministic tie-breaker. Snapshot and keyset
modes are different contracts; a source must not relabel an offset cursor as a
live keyset cursor.

Registered analytics keep meaning metadata in the validated logical plan.
Semi-additive measures require an explicit time bucket and select all rows at
the latest requested temporal value before applying the registered aggregate. Ratio-of-sums, mean-of-rates, count, and nested
aggregates apply the meaning's missing-value policy; propagating aggregate
meanings declare nullable outputs. Units and currencies must
match unless a reviewed conversion meaning explicitly defines the conversion.
A partial page cannot be promoted to a complete global aggregate; complete
analytics require complete source coverage or server-provided computed
evidence tied to the exact query and meaning revision.

References must be namespaced and versioned. Intent and view references can
only name capabilities and views declared by the same feature. Capability
`kind` is explicit because a schema shape does not imply read, status, command,
cancel, or output semantics.

`ResultRef` also carries `sourceLineage`: a stable source identity distinct from
the revision. Preserve it when forwarding result references, including task
inputs, result events, and presentation bindings. A mixed-consistency Result
must state the same immutable lineage so consumers can distinguish an advancing
live source from an unrelated source that reused a revision label.

## Explicit subpaths

| Subpath                      | Contents                                                       |
| ---------------------------- | -------------------------------------------------------------- |
| `@aeliqo/core/schema`        | JSON schemas for persisted or transported contracts            |
| `@aeliqo/core/contracts`     | Contract parsing, validation, scalar handling, and wire limits |
| `@aeliqo/core/app`           | Custom intent compilers and resource validation                |
| `@aeliqo/core/features`      | Immutable features and bounded local shape inference           |
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
