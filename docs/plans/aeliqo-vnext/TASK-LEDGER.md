# Aeliqo vNext task ledger

This ledger supplements `07-EXECUTION-STATE.md`. States distinguish source implementation from verification and release.

## Current 0.5 candidate — PR #31 (2026-09-24)

The current source is the clean head of `codex/aeliqo-0.5-site-docs` in
[PR #31](https://github.com/Arconath/aeliqo/pull/31). Read its `headSha` and
the matching Quality report; earlier SHA-specific tables and checkpoints below
are historical evidence, not the candidate's current release state.

F02/T10 scope and API, F06/F09/T18 J1–J3 runtime and presentation, F10/F11/T17
public playground and docs, and T14/T15 trusted model runner have integrated
source and focused verification. The installed core tarball consumer passed
after a bundle-size correction at 71,672/71,680 bytes gzip; vNext 289/289,
lint, format, and performance bundle 6/6 passed. F13/T20–T21 and A41/A45–A50
remain release-gated: the final-head 89-gate PR Quality, accepted `main` Quality,
authorized real-model evaluation, exact-source registry packages, immutable
site image, platform cutover, live smoke, and rollback evidence are still
required. No paid provider call or 0.5 stable publication is claimed. The
older 80/88 report is interrupted and does not count as a pass.

## 2026-09-24 0.5 closure overlay

The integrated correction checkpoint below records pre-freeze source
evidence. F02/T10, F06/F09/T18, F10/F11/T17, and T14/T15 have focused local
verification recorded in `07-EXECUTION-STATE.md`, including the new 89th
offline J1–J3 quality gate. A41 live model evidence is blocked at zero paid
requests pending its separate authorization. F13/T20–T21 release evidence is
open until one candidate SHA passes PR and main Quality, exact registry and
image proofs, platform cutover, live smoke, and rollback qualification. The
read-only registry preflight found `0.5.0-rc.2` and stable `0.5.0` available
for all five package names; availability is not publication evidence.

The starting source for the current correction is clean branch
`codex/aeliqo-0.5-site-docs` at
`6c468f909e3a5d7699ef844a0589e12feb7b7afe`. The previous overlay below
describes the earlier uncommitted `930ba21` checkpoint and is historical.
The `6c468f9` quality report is interrupted at 80/88 and still says `running`;
it is not an acceptance pass. This checkpoint's focused checks cannot replace
exact-source PR and main Quality qualification.

F02/T10 (React scope/API), F06/F09/T18 (J1–J3 runtime and presentation),
F10/F11/T17 (public playground/docs), T14/T15 (local runner and model profile),
and F13/T20–T21 (release evidence) are open in this correction. Focused J2/J3
tests passed 35/35, runtime presentation 58/58, and Chromium browser 12/12
after period-bound and registered-pattern changes. These results do not close
the A-case matrix. Ruling: the J3 approved registered pattern uses
`allowWithoutPreset: false` and the existing bounded search so generic
three-table suggestions do not replace the intended summary/trend/breakdown;
if another host wants generic layouts, it must approve them in its experience.

## 2026-09-24 local site/docs overlay

Starting source is `930ba212142caecf9a18df2d71adf343bdbf2986`; the current 0.5.0 edits are local and uncommitted while verification finishes. F10/A43 now has authored Purpose coverage for all 71 component pages, one sidebar entry per component on every component route, source-derived 71/63/6 standalone/semantic/adaptive maturity, and expanded task-specific public/package guidance. `pnpm test:docs-artifact` passed for 126 pages/71 components; the full docs browser suite passed 13/13. F11/A44 has a passing `pnpm site:test`, `pnpm test:catalog-examples`, lint/Knip, format, and focused Chromium/Firefox/WebKit action-review tests. The 639-case catalog visual batch passed across all three browsers; the remaining dirty-source batches were stopped because the final clean-source `pnpm check` reruns the complete matrix. A43–A44 and A50 require an exact clean candidate commit and a new `pnpm check` report bound to that commit before final qualification.

The inspected `/docs/*` redirects, 0.3 migration guide, and legacy deprecation script still have active consumers or cutover duties. Keep the prior production image, npm artifacts, and Git tags for rollback. Retire old UI surfaces only after a verified site cutover. The existing `0.5.0-rc.1` packages came from older source and cannot qualify this candidate. A41 paid evaluation, A45–A48 registry/image publication and deployment, and A49 human study remain separate from local implementation evidence.

## Current-source reconciliation (2026-09-23)

`4a31da6a862bc1bc7d06f791369f0753a80fdd39` was pushed to `main` after
its unchanged-source local `pnpm check` passed 87/87. Independent A35 review
then found that a newly selected lazy native React view could fail without a
retained authorized view or retry. Commit `f1dc737` added a trusted `load`
registration and tests for failure/retry, context/portal/controlled-input
continuity, prior-view eligibility, and equivalent registry rebuilds. Its
focused vNext 283/283, browser 54/54, installed framework consumer, site
build/test, docs artifact, lint, format, and bundle 6/6 passed. A subsequent
StrictMode regression exposed duplicate initial loader calls and was corrected
with a focused browser check. Synthetic remote cancellation and no-agent
disconnect evidence was also strengthened. Their release gate is a
clean-source `pnpm check` and remote same-SHA Quality run; the earlier 4a31
Quality run cannot qualify them.

The next source checkpoint adds a complete copyable no-AI React starter;
bounded civil-date, long-lived React update, and pending-load unmount tests;
and a canonical 27-case J1–J3 screenshot-capture, keyboard, and axe gate
across three browsers and three viewport widths. Captures have no approved
pixel baseline; representative screenshots were reviewed manually. Its
release qualification depends on an exact-source full matrix.

The local 0.5.0 candidate extends this baseline with `createLocalDataSurface`,
the React `useDataSurface`/`AdaptiveSurface` convenience route, committed
presentation evidence, monotonic local revisions, selector and disposal
guards, and loopback-only no-auth model profiles. Focused worktree results are
listed in `07-EXECUTION-STATE.md`. The first clean `pnpm check` passed 87/87 at
`58f13a9`, but later whole-diff review found defects requiring correction. Only
a fresh `pnpm check` artifact whose source revision equals the final `HEAD` can
satisfy the unchanged-source final gate. A01–A50 remain baseline NOT RUN in
`03-ACCEPTANCE.md` until exact-source evidence is reconciled.

A second clean matrix passed 87/87 at `122ab40a7eaf0faf08e069e6778bbf402564489e`
with unchanged source. The subsequent integrated J3 browser fixture and public
documentation corrections require a new final-source matrix. Focused J3 checks
passed vNext 281/281, browser 50/50, and bundle 6/6 without changing the
163,840-byte `region-table` cap. The synthetic J3 fixture uses one fixed
principal and an explicit registered pattern candidate; scope isolation and
automatic empty-candidate discovery are separate claims.

- The earlier `c0b4a64dac6b507b8eeb50195e3bd36e43bb7eb8` main baseline and pushed `4a31da6` candidate are historical checkpoints. A35 follow-up was committed as `f1dc737`; later corrections need their own exact-source gate.
- Fresh npm registry reads show all five public packages (`core`, `runtime`, `web`, `react`, `agent`) at `latest=0.4.2` and `next=0.5.0-rc.1`. GitHub publish run `35816382654` used `main` source `c0b4a64dac6b507b8eeb50195e3bd36e43bb7eb8`; the newer local candidate was not in that RC. Published npm versions are immutable, so that RC cannot be overwritten with this source.
- `release-metadata.json` describes 0.5.0 as a candidate; that source metadata is not registry publication evidence. Registry facts were read with `npm view @aeliqo/<package> dist-tags --json` and `npm view @aeliqo/<package> versions --json` for each of the five names.
- Existing T00–T20 evidence below records accepted earlier source revisions. Keep that history intact; it does not establish that the added A01–A50 cases pass at c0b4a64. Those operational cases are recorded as NOT RUN in `03-ACCEPTANCE.md` pending exact-current-source evidence.
- Historical T-task rows remain bound to their recorded source revisions. For the final local candidate, check `git status`, `HEAD`, and `artifacts/product-ci/ci.json` together; an earlier clean matrix does not certify later corrections.

| Task | State                    | Current evidence or next gate                                                                                                                                                                                                                                                                                                        |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T00  | verified                 | Baseline/harness complete. Final clean-source matrix passed 87/87; `artifacts/product-ci/ci.json` records the exact source revision and `sourceChangedDuringRun: false`.                                                                                                                                                             |
| T01  | design-contract-verified | ADR 012 and complete positive/negative declaration-only consumers pass strict TypeScript. This is not installed-package or runtime acceptance.                                                                                                                                                                                       |
| T02  | implemented-and-verified | Immutable data/non-data definitions, compatibility lowering, package export/docs and clean tarball consumer pass; collision and nested-mutation regressions added after independent review; full matrix passed at `dedc15e`.                                                                                                         |
| T03  | implemented-and-verified | Accepted `4422b0d`: authority-fenced proposals, typed safe denial and capability intent, exception-isolated observers, failed-proposal retirement, bounded generations, exactly-once internal/external denial publication, 34/34 vNext, installed evidence at `artifacts/runtime-consumers/run-edxqqJ/report.json`; not published.   |
| T04  | implemented-and-verified | Accepted `f2c5389`: guarded two-phase scope activation, reentrancy-safe terminal receipts, real parent/child/peer isolation, 61/61 focused, 95/95 vNext, runtime regressions, and installed evidence at `artifacts/runtime-consumers/run-pKLQlG/report.json`; not published.                                                         |
| T05  | implemented-and-verified | Accepted `867192f`: bounded local binding/inference, atomic schema-validated replacement, pre-commit source fencing, 47/47 focused, 129/129 vNext, package regressions, installed core/runtime consumers and independent correction review; not published.                                                                           |
| T06  | implemented-and-verified | Accepted `22b6950`: real HTTP transport, explicit remote capability/coverage behavior, bounded authority-partitioned cursors/cache reuse, source-lineage/result proof, expected-value metric semantics, 178/178 vNext, clean core/runtime consumers and independent re-review; not published.                                        |
| T07  | implemented-and-verified | Accepted `1e4fa2f`: one deterministic owned-input resolver, candidate isolation, bounded identities, authorized target/commit fencing, cancellation rollback, hostile Proxy/accessor rejection, 204/204 vNext, 52/52 adaptation, browser and clean tarball evidence, full site matrix, and independent final reviews; not published. |
| T08  | implemented-and-verified | Accepted source `61ab509`: registered bar analysis, bounded identity-scoped comparison split, adaptive table/cards, exact source-lineage isolation through plot internals, browser/SSR/docs/consumer evidence, and independent final review; not published.                                                                          |
| T09  | implemented-and-verified | Accepted source `756dbf6`; real runtime coordinating surface, custom layout/selection intents, bounded single/split/compare plans, immutable child addresses, cancellation/renderer-failure retention, 4/4 focused tests, and strict vNext TypeScript. Browser focus/resize/draft evidence is T10/T13.                               |
| T10  | implemented-and-verified | Accepted `42d0c5b` with `5e00232`/`ce00be0`; scoped React bindings and native/headless views, effect-owned lifecycle, 5/5 React tests, 13/13 vNext browser tests, strict TypeScript and packed framework consumer.                                                                                                                   |
| T11  | implemented-and-verified | Accepted `b3f0aa8`; real host-owned actions and non-data job capability with durable effects/progress/cancel/output refs; focused 8/8, runtime build and strict vNext TypeScript.                                                                                                                                                    |
| T12  | implemented-and-verified | Accepted `617a7ed` with `ce00be0`; request-scoped SSR/static island and 13/13 browser evidence for no-JS DOM, isolation, hydration/nav races and RTL/theme.                                                                                                                                                                          |
| T13  | implemented-and-verified | Accepted `d452c77`; focus/draft/resize/RTL/reduced-motion, keyboard clarification, truthful recovery states and a11y; focused 5/5, vNext browser 22/22, a11y 12/12, three-engine visual gate recorded by the clean final matrix.                                                                                                     |
| T14  | implemented-and-verified | Accepted `a1db42d`/`aa1ef45`; explicit scope/target browser bridge, bounded metadata, actual renderer receipts, scope rebind and continuation reset; focused 6/6, agent 116/116, strict TypeScript and agent build.                                                                                                                  |
| T15  | implemented-and-verified | Accepted `2f8df85`; explicit no-auth allowlist and bearer/custom-header profiles with local HTTP conformance, correlation, limits, retries, timeout, cancellation and streaming rejection; focused 7/7, protocol 11/11, agents 116/116.                                                                                              |
| T16  | implemented-and-verified | Accepted `b79ab59`; trust-boundary/security fixtures, 14/14 security, 45/45 focused vNext security/local-data, 4/4 boundaries, 1000/1000 auth-retention, strict typecheck.                                                                                                                                                           |
| T17  | implemented-and-verified | Accepted `b64e043`/`733ed14`; source-driven active catalog inventory, public export/page/example parity, authored wording checks, inventory 71/71 and docs artifact 10/10.                                                                                                                                                           |
| T18  | implemented-and-verified | Accepted `52b2bfe`/`adef0f3`; four synthetic reference journeys, real scoped agent parity, remote transport fixture, host approval/revocation, and job progress/cancel/output refs; remote 1/1 and browser 4/4 in Chromium/Firefox/WebKit.                                                                                           |
| T19  | implemented-and-verified | Accepted final source-bound performance evidence; two-surface isolation, module tiers 10/100/1000, 5×100 samples/tier, every tier under the 100ms p95 budget, bundle 6/6 within the 163840-byte cap, and runtime/browser/heap gates green.                                                                                           |
| T20  | implemented-and-verified | Breaking 0.5.0 newer source candidate is unpublished; stable remains 0.4.2 and `0.5.0-rc.1` exists from older source. The packed five-package report under `artifacts/t20-qualification/` proved legacy/vNext/no-agent support and release tooling 31/31 at its historical source.                                                   |
| T21  | final-review-gated       | Independent final review and the clean 87-gate matrix are the handoff evidence; publication and deployment remain separately unauthorized.                                                                                                                                                                                           |

RQ45 remains owned by T01, but its evidence is deliberately split: T01 freezes
and typechecks the non-vacuous contract; T10/T12 execute the installed React
and visible SSR DOM consumers, and T20 reruns them from packed artifacts. The
requirement is runtime-verified locally; production runtime remains unverified.

## Release state

- 0.5.0 newer source candidate built: locally qualified packed artifacts; no registry/image publication of this source.
- Independently reviewed: T02–T06 task candidates plus the final read-only T21 review.
- 0.5.0 RC published: yes, `0.5.0-rc.1` for all five packages from earlier source `c0b4a64`. It lacks the newer React local data path and is not an accepted RC for this candidate; qualification requires a new approved version and exact-source evidence.
- 0.5.0 stable published: no. Registry `latest` remains on 0.4.2 for all five packages.
- 0.5.0 image published: no.
- 0.5.0 deployed: no.
- Runtime verified: focused T02 core behavior, T03 scoped surfaces, T04 guarded scope transitions, T05 bounded local binding, T06 remote/semantic execution, T16 security boundaries, T18 reference journeys, T19 performance, T20 clean packed consumers, and the final source-bound matrix. Production runtime remains unverified.

## A01–A50 current-candidate evidence overlay

The A-case table in `03-ACCEPTANCE.md` preserves the handoff baseline state at
`c0b4a64`. This overlay records what was actually exercised for the newer local
candidate. “Bounded” means the named synthetic/local profile passed; it does
not assert every environment or a live provider. The first full matrix report
at `artifacts/product-ci/ci.json` was 87/87 for `58f13a9`, before subsequent
review corrections. A final claim requires that report to be rerun with its
`sourceRevision` equal to final `HEAD` and `sourceChangedDuringRun: false`.

The later exact-source matrix at `587430c` stopped at gate 84 after 83 passes;
Chromium, Firefox, and WebKit visual suites passed, while one vNext browser test
observed a Vite same-URL reload and lost its comparison DOM. The test server
was corrected to prebundle React explicitly without late dependency discovery;
focused browser checks passed 47/47 and 141/141 repeated. The candidate then
merged current `origin/main` at `368cffc` locally, retaining the removal of
automatic production promotion. Neither the failed matrix nor the focused
reruns qualified the merged source. The subsequent clean `122ab40` matrix
passed 87/87; the new J3 and docs edits require another clean run.

| Cases   | Owner       | Code and executable evidence                                                                                                                                | Current result or limit                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01     | F00         | Git/registry/workflow readback above; `artifacts/product-ci/ci.json`                                                                                        | Partial: facts were refreshed after the first matrix; final SHA must match its report.                                                                                                                                                                                                                                                                                                                                                |
| A02     | F01/F02     | `packages/react/src/surface/local.tsx`; `tests/vnext/react.spec.tsx`, `tests/release/t20-packaging.test.mjs`                                                | Local packed consumer bounded; published RC lacks this API.                                                                                                                                                                                                                                                                                                                                                                           |
| A03–A05 | F02/F03     | `tests/vnext/local-convenience.test.ts`, `tests/vnext/react.spec.tsx`, `tests/vnext/security.test.ts`                                                       | Partial: malformed/empty/identity cases are exercised; selection/detail/edit targeting is outside the beginner browse path.                                                                                                                                                                                                                                                                                                           |
| A06–A07 | F02/F03     | `tests/vnext/browser/react-local.spec.ts`                                                                                                                   | Bounded prop replacement, address retention, version signal, and rejected-update recovery.                                                                                                                                                                                                                                                                                                                                            |
| A08     | F03         | `tests/runtime-data/monotonic-source-revision.test.ts`, `tests/vnext/browser/react-local.spec.ts`                                                           | Bounded runtime replay fence plus 260 sequential browser updates on one React surface, followed by a valid recovery update, pass. Longer production workloads remain unmeasured.                                                                                                                                                                                                                                                      |
| A09–A10 | F02/F06     | `tests/vnext/browser/react-selectors.spec.ts`                                                                                                               | Bounded selector stability and unrelated-render counts.                                                                                                                                                                                                                                                                                                                                                                               |
| A11–A12 | F02/F09     | `tests/vnext/react.spec.tsx`, `tests/vnext/browser/react-local.spec.ts`, `tests/vnext/browser/react-adaptive.spec.ts`                                       | Strict Mode, inert SSR and ownership are bounded. Unmount during a held native load releases the measured surface listener and leaves no late view; a complete cross-adapter retained-handle/job census remains open.                                                                                                                                                                                                                 |
| A13–A16 | F04/F06     | `tests/vnext/react.spec.tsx`, `tests/vnext/presentation.test.ts`, `tests/vnext/browser/react-adaptive.spec.ts`                                              | Bounded shared resolver, eligibility/pins, resize and narrow container behavior.                                                                                                                                                                                                                                                                                                                                                      |
| A17–A19 | F03/F05/F06 | `tests/vnext/journey-attendance.test.ts`, `tests/query/civil-weekly.test.ts`, `examples/vnext/attendance/`, `tests/vnext/browser/attendance.spec.ts`        | Bounded daily ratios, real half-open civil-date boundary, New York DST civil-day labels, missing/future/partial data, ambiguity, runtime chart, visible period/metric, and browser clarification pass. Non-UTC instant period execution remains explicitly unsupported and rejects before evaluation.                                                                                                                                 |
| A20     | F03         | `tests/vnext/metrics.test.ts`, `tests/semantics/`                                                                                                           | Bounded independent ratio, units, decimal and aggregation expected values.                                                                                                                                                                                                                                                                                                                                                            |
| A21     | F05/F07     | `tests/vnext/journey-workspace-goal.test.ts`, `examples/vnext/workspace/goal.ts`, `examples/vnext/workspace-goal/`, `tests/vnext/browser/workspace.spec.ts` | Bounded integrated browser flow: one registered three-need Task, three runtime Results, a registered pattern candidate, committed plan, and real summary/trend/breakdown DOM. Unknown goals reject; empty-candidate automatic pattern discovery remains unproved.                                                                                                                                                                     |
| A22–A24 | F07         | `tests/vnext/workspace-layout.test.ts`, `tests/vnext/scope-race.test.ts`, `examples/vnext/workspace/`, `tests/vnext/browser/workspace.spec.ts`              | Bounded child ownership, prior-layout retention, capacity/cycle rejection, fixed-scope integrated plan, and child DOM focus/resize/result retention. The integrated fixture retains its old view after mandatory breakdown failure; cross-scope proof belongs to the separate scope/security suites.                                                                                                                                  |
| A25–A29 | F07/F08     | `tests/vnext/scope-draft.test.ts`, `tests/vnext/scope-race.test.ts`, `tests/vnext/agent-bridge.test.ts`, `tests/vnext/actions.test.ts`                      | Bounded voluntary/forced transitions, A-B-A fencing, controlled receipts, and scoped continuity.                                                                                                                                                                                                                                                                                                                                      |
| A30–A33 | F03/F08     | `tests/vnext/remote-data.test.ts`, `tests/vnext/remote-server.test.ts`, `tests/vnext/journey-remote.test.ts`                                                | Bounded synthetic HTTP evidence asserts the accepted first-page and global-count queries at the server, rejected unsupported operations with zero execution, cursor/lineage behavior, and a blocked adapter that produces a partial descriptor after caller cancellation while the surface stays unchanged. The cancelled transport does not prove delivery of a complete late response to the client. No customer server was tested. |
| A34     | F09         | `tests/vnext/browser/ssr.spec.ts`, `tests/next-platform/`                                                                                                   | Bounded no-JS authorized DOM, hydration and principal isolation.                                                                                                                                                                                                                                                                                                                                                                      |
| A35–A36 | F06/F09     | `tests/vnext/react.spec.tsx`, `tests/vnext/browser/react-adaptive.spec.ts`, `tests/vnext/browser/visual-journeys.spec.ts`, three-engine visual matrix       | Bounded native React context, portal, controlled-input continuity, lazy-load failure/retry, initial StrictMode loader deduplication, prior-view eligibility, and registry-update browser checks pass. J1–J3 screenshot capture, axe, and keyboard activation cover 27 browser/viewport/journey combinations; captures have no pixel baseline. Human assistive-technology use remains unproved.                                        |
| A37     | F08         | `tests/release/t20-packaging.test.mjs`, `apps/site/tests/site/byok.spec.ts`, no-agent packed graph                                                          | Bounded packed import graph and browser request trace cover no-agent manual use, explicit provider disconnect, and subsequent manual intent with no new provider/browser requests.                                                                                                                                                                                                                                                    |
| A38–A40 | F08         | `tests/vnext/security.test.ts`, `tests/vnext/actions.test.ts`, `tests/agents/`, protocol suites                                                             | Bounded hostile-input, synthetic action and explicit model-profile checks.                                                                                                                                                                                                                                                                                                                                                            |
| A41     | F08         | `tests/agent-evaluation/` synthetic runner only                                                                                                             | External blocker: no approved paid provider/budget/corpus run.                                                                                                                                                                                                                                                                                                                                                                        |
| A42–A43 | F10/F11     | `tests/performance/`, `tests/docs-artifact/`, `tests/catalog-examples/`, `artifacts/product-ci/ci.json`                                                     | Bounded at the first SHA; final source requires renewed full performance/docs gates.                                                                                                                                                                                                                                                                                                                                                  |
| A44     | F11/F12     | `quality/commands.json`, `artifacts/product-ci/ci.json`; separate `pnpm audit --prod --audit-level high` and `pnpm licenses list --prod --json`             | Partial: 87 local gates passed at the first SHA and audit found no known high vulnerabilities; license inventory is not legal clearance or image smoke.                                                                                                                                                                                                                                                                               |
| A45     | F12         | npm integrity/provenance for five `0.5.0-rc.1` packages; GitHub run `35816382654`                                                                           | Failed for this candidate: RC source is `c0b4a64`, and its React tarball lacks the newer local-data hook.                                                                                                                                                                                                                                                                                                                             |
| A46–A48 | F12/F13     | Registry tags, release workflow and public `/version` readback                                                                                              | External blocker: no corrected-source RC/stable install, 0.5 tag/release, immutable site image, authorized promotion or rollback proof.                                                                                                                                                                                                                                                                                               |
| A49     | F10/F13     | `examples/vnext/host-only/`, `tests/vnext/browser/host-only-baseline.spec.ts`, four existing journey fixtures                                               | Partial: one equivalent synthetic Jakarta task passes in Aeliqo and host-only UI; no human participants or measured savings.                                                                                                                                                                                                                                                                                                          |
| A50     | F11/F13     | RQ01–RQ46 table in `03-ACCEPTANCE.md`; this ledger and source-bound reports                                                                                 | Partial until final SHA, acceptance gaps, exact cleanup inventory and release state are reconciled.                                                                                                                                                                                                                                                                                                                                   |

J1 also has a bounded manual/connected-agent parity fixture in
`tests/vnext/journey-jakarta-agent.test.ts`: both requests produce the same
Jakarta rows on one scoped surface, and a missing or disallowed target cannot
change it. The agent client uses a fake model and host renderer receipt; actual
browser DOM and live-model quality are separate evidence.

F00 is refreshed but remains tied to final-source reconciliation. F01–F11 have
local implementation and bounded checks with the limits above. F12 is failed
for the published RC's source match and blocked on a correctly authorized
successor. F13 remains open for final same-source acceptance, release/site
readback and honest unresolved limits. No historical T-task row or available
RC attestation can stand in for those gates.

Cleanup inventory: `apps/site/generate-pages.mjs` still emits the `/docs/*`
redirect map consumed by `apps/site/deploy/server.go` and its route tests;
`docs/site/pages/migration-0.3.md` is linked by the current packages, ship,
and release pages; `scripts/release/deprecate-legacy.mjs` is covered by release
tests and remains necessary for the post-cutover notice. These are active
compatibility or cutover assets, so there is no proven-obsolete file in this
inspected set to delete before production promotion. The published 0.4.2
artifacts, tags, and prior site image are rollback assets. Recheck exact
consumers after the new site is stable before retiring old UI surfaces.

## Component documentation inventory

T17 source-driven inventory is complete at 71/71 active IDs; the detailed machine-readable report and docs artifact remain the evidence source for per-ID page/example/API/behavior coverage.
