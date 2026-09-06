# 14 — Performance targets and evidence

## Status

The following are **initial engineering targets**, inherited/refined from the blueprint, not measured outcomes of this kit or PoC. A budget becomes a release gate after baseline hardware/workload and measurement method are recorded. Never raise it to conceal a regression; changes require reason and evidence.

| Metric | Initial target | Scope |
|---|---|---|
| Browser headless core | ≤25 KiB gzip | Production standalone import including shipped runtime deps |
| Components-only provider/MCP SDK overhead | 0 bytes | No required transport/model code |
| Metadata patch validation+commit | p95 ≤4 ms | 20–100 nodes, ≤10 small ops, prepared modules, named device |
| Warm small UI patch to observable update | p95 ≤100 ms | Excludes separately reported model/network/data/download wait |
| Field INP | p75 ≤200 ms | Whole example app, mobile and desktop separately |
| Pointer interactions | Fit device refresh budget | Frame-time distribution/jank, not an unsupported universal 60 fps claim |
| Cleanup | No sustained retained-growth trend | Repeated lifecycle with documented GC/measurement procedure |

INP threshold is public web-performance guidance; other numbers are our hypotheses. INP is not a per-component guarantee or the same as every interaction latency. [R14]

## Benchmark workloads

B01 import/parse/execute: Metric, Table, Trend, Workspace and optional adapters separately. B02 100k logical table rows with 20 columns, virtualization, filtering/sort; report rendered DOM count and query cost separately. B03 50k raw trend points with resize/brush; report exact analytics versus display sampling. B04 16 linked panels with one shared filter and one actively edited form. B05 500 mount/unmount/reconnect cycles. B06 concurrent user/agent patches with stale revisions. B07 docs article versus interactive playground hydration.

## Current local B02/B03 evidence

The 2026-09-06 production-preview run on Apple M4 Pro and Playwright Chromium 153 used seven warm samples after one warm-up. B02 rendered 100,000 logical rows with 20 columns, one filter and a descending metric sort into 23 table rows and 519 total fixture elements. Warm observable time was 34.0 ms median and 35.7 ms p95; an equivalent filter/sort preparation measured separately at 11.2 ms. End-key navigation reached the final virtual row and Enter kept the semantic selection path operable.

B03 retained exact analytics across 50,000 raw one-minute points while drawing a disclosed 793-point sample in one SVG path. Its accessible description used all points for minimum -999, maximum 999, latest 4 and 51 missing measurements. Warm observable time was 65.4 ms median and 65.5 ms p95. Twenty-five alternating mount/unmount cycles left an empty fixture DOM after every unmount; forced-GC heap samples grew by 10,504 bytes from the first to last sample against the fixture's 8 MiB investigation limit.

The raw samples, environment, lockfile and implementation hashes, script/layout/paint event totals, rendered counts and limitations are in [`docs/evidence/performance-scale.json`](../evidence/performance-scale.json). Reproduce and deliberately replace the recorded artifact with `AELIQO_RECORD_EVIDENCE=1 pnpm exec playwright test tests/performance-scale.spec.ts` after a production build; ordinary test runs verify behavior without silently replacing the accepted timing baseline. This is evidence for one local Chromium workload, not a field-INP or cross-device guarantee. Typed range behavior is tested through core, component, persistence, and cross-browser keyboard workflows; the 50k-point timing fixture still measures its fixed viewport separately from range interaction cost.

Counts define stress fixtures, not marketing support limits. Remote data cases measure network separately; local sorting cannot be hidden by claiming virtualization solves it. Virtualization limits rendered elements, not dataset computation. [R11]

## Measurement method

Record commit, lockfile hash, build mode, browser/version, OS/device/CPU/memory, viewport/DPR, network mode, data shape/seed, repetitions, warmup and sampling. Use production bundles; compare identical functionality and output semantics. Report median/p95 and variability with raw samples, not one favorable run. Cold and warm runs are separate. Software CPU throttling supplements, not replaces, a real constrained device.

Measure marks for request received, schema/semantic validation, preparation, commit, renderer acknowledgment, data ready, and browser observable outcome. An animation-frame callback is not proof of completed paint; browser traces/e2e observation support that measurement. Queue latency is not presentation latency.

## Core techniques

Normalized store with stable per-node snapshots; dependency-scoped notifications; structural sharing; bounded derived caches. Keep hover/drag transient state local. Separate synchronous semantic validation from expensive query preparation. Cancel obsolete jobs, cap queues and coalesce presentation bursts without dropping business events.

No deep-copy/stringify of full datasets on each update. No eager registry barrel importing all charts. Heavy grouping/sort moves to DataPort/server or Worker only after profiling. Transferring a buffer can detach its original owner; document ownership and never detach application-owned data unexpectedly. Main-thread task splitting and read/write batching address actual traces, not decorative memoization everywhere.

## React and CSS caveats

A rerender is not identical to a DOM mutation or layout. Measure where the time goes. External-store changes must honor React snapshot semantics; `startTransition` is not a cure-all. React Compiler, when adopted, is an optimization tested on/off and with dependencies; it cannot fix an unbounded query or global invalidation design. [R08]

CSS containment/content visibility/Canvas/Workers are situational. Each can affect focus, overflow, searchability, transfer cost, text/accessibility or measurement. A performance optimization must retain the same user-visible semantics and accessibility fallback.

## Regression policy

CI can enforce deterministic bundle-size/import rules and core microbenchmarks on controlled runners. Browser p95/jank budgets require stable test conditions; rerun noisy measurements before labeling regression. Suggested investigation threshold: >10% sustained regression on a stable baseline or a hard functional budget violation. Never use timing tests with flaky millisecond equality.

Publishing “faster than X” requires equivalent workload, exact competitor version/config/license, raw results and disclosure of missing features. The current kit makes no speed superiority claim.
