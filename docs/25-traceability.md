# 25 — Requirement traceability (Master consolidation)

Specification coverage is not implementation evidence. All product tasks remain planned until actual execution. This table is generated from harness/requirements.json.

| ID | Requirement | Specification | Tasks | Scenarios |
|---|---|---|---|---|
| R01 | Entire data-to-pixel lifecycle | [01-architecture.md](01-architecture.md) | T03, T06, T07, T09, T19, T20 | S01, S02, S03 |
| R02 | Opinionated DX and designer standard | [09-experience-dx.md](09-experience-dx.md) | T12, T26, T32 | S08, S29, S35 |
| R03 | One agnostic data contract, no vendor adapter explosion | [02-data-contract.md](02-data-contract.md) | T06, T08 | S25, S32, S38 |
| R04 | Shared renderer, no per-framework component fork | [08-rendering-stack.md](08-rendering-stack.md) | T02, T25 | S25, S26, S27 |
| R05 | Safe automatic plus AI/manual derived meaning | [03-semantics-derived.md](03-semantics-derived.md) | T04, T23 | S05, S06, S07, S37 |
| R06 | Raw-data query correctness and scale | [04-intent-query.md](04-intent-query.md) | T07, T08 | S02, S03, S04, S15, S16 |
| R07 | Task-aware UI intelligence | [06-presentation-compiler.md](06-presentation-compiler.md) | T19, T20 | S08, S10, S30 |
| R08 | Container, small screen, zoom and explicit choices | [06-presentation-compiler.md](06-presentation-compiler.md) | T20, T29 | S08, S09, S10 |
| R09 | Complete usable owned primitives and 2D components | [29-component-contracts.md](29-component-contracts.md) | T13, T14, T15, T16, T18, T21 | S35 |
| R10 | Pixel precision, theming and production quality | [08-rendering-stack.md](08-rendering-stack.md) | T12, T29 | S29, S35 |
| R11 | Accessibility and user state | [10-interaction-a11y.md](10-interaction-a11y.md) | T11, T29 | S09, S28, S29 |
| R12 | Performance/bundles/resources | [12-performance.md](12-performance.md) | T30 | S11, S12, S14 |
| R13 | Enterprise permissions and audit hooks without paid safety tax | [13-security-enterprise.md](13-security-enterprise.md) | T28 | S19, S20, S21 |
| R14 | MCP, WebMCP, BYOK shared smart capabilities | [14-agents-protocols.md](14-agents-protocols.md) | T22, T24 | S22, S23, S24 |
| R15 | Not dashboard-only; app-region integration | [09-experience-dx.md](09-experience-dx.md) | T25, T31 | S30, S31 |
| R16 | Maintainable code/package/project structure | [17-project-structure.md](17-project-structure.md) | T03, T25, T32 | S25, S35 |
| R17 | OSS to sustainable business boundary | [15-oss-business.md](15-oss-business.md) | T35 | S25 |
| R18 | Blank-tree rewrite with historical rollback | [18-release-migration.md](18-release-migration.md) | T00, T34 | S36 |
| R19 | New npm 0.1.0, never overwrite old versions | [18-release-migration.md](18-release-migration.md) | T33, T36 | S36 |
| R20 | Atomic Git commits and safe GitHub publication | [19-harness.md](19-harness.md) | T00, T38 | S34, S36 |
| R21 | Astra medium orchestration and maximum useful Luna max delegation | [19-harness.md](19-harness.md) | T01 | S38 |
| R22 | Executable prompts, AGENTS, skills and harness | [19-harness.md](19-harness.md) | T01, T32 | S35 |
| R23 | Real source-backed research, no fictional evidence | [24-research-sources.md](24-research-sources.md) | T00, T32, T38 | S22, S24, S28, S36 |
| R24 | All scope gates and full completion, not just scaffold | [20-execution-plan.md](20-execution-plan.md) | T32, T38 | S35, S36 |
| R25 | Results/stream/cache identity and recovery | [05-results-lifecycle.md](05-results-lifecycle.md) | T09, T10 | S13, S14, S17, S34 |
| R26 | No arbitrary generated code; domain boundaries user governed | [07-ui-grammar.md](07-ui-grammar.md) | T04, T11, T23, T28 | S07, S20, S21 |
| R27 | General composition, not compulsory templates | [06-presentation-compiler.md](06-presentation-compiler.md) | T19, T39 | S39, S49 |
| R28 | Multigrain task outputs, queryless paths and fixed/live lineage | [31-contract-closure.md](31-contract-closure.md) | T05, T09, T39 | S40, S41, S50 |
| R29 | Reasoning, evidence-grounded explanation and explicit visible commits | [30-smartness-operational.md](30-smartness-operational.md) | T22, T40 | S42, S45, S46 |
| R30 | Real input/version/quality evidence consistency | [35-audit-resolution.md](35-audit-resolution.md) | T01, T03, T32 | S43, S44, S47, S48, S52 |
| R31 | End-to-end smartness evaluation and honest performance | [32-evaluation-plan.md](32-evaluation-plan.md) | T30, T39, T40 | S38, S39, S45, S51 |

## Master edition traceability

The machine requirements manifest adds R32 weak-model containment, R33 exact0.1.0 reset, R34 master-ledger consistency and R35 end-user site/docs/playground quality. [Discussion ledger](39-discussion-ledger.md) maps all decisions and corrections. New scenarios S53–S64 exercise formal proposal failure/recovery, grants, narrative limits, duplicates/cancel, version collision/reset and public documentation behavior. Traceability means a requirement has a specification/task/test target, not that the runtime is implemented.

## Edition 1.1 developer meaning delta

R05 additionally maps to T04/T06/T23/T25 and S65/S66/S67: first-class code/config authoring, canonical parity, authorized default registration and repo ownership. R02 additionally maps T25/S67 for compiled ergonomic developer examples. The machine-readable requirement map is updated; previous tests and mandatory scope remain unchanged. Scenarios are planned product evidence, not kit validation results.
