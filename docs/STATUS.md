# Aeliqo status

Last updated: 2026-09-30. This is the single maintained status record. Release
history lives in the [release notes](site/pages/release-notes.md) and on
[GitHub releases](https://github.com/Arconath/aeliqo/releases).

## Goal

Aeliqo is an Apache-2.0 framework that turns a validated intent into a
registered view. The same path works from application code or an optional
agent (MCP, WebMCP, or a bring-your-own-key model). The host application owns
data, permissions, routes, and business effects. Aeliqo needs no account,
hosted backend, license server, or model call.

## Published

| Surface  | Current                                                                                                                                                                                  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm      | `@aeliqo/core`, `runtime`, `web`, `react`, `agent` at `0.6.2` (`latest`), published source `e86a6e2f8d7808d1a580a2d3c63ff33e7fa3b89b`                                                    |
| Site     | Site/embedded SDK source `dbd7dcde686575896464c06f1be03e99d2761c56`, SDK `0.6.2`; anonymous OSS, no persistent staging                                                                   |
| Image    | `ghcr.io/arconath/aeliqo-web@sha256:e8d5d62539ee8bdef08c219752b4a3b566c9ec4cfb38aa5008bb32ee8ef3dab6`; two exact-image ready production replicas                                         |
| Delivery | Quality `36632473766`, site-only owner build `36636757260`, GitOps pin `1429fdfb81e57c181bbbb01a5a8e3c930868be5f`, runtime receipt `34d6e06`; same immutable image, no package republish |

**Current live evidence (2026-09-30):** Flux Ready/Healthy; twelve apex/www version,
health/readiness and public route checks passed against exact `dbd7dcd`. Chrome
rendered the synthetic homepage demo with no console errors. Google Analytics
property `556602732` realtime received an Aeliqo homepage view and `page_view`,
`first_visit`, `session_start`; the tag remains consent-gated. Registry consumer
checks verified all five packages, provenance and 166 exports for published
`0.6.2`. This is separate from approval of a visual baseline. Rollback uses the
previous qualified `996fb10e` image recorded in the existing GitOps receipt;
application rollback does not change npm packages.

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

The existing full pinned-image comparison must now run on the approval commit;
its result remains unverified until that run finishes. The earlier probe stays
`probe-reproducible-unapproved`, never relabeled as an approved pixel pass.
The paired performance job failed before measurement because its workload
hash differs from the old baseline; qualification remains owner-deferred,
without changing pins, accepting the hash or claiming measured performance.

## Open items

| Item                                                                               | Next step                                                                                           |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Reviewed baseline metadata is approved; strict pinned-image comparison is pending. | Run the existing comparison on the approval commit and inspect its fresh result.                    |
| Paired performance workload changed after `0.6.1` and remains unqualified.         | Deferred by the owner; retain that state without expanding this release into a performance project. |

Visual and paired-performance jobs are advisory; the functional matrix in
`quality/commands.json` is the required gate. Aeliqo keeps its GitHub-hosted OSS
and site-release workflows; hosted-product auth, billing and staging do not apply.
