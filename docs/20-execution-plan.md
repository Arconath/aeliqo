# 20 — Implementation from an empty tree to release

The machine-readable task DAG is `harness/tasks.json`. All implementation tasks initially remain planned. This document gives sequencing, parallel ownership and milestone acceptance. The owner authorizes a rewrite, not premature destruction of a live service.

## M0 — Toolchain, baseline and platform proof

Verify repository/license/npm/infra identities, model/effort/spawn capability, effective skills, exact stable dependencies and clean isolated worktrees. Implement real CI/test/boundary commands and lock versions. Prove a small **production feasibility slice** with native input, table and chart in the shared web renderer, vanilla + React + Vue embedding, SSR/hydration, controlled events, Shadow DOM forms/labels/focus, style isolation and browser tests.

This is a blocking engineering spike, not the release deliverable. Fix platform issues or revise the isolated implementation choice through an ADR before building the entire catalog. Do not abandon the complete product at the spike.

## M1 — Contracts and semantic correctness

Implement versioned Catalog/Task/Result/Experience, runtime validators/generators, typed expression AST and semantic identity/grain/unit/time/relationship rules. Publish internal contract fixtures/type tests. Establish baseline errors/migrations and threat model. Contract ownership is centralized so workers do not invent conflicting representations.

## M2 — Data/query/results

Implement local ADC host, generic HTTP transport/reference server, negotiated query subset, derived definitions/manual+AI draft representation, result descriptors/batches/backpressure, caching/cancellation/leases and independent math fixtures. Prove local/HTTP parity including top-K plus trend, join fan-out and incomplete pages. No vendor connector catalogue or prompt-specific query endpoint.

## M3 — Runtime and interaction

Implement transactional task/region state, fine-grained dependency updates, typed bindings, stable identity, controlled drafts, navigation/action boundaries, state persistence/versioning and renderer receipts. Test concurrent user/agent changes, stale proposals, permissions and lifecycle cleanup.

## M4 — Shared web foundations and core catalog

Complete design tokens, native controls, collection/detail/layout/overlay primitives and direct imports. Add actual gallery states and browser/visual/a11y tests alongside components. All advertised entries must have real code, not only a manifest. Thin React integration shares the same implementation.

## M5 — 2D, compounds and adaptive compiler

Implement the plot grammar/geometry, required 2D families, accessible dense-data alternatives, semantic compounds and bounded task-preserving presentation selection. Test responsive/local/structural adaptation, simultaneous comparison, pinned views, large text/RTL/IME and no model calls on local interactions. Complete all component families in the inventory.

## M6 — Agent intelligence and semantic authoring

Expose shared tools through MCP, WebMCP adapter and BYOK port. Implement language-to-task reasoning, diagnostic refinement, AI/manual metric editor parity, profile restrictions, scope-aware activation and honest receipts. Real held-out language evaluations must not be a scripted prompt switch. Synthetic providers remain test fixtures.

## M7 — Local Studio, DX and public site

Implement authoring/inspection/export on the same manifests; complete component docs and compiled quickstarts, framework-free/React/server integration recipes and migration guide. Website: home, docs, playground, blog, reusable footer-content page; shared light/dark theme, clear GitHub link, uncluttered UX. Playground uses actual packages/runtime and supports no-AI exploration as well as agent control. Preserve approved brand identity where verified.

## M8 — Enterprise and production proof

Run threat-driven tests, tenant/cache/resource isolation, external package consumers, cross-browser SSR/interaction/a11y, independent design review, full visual matrix and real performance/bundle/memory measurements. Manual assistive-technology certification is deferred beyond 0.1.0 and must not be claimed by automated checks. Perform real external MCP and authorized paid-provider BYOK evaluation; document native WebMCP separately. Complete independent adversarial review.

## M9 — RC and deployment rehearsal

Build reviewed immutable artifacts, publish unique RCs to next when credentials are available, install clean consumers, deploy preview through the actual existing topology, smoke every route and test rollback. Verify public package content/license/security and old-version migration paths.

## M10 — Stable release and cutover

Only after all required production gates: publish unused 0.1.0 exact tarballs, verify registry identities, promote reviewed image through GitOps, verify live source/artifact identity, browser interactions and caching, publish truthful changelog/support matrix, and record rollback. Do not mark live until verified.

## Parallel stream rules

Contract tasks precede query/runtime/presentation implementations. After stable contracts, data/query and web foundations can proceed in parallel. Runtime bindings depend on both semantic and renderer interfaces. 2D/galleries/docs can parallelize by owned families after tokens/behavior stabilize. Release and root lockfile have one writer. Reviewers operate independently.

Do not create fake blocked dependencies to keep agents idle; do not ignore real dependencies to “maximize” workers. The task DAG carries the actual edges. A task may be split into smaller atomic commits without changing its acceptance.

## Stop conditions

A local scaffold is not completion. Completion means all required catalog entries and task gates have evidence, installed consumers work, public docs match, and publication/deployment states are truthful. External credential or human/native-host limitations become precise blocked tasks while other work continues.

The final report separates source complete, local validation, external validation, RC publication, stable publication, live deployment and remaining blockers. Each claim references immutable evidence, not a phrase copied from a prior release.

## Master consolidation ordering changes

T39 is inserted after foundational contracts/data/results/runtime plus the M0 platform slice. It proves **real** raw-data read -> named outputs -> validated composition -> UI -> typed interaction using a minimal input/table/plot implementation before whole families are completed. Reuse this code; no demo-only engine. T13–T18/T19 extend that proof to the full catalog/compiler. Synthetic proposals can prove the deterministic path, but cannot establish language reasoning.

T40 evaluates a real provider through the same tool path once T24 exists. It uses held-out task variants, a new domain, no-preset compositions, metric authoring, factual claims and cost/latency/error metrics. Missing credentials block only the live evidence tasks, not unrelated component development. T31 repeats integrated cross-domain tests over the complete product.

Reference probes in this kit close design-counterexample gaps but do not mark T03/T39/T40 done. The agent must integrate their vectors into actual runtime/package/browser tests. Every original required catalog entry remains in scope.

## Master edition work additions and sequencing

T41 implements weak-model containment after task/runtime/interaction contracts: formal binder states, host grants, conservative effect recovery, context-approved default/choice, valid-but-wrong residual tests, no-progress and evidence-bound narratives. Agent dispatcher T22 depends on this boundary, not on a model name. T40 tests it with real supported-model configurations; mocked boundary tests are separate.

T42 is an early source/registry preflight for the owner-requested exact0.1.0 reset. Record collisions, prior higher versions, namespace rights and explicit consumer migration. Inventory scripts may be tested offline, but only real registry/publication evidence closes the corresponding remote release proof. A collision blocks publication rather than unrelated implementation. T00/T42 must not erase live history or old npm identities.

The new master, chapter37 weak-model contract, chapter38 public experience, chapter39 discussion ledger, chapter40 current research and chapter41 engineering standard are canonical. Add their cases to implementation/evaluation rather than leaving them in chat. All 71 components and existing M0–M10 gates remain mandatory.
