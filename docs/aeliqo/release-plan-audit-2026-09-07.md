# Public release plan audit — 7 September 2026

## Scope and conclusion

Read-only implementation audit against the user-approved M0–M5 plan, acceptance A–F, release gates, and OSS/business requirements. This report records findings; no application fixes, publication, or deployment were performed. Source inspection was split across components, agent/contracts, packaging/business, and public-runtime verification.

The previous `exec-plan.md` statement “authorized local implementation is complete” is too broad. Packaging and foundational contracts have substantial evidence, but M3 and M5 contain unfinished local implementation requirements. Passing tests and the last focused P0/P1 review do not establish full plan completion.

Local source: HEAD `cfaea334fc8d98c73e9af121a2154656c5944933` plus uncommitted changes. Remote repository inspection reports private visibility and no license. Existing modifications were preserved.

## Production observed now

- `https://aeliqo.com/version` reports `da9142ade2db617f283ef6e9eb6fff4539f26ef3`.
- Browser navigation to `/`, `/docs/`, `/playground/`, `/changelog/`, and `/playground/proof-lab/` returns HTTP 200 but renders the same old AI Landscape showcase. HTTP success is SPA fallback, not proof of the new routes.
- The old application includes a Documentation tab. The new routed framework website exists locally but is not this production artifact.
- GitHub image publication run `34041428044` succeeded for the old revision. Latest observed quality run `34042568209` succeeded for parent HEAD, not the uncommitted candidate.

## Findings and required corrections

| Priority | Finding and evidence | Consequence / correction / verification |
| --- | --- | --- |
| Release blocker | MetricBreakdown converts null to `Unknown` and all other keys to strings (`packages/react/src/metric-breakdown.tsx:91`). | Distinct categories merge. Reproduced from installed tarball: null with value 10 plus literal `Unknown` with value 20 becomes one group of 30. Preserve typed keys separately from labels; test null/literal, number/string, empty keys, selection and refresh. |
| Release blocker | Derived breakdown ranking sets `scope: entire-dataset`, and selected-record snapshots replace population counts (`metric-breakdown.tsx:132`, `time-investigation.tsx:164`). | A loaded sample/page can acquire stronger completeness metadata in a child view. Retain original population scope and distinguish loaded contributing rows from a complete group; test partial drilldown. Parent warnings currently remain visible, but do not repair the child contract. |
| M3 unmet | Table advertises only `select`; range/group receivers are restricted (`packages/core/src/model.ts:327`, `:399`). | Generic range/group → Table fails. Executed both patches: `Binding target cannot receive group/range`. Add explicit compatible filter links and record/source targets, then prove the full non-AI overview → group → time → record → provenance flow. Internal compound filtering is only partial fulfillment. |
| M3 unmet | Timeline manifest claims dense timestamp grouping, but renderer sorts and maps every event into a flat list (`event-timeline.tsx:90`, `:178`; `model.ts:423`). | Dense adaptation is not implemented. Add deterministic grouping with accessible event inspection and bounded output; measure dense fixtures. |
| M3 partial | TimeInvestigation feeds the same observation snapshot into Trend and EventTimeline (`time-investigation.tsx:146`). | Independent relevant incident/deployment events cannot be supplied alongside observations. Add an explicit event input/binding and temporal relationship; test no causal inference and preservation of record identity. |
| M3 unmet | Adaptation reason is optional; Workspace forwards callbacks but has no “why” control; threshold switches lack hysteresis (`shared.tsx:18`, `workspace.tsx:156`, `matrix.tsx:102`). `catalog_search` performs keyword search only (`capabilities.ts:295`). | Complete explainable adaptation, threshold stability, and task/semantics-based suggestions with deliberate acceptance. Catalog search is not a recommendation policy. |
| M3 partial | QualityPanel implements its own definition list/table and declares no linked inputs (`quality-panel.tsx:130`; `model.ts:443`). | Basic disclosure works, but the planned primitive reuse and linked source inspection are incomplete. Compose shared primitive behavior where appropriate and prove selected-population provenance. |
| M5 unmet | Public docs list 15 detailed component examples, omitting Scatter, Distribution, Relationship, Matrix, Explorer; Next support is a matrix row, without App Router quickstart (`apps/playground/src/Documentation.tsx:26-94`). | Outside developers still need source knowledge. Add complete React/Next runnable onboarding, five component references, extension example, and backend BYOK composition recipe. Current quickstart starts with repo release tooling. |
| M5 partial | Homepage contains live Metric/Overview but no live Workspace; operational fixtures are in docs/consumer, not a complete selectable non-AI playground investigation (`public-main.tsx:32`, `main.tsx`). | Implement the promised progressive demo and operational playground using the same contracts. |
| E unmet | Scale tests target `/performance.html` from playground build; core timing imports workspace source (`tests/performance-scale.spec.ts:22`, `scripts/performance.ts:2`). | Correctness/geometry evidence is useful but is not installed-tarball scale evidence. Move equivalent measurements into isolated consumers and bind results to tarball hashes. Preserve the before/after baseline and investigate >10% regressions. |
| E partial | Breakdown copies each group array on every row; timeline renders all events and endpoint options (`metric-breakdown.tsx:97`, `event-timeline.tsx:145-198`). | Large new-component workloads lack bounded behavior. Remove quadratic grouping and measure actual large-group/event cases before broad scalability claims. |
| E partial | CI installs Chromium only (`.github/workflows/quality.yml:28`). | Firefox/WebKit success is local evidence, not recurring CI protection. Add supported-browser gates; screen-reader review remains external. The timing/bundle >10% investigation gate is not automated. |
| M4 partial | MCP SDK tool handler does not forward request cancellation context (`packages/mcp/src/server.ts:16-38`). | Revoke/bridge cancellation works, but client cancellation is not end-to-end. Wire the signal and verify using an actual MCP cancellation request. |
| M4 boundary | MCP bridge accepts explicit HTTP loopback origins only (`bridge.ts:19-25`); CLI pairing URL points to local port 5173 (`cli.ts`). | This is a local topology, not a ready remote HTTPS self-host topology or live aeliqo.com agent connection. Document/configure the supported external-consumer topology without relaxing origin protection. |
| M4 unknown | Current tests use official SDK, deterministic BYOK, and simulated WebMCP host. Historical real-harness evidence predates current code. | Run an external reasoning agent and authorized real provider on the final candidate. Native WebMCP remains experimental/unverified; do not substitute adapter registration for host verification. |
| F unmet | Candidate is uncommitted/private; npm workflow is local; no owner-approved LICENSE, registry identity, final clean-source hash chain or current website digest. | Obtain license/ownership decisions, record candidate commit, run hosted checks, approve exact artifacts, publish/deploy and verify registry/live identity. Do not treat old successful deployment as candidate delivery. |
| M0 drift | `current-state.md` still says no independent Git metadata and twelve components; `completion-audit.md` reflects historical sixteen-component POC; active AGENTS retains proof-centric wording. | Mark historical documents clearly and reconcile active acceptance statuses. A single optimistic execution record does not resolve conflicting guidance. |
| Business unverified | OSS/business and E01–E06 comparison documents are hypotheses, without observed pilot/competitive results (`20-oss-business-strategy.md`, `21-competitive-validation.md`). | Prepare pilot ownership, recruitment tracker, activation/repeat-use definitions, support offer and measured comparison fixtures. Five integrations/three paid commitments require external people and explicit outreach authorization. |

