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

The probes below now cover bounded small/medium/large fixtures, cold/warm
navigations, keyboard/DOM observations, cancellation and 100-cycle lifecycle
checks. Their functional passes do not close timing or device qualification.
Planner p95 still exceeds 16 ms; actual input-to-paint, whole-site field metrics
and the real lower-powered device specified by chapter 12 remain open. Run
timing work without concurrent builds. Do not revise budgets to fit results.


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

This combined workload fixture does not qualify genuine cold/warm cache paths,
input-to-paint, network/server phases, installed-package timing, whole-site
metrics or real lower-powered hardware. Separate cold/warm and adverse probes
are described below; their observations do not mark T30 complete.

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


## Interaction and heap observations

`pnpm test:performance:perceived-input` measures two trusted keyboard inputs in a
production direct input/table fixture. Every sample starts from the same 100-row
state and checks actual rendered filtered row identities. Set
`AELIQO_RUN_PERFORMANCE=1` for 30 observations. DOM mutation delay includes the
time from the keyboard event timestamp; it is not a paint timestamp. Browser
Event Timing data is retained when available; missing or threshold-censored
entries are never replaced by zero. No input-to-paint budget is qualified.

`pnpm test:performance:heap-lifecycle` observes ten input/table mount/dispose
cycles with requested Chromium garbage collection. Set
`AELIQO_RUN_HEAP_LIFECYCLE=1` for ten batches totalling 100 measured cycles and
the separate runtime resource cleanup probe. Each report retains individual
[CDP heap fields](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-getHeapUsage),
missing-field metadata, a stated sum of live heap/backing-storage fields,
DOM/listener counts, and a held-then-released allocation control. Allocator
capacity is reported separately. Instrumentation uses weak references and prunes
dead targets; listener counters do not model automatic once/AbortSignal removal.
These observations do not establish a leak verdict or a universal heap budget.
Run extended observations without concurrent builds and retain environment data.

## Adverse cases

`pnpm test:performance:adverse-runtime` exercises built ResultStore/RegionStore
exports with an in-process adapter: a slow source, a16-request superseding
sequence, non-cooperative outstanding reads delivered after return/disposal,
independent source revisions, and pending authorization disposal. Its report
separates adapter-suppressed events from values actually delivered late to the
runtime. It asserts retained rows/buffers, closed sources and observers. This
is not an HTTP, backend, heap/GC or timing-budget qualification. Set
`AELIQO_ADVERSE_RUNTIME_OUTPUT` to save its raw JSON observations.

`pnpm test:performance:adverse-visualization` runs actual production elements
in Chromium with1,000 categories, long localized labels,250 missing values,
1,000 host-selected identities and40 size oscillations. It checks null gaps,
bounded internal/document geometry, exact paged data alternatives and selection
retention through all40 pages. Raw mutation-to-DOM-plus-forced-layout times
are observations, not paint timestamps or a performance-budget pass. The
configured desktop fixture does not replace real mobile-device qualification.

## Preserved observations

Source-bound reports are in `harness/evidence/t30/ea7957d-extended-browser`
(30 trusted keyboard inputs, 100 lifecycle cycles, 10 cold/30 warm navigations)
and `harness/evidence/t30/0d00a01-adverse-probes` (late-source delivery and
dense visualization). Missing Event Timing values and raw heap trends remain
visible in those reports. No input-to-paint or leak verdict is inferred from
DOM update timing or zero open resource counts.

The snapshot and tie-serialization experiments did not improve the planner
budget. Their patches and paired raw observations were preserved under
`harness/evidence/t30/0a6ac0b-snapshot-experiment` and
`harness/evidence/t30/91731d9-tie-memo-experiment`; both experimental source
changes were reverted. The required planner budget remains unchanged.
