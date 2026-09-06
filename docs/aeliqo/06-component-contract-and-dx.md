# 06 — Component contract and developer experience

## Three entry points, one implementation

Illustrative API names below are proposals; reconcile them with the PoC before publishing examples.

```tsx
// Small explicit usage: no workspace, agent, dataset registry or network.
<Metric value={42} label="Active models" />

// Semantic usage: descriptor/query is shared across components.
<Comparison binding={modelCosts} metrics={[inputCost, qualityScore]} />

// Workspace usage: compose the same registered implementations.
<Workspace runtime={runtime} spec={savedWorkspace} />
```

Consumers should not need provider plumbing for standalone primitives. Shared theme/locale provider is optional with documented defaults; workspace runtime provider is only for shared coordination. When state is controlled, props win and the component emits change proposals; uncontrolled mode owns defaults. Never switch between controlled/uncontrolled implicitly on adaptation.

## ComponentManifest obligations

ID/version/level; tasks; input data shapes and semantic preconditions; typed prop schema and defaults; compatible variants; event input/output ports; size/density constraints; motion/keyboard/screen-reader obligations; fallback; cost category and renderer support; trusted loader key; migration policy. Public manifest metadata is compact. Large schemas and examples are requested lazily, not included in every tool invocation.

Prop schema may be component-specific but must reject unknown executable behaviors from wire inputs. A trusted React slot is not serializable; an agent can choose only a registered slot/preset ID with a validated config. Callbacks must not be serialized as strings and evaluated.

## A component is more than a default screenshot

Every component spec includes loading, skeleton sizing, empty, all-filtered-out, partial, stale, offline/disconnected where relevant, permission denied, failure with retry, and long-content stress. Controls need disabled/read-only/invalid/pending states with clear distinction. Not every component needs every state, but omissions must be explicitly justified in its spec.

Selection, pagination, expansion, sorting, pinning, formatting, density and layout switching must preserve meaningful identity. A linked chart/table cannot disagree about selected entities because each maintains a separate index-based model.

## Composition and customization

Theme-level variables are the first choice for color/spacing/typography. Named parts and documented data attributes support styling without depending on incidental DOM nesting. Slots support content replacement while preserving required semantics; expose responsibility clearly when the user replaces an entire interactive part.

Use headless behavior utilities selectively, but ship our visual design and ergonomic component API. Avoid exporting every underlying dependency option: users should not need to understand an implementation library to perform standard tasks. An advanced adapter escape hatch can expose extra capabilities without freezing upstream types as public API.

## Error design

Structural errors identify schema path and expected type. Semantic errors name the incompatible fields/unit/grain, relevant component capability, and valid remedies. Unsupported custom extension returns a typed failure; it does not crash the entire workspace. Development warnings can be richer than production end-user messages, but do not leak data/secrets or produce repeated console spam.

## Capability composition

A Table may emit entity selection and accept a filter. A Trend may emit a time range and accept a selection highlight. Comparison binds compatible metrics and emits compare-set changes. Explorer orchestrates these contracts, not a parallel copy of state logic. Workspace connects compatible ports and applies node policies. Core validates the link types before subscribing.

## Quality threshold before adding another component

The current component must have a clear task, approved data semantics, standalone and compound use evidence, keyboard/focus behavior, responsive and long-text review, size/latency evidence, cancellation/cleanup, docs example, and no required premium/cloud dependency for basic behavior. Candidate rows in the catalog are not implemented components.

## Backward compatibility and DX verification

Test imports in Vite and Next.js consumer fixtures; no browser globals at module evaluation in server environments. Verify className/style/part overrides, form association where applicable, ref forwarding, deterministic IDs, hydration parity, theme changes, locale/RTL, and strict type inference without explicit `any`.

Run three onboarding tasks with an external developer: render standalone Metric/Table; bind a semantic Comparison; add one custom visual in a workspace. Record actual time/error count and confusing concepts. Target fewer required concepts, not a shorter README that hides important constraints.