## Architecture and abstraction assessment

The framework has a real headless core, application-owned DataPort, shared dispatcher, explicit metric/dimension/time/relation semantics, strict bounded JSON operations, revision checks, atomic patches, pins/history, and targeted subscriptions. React is a renderer; provider/protocol effects are outside core. Twenty components plus Workspace exist; five promoted components share direct and semantic renderers, and new compounds reuse existing primitives substantially.

Trusted registry/config validators and custom renderer registration are implemented. Built-in semantic requirements still depend on component-name branches in a 1,688-line `model.ts`. This is a maintainability concentration, not proof that the entire architecture is broken. Extract coherent validation/operation responsibilities before adding further catalog waves, without replacing working abstractions.

Executable grammar is version-1 operations with version-0.2 receipt metadata. Broader EBNF/`contracts/v0.1` documents are design artifacts, not implemented wire features. Persistence rejects unknown versions; no cross-version migration system or structured path/reason/alternatives diagnostics is implemented. Existing additive changes do not by themselves require a breaking migration. The first public release must document read/write compatibility and provide migration fixtures before any incompatible change.

Interaction payloads are currently limited to range/group plus existing selection/filter behavior. New arbitrary port types require core changes. DataPort is an already-authorized application boundary, not an enterprise identity/tenant authorization platform. Hosted multi-user, billing, Vue/Svelte, and speculative Pro modules remain intentionally outside this release.

## Coverage and fresh checks

| Acceptance | Audited status |
| --- | --- |
| A installable artifacts | Substantial local proof; public metadata/immutable publication and external onboarding remain incomplete |
| B public API/catalog | Twenty components implemented; semantic bug, docs and interaction completeness remain open |
| C agent paths | Local implementations tested; full consumer topology/current real-agent/provider/native-host evidence incomplete |
| D public website | Local routes implemented; old showcase live; onboarding/demo requirements partial |
| E correctness/performance | Existing automated workloads pass; new semantic counterexample, artifact-scale and full quality gates open |
| F release identity/business | Pipeline preparation exists; public release chain and commercial validation incomplete |

Freshly executed in this audit: TypeScript, 178/178 unit/integration tests, five dependency boundaries, live browser navigation to five public paths, live version endpoint, GitHub run/repository inspection, rejected range/group → Table repro, and installed-tarball null/Unknown grouping repro. Agent-focused checks also passed. An initial root-level SSR probe could not resolve React because it is a package-scoped dependency; the isolated installed consumer reproduction succeeded.

Prior browser 11/11 results per browser and React/Next consumer matrix were inspected as previous-session evidence, not rerun in full for this audit. No full new security certification, manual screen-reader session, paid provider call, native WebMCP host test, exhaustive AI-fact revalidation, or competitive benchmark is claimed.

## Recommended order

1. Fix semantic category identity and partial-population propagation; add regression fixtures.
2. Finish shared range/group → records/source investigation, explicit event input, dense timeline, adaptation explanations/stability, and suggestions.
3. Finish public onboarding/examples and reproducible local/self-host agent recipes; test client cancellation and current external agent/provider paths.
4. Measure installed artifacts and make required browser/regression gates repeatable; reconcile all status documents.
5. Establish owner-approved OSS license and immutable candidate, then request approval over exact registry/site artifacts and complete live smoke/rollback evidence.
6. Run independent onboarding/pilots and equivalent-task competitor measurements. Do not describe business readiness or competitive superiority as established beforehand.
