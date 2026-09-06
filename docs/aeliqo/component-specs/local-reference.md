# Executing local component reference

The playground Documentation tab renders compiled examples from `apps/playground/src/documentation-examples.tsx`. Its source view imports that exact module as text; it is not a separate illustrative implementation.

| Entry | Required inputs | Optional inputs | Evidence scope |
| --- | --- | --- | --- |
| Metric | `value`, `label` | `metric` formatter declaration | Explicit value, null/nonfinite unavailable marker, React SSR |
| Table | `dataset`, `snapshot` | `selectedId`, `onSelect`, `columns`, `title` | Stable identity selection; snapshot failure/partial/stale disclosure |
| Filter | `dataset`, `filters`, `onChange` | `title` | Controlled committed filters; local draft; finite numeric validation |
| Ranking | `dataset`, `snapshot`, `metric` | `direction`, `limit`, `dimension`, `title`, `selectedId`, `onSelect`, `onAdaptation` | Deterministic sorting/density; controlled stable-identity selection |
| Trend | `dataset`, `snapshot`, `metric`, `timeField` | `seriesBy`, `title` | Explicit temporal parsing; semantic aggregation and missing gaps |
| Detail | `dataset`, `snapshot` | `selectedId`, `columns`, `title` | Selected entity projection; explicit empty selection prompt |
| Comparison | `dataset`, `snapshot`, `metrics`, `selectedIds` | `onSelectionChange`, `title` | Controlled comparison of 2–8 identities; separate metric rows preserve units |

Existing semantic `store`/`node` props continue to route through the same component implementation. Source APIs remain authoritative while this 0.x local proof evolves.

All five local package manifests use version **0.2.0**. They remain private artifacts; this version does not imply publication or an approved license. Comparison's semantic form uses `node.compareIds` and metric `node.columns`; each metric is displayed independently across entities. Fewer than two selected identities prompts for comparison selection. Counts, ratios and currencies do not combine into a mixed-unit total.

| Semantic view | Contract / user task | Interaction and adaptation |
| --- | --- | --- |
| Ranking | Dataset plus metric; ordered entity comparison | Keyboard selection; missing values last; compact bars retain text |
| Trend | Metric plus declared time field; period comparison | UTC month/date/instant geometry; missing observations remain gaps; responsive ticks |
| Detail | Dataset and semantic selected identity | Explicit related entity resolution; accessible definition list; no arbitrary relation fanout |
| Scatter | Two distinct metrics; trade-off exploration | Shared selection, keyboard point list and compact annotations |
| Distribution | One metric; inspect range and spread | SVG histogram with text summary; container-dependent bin density |
| Relationship | Explicit dataset relationship | Selectable source entities and responsive relationship metadata |
| Matrix | Declared metric columns; feature comparison | Semantic table, selection, compact labels; missing differs from false |
| Comparison | Dataset plus metric; summary beside ranking | Reuses Metric and Ranking implementations |
| Explorer | Dataset plus metric; collection and inspection | Reuses Ranking/Table and Detail, with local representation selection |

All semantic views use the shared DataPort snapshot path and dataset contract. Loading, empty and error presentation is shared; partial and stale warnings remain visible where relevant. Workspace props include trusted renderer registration for custom capabilities. Primitive examples, compound examples and Showcase use these same implementations; no agent-generated rendering code is accepted.

## Migration

Currency formatting now requires an explicit supported currency code, including direct Metric use. It never defaults an undeclared currency to USD. Cross-dataset selection requires a declared relationship even when both datasets name the same entity; disconnect an old link when switching a node to an incompatible dataset. Receipt contract version 0.2 is defined by the executing core schema, separately from version-1 workspace operations and the blueprint's candidate schemas.

Existing sum, mean and none aggregation declarations remain valid. Ratios use `aggregation: "ratio-of-sums"` with an explicit numerator, denominator, `zeroDenominator: "null"` and `missing: "exclude-pair"`. Numerator and denominator reference compatible additive measures. This bounded implementation does not support arbitrary expressions, cross-currency conversion or an exact monetary ledger.

Use `metricValue(record, metric)` for derived values, pass a MetricField to `compareMetricRecords`, and pass the dataset as the third argument of `filterRecords` when derived filters are required. Two-argument filtering preserves its previous raw-field behavior.

## Time fields

`Field.temporal` distinguishes `month`, `date` and `instant`. A month is `YYYY-MM`; its UTC first-of-month coordinate represents the month, not an inferred day-level observation. A date is an actual calendar `YYYY-MM-DD`; invalid dates such as 2026-02-30 are unavailable, not silently rolled into March. Legacy timeFields without the optional declaration retain ISO month and date behavior. Declare `month` explicitly to preserve month-grain labels. No meaning is inferred from field names.

`parseTemporalValue(value, field)` returns a finite epoch coordinate or null. Instants require `YYYY-MM-DDTHH:mm:ss`, optional one-to-three millisecond digits, and an explicit `Z` or numeric offset. Offset-free local timestamps, leap seconds, and 24:00 rollovers are unsupported. Equivalent instants compare equally even when source offsets differ. `formatTemporalValue(coordinate, field)` emits a month label, date-only label, or UTC ISO instant label according to the declared policy. This bounded policy does not implement IANA timezone calendar grouping, fiscal periods, or implicit interpolation across gaps.

## Human controls and linked filters

Apply `{ type: "pin", id, pinned: true }` from a human control to protect a node. Agent control cannot pin/unpin, undo/redo, or mutate protected content. Permissions come from trusted dispatch context, not an agent-supplied actor flag. Human callers can unpin deliberately.

Apply `{ type: "undo" }` or `{ type: "redo" }` as a single-operation request against the current revision. History is bounded to 50 presentation snapshots; restoring a prior state increments the current revision rather than resurrecting a stale revision. A new successful edit clears redo history. Draft input remains local and is not serialized into history.

Bindings with `mode: "filter"` explicitly connect a compatible filter producer to a consumer. The implemented filter link is same-dataset; it is not an inferred cross-dataset join. Ordinary selection links remain selection links. Components read effective workspace filters through the store rather than duplicating filter state.

## Presentation persistence

`serializeWorkspace(store)` returns the bounded version-1 presentation document. `restoreWorkspace(serialized, { dataPort, registry? })` validates it against current application data and capabilities and creates a new runtime. The host chooses where to store that string. Source records, credentials, revisions and undo history are excluded. A saved selection that no longer exists is rejected; restore does not invent missing business data. These helpers do not implement database persistence or collaborative merge.

## Local distribution and support

`pnpm check:packages` builds private ESM/declaration artifacts, packs and installs them into a consumer, runs NodeNext type checks and React SSR for all eleven direct components, and records standalone Metric bundle isolation in `artifacts/package-evidence.json`. Third-party dependencies are linked from the existing installation offline. This is not fresh-registry-install or full Next.js evidence. See [the completion matrix](completion-matrix.md) for all seventeen implemented UI surfaces and their distinct evidence boundaries.

Package names and versions are provisional; no public npm install is promised. License selection, independent developer onboarding, production promotion, and commercial demand remain separate gates. WebMCP remains experimental; deterministic BYOK tests do not establish a successful real-provider run.
