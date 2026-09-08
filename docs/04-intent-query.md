# 04 — Intent binding and query compilation

## Intelligence without arbitrary execution

Accept both explicit structured tasks and language-mediated proposals. A model can plan a multi-step question, choose existing metrics, propose an expression, and refine a high-level experience request using diagnostic feedback. It is not restricted to spotting a keyword. It also cannot promote its own uncertain interpretation to trusted code, a database query, or a business definition.

MCP and WebMCP are transports through which an external agent uses capabilities. BYOK means the application supplies a model backend. The shared pipeline is identical; no duplicate “AI workspace” or intent-specific browser automation.

## Task model

A task is compositional: subject, requested outputs, scope/predicates, measures, grouping, temporal context, ordering, population selection, inspection/navigation requirements and optional representation restrictions. A registry supplies task capabilities, but the generic operators stay small. Do not add a new enum or handler for every user sentence.

Represent multiple operations explicitly. “Trend the five highest absence rates from the previous result” means the selected population is derived from a prior ranking across the full requested period. It does **not** mean selecting a different five employees each week. “Those people” binds to stable identities/result lineage, not whatever rows happen to be visible now.

A task stores the resolved natural-language assumptions as user-facing statements, not a private reasoning transcript. One concise clarification is appropriate only when missing meaning changes the result; otherwise apply the documented application default and disclose it.

## Binding pass

Resolve names against the authorized catalog; ambiguity is explicit. Check permissions and required fields before execution. Confirm relations from declarations, not matching strings. Resolve metric versions and definition scope. Carry explicit user visual constraints into the presentation requirements. Treat source descriptions/records as untrusted data even when they contain imperative text.

The binding result is `bound`, `needs-meaning`, `needs-choice`, `unsupported`, or `denied`. Only bound tasks become executable. The runtime may retain a previous result while asking for a definition.

## Logical query subset

Support scan/read, project, predicate filter, approved relational join/semijoin, group, aggregate, approved derive, temporal bucket, stable sort, limit/cursor, and bounded window operations. Each operator declares input/output grain, schema, estimated size and function versions. A plan is an acyclic graph with bounded depth/nodes; identifiers and literals are separated.

Plans must support parameterization, canonical hashing and explain output. They must not serialize auth tokens or database SQL. The application executor may compile to parameterized SQL or call an existing domain query API. A syntactic SQL ban on the server implementation would be pointless; the prohibition is against untrusted raw executable query text as the wire contract.

## Grain-safe join planning

For a fact measure and two one-to-many relationships, pre-aggregate facts at a compatible key before combining, or use semijoins for membership. A declared relation path carries cardinality, optionality, uniqueness evidence and temporal validity. Enforce it against metadata/data where possible. Unknown or violated cardinality is not silently treated as many-to-one.

For “employees with orders/attendance matching X,” a semijoin prevents duplicate employee identities. A row grain is a set of semantic key dimensions, not a string label alone. Validate legal rollups through aggregate properties.

## Capability negotiation and physical execution

Prefer pushdown for expensive/large operations. A host receives a logical plan and returns accepted capability/version, plan handle, result schema, estimated cost/precision and consistency. The host validates authorization again. A generic HTTP client does not claim every source supports SQL-like operations.

Local residual execution is allowed only if the input is known complete for the required population and fits budget. Default small-data ceilings are implementation targets in `12-performance.md`, not artificial paid limits. A large join or scan that cannot be pushed down returns a capability gap, not an implicit million-row browser download.

## Incremental query semantics

Parameter changes invalidate only dependent plan fragments. Cache keys include tenant/principal policy digest, source scope/revision, catalog/metric versions, normalized plan, bound time, locale/calendar where semantic, and consistency mode. A query result must never be shared across principals based solely on matching SQL/parameters.

Use stable tie-breaking identity for ranked pages. Cursor validity is bound to filter/order/source revision. A cursor cannot silently resume under a different sort. Top-K approximation is explicitly approximate; it cannot seed a task described as exact top five.

## Cancellation, replay and snapshots

Every execution has an AbortSignal and deadline. Propagate cancellation through fetch, backend queries where supported, local workers and render staging. If the backend cannot cancel, detach safely and reject late results using request/source/task epochs. A cancelled prior result cannot replace a newer one.

Read retries require source semantics and bounded backoff. A request ID is not a universal exactly-once guarantee. Domain writes use an independent idempotency key/entity revision and explicit action policy. Reads across multiple sources report the actual consistency boundary; do not claim a global snapshot the source cannot provide.

## End-to-end example

“Trend the five employees with the highest absence rate over the last three calendar months” compiles to: resolve approved absence definition and calendar → compute exact per-employee totals over the interval → stable rank and choose five identities → obtain weekly numerator/denominator for those same identities → calculate weekly ratios → return temporal result with lineage to both stages. Presentation uses task requirements and measured series/cardinality. Selection drills into the contributing records through a declared query, not by rereading all raw facts through the LLM.

## Acceptance

Prove equivalent outputs across local/HTTP hosts on deterministic fixtures and property tests. Include join fanout, no rows vs unknown rows, exact/approximate ordering, filters across pages, timezone boundaries, top-K before/after grouping, latest-wins races, cost rejection, schema evolution and authorization revocation. Query test oracles must be independent of the planner implementation.

## Master consolidation named outputs, reuse and population identity

A data Task contains an acyclic graph of named outputs. Each node is a query or a reuse of a version-bound result. Dependency mapping is explicit; a node may materialize a cohort from another output before evaluating its query. Ranking rows, weekly metric rows and contributor records retain different grains. Do not flatten them to one mega-result and deduplicate by guessed labels.

