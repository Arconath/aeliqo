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
