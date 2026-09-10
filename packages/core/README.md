# @aeliqo/sdk-core

Pure, versioned Aeliqo wire contracts for **Catalog**, **Task**, **Result**, and
**Experience**. This implementation currently supplies canonical schemas, inferred
readonly TypeScript types, bounded parsing, diagnostics, and stable serialization.
Task structure and Experience restriction intersection are also available.
Semantic expression checking and typed meaning authoring are available.
Bounded in-memory relational planning and evaluation are available through the
query API described below.

```ts
import {parseCatalog, serializeContract} from '@aeliqo/sdk-core';

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

`parseWireValue(input)` applies the same bounded JSON ingress checks before an
application protocol validates its own envelope schema. Strings are interpreted
as JSON text, including duplicate-key detection. It returns `Outcome<unknown>`;
successful ingress is not envelope validation or authorization. The exported
`Wire<T>` utility supplies the same readonly JSON type convention for inferred
envelope types.

JSON Schema 2020-12 files are exported through
`@aeliqo/sdk-core/schemas/catalog.schema.json` (and the other contract kinds).
Consumers must apply the documented byte, depth, and node limits before recursive
JSON Schema validation. The low-level `@aeliqo/sdk-core/schema` export is the canonical
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

## Bounded relational queries

`createQueryFunctionRegistry()` supplies the versioned `core-query-1` signatures,
including bounded windows. `createQueryPlanner({catalog, registry, definitions,
limits})` creates a planner. Call `plan(query)` to validate a canonical `QuerySpec`
or the internal typed `RelationalQuery`; call `evaluate(plan, source, context)`
to evaluate supplied rows. Both return `Outcome` values. Plans expose their
operator graph, predicted output schema, cost estimates and explanations.

The evaluator performs no I/O. The application supplies catalog declarations,
authorized source relations, source revision and scope/policy pins. Execution
revalidates the plan and pins; this comparison cannot authenticate the host that
supplies them. A plan key is a content identity, never a permission credential.
Source completeness is explicit; grouping, global ranking and windows cannot
silently treat a partial population as complete. Decimal arithmetic retains its
decimal representation, and result precision reports arithmetic approximation. Integer sums accumulate exactly, including cancellation; public integer outputs and integer expression intermediates outside the safe scalar range fail explicitly. Mixed decimal/integer addition, subtraction and multiplication promote integers exactly. Ratio totals may use wide exact accumulators before the documented floating division.

Row, byte, join, plan-size and operation ceilings bound local work. The execution
context can tighten budgets and provide a cancellation view and monotonic clock
for a deadline. Core does not read a global clock or introduce browser APIs.
Use the runtime data path for source access and asynchronous cancellation.

The default row ceiling is 10,000 across the source relations actually scanned.
Source bytes and each intermediate materialization are bounded; a small final
projection does not exempt a large source. Context overrides cannot enlarge the
planner's configured ceilings. Operation accounting includes source validation,
row visits and evaluated expressions; skipped conditional branches incur no
execution charge. These are cooperative checks within synchronous local work.

`createQueryFunctionRegistry({version: '2'})` selects `core-query-2`, adding typed
equality and lazy conditional expressions. The default keeps `core-query-1`.
The raw synthetic HR tests exercise employee/department counts, conditional rates
and ranking against an independent fixture. Division is marked approximate;
fixed-cohort weekly Task execution remains separate integration work.

This API is an implementation slice, not full Task execution. Authorized prior
result populations and named-output orchestration remain separate integration work.
The runtime data entry provides bounded local and HTTP execution. Unsupported temporal policies, cursors and
operators return diagnostics; they do not trigger a download of a larger source
or a hidden fallback to executable query text.

`validateScalar(value, semanticType)` and `scalarIdentity(value, semanticType)`
share the query engine's bounded value rules with host/runtime consumers. The
latter returns an opaque normalized scalar key, including exact instant fraction
and decimal equivalence; encode composite keys as tuples of those keys. Neither
helper authenticates data or grants access.


`validateCommitReadSet(expected, current, requiredResults)` checks the canonical
`CommitPreconditions` against current host-owned versions, including every referenced
result ID/revision/output/query/scope. Reference order does not matter. Unrelated
current results do not invalidate a candidate; changed or missing dependencies do.
The runtime derives `requiredResults` from the actual task and presentation reads,
so a proposal cannot omit a dependency merely by supplying a smaller list. Duplicate
references within staged/current read sets and mismatched scopes are rejected.
The required-dependency list may repeat a reference used by several views. The result is immutable.

This comparator does not authenticate either input, grant an effect, determine
business intent, or check a renderer's readiness. The runtime captures trusted
versions, handles data materialization revisions, and rechecks before committing.

## Interaction graph validation

`validateInteractionGraph({nodes, links}, registeredMappings)` checks explicit
port connections independently from containment and query dependencies. Resolve
node ports from trusted component registrations and supply the mapping registry
from application code; a proposed plan cannot register its own capabilities.
Port shapes bind payload, entity, ordered identity, grain, scalar/unit/temporal
semantics and optional registered extension version. Registered conversions
declare both their source and target shapes. Grain order is irrelevant; composite
identity order is significant.

Selection identity-equivalence links form bidirectional equivalence classes.
Directed links between classes must be acyclic, and ordinary directed feedback
inside a class is rejected. Runtime must implement identity propagation itself;
an arbitrary mapping callback cannot claim convergence through a flag. The pass
does not invent forwarding between different ports on the same node.

The helper returns a bounded immutable graph with its used mapping manifests.
It runs no callbacks, grants no effects and does not establish population
membership or field edit permission. Those contextual checks belong to the
runtime and host before a typed interaction can affect state.

## Registered presentation composition (early T39 subset)

`createPresentationRegistry` installs trusted versioned manifests. Each manifest
has a synchronous, pure configuration validator, actual operation metadata and
result-derived ports. `validatePresentationPlan` checks the containment tree,
registered renderer/configuration, exact task result bindings, required fields
and operations, simultaneous comparisons, typed links and current read set.
Application-authorized descriptors and renderer capabilities come from the host;
these pure functions never grant access, execute a query or commit a region.

`composePresentation` tries complete candidates with a bounded expansion count.
A feasible incumbent is considered first, followed by explicit candidates and a
complete deterministic no-preset composition before bounded single substitutions.
An exhausted suggestion search is not proof that no valid configuration exists.
The request read set is always checked, including when an incumbent is reused;
the returned plan uses the requested plan ID/revision and validated request pins.
Named outputs with multiple available revisions require explicit descriptor
selection before automatic composition. Unknown SSR measurements remain unknown.

This early subset requires `allowWithoutPreset: true`. Pattern-only profiles are
reported unsupported until actual registered pattern expansion is implemented;
a caller-supplied pattern label cannot establish that a graph is an approved
expansion. T39 supports only explicit `aeliqo.state.identity@1` transfers between
the same view ID, role and representation. Representation replacement needs a
later registered transfer implementation. Structural, configuration, result and
interaction/coverage changes respect the host's focus/draft/IME transition lock.
The host supplies a previously committed incumbent for transition comparison;
reuse as a new candidate still requires current feasibility validation.


The agent contract types (`OperationGrant`, `AgentTaskProposal`,
`AgentBindingOutcome`, `AgentLoopBudget`, `NarrativeClaim`) share the same strict
schema source. A proposal never carries an authenticated actor, approval or grant.
Grant names are independent; an `act` preset or a model label is not a grant.
Enum contracts use JSON text when calling `parseContract`, for example
`parseContract('operation-grant', JSON.stringify('task.propose'))`.

A numerical narrative claim identifies an exact result, field, row identity,
semantic type, definition, population, filters and period. Value/comparison claims
cannot attach free prose. Inference and hypothesis text have separate variants;
references alone cannot verify their meaning. Shape parsing does not resolve
rows or check numerical truth. The runtime must obtain authorized evidence and
compare values; `compareScalars` exposes the existing exact scalar comparison.
Proposal repair budgets cover turns, repairs, elapsed time and payload size;
query, model egress and commit budgets remain with their effect authorities.
These additive pre-release contracts do not alter existing Task proposals or
create a provider, binder, permission, query or business effect in core.