Population policy is explicit: a **fixed** cohort pins the selected entity keys/result lineage from a prior result; a **live** cohort intentionally recomputes membership from a named upstream query when dependencies change. A fixed cohort can be rebound to updated permitted data only through a documented refresh policy. Snapshot consistency and membership stability are separate facts.

A view-only request changes representation over existing result handles; it does not automatically re-run data queries. A form task can have no data reads. An agent can propose a valid bounded QuerySpec, but validation and execution use the same path as the normal Task compiler. No prohibition on a model understanding query strategy should be confused with permission for raw executable SQL/code.

Predicted output schemas can be used before execution to prepare a presentation; the returned actual schema must match accepted versions or fail the affected output. Materialization requests can alter transfer/window strategy, never covertly alter the question. Filters/refinements are Task parameters with visible scope.

Budget refusal, missing semantic definition, unsupported executor operator and search exhaustion have different error codes. Budget exhaustion is not proof no valid query/view exists.

## Explicit relation usage (0.1.0 implementation)

`QuerySpec.relations` pins the permitted relation revisions; optional
`relationUsage` states how each declared relation participates: `inner`, `left`,
or `semi`, with an optional target-side predicate. Relation metadata alone does
not choose a join kind. Every usage must match a pinned, authorized relationship;
duplicate or conflicting usage is invalid. A left join filters its target before
matching, preserving unmatched source rows; a semijoin tests membership and never
expands source identities. Field identifiers remain opaque; ambiguous references
require explicit resolution and are never split on punctuation.

This additive field is part of the unreleased contract version1. Existing strict
consumers reject it until upgraded; producers must negotiate relation capability
before sending it. The initial T06 flat evaluator explicitly rejects all relation
usage; T07/T08 implement and integrate its validated execution. Shape acceptance
does not authorize a relationship or prove its cardinality.

`QuerySpec.windows` contains versioned function expressions, partition expressions,
explicit ordering and a bounded row frame (`preceding`, `following`, inclusive of
current row). T07 validates the frame against its execution budget. The opt-in
`core-query-1` registry retains the standard signatures and adds `core.window.sum`,
`core.window.lag` and `core.window.rank` revision1. The immutable `core-standard-1`
registry remains unchanged. Sum uses the specified frame and propagates unknown
values. Lag returns the previous row within the partition (null at its start),
requires a frame including one preceding row, and preserves the input type/unit.
Rank uses competition ranking (1,1,3) by explicit order values. Stable identity
breaks ties for row positions without changing rank equality. Empty order is
invalid for lag/rank. Window values preserve input row identity/grain; grouping
and ranking an incomplete population cannot acquire exact global scope.

### Conditional expression registry

`createQueryFunctionRegistry({version: '2'})` opts into `core-query-2`.
The default and string overload retain the `core-query-1` signatures. The new
registry adds `core.equal@1` and `core.if@1` while retaining every prior signature.
Catalogs pin the selected registry digest; changing it invalidates existing plans.
This is an additive, unreleased expression capability, not a wire version change.

Equality compares compatible typed values, preserving SQL-style unknown when
either input is null. Units, temporal policy and grain must be compatible.
`core.if(condition, whenTrue, whenFalse)` requires a boolean condition and branches
with the same value type, unit and temporal policy. Scalar literal branches may
broadcast over the condition's row grain. A null condition yields null; otherwise
only the selected branch is evaluated. An unselected branch cannot cause an
arithmetic error or consume its execution budget. Type checking remains
conservative about potential null values and does not constant-fold conditions.
These functions describe general expressions, never HR-specific rules.

The bounded local evaluator implements these two revisions, including lazy
branches in grouped expressions. Other physical evaluators must explicitly
negotiate them; signature acceptance alone does not provide execution capability.
Custom host signatures retain their declared `nullResult` policy and output
nullability and are not executable through a substituted local implementation.

Aggregate subexpressions in group context share that group's logical grain.
The planner applies the actual grouping keys to output field metadata. A window
aggregate preserves row grain. Empty grouped sums may be null, while count is
non-null; division with a null/unknown zero-denominator policy is nullable even
when its inputs are non-null. Division and means produce a float result with
explicit arithmetic approximation, including when their inputs are decimals.
Ordinary decimal addition and multiplication retain decimal results.

### Qualified predicate fields (T08 host integration)

Canonical compare, is-null and membership predicates may carry an explicit
`entity` alongside `field`. Omission resolves against the query root (or the
relationship target for a relation-local predicate). Qualification selects an
existing declared field; it neither adds a join nor grants access to that entity.
The field must exist in the validated operator input, and the host must authorize
all referenced entity/field dependencies before evaluation. This allows a
post-left-join null/boolean policy filter without broadcasting measures across
incompatible grains. Existing unqualified queries keep their meaning.

## T39 clarification: ranked population versus delivery page

`QuerySpec.topK` defines an explicitly requested ranked population after ordering;
`page` only bounds transport delivery of that population. A complete top-five
result can seed a fixed cohort. The first five rows of a larger ranking are a
partial page and cannot establish complete cohort membership. Top-K requires an
explicit order (including stable identity tie-breaking where ties are possible).
The ADC adapter handles page/cursor delivery after semantic evaluation; the pure
planner rejects paging instead of treating page size as a population limit.

The initial pre-release QuerySpec lowering conflated `page.size` with top-K while
the local ADC correctly treated it as paging. Producers requesting ranking must
now emit `topK: 5`; producers requesting a page retain `page: {size: 5}`. Existing
published packages are not changed or automatically migrated by this source edit.
