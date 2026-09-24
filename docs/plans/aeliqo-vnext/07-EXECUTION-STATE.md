# Aeliqo vNext execution state

## 2026-09-24 J2 live-result correction — current PR #31 worktree

The last pushed clean source was `0e79f69cf43d873610ba71ccc6252b8118a4b6f6`.
Its DeepSeek `deepseek-flash` run used the approved 24 additional requests and
reported 12/12 under the earlier scorer (`artifacts/agent-evaluation/live-journeys/0e79f69/report.json`,
source digest `7993d41343a5356ebecc2c8be60bae7eefcf3c11e1e523532c8fde7edefba9e2`,
estimated US$0.0386559, unchanged source). Independent review found that J2
rendered English chart labels despite the corpus prompt explicitly requesting
Indonesian output. Its 12/12 score therefore remains historical diagnostic
evidence, not full A41 qualification. The conservative approved call count is
108/108. No further paid call is authorized yet.

The corrective worktree passes the host's Indonesian locale to the region
chart, shows the approved 1–5 September Jakarta period, and uses an Indonesian
meaning label. The live scorer now requires the visible language, exact
rendered daily rows, registered J3 child output, and bounded J1 identity; it
rejects the old J2 report. The live driver records bounded model-submitted
tool arguments and receipt states for diagnosis. Focused live-offline checks
passed (10 Node tests, 4 browser tests), as did the web build, SSR, lint,
docs artifact (126 pages and 71 components), site build, and site tests
including 24 visual baselines. Catalog examples passed 3/3, component
accessibility passed 12/12, and J1–J3 visual journeys passed 27/27 across
Chromium, Firefox, and WebKit at 360, 768, and 1440 pixels. These are
dirty-source focused checks; they do not qualify the release. PR Quality run
`35954283291` was cancelled because it applies only to the superseded source.

The J2 host owns its approved as-of period: an omitted model period uses the
visible host period and fixed query filter, while an explicit alternate period
is rejected. The live gate qualifies the rendered outcome and boundary, not
independent date arithmetic by the model.

The next clean corrected commit, new exact-source PR Quality, fresh authorized
live run, accepted-main push Quality, registry publications, image, platform
promotion, live smoke, and rollback proof remain required. `RELEASED_VERIFIED`
is not assigned.

## 2026-09-24 release-candidate checkpoint — PR #31

PR #31 previously contained clean source
`4662b25d87521f853093f7de3d24e72962387664`. Its GitHub Quality run
`35949889987` had only passed policy when these corrections were identified;
that is not functional qualification. Earlier run `35911405421` passed 89/89
at `46c6aa6`, a different SHA. The older `6c468f9` report at 80/88 remains
an interrupted historical checkpoint. The commit containing this checkpoint
must obtain its own exact-source PR Quality; use the PR run artifact for its
source SHA and final result rather than interpreting an earlier SHA as current.

The authorized full DeepSeek `deepseek-flash` evaluation at clean
`4662b25` passed all 12 synthetic J1–J3 browser/provider/renderer cases.
Its source-bound report is
`artifacts/agent-evaluation/live-journeys/4662b25/report.json`: 24 provider
requests, estimated US$0.0377736, unchanged source, corpus SHA256
`512f1d5bff233c708fe9067ede55ff3f6666b6279391834a91c07d7b240c30e6`.
J1/J2/J3 success rendered committed results; all nine ambiguity, unsupported
and adversarial cases preserved the previous UI without a commit. The first
full run (10/12), targeted diagnostics, and one interrupted diagnostic bring
the conservative aggregate to 60/60 approved requests. These costs are
estimates, not a provider invoice. Do not make further paid requests under
this authorization.

Read-only acceptance and UI audits then found a missing installed-package
proof for the exact beginner React example, a missing loopback HTTP action
confirmation proof, and colliding Playground title letters at narrow widths.
Focused consumer/action tests and a one-line title-spacing correction are
included in the commit containing this checkpoint. `pnpm site:build`, `pnpm site:test`,
`pnpm test:framework:consumers`, `pnpm test:vnext` (295/295), and focused
action HTTP tests passed after these edits; independent visual inspection
confirmed the corrected title at 360, 768, and 1440 pixels. These changes
supersede clean `4662b25` for release, so both its PR Quality and live-model
report remain earlier-source checkpoints. Require a successful exact-source
Quality run for the corrected PR head before merge.

Registry preflight found `0.5.0-rc.2` and `0.5.0` available for all five
packages. No merge to `main`, publication of these versions, image publication,
or deployment has occurred. Remaining gates are corrected exact-source PR
Quality, accepted `main` and its push Quality, reconciliation of live-model
evidence with final source within approved paid limits,
RC/stable registry consumers, image and ZIP proof, platform promotion, live
smoke, and rollback proof. `RELEASED_VERIFIED` is not assigned. Aeliqo owns
this repository; the platform task owns shared admission and promotion.

## 2026-09-24 0.5.0 closure in progress

### Integrated correction checkpoint (pre-freeze evidence, 2026-09-24)

- React scope children now follow committed authorization, including initial,
  denied, revocation, dirty voluntary transition, and A→B→A epochs. The scoped
  `useSurface(feature, { id, bindings })` path uses the host runtime and nearest
  active scope; the existing factory path remains. J2 query bounds derive from
  the visible Asia/Jakarta period. J3 discovers its registered pattern with an
  empty candidate list and preserves the three distinct child Results.
- The public playground contains People Jakarta, Daily attendance, and
  Analytical workspace alongside four earlier scenarios. The reviewed
  clarification, reset, inspector, and committed-filter feedback defects were
  corrected. Browser provider-key input and direct provider transport were
  removed. The local runner requires an explicit trusted model profile.
- A 12-case J1–J3 live evaluation corpus, real browser host, scorer, and
  request/spend preflight exist. The approved DeepSeek example is deliberately
  `authorized: false`; its dry report has zero provider requests and zero
  spend. Live model quality is still unverified. Current official peak prices
  used for reservation are $0.30 per million cache-miss input tokens and $1.20
  per million output tokens; the full 48-request reservation is $0.576.
- The site-release workflow now requires successful exact-source stable npm
  publication, a fresh five-package registry/provenance consumer, current
  `latest` dist-tags, and installation/build of all four exported ZIP projects
  before enabling export in the immutable image. A stable-build simulation
  generated release-aware public copy; it did not publish an image.
- Fresh pre-freeze checks passed: `pnpm site:test` (including 24 visual
  baseline cases), `pnpm test:docs-artifact` (126 pages, 71 components),
  `pnpm test:catalog-examples` (3/3), `pnpm test:release-tooling` (31/31),
  `pnpm test:vnext` (289/289), `pnpm test:vnext:browser` (61/61),
  `pnpm test:vnext:visual` (27/27 across Chromium, Firefox, WebKit),
  `pnpm test:agent-evaluation:host` (28/28),
  `pnpm test:agent-evaluation:live-offline` (7 Node and 3 browser),
  `pnpm test:framework:consumers`, `pnpm test:performance:bundles` (6/6),
  `pnpm lint`, and `pnpm format:check`. Source edits after an individual check
  still require the PR Quality matrix on the final commit. Read-only npm
  preflight found all five `0.5.0-rc.2` and `0.5.0` versions available.
