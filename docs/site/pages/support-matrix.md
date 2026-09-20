---
id: 'support-matrix'
path: '/ship/support-matrix/'
section: 'Ship'
title: 'vNext support matrix'
description: 'Qualified framework, browser, provider, and workload profiles for the unreleased Aeliqo 0.5.0 candidate.'
---

The live package line remains `0.4.2`. This matrix describes the unreleased
`0.5.0` candidate only; it is a qualification record, not a promise that every
framework, provider, or application size is supported.

The machine-readable source is [`docs/support-matrix.json`](https://github.com/Arconath/aeliqo/blob/main/docs/support-matrix.json).
`qualified` means the named fixture and version passed. `qualified-bounded`
means the result is limited to the stated synthetic or integration profile.
`protocol-only`, `unverified`, and `unsupported-claim` are intentionally not
release guarantees.

## Qualified profiles

| Area       | Qualified profile                                                                                       | Boundary                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Frameworks | Vanilla DOM, Lit 3.3.3, React 19.2.8, Vue 3.5.42, Next 16.3.4                                           | Only the listed versions and tested fixtures are qualified.                                         |
| Browsers   | Chromium, Firefox, WebKit through Playwright 1.63.0                                                     | Native WebMCP remains unverified; simulated capability tests are separate.                          |
| Providers  | No-AI paths; local synthetic protocol fixture                                                           | Live model quality, provider latency, and other hosted providers are unverified.                    |
| Workloads  | Four reference journeys, bounded paged synthetic data, 1,000 declared modules with five active surfaces | Production database throughput and unlimited application size are unverified or unsupported claims. |

Use the JSON file and its evidence paths when reporting a profile. Do not turn
an untested row into a blanket support statement, and do not treat a mock model
or synthetic server as live provider or production-backend evidence.
