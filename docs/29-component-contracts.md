# 29 — Required component contracts

Every row below is a **required 0.1.0 implementation**, not an implementation claim. A compound expands into the shared grammar and uses the same owned primitives. Native rendering may differ in chrome according to context; standalone usage does not require a region, agent, cloud, or schema registry.

This finite catalog contains **71 components**. Specialized geospatial tile clients, rich-text IDEs, full enterprise pivot/scheduler engines, arbitrary canvas design tools and 3D are not silently promised by the word complete. They need separate scope/ADRs; the catalog below may not be quietly reduced to meet a deadline.

Each component additionally satisfies docs/10, docs/11 and docs/12: typed props, native semantics, controlled and uncontrolled behavior where relevant, errors, loading, empty/partial states, RTL, locale, forced colors, large text, pointer/keyboard, reduced motion, cleanup and isolated imports. Every state must have a reasoned applicability decision; decorative-only primitives need not invent loading/error states.


## Foundation

| Component | Contract-specific acceptance |

|---|---|

| Button | Trigger one explicit action; native button semantics; disabled and pending never double-submit. |

| IconButton | Named compact action with minimum target area; icon alone is never its accessible name. |

| Link | Navigate to an application-approved destination; preserve browser open-in-new-tab behavior. |

| Text | Render trusted/plain text with locale and wrapping; no untrusted HTML interpolation. |

| Heading | Preserve logical document hierarchy independent of visual size. |

| Badge | Present a category/status with text as well as color. |

| Avatar | Display optional identity image; fallback initials and privacy-safe alt policy. |

| Separator | Express visual or semantic separation without polluting keyboard order. |

| Surface | Provide consistent bounded chrome; never impose dashboard cards on every control. |

| Stack | Arrange children in logical reading order with tokenized spacing. |

| Grid | Arrange responsive regions without changing semantic/focus order. |

| SplitPane | Resize adjacent regions by pointer and keyboard while respecting minimum task requirements. |

| ScrollArea | Preserve native scrolling, focus visibility, zoom and platform affordances. |


## Input

| Component | Contract-specific acceptance |

|---|---|

| TextField | Label, description, validation, autocomplete and IME-safe controlled/uncontrolled value. |

| TextArea | Multiline editing preserves draft, selection and composition across unrelated updates. |

| NumberField | Locale-aware editing separates display text from exact numeric value; do not silently round money. |

| Checkbox | Native checked/indeterminate state; group ownership and submitted value are explicit. |

| RadioGroup | One selected option; native semantics or APG-equivalent keyboard behavior. |

| Switch | Binary setting with visible label; changing setting is not implicit business submission. |

| Select | Bounded enumerated choice with native-first semantics; empty and unknown value are distinct. |

| Combobox | Searchable choice with APG behavior; stale remote options cannot overwrite current input. |

| DateField | Calendar date rather than timezone-shifted timestamp; typed entry and picker agree. |

| DateRange | Explicit inclusive/exclusive boundaries, timezone/calendar policy and keyboard operation. |

| Slider | Bounded quantity with keyboard and text alternative; steps and units are declared. |

| SearchField | Explicit/debounced query policy; composition input is not submitted mid-IME. |

| FileInput | Native file selection; host owns upload and validation; no file bytes enter agent by default. |

| FieldGroup | Group related controls with legend, descriptions and coordinated validation. |

| Form | Native submission semantics, draft validation, error summary and explicit host action; rerender never submits. |


## Navigation

| Component | Contract-specific acceptance |

|---|---|

| Tabs | Named panels with stable selection; automatic activation only when latency permits. |

| Breadcrumb | Reversible context path; approved routes and current-location semantics. |

| Pagination | Stable cursor/page scope; loaded rows are not misrepresented as global selection. |

| Menu | Action menu with focus return and keyboard behavior; no layout-generated business actions. |

| TreeNav | Hierarchical navigation with stable node identities, expansion and keyboard semantics. |


## Feedback

| Component | Contract-specific acceptance |

|---|---|

| Tooltip | Supplemental nonessential information; works on focus, dismisses, not the sole label. |

| Popover | Contextual nonmodal surface with explicit focus/dismiss behavior and viewport containment. |

| Dialog | Native-first modal semantics, focus containment/return and escape policy. |

| Drawer | Inline or modal detail according to an explicit mode; do not mix the two focus models. |

| Toast | Bounded transient feedback; essential errors remain persistently available elsewhere. |

| Alert | Persistent status/error with severity semantics and actionable recovery. |

| Progress | Determinate or unknown progress honestly; no invented completion percentages. |

| Skeleton | Stable reserved geometry with reduced motion and a named loading state. |

| EmptyState | Distinguish no records, no matches, forbidden data, loading and failure. |


## Data

| Component | Contract-specific acceptance |

|---|---|

| Metric | One validated value or aggregate with units, scope and unavailable state. |

| Delta | Explicit compatible baseline; zero denominator and percentage-point versus relative change distinguished. |

| KeyValue | Labeled facts with stable ordering, wrapping and semantic links. |

| Detail | Selected entity facts including missing fields; record identity persists across views. |

| RecordList | Scannable records with identity-based selection and reachable additional fields. |

| CardCollection | Repeated compact records; preserve reading order, headings and bounded loading. |

| Table | Native table first; separate interactive-grid mode; sorting, paging, selection, virtualization and precise values. |

| FilterBuilder | Typed predicates, AND/OR/null handling, visible inherited scope and explicit query application. |

| SelectionSummary | Disclose selected identities or server predicate scope; never imply unobserved global selection. |


## Visualization

| Component | Contract-specific acceptance |

|---|---|

| Trend | Temporal metric series, declared grain, gaps and exact accessible summaries. |

| Bar | Comparable quantitative categories; baseline and negative values correctly represented. |

| Area | Temporal area/stack with compatible additive measures; reject misleading nonadditive stacking. |

| Scatter | Two quantitative axes, declared units, stable point selection and noncausal interpretation. |

| Histogram | Declared binning, count/density labeling and missing-population disclosure. |

| Heatmap | Two dimensions and one measure; accessible exact cell values and readable color key. |

| Matrix | Entity-feature comparison preserving row/column association and useful comparison at narrow width. |

| Relationship | Declared edges/cardinality only; deterministic bounded layout with accessible adjacency view. |

| Tree | Explicit hierarchy, cycle validation, stable expansion and equivalent text navigation. |

| Treemap | Nonnegative additive hierarchy; area meaning and tiny-node access preserved. |

| Timeline | Dated events/intervals with timezone semantics, explicit overlaps and chronological alternative. |

| CalendarGrid | Calendar-aligned 2D values/events; locale week boundaries and noncolor exact values. |


## Compound

| Component | Contract-specific acceptance |

|---|---|

| Explorer | Filter plus collection plus selected detail using shared parameter/selection state. |

| Comparison | A stable compare-set with compatible metrics and simultaneous comparison affordances. |

| Breakdown | Group a declared metric and inspect contributing records; recompute ratios from sufficient statistics. |

| Investigation | Trend, baseline, event timeline and detail; associations never imply causes. |

| SearchResults | Query state, collection, scoped result count and details with stale-result protection. |

| RecordEditor | Existing primitive form over a host-owned action with entity revision and explicit save/cancel. |

| FormFlow | Task-based steps, draft persistence, validation and reversible navigation before commit. |

| QualityPanel | Source, freshness, completeness, provenance and unsupported claims displayed honestly. |