- The acceptance matrix now has 89 gates, including the offline J1–J3 model
  host. The prior 80/88 interrupted report remains historical. Open gates:
  independent final diff review, one frozen candidate commit, PR Quality,
  required push Quality on accepted `main`, separately authorized paid live
  evaluation, owner publication, image proof, platform promotion, live smoke,
  and rollback evidence. `RELEASED_VERIFIED` is not assigned.

- Accepted starting source for this correction is clean branch
  `codex/aeliqo-0.5-site-docs` at
  `6c468f909e3a5d7699ef844a0589e12feb7b7afe`. The earlier paragraph
  below records the historical `930ba21` worktree before that source was
  committed; it is not the current candidate state.
- `artifacts/product-ci/ci.json` still reports `running` at `6c468f9` with
  80 completed of 88 scheduled gates after an interrupted run. It is not a
  pass and cannot be resumed as an unchanged-source qualification. No 0.5
  stable package or site from this source is published.
- The source correction targets the authorized React scope boundary
  and scoped hook, trusted local model runner, three public journeys, live
  AI evidence, truthful export/docs, and exact-source release gates. J2 civil
  bounds now derive from its displayed period. J3 resolves its registered
  pattern with an empty candidate list and commits three distinct child
  views. Focused J2/J3 Vitest 35/35, runtime presentation 58/58, and J2/J3
  Chromium browser 12/12 passed in this dirty worktree; these are not release
  qualification.
- After integration and independent review, make one source candidate commit,
  run the full Quality matrix against that unchanged commit, and reconcile
  the A01–A50 evidence. The platform task owns shared deployment state.

### Release operator continuation (planned; no release command run here)

The product operator owns the Aeliqo repository's Quality, package publish,
and site image workflows. The platform operator owns shared GitOps admission,
`production-deploy.py prepare`, promotion preflight, and rollback execution
from current `platform-apps/main`. No product task should push platform state.

1. Review the candidate source and independent findings, then freeze one
   source commit on the approved single PR branch. Require its PR
   Quality report. Merge only through required checks; record accepted `main`
   SHA and its successful push Quality run. An interrupted or different-SHA
   `artifacts/product-ci/ci.json` cannot satisfy this gate.
2. Recheck npm availability. Owner-dispatch `release-publish.yml` for the next
   available 0.5 RC from accepted `main`, verify its five installed packages,
   then owner-dispatch matching stable `0.5.0` from the same SHA using that RC
   evidence. Keep each workflow's candidate manifest, publication record,
   registry consumer report, package integrity, and provenance.
3. Owner-dispatch `site-release.yml` on the same `main` SHA with the successful
   stable publication run ID in `stable_publish_run_id`. Its gate downloads the
   exact-source publication artifact, reinstalls five packages from npm,
   verifies source-bound provenance, and only then enables ZIP export for the
   immutable site image. Record Quality run, site-release run, image digest,
   SBOM/scan/provenance, and image route/health smoke. A missing artifact or
   mismatched version/source keeps export disabled and blocks image publish.
4. Give the platform operator the accepted SHA, run IDs, verified image digest,
   ephemeral qualification, and prior image digest. Platform prepares and
   preflights promotion before cutover. After cutover verify `/healthz`,
   `/readyz`, `/version`, landing, docs, search, catalog, playground, ZIP
   registry install, and manual J1–J3. Keep the prior image for rollback;
   repair an already published npm version with a patch rather than unpublish.

These are procedures, not evidence that publication, deployment, human
usability, or rollback has occurred. `RELEASED_VERIFIED` remains closed until
source, registry, image, live site, and rollback evidence all match.

## 2026-09-24 local 0.5.0 site and documentation correction

- Starting source: clean `main` at `930ba212142caecf9a18df2d71adf343bdbf2986`. The worktree now contains local 0.5.0 candidate edits; none of the earlier exact-source matrix reports qualify these edits. Do not publish, deploy, or promote from this dirty state.
- Product shape remains five packages plus one public site. The playground now presents intent, validated result, and rendered view as a readable journey; manual use stays available without AI. Schema-derived create/edit forms use collection-safe labels. The action review retains completion until explicit Done, fences a rapid second click, and restores focus to the initiating control in Chromium, Firefox, and WebKit focused browser checks. The disconnected and BYOK paths retain honest status text.
- All 71 component pages now expose a grouped component sidebar with the current page and family visible, plus a compact mobile toggle and keyboard focus treatment. Catalog maturity derives from registered representations/recipes: 71 standalone web elements, 63 with semantic binding, and 6 with a standard adaptive recipe. Purpose text was reviewed for every component; source-backed failure, state, and accessibility details were corrected where needed. Public agent, HTTP, SSR, workspace, custom-view, form, migration, and release pages were expanded against actual contracts.
- Current dirty-source checks: `pnpm site:test` passed, including site build/typecheck, browser, BYOK, local runner, all documentation navigation/previews, responsive/layout, server/provenance, and 24 visual-baseline cases; `pnpm test:docs-artifact` passed with 126 pages, 71 components, 12 Node tests, Vitest and TypeScript; `pnpm test:catalog-examples` passed 3/3; `pnpm lint` and `pnpm format:check` passed. The dedicated docs browser suite passed 13/13, including all 71 routes and mobile keyboard/a11y checks. The first `pnpm test:visual` batch passed 639/639 catalog cases across Chromium, Firefox, and WebKit; the remaining duplicate dirty-source batches were intentionally stopped so the required clean-source `pnpm check` can run the complete visual matrix once. Independent read-only final diff review found no concrete blocker; `git diff --check` passed.
- These checks establish local behavior for the edited surfaces, not release qualification. Next: create one accepted clean candidate commit, run `pnpm check` on that unchanged commit (including the complete three-engine visual matrix), then verify exact-source packed packages/image and owner-controlled release gates. Paid model evaluation, publication, merge, and deployment retain separate authorization; the older 0.4.2 site/image and npm artifacts remain rollback assets.

## 2026-09-23 current-main candidate continuation

- Pushed `main` commit `4a31da6a862bc1bc7d06f791369f0753a80fdd39` passed the unchanged-source local 87/87 `pnpm check`. Its GitHub Quality run `35848925683` is source-bound to that SHA, not to later edits. A post-push A35 review found missing native React lazy-view recovery. Commit `f1dc737` added a trusted `load` registration, eligible prior-view retention, and retry. Browser tests cover context/portal/controlled-input continuity, loader failure and retry, prior-view deregistration, and equivalent registry rebuilds. Focused vNext 283/283, vNext browser 54/54, installed framework consumer, site build/test, docs artifact, lint, format, and bundle 6/6 passed for that checkpoint. A later review found duplicate initial lazy loads in React StrictMode; a new browser regression failed 2 versus 1 before the loader correction and passed afterward. Synthetic remote query/cancellation and no-agent disconnect evidence was also strengthened. Publication qualification depends on a clean exact-source full matrix for the corrected source.
- After `b4ee986`, the resumed exact-source matrix was intentionally stopped after 27 passing gates when a read-only UI/docs audit found two missing acceptance artifacts. The following source adds a complete four-file no-AI React starter (extracted snippet typechecks), 260 sequential local React updates on one surface, a held native loader unmount/listener check, civil-date boundary and DST rejection tests, and a canonical 27-case J1–J3 three-engine screenshot-capture/keyboard/axe gate at 360/768/1440 pixels. Focused React browser 18/18, attendance 7/7, civil weekly 6/6, capture/axe/keyboard 27/27, and docs artifact 10/10 passed. These focused checks do not qualify release; use the final exact-source matrix artifact for that claim. Representative screenshots were reviewed without finding clipping or overlap, but there is no approved pixel baseline or automated visual comparison. Human assistive-technology use and full non-UTC instant-period evaluation are not claimed.

