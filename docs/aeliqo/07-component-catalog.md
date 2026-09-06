# 07 — Component needs catalog

**118 distinct logical needs**, not 118 implemented components or npm packages. Every entry is proposed until local source/tests demonstrate otherwise. W1 includes foundations and controls required by the first vertical slice; do not build every W1 row before proving that slice. Prefer existing PoC behavior and audited control foundations over reimplementing keyboard/focus state machines.

A broad catalog is a coverage map, not a promise to ship everything. L0 foundations are not a fourth product smartness level. L1/L2/L3 are primitive / semantic compound / workspace. Recipes need not become new public abstractions. W3 needs domain evidence; W4 requires paid demand and a separate licensing decision. Keep basic links, a11y, performance, and self-hosting OSS.

Wave counts: W1 = 53, W2 = 41, W3 = 19, W4 = 5.

The machine-readable source, including minimum data, allowed adaptation, forbidden shortcut, fallback and acceptance condition for every item, is [catalog/component-needs.json](catalog/component-needs.json). Use the [component spec template](templates/component-spec.md) before implementation.

Current implementation status is tracked separately in [component-specs/completion-matrix.md](component-specs/completion-matrix.md). The planning catalog deliberately keeps every entry at `proposed_need_not_implemented`; it must not be counted as shipped source.

## Admission and completion

A need is admitted only with a real task, a distinct contract not already covered by a variant/recipe, a reuse story, clear data semantics, accessibility fallback and bounded performance. A component is completed only with source, tests, states, runnable documentation, package isolation and measured evidence. Do not manufacture 130 wrappers to inflate the count. Shared adaptation primitives are reusable policies, not mandatory AI calls.

## Foundations — L0

| Need | Wave | Actual user job | Minimum acceptance |
|---|---|---|---|
| `theme-scope` — Theme scope | W1 | Apply one visual language without affecting the host app | Two differently themed instances coexist |
| `density-policy` — Density policy | W1 | Fit information to the task and input device | Keyboard and coarse-pointer targets remain usable |
| `focus-ring` — Focus treatment | W1 | Make keyboard location consistently visible | All interactive controls retain visible focus |
| `surface` — Surface and elevation | W1 | Group related information without dashboard clutter | Nested surfaces retain contrast and reading order |
| `text` — Text and numeric typography | W1 | Read dense labels and values clearly | Zoom and long localized labels do not overlap |
| `icon-label` — Icon with label contract | W1 | Use compact recognizable actions | Accessible name matches action |
| `status-boundary` — Loading/empty/error/stale boundary | W1 | Explain data readiness precisely | All lifecycle states have distinct copy |
| `portal-layer` — Overlay ownership | W1 | Keep popovers and dialogs inside the correct context | Nested modal/popover escape and cleanup |
| `motion-policy` — Motion policy | W1 | Make transitions coherent and interruptible | Reduced motion and cancellation are respected |
| `formatter-registry` — Formatter registry | W1 | Reuse explicit domain-aware display rules | Formatting changes preserve underlying value |

## Controls and input — L1

| Need | Wave | Actual user job | Minimum acceptance |
|---|---|---|---|
| `button` — Button / icon action | W1 | Invoke a clearly named action once | Keyboard activation and repeated-click handling |
| `field` — Field and validation | W1 | Collect input with actionable errors | Error linked to field and draft retained |
| `text-input` — Text and multiline input | W1 | Edit text without losing input | Composition events survive remote updates |
| `number-input` — Numeric input | W2 | Enter precise bounded numeric values | Decimal separators and range validation |
| `search-input` — Search input | W1 | Find records with clear query scope | Obsolete results cannot replace latest query |
| `combobox` — Combobox / async select | W1 | Choose from searchable bounded options | Keyboard, async status and selected ID persistence |
| `multi-select` — Multi-select | W2 | Choose several typed entities | Selection preserved across filtering |
| `checkbox` — Checkbox group | W1 | Make independent boolean choices | Mixed state and form serialization |
| `radio-group` — Exclusive option group | W1 | Choose one clearly defined option | Arrow navigation and selection announcement |
| `switch` — Switch | W2 | Toggle an immediate preference | State and action timing are understandable |
| `range-input` — Range and slider | W2 | Adjust a bounded continuous filter | Keyboard and precision stay equivalent |
| `date-range` — Date/date-range input | W2 | Choose a calendar interval | DST, inclusive/exclusive boundaries and locale |
| `currency-input` — Currency input | W2 | Enter a monetary amount in a known currency | Exact round-trip and currency change approval |
| `menu` — Action menu | W1 | Expose contextual actions without clutter | Focus return and disabled semantics |
| `tooltip` — Tooltip / explanatory hint | W1 | Explain short nonessential information | Keyboard access, dismissal and touch alternative |
| `popover` — Popover / disclosure | W1 | Inspect contextual details without navigation | Escape, click outside and focus restoration |
| `dialog` — Dialog / confirmation | W1 | Complete a focused task with explicit exit | Focus containment, return and reduced motion |
| `tabs` — Tabs | W1 | Switch among related views | Keyboard tabs and lazy-panel identity |
| `command-menu` — Command menu | W2 | Find available actions through a concise palette | Command scope, keyboard and permission refresh |

