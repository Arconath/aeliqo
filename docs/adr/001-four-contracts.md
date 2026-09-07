# ADR 001-four-contracts: Four public contract families

Status: Accepted.

## Decision

Expose Catalog, Task, Result and Experience. Keep intermediate logical/physical/render plans internal versioned representations. This avoids a vocabulary/adapter at every layer while retaining testable boundaries.

## Consequences

Acceptance depends on the applicable implementation tasks and evidence in docs/20-execution-plan.md. This ADR is a design decision, not a claim of completed code. A replacement needs explicit alternatives, migration and conformance tests.
