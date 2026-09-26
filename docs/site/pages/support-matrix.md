---
id: 'support-matrix'
path: '/ship/support-matrix/'
section: 'Releases'
title: 'Support matrix and release acceptance'
description: 'Check the 0.6.0 candidate acceptance status and the separate historical 0.5.2 qualification record.'
---

<p class="lead">The 0.6.0 candidate adds registered workspace and page composition to the existing component path. Its maintained profiles are awaiting final acceptance on the release source.</p>

The [active machine-readable matrix](https://github.com/Arconath/aeliqo/blob/main/docs/support-matrix.json)
identifies candidate `0.6.0`, base `0.5.2`, and additive compatibility. Its
`pending-final-acceptance` entries name the checks that must pass on the final
source. Test paths alone are not completed release evidence. All capability,
publication, and deployment claim flags remain false until final records exist.

Read [release notes](/ship/release-notes/) for changes and the
[shipping guide](/ship/) for application checks. Use the release run and public
`/version` route to identify deployed packages and site source; this document
is not a live registry lookup.

## Current candidate profiles

| Area              | Maintained profile                                                                                          | Acceptance boundary                                                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toolchain         | Node 24.20.0, pnpm 11.24.0, TypeScript 7.0.2, Vite 8.2.2, Playwright 1.63.0                                 | Pinned versions; final source acceptance pending.                                                                                                                                                  |
| Frameworks        | Vanilla DOM, Lit 3.3.3, React 19.2.8, Vue 3.5.42, Next 16.3.4                                               | Installed consumers and SSR checks remain required. Svelte and Angular are unverified.                                                                                                             |
| Browsers          | Chromium, Firefox, WebKit                                                                                   | Full browser, accessibility and visual acceptance remains pending.                                                                                                                                 |
| Native WebMCP     | Chromium 153.0.8010.12 with `WebMCPTesting` enabled                                                         | Focused native discovery, invocation, component/workspace/page rendering and reset checks passed; exact final source acceptance is pending. Experimental capability availability must be detected. |
| Agent integration | No-model operation, local protocol fixtures, standalone MCP HTTP/stdio, optional server-owned model adapter | Protocol and deterministic fixtures do not establish hosted-model quality. No current live-provider profile is qualified.                                                                          |
| Composition       | Components, multi-result workspaces, and registered pages with application-owned header/sidebar views       | Final installed-consumer and state/draft/revocation checks remain required. [Run the composition tutorial](/guides/workspace/).                                                                    |
| Workloads         | Synthetic reference journeys, paged data, and 1,000 declarations with five active surfaces                  | Final measured acceptance remains pending; these profiles do not establish production database throughput or unlimited scale.                                                                      |

Follow [WebMCP setup](/agents/webmcp/) for the tested experimental flag path.
Native, simulated and unavailable-browser results are separate evidence.
Provider independence means agents can submit bounded requests through common
contracts; it does not mean every provider uses the same wire format or has
passed a quality evaluation.

## Historical 0.5.2 record

The former matrix is preserved byte for byte in
[`docs/releases/0.5.2/support-matrix.json`](https://github.com/Arconath/aeliqo/blob/main/docs/releases/0.5.2/support-matrix.json).
Its original candidate metadata and qualified profiles describe that historical
record. They are not acceptance for 0.6.0.

That record includes a bounded DeepSeek `deepseek-flash` run: 12/12 synthetic
J1–J3 browser/provider/renderer cases on tree-equivalent PR head `21afcca`
(tree `955a7d1`), recorded in the
[sanitized case receipt](https://github.com/Arconath/aeliqo/blob/main/docs/plans/aeliqo-vnext/evidence/deepseek-flash-j1-j3-21afcca.json).
It qualifies only that recorded model, corpus and source context. It does not
establish other model quality, production workloads, human assistive-technology
use, or current-release acceptance.
