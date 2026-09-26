---
id: 'support-matrix'
path: '/ship/support-matrix/'
section: 'Releases'
title: 'Aeliqo 0.5 support matrix'
description: 'Bounded framework, browser, provider, and workload evidence for the Aeliqo 0.5 line.'
---

<p class="lead">Check what the 0.5 line has actually been tested against. Rows marked unverified or unsupported are not promises.</p>

The current 0.5 line keeps one source-bound contract across the five packages,
the documentation site, and the playground. The patch release carries the
same 0.5 API and runtime boundaries. It makes the getting-started routes,
registered-app tutorial, and public journeys easier to follow.

This matrix describes bounded evidence for the 0.5 line. It is not a
promise that every framework, provider, or application size is supported.

The machine-readable source is [`docs/support-matrix.json`](https://github.com/Arconath/aeliqo/blob/main/docs/support-matrix.json).
Its candidate and publication flags record source qualification and are not
live registry-status lookups. Use the release run and the public `/version`
route for the package and site identity that is currently deployed.
`qualified` means the named fixture and version passed. `qualified-bounded`
means the result is limited to the stated synthetic or integration profile.
`protocol-only`, `unverified`, and `unsupported-claim` are intentionally not
release guarantees.

## Qualified profiles

| Area       | Qualified profile                                                                                                                      | Boundary                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Frameworks | Vanilla DOM, Lit 3.3.3, React 19.2.8, Vue 3.5.42, Next 16.3.4                                                                          | Only the listed versions and tested fixtures are qualified.                                                      |
| Browsers   | Chromium, Firefox, WebKit through Playwright 1.63.0                                                                                    | Native WebMCP remains unverified; simulated capability tests are separate.                                       |
| Providers  | No-AI paths; local synthetic protocol fixture; DeepSeek `deepseek-flash` on the 12-case J1–J3 corpus                                   | The live result is limited to that model and synthetic browser journey; other hosted profiles remain unverified. |
| Workloads  | Four reference journeys plus J1–J3 playground journeys; bounded paged synthetic data; 1,000 declared modules with five active surfaces | Production database throughput and unlimited application size are unverified or unsupported claims.              |

Use the JSON file and its evidence paths when reporting a profile. Do not turn
an untested row into a blanket support statement. Do not treat a mock model or
synthetic server as live provider or production-backend evidence.

The bounded DeepSeek run passed 12/12 cases on tree-equivalent PR head
`21afcca` (tree `955a7d1`), as recorded in the
[sanitized case receipt](https://github.com/Arconath/aeliqo/blob/main/docs/plans/aeliqo-vnext/evidence/deepseek-flash-j1-j3-21afcca.json).
It exercised the browser, provider, and renderer. It does not establish general
model quality, production backend behavior, or human assistive-technology use.
No further paid model requests are authorized.
