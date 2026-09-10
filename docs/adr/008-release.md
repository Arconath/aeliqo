# ADR 008-release: New immutable release without legacy deletion

Status: Accepted.

## Decision

Target the uniform, unused-at-reconnaissance `@aeliqo/sdk-{core,runtime,web,react,agent,devtools}` identities at 0.1.0 after prerelease validation. The concise `@aeliqo/core` and `@aeliqo/react` names already contain an incompatible 0.2.0 lineage; mixing those identities with four first-publication names would make the reset ambiguous. Keep all existing 0.2.x artifacts and Git history; no package overwrite or unpublish. Build the rewrite on a new branch/clean tree, preserve production until reviewed migration and digest-based rollback are ready, and deprecate the exact legacy versions only after the stable replacements and migration notice are public.

## Consequences

Acceptance depends on the applicable implementation tasks and evidence in docs/20-execution-plan.md. This ADR is a design decision, not a claim of completed code. A replacement needs explicit alternatives, migration and conformance tests.