- A later clean `pnpm check` passed 87/87 at `122ab40a7eaf0faf08e069e6778bbf402564489e`: `artifacts/product-ci/ci.json` recorded that exact `sourceRevision`, `status: passed`, and `sourceChangedDuringRun: false`. Chromium, Firefox, WebKit, vNext browser, and bundle gates all passed. Subsequent J3 browser integration and public-doc corrections changed the source, so this is a checkpoint rather than qualification of the next candidate commit.
- The integrated J3 fixture now compiles one registered summary/trend/breakdown goal, evaluates three Results, offers one bounded registered pattern, commits the selected plan, and renders all three in one Region. Browser tests assert real child DOM, identities, narrow/wide layout, and retention after unknown-goal and mandatory breakdown failures. Focused vNext 281/281, browser 50/50, bundle 6/6 at the unchanged 163,835/163,840-byte `region-table` cap, TypeScript, lint, format, and Knip passed. The host supplies the pattern candidate; empty-candidate discovery and live model behavior are unproved. Scope isolation comes from separate scope/security suites, not this fixed-principal fixture.
- Independent docs review found an invalid public `defineView` example, an inaccurate hosted BYOK privacy claim, and missing public workspace/analytics/advanced-scope guides. The example and disclosure were corrected; the guides and canonical routes were added. Focused docs artifact 10/10 and catalog inventory 71/71 passed during this work. A new exact-source full matrix is required after these edits.
- Fresh `origin/main` baseline: `c0b4a64dac6b507b8eeb50195e3bd36e43bb7eb8`; the historical T-task rows below remain source-bound to earlier revisions.
- Current work is a local 0.5.0 candidate on `main`. It adds the beginner React data path, runtime presentation evidence, long-lived monotonic local revisions, resolver-backed native React adaptation, selector and disposal fixes, loopback-only local model auth, candidate docs, and packed consumer coverage. Read `TASK-LEDGER.md` for the F00–F13/A01–A50 crosswalk.
- Fresh focused results before the clean-source matrix: `pnpm test:vnext` 270/270; `pnpm test:vnext:browser` 33/33; `pnpm test:data` 109/109; `pnpm test:release-tooling` 31/31 with five packed packages and the new no-agent entry graph; `pnpm test:docs-artifact` 10/10 plus 71/71 catalog inventory; `pnpm test:catalog-examples` 3/3; `pnpm site:build`, `pnpm site:test`, `pnpm lint`, `pnpm format:check`, and `pnpm test:performance:bundles` pass. Latest bundle report: `artifacts/performance-bundles/run-IRth9J/report.json`, 163,835/163,840 bytes gzip for `region-table`.
- The first clean-source `pnpm check` passed 87/87 at `58f13a9b7e9f530890edf6499a91c6444f920081` with `sourceChangedDuringRun: false`. Independent whole-diff review then found an advanced React region-ID mismatch, an SSR identity-preview mismatch, stale local recovery feedback, and documentation/status drift. Corrections have focused runtime/SSR/browser regressions and independent re-review with no remaining blocker in those paths. The first matrix is not final candidate evidence; qualification requires a later clean-source matrix on the corrected `HEAD`.
- At the earlier post-review checkpoint, `pnpm test:vnext` passed 281/281, `pnpm test:vnext:browser` 47/47, `pnpm format:check` passed, and `pnpm test:performance:bundles` passed 6/6 with `region-table` at 163,835/163,840 bytes gzip. Those dirty-worktree checks do not replace a clean-source matrix. They covered J1 Jakarta wide/narrow and late receipt fencing, J2 daily attendance values/clarification/keyboard/accessibility, the host-only baseline, and J3's separate registered child views with retained result, focus, and 360/768/1440 reflow. A separate scoped fake-model test proved J1 intent/target parity. The newer integrated J3 browser path is recorded above.
- An interim bundle invocation failed its source-stability assertion while another worker was editing the new workspace fixture; the subsequent stable-source bundle run passed. The failed run is not a budget regression or release evidence.
- The first exact-source final matrix on `587430cca7e5ada0216d45b6c29f58c942814500` reached 83 passing gates, including all three visual engines, then failed gate 84 (`test:vnext:browser`, 46/47). The failure trace shows a same-URL Vite page reload after the Compare click; the page reset the comparison status to Idle. The isolated test passed 10/10. The vNext test server now prebundles React explicitly and disables late dependency discovery; the browser suite passed 47/47 and then 141/141 across three repeats. This correction requires a new full matrix; the failed report remains in `artifacts/product-ci/ci.json` until replaced by that run.
- Fresh `origin/main` moved to `368cffc1c2499841fe15d29ea80c1bee79a55347`, removing automatic production promotion and its deploy-secret reference. The candidate merged that remote commit locally without a push or source rewrite. The deleted workflow remains deleted; publication and site cutover still require the current owner-controlled pipeline.
- After that merge, `pnpm test:release-tooling` exposed a stale test assertion requiring the release notes to call all of 0.5.0 unreleased even though RC1 is published from older source. The assertion now requires the truthful source-candidate heading, the published `next` RC, and its older-source limitation; the focused release tooling suite passes 30/30 under the new workflow policy.
- Independent runtime/security review found no confirmed defect in the initial runtime seam. Earlier UI review led to fixes for the narrow React browse transition, fixture title/h1, unstable allocating selectors, and disposed fixed-view exposure. The React correction re-review was read-only and bounded to changed paths; installed-package and final integrated evidence remain separate.
- Fresh registry facts: each public package remains `latest=0.4.2` and now has `next=0.5.0-rc.1`. GitHub publish run `35816382654` completed from `main` at `c0b4a64dac6b507b8eeb50195e3bd36e43bb7eb8`, before this local candidate's React data path. This RC is a real external publication, but it is not a publication or qualification of the newer candidate. No paid model call, push, remote merge, package publication by this task, image promotion, or production operation occurred here. A corrected-source RC, clean registry consumer, same-SHA CI, owner dispatch, site promotion, and live verification remain separate gates.
- Read-only production readback on 2026-09-23: `https://aeliqo.com/version` and `https://docs.aeliqo.com/version` both report SDK/site revision `9092d6cff454b81cd623a7a4be7621c6a750d9c7` and SDK version `0.4.2`. `/healthz`, `/readyz`, `/start/`, and `/playground/` returned HTTP 200. These observations establish the currently live older site, not vNext deployment or image digest.

The 2026-09-20 checkpoint and detailed T-task history follow.

Updated: 2026-09-20 (final-v3 implementation and acceptance checkpoint).

## Source and authority

- Canonical repository: Arconath/aeliqo.
- Inspected reference SHA: 9092d6cff454b81cd623a7a4be7621c6a750d9c7.
- Execution checkout: `/Users/nino/WORKS/Personal/Idea/Project/products/aeliqo`.
- Execution branch/base SHA: `codex/aeliqo-vnext` from `a06d0f9c8c17d71ee8bea776a80af38b542c153f`; the base tree matches reference `main` SHA `9092d6cff454b81cd623a7a4be7621c6a750d9c7`.
- Local changes: final-v3 plan reconciliation, repository addendum, T00 baseline/harness, the T01 design contract, accepted T02–T20 implementation, quality-gate corrections, and source-bound acceptance evidence; the live 0.4.2 line remains unchanged and no publish/deploy was authorized.
- Public registry changes: T08 registered the existing bar visualization path and
  bounded data-detail comparison composition through the existing registry;
  no new public package was published.
