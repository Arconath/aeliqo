# POC v2 migration status

Historical PoC status follows. The September 6 production-quality continuation, current audit, fresh checks and remaining gaps are recorded in [the execution record](aeliqo/exec-plan.md).

Implementation and proof execution complete. Current rich-showcase verdict: **STRONGLY PROVEN FOR THE DEFINED POC SCOPE**; see `docs/PROOF.md`. The earlier partial verdict is retained there as historical evidence.

Preserved v1 workspace operations/subscriptions, React primitives/compounds, tokens, MCP acknowledgement bridge and tests. Added typed shared capability handlers, cross-entity relationships, filters, defensive immutable filters, pricing precision, app-owned sourced snapshot, optional protocol adapters, companion and Proof Lab.

Current verification: 60 unit/integration/parity tests and four production-browser tests pass, plus typecheck, lint, dependency checks, production build and core measurement. Actual Codex MCP and native in-app-browser WebMCP proofs executed. Deterministic BYOK reached the live browser; real provider execution was left unverified by user instruction.

Frozen-catalog challenges produced passes and semantic failures without adding dedicated product flows. Remaining scope limits and captured evidence are documented in PROOF.md; no production infrastructure or extra component catalog was introduced.

## Rich semantic showcase upgrade

Status: **complete**

The upgrade reuses the current core, React renderer, shared capability dispatcher and protocol adapters. The smallest delivery plan is:

1. Extend the fixed semantic catalog with `Scatter`, `Distribution`, `Relationship` and `Matrix`, plus only the node fields needed to configure them. Verify runtime validation, relationship safety and selection fan-out.
2. Expand the application-owned AI Landscape snapshot into a connected provider/model/pricing/capability/modality/limit/benchmark/release/availability graph. Preserve provenance and label synthetic benchmark evidence explicitly.
3. Add a dedicated Showcase that converts declared semantic needs into trusted incremental WorkspaceOperations. Keep the initial composition small and reuse compatible mounted components between scenarios.
4. Expose deterministic component adaptation and operation/render evidence in Proof Lab, including zero generated JSX/CSS/JavaScript.
5. Freeze the expanded data and component catalog, run at least ten post-freeze intents without code changes, then run typecheck, lint, boundary, unit, browser, build and performance checks and update the proof verdict.

Observable acceptance checks: all four new primitives render accessible SVG/table structures; one model selection updates compatible Detail/Scatter/Relationship/Matrix consumers; scenario changes preserve compatible nodes and leave unrelated render counters unchanged; Trend rejects insufficient temporal evidence visibly; all protocol adapters still expose the same four capability contracts.

Delivered and verified: all four new primitives, the connected ten-entity graph, eight Showcase scenarios, deterministic adaptation evidence, native WebMCP table-to-provider interaction, shared-protocol parity, and ten post-freeze intents. Final measured results are recorded in `docs/PROOF.md` and `docs/evidence/`.
