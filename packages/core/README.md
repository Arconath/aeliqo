# @aeliqo/core

Pure, versioned Aeliqo wire contracts for **Catalog**, **Task**, **Result**, and
**Experience**. This implementation currently supplies canonical schemas, inferred
readonly TypeScript types, bounded parsing, diagnostics, and stable serialization.
Task structure and Experience restriction intersection are also available.
Semantic expression checking and typed meaning authoring are available.
Query execution remains a subsequent implementation slice.

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

## Task structure and Experience restrictions

`validateTaskStructure(input)` validates the wire shape and named output graph,
then returns the parsed task, a stable dependency order, and external result
references. Fixed cohorts retain their complete result handles without acquiring
an implicit dependency on a current output; live cohorts require an explicit
upstream query edge and cannot turn an immutable reuse into live membership.
Reuse outputs can rename prior outputs. Presentation and form
tasks have no fabricated query. Different presentation handles may share output
names, but an operation targeting such a name is ambiguous; use named reuse
outputs to disambiguate those operation targets.

`resolveExperienceConstraints(experience, task, restrictions)` intersects hard
restrictions. An omitted restriction list field is unconstrained by that layer;
an empty list permits nothing. Required operations and simultaneous groups remain
intact. Explicit representation requests constrain the result; preferred requests
remain soft. Empty pattern lists still permit bounded composition when the
profile allows it. The initial search ceiling remains 64 expansions.

Restrictions can reduce mode, agent enablement, allowed representations/patterns,
operation revisions, extensions, budgets and automatic transition policy. They
cannot expand the profile or an earlier restriction. Fixed mode disallows
representation replacement; adaptive mode permits equivalent replacement;
composable mode permits composition changes. The eventual presentation validator
must enforce those flags against the actual current view and candidate.

These passes do not execute reads, validate result permissions, bind a catalog,
prove accessible renderer behavior, or grant actions/model egress. Host policy
and candidate validation remain independent. `agentAllowed: true` is a profile
setting, never an authenticated grant. Container width is not accepted as a
reason to remove keyboard operations or essential comparisons.


## Expressions and meaning authoring

`createStandardFunctionRegistry()` returns an `Outcome<FunctionRegistry>` with
versioned standard signatures. Pin its digest in the catalog. Trusted application
code can supply signatures through `createFunctionRegistry`; signatures describe
semantics and do not execute code. Unsupported function revisions fail explicitly.

`createTypedAuthoring({catalog, registry})` reuses catalog field types and identity.
With a literal catalog (`as const satisfies Catalog`), `field(entity, field)` also
checks entity and field names in TypeScript. Runtime checking remains necessary
for loaded catalogs. Builder methods return `Outcome` values, and failed inputs
propagate through composed expressions.

`ratioOfSums({numerator, denominator, zeroDenominator})` requires an explicit
`null`, `unknown`, or `error` denominator policy. `meanOfRates({rates})` expresses a
different, non-additive meaning. The checker preserves that distinction; neither
operation is a universal replacement for the other. Units, grain, nullable values,
temporal policy and function context constrain which expressions can be combined.
These checks describe arithmetic; they do not calculate query results.

`defineMetric` creates a manual draft with hypothesis authority. `bundle` and
`validateMeaningBundle` pin the catalog and function registry and reject conflicting
contents at an existing meaning ID/revision. A developer can review definitions in
source and ship the resulting bundle without Studio or model calls.

`validateMeaning` checks semantics and optional scope/authority-label restrictions.
It does not establish business truth or approve activation. The host calls
`authorizeMeaningActivation` against its own exact canonical definition allowlist;
copying an approved ID onto changed contents cannot grant activation. Keep that
allowlist and its policy revision outside untrusted model/client inputs. A returned
receipt is a local policy result, not a transferable authentication credential.
Data reads, actions and model egress require their own host authorization.

Expression traversal has explicit node/depth bounds. Function execution-cost
metadata is reserved for the query planner/evaluator; this module does not claim
to enforce a source-scan or execution-time budget.
