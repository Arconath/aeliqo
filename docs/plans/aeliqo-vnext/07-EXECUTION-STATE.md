# Aeliqo vNext execution state

Updated: 2026-09-19 18:11 Asia/Jakarta (T03 review-round-2 fixes verified; next fix commit pending).

## Source and authority

- Canonical repository: Arconath/aeliqo.
- Inspected reference SHA: 9092d6cff454b81cd623a7a4be7621c6a750d9c7.
- Execution checkout: `/Users/nino/WORKS/Personal/Idea/Project/products/aeliqo`.
- Execution branch/base SHA: `codex/aeliqo-vnext` from `a06d0f9c8c17d71ee8bea776a80af38b542c153f`; the base tree matches reference `main` SHA `9092d6cff454b81cd623a7a4be7621c6a750d9c7`.
- Local changes: final-v3 plan reconciliation, repository addendum, T00 baseline/harness, the T01 design contract, T02 core feature implementation, T03 scoped surfaces plus round-1 corrections committed through `bffdec2`, and uncommitted review-round-2 fixes on that exact base.
- Public registry changes: none.
- Production changes: T02 core feature definitions; T03 runtime surface modules, app/Region integration, exports, docs, and installed-consumer coverage; uncommitted T03 denial-publication and capability-initialization review fixes.
- Live paid-model authorization for this vNext execution: not established.
- Merge/publication/deployment authorization for this vNext execution: must be verified against current policy and owner approvals.

## Progress

Planning pack: final-v3 validated from the supplied ZIP and pristine temporary extraction, then installed under this directory. The repository remote, protected-main policy, release workflows, pinned toolchain, exports, 71-component catalog, current docs, and quality matrix were observed locally. The vNext harness and strict typecheck pass. After the intentionally retained concurrent-write rejection, a fresh clean-source run at `dedc15e` passed all 83 gates with `sourceChangedDuringRun: false`. Planning-pack validation remains separate from product evidence.

| Task | State                    | Evidence                                                                                                                                                     |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T00  | verified                 | `BASELINE.md`, integrity evidence, harness, two baseline checkpoints, and full unchanged-source 83/83 matrix at `dedc15e`                                    |
| T01  | design-contract-verified | ADR 012 plus local/advanced/negative declaration consumers; strict TypeScript and ten non-vacuous negative cases pass; no runtime or installed-package claim |
| T02  | implemented-and-verified | Real `@aeliqo/core/features` implementation, docs/export map, regressions, installed tarball/Vite/Chromium consumer, and full matrix pass; not published     |
| T03  | rereview-fixes-verified  | Initial and round-1 implementation committed through `bffdec2`; round-2 denial-publication and external-capability initialization fixes pass focused/broad gates in an uncommitted tree; next fix commit and acceptance review pending |
| T04  | not-started              | Scope guard/ABA/isolation not implemented                                                                                                                    |
| T05  | not-started              | No implementation evidence                                                                                                                                   |
| T06  | not-started              | No implementation evidence                                                                                                                                   |
| T07  | not-started              | No implementation evidence                                                                                                                                   |
| T08  | not-started              | No implementation evidence                                                                                                                                   |
| T09  | not-started              | Workspace composition not implemented                                                                                                                        |
| T10  | not-started              | No implementation evidence                                                                                                                                   |
| T11  | not-started              | No implementation evidence                                                                                                                                   |
| T12  | not-started              | No implementation evidence                                                                                                                                   |
| T13  | not-started              | No implementation evidence                                                                                                                                   |
| T14  | not-started              | No implementation evidence                                                                                                                                   |
| T15  | not-started              | No implementation evidence                                                                                                                                   |
| T16  | not-started              | No implementation evidence                                                                                                                                   |
| T17  | not-started              | Full live catalog inventory still required                                                                                                                   |
| T18  | not-started              | No reference journey evidence                                                                                                                                |
| T19  | not-started              | No qualification measurements                                                                                                                                |
| T20  | not-started              | Version/support decision not yet executed                                                                                                                    |
| T21  | not-started              | No reviewed/released vNext candidate                                                                                                                         |

## Next executable action

Controller integrates the verified T03 review-round-2 fixes into an exact source commit, records that commit SHA, then requests acceptance review before T04 begins.

