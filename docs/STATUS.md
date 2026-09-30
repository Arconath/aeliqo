# Aeliqo status

Last updated: 2026-10-01. This is the single maintained status record. Release
history lives in the [release notes](site/pages/release-notes.md) and on
[GitHub releases](https://github.com/Arconath/aeliqo/releases).

## Goal

Aeliqo is an Apache-2.0 framework that turns a validated intent into a
registered view. The same path works from application code or an optional
agent (MCP, WebMCP, or a bring-your-own-key model). The host application owns
data, permissions, routes, and business effects. Aeliqo needs no account,
hosted backend, license server, or model call.

## Published

| Surface  | Current                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm      | `@aeliqo/core`, `runtime`, `web`, `react`, `agent` at `0.6.2` (`latest`), published source `e86a6e2f8d7808d1a580a2d3c63ff33e7fa3b89b`                         |
| Site     | Site/embedded SDK source `fb04d4a752fb1357a6ab2c6aaf4969aafbd22aa4`, SDK `0.6.2`; anonymous OSS, no persistent staging                                        |
| Image    | `ghcr.io/arconath/aeliqo-web@sha256:cebbb901d898ee677af05a4b79c1715fac87bfdfb44e3e578f2e8ab983a2b3ca`; two exact-image ready production replicas              |
| Delivery | Quality `36750567829`, production image `36759903067`, GitOps pin `658b6703a13e2bb7ab9afa9eaa069f211b3f3589`; runtime acceptance passed, no package republish |

GitHub release [Aeliqo 0.6.2](https://github.com/Arconath/aeliqo/releases/tag/v0.6.2)
is published as latest. Its tag identifies the exact npm source
`e86a6e2f8d7808d1a580a2d3c63ff33e7fa3b89b`; the release record links the
same-source full quality and stable publication evidence. No packages or site
image were republished to create this record.

**Current live evidence (2026-10-01):** Flux reports both Aeliqo kustomizations Ready
at GitOps revision `658b6703a13e2bb7ab9afa9eaa069f211b3f3589`; both production
replicas run the exact `cebbb90` image and source `fb04d4a`. Apex, www and docs
report the exact site/SDK revision and SDK `0.6.2`; production health,
readiness, cache/security headers and public routes passed. Thirty focused
browser journeys passed across Chromium, Firefox and WebKit at 360, 768 and
1440 pixels, plus no-JavaScript quickstart keyboard/reflow checks at 320 pixels.
The live filter, documentation search, playground workspace/page journeys,
experimental WebMCP checks, and 0.6.2 package export passed with zero model
calls. No axe violations or page errors were observed across the 27 hydrated
route captures. This is not full accessibility certification. Package registry
checks verified all five 0.6.2 packages; no package was republished. Rollback
uses the previous qualified immutable image in the GitOps record; application
rollback does not change npm packages.

## Progress against the goal

- **Done:** intent-to-view for components, workspaces, and registered pages;
  71 documented components; React, Vue, Vanilla, and Next SSR consumers; agent
  tools that accept a minimal intent and return ready-to-send examples; a
  standalone local MCP/BYOK example; a public playground with manual controls
  and native WebMCP.
- **Partly done:** render-tool diagnostics now include valid context choices
  for common field, view, measure, filter-value, and time-grain errors, and
  distinguish a malformed measure object from an unknown meaning. A
  `renderer-ready` result confirms visibility; `plan-committed` does not.
- **Not proven:** no measured success rate with a real model on the 0.6 tools,
  no external adopters yet, and WebMCP still needs an experimental browser
  flag.

Field/data-status direction and context-aware diagnostic hints are included in
the published `0.6.2` source. The site-only factual JSON-LD and gtag queue fixes
have passed their exact-source required quality/build checks and are live.

The retained Chromium visual review of source `4b86ed9` inspected 513 images,
including all 71 catalog components at three sizes and all visualization states.
Table/comparison narrow RTL overflow is intentional; fresh focused keyboard
scroll and geometry checks passed. The review found a synthetic form-flow
invalid state claiming an empty required name while showing the populated
catalog example. Its fixture now clears the displayed field and draft together,
requires the field, and asserts the actual empty value. The prior fixture failed
the new assertion; all nine browser/size variants and visual TypeScript checks
passed after correction. No component, package or live site behavior changed.
Current clean fixture source `4a7562f4f552ba1349c487243ad81aa047d1b6ae`
passed required quality `36672716809`. Its pinned Linux full visual aggregate
contains 1,830 tests and 2,862 PNGs: 610 tests/954 images per browser, two
byte-identical captures, sourceBuilt=true and candidateDirty=false. Fixture
SHA is `5f1e2c7b664412af5b79572b16db1935d1f835238f9a504f84932ebbbc096625`.

**Baseline approval, 30 September 2026:** root deliberately approves this
source/fixture and the exact recorded container, browsers and fonts after
review by root, Luna visual reviewer and an independent Sol metadata reviewer.
The retained Chromium review covers all 71 catalog components at three sizes
and visualization/important states; current inventory matches, 951/954 images
are byte-identical to that reviewed source, and all three corrected invalid-form
frames were reviewed. Firefox and WebKit each had all 954 images inspected in
contact sheets, all 71 desktop component images and 21 important state images
inspected at full resolution. Narrow RTL tables retain intentional horizontal
scrolling. This does not claim exhaustive full-resolution review of all 2,862
images or assistive-technology acceptance. The exact runner and two-capture,
zero-diff policy are recorded in `scripts/visual/baseline.json`.

Strict pinned-image comparison passed on approval commit
`6e1ab03f405c8c50b4238144fd952440c2c92e8d`, quality run `36682155398`.
Its fresh aggregate reports approved=true, full scope, 1,830 tests and 2,862
images across Chromium, Firefox and WebKit against the exact fixture SHA above.
The required functional shards, aggregate and release contract also passed.
The earlier probe stays `probe-reproducible-unapproved`; it is not relabeled.
The paired performance job failed before measurement because its workload
hash differs from the old baseline. Qualification was owner-deferred on
30 September; the 1 October repair release now includes a fresh same-source
stability experiment and independent evidence review before approval.

## Active release: 0.6.3

The owner requested all outstanding fixes and a release on 1 October 2026.
This patch updates the Next.js integration fixture to the security-patched
16.3.6 and requalifies the current paired layout/visualization workload.
The lockfile change requires the verified package-publication flow; versions,
peer pins, examples and current installation instructions move together to
0.6.3. Public APIs and runtime/wire contracts remain compatible with 0.6.2.

1. **Next.js security fix — focused checks passed:** alerts 3 and 5 identify
   the same Node `next/og` ImageResponse RCE. Next.js 16.3.6, frozen installation,
   optimized production build and real SSR/hydration checks passed before the
   version-alignment change. The fixture does not use ImageResponse.
2. **Integrated source A — candidate checks passed:** versions and guides
   align, and independent security/release and cancellation-test reviews have
   no remaining findings. [Exact-source diagnostic quality](https://github.com/Arconath/aeliqo/actions/runs/36768880081)
   passed all 92 commands and the release contract at `6c31d36`, without source
   changes. A local full run passed its first 81 commands, then failed during
   Firefox trace close because the disk was full; the complete local Firefox
   suite passed after disk headroom returned. No assertions or timeouts changed.
3. **Reference reviews — approved for metadata source B:** the
   [performance review](testing/0.6.3-performance-reference.md) independently
   verifies twelve reports, raw samples, traces and source manifests from three
   same-source pairs at `d90a2c8`. Two reviews support the existing policies;
   planner variation and tails remain recorded. The
   [visual review](testing/0.6.3-visual-reference.md) verifies all 2,862 PNGs,
   identical repeats and exact equality with historical reviewed captures, plus
   24 fresh frame inspections across three browsers at `6c31d36`. The source
   fixture identity changed only for the catalog manifest version.
4. **Approval source B — metadata recorded; final comparison pending:**
   performance and visual metadata name those fixed sources and reviewed
   workload/fixture and runner identities. The 20% plus 2 ms relative rule,
   all absolute budgets, two-capture reproducibility and zero-diff pixel rule
   are unchanged. Require actual strict comparisons and a same-SHA full-matrix
   main-push success before publication. Diagnostic probes remain unapproved
   machine reports and do not replace final release acceptance.
5. **Publication and deployment — pending source B:** publish verified
   0.6.3-rc.1, verify its registry artifacts and provenance, publish stable
   0.6.3, build/attest/scan the same-source image, review the bounded GitOps
   promotion, and verify Flux, two exact-image replicas and public journeys.
   Package and image publication and deployment are authorized by the owner.

The performance failure is a workload-identity mismatch, not a measured
regression: the current digest is `c9f7283566889e784043cc07703215c6ca882dfdd45da284dc9849e6326314fb`
and the historical approved digest is `867fadc9677857bbbca368716c9d52a78d97e7e5cb419f66207e1d42ed65c913`.
The changed fixture opens the collapsed exact-data disclosure and uses current
row copy; the bundle threshold change was already owner-approved for 0.6.0.
No automatic hash acceptance or budget weakening is planned.

The site is stateless, so there is no data migration. Deployment rollback
targets the currently accepted immutable `cebbb901` image and source
`fb04d4a`; rollback does not unpublish npm versions. No disaster-restore or
live rollback exercise is claimed. The next executable step is independent review of the approval metadata,
followed by exact-source strict comparisons and full main-push verification.

## Open items

Focused live Chromium review on 30 September 2026 exercised the homepage,
docs quickstart and playground at 360 and 1440 pixels. Homepage filtering and
trend, docs shortcut/search, and playground filtered/chart/workspace/page
journeys passed without page errors. The mobile quickstart table triggered
axe's `scrollable-region-focusable` finding: its 608-pixel content sits in a
326-pixel container without a keyboard tab stop. This review does not establish
screen-reader acceptance or repeat all browser/component coverage.

The findings above are now fixed in the reviewed site/docs change. The quickstart
results table reflows at 320, 360, 768 and 1440 pixels, keeps intent identifiers
on one line, and remains a named keyboard focus stop with or without JavaScript.
The narrow playground task chooser now precedes the result in both visual and
DOM order. README and introductory guides distinguish standalone components,
the smaller local React surface, and the registered-resource quickstart.

Fresh local verification passed `pnpm format:check`, `pnpm lint`,
`pnpm site:test`, `pnpm test:docs-artifact` and `pnpm site:build`, plus the
production image contract smoke. A focused review of that local image passed
27 homepage/quickstart/playground renders in Chromium, Firefox and WebKit at
360, 768 and 1440 pixels, with no page errors or settled axe findings, and
three no-JavaScript keyboard/reflow checks at 320 pixels. Independent source
and focused screenshot review supported the changes. These checks used a
modified local tree; they do not replace exact-commit CI or deployment evidence.

The first release CI run caught a Linux font-dependent overflow at 320 pixels.
Prose in the quickstart table now has additional word-wrap opportunities while
intent identifiers stay unbroken. Regression coverage also exercises a wider
fallback font. Clean source `b5b2cb054820f624e0095d96a690ca063419b9fa`
passed all 92 local acceptance commands and required CI `36739295753`, plus
the approved pinned Linux visual aggregate. Site build `36749158528` then
rejected `scripts/visual/baseline.json` as a package change. The site-only
classifier now permits that exact visual evidence file; package source,
package guides, the lockfile and other scripts remain rejected. An executable
regression reproduced the rejection before the fix and all 32 release-tooling
tests passed afterward. Exact-source quality run `36750567829` passed all
required checks; production image run `36759903067` and live acceptance for
source `fb04d4a` passed. A post-release fix to the live smoke test's search
initialization wait was verified against production without changing the
deployed image or package artifacts.

| Item                                                                       | Next step                                                                                                      |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Paired performance workload changed after `0.6.1` and remains unqualified. | The probe and reviews are complete; require the final strict comparison and exact-source main-push acceptance. |
| Two critical Next.js alerts affect the integration fixture and lockfile.   | Patched to 16.3.6 in the 0.6.3 candidate; complete exact-source verification and release.                      |

Visual and paired-performance jobs are advisory; the functional matrix in
`quality/commands.json` is the required gate. Aeliqo keeps its GitHub-hosted OSS
and site-release workflows; hosted-product auth, billing and staging do not apply.
