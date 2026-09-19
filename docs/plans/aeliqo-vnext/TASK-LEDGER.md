# Aeliqo vNext task ledger

This ledger supplements `07-EXECUTION-STATE.md`. States distinguish source implementation from verification and release.

| Task | State                    | Current evidence or next gate                                                                                                                                                                                                |
| ---- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T00  | verified                 | Baseline/harness complete. Full clean-source matrix passed 83/83 at `dedc15e`; `artifacts/product-ci/ci.json` records `sourceChangedDuringRun: false`.                                                                       |
| T01  | design-contract-verified | ADR 012 and complete positive/negative declaration-only consumers pass strict TypeScript. This is not installed-package or runtime acceptance.                                                                               |
| T02  | implemented-and-verified | Immutable data/non-data definitions, compatibility lowering, package export/docs and clean tarball consumer pass; collision and nested-mutation regressions added after independent review; full matrix passed at `dedc15e`. |
| T03  | not-started              | Depends on T02.                                                                                                                                                                                                              |
| T04  | not-started              | Depends on T03.                                                                                                                                                                                                              |
| T05  | not-started              | Depends on T04.                                                                                                                                                                                                              |
| T06  | not-started              | Depends on T05.                                                                                                                                                                                                              |
| T07  | not-started              | Depends on T03 and T06.                                                                                                                                                                                                      |
| T08  | not-started              | Depends on T07.                                                                                                                                                                                                              |
| T09  | not-started              | Depends on T04 and T08.                                                                                                                                                                                                      |
| T10  | not-started              | Depends on T04 and T09.                                                                                                                                                                                                      |
| T11  | not-started              | Depends on T04 and T10.                                                                                                                                                                                                      |
| T12  | not-started              | Depends on T10.                                                                                                                                                                                                              |
| T13  | not-started              | Depends on T08–T12 as indexed.                                                                                                                                                                                               |
| T14  | not-started              | Depends on T04, T09–T11.                                                                                                                                                                                                     |
| T15  | not-started              | Depends on T14.                                                                                                                                                                                                              |
| T16  | not-started              | Depends on T11, T12, T14, T15.                                                                                                                                                                                               |
| T17  | not-started              | 71 catalog IDs are present; per-ID behavior/example evidence remains.                                                                                                                                                        |
| T18  | not-started              | Depends on T17.                                                                                                                                                                                                              |
| T19  | not-started              | Depends on integration, docs, and journey tasks.                                                                                                                                                                             |
| T20  | not-started              | Depends on T17–T19.                                                                                                                                                                                                          |
| T21  | not-started              | Requires all prior tasks, fresh unchanged-source checks, and independent review.                                                                                                                                             |

RQ45 remains owned by T01, but its evidence is deliberately split: T01 freezes
and typechecks the non-vacuous contract; T10/T12 must execute the installed
React and visible SSR DOM consumers, and T20 must rerun them from packed
artifacts. T01 is therefore `design-contract-verified`, not fully implemented
or runtime-verified, until those downstream gates close the same requirement.

## Release state

- Candidate built: no.
- Independently reviewed: no.
- RC published: no.
- Stable published: no.
- Image published: no.
- Deployed: no.
- Runtime verified: focused T02 core behavior only; end-to-end vNext runtime no.

## Component documentation inventory

T17 must expand this section to one row per active catalog ID with page, example, API-fact, behavior, browser, and installed-consumer evidence. Baseline set equality alone is not completion.
