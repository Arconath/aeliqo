# Aeliqo public framework release execution record

## Candidate status — 7 September 2026

The active milestone is a public React framework release. The earlier POC remains a historical regression baseline in `docs/POC.md` and `docs/PROOF.md`; it is no longer the product target. No proof source or Proof Lab route was removed.

Implementation is active again following `release-plan-audit-2026-09-07.md`, which supersedes the earlier overly broad local-completion verdict. The owner has explicitly authorized worldwide publication and selected Apache-2.0. Existing evidence below is historical until regenerated from the final candidate. Source starts at `cfaea334fc8d98c73e9af121a2154656c5944933` plus the existing working tree.

## Audit closure and publication work

| Deliverable | Owner | Status / acceptance |
| --- | --- | --- |
| Typed group identities, partial scope, linear grouping | Components | In progress; tarball and semantic regression fixtures |
| Dense timeline and explicit event inputs | Components | In progress; bounded output, keyboard inspection, no causal claims |
| Linked range/group records and source inspection | Core | In progress; compatible links only, state/refresh/persistence tests |
| Explainable stable adaptation and task suggestions | Core | In progress; deterministic reasons, deliberate application, resize boundary tests |
| Clean contracts/validation structure and compatibility | Core | In progress; meaningful module boundaries, no speculative infrastructure |
| MCP cancellation and external consumer topology/BYOK recipe | Agent integration | In progress; protocol cancellation and runnable external recipe |
| Complete docs, non-AI playground and progressive homepage | Docs | In progress; all 20 references, React/Next examples, browser checks |
| Installed-artifact performance and browser CI | Packaging | In progress; hash-linked workload evidence and regression investigation |
| Apache-2.0, package metadata, OSS hygiene | Packaging | Owner approved license; prepare checked public artifacts |
| Real agent/provider/native host evidence | Release | Inspect available runtime/credentials safely; do not fabricate external results |
| Independent final review and integrated gate reconciliation | Release | Pending candidate completion |
| Commit, hosted validation, registry publication, public source, website rollout | Release | Authorized; execute only with reviewed artifacts and required account access |
| Registry/live smoke, source-package-website identities and rollback | Release | Pending publication |
| Pilot/support and equivalent-task comparison readiness | Release | Prepare executable materials; external paid commitments require real customers |

| Milestone | Delivered state | Fresh evidence |
| --- | --- | --- |
| M0 — alignment and baseline | Root instructions now target the public release; this file owns acceptance A–F and the historical proof remains intact | Baseline before changes: 156 tests, 9 Chromium workflows, build/boundaries/typecheck/lint, p50 0.0058 ms and p95 0.0120 ms core patch |
| M1 — installable packages | Five-package allowlist; clean ESM/declarations/CSS exports; 20 component subpaths plus Workspace; exact internal versions; no source aliases; public `aeliqo-mcp` executable | `pnpm check:packages`: React 18.3.1/19.2.8 and Next 15.5.25/16.3.4 consumers pass from tarballs outside the monorepo |
| M2 — existing catalog | Scatter, Distribution, Relationship, Matrix, and Explorer now share one direct/semantic/Workspace renderer without losing Pareto, outlier, graph, matrix, or compound behavior | Direct SSR/component tests, Workspace tests, package exports, and browser workflows |
| M3 — smart investigation | MetricBreakdown, EventTimeline, TimeInvestigation, QualityPanel; typed range/group operations and links; deterministic adaptation reasons; persisted interactions | Additive/ratio validation, range/group propagation, cycle/stale rejection, keyboard controls, and non-AI documentation fixtures |
| M4 — agent paths | One dispatcher and four capabilities; explicit workspace/renderer pairing; two-context isolation; revoke/cancel/reconnect/stale-token behavior; backend-only BYOK; honest WebMCP evidence state | MCP/BYOK/browser/companion/WebMCP adapter tests plus production-browser deterministic agent flows |
| M5 — public website | Product homepage, routed docs, playground, changelog with unreleased work only, and separate Proof Lab | Production build, responsive screenshots, axe checks, keyboard flows, and route checks |
| Release identity | Workflow verifies once and publishes those exact tarballs in dependency order from a protected GitHub-hosted OIDC job | Workflow syntax/actionlint pass; public mode fails closed until license and public metadata are approved |

## Acceptance A–F reconciliation

