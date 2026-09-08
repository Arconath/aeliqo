# 06 — Smart presentation with task preservation

## Input and output

The presentation compiler consumes a bound task, result descriptor and safe measured statistics, active experience profile, renderer capability set, current region state, user restrictions/preferences, and an abstract environment. It returns a bounded experience plan, task-coverage map, rejected-candidate reasons, and stable adaptation alternatives.

The environment contains actual container inline/block size, text scale, density, locale/direction, reduced-motion/contrast preferences, input capabilities and available navigation surface. Never infer no keyboard from mobile/coarse pointer. Unknown SSR measurements remain unknown, not fictional device widths.

## Feasibility before preference

Hard constraints include data semantics and completeness, authorization, accessibility, requested information, required *operations*, explicit user restrictions, fixed designer profile rules, and renderer capabilities. A candidate is valid only if all apply.

A candidate that keeps every field reachable but makes the user's requested side-by-side comparison impossible is invalid. A table may remain horizontally scrollable when two-dimensional relationships are essential. Reflow guidance contains exceptions for content that requires two-dimensional layout; do not turn mobile-to-card into a universal rule. [S02]

When no candidate satisfies all constraints, return a clear conflict plus valid alternatives. Do not silently drop columns, series, records, units or required interactions.

## Candidate generation

Each trusted primitive/pattern manifest declares accepted semantic shapes, task affordances, required roles, supported interactions, accessibility obligations, layout envelopes, costs, compatible variants and tested adaptation transitions. Registry contracts are machine-readable, but there is no arbitrary embedded policy scripting language.

Generate a limited candidate set from explicit rules and reusable patterns. A plot's existence is not inferred from its name; it must satisfy encoding/domain requirements. Compound patterns expand into the same grammar rather than creating bespoke runtimes. Domain extensions register against standard roles, not a new core enum.

## Ranking and bounded search

Rank only feasible candidates by task fit, information density, interaction effort, legibility, preferred Aeliqo patterns, user taste and measured cost. Add an incumbency/change penalty so a negligible score improvement does not rearrange a familiar view. Scores are internal ordinal preferences, **not probabilistic confidence**. Never publish invented `0.97` certainty values.

Use deterministic tie-breakers and a bounded beam/greedy composition strategy before considering a general solver. Initial contract: at most 64 candidate expansions for one planning pass; expose budget exhaustion and retain the valid incumbent or deterministic fallback. Revisit budgets only with evidence. The planner must not search every combination of every catalog component.

## Smartness capabilities

Automatically choose appropriate reading density; select valid encodings; recognize ordered entities versus temporal observations; preserve missing values; combine coordinated views when the task requires them; choose bounded details on demand; retain stable ranking membership; stage expensive modules; explain fallback and unresolved evidence; preserve context across direct and agent changes; and adapt to container, text and input capabilities.

Meaning inferred from data statistics can inform a labeled suggestion, not a domain conclusion. A heavy-tailed distribution does not establish fraud; a correlation does not establish causation. An outlier label needs a declared statistical method and scope.

## Three adaptation classes

**Local adaptation:** spacing, tick/label density, approved truncation with accessible full names, wrapping and density. It remains within the component's tested envelope.

**Representation adaptation:** table to list, full plot to small multiples, or graph to relationship list. Requires a declared task-equivalence transition and an information/operation coverage check.

**Composition adaptation:** master/detail side-by-side to drill-in, secondary view to an explicit tab, or expanded filter panel to a control. Must preserve navigation, selection and task context. Do not hide an essential comparison dimension in an unrelated screen.

Automatic transitions are disallowed while they would destroy active focus/draft/drag/IME ownership. Queue and coalesce them, show a user-triggered alternative, or choose a local temporary layout. Hysteresis and minimum dwell time prevent jitter; test boundary oscillation rather than copying one breakpoint everywhere.

## User intent and designer governance

The Aeliqo profile defines fixed/adaptive/composable regions and approved patterns. Fixed means no representation replacement, not permission to be inaccessible. Adaptive selects equivalent representations. Composable permits adding/removing approved task views. Model control is orthogonal: any mode can have an agent but must respect the same limits.

An explicit “table only” is a restriction, not a low-weight preference. If a compliant scrollable table exists, use it. If it cannot meet the task/profile, explain the conflict. A user choice persists by semantic task role, not by fragile component instance number.

## Plan identity and commits

Semantic view identity is stable across variants: selected Employee stays selected whether viewed in table or list. Views have stable role IDs independent of DOM IDs. A transition contains an explicit state-transfer map. Validate data readiness and renderer capability before swapping the committed plan. A missing renderer is a typed failure, not a silent fallback to arbitrary HTML.

## Acceptance examples

For “compare these two records across eight fields” at 360px, an approved scrollable comparison with sticky identity labels can be better than cards; test the comparison operation. For “browse 50 records” a compact list with detail drill-in may be valid. For five temporal series, a selector is valid only if the task does not require seeing all five simultaneously; otherwise use an approved small-multiple/scrollable strategy.

Test the same task at 320/360/768/1280px, 200% text scale, 400% zoom/reflow conditions, RTL, unknown initial size, different input modes, long translated labels, late font load and nonempty drafts. Do not use only the happy-path desktop screenshot.

## Master consolidation composition and proposal discipline

Candidate sources are: a valid incumbent; an approved pattern expansion; a bounded composition over available roles/ports; and a user/model-proposed registered composition. **No named pattern is a mandatory funnel.** All paths use one feasibility validator. Index manifests by semantic roles and operation support; the planner does not enumerate every product component in every combination.

Role describes what a view contributes; pattern is a tested macro; primitive is its implementation. Roles are metadata with a versioned extension boundary, not a domain-specific closed enumeration. If a task has a valid composition but no exact preset, bounded composition must remain possible. If the configured profile intentionally forbids it, report policy conflict rather than missing data.

Coverage is per required information **and operation**. Claims such as “all fields remain reachable” do not prove simultaneous comparison. Cross-view requirements include shared selection identity, compatible scale domains and source/definition scope. A top-N limit is not a visual optimization unless task semantics explicitly requested that limit.

The model may propose specific registered views and layouts within the Aeliqo grammar. This adds candidates, not authority. Low-level CSS, pixels, focus/ARIA behavior and arbitrary module URLs remain outside model control. Rank feasible candidates by tested preferences/change cost; do not advertise a globally optimal view.

64 expansions is a measured starting budget, not a theorem of completeness. A bounded search may return `search-exhausted` with an incumbent/fallback, distinct from proven contract conflict. Narrowing a candidate list for model context must not redefine runtime capability; lazy discovery or a user-approved alternative remains possible.

The production registry configuration resolver receives the parsed presentation node as an optional third argument. During full plan validation this argument is always present, allowing a registered container to reject child counts incompatible with its resolved slots. Existing two-argument resolvers remain compatible. This is a local callback extension; the version 1 wire schema is unchanged. A renderer must never silently omit a child accepted for task coverage.
