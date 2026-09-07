# 33 — Performance architecture and experiment protocol

All budgets are design targets. No microbenchmark in the kit is called a product benchmark.

## Critical-path ownership

| Path | Owner | Required avoidance |
|---|---|---|
| Standalone input/control | web controller | no planner/catalog/model allocation |
| Local selection/hover | affected component/runtime reducer | no whole-region query or full rerender |
| User filter/page | parameter controller + negotiated executor | no scan of arbitrary source without budget |
| New language goal | agent host + binder | no full catalog/records prompt dump |
| Initial presentation | predicted descriptor + registry | no wait for all raw rows to draw truthful loading |
| Result updates | result store + dependency indexes | no whole-array copies per cell/event |
| Resize/text/locale | local measurement; structural planner only if needed | no model call, no resize-observer feedback loop |
| Rendering dense geometry | pure geometry + bounded SVG/Canvas | no per-point component tree or hidden million-node AT tree |
| Teardown | owning leases/controllers | no delayed callback that can still commit |

## Complexity contract

Index catalog IDs and role/capability metadata once per registry revision. Invalidation follows the affected dependency subgraph. Output DAG sort/validation should be linear in nodes+edges within configured bounds. A candidate budget bounds composition work but says nothing about theoretical optimality. Query data complexity is separate: grouping is normally linear in observed complete rows, sorting has its own cost, joins require declared cardinality and pushdown. Do not hide an O(rows × views) scan inside each component.

A shared web implementation is not automatically smaller/faster than native React. Measure marginal and total Lit, bindings, CSS, planner and runtime cost. Benchmark direct native controls versus the shipped wrapper on the same task. The selected stack must earn its place through the early platform gate.

## Workload matrix

Small: standalone Button/Input/Metric, 100-row table, 50-point plot. Medium: 10k loaded records, 30 linked views, 100 semantic fields, 64 candidate expansions. Large: million-row backend source with bounded outputs, 10k-entity metadata catalog with paged discovery, high-cardinality graph expansion, and a slow source. Adversarial: long localized labels, 200% text/400% zoom, null-heavy values, rapid parameter changes, changing policy, many series, request cancellation, output arrival reordering, and 100 mount/dispose cycles.

A large source does not mean downloading it to prove capacity. Test backend scanned rows/bytes and client transferred rows/bytes separately. Sampling/aggregation may be authorized data semantics or a geometry-only realization; label them differently.

## Measurement protocol

Pin source SHA, built tarball hashes, browser build/OS, CPU/RAM, power mode, display/DPR, fonts, locale, viewport, workload seed and network fixture. Measure cold and warm cases. Record raw observations and warm-up exclusion; choose repeats before measuring. Summarize median/p95 and uncertainty/noise. Keep benchmark jobs isolated from concurrent builds/subagents; resource contention is not a compiler regression.

Use browser traces for script/layout/paint/composite; field Web Vitals for actual pages; query tracing for backend; explicit spans for model/semantic/planner stages. A renderer callback or requestAnimationFrame is not an exact paint meter. No stopwatch around setState presented as input-to-paint. Input/cancel responsiveness matters independently from total task completion time.

## Caches and invalidation

Separate compiled-expression cache, accepted-plan cache, authorized result leases and presentation candidate cache. Keys include every semantic input read: policy/scope, catalog/function/definition versions, query parameters, resolved calendar/time, profile and renderer capabilities, result quality/stats as relevant. A cache hit never resurrects a revoked lease. Cached UI is not cached authorization. Test a changed field permission/profile/function digest while other inputs remain identical.

## Streaming and worker budgets

Bound outstanding batches and bytes; explicit backpressure. On cancellation stop owning consumption, abort downstream, free buffers and ignore late messages. A source that cannot cancel reports that limitation; detached work cannot commit to a disposed region. Workers have max concurrency and cooperative yield; avoid using them for trivial controls where transfer overhead dominates.

## Release criteria

Keep initial numerical budgets in docs/12 as the one budget table. Store measured reports in source-bound evidence. Regression review compares identical tasks/environment and checks meaning/operation preservation. Do not improve benchmark scores by dropping columns, reducing answer population, suppressing gaps, disabling a11y, skipping observers, hiding errors or loosening the visual diff mask.

## Experiments shipped with the kit

Reference TypeScript guards/type probes and Python/SQLite semantic cases establish bounded counterexamples only. They do not load Lit, render a component, run a provider, or measure enterprise throughput. Port their vectors into production tests; then execute this full matrix.


## Executed search counterexample (reference only)

An initial reference beam consumed its 64-expansion budget on 120 sibling candidates (30 alternatives for each of four needed operations), without completing an easy four-view composition. The Master consolidation reference now seeds a feasible greedy path first, preserving deterministic preference/constraint filtering; the regression completes in four expansions. This does not prove optimal layout or full graph/a11y feasibility. The production planner may optimize a valid incumbent with bounded search, but must not starve all complete solutions while enumerating siblings. Candidate-scan work is still measured separately; expansion caps alone do not bound input parsing/indexing cost.
