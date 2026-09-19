# Aeliqo vNext execution state

Updated: 2026-09-19 15:38 Asia/Jakarta (execution started).

## Source and authority

- Canonical repository: Arconath/aeliqo.
- Inspected reference SHA: 9092d6cff454b81cd623a7a4be7621c6a750d9c7.
- Execution checkout: `/Users/nino/WORKS/Personal/Idea/Project/products/aeliqo`.
- Execution branch/base SHA: `codex/aeliqo-vnext` from `a06d0f9c8c17d71ee8bea776a80af38b542c153f`; the base tree matches reference `main` SHA `9092d6cff454b81cd623a7a4be7621c6a750d9c7`.
- Local changes: final-v3 plan reconciliation, repository addendum, T00 baseline/harness, the T01 design contract, and T02 core feature implementation.
- Public registry changes: none.
- Production changes: none.
- Live paid-model authorization for this vNext execution: not established.
- Merge/publication/deployment authorization for this vNext execution: must be verified against current policy and owner approvals.

## Progress

Planning pack: final-v3 validated from the supplied ZIP and pristine temporary extraction, then installed under this directory. The repository remote, protected-main policy, release workflows, pinned toolchain, exports, 71-component catalog, current docs, and quality matrix were observed locally. The vNext harness and strict typecheck pass. A full clean-source run reached 39/83 passing gates before the unchanged-source guard correctly rejected concurrent T01/T02 writes; it must be rerun from the next stable commit. Planning-pack validation remains separate from product evidence.

| Task | State                            | Evidence                                                                                                                                                     |
| ---- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T00  | in-progress                      | `BASELINE.md`, final-v3 integrity evidence, passing vNext harness, and two committed checkpoints; full unchanged-source `pnpm check` pending                 |
| T01  | design-contract-verified         | ADR 012 plus local/advanced/negative declaration consumers; strict TypeScript and ten non-vacuous negative cases pass; no runtime or installed-package claim |
| T02  | implemented-and-focused-verified | Real `@aeliqo/core/features` implementation, docs/export map, regressions, and installed tarball/Vite/Chromium consumer pass; not published                  |
| T03  | not-started                      | No implementation evidence                                                                                                                                   |
| T04  | not-started                      | Scope guard/ABA/isolation not implemented                                                                                                                    |
| T05  | not-started                      | No implementation evidence                                                                                                                                   |
| T06  | not-started                      | No implementation evidence                                                                                                                                   |
| T07  | not-started                      | No implementation evidence                                                                                                                                   |
| T08  | not-started                      | No implementation evidence                                                                                                                                   |
| T09  | not-started                      | Workspace composition not implemented                                                                                                                        |
| T10  | not-started                      | No implementation evidence                                                                                                                                   |
| T11  | not-started                      | No implementation evidence                                                                                                                                   |
| T12  | not-started                      | No implementation evidence                                                                                                                                   |
| T13  | not-started                      | No implementation evidence                                                                                                                                   |
| T14  | not-started                      | No implementation evidence                                                                                                                                   |
| T15  | not-started                      | No implementation evidence                                                                                                                                   |
| T16  | not-started                      | No implementation evidence                                                                                                                                   |
| T17  | not-started                      | Full live catalog inventory still required                                                                                                                   |
| T18  | not-started                      | No reference journey evidence                                                                                                                                |
| T19  | not-started                      | No qualification measurements                                                                                                                                |
| T20  | not-started                      | Version/support decision not yet executed                                                                                                                    |
| T21  | not-started                      | No reviewed/released vNext candidate                                                                                                                         |

## Next executable action

Commit the reviewed T01/T02 checkpoint, rerun fresh unchanged-source `pnpm check`, then begin T03 surface lifecycle implementation.

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

## Resuming existing work

This checkpoint is a fresh template only. Never overwrite a newer execution ledger with it. Reconcile v2 task IDs through PLAN-INDEX.json, preserve source-bound historical evidence and mark newly introduced gates unverified until rerun. Planning validation may be green while every product task here remains not-started.
