---
id: 'support-matrix'
path: '/ship/support-matrix/'
section: 'Ship'
title: 'vNext support matrix'
description: 'Bounded framework, browser, provider, and workload evidence for Aeliqo 0.5.0.'
---

<aeliqo-release-status></aeliqo-release-status>

This matrix describes bounded local evidence for the 0.5.0 source. It is not a
promise that every framework, provider, or application size is supported.

The machine-readable source is [`docs/support-matrix.json`](https://github.com/Arconath/aeliqo/blob/main/docs/support-matrix.json).
Its publication flag records the prepublication source qualification and is not
a live registry-status lookup; use the release evidence for that status.
`qualified` means the named fixture and version passed. `qualified-bounded`
means the result is limited to the stated synthetic or integration profile.
`protocol-only`, `unverified`, and `unsupported-claim` are intentionally not
release guarantees.

## Qualified profiles

| Area       | Qualified profile                                                                                       | Boundary                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Frameworks | Vanilla DOM, Lit 3.3.3, React 19.2.8, Vue 3.5.42, Next 16.3.4                                           | Only the listed versions and tested fixtures are qualified.                                         |
| Browsers   | Chromium, Firefox, WebKit through Playwright 1.63.0                                                     | Native WebMCP remains unverified; simulated capability tests are separate.                          |
| Providers  | No-AI paths; local synthetic protocol fixture                                                           | The live-model J1–J3 qualification report is separate; other hosted providers remain unverified.   |
| Workloads  | Four reference journeys, bounded paged synthetic data, 1,000 declared modules with five active surfaces | Production database throughput and unlimited application size are unverified or unsupported claims. |

Use the JSON file and its evidence paths when reporting a profile. Do not turn
an untested row into a blanket support statement, and do not treat a mock model
or synthetic server as live provider or production-backend evidence.
