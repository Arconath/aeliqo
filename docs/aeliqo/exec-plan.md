# Aeliqo public framework release execution record

## Release status — 7 September 2026

The active milestone is a public React framework release. The earlier POC remains a historical regression baseline in `docs/POC.md` and `docs/PROOF.md`; it is no longer the product target. No proof source or Proof Lab route was removed.

Implementation and candidate verification are complete for the 0.2.0 package release. The owner authorized worldwide publication and selected Apache-2.0. The repository is public and the five reviewed packages are published on npm. The production website is deployed through the reviewed immutable image and GitOps path. The release commit, image digest, GitOps revision, registry identities, and smoke evidence are linked from the release evidence files and the final GitHub release.

## Audit closure and publication work

| Deliverable | Owner | Status / acceptance |
| --- | --- | --- |
| Typed group identities, partial scope, linear grouping | Components | Complete; semantic fixtures and installed package checks |
| Dense timeline and explicit event inputs | Components | Complete; bounded output, keyboard checks, no causal claims |
| Linked range/group records and source inspection | Core | Complete; compatible links, refresh/persistence and stale checks |
| Explainable stable adaptation and task suggestions | Core | Complete; deterministic reasons, deliberate application, resize stability |
| Clean contracts/validation structure and compatibility | Core | Complete; boundary checks and strict runtime validation |
| MCP cancellation and external consumer topology/BYOK recipe | Agent integration | Complete for local/self-hosted implementation; external Codex MCP proof recorded |
| Complete docs, non-AI playground and progressive homepage | Docs | Complete; public homepage, docs, playground, changelog, and Proof Lab are deployed |
| Installed-artifact performance and browser CI | Packaging | Complete; hash-linked workload evidence and hosted quality run passed |
| Apache-2.0, package metadata, OSS hygiene | Packaging | Complete for 0.2.0 artifacts and public repository |
| Real agent/provider/native host evidence | Release | MCP external proof complete; paid BYOK and native WebMCP remain bounded limitations |
| Independent final review and integrated gate reconciliation | Release | Complete for local/hosted candidate; external reviews remain follow-up |
| Commit, hosted validation, registry publication, public source, website rollout | Release | Complete through the owner-gated image workflow and GitOps promotion |
| Registry/live smoke, source-package-website identities and rollback | Release | Complete; registry, image, GitOps, runtime revision, and public route checks are recorded |
| Pilot/support and equivalent-task comparison readiness | Release | Prepare executable materials; external paid commitments require real customers |

| Milestone | Delivered state | Fresh evidence |
| --- | --- | --- |
| M0 — alignment and baseline | Root instructions now target the public release; this file owns acceptance A–F and the historical proof remains intact | Baseline before changes: 156 tests, 9 Chromium workflows, build/boundaries/typecheck/lint, p50 0.0058 ms and p95 0.0120 ms core patch |
| M1 — installable packages | Five-package allowlist; clean ESM/declarations/CSS exports; 20 component subpaths plus Workspace; exact internal versions; no source aliases; public `aeliqo-mcp` executable | `pnpm check:packages`: React 18.3.1/19.2.8 and Next 15.5.25/16.3.4 consumers pass from tarballs outside the monorepo |
| M2 — existing catalog | Scatter, Distribution, Relationship, Matrix, and Explorer now share one direct/semantic/Workspace renderer without losing Pareto, outlier, graph, matrix, or compound behavior | Direct SSR/component tests, Workspace tests, package exports, and browser workflows |
| M3 — smart investigation | MetricBreakdown, EventTimeline, TimeInvestigation, QualityPanel; typed range/group operations and links; deterministic adaptation reasons; persisted interactions | Additive/ratio validation, range/group propagation, cycle/stale rejection, keyboard controls, and non-AI documentation fixtures |
| M4 — agent paths | One dispatcher and four capabilities; explicit workspace/renderer pairing; two-context isolation; revoke/cancel/reconnect/stale-token behavior; backend-only BYOK; honest WebMCP evidence state | MCP/BYOK/browser/companion/WebMCP adapter tests plus production-browser deterministic agent flows |
| M5 — public website | Product homepage, routed docs, playground, changelog, and separate Proof Lab in source | Production image is live; public routes and security headers were smoke-tested |
| Release identity | Workflow verifies once; the reviewed tarballs were published in dependency order after npm WebAuthn authentication | Final hosted quality, image, GitOps, and registry identities are recorded in the release evidence files and GitHub Actions history |