## Decisions to preserve

Feature template != live surface instance. Render components receive controllers. No-AI and agent paths share operations and state ownership. Data coverage and business meanings are explicit. Backend permissions and effects remain host-owned. Every component needs accurate docs and executable examples. Support and scale claims require scoped evidence.

## Log format for subsequent entries

Record task ID and requirements; current branch/SHA/diff hash; files changed/owned; command and exit status; artifact location; verified behavior; failures/blockers; decision and reason; next exact command/action. Keep important failures rather than replacing them with a later summary of successes.

## Execution log

### T00 / RQ01 / RQ32 — baseline and harness

- Remote observed as `git@github.com:Arconath/aeliqo.git`; remote `main` was `9092d6cff454b81cd623a7a4be7621c6a750d9c7` and its tree matched the local base.
- Final-v3 archive SHA-256: `f8fd9790666033a10cab5ed134e68ee512371d616013babae05ca7d281569104`. Supplied directory/archive and pristine temporary copy passed the read-only validator; all 16 payloads matched.
- `pnpm test:vnext` first observed a strict type error for an incorrect fixture type name, then passed after using the existing `LocalSnapshot` export: 1 test, 1 file, plus strict typecheck.
- `pnpm check` exit 1 before the checkpoint commit with `Quality requires a clean source checkout.` This is retained as evidence that the quality driver enforces unchanged source; it must be rerun from the committed checkpoint.
- The committed `dedc15e` rerun passed all 83 commands. `artifacts/product-ci/ci.json` binds the exact source revision, reports `status: passed`, and records `sourceChangedDuringRun: false`; Chromium, Firefox, and WebKit visual gates all exited 0.
- No model call, package publication, image publication, deployment, or production operation occurred.

### T01 / RQ03 / RQ45 — declaration-only API design contract

- ADR 012 freezes `aeliqo.surface/1`, lifecycle/ownership boundaries, the explicit 0.4 compatibility path, local identity behavior, and the documentation source map.
- Complete design consumers cover local rows, remote source, two instances, external ownership, native React views, the SSR visible-content expectation, voluntary switching, forced logout, workspace-layout adaptation, and explicitly targeted optional-agent lifecycle.
- Independent review rejected the first passing draft because intent generics were erased, data features could bypass the existing data service, the legacy app type was synthetic, one local controller had two render owners, and SSR evidence was vacuous. The revised contract binds data features to `DataService`, non-data features to capability bindings, uses the real 0.4 `AeliqoApp`, exercises lifecycle cleanup, and carries real visible SSR evidence forward instead of manufacturing success.
- `pnpm exec tsc -p tests/vnext/tsconfig.json --noEmit` passed with ten active `@ts-expect-error` boundaries and no `TS2578`. Prettier, Knip, and diff checks pass.
- This is design-contract verification only. RQ45 remains owned by T01 but open beyond its design half: T10/T12 must produce real installed React and visible SSR DOM evidence, and T20 must repeat it from packed artifacts before RQ45 can be runtime-verified.

### T02 / RQ04 / RQ33 — immutable feature contracts

- Added real core modules for data and non-data feature definitions, validation, compatibility lowering through `defineResource`, root/subpath exports, package documentation, and clean-tarball consumer coverage.
- Independent review found a collision-prone version-reference key and mutable nested catalog/entity metadata. The implementation now reuses the collision-safe canonical key, freezes owned metadata without freezing the caller's schema, runtime-freezes default aliases, and includes regressions for both findings.
- Fresh focused evidence: vNext suite 8/8, core contracts 182/182, semantics 34/34, package-boundary tests 4/4, core build, strict vNext typecheck, full lint/Knip/site verification, and installed tarball/Vite/Chromium consumer. Consumer report: `artifacts/core-consumers/run-qbohF7/report.json`.
- No model call, package publication, image publication, deployment, or production operation occurred.

### T03 / RQ05 / RQ07 — scoped surfaces, ownership, and registry lifecycle