- Production changes: T02 core feature definitions; T03 runtime surface modules; T04 host-resolved scopes and safe transitions; T05 bounded local binding and source replacement; T06 remote capability/coverage contracts, authoritative stream/result pins, bounded cursor/cache semantics, and validated analytics meanings; T07 deterministic adaptive resolution, candidate isolation, and fenced renderer commitment. T07 has completed independent review.
- Live paid-model authorization for this vNext execution: not established.
- Merge/publication/deployment authorization for this vNext execution: must be verified against current policy and owner approvals.

## Progress

Planning pack: final-v3 validated from the supplied ZIP and pristine temporary extraction, then installed under this directory. The repository remote, protected-main policy, release workflows, pinned toolchain, exports, 71-component catalog, current docs, and quality matrix were observed locally. The vNext harness, strict typecheck, focused implementation suites, and final clean-source acceptance are recorded in the source-bound artifacts under `artifacts/`; planning-pack validation remains separate from product evidence.

| Task | State                    | Evidence                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T00  | verified                 | `BASELINE.md`, integrity evidence, harness, baseline checkpoints, and the final unchanged-source 87/87 matrix recorded by `artifacts/product-ci/ci.json`                                                                                                                                                                                                                                                   |
| T01  | design-contract-verified | ADR 012 plus local/advanced/negative declaration consumers; strict TypeScript and ten non-vacuous negative cases pass; no runtime or installed-package claim                                                                                                                                                                                                                                               |
| T02  | implemented-and-verified | Real `@aeliqo/core/features` implementation, docs/export map, regressions, installed tarball/Vite/Chromium consumer, and full matrix pass; not published                                                                                                                                                                                                                                                   |
| T03  | implemented-and-verified | Accepted source `4422b0d`; scoped instances, authority-fenced controlled ownership, typed safe denial/intent, exactly-once publication, bounded lifecycle, 34/34 vNext, regressions, and installed runtime consumer pass; not published                                                                                                                                                                    |
| T04  | implemented-and-verified | Accepted source `f2c5389`; two-phase acceptance/commit, terminal-state and truthful-receipt reentrancy checks, real parent/child/peer isolation, 61/61 focused, 95/95 vNext, regressions, and installed runtime consumer pass; not published                                                                                                                                                               |
| T05  | implemented-and-verified | Accepted source `867192f`; bounded local binding and inference, atomic schema-validated updates, pre-commit source fencing, 47/47 focused, 129/129 vNext, full data/query/semantics/evaluation/Region/Result regressions, installed core/runtime consumers, site and visual gates; not published                                                                                                           |
| T06  | implemented-and-verified | Accepted source `22b6950`; real HTTP protocol fixture, explicit unsupported/coverage behavior, snapshot/live cursor fencing, authoritative aggregate/lineage proof, semantic expected-value fixtures, 178/178 vNext, regressions, installed core/runtime consumers, site and visual gates; not published                                                                                                   |
| T07  | implemented-and-verified | Accepted source `1e4fa2f`; deterministic owned-input resolver, bounded candidate IDs, pins/eligibility/clarification, candidate isolation, cancellation rollback, hostile Proxy/accessor rejection, 204/204 vNext, 52/52 adaptation, browser/consumer/site/performance evidence; not published                                                                                                             |
| T08  | implemented-and-verified | Accepted source `61ab509`; registered bar analysis, identity-scoped comparison split, adaptive table/cards, exact ResultRef lineage isolation through data/visualization/plot boundaries, browser/SSR/docs/consumer evidence, and independent review; not published                                                                                                                                        |
| T09  | implemented-and-verified | Source `756dbf6`; real runtime coordinating surface, registered custom layout/selection intents, validated bounded single/split/compare plans, immutable child addresses, renderer-failure retention, cancellation, unknown-intent rejection, 4/4 focused workspace tests, and strict vNext typecheck. Browser focus/resize/draft evidence remains T10/T13; not published or deployed.                     |
| T10  | implemented-and-verified | Source `42d0c5b` plus test/config corrections `5e00232` and `ce00be0`; native React/headless bindings, effect-owned lifecycle, SSR-safe views, 5/5 React tests, 13/13 vNext browser tests, strict TypeScript, and packed framework consumer evidence; not published.                                                                                                                                       |
| T11  | implemented-and-verified | Source `b3f0aa8`; real host action confirmation and non-data job capability/progress/cancel/output references; 8/8 focused tests, strict TypeScript, and runtime build; not published.                                                                                                                                                                                                                     |
| T12  | implemented-and-verified | Source `617a7ed` plus race correction `ce00be0`; request-scoped SSR/static island, no-JS useful DOM, principal isolation, slow hydration, rapid navigation, RTL/theme and browser evidence 13/13; not published.                                                                                                                                                                                           |
| T13  | implemented-and-verified | Source `d452c77`; adaptive focus/draft/resize/RTL/reduced-motion behavior, keyboard clarification, partial/unsupported/cancelled/denied recovery, and automated accessibility scan; focused 5/5, vNext browser 22/22, a11y 12/12; three-engine visual gate is recorded by the clean final matrix.                                                                                                          |
| T14  | implemented-and-verified | Sources `a1db42d` and `aa1ef45`; explicit scope/target browser bridge, bounded metadata, actual SurfaceController/renderer receipts, scope rebind and continuation reset; focused 6/6, agent 116/116, strict TypeScript and agent build; not published.                                                                                                                                                    |
| T15  | implemented-and-verified | Source `2f8df85`; explicit no-auth allowlist, bearer/custom-header profiles, correlation/malformed/oversize/retry/rate/timeout/cancel/streaming tests and local HTTP fixture; focused 7/7, protocol 11/11, agents 116/116; no paid call.                                                                                                                                                                   |
| T16  | implemented-and-verified | Source `b79ab59`; real security and trust-boundary fixtures for cross-tenant requests/cursors, ResultStore principal cache/revoke/TTL, origin/CSRF/redirect/SSR escaping, forged target/getter payloads, stale action confirmation, bounded agent quotas, and endpoint expiry; security 14/14, focused vNext security/local-data 45/45, boundaries 4/4, auth-retention 1000/1000, strict vNext TypeScript. |
| T17  | implemented-and-verified | Sources `b64e043` and `733ed14`; source-driven 71-ID page/example/export inventory, public-doc wording checks, and docs artifact verification; inventory 71/71 and docs artifact 10/10; not published.                                                                                                                                                                                                     |
| T18  | implemented-and-verified | Sources `52b2bfe` and `adef0f3`; public island, consumer manual/agent parity through real scoped bridge, enterprise independent remote transport/approval/revocation, and non-data job flows; Vitest remote 1/1 and Chromium/Firefox/WebKit 4/4 each; not published.                                                                                                                                       |
| T19  | implemented-and-verified | Sources `6fd4901`/`d9cd85a` plus the final source-bound run; module-scale 10/100/1000 with five active surfaces and 5×100 interactions/tier; every tier remains below the 100ms p95 budget, bundle gate 6/6 remains within the 163840-byte region-table cap, and runtime/browser/heap checks are green.                                                                                                    |
| T20  | implemented-and-verified | At this historical checkpoint, breaking 0.5.0 was unpublished and stable was 0.4.2; the packed five-package report under `artifacts/t20-qualification/` proved legacy/vNext/no-agent consumers and release tooling 31/31. The later `0.5.0-rc.1` publication from older source is recorded above.                                                                                                          |
| T21  | final-review-gated       | Independent review and the final 87-gate source-bound matrix are recorded before handoff; release readiness remains local-only and publication/deployment gates remain closed.                                                                                                                                                                                                                             |

