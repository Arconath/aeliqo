---
name: aeliqo-performance-a11y
description: "Use for interaction latency, bundle size, worker/Canvas decisions, layout jank, memory, keyboard/focus, screen reader or release-quality regressions."
---

# Measure performance and accessibility

## Scope

This skill is repository-local. Read applicable AGENTS instructions first; use this workflow only for the matching task. Do not install global skills/plugins or load every other Aeliqo skill.

## Read only what this task needs

- [13-css-tokens-motion.md](../../../docs/aeliqo/13-css-tokens-motion.md)
- [14-performance-and-benchmarks.md](../../../docs/aeliqo/14-performance-and-benchmarks.md)
- [15-accessibility-quality.md](../../../docs/aeliqo/15-accessibility-quality.md)
- [16-test-strategy.md](../../../docs/aeliqo/16-test-strategy.md)

## Workflow

Establish a reproducible production baseline with browser/device, dataset/workload, cold/warm state, sample count and traces. Separate model/network/data wait from validation/commit/render/layout/paint. Targets in the kit are proposed budgets, not achieved measurements. Avoid tuning benchmark-only code paths or relaxing budgets to get a green report.

Profile before changing architecture. Prefer stable subscriptions, local pointer state, bounded query/geometry, optional imports and CSS container layout before Workers/Canvas/WASM. Measure serialization/copy and cleanup costs. Check that CSS survives tree shaking and server/provider code cannot enter component bundles.

Test keyboard and focus flow, reduced motion, zoom/reflow, forced colors, RTL and screen-reader alternatives. Automated axe checks do not establish full accessibility. Virtualization/Canvas must retain useful navigation and data alternatives; do not label hidden inaccessible output as a performance win. Review screenshots and traces of composition, not only individual controls.

Report regressions, reproducible conditions and residual risks. Real-harness routing and business adoption are separate evidence, never implied by a fast benchmark.

## Completion evidence

Recorded baseline/delta, workload and profiler artifacts; package checks; keyboard/manual a11y evidence; memory/cleanup test; untested devices and tooling limits explicit.

Report checks actually executed and their results. A schema, plan, screenshot, or mocked adapter proves only its own scope. Preserve user changes and record concrete blockers without inventing completion.
