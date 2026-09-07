# ADR 008-release: New immutable release without legacy deletion

Status: Accepted.

## Decision

Target an unused 0.1.0 after prerelease validation. Keep existing 0.2.x artifacts and Git history; no package overwrite/unpublish. Build rewrite on a new branch/clean tree, preserve production until reviewed migration and digest-based rollback are ready.

## Consequences

Acceptance depends on the applicable implementation tasks and evidence in docs/20-execution-plan.md. This ADR is a design decision, not a claim of completed code. A replacement needs explicit alternatives, migration and conformance tests.
