# 23 — Catalog waves and maintenance economics

The catalog records **needs**, not hundreds of finished components. Entries can map to a shared implementation, a named variant, a behavior utility or a recipe. Do not create an npm package or public API for every row. Do not count tokens/theme utilities as shipped smart components in marketing.

W1: foundational slices required for Metric/Table/Ranking/Trend/Detail/Filter and early semantic comparison. W2: composition, richer interaction and broadly recurring data-app needs. W3: domain-dependent visual/control expansion after the first workflows are stable. W4: demand-gated advanced/commercial candidates; no implementation authorization merely because an entry exists.

Promote a need only when the task is distinct, evidence exists from the current recipes or external adopters, existing variants do not serve it cleanly, a maintainer can support it, and contract/a11y/performance/docs tests can be afforded. Merge near-duplicates into variants where the semantic task and interaction contract are identical. Split only when data meaning or behavior differs enough to justify a separate contract.

For first public beta, finish the G2/G3 task workflows—not every W1 utility as an exported product. W2/W3 additions need their own acceptance evidence. W4 candidates require paid-demand validation before expensive engineering.

Each catalog entry identifies task, minimum data, allowed adaptation, forbidden semantic shortcut, fallback and a focused test requirement. Use `templates/component-spec.md` to turn a promoted need into an implementation-ready specification. State starts as `proposed`; local audit may identify an existing implementation and update it to `characterized` or `verified` only with source and evidence.

Maintenance cost is recorded per promoted component: owned behaviors, complexity of data contract, browser/a11y surface, dependencies/bundle cost, docs/examples and expected support. A wide but unmaintained catalog is a liability, not a competitive advantage.
