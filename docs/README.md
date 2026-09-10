# Peta dokumentasi — Aeliqo 0.1.0

[MASTER-SOT.md](../MASTER-SOT.md) adalah pintu masuk dan authority produk. Detail domain berada di chapter di bawah, bukan SoT lain yang bersaing. Root [AGENTS.md](../AGENTS.md) mengatur pekerjaan, dan harness/task state melacak evidence. Kit lama dan diagram generatif tidak ditumpuk.

| Bab | Isi |
|---|---|
| [00](00-decisions.md) | 00 — Decision record and product constitution |
| [01](01-architecture.md) | 01 — End-to-end architecture |
| [02](02-data-contract.md) | 02 — Application Data Contract: agnostic without connector proliferation |
| [03](03-semantics-derived.md) | 03 — Meaning, derived values and authoring |
| [04](04-intent-query.md) | 04 — Intent binding and query compilation |
| [05](05-results-lifecycle.md) | 05 — Results, resources and consistency |
| [06](06-presentation-compiler.md) | 06 — Smart presentation with task preservation |
| [07](07-ui-grammar.md) | 07 — UI grammar and component abstraction |
| [08](08-rendering-stack.md) | 08 — Platform implementation and stack |
| [09](09-experience-dx.md) | 09 — Aeliqo experience standard and developer/designer workflow |
| [10](10-interaction-a11y.md) | 10 — Interaction, accessibility and user agency |
| [11](11-component-catalog.md) | 11 — Complete ready-to-use release catalog |
| [12](12-performance.md) | 12 — Performance budgets and proof |
| [13](13-security-enterprise.md) | 13 — Security, tenancy and enterprise operation |
| [14](14-agents-protocols.md) | 14 — Agent capabilities: one execution path |
| [15](15-oss-business.md) | 15 — OSS-to-business boundary |
| [16](16-quality-gates.md) | 16 — Quality and evidence gates |
| [17](17-project-structure.md) | 17 — Repository structure and maintainability |
| [18](18-release-migration.md) | 18 — Rewrite bersih, reset versi 0.1.0, dan cutover |
| [19](19-harness.md) | 19 — Agent harness: Astra Medium + Luna Max |
| [20](20-execution-plan.md) | 20 — Implementation from an empty tree to release |
| [21](21-acceptance-scenarios.md) | 21 — End-to-end acceptance scenarios |
| [22](22-api-sketches.md) | 22 — Public API contract direction |
| [23](23-adversarial-design-review.md) | 23 — Adversarial review of the architecture |
| [24](24-research-sources.md) | 24 — Primary research and evidence boundary |
| [25](25-traceability.md) | 25 — Requirement traceability (Master consolidation) |
| [26](26-observations.md) | 26 — Observations and evidence boundary |
| [27](27-reference-host.md) | 27 — Reference host and executable proof strategy |
| [28](28-positioning.md) | 28 — Differentiation and ecosystem choices |
| [29](29-component-contracts.md) | 29 — Required component contracts |
| [30](30-smartness-operational.md) | 30 — Smartness as an operational contract |
| [31](31-contract-closure.md) | 31 — Contract closure before implementation freeze |
| [32](32-evaluation-plan.md) | 32 — Evaluation of intelligence and task quality |
| [33](33-performance-experiments.md) | 33 — Performance architecture and experiment protocol |
| [34](34-implementation-work-orders.md) | 34 — Work orders for implementation agents |
| [35](35-audit-resolution.md) | 35 — Consolidated audit resolution map |
| [36](36-research-update.md) | 36 — Master consolidation primary research and decision boundary |
| [37](37-model-failure-containment.md) | 37 — Kegagalan model, validasi, dan batas jaminan |
| [38](38-public-site-docs-playground.md) | 38 — Website, docs, playground, dan pengalaman adopsi |
| [39](39-discussion-ledger.md) | 39 — Register keputusan dari seluruh diskusi |
| [40](40-current-research.md) | 40 — Riset primer terkini dan batas inferensi |
| [41](41-engineering-operating-standard.md) | 41 — Standar engineering, scalability, dan maintainer operations |

Release-facing boundaries: [OSS and commercial boundary](business/oss-commercial-boundary.md) and [0.1.0 support boundary](public/0.1.0-support-boundary.md).

## Jalur baca

User/developer: master → DX09 → source02 → meaning03 → examples22 → website38.
Core/runtime: master → architecture01 → semantics03/query04/result05 → closure31 → AI37 → engineering41.
Designer/platform: master → presentation06/grammar07/stack08 → experience09/a11y10 → catalog11/29 → website38.
Orchestrator/release: AGENTS → execution20 → harness19 → quality16 → release18 → trace25/ledger39 → research40.

Spesifikasi menjelaskan target; status implemented/validated/published hanya dari evidence yang sesuai. Reference scripts/TS tidak sama dengan SDK produksi.