## Acceptance A–F reconciliation

| Acceptance | Status | Evidence and boundary |
| --- | --- | --- |
| A — installable package | Complete and published | Actual `npm pack` contents, declarations, CSS, peers, metadata, secret scan, external temp consumers, runtime linked selection, SSR/hydration, isolated imports, registry integrity, and an npm-installed consumer are recorded in `artifacts/package-evidence.json` and `docs/evidence/registry-release-0.2.0.json` |
| B — coherent public API | Complete locally | Twenty components have direct props and isolated subpaths; compounds reuse primitives; Workspace uses the same renderers; core has no AI Landscape domain dependency |
| C — MCP/BYOK/WebMCP/no-AI | Complete locally for implementation and deterministic evidence | MCP is primary, BYOK server-side is secondary, WebMCP reports adapter/host evidence separately and stays experimental, manual UI requires no agent |
| D — framework website | Complete and live | `/`, `/docs/`, `/playground/`, `/changelog/`, and `/playground/proof-lab/` are deployed from the release image and return 200 with the documented security headers |
| E — correctness/performance | Complete for local gates | 100k Table, 50k Trend, targeted updates, cleanup, mount/unmount, semantic null/ratio/grain/provenance, cross-browser interaction, and separate Chromium script/layout/paint evidence |
| F — identity/publish/rollback | Complete for the public 0.2.0 release | Allowlisted exact-tarball publication, SHA-256/integrity evidence, immutable image, GitOps promotion, runtime revision, public smoke checks, and rollback procedure are recorded |

## Final local verification

- `pnpm check`: typecheck, lint, five dependency boundaries, **194/194** unit/integration tests, production build, **11/11 Chromium** workflows, and core benchmark.
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

All five packages are version `0.2.0`. Source manifests retain a private guard; the reviewed release artifacts were emitted with public metadata and are now published.

| Package | SHA-256 |
| --- | --- |
| `@aeliqo/core` | `961780d2b46c7569dced449668915b6e04d41d1c509783681ae6ca82334228a5` |
| `@aeliqo/react` | `31615201039f85e7332ede033b91d260daf02408fe0521d370b49662a7860eb3` |
| `@aeliqo/mcp` | `502a635c94d4546dc371820e36bb5b51b2d78089bab751fa184b6f38a6d92c33` |
| `@aeliqo/byok` | `0d7177f3e199c6055d9912ae6352540b07823583e557f35178ab1dd258fa1e6e` |
| `@aeliqo/webmcp-experimental` | `91b16401afab7f58153d78fea00b2c2802fd57c635a2bddfe45d42b0af31b2fc` |

These hashes are the reviewed tarball bytes published to npm; registry integrity values are recorded alongside them in `docs/evidence/registry-release-0.2.0.json`.

## Open release gates

- Apache-2.0, public repository visibility, `@aeliqo` namespace ownership, and 0.2.0 `latest` publication are complete. The locked production dependency inventory contains only MIT, ISC, and BSD entries; see `dependency-license-audit.md`.
- Configure npm trusted publishing for future releases; the initial 0.2.0 publication used interactive npm WebAuthn.
- A real paid-provider BYOK run needs an authorized credential and cost owner. Deterministic provider behavior passes locally.
- Native WebMCP host verification is not current. Adapter tests pass and support remains experimental.
- Manual screen-reader review and proposed commercial pilots require people or systems outside this local workspace.
- A GitHub Release tag is the final source-control publication step; package and website artifacts are already live and immutable. Future releases should move npm publication to trusted publishing when the supported CI runner is configured.
