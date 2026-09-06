# Smart investigation slice

Status: implemented source and focused unit evidence. Owner: core semantic catalog and React renderer.

## Contracts

`MetricBreakdown` accepts a dataset, snapshot, declared additive or ratio-of-sums metric, and declared dimension. Sum groups are described as contributions. Ratio-of-sums groups are described as a breakdown and recompute numerator/denominator inside each group; percentages are never added. Selecting a group reveals the original contributing records. Workspace uses a separate typed group interaction so a dimension value is never misrepresented as an entity identity.

`EventTimeline` accepts explicit event records and one declared time field. Invalid dates are omitted using the shared temporal parser. Events remain in chronological DOM order. Native select controls emit an inclusive epoch-millisecond `TemporalRange`; pointer and keyboard use the same controls. Copy explicitly says temporal proximity does not imply causality.

`TimeInvestigation` composes the existing Delta, Trend, EventTimeline, and Table implementations. Its semantic node requires a metric, time field, and strict baseline config. Range changes filter the composed record table and current aggregate without inventing interpolation or cause.

`QualityPanel` reports source, snapshot date/version, loaded scope, computable coverage, freshness, field-level missing counts, and application-declared comparison caveats. Missing metadata renders `Unknown`; an errored snapshot renders the actual failure state. It does not synthesize a quality score.

Scatter, Distribution, Relationship, Matrix, and Explorer now have isolated source modules with standalone props and semantic `store`/`node` authoring. Each module shares one view implementation between direct and Workspace rendering. Relationship direct usage requires both sides of the declared relation; it never infers a join from matching field names.

## State, fallback, and accessibility

All snapshot components pass through shared runtime validation and loading, empty, error, partial, and stale disclosure. Selection uses stable IDs. Timeline and range controls are native keyboard controls; scatter marks support Enter and Space; matrix, relationship, ranking, and table use native buttons. Logical CSS properties, wrapping, forced colors, focus treatments, and reduced-motion policy are inherited from the shared stylesheet.

Adaptation callbacks now include an optional deterministic reason code: `container_narrow`, `container_wide`, or `record_density`. These codes describe renderer rules, not model confidence. Container observers disconnect on unmount.

## Evidence and limits

`smart-components.test.tsx` uses a non-AI service-operations fixture. It covers direct usage of all five promoted components, ratio-of-sums breakdown, rejection of mean breakdown, invalid calendar dates, typed range emission, compound composition, unknown versus failed quality state, and Workspace validation/rendering of all four new contracts.

Workspace operation version 1 gained the optional `interact` operation with strict `range` and `group` payloads. Bindings declare `mode: "range"` or `mode: "group"`; core validates producer/receiver capability, same-dataset scope, matching semantic field, revision, and acyclic propagation. Existing selection/filter operations and omitted binding modes remain wire-compatible. Browser screenshots, independent screen-reader review, tarball manifests, and external consumer evidence are separate release gates.
