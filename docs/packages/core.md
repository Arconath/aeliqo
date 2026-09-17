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

## Explicit subpaths

| Subpath | Contents |
| --- | --- |
| `@aeliqo/core/schema` | JSON schemas for persisted or transported contracts |
| `@aeliqo/core/contracts` | Contract parsing, validation, scalar handling, and wire limits |
| `@aeliqo/core/app` | Custom intent compilers and resource validation |
| `@aeliqo/core/expressions` | Typed expression builders and function registries |
| `@aeliqo/core/semantics` | Catalog indexes and meaning validation or activation |
| `@aeliqo/core/query` | Query planning, logical plans, and evaluation |
| `@aeliqo/core/interaction` | Interaction graph and state contracts |
| `@aeliqo/core/presentation` | Presentation validation and composition |
| `@aeliqo/core/plot` | Plot specifications and binding |
| `@aeliqo/core/visualization` | Visualization specifications and binding |
| `@aeliqo/core/agent` | Agent proposal and authority wire types |

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
