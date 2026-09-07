# ADR 003-shared-web: One owned web implementation

Status: Accepted with blocking M0 evidence.

## Decision

Lit 3 custom elements, native controls, CSS and modular D3/SVG form the candidate implementation. React is a thin lifecycle/property/event binding, vanilla is first-class. SSR/hydration/form/shadow accessibility issues must be resolved by T02 or a narrowly scoped replacement ADR; do not duplicate the catalog to hide problems.

## Consequences

Acceptance depends on the applicable implementation tasks and evidence in docs/20-execution-plan.md. This ADR is a design decision, not a claim of completed code. A replacement needs explicit alternatives, migration and conformance tests.