- Initial implementation source: branch `codex/aeliqo-vnext`, commit `b3f17a1139023285f83e9cacd25101ec8e41469e`. Review round 1 returned NEEDS FIXES; those corrections were committed and reviewed at `bffdec2ee87ec4cfc302a89ef14637ae077caaec`. Review round 2 also returned NEEDS FIXES. Its corrections are currently uncommitted on exact base `bffdec2ee87ec4cfc302a89ef14637ae077caaec` with implementation digest `8a3ec51dbb99fa8647cfa662fcd101b29f398b0ba796b988e6ad55d6d9985ba2`; the next fix commit SHA is pending and must be recorded by the controller after commit, not invented here.
- Mandatory RED evidence: the exact isolation test first failed with one missing `createPeopleFixture`; the three focused T03 files then failed 10/10 at the missing production fixture boundary. No fake dispatcher was used to manufacture a pass.
- Added DOM-free `packages/runtime/src/surfaces/` controller, state, lifecycle, ownership, registration, scope, and runtime-factory modules. `createSurface`, `createLocalSurfaceScope`, immutable addresses/snapshots, per-scope feature reference counts, generation fencing, bounded proposals, explicit host `proposalDecision`, idempotent teardown, and existing DataService/Region/Result execution are wired through real runtime exports.
- Construction is inert: data slots are allocated without creating a Region observer, transport, timer, or source call; the RegionStore handle and DataService request begin only on explicit `request()`. The focused test observes zero calls at construction and a separately gated real execute start.
- T01 contract reconciliation: inert construction plus non-optional `SurfaceSnapshot.state: S` made the declaration's missing initial state unsound. The implemented binding now requires `initialState`; ADR 012, `api-contract.ts`, and the advanced declaration consumer were updated to match. Runtime tests and the installed tarball consumer, not those declarations, are the behavior evidence.
- Review-fix RED evidence: controlled acceptance after a permission revision exposed ready host rows; denied paths exposed `undefined as S`; a capability surface without a default exposed `undefined as I` and its new negative type probe reported unused `@ts-expect-error`; throwing listeners rejected request/dispose and retained the external subscription; a callback that recorded then threw left a late-acceptable proposal; and per-ID generation sequencing failed the global-monotonic regression.
- Round-2 RED evidence: after an authorized ready state was revoked, the denied request notified zero subscribers because validation had already cached the mask through `getSnapshot()`; external capability construction threw before the host could initialize its address-bearing snapshot; and strict TypeScript rejected the new `initialIntent` binding while its missing-intent negative probe was unused.
- Round-2 GREEN evidence: the denied transition publishes the typed inert state exactly once and repeated denied reads/requests do not duplicate it. Capability bindings provide an address-independent typed `initialIntent`; construction never reads the external store, and a real external capability can initialize the host snapshot from the returned address, propose, and adopt an accepted publication. Focused T03 suite 25/25 in 3 files plus strict TypeScript; `pnpm test:vnext` 33/33 in 5 files; runtime build; boundaries 4/4; full lint/Knip/site verification; format; and diff check all exit 0.
- Installed-package round-2 evidence: `pnpm test:runtime:consumers` packed and installed core/runtime outside the workspace, typechecked required capability binding initial intent plus existing positive/negative surface API, and executed two-instance data, controlled data, and controlled external-capability acceptance paths. Report: `artifacts/runtime-consumers/run-edxqqJ/report.json`.
- Review fixes capture and recheck the scope permission revision for external proposals, mask denial with copied typed `initialState`, publish each denial transition once, require a typed address-independent capability binding `initialIntent`, isolate observer/unsubscribe exceptions, retire proposals when `onProposal` throws, and replace per-ID tombstones with one monotonic bounded-memory generation counter.
- Retained gate failures: the first lint run found `commitInternal` complexity 13 over the limit 12; extraction reduced it. The next run found unused exported alias `CreateSurfaceInput`; removing the redundant alias made the full lint/Knip/site gate pass. These were quality failures, not waived checks.
- Existing 0.4 app/Region APIs remain the compatibility path. T04 still owns scope switching, leave guards, forced revocation, and A-B-A transition behavior. No round-2 fix commit, model call, package publication, image publication, deployment, or production operation occurred.

## Resuming existing work

This checkpoint is a fresh template only. Never overwrite a newer execution ledger with it. Reconcile v2 task IDs through PLAN-INDEX.json, preserve source-bound historical evidence and mark newly introduced gates unverified until rerun. Planning validation may be green while every product task here remains not-started.