## Data display and manipulation — L1

| Need | Wave | Actual user job | Minimum acceptance |
|---|---|---|---|
| `metric` — Metric | W1 | Read a single meaningful measure | Missing, negative, high precision and partial scope |
| `delta` — Delta / change indicator | W1 | Understand change against a real baseline | Zero baseline, sign direction and baseline labeling |
| `table` — Data table | W1 | Inspect and sort typed records | 100k logical rows, focus and partial-scope labeling |
| `ranking` — Ranking | W1 | Compare ordered categories | Ties, nulls and full-population versus page rank |
| `detail` — Entity detail | W1 | Inspect one selected record | Missing record and stable selection handling |
| `record-list` — Record list / cards | W2 | Scan entities with a few key attributes | Equivalent essential information in variants |
| `filter-bar` — Filter bar | W1 | Build and review current data scope | Filter serialization and independent scope visibility |
| `filter-chip` — Filter chip / scope summary | W1 | See and remove a specific constraint | Remove one filter without clearing unrelated state |
| `selection-summary` — Selection summary | W1 | Know which entities are selected | Selected-all scope survives paging safely |
| `pagination` — Pagination / load more | W1 | Navigate known or cursor-based results | Unknown totals, cursor invalidation and cancellation |
| `sort-control` — Sort editor | W2 | Set a stable multi-field order | Stable tie-breaker and null placement |
| `column-chooser` — Column chooser | W2 | Tailor table information density | Keyboard reorder and mandatory column rules |
| `value-inspector` — Value / provenance inspector | W2 | Explain raw, formatted and derived values | Trace a metric to declared definition |
| `freshness` — Freshness indicator | W1 | Know when a value was obtained | Clock/timezone differences and stale threshold |
| `uncertainty` — Uncertainty / coverage display | W2 | Understand limits of a measurement | Coverage is distinct from statistical confidence |
| `export-view` — Basic export of authorized view | W2 | Take current authorized data elsewhere | CSV formula escaping, exact values and export scope |
| `editable-cell` — Controlled editable cell | W2 | Correct a value through app-owned mutation | Conflict, validation, cancel and authorization |

## 2D compositional building blocks — L1

| Need | Wave | Actual user job | Minimum acceptance |
|---|---|---|---|
| `plot-surface` — Plot surface | W1 | Provide a stable responsive drawing area | Resize and offscreen lifecycle cleanup |
| `scale` — Scale mapping | W1 | Map typed values into visual positions | Negative, zero and degenerate domain |
| `axis` — Axis | W1 | Read visual values and units | Long labels, narrow containers and time discontinuity |
| `legend` — Legend | W1 | Identify and toggle permitted series | Keyboard selection and non-color distinction |
| `mark-layer` — Point/line/bar/area marks | W1 | Encode measurements consistently | Same data semantics across renderer paths |
| `crosshair` — Crosshair / nearest datum | W2 | Inspect a location in a plot | Sparse series and hit-test precision |
| `chart-tooltip` — Chart tooltip | W1 | Read relevant plotted values | Keyboard access and no hidden data leakage |
| `brush` — Brush / range selection | W2 | Select a typed interval or region | Linked semantics and keyboard equivalence |
| `zoom-pan` — Zoom and pan | W2 | Navigate dense plot detail | Gesture interruption, reset and keyboard controls |
| `annotation` — Annotation | W2 | Explain a known event or threshold | Anchor survives resize and data revision |
| `reference-band` — Reference line / band | W2 | Compare against a declared threshold | Out-of-domain and incompatible-unit rejection |
| `small-multiples` — Small multiples | W2 | Compare repeated groups on consistent terms | Shared versus independent scale labels |

