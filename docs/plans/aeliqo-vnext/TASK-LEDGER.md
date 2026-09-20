# Aeliqo vNext task ledger

This ledger supplements `07-EXECUTION-STATE.md`. States distinguish source implementation from verification and release.

| Task | State                    | Current evidence or next gate                                                                                                                                                                                                                                                                                                      |
| ---- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T00  | verified                 | Baseline/harness complete. Final clean-source matrix passed 87/87; `artifacts/product-ci/ci.json` records the exact source revision and `sourceChangedDuringRun: false`.                                                                                                                                 |
| T01  | design-contract-verified | ADR 012 and complete positive/negative declaration-only consumers pass strict TypeScript. This is not installed-package or runtime acceptance.                                                                                                                                                                                     |
| T02  | implemented-and-verified | Immutable data/non-data definitions, compatibility lowering, package export/docs and clean tarball consumer pass; collision and nested-mutation regressions added after independent review; full matrix passed at `dedc15e`.                                                                                                       |
| T03  | implemented-and-verified | Accepted `4422b0d`: authority-fenced proposals, typed safe denial and capability intent, exception-isolated observers, failed-proposal retirement, bounded generations, exactly-once internal/external denial publication, 34/34 vNext, installed evidence at `artifacts/runtime-consumers/run-edxqqJ/report.json`; not published. |
| T04  | implemented-and-verified | Accepted `f2c5389`: guarded two-phase scope activation, reentrancy-safe terminal receipts, real parent/child/peer isolation, 61/61 focused, 95/95 vNext, runtime regressions, and installed evidence at `artifacts/runtime-consumers/run-pKLQlG/report.json`; not published.                                                       |
| T05  | implemented-and-verified | Accepted `867192f`: bounded local binding/inference, atomic schema-validated replacement, pre-commit source fencing, 47/47 focused, 129/129 vNext, package regressions, installed core/runtime consumers and independent correction review; not published.                                                                         |
| T06  | implemented-and-verified | Accepted `22b6950`: real HTTP transport, explicit remote capability/coverage behavior, bounded authority-partitioned cursors/cache reuse, source-lineage/result proof, expected-value metric semantics, 178/178 vNext, clean core/runtime consumers and independent re-review; not published.                                      |
| T07  | implemented-and-verified | Accepted `1e4fa2f`: one deterministic owned-input resolver, candidate isolation, bounded identities, authorized target/commit fencing, cancellation rollback, hostile Proxy/accessor rejection, 204/204 vNext, 52/52 adaptation, browser and clean tarball evidence, full site matrix, and independent final reviews; not published. |
| T08  | implemented-and-verified | Accepted source `61ab509`: registered bar analysis, bounded identity-scoped comparison split, adaptive table/cards, exact source-lineage isolation through plot internals, browser/SSR/docs/consumer evidence, and independent final review; not published. |
| T09  | implemented-and-verified | Accepted source `756dbf6`; real runtime coordinating surface, custom layout/selection intents, bounded single/split/compare plans, immutable child addresses, cancellation/renderer-failure retention, 4/4 focused tests, and strict vNext TypeScript. Browser focus/resize/draft evidence is T10/T13. |
| T10  | implemented-and-verified | Accepted `42d0c5b` with `5e00232`/`ce00be0`; scoped React bindings and native/headless views, effect-owned lifecycle, 5/5 React tests, 13/13 vNext browser tests, strict TypeScript and packed framework consumer. |
| T11  | implemented-and-verified | Accepted `b3f0aa8`; real host-owned actions and non-data job capability with durable effects/progress/cancel/output refs; focused 8/8, runtime build and strict vNext TypeScript. |
| T12  | implemented-and-verified | Accepted `617a7ed` with `ce00be0`; request-scoped SSR/static island and 13/13 browser evidence for no-JS DOM, isolation, hydration/nav races and RTL/theme. |
| T13  | implemented-and-verified | Accepted `d452c77`; focus/draft/resize/RTL/reduced-motion, keyboard clarification, truthful recovery states and a11y; focused 5/5, vNext browser 22/22, a11y 12/12, three-engine visual gate recorded by the clean final matrix. |
| T14  | implemented-and-verified | Accepted `a1db42d`/`aa1ef45`; explicit scope/target browser bridge, bounded metadata, actual renderer receipts, scope rebind and continuation reset; focused 6/6, agent 116/116, strict TypeScript and agent build. |
| T15  | implemented-and-verified | Accepted `2f8df85`; explicit no-auth allowlist and bearer/custom-header profiles with local HTTP conformance, correlation, limits, retries, timeout, cancellation and streaming rejection; focused 7/7, protocol 11/11, agents 116/116. |
| T16  | implemented-and-verified | Accepted `b79ab59`; trust-boundary/security fixtures, 14/14 security, 45/45 focused vNext security/local-data, 4/4 boundaries, 1000/1000 auth-retention, strict typecheck. |
| T17  | implemented-and-verified | Accepted `b64e043`/`733ed14`; source-driven active catalog inventory, public export/page/example parity, authored wording checks, inventory 71/71 and docs artifact 10/10. |
| T18  | implemented-and-verified | Accepted `52b2bfe`/`adef0f3`; four synthetic reference journeys, real scoped agent parity, remote transport fixture, host approval/revocation, and job progress/cancel/output refs; remote 1/1 and browser 4/4 in Chromium/Firefox/WebKit. |
| T19  | implemented-and-verified | Accepted final source-bound performance evidence; two-surface isolation, module tiers 10/100/1000, 5×100 samples/tier, every tier under the 100ms p95 budget, bundle 6/6 within the 163840-byte cap, and runtime/browser/heap gates green. |
| T20  | implemented-and-verified | Candidate 0.5.0 is unreleased/breaking from stable 0.4.2; latest packed five-package report under `artifacts/t20-qualification/` proves legacy/vNext/no-agent support and release tooling 31/31. |
| T21  | final-review-gated        | Independent final review and the clean 87-gate matrix are the handoff evidence; publication and deployment remain separately unauthorized. |

RQ45 remains owned by T01, but its evidence is deliberately split: T01 freezes
and typechecks the non-vacuous contract; T10/T12 execute the installed React
and visible SSR DOM consumers, and T20 reruns them from packed artifacts. The
requirement is runtime-verified locally; production runtime remains unverified.

## Release state

- Candidate built: locally qualified packed artifacts only; no registry/image publication.
- Independently reviewed: T02–T06 task candidates plus the final read-only T21 review.
- RC published: no.
- Stable published: no.
- Image published: no.
- Deployed: no.
- Runtime verified: focused T02 core behavior, T03 scoped surfaces, T04 guarded scope transitions, T05 bounded local binding, T06 remote/semantic execution, T16 security boundaries, T18 reference journeys, T19 performance, T20 clean packed consumers, and the final source-bound matrix. Production runtime remains unverified.

## Component documentation inventory

T17 source-driven inventory is complete at 71/71 active IDs; the detailed machine-readable report and docs artifact remain the evidence source for per-ID page/example/API/behavior coverage.
