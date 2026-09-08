# Semantic compounds

Aeliqo compounds are controlled compositions of the existing web primitives. They provide a convenient standalone surface while preserving the same typed result, scope, identity and interaction contracts as manual composition. A compound emits proposals; the application remains authoritative for data, selection, drafts, navigation and actions.

The eight compound elements are:

- `<aeliqo-explorer>` combines a typed filter, a stable-identity record collection and selected detail.
- `<aeliqo-comparison>` keeps a host-owned compare set and renders compatible metrics simultaneously.
- `<aeliqo-breakdown>` renders groups and contributing records. Ratios are derived only from supplied numerator and denominator statistics; zero or invalid denominators remain unavailable.
- `<aeliqo-investigation>` combines trend, baseline, event timeline and detail. Its copy states that association is not a causal claim.
- `<aeliqo-search-results>` shows query state, a scoped result count and a collection. A result revision that does not match the query revision is presented as stale.
- `<aeliqo-record-editor>` wraps the existing form boundary and emits explicit save/cancel proposals carrying entity and revision identities.
- `<aeliqo-form-flow>` exposes task steps, controlled draft/validation state and reversible navigation before commit.
- `<aeliqo-quality-panel>` displays source, freshness, completeness and provenance, and labels unsupported claims instead of asserting them.

Each compound has a recipe helper ending in `PresentationRecipe`. The helper returns a bounded canonical `PresentationPlan` with stable root/child IDs, versioned representations, result references and typed interaction links. The helper does not fetch data, infer permissions, execute actions or instantiate an agent. The host supplies preconditions and authorized result references, then validates the plan through the shared presentation registry.

Every result-bearing view should provide an exact `ResultRef`, semantic entity and scope. Row indexes are never used as identity. For SSR, import the compound classes and render a deterministic host-resolved state; register custom elements explicitly in the browser.
