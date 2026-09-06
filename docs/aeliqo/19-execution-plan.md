# 19 — Implementation plan with gates

## Definition of complete

“Complete” is per milestone with implementation and evidence. A catalog entry is not a promise that all listed components ship in the initial release. The goal is a polished end-to-end product foundation that can grow without rewriting contracts, followed by demand-driven catalog expansion.

| Gate | Deliverable | Must pass before proceeding |
|---|---|---|
| G0 Reconcile | Real PoC audit, command map, characterization, integration plan | Working state preserved; discrepancies known |
| G1 Contract foundation | Canonical schema/types, semantics, revision/receipts, minimal ports | Positive/negative fixtures and semantic/unit/concurrency tests |
| G2 Component quality | Metric, Table, Ranking, Trend, Detail, Filter plus necessary controls | Standalone usability, responsive/a11y, exact semantics, import isolation |
| G3 Workspace + MCP | Explorer/Comparison, layout/pins/links/undo, paired browser bridge | Manual/MCP parity; real UI outcome; negative routing tests |
| G4 Documentation + adapters | Polished docs site, examples, optional BYOK; experimental WebMCP | Versioned docs/examples compile; tested support matrix; core independent |
| G5 External beta | Migration/API/release hygiene, public evidence, external integration feedback | Honest support/limitations; no critical defects; adoption proof |
| G6 Commercial pilot | One justified advanced package or paid engineering engagement | Budget-owner commitment and delivery/support economics |

G4 work may overlap G2/G3 after contracts are sufficiently stable. Do not delay all docs until the end. BYOK/WebMCP can be deferred from a useful release when support/evidence is absent; labeling must be explicit.

## Vertical slices

Slice A: standalone Metric/Table on local data and imported CSS; prove no agent dependency. Slice B: shared semantic comparison with exact units and filter/selection correctness. Slice C: workspace adaptation with active draft/pins during resize. Slice D: one natural-language UI request through actual MCP→browser→receipt, plus chat-only/no-target negatives. Slice E: independent revenue/incident recipe and custom component registration to expose domain hardcoding.

## File ownership and concurrency

One integrator owns canonical contracts, public API, lockfile, root AGENTS.md and shared state. After G1 boundaries are agreed, a UI component task, a docs task, and an independent test/benchmark task may run in parallel on non-overlapping paths. Review contracts before merging consumer work. Never ask separate agents to redesign the same grammar concurrently.

Use available subagent/worktree features only if the actual harness supports them and the user permits local writes. Otherwise execute the same tasks serially. No model names, hidden resource promises, or required orchestration framework are built into this plan.

## Resource-aware agent loop

Load root instructions plus a relevant skill and referenced sections. Search source narrowly, inspect dependency boundaries, and keep only current findings in working context. Use scripts for deterministic checks, not repeated LLM inspection of huge datasets. Long task checkpoints contain source paths, decisions, command outputs and next action, not private reasoning transcripts.

Avoid an infinite refine-plan loop. After G0, implement the smallest coherent slice and collect evidence. A semantic defect can justify a narrow architectural change, not unrestricted scope expansion. Record blockers and continue independent work rather than claiming background execution.

## Done per slice

Code integrated with existing PoC; relevant tests executed; UI reviewed on necessary states/widths; performance impact measured when applicable; docs/API examples updated; diff inspected; no unnecessary dependency or duplicated path; residual risks listed. Missing check is not “passed”. Gate status is planned/in-progress/blocked/passed, backed by evidence path.

## Resume protocol

Read current-state, active exec plan and latest handoff. Verify that described source still exists and inspect current diff. Continue the next ready item. Do not re-audit unrelated files or regenerate all documents every session. Update plan only when source/evidence changes a decision.
