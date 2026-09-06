# 05 — Data semantics and correctness

## Typed meaning belongs to the application

Descriptors are explicit runtime metadata, not guesses from column names. Track logical type (text, integer, decimal, boolean, instant, local-date, duration, enum, entity-ref), role (key/dimension/measure/time), unit, nullable/missing policy, entity/grain, and allowed operations. Business metadata may be confirmed or unconfirmed. DataPort capability is separate from field semantics: a sortable field does not prove a remote backend supports sort.

Stable row identity can be composite; index is not an entity key. A model price row might be keyed by provider/model/version/region/currency/modality/tier/effective period, not just model name. Entity equality is scoped by dataset namespace and entity contract, not by matching an `id` property.

## Money, prices, units

Formatting is not conversion. Locale changes decimal separators, grouping, symbol placement, and accessible reading; it never changes currency or amount. `Intl.NumberFormat` supports currency formatting; actual exchange conversion requires explicit rate/source/as-of policy in the application. [R12]

Money representation must be exact for business calculations: bounded decimal string with scale, or integer minor units where the domain guarantees that precision. Never assume two decimal places or round per-token prices to cents. For plotting, derive a finite numeric coordinate with an explicit precision tolerance while keeping exact source values for totals/labels/export.

Store currency code, price denominator and unit (for example per 1,000,000 input tokens), effective date, and tax/discount scope where applicable. USD/M input tokens is not directly comparable to USD/image or per request. Discounted batch/cached rates are separate price dimensions, not cheaper aliases of the same metric.

Mixed currencies may be faceted, compared with clear currency labels, or converted through an explicitly configured FX operation. Without conversion evidence, reject sum/ranking that pretends all values share one unit. Formatting to IDR without changing USD amount is a correctness failure, not a theme option.

## Aggregation algebra

Classify additive, semi-additive, non-additive, and derived measures. Sum revenue can be valid across disjoint events in one currency. End-of-day balances cannot be summed across days by default. Average of percent/rate can be invalid without weighting. Count distinct cannot generally be added across overlapping groups.

Example: group A has 1 approved from 2 and group B has 90 from 100. Combined rate is `(1+90)/(2+100) = 91/102`, approximately 89.2157%, not `(50%+90%)/2 = 70%`. Define rate as ratio of approved aggregates, including denominator-zero behavior. Weighted mean needs weight definition and null-handling contract; aggregation of an already aggregated metric requires an allowed rollup.

Metric expression AST is bounded and typed. It is not JavaScript/SQL. Shared unit/grain validator rejects incompatible addition, ratios lacking a denominator, unsupported groupings, or implicit many-to-many fanout. The MVP may delegate all aggregate execution to DataPort while validating its request/result contract; it does not need a universal analytics engine.

## Missingness and completeness

Distinguish `null`, missing field, zero, NaN/infinite invalid number, redacted, unknown, pending, and not applicable. JSON transport does not allow NaN/Infinity. Null comparison uses explicit null predicates; `eq null` is rejected in the candidate grammar. Empty dataset, empty filter result, query failure, permission denial and unavailable data have different UI states.

Result metadata includes `scope` (entire authorized dataset, server-filtered result, loaded page, or sample), total-known versus unknown, cursor, snapshot/data revision, fetchedAt/sourceAsOf, and quality warnings. `loaded 50 rows` never means a global Top 10 is correct. The UI must show when ranking/comparison is page-local. If global semantics are required and unsupported, return `incomplete_scope` rather than silently approximate.

Streaming state includes append/replace/upsert semantics, record keys, watermark/window, late-arrival policy, and backpressure. Coalescing visual updates is permitted; silently discarding business events is not. Editing a row that vanished or changed revision produces a conflict, not an overwrite.

## Time semantics

An instant and a calendar local date are different types. Store instants in an agreed serialized form, use explicit timezone for display/grouping, and keep local dates as calendar dates. Day/week/month grain, week start, fiscal calendar, interval inclusivity and DST behavior must be declared for time grouping. “Last 7 days” should resolve to a concrete time window with timezone/as-of in the request; do not let each component choose a different now.

Time aggregation and visual downsampling are different. Downsampling may simplify a drawn line but cannot rewrite totals, uncertainty bands, tooltips pretending to be exact, or raw-data exports. Gaps cannot be connected as continuous known measurements without a declared interpolation policy.

## Relations and cross-filtering

Relations declare source/target entity keys, direction, cardinality, optionality, and supported propagation. Example Provider→Model is one-to-many; Model→BenchmarkResult is one-to-many; Model+Benchmark+Version identifies comparable result scope. Many-to-many joins need an approved bridge and aggregation grain; do not infer them from names.

A selection event carries entity refs or a stable selection expression, not DOM indices. “Select all filtered” on a remote dataset is predicate+snapshot/exclusions with server support; it is not the loaded page's IDs disguised as everything. Drilldown specifies the new grain and relation path. Cross-filtering different datasets without a relation is a validation error.

## AI-model demonstration domain

Support the earlier ten entities through application descriptors: Provider, Model, Pricing, Capability, Modality, ModelLimit, Benchmark, BenchmarkResult, Release, Availability. Do not bake them into core. Pricing and benchmarks need effective/version context. Benchmark scores from different suites or methodology versions do not become a universal quality score. A combined index requires an explicit user-approved formula, weights, normalization, and missing-data policy.

The kit's example data is synthetic and marked as such. Actual live prices/releases must be fetched from authoritative data sources and dated independently of framework development. Dataset freshness is a visible property of the example, never implied by a beautiful chart.

## Data-port execution guarantees

Abort obsolete queries and ignore late results with obsolete query/revision IDs. Stable snapshot and subscription cleanup are required. Server authorization applies on every query/action. Query cache key includes principal scope where relevant. A transform result records provenance and input revision; data schemas changing mid-query invalidate or migrate the binding explicitly.

See `evals/data-cases.jsonl` for executable test specifications. The package validator checks their format, not execution against a real DataPort. Implement semantic unit tests and integration tests locally before marking any case passed.
