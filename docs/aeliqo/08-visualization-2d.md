# 08 — 2D visualization system

## Layering

Build reusable marks, scales, axes, legends, annotations, selection/brush behavior, and renderer adapters. Product-level charts compose these primitives; end users should normally choose a task-oriented chart rather than assemble a mark grammar manually. D3 supplies modular geometry/scales/shapes/layouts and supports different rendering systems; it is not a replacement for our semantic model, design, or accessibility layer. [R09]

Use explicit mark/encoding/channel types. Position, color, size, shape and opacity have semantic constraints. A color legend must state whether values are categorical, ordered, diverging or sequential. A log scale cannot silently accept non-positive values. Baselines, truncation, missing intervals and uncertainty have visible treatment. Animation must never conceal a change in scale or time window.

## Ownership and renderers

React owns React DOM/SVG. D3 computes coordinates/paths; do not let D3 selections independently mutate the same nodes. Optional Canvas rendering owns one isolated surface, with accessible controls, summary and data-table alternative outside it. Switching renderers must preserve semantic selection, axis domains, user zoom policy and entity identity.

Default to SVG for initial reference visuals. Introduce Canvas when measured workload demonstrates an advantage; no universal “over N points means Canvas” rule. Hit-testing, pixel density, text metrics, offscreen processing and accessibility can dominate Canvas cost. Keep D3 module imports scoped; a small Metric/Table must not import chart geometry.

## Chart families and required questions

Comparison: bar/ranking, dot plot, scatter, bullet/target, slope. Temporal: line/area/step, event timeline, range band, small multiples. Distribution: histogram, box plot, quantile/density summaries. Composition: stacked bars/area/treemap when parts have compatible totals. Relationship: heatmap/matrix, tree/network, Sankey only with defined flow meaning. Geographic 2D: point/choropleth only with a licensed, explicit geography dataset. Specialized families are discovery candidates, not first-release promises.

A Table or Detail fallback is always useful but cannot silently claim to answer an unsupported visual question. For one time observation, say “not enough observations for a trend” and show the point; do not claim a trend was produced. For incomparable benchmark suites, facet or request a metric rather than produce a spurious ranking.

## Adaptive planning

Hard eligibility filters: semantic role/unit/grain, metric comparability, required fields, container constraints, accessible interaction, allowed variants, available renderer. Then choose among valid forms using task fit, density, user preferences and cost. Preserve explicit user choice unless impossible; report the reason and available alternatives.

Reduce ticks/label detail before restructuring. For high cardinality, virtualization/scroll, faceting or explicit top-k policy are options. Top-k needs a visible coverage statement, global versus page scope, ties policy and access to omitted results. A compact screen must not silently remove outliers or low-frequency groups.

## Sampling and aggregation

Sampling for draw performance is renderer-specific derived data. Aggregation changes analytical grain and requires semantic approval. Keep accurate aggregate/raw source paths separate from display samples. A sampled line's tooltip must identify approximation or resolve exact source value on demand; export must state which representation is exported. Outlier-preserving sampling and confidence-band semantics need workload tests before claiming fidelity.

## Input and interaction

Brush emits typed ranges with field/unit/timezone/inclusivity. Point selection emits stable entity keys. Zoom changes view domain unless user explicitly requests a new query. Brush-to-filter is a configured link, not an automatic global side effect. Keyboard equivalents support moving among relevant observations, selecting, clearing, drilling and inspecting details. Tooltips appear on focus as well as hover; essential values cannot depend on hover alone.

## Proof requirements

For every visual: identical semantic result in table alternative; empty/null/single-point/outlier/log-invalid/large-label cases; resize and direction changes; color-independent encoding; reduced motion; linked selection parity; accurate unit/time/grain labels; production bundle report; mount/unmount cleanup; renderer switch conformance if more than one renderer exists.

Vega-Lite already demonstrates compositional visualization grammar; our novelty is not inventing chart JSON. Reuse established concepts and test the extra value of consistent data/workspace contracts and ready-made product UX. [R29]