## Next executable action

For the 2026-09-23 continuation, commit the reviewed local candidate and run
the clean-source `pnpm check` matrix on its exact SHA. Read the fresh artifact
and reconcile any failure before a release operation. Keep candidate artifacts
local until the actual release actor, approval, and promotion gates are met.

## Decisions to preserve

Feature template != live surface instance. Render components receive controllers. No-AI and agent paths share operations and state ownership. Data coverage and business meanings are explicit. Backend permissions and effects remain host-owned. Every component needs accurate docs and executable examples. Support and scale claims require scoped evidence.

## Log format for subsequent entries

Record task ID and requirements; current branch/SHA/diff hash; files changed/owned; command and exit status; artifact location; verified behavior; failures/blockers; decision and reason; next exact command/action. Keep important failures rather than replacing them with a later summary of successes.

## Execution log

### T08 / RQ12 — registered views, bounded composition, and state transfer

- Accepted source `61ab509bd8dd46a11fc6b583a31f9d8fba41d477`; clean source digest
  `8fba255d856f54690f66e1a246cb8261ca1fe3a6fcf81268cfbd8b073e7addbf`.
- Added the registered bar analysis path, identity-scoped split comparison,
  adaptive table/cards behavior, exact `sourceLineage` identity through data,
  visualization, and plot internals, plus runnable examples and docs.
- Verification: vNext 209/209, adaptation 56/56, vNext browser 6/6,
  adaptation browser 2/2, data semantic 42/42, plot 12/12, visualization
  30/30, visualization semantic 8/8, docs artifact, catalog examples, and
  packed consumer all passed. Evidence is recorded in
  `.superpowers/sdd/02-EXECPLAN/task-8-report.md`.
- Independent final review found no Critical or Important findings. Published,
  deployed, and production-runtime-verified remain false.

### T09 / RQ41 — bounded workspace composition without tenancy changes

- Accepted implementation source `756dbf6`; no public Workspace component or
  second workflow engine was introduced. Custom recipes match exact registered
  intent refs and reject generic/malformed registrations.
- `tests/vnext/fixtures/workspace.ts` uses a real runtime Region, one
  coordinating capability SurfaceController, registered custom layout and
  control-selection intents, core compilation/evaluation, registry-backed
  presentation resolution, Region presentation commit, and two real child
  surface addresses. `view.snapshot()` reads the committed Region plan and
  immutable child bindings.
- `tests/vnext/workspace-layout.test.ts` covers browse → control selection →
  compare, single/split/compare transitions, same scope instance/epoch,
  stable child owners/addresses, renderer preparation failure retention,
  cancellation fencing, and unknown custom-intent fail-closed behavior. Focused
  evidence: 4/4 tests; strict `tests/vnext` TypeScript and full vNext suite
  213/213 pass after the checkpoint source was built.
- Browser panes, focus, drafts, resize, and surrounding host chrome remain an
  explicit downstream T10/T13 gate. Nothing was published, deployed, pushed,
  or verified against production; no paid model/provider call occurred.

### T00 / RQ01 / RQ32 — baseline and harness

- Remote observed as `git@github.com:Arconath/aeliqo.git`; remote `main` was `9092d6cff454b81cd623a7a4be7621c6a750d9c7` and its tree matched the local base.
- Final-v3 archive SHA-256: `f8fd9790666033a10cab5ed134e68ee512371d616013babae05ca7d281569104`. Supplied directory/archive and pristine temporary copy passed the read-only validator; all 16 payloads matched.
- `pnpm test:vnext` first observed a strict type error for an incorrect fixture type name, then passed after using the existing `LocalSnapshot` export: 1 test, 1 file, plus strict typecheck.
- `pnpm check` exit 1 before the checkpoint commit with `Quality requires a clean source checkout.` This is retained as evidence that the quality driver enforces unchanged source; it must be rerun from the committed checkpoint.
- The committed `dedc15e` rerun passed all 83 commands. `artifacts/product-ci/ci.json` binds the exact source revision, reports `status: passed`, and records `sourceChangedDuringRun: false`; Chromium, Firefox, and WebKit visual gates all exited 0.
- A later source-bound rerun at `40754de` reached the visual Chromium gate after 79/87 earlier gates passed, but the catalog run hit an intermittent Vite/dist context-navigation failure after 212/213 cases. Targeted grid retries did not reproduce a product assertion failure; this retained failure is why the final source-bound matrix is rerun rather than inferred from the earlier pass.
- No model call, package publication, image publication, deployment, or production operation occurred.

### T01 / RQ03 / RQ45 — declaration-only API design contract

- ADR 012 freezes `aeliqo.surface/1`, lifecycle/ownership boundaries, the explicit 0.4 compatibility path, local identity behavior, and the documentation source map.
- Complete design consumers cover local rows, remote source, two instances, external ownership, native React views, the SSR visible-content expectation, voluntary switching, forced logout, workspace-layout adaptation, and explicitly targeted optional-agent lifecycle.
- Independent review rejected the first passing draft because intent generics were erased, data features could bypass the existing data service, the legacy app type was synthetic, one local controller had two render owners, and SSR evidence was vacuous. The revised contract binds data features to `DataService`, non-data features to capability bindings, uses the real 0.4 `AeliqoApp`, exercises lifecycle cleanup, and carries real visible SSR evidence forward instead of manufacturing success.
- `pnpm exec tsc -p tests/vnext/tsconfig.json --noEmit` passed with ten active `@ts-expect-error` boundaries and no `TS2578`. Prettier, Knip, and diff checks pass.
- This remains the design owner for RQ45. Installed React, visible SSR DOM, and packed-consumer evidence are now present in T10/T12/T20; the requirement is runtime-verified locally, while production runtime remains unverified.

### T02 / RQ04 / RQ33 — immutable feature contracts

- Added real core modules for data and non-data feature definitions, validation, compatibility lowering through `defineResource`, root/subpath exports, package documentation, and clean-tarball consumer coverage.
- Independent review found a collision-prone version-reference key and mutable nested catalog/entity metadata. The implementation now reuses the collision-safe canonical key, freezes owned metadata without freezing the caller's schema, runtime-freezes default aliases, and includes regressions for both findings.
- Fresh focused evidence: vNext suite 8/8, core contracts 182/182, semantics 34/34, package-boundary tests 4/4, core build, strict vNext typecheck, full lint/Knip/site verification, and installed tarball/Vite/Chromium consumer. Consumer report: `artifacts/core-consumers/run-qbohF7/report.json`.
- No model call, package publication, image publication, deployment, or production operation occurred.

### T03 / RQ05 / RQ07 — scoped surfaces, ownership, and registry lifecycle