| Acceptance | Status | Evidence and boundary |
| --- | --- | --- |
| A — installable package | Complete locally | Actual `npm pack` contents, declarations, CSS, peers, metadata, secret scan, external temp consumers, runtime linked selection, SSR/hydration, and isolated imports are recorded in `artifacts/package-evidence.json` |
| B — coherent public API | Complete locally | Twenty components have direct props and isolated subpaths; compounds reuse primitives; Workspace uses the same renderers; core has no AI Landscape domain dependency |
| C — MCP/BYOK/WebMCP/no-AI | Complete locally for implementation and deterministic evidence | MCP is primary, BYOK server-side is secondary, WebMCP reports adapter/host evidence separately and stays experimental, manual UI requires no agent |
| D — framework website | Complete locally | `/`, `/docs/`, `/playground/`, `/changelog/`, and `/playground/proof-lab/` use the existing Vite/deployment stack |
| E — correctness/performance | Complete for local gates | 100k Table, 50k Trend, targeted updates, cleanup, mount/unmount, semantic null/ratio/grain/provenance, cross-browser interaction, and separate Chromium script/layout/paint evidence |
| F — identity/publish/rollback | Prepared, publication pending | Allowlisted exact-tarball workflow, SHA-256 evidence, clean-source gate, existing immutable website deployment/rollback path; registry and live post-publish smoke require authorization |

## Final local verification

- `pnpm check`: typecheck, lint, five dependency boundaries, **178/178** unit/integration tests, production build, **11/11 Chromium** workflows, and core benchmark.
- Firefox: **11/11** browser workflows passed.
- WebKit: **11/11** browser workflows passed.
- `pnpm check:packages`: external tarball consumers passed for React 18.3.1 and 19.2.8; Next App Router passed for Next 15.5.25 + React 18.3.1 and Next 16.3.4 + React 19.2.8, including build, SSR, hydration, and client interaction.
- The external non-AI consumer executes primitive, compound, Workspace, scoped theme, and manual linked selection assertions in both React matrices.
- Standalone Metric bundle: **7,023 bytes** excluding React; five retained modules; no Workspace, D3, MCP, BYOK, or WebMCP implementation.
- Core 50-node/1,000-patch benchmark: **0.0059 ms p50**, **0.0116 ms p95**, 1,100 targeted notifications, zero unrelated notifications. This measures Node core operations, not React or browser paint.
- `pnpm proof:stress`: 10 historical intent compositions passed with the original catalog hash preserved through an explicit compatibility projection that omits only the newly added Trend range ports.
- Occupied-default-port runner: all 10 workflows in that run passed without stopping user services.
- `go test deploy/server.go deploy/server_test.go`, workflow actionlint/YAML parsing, and `git diff --check` passed.

Chromium CDP evidence records script, layout, paint-event CPU time, heap, and DOM counts separately. React `actualDuration` is treated as render work and `commitTime` as a timestamp; neither is labeled browser paint.

## Current local tarball identity

All five packages are version `0.2.0` and intentionally private in the default candidate build.

| Package | SHA-256 |
| --- | --- |
| `@aeliqo/core` | `df8005bc5a620dfe9469fce6b7de8f53550552897bf6f50a2612e290197c5dfa` |
| `@aeliqo/react` | `ac8f76d757c0121c33745dca00b91205903cbe594047611374daa080f2d04c43` |
| `@aeliqo/mcp` | `0ded22c81102d2e6121b8e36d016c15f02842f93fc5486b867c970c2fa12ee20` |
| `@aeliqo/byok` | `336f262204139fdad59430a8d9f8ffe21d179253753255b752ef40d9f877b49a` |
| `@aeliqo/webmcp-experimental` | `40fa5a8887e9ab319a8efbf4fdf6b6155e04b5d891b80a93349447c641974e38` |

These hashes must be regenerated from a clean committed candidate before publication.

## Open release gates

- The owner must select the Aeliqo OSS license, confirm ownership/notices, and change all five source manifests to approved public metadata. The locked production dependency inventory contains only MIT, ISC, and BSD entries; see `dependency-license-audit.md`.
- The owner must confirm `@aeliqo` npm namespace access, version/dist-tag, repository visibility required for provenance, and configure the trusted publisher for `npm-release.yml`.
- A real paid-provider BYOK run needs an authorized credential and cost owner. Deterministic provider behavior passes locally.
- Native WebMCP host verification is not current. Adapter tests pass and support remains experimental.
- Manual screen-reader review, external developer onboarding, registry-install smoke, live website smoke, and the proposed commercial pilots require people or systems outside this local workspace.
- No package was published, no license was invented, no version/tag was created, and no website was deployed in this implementation pass.