## Useful 2D visualization families — L1

| Need | Wave | Actual user job | Minimum acceptance |
|---|---|---|---|
| `trend` — Trend / time series | W1 | Understand change over time | Gaps, timezone, downsample invariants and 50k points |
| `bar-chart` — Bar comparison | W1 | Compare categorical magnitudes | Long categories, negatives and ties |
| `scatterplot` — Scatterplot | W1 | Inspect relationships and trade-offs | Missing axes, outliers and accessible selection |
| `histogram` — Histogram | W2 | See a numeric distribution | Boundary bins, partial data and stable totals |
| `box-plot` — Box plot | W3 | Compare distribution summaries | Method and sample size visible |
| `heatmap` — Heatmap | W2 | Compare a two-dimensional matrix | Null versus zero and non-color fallback |
| `stacked-bar` — Stacked bar / area | W2 | Understand additive parts of a whole | Parts reconcile to total and negatives handled |
| `composition` — Part-to-whole chart | W2 | Read a small categorical composition | Remainder and denominator visible |
| `slope-chart` — Slope chart | W3 | Compare two meaningful snapshots | Missing endpoints and entity matching |
| `dumbbell` — Range / dumbbell comparison | W3 | Compare paired quantities | Units, endpoints and meaning labeled |
| `waterfall` — Waterfall | W3 | Explain an additive reconciliation | Start plus changes equals end within exact policy |
| `calendar-heatmap` — Calendar heatmap | W3 | Inspect daily intensity patterns | Leap days, missing dates and localized week start |
| `event-timeline` — Event timeline | W2 | Inspect ordered events | Concurrent events, timezones and keyboard navigation |
| `interval-timeline` — Interval timeline | W3 | Compare durations and overlaps | Open-ended and overlapping intervals |
| `hierarchy-tree` — Hierarchy tree | W3 | Inspect parent-child structure | Cycle detection and unloaded children |
| `hierarchy-map` — Treemap | W3 | Inspect hierarchical composition | Sum reconciliation and accessible navigation |
| `relationship-graph` — Relationship graph | W3 | Inspect known typed connections | No invented edges, bounded layout and navigation |
| `flow` — Flow / Sankey | W3 | Show reconciled movement between stages | Cycles policy, conservation and unit consistency |
| `geo-points` — 2D geographic points | W3 | Inspect authorized geolocated records | Projection, antimeridian and authorized precision |
| `choropleth` — Regional value map | W3 | Compare normalized regional measures | Geometry join, denominators and missing regions |
| `sparkline` — Sparkline | W2 | Provide compact temporal context beside values | Meaningful label and missing/gap semantics |
| `error-bars` — Interval / error-bar plot | W3 | Show supplied uncertainty intervals | Bounds validity and interval method displayed |

## Semantic compounds — L2

| Need | Wave | Actual user job | Minimum acceptance |
|---|---|---|---|
| `explorer` — Explorer | W1 | Find, select and inspect a dataset | Search/filter/detail share one state contract |
| `comparison` — Comparison | W1 | Compare chosen entities using valid metrics | Missing metrics, units and preserved selection |
| `overview` — Overview | W2 | Understand a small set of trusted measures | No silently hidden critical measures |
| `metric-breakdown` — Metric breakdown | W2 | Explain composition of a known metric | Correct aggregate and declared grain |
| `time-investigation` — Time investigation | W2 | Compare a trend with known events | Time alignment, selection and no causal overclaim |
| `distribution-explorer` — Distribution explorer | W3 | Inspect spread and outlier candidates | Sample scope, methods and drill authorization |
| `record-inspector` — Record inspector | W2 | Inspect a record and authorized relations | One-to-many cardinality and permission checks |
| `comparison-builder` — Comparison builder | W2 | Choose comparable entities and metrics | Unsupported combinations explained before apply |
| `query-builder` — Typed filter/query builder | W2 | Compose allowed predicates safely | Serialization, nulls and semantic validator parity |
| `linked-exploration` — Basic linked exploration | W2 | Coordinate selection across views | Cycle prevention, scope and feedback suppression |
| `form-section` — Semantic form section | W2 | Edit related values with unit-aware validation | Controlled drafts, validation and cancel |
| `quality-panel` — Data quality panel | W2 | Inspect known limits before acting | Unknown values visibly remain unknown |
| `release-explorer` — Model release explorer recipe | W3 | Inspect model versions and availability | Version and region availability retained |
| `cost-estimator` — Cost estimation recipe | W3 | Calculate workload cost transparently | Unit-normalization, cache tiers and effective date |
| `benchmark-comparison` — Benchmark comparison recipe | W3 | Compare results only under compatible evaluation | Protocol mismatch, missing result and uncertainty |
| `revenue-investigation` — Revenue investigation recipe | W3 | Inspect legitimate revenue breakdowns | Exact sums, FX provenance and ratio correctness |
| `incident-explorer` — Incident timeline recipe | W3 | Inspect observed operational events | Timezones, partial logs and causal restraint |