- Accepted source: branch `codex/aeliqo-vnext`, commit `4422b0da8bfbd089c48ced718c6706617b5ef6b1`. The initial implementation was `b3f17a1`; review-round corrections landed at `bffdec2`, `bf8a136`, and `4422b0d`. Final independent review approved the task with no remaining Critical or Important findings.
- Mandatory RED evidence: the exact isolation test first failed with one missing `createPeopleFixture`; the three focused T03 files then failed 10/10 at the missing production fixture boundary. No fake dispatcher was used to manufacture a pass.
- Added DOM-free `packages/runtime/src/surfaces/` controller, state, lifecycle, ownership, registration, scope, and runtime-factory modules. `createSurface`, `createLocalSurfaceScope`, immutable addresses/snapshots, per-scope feature reference counts, generation fencing, bounded proposals, explicit host `proposalDecision`, idempotent teardown, and existing DataService/Region/Result execution are wired through real runtime exports.
- Construction is inert: data slots are allocated without creating a Region observer, transport, timer, or source call; the RegionStore handle and DataService request begin only on explicit `request()`. The focused test observes zero calls at construction and a separately gated real execute start.
- T01 contract reconciliation: inert construction plus non-optional `SurfaceSnapshot.state: S` made the declaration's missing initial state unsound. The implemented binding now requires `initialState`; ADR 012, `api-contract.ts`, and the advanced declaration consumer were updated to match. Runtime tests and the installed tarball consumer, not those declarations, are the behavior evidence.
- Review-fix RED evidence: controlled acceptance after a permission revision exposed ready host rows; denied paths exposed `undefined as S`; a capability surface without a default exposed `undefined as I` and its new negative type probe reported unused `@ts-expect-error`; throwing listeners rejected request/dispose and retained the external subscription; a callback that recorded then threw left a late-acceptable proposal; and per-ID generation sequencing failed the global-monotonic regression.
- Round-2 RED evidence: after an authorized ready state was revoked, the denied request notified zero subscribers because validation had already cached the mask through `getSnapshot()`; external capability construction threw before the host could initialize its address-bearing snapshot; and strict TypeScript rejected the new `initialIntent` binding while its missing-intent negative probe was unused.
- Round-2/3 GREEN evidence: denied transitions publish typed inert state exactly once for internal and externally controlled paths; repeated denied reads, host callbacks, and requests do not duplicate publication. Capability bindings provide an address-independent typed `initialIntent`; construction never reads the external store, and a real external capability initializes its host snapshot from the returned address, proposes, and adopts a correlated acceptance. Focused T03 suite 26/26 in 3 files plus strict TypeScript; controller-rerun `pnpm test:vnext` 34/34 in 5 files; runtime build; boundaries 4/4; full lint/Knip/site verification; format; and diff check all exit 0.
- Installed-package round-2 evidence: `pnpm test:runtime:consumers` packed and installed core/runtime outside the workspace, typechecked required capability binding initial intent plus existing positive/negative surface API, and executed two-instance data, controlled data, and controlled external-capability acceptance paths. Report: `artifacts/runtime-consumers/run-edxqqJ/report.json`.
- Review fixes capture and recheck the scope permission revision for external proposals, mask denial with copied typed `initialState`, publish each denial transition once, require a typed address-independent capability binding `initialIntent`, isolate observer/unsubscribe exceptions, retire proposals when `onProposal` throws, and replace per-ID tombstones with one monotonic bounded-memory generation counter.
- Retained gate failures: the first lint run found `commitInternal` complexity 13 over the limit 12; extraction reduced it. The next run found unused exported alias `CreateSurfaceInput`; removing the redundant alias made the full lint/Knip/site gate pass. These were quality failures, not waived checks.
- Final review evidence: `.superpowers/sdd/02-EXECPLAN/task-3-final-review.md` approved the focused `bf8a136..4422b0d` fix after prior full reviews; no blocking finding remains. Existing 0.4 app/Region APIs remain the compatibility path. T04 still owns scope switching, leave guards, forced revocation, and A-B-A transition behavior. No model call, package publication, image publication, deployment, or production operation occurred.

### T04 / RQ37 / RQ39 / RQ40 — scope activation, safe transitions, and draft guards

- Initial implementation source: branch `codex/aeliqo-vnext`, commit `7030e9751cc922d75dc13fe4719692e95e863151`. Accepted source after four focused correction commits/reviews: `f2c5389de46fe42745b2ec508c5a2d903994066f`. Review round 1 found one Critical, four Important, and two Minor findings; later reviews caught pre-fence acceptance ordering, true nested-scope evidence, synchronous lifecycle reentrancy, and truthful terminal receipts before acceptance.
- Mandatory RED: the exact A-B-A plan test failed 1/1 with `TypeError: runtime.createScope is not a function` after the real fixture was made runnable and before any scope production implementation. GREEN: the same test passes through real runtime, DataService, ResultStore, RegionStore, and immutable SurfaceController addresses.
- Added DOM-free `packages/runtime/src/scopes/` modules and `runtime.createScope({binding, initial})`. Construction is inert; attach owns initial resolution; trusted resolutions are copied, structurally compared, frozen, and bounded; selectors remain non-authoritative.
- Voluntary transitions capture selector, activation epoch, permission/policy, transition identity, and leave revision. Save waits for a real result; Discard is explicit; Stay and missing input retain A. B resolution and authorization occur while A remains visible; the runtime fences and releases A children before B activation effects/publication.
- Forced invalidation masks and fences synchronously before exception-isolated recovery/deactivation hooks. A denied target retains A only after fresh A authorization. Stale and cancelled transitions clear pending state. A-B-A epochs and global surface generations remain monotonic.
- Surface fence observation remains lazy: controller construction adds no fence listener; active requests, subscribers, and proposals own reference-counted listeners. Activation target registration disposes old surfaces and releases their Regions/registrations, with a 20-transition A-B-A bounded-lifecycle regression.
- Review-round-1 RED reproduced 10 failures with 20 prior tests passing: stale B authorization, two pre-aborted-signal paths, three capture/recheck host-read failures, malformed JavaScript leave state/decision, mutable published diagnostic, and two partial activation cleanup modes. A separate stage-label RED proved resolver exceptions were misreported as guard failures.
- Review-round-1 GREEN performs the final B authorization after the last awaited A check. Targeted-audit GREEN then synchronously rechecks the captured A/draft, fences A, and invokes the required host activation boundary with frozen A+B permission/policy evidence in the same turn; the host atomically revalidates before effects. Pre-aborted requests do not supersede work; all host guard reads are cleanup-contained and retain A only after fresh authority proof; closed bounded leave state/decisions, host outcomes, and diagnostics are copied/validated; activation failure cleans partial B effects; and runtime disposal releases an active request/proposal/surface graph.
- The isolation fixture now uses genuine parent, child, and peer ScopeControllers in one runtime, full-lineage-keyed membership, policy, runtime/DataService authority digests and private sources, the same surface ID, independent revocation/addresses/rows/transitions/callbacks, and isolated child-controller teardown. Sibling and ancestor widening are denied while parent and peer controllers remain active.
- The final two-phase host boundary performs side-effect-free synchronous acceptance before fencing A, then fences/deactivates A before committing B effects. It rechecks ownership after target/lifecycle fences, A/B deactivation, B commit/compensation, initial prepare/commit, and publication callbacks. Reentrant invalidation/disposal cannot resurrect a scope or return an active/stale/failed receipt after a terminal event; B compensation is exactly once.
- Final focused T04 evidence passes 61/61 in 3 files; `pnpm test:vnext` passes 95/95 in 8 files with strict typecheck. Regions 49/49; Results 23/23; Actions 29/29; authorization retention 1000/1000; boundaries 4/4; runtime build, repository typecheck, lint/Knip/site, format and installed runtime tarball consumer pass. Consumer report: `artifacts/runtime-consumers/run-pKLQlG/report.json`.
- Independent final evidence: `.superpowers/sdd/02-EXECPLAN/task-4-receipt-review.md` reports no findings and explicitly unblocks T05. The reviewed fix-4 package is `.superpowers/sdd/02-EXECPLAN/review-c8e06a4..f2c5389.diff`, SHA-256 `d3924a25ec83d438aa05572647fb632cfee606eccf276c2687ee65b790447c5d`.
- The brief names `pnpm test:auth-retention`, but this repository exposes that gate as `pnpm test:data:auth-retention`; the available gate passed 1000/1000. No alias or gate weakening was added.
- Detailed evidence and self-review: `.superpowers/sdd/02-EXECPLAN/task-4-report.md`. No model call, package publication, image publication, deployment, push, or production operation occurred.

