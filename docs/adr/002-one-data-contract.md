# ADR 002-one-data-contract: One Application Data Contract

Status: Accepted.

## Decision

In-process and generic HTTP carry the same describe/plan/execute semantics. Optional importers assist metadata authoring but do not magically translate arbitrary endpoint semantics. Host-owned execution may be opaque or implement the supported relational subset. No per-database driver in core.

## Consequences

Acceptance depends on the applicable implementation tasks and evidence in docs/20-execution-plan.md. This ADR is a design decision, not a claim of completed code. A replacement needs explicit alternatives, migration and conformance tests.
