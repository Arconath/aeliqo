# @aeliqo/core

Pure, versioned Aeliqo wire contracts for **Catalog**, **Task**, **Result**, and
**Experience**. This implementation currently supplies canonical schemas, inferred
readonly TypeScript types, bounded parsing, diagnostics, and stable serialization.
Semantic compilation and evaluation are subsequent implementation slices.

```ts
import {parseCatalog, serializeContract} from '@aeliqo/core';

const parsed = parseCatalog(untrustedJSON);
if (parsed.ok) {
  const wire = serializeContract('catalog', parsed.value);
  // Pass the validated shape to the application's binding/authorization layer.
} else {
  // Show stable diagnostic codes and paths; input values are not echoed.
}
```

`parseContract(kind, input)` accepts JSON text or a plain JSON value and returns
`Outcome<T>`. It rejects unknown fields and versions without coercion or migration.
JSON text with duplicate object keys, including escaped spellings of the same
key, is rejected instead of accepting the last value.
Serialization validates again, sorts object keys, and preserves array order,
decimal text, and signed zero. Readonly types prevent ordinary typed mutation;
returned objects are not frozen. Treat parsed values as immutable.

Shape validation does not establish intent, business truth, catalog binding,
permissions, sequence freshness, or correct grain/aggregation. Applications retain
data ownership and authority. A successful parse grants no effects.

Every document is limited to 8 MiB UTF-8, depth 64, 100,000 visited values,
10,000 array items, 256 object properties, 160 UTF-16 code units per key, and
16,384 UTF-16 code units per string. Individual schema fields can have smaller
Unicode code-point bounds. Cycles, accessors, hidden or
symbol properties, custom prototypes, sparse arrays, `undefined`, nonfinite
numbers, and `__proto__` keys are rejected. JavaScript proxies and modified host
intrinsics are outside the JSON-data trust boundary; use JSON text at an external
boundary. These resource limits are independent of licensing.

JSON Schema 2020-12 files are exported through
`@aeliqo/core/schemas/catalog.schema.json` (and the other contract kinds).
Consumers must apply the documented byte, depth, and node limits before recursive
JSON Schema validation. The low-level `@aeliqo/core/schema` export is the canonical
schema source; use the bounded parsers for untrusted ingress.

Wire version `1` is separate from package version `0.1.0`. There is no automatic
migration. All four document envelopes, including Result, require `version: '1'`.

Apache-2.0. Zod is MIT licensed. No renderer, provider, filesystem, database,
network, or runtime-generated code is required by the public parser entry.
The no-code-generation guarantee concerns execution: the pinned schema dependency
contains an unused lazy compiler, but parsing works with string-code generation
disabled. It is not a claim that every dependency source file lacks that syntax.