## Workspace and composition — L3

| Need | Wave | Actual user job | Minimum acceptance |
|---|---|---|---|
| `workspace` — Workspace shell | W1 | Compose useful views from registered components | Standalone use and lazy module boundaries |
| `layout-stack` — Stack layout | W1 | Keep a stable reading sequence | DOM and visual sequence remain intelligible |
| `layout-grid` — Responsive grid | W1 | Arrange related views without crowding | Zoom, narrow width and pinned panels |
| `layout-split` — Resizable split layout | W2 | Inspect master/detail side by side | Keyboard resize and focus/draft preservation |
| `layout-tabs` — Workspace tabs | W2 | Keep secondary tasks available without clutter | Panel state and navigation history |
| `panel` — Panel shell and controls | W1 | Identify a view and its local actions | Controls scoped to the correct panel |
| `layout-policy` — Adaptive layout policy | W1 | Choose constrained layout predictably | Hysteresis and deterministic replay |
| `pin-freeze` — Pin/freeze control | W1 | Keep user choices stable against automation | Pin wins against stale agent plan |
| `workspace-links` — Cross-panel links | W1 | Connect valid selection/filter/highlight flows | One logical event processed once per target |
| `workspace-history` — Bounded undo/redo | W1 | Undo reversible UI changes | Concurrent edits and bounded memory |
| `workspace-presets` — Named view presets | W2 | Restore a useful presentation | Version migration and authorization refresh |
| `workspace-persistence` — Local persistence adapter | W2 | Resume presentation without vendor cloud | Quota failure, version mismatch and redaction |
| `workspace-inspector` — Local runtime inspector | W1 | Understand bindings, state and rejected commands | Inspect without mutating or leaking secrets |
| `presentation-status` — Operation/data/render status | W1 | Know whether requested UI outcome occurred | Committed but disconnected is not completed |
| `command-surface` — Optional workspace intent input | W2 | Express a UI task without requiring AI for manual use | No-provider use and cancel preserve workspace |
| `saved-layout-migration` — Workspace migration helper | W2 | Keep saved specs compatible deliberately | Forward/backward fixture matrix |

## Demand-gated advanced candidates — L2

| Need | Wave | Actual user job | Minimum acceptance |
|---|---|---|---|
| `advanced-pivot` — Advanced pivot / cross-tab engine | W4 | Serve paid demand for sophisticated multi-axis analysis | Paid pilot plus subtotal/grand-total conformance |
| `report-pack` — Advanced report composition/export | W4 | Produce branded multi-page reproducible reports | Paid demand, pagination and reproducible totals |
| `schedule-planner` — Advanced scheduling planner | W4 | Plan capacity with verified constraints | Paid demand, timezone and conflict validation |
| `large-graph-workbench` — Large-graph analysis workbench | W4 | Investigate large explicit graphs interactively | Paid demand, query budgets and graph scope |
| `team-studio` — Team workspace management service candidate | W4 | Operate shared workspace versions for paying teams | Paid demand, isolation, rollback and service costs |

## Meaningful exclusions

No 3D scene editor, arbitrary HTML/JS generator, stock collection of fashionable but misleading charts, generic office suite, replacement query warehouse, new general-purpose agent framework, or per-widget MCP server. Specialized medical/financial decision components need domain validation beyond visual plausibility. Unsupported intents return a capability limitation with a useful alternative, not a fake component.
