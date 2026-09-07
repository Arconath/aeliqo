# 12 — Performance budgets and proof

All numbers below are **initial design budgets**, not measured results. Adjust only through a documented benchmark/review showing a better correctness/experience tradeoff. Never label the entire product fast because a small reducer runs in microseconds.

## Three workloads

**Small:** one standalone value/control and a 100-row table; no semantic runtime/model/Studio dependency. **Medium:** 10,000 loaded rows, 30 views, 100 candidate semantics and linked interactions. **Large:** application-backed million-row source, but bounded server queries/cursor windows and bounded visible geometry; do not load the whole source merely to demonstrate capacity.

Record CPU/RAM/OS/browser/version/DPR/power/viewport and whether throttling is synthetic. Use a named repeatable CI runner plus one real lower-powered mobile-class device before final signoff. Emulator throttling alone is not mobile hardware evidence.

## Initial budgets

| Operation | Target on recorded reference environment |
|---|---|
| Standalone core value/control incremental JS | <= 15 KiB gzip excluding shared Lit runtime; report total including Lit too |
| Standalone data table incremental JS | <= 40 KiB gzip excluding shared platform runtime; no planner/agent/chart imports |
| Core planner + validation lazy entry | <= 70 KiB gzip initial target; no provider/renderer dependency |
| Initial interactive region + standard table path | <= 160 KiB gzip total JS excluding host React, with chunks disclosed |
| Presentation planning for 30 views / 64 candidate expansions | p95 <= 16 ms; yield/worker before prolonged main-thread work |
| Targeted parameter/selection reducer | p95 <= 4 ms; zero unrelated view invalidations in isolation tests |
| Simple local input-to-next-visible-update | p95 <= 100 ms in the tested app workload, not including remote/model wait |
| Large table | bounded viewport + overscan, target <= 100 mounted row elements on the reference fixture |
| Dense plot | explicit mark/geometry budget; no unbounded per-row DOM or hidden accessibility nodes |
| Runtime cleanup | no growing active handles/listeners after 100 mount/dispose cycles; heap trend investigated |

For web app field metrics, target good Core Web Vitals (LCP <= 2.5s, INP <= 200ms, CLS <= 0.1 at p75) on measured host pages; these are whole-page targets, not library-only guarantees. [S14]

## Separate timings

Report language/model latency, semantic binding, query planning, network/server execution, transfer/parse, result validation, presentation planning, DOM/template work, layout, paint/compositing and input delay. `requestAnimationFrame`, a React/Lit callback, or renderer-ready receipt is not a direct paint measurement. Use browser traces for layout/paint evidence and real interaction metrics for perceived latency.

## Architectural controls

Do not put LLM calls on hover, typing, selection, chart brush or resize paths. Cache validated catalog fragments and canonical compiled expressions. Memoize by semantic identity and revision, not shallow accidental object equality. Use structural sharing and fine-grained subscriptions. Separate data freshness from presentation revision. Coalesce burst updates; stale requests cannot commit.

Push down large aggregates/sorts. Require complete inputs for exact local residual queries. Default local processing budgets should be conservative (for example 10,000 records or 8 MiB unless explicitly configured), but they are transparent safety/performance limits, not paid entitlement caps. Abort or return a capability gap instead of freezing the tab.

Workers are bounded pools; tiny work stays synchronous when faster. Transfer data without repeated whole-array clones where feasible. Data retention/TTL, worker termination and observer cleanup are explicitly instrumented.

## Visual geometry

Downsampling may bound geometry while exact summaries remain based on complete authorized data. Preserve extrema, gaps and selected points according to a documented algorithm. Show sample scope. Never create a smooth line across missing observations or hide rare events to fit a point budget. When accuracy cannot coexist with geometry limits, provide a safe alternative instead of a misleading plot.

## Packaging proof

Measure built published-style tarballs in external consumers, including parsing/execution cost and CSS, not source bundle guesses. Check component subpaths and dynamic chunks. No barrel that imports all charts/agents/Studio. Explicitly include/exclude host framework dependencies in every comparison. Node/server/provider code must be absent from browser graphs.

## Regression policy

Compare median and p95 over enough repeated runs; store raw observations and noise limits. Investigate meaningful regression against a controlled baseline; never widen budgets just to make CI green. Include adverse cases: 1,000 categories, long labels, null-heavy data, large selected sets, stream cancellation, slow network and repeated container oscillation.

## Pixel-perfect qualification

Visual QA uses approved reference compositions and component states in a pinned environment, plus reviewed cross-browser/OS variation. No marketing promise of universal byte-identical pixels. Never blanket-mask entire components, auto-accept snapshot updates, or disable animations globally without separately testing reduced-motion and intended motion behavior. [S12]

## Master consolidation end-to-end cost and critical path

Budget the entire pipeline and resource ownership, not only isolated functions. Schema discovery, model context preparation, backend scan, transfer/parse, multioutput buffers, compiler expansion, stylesheet/layout, geometry, AT alternative and receipt handling all contribute. An unused package that is downloaded/parsed still costs time even if tree shaking removed most execution.

Production evidence must include cold and warm paths, request concurrency, input adversarial shape, large catalog discovery, source latency, cancellation storms, source revisions, repeated mount/unmount and frame/input timing. Decrease benchmark job parallelism to reduce noisy measurements without decreasing reasoning effort. Initial budgets remain unchanged until measured; no benchmark from a small reference probe proves them.

Avoid global policy/manifest rescan on selection; retain dependency indexes and profile digests. Avoid recompilation on paint-only updates. Batch/cursor/preload strategy is orthogonal to task population. Catalog paging/context selection prevents sending 10,000 field descriptions to every model call. No unconditional per-click model call or full-result JSON serialization.

See [performance experiments](33-performance-experiments.md) for workloads, instrumentation, raw observations, statistics and acceptance workflow.
