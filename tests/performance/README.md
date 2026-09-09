# Product performance qualification

`pnpm test:performance:bundles` builds and packs core/runtime/web 0.1.0,
installs the exact tarballs into an independent npm consumer, then bundles
selected browser entry points with the locked Vite compiler. Each run saves
tarball hashes, the consumer lock, retained modules, emitted chunks and their
raw/gzip sizes under `artifacts/performance-bundles/run-*/report.json`.

Budgets come from `docs/12-performance.md`. Standalone incremental builds omit
only Lit packages, retaining all Aeliqo shared platform code; the separate total
builds include Lit. Embedded CSS remains counted in JavaScript. The region
measurement includes exports for local data, result/evaluation/region stores,
query validation, presentation registry and the region/table renderer. Retaining
those exports gives a reproducible byte footprint; it is not proof of a usable
region workload. Actual consumer behavior is verified separately.

The command fails on a size overrun, forbidden retained dependency, source
change during measurement, or build/install failure. It never marks T30 done.
Graph checks prohibit provider/agent/Studio and Node-only modules, and prohibit
runtime/planner/visualization modules in direct component entries. Gzip uses
Node's default compression settings on each emitted chunk.

Still required: functional small/medium/large workload measurements, isolated
cold/warm timing observations and p50/p95, input and layout/paint traces, bounded
DOM/geometry, cancellation and 100-cycle cleanup/heap observations, whole-site
metrics, plus the real lower-powered device specified by chapter 12. Run timing
work without concurrent builds. Do not revise budgets to fit observed results.


## Production workload probes

`pnpm test:performance:browser`
builds the actual packages and a minified Vite production fixture, then serves it
with preview. It checks 100-row controls, 10,000 loaded records carrying all 100
semantic fields, 30 views and 64 distinct presentation candidates, typed draft updates,
and a bounded HTTP window from a synthetic indexed million-record source.
The two display fields supplement those 100 semantic fields. The source is a
local deterministic fixture, not a database capacity benchmark. Content-Length
measures response body bytes, excluding headers and other transport overhead.

The package command forces timing and budget enforcement on. It records 10 initial and 30
subsequent observations on one already-loaded page; these are not cold-cache
measurements. Budgets use actual planner duration and individual dispatch
samples, separately from complete workload duration. Chromium CDP traces retain
script, layout and paint events; inclusive event durations can overlap and must
not be added to claim wall-clock latency. Budget assertions are enforced unless
explicitly disabled with `AELIQO_ENFORCE_PERFORMANCE_BUDGETS=0`; a disabled run
is measurement only and cannot qualify the gate.

`node --test tests/performance/workloads.test.mjs` checks the measurement
calculations after building the packages. `AELIQO_RUN_PERFORMANCE=1 node
tests/performance/runtime-workload.mjs` measures the Node package path and fails
on budget overruns. It does not replace the browser gate. Both commands retain
raw samples. Resource checks exercise ResultStore and Region ownership and
100 component mount/dispose cycles. Heap samples require investigation; a zero
active-resource count does not prove garbage collection.

Still unqualified by these probes: genuine cold/warm cache paths, input-to-paint,
network/server phase breakdown, dense plots and adverse workloads, final
installed-package timing, whole-site metrics, and real lower-powered hardware.
No timing result from this fixture alone marks T30 complete.

The planner reuses pure registered node resolution only within one synchronous
composition and one immutable prepared context. Keys include the full parsed
node, including signed zero; every candidate still passes plan-wide validation.
Wire inspection and public input parsing remain mandatory. The diagnostic
September 9 optimization run measured five Node samples at 76–93 ms on the
development machine. This still exceeds 16 ms and is not an isolated p95 gate.

`pnpm test:performance:standalone`
builds a separate direct input/table entry and rejects retained runtime, planner,
agent and Studio modules. Its default smoke run uses one cold-cache-disabled
fresh context and one cache-enabled reload after warmup. Opt in with
`AELIQO_RUN_PERFORMANCE=1` for ten cold and thirty warm observations. Raw
Navigation, Resource and PaintTiming entries retain unavailable values and
sample counts; cache evidence can be incomplete. Fixture-ready is not paint.
This probe collects diagnostic observations and has no timing-budget pass claim.

Warm-cache evidence distinguishes zero-transfer JavaScript resources, CDP disk
cache hits, and matched request-ID HTTP 304 revalidations. Revalidation still
incurs a request; it is not reported as a cache-only load. Raw CDP observations
retain URLs and status flags, excluding headers and cookies.