### T05 / RQ08 — bounded local data and update correctness

- Initial implementation commit `a144e04` added `createLocalDataBinding` and bounded `inferLocalDataShape` while retaining the existing DataService, ResultStore, Region, surface, and scope execution path. Independent review rejected that first candidate for five correctness blockers; accepted correction source is `867192f`.
- Replacements now reuse feature schema validation, reject executable `toJSON`, preserve exact prior runtime/surface state on failed preparation, and publish only after normalization plus the final source-pin fence. Exact-object source pins use a private `WeakMap`; generic DataService objects are not duck-inspected.
- Callback identity inference records actual field access and accepts one uniquely accessed matching field, while constants, multi-field ambiguity, missing IDs, duplicates, hostile descriptors, nested values, capacity breaches, revision conflicts, and historical revision reuse fail explicitly.
- Fresh evidence: focused local-data plus ADC 47/47; vNext 129/129 with strict TypeScript; data 98/98; query 94/94; semantics 34/34; evaluation 15/15; Regions 49/49; Results 23/23; boundaries 4/4; full lint/Knip/site verification; format; diff check; site build/test; and 24 visual baselines.
- Clean installed evidence: `artifacts/core-consumers/run-DKKv0o/report.json` and `artifacts/runtime-consumers/run-ldVkBR/report.json`, both with unchanged source digests. The runtime consumer executes the same public package path and covers exact service identity, stable-address updates, isolation, revision/capacity rejection, rollback, shape bounds, exact partial coverage, and disposed-update safety.
- Reviewed correction package: `.superpowers/sdd/02-EXECPLAN/review-a144e04..867192f.diff`, SHA-256 `44b6cb4361682e217bca70c5831fb416bab43f64217caf0d38de8b4192069422`. Independent review found no remaining Critical or Important findings.
- Detailed evidence: `.superpowers/sdd/02-EXECPLAN/task-5-report.md`. Implemented and locally/runtime verified through real source and installed packages; not published, deployed, pushed, or verified against production.

### T06 / RQ09 / RQ10 / RQ43 — remote data, coverage, caching, and semantic correctness

- Accepted source: branch `codex/aeliqo-vnext`, commit `22b6950`. The reviewed package is `.superpowers/sdd/02-EXECPLAN/review-fbda9fd..22b6950.diff`, SHA-256 `3f5a6eaeebaf3317a3af25dbb26260d581ed696f0938d6c58c606c7951959d80`.
- The existing `DataService` describe/plan/execute boundary now carries declared metrics, stable snapshot/keyset pagination, complete/partial/unknown/estimated coverage, source lineage, population/query/plan/lineage pins, and structured unsupported remedies. No browser fetch-all fallback or second authoritative cache/evaluator was added.
- Local continuations use bounded opaque host-held tokens partitioned by host authority. Remote fixtures run a real localhost HTTP server with authenticated principal partitions, cursor integrity, in-flight mutation, cancellation, stable pagination, and bounded window generation rather than a mocked final result.
- Registered meanings are fully revalidated at planner construction and again at the untrusted logical-plan boundary. Semi-additive period-end aggregation preserves all latest-period ties, declared aggregation dimensions must map to trusted group keys, ratio/null/unit/currency/time rules are explicit, and partial pages cannot become plausible complete global aggregates.
- Independent review found one Important gap in the initial `4287f7a` candidate: global-aggregate count exceptions did not require complete accepted lineage and computed-definition evidence. `22b6950` requires the accepted lineage digest, recomputed descriptor lineage, same-query computed evidence, and an exact unique definition-to-measure derivation binding. Regressions cover missing proof, observed evidence, mismatched definitions, and valid empty/nonempty aggregates. Focused re-review approved the fix with no remaining Critical or Important finding.
- Fresh focused evidence on accepted source: vNext 178/178; data 107/107; query 97/97; semantics 35/35; evaluation 15/15; Results 31/31; contracts 182/182; agents 116/116; Regions 49/49; interaction 24/24; presentation 35/35; boundaries 4/4; authorization retention 1,000/1,000. Full lint/Knip/site verification, format, and diff checks pass.
- Clean installed evidence: `artifacts/core-consumers/run-VU28KW/report.json` and `artifacts/runtime-consumers/run-SnH2yw/report.json`; package source digests are unchanged across each run. The core JavaScript consumer remains within its 71,680-byte gzip budget at 71,676 bytes.
- Full site evidence passes unit, build/typecheck, browser, BYOK, local-runner, all 71 documentation previews, responsive/layout, server/provenance, and 24 visual-baseline checks. Repeated render observation performs 256 subscribe/snapshot cycles without a new ResultStore allocation or HTTP request.
- Detailed evidence: `.superpowers/sdd/02-EXECPLAN/task-6-report.md`. Implemented and verified locally through production source, real protocol handlers, and clean installed packages. Nothing was published, deployed, pushed, or runtime-verified in production; no paid provider model was invoked.

### T07 / RQ11 — deterministic adaptive resolution and safe commitment

- Accepted source: `1e4fa2fca6cf1a818fb101db467c4f7f8588fe9e`; complete `6067d31..1e4fa2f` diff SHA-256 `dbaaf5f0f809b3f843cad1bf1780e49d78f8a45035866b39a9e5b6ea5b889f69`.
- Added one pure `resolvePresentation` facade over the existing composition, registry, validation, ranking, and transition path. Inputs are owned and bounded; decisions are deterministic; explicit candidates, pins, coverage, role/field/config requirements, clarification, and target identity fail closed without I/O or model use.
- Web recipe candidate failures are isolated, internal candidate IDs are bounded, and runtime commits are region-owned, cancellation-aware, target-fenced, and capable of restoring an authorized prior UI without overwriting a newer successor.
- Independent security review found one Important legacy adapter gap after the first exact-diff reviews: runtime candidate normalization read Proxy/accessor values before ownership. `1e4fa2f` now performs bounded inspection and structured cloning before field reads; regressions prove no hostile getter/value trap execution and controlled failure. Two independent final re-reviews report no Critical or Important findings.
- Fresh exact-source evidence: vNext 204/204; presentation adaptation 52/52; adaptation browser 2/2; clean installed adaptation consumer at `artifacts/adaptation-consumers/run-bxRJcH/report.json`; performance report `artifacts/performance-bundles/run-g9eMOj/report.json`; lint, format, diff, exact docs artifact, and the full site/browser/visual matrix pass.
- Detailed evidence: `.superpowers/sdd/02-EXECPLAN/task-7-report.md`. Implemented and locally/runtime verified through real source, browser, and installed packages; not published, deployed, pushed, or production-runtime verified. No paid provider model was invoked.

