---
name: aeliqo-data-semantics
description: "Use for currency, units, ratio/aggregation, field binding, filters, query scope, timezones, relations, pagination, provenance or data adapter changes. Not to research real model prices."
---

# Preserve data meaning

## Scope

This skill is repository-local. Read applicable AGENTS instructions first; use this workflow only for the matching task. Do not install global skills/plugins or load every other Aeliqo skill.

## Read only what this task needs

- [05-data-semantics.md](../../../docs/aeliqo/05-data-semantics.md)
- [08-visualization-2d.md](../../../docs/aeliqo/08-visualization-2d.md)
- [16-test-strategy.md](../../../docs/aeliqo/16-test-strategy.md)

## Workflow

Name the dataset key, grain, units, population scope and authority. Identify whether the source supports the required query or whether only a loaded page exists. Do not infer business meaning from field names or register capabilities that no adapter implements. Keep original rows/cache ownership in the host application.

Define exact expected results with tiny synthetic examples before optimizing: mixed-currency rejection/grouping, ratio of sums, zero denominators, missing versus zero, partially loaded population, datetime versus date-only, and one-to-many joins. Intl formatting changes appearance, not currency or arithmetic. Any conversion requires an explicit rate source, effective timestamp, rounding policy and disclosed result.

Implement type/capability checks and cancellation through DataPort. Remote aggregation remains server-authorized. Use bounded caching and preserve data revision/provenance. Sampling may optimize drawing but must not change analytic result or raw export. Treat statistical anomalies as observations, not causal claims. Include a valid degraded path when data is incomplete.

## Completion evidence

Exact semantic fixture results; negative cases; partial-scope UI copy; authorization/cancellation checks; no hidden unit conversion or new duplicate data store.

Report checks actually executed and their results. A schema, plan, screenshot, or mocked adapter proves only its own scope. Preserve user changes and record concrete blockers without inventing completion.