### T10 / RQ02 / RQ06 / RQ13 — native React/headless integration

- Accepted implementation source `42d0c5b`; test/config corrections `5e00232` and `ce00be0`. Added the scoped React surface subpath, effect-owned controller lifecycle, SSR-safe native views, adaptive/view bindings, and a runtime-backed React consumer without introducing a second workspace engine.
- Evidence: React-focused tests 5/5, vNext suite 226/226 before downstream T13 additions, strict `tests/vnext` TypeScript, package build, packed framework consumer, and vNext browser suite 13/13. No model call, publication, deployment, or production runtime verification occurred.

### T11 / RQ14 / RQ15 — host-owned actions and non-data jobs

- Accepted implementation source `b3f0aa8`. The action fixture uses the production ActionRegistry/ActionPort boundary with host-owned durable effects, stale authorization/entity checks, ambiguity/restart and idempotency handling. The job fixture uses a host-owned capability for progress, cancellation, and opaque output references without rows or catalog data.
- Evidence: focused action/job tests 8/8, runtime build, strict vNext TypeScript, and full vNext suite before downstream additions. No model call, publication, deployment, or production runtime verification occurred.

### T12 / RQ16 / RQ17 — request-scoped SSR and static islands

- Accepted implementation source `617a7ed` with React browser race correction `ce00be0`. Added request-scoped SSR and a static island path that reuse the same runtime contracts and keep server-only work out of browser entrypoints.
- Evidence: SSR/browser suite and full vNext browser suite 13/13, including no-JS useful DOM, principal isolation, slow hydration, rapid navigation, RTL/theme, and static-island checks; platform build and strict TypeScript pass. No deployment or production runtime verification occurred.

### T13 / RQ18 / RQ19 — adaptive experience recovery and accessibility

- Accepted implementation source `d452c77`. The real example path preserves focus and dirty drafts across resize/RTL/reduced-motion changes, exposes keyboard-completable clarification, distinguishes partial/unsupported/cancelled/denied states, and removes revoked content immediately. Accessibility assertions include keyboard/focus behavior and axe checks; manual assistive-technology certification remains unclaimed.
- Evidence: focused Playwright 5/5, vNext unit suite 256/256, component accessibility 12/12, and fresh vNext browser 22/22. The three-engine visual runs remain a clean-matrix gate; manual assistive-technology certification is not claimed. No publication/deployment occurred.

### T17 / RQ24 / RQ25 — source-driven catalog and documentation inventory

- Accepted sources `b64e043` and `733ed14`. The inventory loads active IDs from `catalog/components.json`, checks page/example/declaration/public-export parity and required authored sections/directives, and keeps public wording source-driven rather than relying on hard-coded counts.
- Evidence: `pnpm test:docs-inventory` reports 71/71 active IDs with 71/71 pages and examples; `pnpm test:docs-artifact` reports 10/10 verification tests and 121 authored/generated pages. No publication/deployment occurred.

### T14 / RQ20 / RQ21 — scoped optional agent bridge

- Accepted sources `a1db42d` and `aa1ef45`; the browser adapter is explicitly scoped by instance, surface, target and allowlist, carries bounded metadata, calls the real SurfaceController path, and reports renderer receipts. Rebinding changes scope identity and resets continuation instead of retargeting a prior controller.
- Evidence: focused bridge 6/6, agent suite 116/116, strict vNext TypeScript, agent build, and browser journey coverage. No provider/model call, publication, deployment, or production runtime verification occurred.

### T15 / RQ22 / RQ23 — provider-neutral model adapter and protocol limits

- Accepted source `2f8df85`; BYOK profiles require explicit endpoint/origin/auth policy, keep server credentials out of browser graphs, and exercise malformed/oversized/correlation/retry/rate/timeout/cancel/streaming behavior on a local HTTP fixture. The fixture does not contact a paid provider.
- Evidence: focused model profile 7/7, protocol model 11/11, agents 116/116, agent build, and strict TypeScript. Live paid-model qualification remains unperformed because authorization and credentials were not established.

### T16 / RQ26 / RQ27 / RQ28 / RQ29 / RQ30 — security and trust-boundary qualification

- Accepted source `b79ab59`; real tests cover cross-tenant serialized requests/cursors, ResultStore principal cache/revoke/TTL behavior, origin/CSRF and redirect fencing, SSR escaping/unsafe URLs, prompt/forged target/getter payloads, stale action confirmation, pending/oversized agent quotas, and expiring scoped endpoints.
- Evidence: `pnpm test:security` 5 files/14 tests, focused vNext security plus local-data 45/45, `pnpm test:boundaries` 4/4, `pnpm test:data:auth-retention` 1000/1000, and strict vNext TypeScript. No secrets, paid calls, publication, deployment, or production traffic were used.

### T18 / RQ34 / RQ35 — reference journeys and manual/agent parity

- Accepted sources `52b2bfe` and `adef0f3`; public no-JS content, manual and optional-agent comparison, independent enterprise windows with explicit host approval/revocation, remote transport, and host-owned non-data jobs all use the same runtime boundary and scoped receipts.
- Evidence: remote transport 1/1; Playwright journeys 4/4 in Chromium, Firefox, and WebKit; fresh vNext browser matrix 22/22. Browser fixtures and local HTTP transport were used; no live provider or production endpoint was contacted.

### T19 / RQ31 / RQ37 / RQ38 / RQ39 — measured performance and module scale

- Accepted sources `6fd4901` and `d9cd85a`; module-scale workload runs 10/100/1000 declarations with five active surfaces and five repetitions of 100 real interactions per tier. Runtime, browser and heap lifecycle checks retain bounded resources.
- Evidence: the final source-bound `artifacts/performance-workloads/vnext-module-scale-*.json` report records a qualification pass for all module tiers against the 100ms p95 budget; latest `artifacts/performance-bundles/run-*/report.json` bundle 6/6 pass, including the region-table cap; no cap, workload, or forbidden-module rule was changed.

### T20 / RQ36 / RQ40 / RQ42 / RQ44 / RQ45 / RQ46 — support, compatibility and release evidence

- Stable package/site artifacts remain 0.4.2 while candidate metadata names unreleased breaking 0.5.0. Migration, release notes, ship/support pages, and machine-readable support matrix explicitly distinguish qualified from unverified framework/browser/provider/runtime claims.
- Evidence: latest `artifacts/t20-qualification/run-*/report.json`, release tooling 31/31, packed five-package legacy and vNext consumers, positive no-agent graph, negative forbidden-module fixture, docs inventory 71/71, docs artifact 10/10, and fresh vNext browser 22/22. No npm publish, image publication, deployment, merge, push, or stable-line mutation occurred.

### T21 — final independent review and release readiness

- Review is bounded to read-only inspection and focused checks. The final candidate remains local-only; the review result and `artifacts/product-ci/ci.json` are the handoff evidence, and publication/deployment remain separately unauthorized.

## Resuming existing work

This is the reconciled final-v3 execution state. `PLAN-INDEX.json` remains the task mapping authority; historical source-bound evidence is preserved, and the latest clean matrix is the verification source of truth.
